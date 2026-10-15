'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db, save } = require('./db');
const fsx = require('./filestore');
const viewer = require('./viewer');
const analytics = require('./analytics');
const safety = require('./security');
const roles = require('./roles');

const { CATS, MIME, STORAGE } = fsx;
const tf = (v) => v === true || v === '1' || v === 'true' || v === 'on';
const getCookie = (req, name) => { const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '=')); return m ? decodeURIComponent(m.slice(name.length + 1)) : ''; };
const disp = (type, name) => `${type}; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;
const stateOf = (f) => (f.status === 'suspended' ? 'suspended' : f.archived ? 'archived' : f.expires && f.expires <= Date.now() ? 'expired' : 'active');

// Admin = Admin or Super Admin (see lib/roles.js)
const isAdmin = (u) => roles.isStaff(u);

function softUser(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const s = db.sessions.find((x) => x.token === t && x.exp > Date.now());
  return s ? db.users.find((u) => u.id === s.uid) || null : null;
}
async function readText(f) {
  const fh = await fs.promises.open(path.join(STORAGE, f.disk), 'r');
  try {
    const b = Buffer.alloc(20000), r = await fh.read(b, 0, 20000, 0);
    return { text: b.slice(0, r.bytesRead).toString('utf8'), more: f.size > r.bytesRead };
  } finally { await fh.close(); }
}
function stats(f) {
  const days = Array(7).fill(0), dev = {};
  const end = new Date(); end.setHours(23, 59, 59, 999);
  (f.log || []).forEach((l) => {
    const d = Math.floor((end - l.t) / 864e5);
    if (d >= 0 && d < 7) days[6 - d]++;
    dev[l.d] = (dev[l.d] || 0) + 1;
  });
  return { days, dev };
}

module.exports = function mount(app, { auth, limit, base }) {
  const admin = (req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ error: 'Admin access required.' }));
  const find = (code) => db.files.find((f) => f.code === code);
  const mine = (req) => db.files.find((f) => f.id === req.params.id && f.uid === req.user.id);
  const rmDisk = (name) => { if (name) fs.unlink(path.join(STORAGE, name), () => {}); };
  const newCode = () => { let c; do { c = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8); } while (db.files.some((f) => f.code === c) || db.qrs.some((q) => q.code === c) || (db.statics || []).some((s) => s.code === c)); return c; };

  const view = (f, req) => Object.assign({
    id: f.id, code: f.code, url: base(req) + '/f/' + f.code, title: f.title, name: f.name, ext: f.ext, cat: f.cat, size: f.size,
    access: f.access, hasPassword: !!f.pw, allowDownload: f.allowDownload !== false, expires: f.expires || null, archived: !!f.archived,
    status: f.status || 'ok', reports: f.reports || 0, views: f.views || 0, downloads: f.downloads || 0, scanned: !!f.scanned,
    created: f.created, updated: f.updated || f.created,
    prev: '/f/' + f.code + '/raw?t=' + fsx.sign(f.code, 30 * 60e3, true), // short-lived owner preview link
  }, stats(f));

  /* ---------- multer: files are streamed to storage/ with random names ---------- */
  const upload = multer({
    storage: multer.diskStorage({
      destination: STORAGE,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + '.' + (fsx.extOf(file.originalname).replace(/[^a-z0-9]/g, '') || 'bin')),
    }),
    limits: { fileSize: fsx.HARD_MAX_MB * 1048576, files: 1, fields: 20, fieldSize: 4096 },
    fileFilter: (req, file, cb) => {
      const ext = fsx.extOf(file.originalname);
      if (!fsx.catOf(ext) || !db.settings.allowed.includes(ext)) return cb(new Error(`.${ext || '?'} files are not allowed.`), false);
      if (!safety.mimeOk(ext, file.mimetype)) return cb(new Error(`The file type does not match its extension (.${ext}).`), false);
      cb(null, true);
    },
  });
  const up = (req, res, next) => upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const m = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (server limit ${fsx.HARD_MAX_MB} MB).` : err.message || 'Upload failed.';
    res.status(400).json({ error: m });
  });

  async function ingest(file) {
    const ext = fsx.extOf(file.originalname), cat = fsx.catOf(ext), st = db.settings;
    const bad = (m) => { rmDisk(file.filename); return { error: m }; };
    if (!cat || !st.allowed.includes(ext)) return bad('This file type is not allowed.');
    if (!file.size) return bad('The file is empty.');
    if (file.size > st.maxMB[cat] * 1048576) return bad(`${CATS[cat].label} files can be at most ${st.maxMB[cat]} MB.`);
    const r = await fsx.inspect(file.path, ext, file.size);
    if (!r.ok) return bad(r.error);
    return { ext, cat, scanned: r.scanned };
  }
  function parseOpts(b, cur) {
    const o = {};
    if (b.title !== undefined) { const t = String(b.title).trim().slice(0, 120); if (!t) return { error: 'Title cannot be empty.' }; o.title = t; }
    if (b.access !== undefined) { if (!['public', 'password', 'private'].includes(b.access)) return { error: 'Invalid access mode.' }; o.access = b.access; }
    const access = o.access || (cur && cur.access) || 'public';
    if (access === 'password') {
      const pw = String(b.password || '');
      if (pw) { if (pw.length < 4 || pw.length > 100) return { error: 'Password must be 4–100 characters.' }; o.pw = fsx.hashPw(pw); }
      else if (!(cur && cur.pw)) return { error: 'Set a password for this file.' };
    } else if (b.access !== undefined) o.pw = null;
    if (b.allowDownload !== undefined) o.allowDownload = tf(b.allowDownload);
    if (b.archived !== undefined) o.archived = tf(b.archived);
    if (b.expires !== undefined) {
      if (b.expires === '' || b.expires === null || b.expires === 'null') o.expires = null;
      else {
        const t = new Date(b.expires).getTime();
        if (!isFinite(t)) return { error: 'Invalid expiry date.' };
        if (t <= Date.now()) return { error: 'The expiry must be in the future.' };
        if (t > Date.now() + 5 * 365 * 864e5) return { error: 'Expiry is too far away (max 5 years).' };
        o.expires = t;
      }
    }
    return o;
  }

  /* ---------- public config (also tells the UI which file types are enabled) ---------- */
  app.get('/api/files/config', (req, res) => {
    const u = softUser(req), s = db.settings;
    res.json({
      loggedIn: !!u, isAdmin: isAdmin(u), hardMax: fsx.HARD_MAX_MB, quotaMB: s.quotaMB, maxFiles: s.maxFiles, clam: fsx.scanner.clam, max: s.maxMB,
      cats: Object.keys(CATS).map((id) => ({ id, label: CATS[id].label, icon: CATS[id].icon, exts: CATS[id].exts.filter((x) => s.allowed.includes(x)) })),
    });
  });

  /* ---------- owner API ---------- */
  app.get('/api/files', auth, (req, res) => {
    const items = db.files.filter((f) => f.uid === req.user.id).sort((a, b) => b.created - a.created).map((f) => view(f, req));
    res.json({ items, usage: { used: fsx.usedBytes(req.user.id), quota: db.settings.quotaMB * 1048576, count: items.length, maxFiles: db.settings.maxFiles } });
  });

  app.post('/api/files', auth, limit(30, 60e3), up, async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Choose a file to upload.' });
    const fail = (c, m) => { rmDisk(file.filename); return res.status(c).json({ error: m }); };
    try {
      if (db.files.filter((f) => f.uid === req.user.id).length >= db.settings.maxFiles) return fail(400, `File limit reached (${db.settings.maxFiles}). Delete some files first.`);
      if (fsx.usedBytes(req.user.id) + file.size > db.settings.quotaMB * 1048576) return fail(400, `Storage quota exceeded (${db.settings.quotaMB} MB).`);
      const i = await ingest(file);
      if (i.error) return res.status(400).json({ error: i.error });
      const o = parseOpts(req.body || {}, null);
      if (o.error) return fail(400, o.error);
      const base0 = fsx.cleanName(fsx.fixUtf8(file.originalname)).replace(/\.[^.]*$/, '') || 'file';
      const f = {
        id: crypto.randomUUID(), code: newCode(), uid: req.user.id, title: o.title || base0.slice(0, 120), name: base0 + '.' + i.ext,
        ext: i.ext, cat: i.cat, mime: MIME[i.ext], size: file.size, disk: file.filename, access: o.access || 'public', pw: o.pw || null,
        allowDownload: o.allowDownload === undefined ? true : o.allowDownload, expires: o.expires || null, archived: false, status: 'ok',
        reports: 0, views: 0, downloads: 0, log: [], scanned: i.scanned, created: Date.now(), updated: Date.now(),
      };
      db.files.push(f); save();
      res.json(view(f, req));
    } catch (e) { fail(500, 'Could not process the file. Please try again.'); }
  });

  app.put('/api/files/:id', auth, limit(60, 60e3), (req, res) => {
    const f = mine(req);
    if (!f) return res.status(404).json({ error: 'File not found.' });
    const b = req.body || {}, o = parseOpts(b, f);
    if (o.error) return res.status(400).json({ error: o.error });
    if (b.name !== undefined) {
      const n = fsx.cleanName(b.name, '').replace(new RegExp('\\.' + f.ext + '$', 'i'), '').trim();
      if (!n) return res.status(400).json({ error: 'File name cannot be empty.' });
      f.name = n + '.' + f.ext;
    }
    ['title', 'access', 'pw', 'allowDownload', 'archived', 'expires'].forEach((k) => { if (o[k] !== undefined) f[k] = o[k]; });
    f.updated = Date.now(); save();
    res.json(view(f, req));
  });

  app.post('/api/files/:id/replace', auth, limit(20, 60e3), up, async (req, res) => {
    const file = req.file, f = mine(req);
    const fail = (c, m) => { if (file) rmDisk(file.filename); return res.status(c).json({ error: m }); };
    if (!f) return fail(404, 'File not found.');
    if (!file) return fail(400, 'Choose a replacement file.');
    if (f.status === 'suspended') return fail(403, 'This file is suspended and cannot be changed.');
    try {
      if (fsx.usedBytes(req.user.id) - f.size + file.size > db.settings.quotaMB * 1048576) return fail(400, `Storage quota exceeded (${db.settings.quotaMB} MB).`);
      const i = await ingest(file);
      if (i.error) return res.status(400).json({ error: i.error });
      const old = f.disk, nb = fsx.cleanName(fsx.fixUtf8(file.originalname)).replace(/\.[^.]*$/, '') || 'file';
      Object.assign(f, { ext: i.ext, cat: i.cat, mime: MIME[i.ext], size: file.size, disk: file.filename, name: nb + '.' + i.ext, scanned: i.scanned, updated: Date.now() });
      rmDisk(old); save();
      res.json(view(f, req)); // same code → the printed QR now opens the new file
    } catch (e) { fail(500, 'Could not replace the file.'); }
  });

  app.delete('/api/files/:id', auth, (req, res) => {
    const i = db.files.findIndex((f) => f.id === req.params.id && f.uid === req.user.id);
    if (i < 0) return res.status(404).json({ error: 'File not found.' });
    rmDisk(db.files[i].disk); db.files.splice(i, 1); save();
    res.json({ ok: true });
  });

  // signed, expiring share link
  app.post('/api/files/:id/sign', auth, limit(60, 60e3), (req, res) => {
    const f = mine(req);
    if (!f) return res.status(404).json({ error: 'File not found.' });
    const min = Math.min(43200, Math.max(1, parseInt((req.body || {}).minutes, 10) || 1440));
    res.json({ url: base(req) + '/f/' + f.code + '?t=' + fsx.sign(f.code, min * 60e3, false), expires: Date.now() + min * 60e3 });
  });

  /* ---------- admin API (file rules and moderation) ---------- */
  app.get('/api/admin/settings', auth, admin, (req, res) => {
    res.json({ settings: db.settings, hardMax: fsx.HARD_MAX_MB, clam: fsx.scanner.clam, cats: Object.keys(CATS).map((id) => ({ id, label: CATS[id].label, icon: CATS[id].icon, exts: CATS[id].exts })) });
  });
  app.put('/api/admin/settings', auth, admin, (req, res) => res.json({ settings: fsx.updateSettings(req.body || {}) }));
  app.get('/api/admin/overview', auth, admin, (req, res) => {
    const owners = new Map(db.users.map((u) => [u.id, u.email]));
    const files = db.files.slice().sort((a, b) => (b.reports || 0) - (a.reports || 0) || b.created - a.created).slice(0, 300).map((f) => ({
      id: f.id, code: f.code, title: f.title, name: f.name, owner: owners.get(f.uid) || '?', size: f.size, cat: f.cat, access: f.access,
      state: stateOf(f), reports: f.reports || 0, views: f.views || 0, downloads: f.downloads || 0, created: f.created, url: base(req) + '/f/' + f.code,
    }));
    res.json({
      users: db.users.length, files: db.files.length, bytes: db.files.reduce((a, f) => a + f.size, 0), views: db.files.reduce((a, f) => a + (f.views || 0), 0),
      reported: db.files.filter((f) => (f.reports || 0) > 0).length, files_list: files,
    });
  });
  app.post('/api/admin/files/:id/status', auth, admin, (req, res) => {
    const f = db.files.find((x) => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'File not found.' });
    if (req.body.status === 'suspended') f.status = 'suspended';
    else if (req.body.status === 'ok') { f.status = 'ok'; f.reports = 0; f.reporters = []; }
    else return res.status(400).json({ error: 'Invalid status.' });
    save(); res.json({ ok: true });
  });
  app.delete('/api/admin/files/:id', auth, admin, (req, res) => {
    const i = db.files.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'File not found.' });
    rmDisk(db.files[i].disk); db.files.splice(i, 1); save();
    res.json({ ok: true });
  });

  /* ---------- public access control ---------- */
  function check(req, f) {
    const tok = fsx.verify(String(req.query.t || ''), f.code);
    const owner = !!(tok && tok.o);
    if (f.status === 'suspended') return { s: 'suspended' };
    if (!owner) {
      if (f.archived) return { s: 'archived' };
      if (f.expires && f.expires <= Date.now()) return { s: 'expired' };
    }
    if (tok) return { ok: true, owner, tok: String(req.query.t) };
    if (f.access === 'public') return { ok: true, owner: false };
    if (f.access === 'password') {
      const c = getCookie(req, 'qrf_' + f.code);
      return c && fsx.verify(c, f.code) ? { ok: true, owner: false } : { s: 'password' };
    }
    return { s: 'private' };
  }

  // what a phone sees after scanning the QR
  app.get('/f/:code', limit(300, 60e3), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    const f = find(req.params.code);
    if (!f) return res.status(404).send(viewer.notice('notfound'));
    const c = check(req, f);
    if (!c.ok) {
      if (c.s === 'password') return res.send(viewer.password(f));
      return res.status(c.s === 'suspended' || c.s === 'private' ? 403 : 410).send(viewer.notice(c.s));
    }
    if (!c.owner && req.method === 'GET') analytics.record(f, req, 'views');
    const q = c.tok ? 't=' + encodeURIComponent(c.tok) : '';
    let txt = null;
    if (f.ext === 'txt') { try { txt = await readText(f); } catch (e) { /* ignore */ } }
    res.send(viewer.page(f, {
      raw: '/f/' + f.code + '/raw' + (q ? '?' + q : ''), dlUrl: '/f/' + f.code + '/raw?' + (q ? q + '&' : '') + 'dl=1',
      dl: f.allowDownload !== false || c.owner, owner: c.owner, text: txt && txt.text, more: txt && txt.more,
    }));
  });

  // the bytes (supports Range requests for video / audio seeking)
  app.get('/f/:code/raw', limit(300, 60e3), (req, res) => {
    const deny = (s, m) => res.status(s).type('text').send(m);
    const f = find(req.params.code);
    if (!f) return deny(404, 'Not found');
    const c = check(req, f);
    if (!c.ok) return deny(c.s === 'suspended' || c.s === 'private' || c.s === 'password' ? 403 : 410, 'Not available');
    const dl = req.query.dl === '1';
    if (dl && !(f.allowDownload !== false || c.owner)) return deny(403, 'Downloads are disabled for this file.');
    if (dl && !c.owner && req.method === 'GET' && !req.headers.range) { f.downloads = (f.downloads || 0) + 1; save(); }
    const inline = !dl && (['image', 'pdf', 'video', 'audio'].includes(f.cat) || f.ext === 'txt');
    res.setHeader('Content-Type', MIME[f.ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', disp(inline ? 'inline' : 'attachment', f.name));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Cache-Control', 'private, no-cache');
    if (f.ext !== 'pdf') res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.sendFile(f.disk, { root: STORAGE, dotfiles: 'deny', cacheControl: false }, (err) => { if (err && !res.headersSent) res.status(err.status === 404 ? 404 : 500).end(); });
  });

  app.post('/f/:code/unlock', limit(10, 60e3), (req, res) => {
    const f = find(req.params.code);
    if (!f || f.access !== 'password' || !f.pw) return res.status(404).json({ error: 'Not found.' });
    if (f.status === 'suspended' || f.archived || (f.expires && f.expires <= Date.now())) return res.status(410).json({ error: 'This file is not available.' });
    if (!fsx.checkPw((req.body || {}).password, f.pw)) return res.status(401).json({ error: 'Incorrect password.' });
    const tok = fsx.sign(f.code, 3600e3, false);
    res.setHeader('Set-Cookie', `qrf_${f.code}=${encodeURIComponent(tok)}; Path=/f/${f.code}; Max-Age=3600; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  });

  // abuse reporting → auto-suspend after N unique reports
  app.post('/f/:code/report', limit(3, 600e3), (req, res) => {
    const f = find(req.params.code);
    if (!f) return res.status(404).json({ error: 'Not found.' });
    const h = crypto.createHash('sha256').update(String(req.ip) + db.secret).digest('hex').slice(0, 16);
    f.reporters = f.reporters || [];
    if (!f.reporters.includes(h)) {
      f.reporters.push(h); if (f.reporters.length > 50) f.reporters.shift();
      f.reports = (f.reports || 0) + 1;
      if (f.reports >= db.settings.reportsToSuspend) f.status = 'suspended';
      save();
    }
    res.json({ ok: true });
  });

  /* ---------- housekeeping: remove orphaned files older than 1 hour ---------- */
  function sweep() {
    const keep = new Set(db.files.map((f) => f.disk));
    fs.readdir(STORAGE, (e, list) => {
      if (e) return;
      list.forEach((n) => {
        if (keep.has(n)) return;
        const p = path.join(STORAGE, n);
        fs.stat(p, (e2, st) => { if (!e2 && st.isFile() && Date.now() - st.mtimeMs > 3600e3) fs.unlink(p, () => {}); });
      });
    });
  }
  setInterval(sweep, 3600e3).unref();
  setTimeout(sweep, 8000).unref();
};
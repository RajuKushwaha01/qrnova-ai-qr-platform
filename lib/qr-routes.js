'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, save } = require('./db');
const fsx = require('./filestore');
const viewer = require('./viewer');
const analytics = require('./analytics');
const safety = require('./security');
const dyn = require('./public-page');

const UPLOADS = require('./paths').UPLOADS;
const FOLDERS0 = [['Personal', '👤'], ['Business', '🏢'], ['Marketing', '📣'], ['Restaurant', '🍽️'], ['Documents', '📄'], ['Events', '🎉'], ['Payments', '💸'], ['Social', '🌐']];
const TYPES = ['text', 'url', 'email', 'phone', 'sms', 'whatsapp', 'telegram', 'social', 'vcard', 'business', 'website', 'menu', 'product', 'review', 'location', 'wifi', 'upi', 'payurl', 'event', 'custom', 'file', 'image', 'pdf', 'video', 'audio', 'document'];
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const rid = () => crypto.randomBytes(6).toString('hex');
const tf = (v) => v === true || v === 'true' || v === '1';
const getCookie = (req, n) => { const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(n + '=')); return m ? decodeURIComponent(m.slice(n.length + 1)) : ''; };
const devClass = (ua) => (/android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'desktop');

const stateQ = (q) => (q.adminDisabled ? 'suspended' : q.archived ? 'archived' : q.active === false ? 'inactive' : (q.expires && q.expires <= Date.now()) || (q.access === 'restricted' && q.restrict && q.restrict.maxScans && (q.scans || 0) >= q.restrict.maxScans) ? 'expired' : 'active');
const stateF = (f) => (f.status === 'suspended' ? 'suspended' : f.archived ? 'archived' : f.expires && f.expires <= Date.now() ? 'expired' : 'active');
const stateS = (s) => (s.archived ? 'archived' : 'active');

function weekStats(log) {
  const days = Array(7).fill(0), dev = {}, end = new Date(); end.setHours(23, 59, 59, 999);
  (log || []).forEach((l) => { const d = Math.floor((end - l.t) / 864e5); if (d >= 0 && d < 7) days[6 - d]++; dev[l.d] = (dev[l.d] || 0) + 1; });
  return { days, dev };
}
function buckets(logs, n, off) { // off = minutes-ahead-of-UTC in ms, so days follow the viewer's timezone
  const today = Math.floor((Date.now() + off) / 864e5), counts = Array(n).fill(0), labels = [];
  for (let i = n - 1; i >= 0; i--) labels.push(new Date((today - i) * 864e5).toISOString().slice(0, 10));
  logs.forEach((l) => { const k = today - Math.floor((l.t + off) / 864e5); if (k >= 0 && k < n) counts[n - 1 - k]++; });
  return { labels, counts };
}
function lookOf(d) { // small style summary used for dashboard thumbnails
  if (!d || typeof d !== 'object') return null;
  const hex = (v, def) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : def), st = d.fg && Array.isArray(d.fg.stops) ? d.fg.stops : [];
  return {
    fg: hex(st[0] && st[0].c, '#111827'), fg2: d.fg && d.fg.type !== 'solid' && st.length > 1 ? hex(st[st.length - 1].c, null) : null,
    bg: d.bg && d.bg.mode === 'color' ? hex(d.bg.color, '#ffffff') : '#ffffff', eye: d.eyeLink ? hex(st[0] && st[0].c, '#111827') : hex(d.eyeOuterC, '#111827'),
    dots: { square: 'square', rounded: 'rounded', dots: 'dots', diamond: 'diamond', soft: 'rounded', bars: 'rounded', minimal: 'square' }[d.dots] || 'rounded',
    eyes: { square: 'square', rounded: 'rounded', circle: 'circle', leaf: 'rounded' }[d.eyeOuter] || 'rounded',
  };
}
function cleanDesign(d) { // null = none, false = invalid
  if (d === undefined || d === null) return null;
  if (typeof d !== 'object' || Array.isArray(d)) return false;
  const c = JSON.parse(JSON.stringify(d)); delete c.data; // never store what the QR contains
  return JSON.stringify(c).length <= 340 * 1024 ? c : false;
}
function parseExpiry(v) {
  if (v === '' || v === null || v === 'null') return null;
  const t = new Date(v).getTime();
  if (!isFinite(t)) return { error: 'Invalid expiry date.' };
  if (t <= Date.now()) return { error: 'The expiry must be in the future.' };
  if (t > Date.now() + 5 * 365 * 864e5) return { error: 'Expiry is too far away (max 5 years).' };
  return t;
}
function cleanRestrict(r) {
  r = r || {};
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
  const o = { maxScans: Math.round(clamp(r.maxScans, 0, 1e6, 0)), devices: Array.isArray(r.devices) ? [...new Set(r.devices.filter((d) => ['android', 'ios', 'desktop'].includes(d)))] : [], from: hm.test(r.from) ? r.from : '', to: hm.test(r.to) ? r.to : '', tz: Math.round(clamp(r.tz, -840, 840, 0)) };
  if (!!o.from !== !!o.to) return { error: 'Set both the start and the end time, or neither.' };
  if (o.from && o.from === o.to) return { error: 'The start and end time must differ.' };
  if (!o.maxScans && !o.devices.length && !o.from) return { error: 'Choose at least one restriction: a scan limit, devices or a time window.' };
  return o;
}
function inWindow(r) {
  const m = (s) => { const [h, mi] = s.split(':').map(Number); return h * 60 + mi; };
  const n = new Date(), local = (((n.getUTCHours() * 60 + n.getUTCMinutes() + (r.tz || 0)) % 1440) + 1440) % 1440, a = m(r.from), b = m(r.to);
  return a <= b ? local >= a && local < b : local >= a || local < b;
}

module.exports = function mount(app, { limit, base, auth }) {
  ['history', 'folders', 'designs', 'aiSessions', 'statics'].forEach((k) => { db[k] = db[k] || []; });

  /* ---------- history ---------- */
  function hist(uid, ev, it, meta) {
    db.history.push({ id: rid(), uid, ev, qid: it && it.id, title: clip(it && it.title, 120), type: it && it.type, meta: clip(meta, 120), t: Date.now() });
    const mine = db.history.filter((h) => h.uid === uid);
    if (mine.length > 600) { const drop = new Set(mine.slice(0, mine.length - 500)); db.history = db.history.filter((h) => !drop.has(h)); }
    save();
  }
  // record changes made through the older endpoints (generator, AI studio, My Files) without touching them
  app.use(['/api/dynamic', '/api/files'], (req, res, next) => {
    if (req.method === 'GET') return next();
    const t = (req.headers.authorization || '').replace('Bearer ', ''), s = t && db.sessions.find((x) => x.token === t && x.exp > Date.now());
    if (!s) return next();
    const uid = s.uid, isDyn = req.baseUrl === '/api/dynamic', parts = req.path.split('/').filter(Boolean);
    const infoOf = (it) => (isDyn ? { id: 'q_' + it.code, title: it.title, type: it.type } : { id: 'f_' + it.id, title: it.title, type: it.cat });
    const pre = parts[0] ? (isDyn ? db.qrs.find((q) => q.code === parts[0] && q.uid === uid) : db.files.find((f) => f.id === parts[0] && f.uid === uid)) : null;
    const preInfo = pre ? infoOf(pre) : null;
    res.on('finish', () => {
      if (res.statusCode >= 300) return;
      if (req.method === 'POST' && !parts[0]) { const it = (isDyn ? db.qrs : db.files).filter((x) => x.uid === uid).sort((a, b) => b.created - a.created)[0]; if (it && Date.now() - it.created < 10000) hist(uid, 'created', infoOf(it)); }
      else if (req.method === 'POST' && parts[1] === 'replace' && preInfo) hist(uid, 'updated', preInfo, 'file replaced');
      else if (req.method === 'PUT' && preInfo) hist(uid, 'updated', preInfo);
      else if (req.method === 'DELETE' && preInfo) hist(uid, 'deleted', preInfo);
    });
    next();
  });

  /* ---------- lookup + views ---------- */
  const find = (req) => {
    const m = /^([qfs])_([\w-]{1,40})$/.exec(String(req.params.id)); if (!m) return null;
    const uid = req.user.id;
    if (m[1] === 'q') { const it = db.qrs.find((x) => x.code === m[2] && x.uid === uid); return it ? { src: 'q', it } : null; }
    if (m[1] === 'f') { const it = db.files.find((x) => x.id === m[2] && x.uid === uid); return it ? { src: 'f', it } : null; }
    const it = db.statics.find((x) => x.code === m[2] && x.uid === uid); return it ? { src: 's', it } : null;
  };
  const info = (f) => ({ id: f.src + '_' + (f.src === 'f' ? f.it.id : f.it.code), title: f.it.title, type: f.src === 'f' ? f.it.cat : f.it.type });
  const newCode = () => { let c; do { c = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7); } while (db.qrs.some((q) => q.code === c) || db.statics.some((s) => s.code === c) || db.files.some((x) => x.code === c)); return c; };

  function view(f, req) {
    const it = f.it, ws = weekStats(it.log);
    if (f.src === 'q') {
      const content = it.kind === 'url' ? it.target : it.kind === 'page' ? Object.values(it.data || {}).join(' ') : it.fileName || '';
      return { id: 'q_' + it.code, source: 'qr', code: it.code, kind: it.kind, mode: 'dynamic', type: it.type, title: it.title, url: base(req) + '/q/' + it.code, target: it.target, data: it.data, fileName: it.fileName || '', hasFile: !!it.file, content, status: stateQ(it), access: it.access || 'public', hasPassword: !!it.pw, restrict: it.restrict || null, expires: it.expires || null, fav: !!it.fav, folder: it.folder || '', scans: it.scans || 0, created: it.created, updated: it.updated || it.created, days: ws.days, dev: ws.dev, look: null };
    }
    if (f.src === 'f') {
      return { id: 'f_' + it.id, source: 'file', code: it.code, kind: 'file', mode: 'dynamic', type: it.cat, title: it.title, url: base(req) + '/f/' + it.code, fileName: it.name, ext: it.ext, size: it.size, content: it.title + ' ' + it.name, status: stateF(it), access: it.access, hasPassword: !!it.pw, allowDownload: it.allowDownload !== false, expires: it.expires || null, fav: !!it.fav, folder: it.folder || '', scans: it.views || 0, downloads: it.downloads || 0, created: it.created, updated: it.updated || it.created, days: ws.days, dev: ws.dev, look: null };
    }
    return { id: 's_' + it.code, source: 'static', code: it.code, kind: 'static', mode: 'static', type: it.type, title: it.title, url: null, payload: it.payload, content: it.payload, status: stateS(it), access: 'public', expires: null, fav: !!it.fav, folder: it.folder || '', scans: 0, created: it.created, updated: it.updated || it.created, days: ws.days, dev: {}, look: lookOf(it.design), hasDesign: !!it.design };
  }
  const mineAll = (uid) => [].concat(
    db.qrs.filter((q) => q.uid === uid).map((it) => ({ src: 'q', it })),
    db.files.filter((x) => x.uid === uid).map((it) => ({ src: 'f', it })),
    db.statics.filter((s) => s.uid === uid).map((it) => ({ src: 's', it })));

  /* ---------- folders ---------- */
  function ensureFolders(u) {
    if (!u.foldersInit) { FOLDERS0.forEach(([name, emoji]) => db.folders.push({ id: rid(), uid: u.id, name, emoji })); u.foldersInit = true; save(); }
    return db.folders.filter((f) => f.uid === u.id).map((f) => ({ id: f.id, name: f.name, emoji: f.emoji }));
  }
  const validFolder = (uid, id) => (id && db.folders.some((f) => f.id === id && f.uid === uid) ? id : '');

  app.get('/api/folders', auth, (req, res) => res.json({ items: ensureFolders(req.user) }));
  app.post('/api/folders', auth, limit(30, 60e3), (req, res) => {
    ensureFolders(req.user);
    const name = clip((req.body || {}).name, 30).trim(), emoji = clip((req.body || {}).emoji || '📁', 8);
    if (!name) return res.status(400).json({ error: 'Give the folder a name.' });
    const mine = db.folders.filter((f) => f.uid === req.user.id);
    if (mine.length >= 30) return res.status(400).json({ error: 'You can have up to 30 folders.' });
    if (mine.some((f) => f.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: 'A folder with that name already exists.' });
    const f = { id: rid(), uid: req.user.id, name, emoji }; db.folders.push(f); save();
    res.json({ id: f.id, name: f.name, emoji: f.emoji });
  });
  app.put('/api/folders/:id', auth, (req, res) => {
    const f = db.folders.find((x) => x.id === req.params.id && x.uid === req.user.id);
    if (!f) return res.status(404).json({ error: 'Folder not found.' });
    const b = req.body || {};
    if (b.name !== undefined) { const n = clip(b.name, 30).trim(); if (!n) return res.status(400).json({ error: 'Give the folder a name.' }); f.name = n; }
    if (b.emoji !== undefined) f.emoji = clip(b.emoji, 8) || f.emoji;
    save(); res.json({ id: f.id, name: f.name, emoji: f.emoji });
  });
  app.delete('/api/folders/:id', auth, (req, res) => {
    const i = db.folders.findIndex((x) => x.id === req.params.id && x.uid === req.user.id);
    if (i < 0) return res.status(404).json({ error: 'Folder not found.' });
    const id = db.folders[i].id; db.folders.splice(i, 1);
    mineAll(req.user.id).forEach((x) => { if (x.it.folder === id) x.it.folder = ''; });
    save(); res.json({ ok: true });
  });

  /* ---------- list / overview / activity ---------- */
  app.get('/api/qr', auth, (req, res) => {
    const items = mineAll(req.user.id).map((f) => view(f, req)).sort((a, b) => b.updated - a.updated);
    res.json({ items, folders: ensureFolders(req.user) });
  });

  app.get('/api/qr/overview', auth, (req, res) => {
    const uid = req.user.id, off = Math.round(clamp(req.query.tz, -840, 840, 0)) * 60000;
    const Q = db.qrs.filter((q) => q.uid === uid), Fi = db.files.filter((f) => f.uid === uid), S = db.statics.filter((s) => s.uid === uid);
    const states = Q.map(stateQ).concat(Fi.map(stateF), S.map(stateS)), soon = Date.now() + 7 * 864e5;
    const logs = [].concat(...Q.map((q) => q.log || []), ...Fi.map((f) => f.log || []));
    const dev = {}; logs.forEach((l) => { dev[l.d] = (dev[l.d] || 0) + 1; });
    const top = Q.map((q) => ({ id: 'q_' + q.code, title: q.title, scans: q.scans || 0, type: q.type })).concat(Fi.map((f) => ({ id: 'f_' + f.id, title: f.title, scans: f.views || 0, type: f.cat }))).filter((r) => r.scans > 0).sort((a, b) => b.scans - a.scans).slice(0, 5);
    res.json({
      cards: { total: states.length, active: states.filter((s) => s === 'active').length, dynamic: Q.length + Fi.length, statics: S.length, files: Fi.length, favorites: [].concat(Q, Fi, S).filter((x) => x.fav).length, expiring: [].concat(Q, Fi).filter((x) => x.expires && x.expires > Date.now() && x.expires < soon).length, scans: Q.reduce((a, q) => a + (q.scans || 0), 0) + Fi.reduce((a, f) => a + (f.views || 0), 0) },
      series: buckets(logs, 14, off), devices: dev, top, storage: { used: fsx.usedBytes(uid), quota: db.settings.quotaMB * 1048576 },
    });
  });

  app.get('/api/qr/activity', auth, (req, res) => {
    const uid = req.user.id, n = Math.round(clamp(req.query.limit, 1, 200, 40)), qid = req.query.qid ? String(req.query.qid) : '';
    const ev = db.history.filter((h) => h.uid === uid && (!qid || h.qid === qid)).map((h) => ({ ev: h.ev, t: h.t, qid: h.qid, title: h.title, type: h.type, meta: h.meta }));
    const have = new Set(ev.filter((e) => e.ev === 'created').map((e) => e.qid));
    mineAll(uid).forEach((f) => {
      const i = info(f); if (qid && i.id !== qid) return;
      if (!have.has(i.id)) ev.push({ ev: 'created', t: f.it.created, qid: i.id, title: i.title, type: i.type, meta: '' });
      (f.it.log || []).slice(-30).forEach((l) => ev.push({ ev: 'scanned', t: l.t, qid: i.id, title: i.title, type: i.type, meta: l.d }));
    });
    ev.sort((a, b) => b.t - a.t);
    res.json({ items: ev.slice(0, n) });
  });

  /* ---------- static QR codes ---------- */
  app.post('/api/qr/static', auth, limit(60, 60e3), (req, res) => {
    const b = req.body || {}, uid = req.user.id, payload = String(b.payload == null ? '' : b.payload);
    if (!payload || payload.length > 2500) return res.status(400).json({ error: 'The QR content must be between 1 and 2500 characters.' });
    if (db.statics.filter((s) => s.uid === uid).length >= require('./settings').get().limits.maxStaticQr) return res.status(400).json({ error: `You can keep up to ${require('./settings').get().limits.maxStaticQr} static QR codes.` });
    const design = cleanDesign(b.design); if (design === false) return res.status(400).json({ error: 'The design is too large to save. Use a smaller logo or background image.' });
    ensureFolders(req.user);
    const s = { code: newCode(), uid, type: TYPES.includes(b.type) ? b.type : 'text', title: clip(b.title, 120).trim() || 'Untitled QR', payload, folder: validFolder(uid, b.folder), fav: false, created: Date.now() };
    if (design) s.design = design;
    db.statics.push(s); save();
    const f = { src: 's', it: s }; hist(uid, 'created', info(f));
    res.json(view(f, req));
  });
  app.put('/api/qr/:id/static', auth, limit(60, 60e3), (req, res) => {
    const f = find(req); if (!f || f.src !== 's') return res.status(404).json({ error: 'Static QR not found.' });
    const b = req.body || {}, s = f.it;
    if (b.payload !== undefined) { const p = String(b.payload); if (!p || p.length > 2500) return res.status(400).json({ error: 'The QR content must be between 1 and 2500 characters.' }); s.payload = p; }
    if (b.design !== undefined) { const d = cleanDesign(b.design); if (d === false) return res.status(400).json({ error: 'The design is too large to save.' }); if (d) s.design = d; else delete s.design; }
    if (b.title !== undefined) s.title = clip(b.title, 120).trim() || s.title;
    if (b.type !== undefined && TYPES.includes(b.type)) s.type = b.type;
    s.updated = Date.now(); hist(req.user.id, 'updated', info(f)); save();
    res.json(view(f, req));
  });

  /* ---------- one item ---------- */
  app.get('/api/qr/:id', auth, (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    const v = view(f, req); if (f.src === 's') v.design = f.it.design || null;
    res.json(v);
  });

  app.put('/api/qr/:id/settings', auth, limit(120, 60e3), (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    const b = req.body || {}, it = f.it, uid = req.user.id, bad = (m) => res.status(400).json({ error: m });
    ensureFolders(req.user);
    if (b.title !== undefined) { const t = clip(b.title, 120).trim(); if (!t) return bad('The name cannot be empty.'); it.title = t; }
    if (b.folder !== undefined) it.folder = validFolder(uid, b.folder);
    if (b.fav !== undefined) it.fav = tf(b.fav);
    let meta = '';
    if (b.status !== undefined) {
      if (!['active', 'inactive', 'archived'].includes(b.status)) return bad('Invalid status.');
      if (f.src === 'q') { it.active = b.status !== 'inactive'; it.archived = b.status === 'archived'; }
      else if (f.src === 'f') { if (it.status === 'suspended') return res.status(403).json({ error: 'This file was suspended by a moderator.' }); it.archived = b.status !== 'active'; }
      else it.archived = b.status !== 'active';
      meta = 'status: ' + b.status;
    }
    if (f.src !== 's') {
      if (b.expires !== undefined) { const e = parseExpiry(b.expires); if (e && e.error) return bad(e.error); it.expires = e; meta = meta || (e ? 'expiry set' : 'expiry removed'); }
      if (b.access !== undefined) {
        const ok = f.src === 'q' ? ['public', 'private', 'password', 'restricted'] : ['public', 'private', 'password'];
        if (!ok.includes(b.access)) return bad(f.src === 'f' ? 'Hosted files support Public, Private and Password protection.' : 'Invalid access mode.');
        if (b.access === 'password') {
          const pw = String(b.password || '');
          if (pw) { if (pw.length < 4 || pw.length > 100) return bad('Password must be 4–100 characters.'); it.pw = fsx.hashPw(pw); }
          else if (!it.pw) return bad('Set a password for this QR code.');
        } else it.pw = null;
        if (b.access === 'restricted') { const r = cleanRestrict(b.restrict); if (r.error) return bad(r.error); it.restrict = r; } else if (f.src === 'q') it.restrict = null;
        it.access = b.access; meta = meta || 'access: ' + b.access;
      }
      if (f.src === 'f' && b.allowDownload !== undefined) it.allowDownload = tf(b.allowDownload);
    }
    it.updated = Date.now(); hist(uid, 'updated', info(f), meta); save();
    res.json(view(f, req));
  });

  app.post('/api/qr/:id/duplicate', auth, limit(30, 60e3), (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    const uid = req.user.id, it = f.it, now = Date.now(), title = clip(it.title + ' (copy)', 120);
    if (f.src === 'f') return res.status(400).json({ error: 'Hosted files cannot be duplicated. Upload the file again from File → QR.' });
    let c;
    if (f.src === 's') {
      if (db.statics.filter((s) => s.uid === uid).length >= require('./settings').get().limits.maxStaticQr) return res.status(400).json({ error: `You can keep up to ${require('./settings').get().limits.maxStaticQr} static QR codes.` });
      c = { code: newCode(), uid, type: it.type, title, payload: it.payload, design: it.design ? JSON.parse(JSON.stringify(it.design)) : undefined, folder: it.folder || '', fav: false, created: now };
      db.statics.push(c);
    } else {
      if (db.qrs.filter((q) => q.uid === uid).length >= require('./settings').get().limits.maxDynamicQr) return res.status(400).json({ error: `Limit reached (${require('./settings').get().limits.maxDynamicQr} dynamic QR codes).` });
      c = { code: newCode(), uid, kind: it.kind, type: it.type, title, target: it.target, data: it.data ? JSON.parse(JSON.stringify(it.data)) : undefined, fileName: it.fileName, access: it.access || 'public', pw: it.pw || null, restrict: it.restrict ? JSON.parse(JSON.stringify(it.restrict)) : null, expires: it.expires || null, folder: it.folder || '', fav: false, active: true, archived: false, scans: 0, log: [], created: now };
      if (it.file && it.file.startsWith('/files/')) {
        const nn = crypto.randomBytes(12).toString('hex') + path.extname(it.file);
        try { fs.copyFileSync(path.join(UPLOADS, path.basename(it.file)), path.join(UPLOADS, nn)); c.file = '/files/' + nn; if (it.kind === 'file') c.target = c.file; } catch (e) { /* the copy simply has no attachment */ }
      }
      db.qrs.push(c);
    }
    const nf = { src: f.src, it: c }; hist(uid, 'created', info(nf), 'duplicate'); save();
    res.json(view(nf, req));
  });

  app.delete('/api/qr/:id', auth, (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    const inf = info(f), it = f.it;
    if (f.src === 'q') { if (it.file && it.file.startsWith('/files/')) fs.unlink(path.join(UPLOADS, path.basename(it.file)), () => {}); db.qrs = db.qrs.filter((x) => x !== it); }
    else if (f.src === 'f') { fs.unlink(path.join(fsx.STORAGE, it.disk), () => {}); db.files = db.files.filter((x) => x !== it); }
    else db.statics = db.statics.filter((x) => x !== it);
    hist(req.user.id, 'deleted', inf); save();
    res.json({ ok: true });
  });

  app.post('/api/qr/:id/event', auth, limit(120, 60e3), (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    const ev = (req.body || {}).ev; if (!['downloaded', 'shared'].includes(ev)) return res.status(400).json({ error: 'Invalid event.' });
    hist(req.user.id, ev, info(f), clip((req.body || {}).meta, 60)); res.json({ ok: true });
  });

  // owner preview link (does not count as a scan) and expiring share link
  const signedLink = (f, req, ms, owner) => base(req) + (f.src === 'q' ? '/q/' : '/f/') + f.it.code + '?t=' + fsx.sign(f.it.code, ms, owner);
  app.get('/api/qr/:id/link', auth, (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    if (f.src === 's') return res.json({ url: null });
    res.json({ url: signedLink(f, req, 30 * 60e3, true) });
  });
  app.post('/api/qr/:id/share-link', auth, limit(60, 60e3), (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    if (f.src === 's') return res.status(400).json({ error: 'Static QR codes have no hosted page to share.' });
    const min = Math.min(43200, Math.max(1, parseInt((req.body || {}).minutes, 10) || 1440));
    res.json({ url: signedLink(f, req, min * 60e3, false), expires: Date.now() + min * 60e3 });
  });

  app.get('/api/qr/:id/analytics', auth, (req, res) => {
    const f = find(req); if (!f) return res.status(404).json({ error: 'QR code not found.' });
    const days = Math.round(clamp(req.query.days, 7, 90, 30)), off = Math.round(clamp(req.query.tz, -840, 840, 0)) * 60000, log = f.it.log || [];
    const b = buckets(log, days, off), hours = Array(24).fill(0), week = Array(7).fill(0), dev = {};
    log.forEach((l) => { const d = new Date(l.t + off); hours[d.getUTCHours()]++; week[d.getUTCDay()]++; dev[l.d] = (dev[l.d] || 0) + 1; });
    const total = f.src === 'f' ? f.it.views || 0 : f.it.scans || 0, peak = hours.indexOf(Math.max(...hours));
    res.json({ total, tracked: log.length, days: b, devices: dev, hours, weekdays: week, peakHour: log.length ? peak : null, recent: log.slice(-15).reverse(), downloads: f.src === 'f' ? f.it.downloads || 0 : undefined, note: 'Detailed history keeps the latest 1000 scans per QR code.' });
  });

  /* ---------- scanning a dynamic QR: status, expiry, password, access control ---------- */
  function gate(req, q) {
    const tok = fsx.verify(String(req.query.t || ''), q.code);
    if (q.adminDisabled) return { s: 'suspended' };
    if (tok && tok.o) return { ok: true, owner: true };
    if (q.archived) return { s: 'archived' };
    if (q.active === false) return { s: 'inactive' };
    if (q.expires && q.expires <= Date.now()) return { s: 'expired' };
    if (tok) return { ok: true }; // signed share link
    const a = q.access || 'public';
    if (a === 'private') return { s: 'private' };
    if (a === 'password') { const c = getCookie(req, 'qrq_' + q.code); return c && fsx.verify(c, q.code) ? { ok: true } : { s: 'password' }; }
    if (a === 'restricted') {
      const r = q.restrict || {}, ua = req.headers['user-agent'] || '';
      if (r.maxScans && (q.scans || 0) >= r.maxScans) return { s: 'limit' };
      if (r.devices && r.devices.length && !r.devices.includes(devClass(ua))) return { s: 'restricted' };
      if (r.from && r.to && !inWindow(r)) return { s: 'restricted' };
    }
    return { ok: true };
  }
  app.get('/q/:code', limit(300, 60e3), (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
    const q = db.qrs.find((x) => x.code === req.params.code);
    if (!q) return res.status(404).send(viewer.notice('notfound'));
    const g = gate(req, q);
    if (!g.ok) {
      if (g.s === 'password') return res.send(viewer.password());
      return res.status(['private', 'restricted', 'limit', 'inactive', 'suspended'].includes(g.s) ? 403 : 410).send(viewer.notice(g.s));
    }
    if (!g.owner) analytics.record(q, req, 'scans');
    if (q.kind === 'url') {
      if (!safety.redirectOk(q.target, req)) return res.status(403).send(viewer.notice('suspended'));
      return res.redirect(302, q.target);
    }
    res.send(q.kind === 'file' ? dyn.file(q) : dyn.page(q));
  });
  app.post('/q/:code/unlock', limit(10, 60e3), (req, res) => {
    const q = db.qrs.find((x) => x.code === req.params.code);
    if (!q || q.access !== 'password' || !q.pw) return res.status(404).json({ error: 'Not found.' });
    if (q.adminDisabled || q.archived || q.active === false || (q.expires && q.expires <= Date.now())) return res.status(410).json({ error: 'This QR code is not available.' });
    if (!fsx.checkPw((req.body || {}).password, q.pw)) return res.status(401).json({ error: 'Incorrect password.' });
    res.setHeader('Set-Cookie', `qrq_${q.code}=${encodeURIComponent(fsx.sign(q.code, 3600e3, false))}; Path=/q/${q.code}; Max-Age=3600; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  });
};
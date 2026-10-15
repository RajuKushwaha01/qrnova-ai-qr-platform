'use strict';
const { db, save } = require('./db');
const { safeHttp } = require('./util');
const schema = require('./schema');
const brain = require('./ai-engine');
const engine = require('./qrengine');

const en = encodeURIComponent;
const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const bad = (res, m, c) => res.status(c || 400).json({ error: m });

// "q_CODE", "s_CODE", "f_ID" or a bare short code → the caller's own item
function resolve(uid, idStr) {
  const m = /^(?:([qfs])_)?([\w-]{1,40})$/.exec(String(idStr)); if (!m) return null;
  const t = m[1] || '', k = m[2];
  const q = (!t || t === 'q') && db.qrs.find((x) => x.code === k && x.uid === uid); if (q) return { src: 'q', it: q, id: 'q_' + q.code };
  const s = (!t || t === 's') && (db.statics || []).find((x) => x.code === k && x.uid === uid); if (s) return { src: 's', it: s, id: 's_' + s.code };
  const f = (!t || t === 'f') && db.files.find((x) => (x.id === k || x.code === k) && x.uid === uid); if (f) return { src: 'f', it: f, id: 'f_' + f.id };
  return null;
}
const cleanData = (d) => { const o = {}; Object.entries(d || {}).slice(0, 24).forEach(([k, v]) => { if (/^[a-z]{1,20}$/i.test(k)) o[k] = String(v == null ? '' : v).slice(0, 1200); }); return o; };
const cleanFields = (f) => {
  const o = {};
  if (f && typeof f === 'object' && !Array.isArray(f)) Object.keys(f).slice(0, 30).forEach((k) => { if (/^[a-zA-Z]{1,20}$/.test(k)) { const v = f[k]; if (typeof v === 'boolean') o[k] = v; else if (v != null && typeof v !== 'object') o[k] = String(v).slice(0, 2500); } });
  return o;
};
const textOf = (b) => String((b && b.text) || '').slice(0, 4000).trim();
const mapQr = (b) => { if (!b || !b.code) return b; const it = db.qrs.find((x) => x.code === b.code) || (db.statics || []).find((x) => x.code === b.code); return it ? schema.toQr(it) : b; };

// re-enter the whole app with a different method / URL / body, so every middleware (auth, quotas, rate limits) runs again
function forward(app, req, res, method, url, body, map) {
  const i = url.indexOf('?');
  req.method = method; req.url = url; req.body = body === undefined ? {} : body;
  req.query = i < 0 ? {} : Object.fromEntries(new URLSearchParams(url.slice(i + 1)));
  if (map) { const j = res.json.bind(res); res.json = (b) => j(res.statusCode < 400 ? map(b) : b); }
  app.handle(req, res, (err) => { if (!res.headersSent) res.status(err ? 500 : 404).json({ error: err ? 'Server error' : 'Not found.' }); });
}

function mount(app, { auth, limit, base }) {
  /* ═══════════ QR ═══════════ */
  app.post('/api/qr', auth, limit(60, 60e3), (req, res) => {
    const b = req.body || {}, name = String(b.name || '').trim(), mode = b.mode === 'dynamic' ? 'dynamic' : 'static', type = String(b.type || (mode === 'dynamic' ? 'url' : 'text')).slice(0, 30);
    if (!name) return bad(res, 'name is required.');
    if (mode === 'static') {
      const payload = typeof b.content === 'string' ? b.content : b.content != null ? JSON.stringify(b.content) : '';
      if (!payload) return bad(res, 'content is required for static QR codes.');
      return forward(app, req, res, 'POST', '/api/qr/static', { type, title: name, payload, design: b.design, folder: b.folder }, mapQr);
    }
    if (b.destinationUrl) return forward(app, req, res, 'POST', '/api/dynamic', { kind: 'url', type, title: name, target: b.destinationUrl }, mapQr);
    if (b.content && typeof b.content === 'object') return forward(app, req, res, 'POST', '/api/dynamic', { kind: 'page', type, title: name, data: JSON.stringify(b.content) }, mapQr);
    bad(res, 'Dynamic QR codes need destinationUrl (a redirect) or content (an object, for a hosted page). Hosted files are uploaded with POST /api/files/upload.');
  });

  app.put('/api/qr/:id', auth, limit(120, 60e3), (req, res) => {
    const r = resolve(req.user.id, req.params.id); if (!r) return bad(res, 'QR code not found.', 404);
    const b = req.body || {}, it = r.it;
    if (r.src === 'q') {
      if (b.destinationUrl !== undefined) { if (it.kind !== 'url') return bad(res, 'Only redirect QR codes have a destination URL.'); const u = safeHttp(b.destinationUrl); if (!u) return bad(res, 'Enter a valid web link (http/https).'); it.target = u; }
      if (b.content !== undefined) { if (it.kind !== 'page' || !b.content || typeof b.content !== 'object') return bad(res, 'content must be an object for hosted-page QR codes.'); it.data = cleanData(b.content); }
    } else if (r.src === 's') {
      if (b.content !== undefined) { const p = typeof b.content === 'string' ? b.content : ''; if (!p || p.length > 2500) return bad(res, 'content must be 1–2500 characters.'); it.payload = p; }
      if (b.design !== undefined) {
        const c = b.design && typeof b.design === 'object' && !Array.isArray(b.design) ? JSON.parse(JSON.stringify(b.design)) : null;
        if (c) { delete c.data; if (JSON.stringify(c).length > 340 * 1024) return bad(res, 'The design is too large to save.'); it.design = c; } else delete it.design;
      }
    } else if (b.destinationUrl !== undefined || b.content !== undefined) return bad(res, 'Hosted files are replaced with POST /api/files/:id/replace.');
    it.updated = Date.now(); save();
    const s = {};
    if (b.name !== undefined) s.title = b.name;
    if (b.status !== undefined) s.status = b.status;
    if (b.isFavorite !== undefined) s.fav = b.isFavorite;
    if (b.folder !== undefined) s.folder = b.folder;
    if (b.expiresAt !== undefined) s.expires = b.expiresAt === null ? '' : b.expiresAt;
    if (b.access !== undefined) s.access = b.access;
    if (b.restrict !== undefined) s.restrict = b.restrict;
    if (b.isPasswordProtected === true && b.password) { s.access = 'password'; s.password = b.password; }
    else if (b.isPasswordProtected === false && b.access === undefined) s.access = 'public';
    if (b.password && s.access === 'password') s.password = b.password;
    forward(app, req, res, 'PUT', `/api/qr/${r.id}/settings`, s, mapQr);
  });

  ['activate', 'deactivate'].forEach((a) => app.post('/api/qr/:id/' + a, auth, limit(60, 60e3), (req, res) => {
    const r = resolve(req.user.id, req.params.id); if (!r) return bad(res, 'QR code not found.', 404);
    forward(app, req, res, 'PUT', `/api/qr/${r.id}/settings`, { status: a === 'activate' ? 'active' : 'inactive' }, mapQr);
  }));

  /* ═══════════ Files ═══════════ */
  app.get('/api/files/:id', auth, (req, res, next) => {
    if (req.params.id === 'config') return next('route'); // keep the public /api/files/config route working
    const r = resolve(req.user.id, 'f_' + req.params.id.replace(/^f_/, '')); if (!r) return bad(res, 'File not found.', 404);
    res.json(Object.assign(schema.toFile(r.it), { publicUrl: base(req) + '/f/' + r.it.code }));
  });

  /* ═══════════ AI (the same engine as the Studio; runs locally, no API key) ═══════════ */
  const ai = [auth, limit(60, 60e3)];
  app.get('/api/ai/types', ...ai, (req, res) => res.json({ items: brain.types(), themes: brain.themes() }));
  app.post('/api/ai/detect', ...ai, (req, res) => { const t = textOf(req.body); if (!t) return bad(res, 'text is required.'); res.json(brain.detect(t)); });
  app.post('/api/ai/parse', ...ai, (req, res) => { const t = textOf(req.body); if (!t) return bad(res, 'text is required.'); res.json(brain.parse(t)); });
  app.post('/api/ai/validate', ...ai, (req, res) => {
    const b = req.body || {}; if (!brain.hasType(b.type)) return bad(res, 'Unknown QR type. See GET /api/ai/types.');
    const issues = brain.validate(b.type, cleanFields(b.fields), b.mode === 'dynamic' ? 'dynamic' : 'static', ['L', 'M', 'Q', 'H'].includes(b.ecl) ? b.ecl : 'M');
    res.json({ valid: !issues.some((i) => i.lvl === 'error' || i.lvl === 'need'), issues });
  });
  app.post('/api/ai/recommend', ...ai, (req, res) => {
    const b = req.body || {}; if (!brain.hasType(b.type)) return bad(res, 'Unknown QR type. See GET /api/ai/types.');
    res.json(brain.recommend(b.type, cleanFields(b.fields), { text: String(b.text || '').slice(0, 1000), print: !!b.print, logo: !!b.logo, designText: String(b.text || '').slice(0, 1000) }));
  });
  app.post('/api/ai/design', ...ai, (req, res) => {
    const b = req.body || {}, key = typeof b.key === 'string' && /^[a-z]{3,20}$/.test(b.key) ? b.key : undefined;
    res.json(brain.design(String(b.text || '').slice(0, 1000), { type: brain.hasType(b.type) ? b.type : undefined, key }));
  });
  app.post('/api/ai/generate', ...ai, async (req, res) => {
    const b = req.body || {}, t = textOf(b); if (!t) return bad(res, 'text is required.');
    const u = brain.understand(t);
    if (u.kind !== 'create') return res.json({ kind: u.kind, text: u.text || '' });
    const d = u.det, mode = ['static', 'dynamic'].includes(b.mode) ? b.mode : u.rec.mode, ecl = ['L', 'M', 'Q', 'H'].includes(b.ecl) ? b.ecl : u.rec.ecl;
    const issues = brain.validate(d.type, d.fields, mode, ecl), blocked = issues.some((i) => i.lvl === 'error' || i.lvl === 'need');
    const payload = blocked ? '' : brain.build(d.type, d.fields, mode);
    let qr = null;
    if (payload) {
      try {
        const a = engine.analyze(payload, ecl); qr = { version: a.version, modules: a.size, bytes: a.bytes, ecl: a.ecl, capacityUsed: a.usage };
        if (req.query.svg === '1') qr.svg = await engine.render(payload, { ecl, size: 512, margin: 4 }, 'svg');
      } catch (e) { issues.push({ lvl: 'error', field: null, msg: e.message }); }
    }
    res.json({ kind: 'create', type: d.type, label: d.label, confidence: d.conf, reason: d.reason, fields: d.fields, detected: d.items, mode, payload, issues, recommendation: u.rec, design: u.design, message: u.say, qr });
  });

  /* ═══════════ Analytics ═══════════ */
  app.get('/api/analytics/:qrId/scans', auth, limit(120, 60e3), (req, res) => {
    const r = resolve(req.user.id, req.params.qrId); if (!r || r.src === 's') return bad(res, 'QR code not found.', 404);
    const per = Math.round(clamp(req.query.limit, 1, 200, 50)), log = (r.it.log || []).slice().reverse(), pages = Math.max(1, Math.ceil(log.length / per)), page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
    res.json({ items: log.slice((page - 1) * per, page * per).map((e, i) => schema.toScan(e, r.id, (page - 1) * per + i)), total: log.length, page, pages, note: 'Detailed history keeps the latest 1000 scans per QR code; totals keep counting.' });
  });
  app.get('/api/analytics/:qrId', auth, limit(120, 60e3), (req, res, next) => {
    if (['export', 'overview'].includes(req.params.qrId)) return next('route');
    const r = resolve(req.user.id, req.params.qrId); if (!r || r.src === 's') return bad(res, 'QR code not found.', 404);
    const q = new URLSearchParams({ id: r.id, days: String(req.query.days || 30), tz: String(req.query.tz || 0) });
    forward(app, req, res, 'GET', '/api/analytics?' + q);
  });

  /* ═══════════ Admin aliases (role checks happen in the target routes) ═══════════ */
  app.put('/api/admin/users/:id', auth, limit(60, 60e3), (req, res) => {
    const b = req.body || {}; let body;
    if (b.role === 'admin') body = { action: 'promote' };
    else if (b.role === 'user') body = { action: 'demote' };
    else if (b.suspended === true) body = { action: 'suspend', reason: b.reason, disableContent: !!b.disableContent };
    else if (b.suspended === false) body = { action: 'activate', restoreContent: !!b.restoreContent };
    else if (b.verified === true) body = { action: 'verify' };
    else return bad(res, 'Send one of: { role: "admin"|"user" }, { suspended: true|false }, { verified: true }.');
    forward(app, req, res, 'POST', `/api/sys/users/${en(req.params.id)}/action`, body);
  });
  app.delete('/api/admin/users/:id', auth, limit(30, 60e3), (req, res) => forward(app, req, res, 'POST', `/api/sys/users/${en(req.params.id)}/action`, { action: 'delete' }));
  app.delete('/api/admin/qrs/:id', auth, limit(60, 60e3), (req, res) => forward(app, req, res, 'POST', `/api/sys/qrs/${en(req.params.id.replace(/^q_/, ''))}/action`, { action: 'delete' }));
}

module.exports = { mount };
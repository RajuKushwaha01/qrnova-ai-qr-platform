'use strict';
require('./lib/env');
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const multer = require('multer');

const { db, save } = require('./lib/db');
const { renderPage } = require('./lib/layout');
const pages = require('./lib/pages');
const engine = require('./lib/qrengine');
const { safeHttp } = require('./lib/util');
const settings = require('./lib/settings');
const safety = require('./lib/security');
const accounts = require('./lib/accounts');

const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const UPLOADS = require('./lib/paths').UPLOADS;
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
require('./lib/platform').early(app); // request ids + logs, gzip, HTTPS redirect, URL aliases, pagination, SEO
safety.mount(app);                    // sanitising, IP guard, CSP, CORS, maintenance, rate limits, audit, quotas
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '1h' : 0 }));
app.use('/files', express.static(UPLOADS, { maxAge: '7d' })); // original page attachments (random names)

/* ---------- maintenance mode from the environment: MAINTENANCE=1 npm start ---------- */
app.use((req, res, next) => {
  if (process.env.MAINTENANCE === '1' && !/^\/(api|login|admin)/.test(req.path)) {
    return res.status(503).send(renderPage(pages.maintenance, '/maintenance'));
  }
  next();
});

/* ---------- helpers ---------- */
const base = (req) => (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const hits = new Map();
function limit(max, ms) {
  return (req, res, next) => {
    const k = req.ip + req.path, n = Date.now();
    const a = (hits.get(k) || []).filter((t) => n - t < ms);
    a.push(n); hits.set(k, a);
    if (a.length > max) return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    next();
  };
}
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();
const auth = (req, res, next) => accounts.auth(req, res, next);

/* ---------- accounts, QR management, files, analytics, admin, API, notifications, ops ----------
   Keep this block ABOVE the original routes below. Express uses the first matching route.
   files-routes comes before api-v1 so the public /api/files/config stays public. */
accounts.mount(app, { limit, base });
require('./lib/qr-routes')(app, { limit, base, auth });
require('./lib/files-routes')(app, { auth, limit, base });
require('./lib/analytics').mount(app, { limit, base, auth });
require('./lib/admin')(app, { limit, base, auth });
require('./lib/api-v1').mount(app, { limit, base, auth });
require('./lib/notify').mount(app, { auth });
require('./lib/ops').mount(app, { limit, auth });

/* ---------- health ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true, name: 'QRNova', time: new Date().toISOString() }));

/* ---------- QR ENGINE ---------- */
// module matrix + stats (the browser draws the styled QR from this)
app.post('/api/qr/matrix', limit(300, 60e3), (req, res) => {
  try { res.json(engine.analyze(req.body.text, req.body.ecl)); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});
// validation only (no matrix)
app.post('/api/qr/validate', limit(120, 60e3), (req, res) => {
  try {
    const info = engine.analyze(req.body.text, req.body.ecl);
    delete info.rows;
    res.json(Object.assign({ ok: true }, info));
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});
// hot-linkable images: /api/qr.png?data=Hello&size=600&fg=7c5cff&bg=ffffff&ecl=M&margin=4
async function qrImage(req, res, fmt) {
  try {
    const text = String(req.query.data || '').slice(0, 2500);
    const out = await engine.render(text, req.query, fmt);
    res.setHeader('Content-Type', fmt === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (req.query.download === '1') res.setHeader('Content-Disposition', `attachment; filename="qrnova.${fmt}"`);
    res.send(out);
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
}
app.get('/api/qr.svg', limit(120, 60e3), (req, res) => qrImage(req, res, 'svg'));
app.get('/api/qr.png', limit(120, 60e3), (req, res) => qrImage(req, res, 'png'));

/* ---------- original uploads (page attachments for dynamic QR codes) ---------- */
const ALLOWED = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.m4a', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = ALLOWED.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('This file type is not supported.'), ok);
  },
});
const removeFile = (p) => { if (p && p.startsWith('/files/')) fs.unlink(path.join(UPLOADS, path.basename(p)), () => {}); };
const cleanData = (d) => {
  const o = {};
  Object.entries(d || {}).slice(0, 24).forEach(([k, v]) => { if (/^[a-z]{1,20}$/i.test(k)) o[k] = String(v == null ? '' : v).slice(0, 1200); });
  return o;
};
const newCode = () => {
  let c;
  do { c = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7); }
  while (db.qrs.some((q) => q.code === c) || (db.statics || []).some((s) => s.code === c) || db.files.some((f) => f.code === c));
  return c;
};
function stats(q) {
  const days = Array(7).fill(0), dev = {};
  const end = new Date(); end.setHours(23, 59, 59, 999);
  (q.log || []).forEach((l) => {
    const d = Math.floor((end - l.t) / 864e5);
    if (d >= 0 && d < 7) days[6 - d]++;
    dev[l.d] = (dev[l.d] || 0) + 1;
  });
  return { days, dev };
}
const view = (q, req) => Object.assign({
  code: q.code, url: base(req) + '/q/' + q.code, kind: q.kind, type: q.type, title: q.title,
  target: q.target, data: q.data, file: q.file, fileName: q.fileName, scans: q.scans || 0, created: q.created,
}, stats(q));
const fail = (req, res, code, msg) => { if (req.file) removeFile('/files/' + req.file.filename); return res.status(code).json({ error: msg }); };

/* ---------- original dynamic QR endpoints (used by the generator, AI studio and the /api/qr API) ---------- */
app.get('/api/dynamic', auth, (req, res) => {
  const items = db.qrs.filter((q) => q.uid === req.user.id).sort((a, b) => b.created - a.created).map((q) => view(q, req));
  res.json({ items });
});
app.post('/api/dynamic', auth, limit(40, 60e3), upload.single('file'), safety.inspectLegacy, (req, res) => {
  if (db.qrs.filter((q) => q.uid === req.user.id).length >= settings.get().limits.maxDynamicQr) return fail(req, res, 400, 'You have reached the dynamic QR limit of your plan.');
  const kind = ['url', 'page', 'file'].includes(req.body.kind) ? req.body.kind : null;
  if (!kind) return fail(req, res, 400, 'Invalid QR kind.');
  const q = { code: newCode(), uid: req.user.id, kind, type: String(req.body.type || kind).slice(0, 30), title: String(req.body.title || 'Untitled').slice(0, 120), scans: 0, log: [], created: Date.now() };
  if (kind === 'url') {
    q.target = safeHttp(req.body.target);
    if (!q.target) return fail(req, res, 400, 'Dynamic QR codes need a valid web link (http/https).');
  } else if (kind === 'file') {
    if (!req.file) return fail(req, res, 400, 'Please choose a file to upload.');
  } else {
    try { q.data = cleanData(JSON.parse(req.body.data || '{}')); } catch (e) { return fail(req, res, 400, 'Invalid page data.'); }
  }
  if (req.file) { q.file = '/files/' + req.file.filename; q.fileName = req.file.originalname.slice(0, 120); if (kind === 'file') q.target = q.file; }
  db.qrs.push(q); save();
  res.json(view(q, req));
});
app.put('/api/dynamic/:code', auth, upload.single('file'), safety.inspectLegacy, (req, res) => {
  const q = db.qrs.find((x) => x.code === req.params.code && x.uid === req.user.id);
  if (!q) return fail(req, res, 404, 'QR code not found.');
  if (req.body.title !== undefined) q.title = String(req.body.title).slice(0, 120);
  if (q.kind === 'url' && req.body.target) {
    const u = safeHttp(req.body.target);
    if (!u) return fail(req, res, 400, 'Enter a valid web link.');
    q.target = u;
  }
  if (q.kind === 'page' && req.body.data) { try { q.data = cleanData(JSON.parse(req.body.data)); } catch (e) { /* keep the old data */ } }
  if (req.file && q.kind !== 'url') {
    removeFile(q.file);
    q.file = '/files/' + req.file.filename; q.fileName = req.file.originalname.slice(0, 120);
    if (q.kind === 'file') q.target = q.file;
  } else if (req.file) removeFile('/files/' + req.file.filename);
  q.updated = Date.now(); save();
  res.json(view(q, req));
});
app.delete('/api/dynamic/:code', auth, (req, res) => {
  const i = db.qrs.findIndex((x) => x.code === req.params.code && x.uid === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'QR code not found.' });
  removeFile(db.qrs[i].file);
  db.qrs.splice(i, 1); save();
  res.json({ ok: true });
});

/* ---------- AI studio history + Design Studio saved designs ---------- */
require('./lib/ai-routes')(app, { auth, limit });
require('./lib/design-routes')(app, { auth, limit });

/* ---------- contact ---------- */
app.post('/api/contact', limit(5, 60e3), (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80), email = String(req.body.email || '').trim().slice(0, 120), message = String(req.body.message || '').trim().slice(0, 3000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 5) return res.status(400).json({ error: 'Please fill in all fields correctly.' });
  db.messages.push({ name, email, message, t: Date.now() }); save();
  res.json({ ok: true });
});

/* ---------- public pages ---------- */
const ROUTES = {
  '/': 'home', '/about': 'about', '/features': 'features', '/qr-generator': 'generator', '/ai-qr': 'ai',
  '/templates': 'templates', '/pricing': 'pricing', '/faq': 'faq', '/contact': 'contact', '/blog': 'blog',
  '/privacy': 'privacy', '/terms': 'terms', '/security': 'security', '/cookies': 'cookies',
  '/maintenance': 'maintenance', '/login': 'login', '/signup': 'signup', '/dashboard': 'dashboard',
  '/file-to-qr': 'filetoqr', '/my-files': 'myfiles', '/admin': 'admin',
  '/design-studio': 'design',
  '/forgot-password': 'forgot', '/reset-password': 'reset', '/verify-email': 'verify', '/account': 'account',
  '/my-qr-codes': 'myqr', '/analytics': 'analytics',
};
for (const [p, k] of Object.entries(ROUTES)) app.get(p, (req, res) => res.send(renderPage(pages[k], p)));

/* ---------- 404 + errors ---------- */
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found.' });
  res.status(404).send(renderPage(pages['404'], '/404'));
});
app.use(require('./lib/ops').errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  const nets = Object.values(os.networkInterfaces()).flat().filter((n) => n && String(n.family).includes('4') && !n.internal);
  console.log('\n  ✨ QRNova AI QR Platform is running\n');
  console.log(`  Local:    http://localhost:${PORT}`);
  nets.forEach((n) => console.log(`  Network:  http://${n.address}:${PORT}   <- open this on your PC to make QR codes your phone can open`));
  console.log(`  Health:   http://localhost:${PORT}/healthz   (also /readyz and /api/health)`);
  console.log(`  Sitemap:  http://localhost:${PORT}/sitemap.xml`);
  console.log(`  QR API:   http://localhost:${PORT}/api/qr.svg?data=Hello\n`);
});
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const { db, save } = require('./db');
const settings = require('./settings');
const roles = require('./roles');

const cfg = () => settings.get();
const plain = (ip) => String(ip || '').replace(/^::ffff:/, '');
const isLocal = (ip) => /^(::1|127\.)/.test(plain(ip));
const maskIp = (ip) => { ip = plain(ip); return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split('.').slice(0, 2).join('.') + '.x.x' : ip.split(':').slice(0, 2).join(':') + '::'; };
function deny(req, res, code, msg) {
  if (req.path.startsWith('/api/')) return res.status(code).json({ error: msg });
  return res.status(code).type('text/plain').send(msg);
}
function userFrom(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return null;
  const s = db.sessions.find((x) => x.token === t && x.exp > Date.now());
  return s ? db.users.find((u) => u.id === s.uid) || null : null;
}

/* ---------- audit trail ---------- */
function audit(type, req, extra) {
  db.audit = db.audit || [];
  const e = Object.assign({ id: crypto.randomBytes(5).toString('hex'), t: Date.now(), type, ip: req ? maskIp(req.ip) : '' }, extra || {});
  db.audit.push(e);
  if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 2500);
  save();
  return e;
}

/* ---------- strikes → temporary auto-block ---------- */
const strikes = new Map(), blocked = new Map();
function strike(ip, why, w) {
  const S = cfg().security; ip = plain(ip);
  if (!S.autoBlock || isLocal(ip)) return;
  const n = Date.now(); let o = strikes.get(ip);
  if (!o || n - o.t > 10 * 60e3) o = { n: 0, t: n };
  o.n += w || 1; strikes.set(ip, o);
  if (o.n >= S.strikeLimit) { blocked.set(ip, { until: n + S.blockMinutes * 60e3, why }); strikes.delete(ip); audit('auto_block', null, { meta: plain(ip) + ' · ' + why }); }
}
const autoBlocks = () => [...blocked].filter(([, b]) => b.until > Date.now()).map(([ip, b]) => ({ ip, until: b.until, why: b.why }));
const unblock = (ip) => { ip = plain(ip); blocked.delete(ip); strikes.delete(ip); };

/* ---------- fixed-window counters (rate limits, quotas) ---------- */
const buckets = new Map();
function hit(key, max, ms) {
  const n = Date.now(); let o = buckets.get(key);
  if (!o || o.r <= n) { o = { c: 0, r: n + ms }; buckets.set(key, o); }
  o.c++;
  return o.c > max ? Math.ceil((o.r - n) / 1000) : 0; // 0 = allowed, otherwise seconds to wait
}
setInterval(() => { const n = Date.now(); buckets.forEach((v, k) => { if (v.r <= n) buckets.delete(k); }); strikes.forEach((v, k) => { if (n - v.t > 600e3) strikes.delete(k); }); }, 60e3).unref();

/* ---------- middleware ---------- */
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function scrub(o, depth) {
  if (!o || typeof o !== 'object' || depth > 6) return;
  for (const k of Object.keys(o)) {
    if (BAD_KEYS.has(k)) { delete o[k]; continue; }
    const v = o[k];
    if (typeof v === 'string') { if (v.indexOf('\u0000') >= 0) o[k] = v.replace(/\u0000/g, ''); } else scrub(v, depth + 1);
  }
}
function sanitize(req, res, next) { scrub(req.query, 0); scrub(req.body, 0); next(); }

function ipGuard(req, res, next) {
  const ip = plain(req.ip), S = cfg().security;
  if (S.blockedIps.includes(ip)) return deny(req, res, 403, 'Access from your network is blocked.');
  const b = blocked.get(ip);
  if (b) {
    if (b.until > Date.now()) { res.setHeader('Retry-After', Math.ceil((b.until - Date.now()) / 1000)); return deny(req, res, 429, 'Too many suspicious requests. Please try again in a few minutes.'); }
    blocked.delete(ip);
  }
  next();
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://nominatim.openstreetmap.org https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://tessdata.projectnaptha.com",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function headers(req, res, next) {
  const mode = process.env.CSP || cfg().security.csp; // CSP=off is the emergency switch
  if (mode !== 'off' && !req.path.startsWith('/api/')) res.setHeader(mode === 'report' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', CSP);
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), geolocation=(self)');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

const allowList = () => (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
function cors(req, res, next) {
  const o = req.headers.origin;
  if (!o) return next();
  const p = req.path, open = p === '/api/qr.svg' || p === '/api/qr.png' || p === '/api/health';
  const allowed = open || o === `${req.protocol}://${req.get('host')}` || allowList().includes(o);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', open ? '*' : o);
    if (!open) res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.status(allowed ? 204 : 403).end();
  if (!allowed && p.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method)) return res.status(403).json({ error: 'Cross-origin request blocked.' });
  next();
}

function maintenance(req, res, next) {
  const M = cfg().maintenance;
  if (!M.on) return next();
  const p = req.path;
  if (p.startsWith('/api/')) {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (write && !/^\/api\/(auth|sys|admin)/.test(p) && !roles.isStaff(userFrom(req))) return res.status(503).json({ error: 'The site is in maintenance mode. Please try again shortly.' });
    return next();
  }
  if (/^\/(css|js)\//.test(p) || ['/login', '/admin', '/maintenance', '/robots.txt', '/favicon.ico'].includes(p)) return next();
  const { renderPage } = require('./layout'), { esc } = require('./util');
  res.status(503); res.setHeader('Retry-After', '300');
  return res.send(renderPage({ title: 'Maintenance', body: `<section class="container center-page"><div class="big">🛠️</div><h1>We’ll be <span class="grad">right back</span></h1><p class="lead">${esc(M.message)}</p></section>` }, '/maintenance'));
}

function rate(req, res, next) {
  const p = req.path, L = cfg().limits;
  let kind, max;
  if (p.startsWith('/api/')) { kind = 'api'; max = L.apiPerMin; }
  else if (/^\/(q|f|s)\//.test(p)) { kind = 'scan'; max = L.scanPerMin; }
  else if (!/\.[a-z0-9]{2,5}$/i.test(p)) { kind = 'page'; max = 300; }
  else return next();
  const w = hit(kind + ':' + plain(req.ip), max, 60e3);
  if (!w) return next();
  strike(req.ip, 'rate-limit:' + kind, 1);
  res.setHeader('Retry-After', w);
  return deny(req, res, 429, 'Too many requests. Please slow down.');
}

const AUD = { '/api/auth/login': 'login', '/api/auth/signup': 'signup', '/api/auth/forgot': 'forgot_password', '/api/auth/reset': 'reset_password', '/api/account/password': 'password_change' };
function watch(req, res, next) {
  const p = req.path;
  if (req.method === 'POST' && AUD[p]) {
    res.on('finish', () => {
      const ok = res.statusCode < 400, b = req.body || {}, email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 80) : undefined;
      const u = email ? db.users.find((x) => x.email === email) : null;
      if (p === '/api/auth/login') {
        if (!ok) strike(req.ip, 'failed-login', 3);
        audit(ok ? 'login' : 'login_failed', req, { status: res.statusCode, email, uid: u && u.id });
      } else audit(AUD[p], req, { status: res.statusCode, email, uid: u && u.id });
    });
  } else if (req.method === 'DELETE' && p === '/api/account') res.on('finish', () => audit('account_deleted', req, { status: res.statusCode }));
  res.on('finish', () => { if (res.statusCode === 404 && /^\/(q|f|s)\/[^/]+\/?$/.test(p)) strike(req.ip, 'code-enumeration', 1); });
  next();
}

const CREATE = new Set(['POST /api/dynamic', 'POST /api/files', 'POST /api/qr/static']);
function quota(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const p = req.path, L = cfg().limits, key = req.method + ' ' + p;
  if (p === '/api/auth/signup' && !cfg().signup.open) return deny(req, res, 403, 'Registration is currently closed.');
  if (key === 'POST /api/contact') { // spam filter: silently drop link-stuffed or keyboard-mashed messages
    const m = String((req.body || {}).message || '');
    if ((m.match(/https?:\/\/|www\./gi) || []).length > 2 || /(.)\1{25,}/.test(m)) { audit('spam_blocked', req, { meta: 'contact form' }); return res.json({ ok: true }); }
    return next();
  }
  const isCreate = CREATE.has(key) || /^POST \/api\/qr\/[qfs]_[\w-]+\/duplicate$/.test(key);
  const isUpload = key === 'POST /api/files' || key === 'POST /api/dynamic' || /^POST \/api\/files\/[\w-]+\/replace$/.test(key);
    const isAi = /^POST \/api\/ai\/(sessions\/[\w-]+\/messages|extract|detect|parse|generate|validate|recommend|design)$/.test(key);
  if (!isCreate && !isUpload && !isAi) return next();
  const u = userFrom(req);
  if (!u) return next(); // the route's own auth answers 401
  const wait = (w, msg) => { res.setHeader('Retry-After', w); return deny(req, res, 429, msg); };
  if ((isCreate || isUpload) && cfg().signup.requireVerified && u.verified === false) return deny(req, res, 403, 'Please verify your email address before creating QR codes. Open Account settings to resend the link.');
  if (isCreate) {
    if (key === 'POST /api/dynamic' && db.qrs.filter((q) => q.uid === u.id).length >= L.maxDynamicQr) return deny(req, res, 403, `Limit reached (${L.maxDynamicQr} dynamic QR codes).`);
    if (key === 'POST /api/qr/static' && db.statics.filter((s) => s.uid === u.id).length >= L.maxStaticQr) return deny(req, res, 403, `Limit reached (${L.maxStaticQr} static QR codes).`);
    const w = hit('mk:' + u.id, L.createPerHour, 3600e3);
    if (w) return wait(w, `You reached the hourly QR creation limit (${L.createPerHour}). Try again in ${Math.ceil(w / 60)} min.`);
  }
  if (isUpload) {
    const w = hit('up:' + u.id, L.uploadPerHour, 3600e3);
    if (w) return wait(w, `You reached the hourly upload limit (${L.uploadPerHour}). Try again in ${Math.ceil(w / 60)} min.`);
    if (L.totalStorageMB > 0) {
      const total = db.files.reduce((a, f) => a + (f.size || 0), 0);
      if (total + (+req.headers['content-length'] || 0) > L.totalStorageMB * 1048576) return deny(req, res, 507, 'The platform storage is full. Please try again later or contact support.');
    }
  }
  if (isAi) {
    const w = hit('ai:' + u.id, L.aiPerDay, 864e5);
    if (w) return wait(w, `Daily AI limit reached (${L.aiPerDay} requests). It resets in about ${Math.ceil(w / 3600)} h.`);
  }
  next();
}

function mount(app) {
  [sanitize, ipGuard, headers, cors, maintenance, rate, watch, quota].forEach((m) => app.use(m));
}

/* ---------- file & redirect safety helpers ---------- */
function mimeOk(ext, mime) {
  mime = String(mime || '').toLowerCase().split(';')[0].trim();
  if (!mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream') return true; // the content check (magic bytes) decides
  const cat = require('./filestore').catOf(ext);
  if (cat === 'image') return /^image\//.test(mime);
  if (cat === 'audio') return /^audio\//.test(mime);
  if (cat === 'video') return /^(video|audio)\//.test(mime);
  if (cat === 'pdf') return mime === 'application/pdf';
  if (cat === 'document') return ext === 'txt' ? /^text\//.test(mime) : /^application\/(msword|vnd\.|x-)/.test(mime);
  return false;
}
function redirectOk(url, req) {
  let u; try { u = new URL(url); } catch (e) { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (cfg().security.blockedDomains.some((d) => h === d || h.endsWith('.' + d))) return false;
  if (req && h === String(req.hostname).toLowerCase() && /^\/q\//.test(u.pathname)) return false; // redirect loop
  return true;
}
// content check for uploads made through the original /api/dynamic endpoint
async function inspectLegacy(req, res, next) {
  const f = req.file;
  if (!f) return next();
  const fsx = require('./filestore'), ext = fsx.extOf(f.originalname), e = ext === 'csv' ? 'txt' : ext;
  const bad = (m) => { fs.unlink(f.path, () => {}); return res.status(400).json({ error: m }); };
  try {
    if (!fsx.catOf(e)) return bad('This file type is not supported.');
    if (!mimeOk(e, f.mimetype)) return bad('The file type does not match its contents.');
    const r = await fsx.inspect(f.path, e, f.size);
    if (!r.ok) return bad(r.error);
    next();
  } catch (err) { bad('Could not verify the file.'); }
}

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e && e.message ? e.message : e));

module.exports = { mount, audit, strike, userFrom, autoBlocks, unblock, maskIp, mimeOk, redirectOk, inspectLegacy };
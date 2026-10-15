'use strict';
const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
let compression = null; try { compression = require('compression'); } catch (e) { /* optional */ }

// pure aliases from the Part 8 API spec onto the existing routes
const MAP = [
  ['POST', '/api/auth/register', '/api/auth/signup'], ['POST', '/api/auth/forgot-password', '/api/auth/forgot'],
  ['POST', '/api/auth/reset-password', '/api/auth/reset'], ['POST', '/api/auth/verify-email', '/api/auth/verify'],
  ['POST', '/api/files/upload', '/api/files'],
  ['GET', '/api/admin/users', '/api/sys/users'], ['GET', '/api/admin/qrs', '/api/sys/qrs'], ['GET', '/api/admin/files', '/api/sys/files'], ['GET', '/api/admin/analytics', '/api/sys/analytics'],
  ['GET', '/api/analytics/overview', '/api/analytics'],
];
function rewrite(req, res, next) {
  const i = req.url.indexOf('?'), p = i < 0 ? req.url : req.url.slice(0, i), q = i < 0 ? '' : req.url.slice(i);
  for (const [m, from, to] of MAP) if (req.method === m && p === from) { req.url = to + q; return next(); }
  if (p.startsWith('/qr/')) req.url = '/q/' + p.slice(4) + q; // 8.8: /qr/:shortCode → the dynamic redirect route
  next();
}
function forceHttps(req, res, next) {
  if (process.env.FORCE_HTTPS === '1' && !req.secure && !/^\/(healthz|readyz|metrics)/.test(req.path)) return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
  next();
}
// GET /api/qr?page=1&limit=20 → paginated list
function paginate(req, res, next) {
  if (req.query.page === undefined && req.query.limit === undefined) return next();
  const per = Math.round(clamp(req.query.limit, 1, 100, 20)), j = res.json.bind(res);
  res.json = (b) => {
    if (!b || !Array.isArray(b.items) || res.statusCode >= 400) return j(b);
    const total = b.items.length, pages = Math.max(1, Math.ceil(total / per)), page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
    return j(Object.assign({}, b, { items: b.items.slice((page - 1) * per, page * per), total, page, pages, limit: per }));
  };
  next();
}
// GET /api/qr and /api/qr/:id with ?format=spec → the Part 8 QR record shape (8.4)
function specFormat(req, res, next) {
  if (req.query.format !== 'spec') return next();
  const { db } = require('./db'), schema = require('./schema'), j = res.json.bind(res);
  const one = (v) => { const it = v && v.code ? db.qrs.find((x) => x.code === v.code) || (db.statics || []).find((x) => x.code === v.code) || db.files.find((x) => x.code === v.code) : null; return it ? schema.toQr(it) : v; };
  res.json = (b) => (!b || res.statusCode >= 400 ? j(b) : Array.isArray(b.items) ? j(Object.assign({}, b, { items: b.items.map(one) })) : j(one(b)));
  next();
}

function early(app) {
  app.use(require('./ops').observe);
  if (compression) app.use(compression({ threshold: 1024 }));
  app.use(forceHttps);
  app.use(rewrite);
  app.get('/api/qr', specFormat, paginate);
  app.get('/api/qr/:id', specFormat);
  require('./seo').mount(app);
}

module.exports = { early };
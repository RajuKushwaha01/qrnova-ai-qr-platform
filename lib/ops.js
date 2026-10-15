'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { db, save, dir } = require('./db');

const LOGS = path.join(dir, 'logs'), BACKUPS = path.join(dir, 'backups');
fs.mkdirSync(LOGS, { recursive: true }); fs.mkdirSync(BACKUPS, { recursive: true });
const KEEP_LOG_DAYS = +process.env.LOG_DAYS || 14, KEEP_BACKUPS = +process.env.BACKUP_KEEP || 14;
const BACKUP_HOURS = process.env.BACKUP_HOURS === undefined ? 24 : +process.env.BACKUP_HOURS;
const day = () => new Date().toISOString().slice(0, 10);
const maskIp = (ip) => { ip = String(ip || '').replace(/^::ffff:/, ''); return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split('.').slice(0, 2).join('.') + '.x.x' : ip.split(':').slice(0, 2).join(':') + '::'; };

/* ---------- buffered log files (access-YYYY-MM-DD.log, error-YYYY-MM-DD.log) ---------- */
const bufs = { access: [], error: [] };
function flushLogs() { Object.keys(bufs).forEach((k) => { if (!bufs[k].length) return; const data = bufs[k].join(''); bufs[k] = []; fs.appendFile(path.join(LOGS, `${k}-${day()}.log`), data, () => {}); }); }
setInterval(flushLogs, 2000).unref();
process.on('exit', () => { Object.keys(bufs).forEach((k) => { if (bufs[k].length) try { fs.appendFileSync(path.join(LOGS, `${k}-${day()}.log`), bufs[k].join('')); } catch (e) { /* ignore */ } }); });

/* ---------- metrics + error ring ---------- */
const M = { total: 0, inflight: 0, s2: 0, s3: 0, s4: 0, s5: 0, latSum: 0, errors: 0 };
const ring = [];
function track(err, req, kind) {
  const e = { id: crypto.randomBytes(4).toString('hex'), t: Date.now(), kind, msg: String((err && err.message) || err).slice(0, 300), stack: String((err && err.stack) || '').split('\n').slice(0, 6).join('\n'), path: req ? req.path : '', rid: req && req.id };
  ring.push(e); if (ring.length > 100) ring.shift();
  bufs.error.push(JSON.stringify(e) + '\n'); M.errors++;
  return e;
}

/* ---------- request id + access log + latency ---------- */
function observe(req, res, next) {
  req.id = crypto.randomBytes(6).toString('hex'); res.setHeader('X-Request-Id', req.id);
  const t0 = process.hrtime.bigint(); M.inflight++;
  res.on('finish', () => {
    M.inflight--;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6, c = Math.floor(res.statusCode / 100);
    M.total++; M.latSum += ms; if (c >= 2 && c <= 5) M['s' + c]++;
    if (/\.[a-z0-9]{2,5}$/i.test(req.path) && !req.path.startsWith('/api/')) return; // skip static assets
    bufs.access.push(JSON.stringify({ t: new Date().toISOString(), id: req.id, m: req.method, u: req.path, s: res.statusCode, ms: Math.round(ms), ip: maskIp(req.ip) }) + '\n');
    if (ms > 2000) track({ message: `Slow request: ${Math.round(ms)} ms` }, req, 'slow');
  });
  next();
}

/* ---------- error handler: 4xx show the reason, 5xx show a reference id ---------- */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const msg = String((err && err.message) || '');
  let status = err.status || err.statusCode;
  if (!status) status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.name === 'MulterError' || /^(This file type|File is too large|.*not (supported|allowed))/i.test(msg) ? 400 : 500;
  let text = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : status < 500 ? msg || 'Bad request.' : 'Something went wrong. Please try again.';
  if (err.type === 'entity.parse.failed') text = 'The request body is not valid JSON.';
  if (err.type === 'entity.too.large') text = 'The request is too large.';
  const e = status >= 500 ? track(err, req, 'server') : null;
  if (req.path.startsWith('/api')) return res.status(status).json({ error: text, ref: e ? e.id : undefined });
  const { renderPage } = require('./layout');
  res.status(status >= 500 ? 500 : status).send(renderPage({ title: 'Something went wrong', body: `<section class="container center-page"><div class="big">⚠️</div><h1>Something went <span class="grad">wrong</span></h1><p class="lead">We couldn’t complete that request.${e ? ' Reference: <b>' + e.id + '</b>' : ''}</p><a class="btn btn-primary" href="/">Back to home</a></section>` }, '/500'));
}

/* ---------- backups + housekeeping ---------- */
function prune() {
  try {
    const files = fs.readdirSync(BACKUPS).filter((f) => /^db-.*\.json\.gz$/.test(f)).sort();
    files.slice(0, Math.max(0, files.length - KEEP_BACKUPS)).forEach((f) => fs.unlink(path.join(BACKUPS, f), () => {}));
    fs.readdirSync(LOGS).forEach((f) => { const p = path.join(LOGS, f); fs.stat(p, (e, st) => { if (!e && Date.now() - st.mtimeMs > KEEP_LOG_DAYS * 864e5) fs.unlink(p, () => {}); }); });
  } catch (e) { /* ignore */ }
}
function backupNow(cb) {
  const name = `db-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.json.gz`;
  zlib.gzip(Buffer.from(JSON.stringify(db)), (e, buf) => {
    if (e) return cb && cb(e);
    fs.writeFile(path.join(BACKUPS, name), buf, (e2) => { if (e2) return cb && cb(e2); prune(); cb && cb(null, { name, bytes: buf.length }); });
  });
}
if (BACKUP_HOURS > 0) { setTimeout(() => backupNow(), 60e3).unref(); setInterval(() => backupNow(), BACKUP_HOURS * 3600e3).unref(); }
setInterval(() => { db.sessions = db.sessions.filter((s) => s.exp > Date.now()); save(); prune(); }, 3600e3).unref();

process.on('uncaughtException', (e) => { track(e, null, 'fatal'); flushLogs(); console.error('Fatal error:', e); try { require('./db').flush(); } catch (x) { process.exit(1); } });
process.on('unhandledRejection', (e) => { track(e && e.message ? e : { message: String(e) }, null, 'rejection'); });

function mount(app, { auth, limit }) {
  const roles = require('./roles');
  const staff = (req, res, next) => (roles.isStaff(req.user) ? next() : res.status(403).json({ error: 'Admin access required.' }));
  const superOnly = (req, res, next) => (roles.isSuper(req.user) ? next() : res.status(403).json({ error: 'Super Admin access required.' }));

  app.get('/healthz', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) })); // liveness
  app.get('/readyz', (req, res) => { // readiness
    const checks = {};
    try { fs.accessSync(dir, fs.constants.W_OK); checks.storage = true; } catch (e) { checks.storage = false; }
    checks.database = Array.isArray(db.users) && Array.isArray(db.qrs);
    const ok = Object.values(checks).every(Boolean);
    res.status(ok ? 200 : 503).json({ ok, checks });
  });
  app.get('/metrics', (req, res) => { // Prometheus text format; loopback only unless METRICS_TOKEN is set
    const tok = process.env.METRICS_TOKEN, given = (req.headers.authorization || '').replace('Bearer ', '') || String(req.query.token || '');
    if (tok ? given !== tok : !/^(::1|127\.|::ffff:127\.)/.test(String(req.ip))) return res.status(403).type('text/plain').send('forbidden');
    const scans = db.qrs.reduce((a, q) => a + (q.scans || 0), 0) + db.files.reduce((a, f) => a + (f.views || 0), 0);
    res.type('text/plain; version=0.0.4').send([
      '# TYPE qrnova_http_requests_total counter', `qrnova_http_requests_total ${M.total}`,
      ...[2, 3, 4, 5].map((c) => `qrnova_http_responses_total{class="${c}xx"} ${M['s' + c]}`),
      '# TYPE qrnova_http_inflight gauge', `qrnova_http_inflight ${M.inflight}`,
      `qrnova_http_latency_ms_avg ${M.total ? (M.latSum / M.total).toFixed(2) : 0}`, `qrnova_errors_total ${M.errors}`,
      `qrnova_uptime_seconds ${Math.round(process.uptime())}`, `qrnova_memory_rss_bytes ${process.memoryUsage().rss}`,
      `qrnova_users_total ${db.users.length}`, `qrnova_qr_codes_total ${db.qrs.length + (db.statics || []).length}`, `qrnova_files_total ${db.files.length}`, `qrnova_scans_total ${scans}`, '',
    ].join('\n'));
  });

  // browser-side errors (ui.js in 8B posts here)
  app.post('/api/client-error', limit(20, 60e3), (req, res) => {
    const b = req.body || {};
    track({ message: String(b.message || '').slice(0, 300), stack: String(b.stack || '').slice(0, 600) }, { path: String(b.url || '').replace(/\?.*$/, '').slice(0, 200), id: req.id }, 'client');
    res.status(204).end();
  });
  app.get('/api/sys/errors', auth, staff, (req, res) => res.json({ items: ring.slice().reverse() }));
  app.get('/api/sys/backups', auth, staff, (req, res) => {
    const items = fs.readdirSync(BACKUPS).filter((f) => /^db-.*\.json\.gz$/.test(f)).sort().reverse().map((f) => { const st = fs.statSync(path.join(BACKUPS, f)); return { name: f, bytes: st.size, t: st.mtimeMs }; });
    res.json({ items, keep: KEEP_BACKUPS, everyHours: BACKUP_HOURS });
  });
  app.post('/api/sys/backups', auth, staff, superOnly, limit(3, 600e3), (req, res) => {
    backupNow((e, r) => (e ? res.status(500).json({ error: 'Backup failed: ' + e.message }) : res.json(r)));
  });
}

module.exports = { observe, errorHandler, mount, track, backupNow };
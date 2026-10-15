'use strict';
const crypto = require('crypto');
const { db, save } = require('./db');
const settings = require('./settings');
const security = require('./security');
const viewer = require('./viewer');
const engine = require('./qrengine');

const cfg = () => settings.get().analytics;
const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

/* ═══════════ user-agent, region, referrer ═══════════ */
const BOT = /\b(googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|facebookexternalhit|facebot|whatsapp|telegrambot|slackbot|discordbot|linkedinbot|twitterbot|embedly|skypeuripreview|curl|wget|python-requests|python-urllib|go-http-client|httpclient|headlesschrome|lighthouse|pingdom|uptimerobot|ia_archiver|crawler|spider)\b/i;
function parseUA(ua) {
  ua = String(ua || '');
  const tablet = /ipad|tablet|kindle|silk\/|playbook|(android(?!.*mobile))/i.test(ua);
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os x|macintosh/i.test(ua) ? 'macOS' : /cros/i.test(ua) ? 'ChromeOS' : /linux/i.test(ua) ? 'Linux' : 'Other';
  return {
    bot: !ua || BOT.test(ua),
    cat: tablet ? 'tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'mobile' : 'desktop',
    br: /instagram/i.test(ua) ? 'Instagram app' : /fban|fbav|fb_iab/i.test(ua) ? 'Facebook app' : /edg(e|a|ios)?\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /fxios|firefox/i.test(ua) ? 'Firefox' : /crios|chrome|chromium/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Other',
    os, legacy: ['Android', 'iOS', 'Windows', 'macOS', 'Linux'].includes(os) ? os : 'Other',
  };
}
// Approximate region only: a CDN country header when present, otherwise the region in the browser language (en-IN → IN). No IP lookup, no IP stored.
const CC_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country', 'x-appengine-country', 'x-country-code'];
function region(req) {
  for (const h of CC_HEADERS) { const v = String(req.headers[h] || '').toUpperCase(); if (/^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1') return v; }
  const m = String(req.headers['accept-language'] || '').match(/[a-z]{2,3}-([A-Za-z]{2})\b/);
  return m ? m[1].toUpperCase() : '';
}
function refHost(req) {
  const r = req.headers.referer || req.headers.referrer || '';
  if (!r) return '';
  try { const h = new URL(r).hostname.replace(/^www\./, '').toLowerCase().slice(0, 60); return h === String(req.hostname).toLowerCase().replace(/^www\./, '') ? '' : h; } catch (e) { return ''; }
}

/* ═══════════ per-QR rollups (exact counters, kept beyond the 1000-entry log) ═══════════ */
const newAgg = () => ({ day: {}, hr: Array(24).fill(0), wk: Array(7).fill(0), cat: {}, br: {}, os: {}, g: {}, r: {}, uq: 0 });
const tzOf = (uid) => { const u = db.users.find((x) => x.id === uid); return u && Number.isFinite(u.tz) ? u.tz : 0; };
const dayKey = (t, tz) => new Date(t + tz * 60000).toISOString().slice(0, 10);
function bump(map, k, cap) { if (!(k in map) && Object.keys(map).length >= cap) k = 'Other'; map[k] = (map[k] || 0) + 1; }
function add(agg, e, tz) {
  const d = new Date(e.t + tz * 60000), k = d.toISOString().slice(0, 10), legacy = e.c === undefined;
  agg.day[k] = (agg.day[k] || 0) + 1; agg.hr[d.getUTCHours()]++; agg.wk[d.getUTCDay()]++;
  bump(agg.cat, e.c || (e.d === 'Android' || e.d === 'iOS' ? 'mobile' : 'desktop'), 6);
  if (legacy) { bump(agg.os, e.d || 'Other', 30); bump(agg.br, 'Unknown', 30); }
  else if (e.b) { bump(agg.os, e.o || 'Other', 30); bump(agg.br, e.b, 30); }
  if (e.g) bump(agg.g, e.g, 80);
  if (e.r) bump(agg.r, e.r, 60);
}
function ensure(item) {
  if (!item.agg) {
    const tz = tzOf(item.uid), a = newAgg(); item.uv = [];
    (item.log || []).forEach((e) => { add(a, e, tz); if (e.v && !item.uv.includes(e.v)) { item.uv.push(e.v); a.uq++; } });
    item.agg = a;
  }
  return item.agg;
}

/* record one scan. Returns false (and counts nothing) for crawlers and link-preview bots. */
function record(item, req, key) {
  const p = parseUA(req.headers['user-agent']), A = cfg();
  if (p.bot) return false;
  const priv = A.honorDnt && (req.headers.dnt === '1' || req.headers['sec-gpc'] === '1'); // Do Not Track / Global Privacy Control
  const tz = tzOf(item.uid), agg = ensure(item), e = { t: Date.now(), d: p.legacy, c: p.cat };
  item[key] = (item[key] || 0) + 1;
  if (!priv) {
    e.b = p.br; e.o = p.os;
    if (A.region) { const g = region(req); if (g) e.g = g; }
    if (A.referrer) { const r = refHost(req); if (r) e.r = r; }
    if (A.unique) e.v = crypto.createHash('sha256').update([req.ip, req.headers['user-agent'] || '', item.code, db.secret || 'qrnova'].join('|')).digest('hex').slice(0, 12);
  }
  (item.log = item.log || []).push(e);
  if (item.log.length > 1000) item.log.shift();
  add(agg, e, tz);
  if (e.v) { item.uv = item.uv || []; if (!item.uv.includes(e.v)) { if (item.uv.length < 5000) item.uv.push(e.v); agg.uq++; } }
  const ks = Object.keys(agg.day);
  if (ks.length > 800) ks.sort().slice(0, ks.length - 730).forEach((k) => { delete agg.day[k]; });
  save();
  return true;
}

/* ═══════════ summary for one QR or many ═══════════ */
const mineItems = (uid) => [].concat(
  db.qrs.filter((q) => q.uid === uid).map((it) => ({ it, key: 'scans', id: 'q_' + it.code, title: it.title, type: it.type })),
  db.files.filter((f) => f.uid === uid).map((it) => ({ it, key: 'views', id: 'f_' + it.id, title: it.title, type: it.cat })));
const allItems = () => [].concat(
  db.qrs.map((it) => ({ it, key: 'scans', id: 'q_' + it.code, title: it.title, type: it.type })),
  db.files.map((it) => ({ it, key: 'views', id: 'f_' + it.id, title: it.title, type: it.cat })));

function summarize(items, o) {
  const tz = o.tz, days = o.days, today = dayKey(Date.now(), tz);
  const A = { day: {}, hr: Array(24).fill(0), wk: Array(7).fill(0), cat: {}, br: {}, os: {}, g: {}, r: {} };
  let total = 0, uniq = 0, uniqToday = 0; const recent = [];
  for (const f of items) {
    const a = ensure(f.it);
    total += f.it[f.key] || 0; uniq += a.uq || 0;
    Object.entries(a.day).forEach(([k, v]) => { A.day[k] = (A.day[k] || 0) + v; });
    a.hr.forEach((v, i) => { A.hr[i] += v; }); a.wk.forEach((v, i) => { A.wk[i] += v; });
    ['cat', 'br', 'os', 'g', 'r'].forEach((m) => Object.entries(a[m]).forEach(([k, v]) => { A[m][k] = (A[m][k] || 0) + v; }));
    const seen = new Set();
    (f.it.log || []).forEach((e) => { if (e.v && dayKey(e.t, tz) === today && !seen.has(e.v)) { seen.add(e.v); uniqToday++; } });
    (f.it.log || []).slice(-30).forEach((e) => recent.push({ t: e.t, title: f.title, id: f.id, c: e.c || null, b: e.b || null, o: e.o || e.d || null, g: e.g || null, r: e.r || null }));
  }
  const d0 = Date.parse(today + 'T00:00:00Z'), iso = (t) => new Date(t).toISOString().slice(0, 10);
  const labels = [], counts = [];
  for (let i = days - 1; i >= 0; i--) { const k = iso(d0 - i * 864e5); labels.push(k); counts.push(A.day[k] || 0); }
  let prev = 0; for (let i = days; i < days * 2; i++) prev += A.day[iso(d0 - i * 864e5)] || 0;
  const mon = (k) => { const t = Date.parse(k + 'T00:00:00Z'); return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5); };
  const wm = Date.parse(mon(today) + 'T00:00:00Z'), wl = [], wc = Array(12).fill(0);
  for (let i = 11; i >= 0; i--) wl.push(iso(wm - i * 7 * 864e5));
  Object.entries(A.day).forEach(([k, v]) => { const i = wl.indexOf(mon(k)); if (i >= 0) wc[i] += v; });
  const ty = +today.slice(0, 4), tm = +today.slice(5, 7), ml = [], mc = Array(12).fill(0);
  for (let i = 11; i >= 0; i--) ml.push(new Date(Date.UTC(ty, tm - 1 - i, 1)).toISOString().slice(0, 7));
  Object.entries(A.day).forEach(([k, v]) => { const i = ml.indexOf(k.slice(0, 7)); if (i >= 0) mc[i] += v; });
  return {
    total, unique: Math.min(uniq, total), today: A.day[today] || 0, uniqueToday: uniqToday, week: wc[11], month: mc[11],
    range: { days, total: counts.reduce((a, b) => a + b, 0), prev },
    series: { labels, counts }, weekly: { labels: wl, counts: wc }, monthly: { labels: ml, counts: mc },
    hours: A.hr, weekdays: A.wk, devices: A.cat, browsers: A.br, os: A.os, regions: A.g, referrers: A.r,
    recent: recent.sort((a, b) => b.t - a.t).slice(0, 30), tz,
  };
}

const csvCell = (v) => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

function mount(app, { auth, limit, base }) {
  const pick = (req) => {
    const list = mineItems(req.user.id), id = String(req.query.id || 'all');
    return { list, pick: id === 'all' ? list : list.filter((x) => x.id === id), id };
  };
  const tzOfReq = (req) => {
    const tz = Math.round(clamp(req.query.tz, -840, 840, req.user.tz || 0));
    if (req.user.tz !== tz) { req.user.tz = tz; save(); } // days follow the owner's time zone
    return tz;
  };

  app.get('/api/analytics', auth, limit(120, 60e3), (req, res) => {
    const tz = tzOfReq(req), days = [7, 14, 30, 90, 180, 365].includes(+req.query.days) ? +req.query.days : 30, p = pick(req);
    if (p.id !== 'all' && !p.pick.length) return res.status(404).json({ error: 'QR code not found.' });
    const s = summarize(p.pick, { days, tz }), brief = p.list.map((x) => ({ id: x.id, title: x.title, type: x.type, scans: x.it[x.key] || 0 })).sort((a, b) => b.scans - a.scans);
    s.options = brief.slice(0, 300); s.top = brief.filter((x) => x.scans > 0).slice(0, 5); s.selected = p.id;
    res.json(s);
  });

  app.get('/api/analytics/export', auth, limit(10, 60e3), (req, res) => {
    const tz = tzOfReq(req), days = [7, 14, 30, 90, 180, 365].includes(+req.query.days) ? +req.query.days : 30, p = pick(req);
    const s = summarize(p.pick, { days, tz }), logs = [];
    p.pick.forEach((f) => (f.it.log || []).forEach((e) => logs.push([e.t, f.title, e.c || '', e.b || '', e.o || e.d || '', e.g || '', e.r || ''])));
    logs.sort((a, b) => b[0] - a[0]);
    const rows = ['Date,Scans'].concat(s.series.labels.map((l, i) => l + ',' + s.series.counts[i]), ['', 'Time (UTC),QR code,Device,Browser,OS,Region,Referrer'], logs.slice(0, 5000).map((r) => [new Date(r[0]).toISOString()].concat(r.slice(1)).map(csvCell).join(',')));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="qrnova-analytics.csv"');
    res.send('\ufeff' + rows.join('\r\n'));
  });

  /* ---------- public share page switch ---------- */
  const mineOne = (req) => {
    const m = /^([qf])_([\w-]{1,40})$/.exec(req.params.id); if (!m) return null;
    return m[1] === 'q' ? db.qrs.find((x) => x.code === m[2] && x.uid === req.user.id) : db.files.find((x) => x.id === m[2] && x.uid === req.user.id);
  };
  app.get('/api/qr/:id/public-share', auth, (req, res) => {
    const it = mineOne(req); if (!it) return res.status(404).json({ error: 'QR code not found.' });
    res.json({ on: !!it.pubShare, url: base(req) + '/s/' + it.code });
  });
  app.post('/api/qr/:id/public-share', auth, limit(60, 60e3), (req, res) => {
    const it = mineOne(req); if (!it) return res.status(404).json({ error: 'QR code not found.' });
    it.pubShare = (req.body || {}).on === true || (req.body || {}).on === 'true';
    save(); res.json({ on: it.pubShare, url: base(req) + '/s/' + it.code });
  });

  app.get('/s/:code', limit(120, 60e3), async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex');
    const code = req.params.code, q = db.qrs.find((x) => x.code === code), f = q ? null : db.files.find((x) => x.code === code), it = q || f;
    if (!it || !it.pubShare || it.adminDisabled || it.status === 'suspended' || it.archived || it.active === false || (it.expires && it.expires <= Date.now())) return res.status(404).send(viewer.notice('notfound'));
    const url = base(req) + (q ? '/q/' : '/f/') + code, enc = encodeURIComponent(url);
    try {
      const svg = await engine.render(url, { ecl: 'Q', margin: 2, size: 640, fg: '#4c1d95' }, 'svg');
      res.send(viewer.share({ title: it.title, url, svg, host: q && q.kind === 'url' ? hostOf(q.target) : '', png: `/api/qr.png?data=${enc}&size=1024&ecl=Q&fg=4c1d95&download=1`, svgUrl: `/api/qr.svg?data=${enc}&size=1024&ecl=Q&fg=4c1d95&download=1` }));
    } catch (e) { res.status(500).send(viewer.notice('notfound')); }
  });

  /* ---------- report a dynamic QR page (files have their own endpoint) ---------- */
  app.post('/q/:code/report', limit(3, 600e3), (req, res) => {
    const q = db.qrs.find((x) => x.code === req.params.code);
    if (!q) return res.status(404).json({ error: 'Not found.' });
    const h = crypto.createHash('sha256').update(String(req.ip) + (db.secret || '')).digest('hex').slice(0, 16);
    q.reporters = q.reporters || [];
    if (!q.reporters.includes(h)) {
      q.reporters.push(h); if (q.reporters.length > 50) q.reporters.shift();
      q.reports = (q.reports || 0) + 1;
      if (q.reports >= (db.settings.reportsToSuspend || 3)) { q.adminDisabled = true; security.audit('qr_auto_disabled', req, { meta: q.code }); } else security.audit('qr_reported', req, { meta: q.code });
      save();
    }
    res.json({ ok: true });
  });
}

module.exports = { mount, record, summarize, ensure, parseUA, mineItems, allItems };
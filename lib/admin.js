'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, save } = require('./db');
const settings = require('./settings');
const roles = require('./roles');
const security = require('./security');
const fsx = require('./filestore');
const mailer = require('./mailer');
const analytics = require('./analytics');

const UPLOADS = require('./paths').UPLOADS;
const DBFILE = require('./db').file;
const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const qState = (q) => (q.adminDisabled ? 'disabled' : q.archived ? 'archived' : q.active === false ? 'inactive' : q.expires && q.expires <= Date.now() ? 'expired' : 'active');
const fState = (f) => (f.status === 'suspended' ? 'suspended' : f.archived ? 'archived' : f.expires && f.expires <= Date.now() ? 'expired' : 'active');

module.exports = function mount(app, { auth, limit, base }) {
  const staff = (req, res, next) => (roles.isStaff(req.user) ? next() : res.status(403).json({ error: 'Admin access required.' }));
  const superOnly = (req, res, next) => (roles.isSuper(req.user) ? next() : res.status(403).json({ error: 'Super Admin access required.' }));
  const A = [auth, staff];
  const owners = () => new Map(db.users.map((u) => [u.id, u.email]));
  const tzOf = (req) => Math.round(clamp(req.query.tz, -840, 840, req.user.tz || 0));
  const page = (list, req, per) => { const pages = Math.max(1, Math.ceil(list.length / per)), pg = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1)); return { items: list.slice((pg - 1) * per, pg * per), total: list.length, page: pg, pages }; };

  function usageMap() {
    const m = new Map(), g = (id) => { let o = m.get(id); if (!o) { o = { qrs: 0, files: 0, bytes: 0, scans: 0 }; m.set(id, o); } return o; };
    db.qrs.forEach((q) => { const o = g(q.uid); o.qrs++; o.scans += q.scans || 0; });
    db.statics.forEach((s) => { g(s.uid).qrs++; });
    db.files.forEach((f) => { const o = g(f.uid); o.files++; o.bytes += f.size || 0; o.scans += f.views || 0; });
    return m;
  }
  function uview(u, um) {
    const o = (um && um.get(u.id)) || { qrs: 0, files: 0, bytes: 0, scans: 0 };
    return { id: u.id, name: u.name, email: u.email, role: roles.roleOf(u), verified: u.verified !== false, suspended: !!u.suspended, reason: u.suspendReason || '', provider: u.provider || 'password', created: u.created, last: db.sessions.filter((s) => s.uid === u.id).reduce((a, s) => Math.max(a, s.last || s.created || 0), 0), qrs: o.qrs, files: o.files, bytes: o.bytes, scans: o.scans };
  }
  function purgeUser(uid) {
    db.qrs.filter((q) => q.uid === uid).forEach((q) => { if (q.file && q.file.startsWith('/files/')) fs.unlink(path.join(UPLOADS, path.basename(q.file)), () => {}); });
    db.files.filter((f) => f.uid === uid).forEach((f) => fs.unlink(path.join(fsx.STORAGE, f.disk), () => {}));
    ['qrs', 'files', 'statics', 'designs', 'aiSessions', 'history', 'folders', 'sessions'].forEach((k) => { db[k] = (db[k] || []).filter((x) => x.uid !== uid); });
    db.users = db.users.filter((x) => x.id !== uid);
  }
  const note = (req, type, meta, extra) => security.audit(type, req, Object.assign({ uid: req.user.id, meta }, extra || {}));
  const pending = () => db.qrs.filter((q) => q.reports > 0 && !q.adminDisabled).length + db.files.filter((f) => f.reports > 0 && f.status !== 'suspended').length;

  /* ---------- overview ---------- */
  app.get('/api/sys/overview', ...A, (req, res) => {
    const now = Date.now(), tz = tzOf(req), s = analytics.summarize(analytics.allItems(), { days: 14, tz });
    const bytes = db.files.reduce((a, f) => a + (f.size || 0), 0), byCat = {};
    db.files.forEach((f) => { byCat[f.cat] = (byCat[f.cat] || 0) + (f.size || 0); });
    const top = analytics.allItems().map((x) => ({ id: x.id, title: x.title, type: x.type, scans: x.it[x.key] || 0 })).filter((x) => x.scans > 0).sort((a, b) => b.scans - a.scans).slice(0, 5);
    let dbBytes = 0; try { dbBytes = fs.statSync(DBFILE).size; } catch (e) { /* ignore */ }
    const cfg = settings.get();
    res.json({
      role: roles.roleOf(req.user),
      counts: {
        users: db.users.length, verified: db.users.filter((u) => u.verified !== false).length, suspended: db.users.filter((u) => u.suspended).length, staff: db.users.filter((u) => roles.isStaff(u)).length,
        newWeek: db.users.filter((u) => now - u.created < 7 * 864e5).length, qrDynamic: db.qrs.length, qrStatic: db.statics.length, files: db.files.length,
        disabled: db.qrs.filter((q) => q.adminDisabled).length + db.files.filter((f) => f.status === 'suspended').length, reports: pending(),
      },
      scans: { total: s.total, today: s.today, month: s.month, series: s.series },
      storage: { bytes, files: db.files.length, quotaMB: cfg.limits.totalStorageMB, byCat },
      activity: (db.audit || []).slice(-14).reverse(), top,
      system: { uptime: Math.round(process.uptime()), node: process.version, memMB: Math.round(process.memoryUsage().rss / 1048576), dbBytes, clam: fsx.scanner.clam, mail: mailer.real ? 'smtp' : 'dev console', csp: process.env.CSP || cfg.security.csp, maintenance: cfg.maintenance.on, blocked: security.autoBlocks().length + cfg.security.blockedIps.length },
    });
  });

  /* ---------- users ---------- */
  app.get('/api/sys/users', ...A, (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase(), role = String(req.query.role || 'all'), st = String(req.query.status || 'all'), um = usageMap();
    let list = db.users.map((u) => uview(u, um));
    if (q) list = list.filter((u) => (u.name + ' ' + u.email + ' ' + u.id).toLowerCase().includes(q));
    if (role !== 'all') list = list.filter((u) => u.role === role);
    if (st === 'suspended') list = list.filter((u) => u.suspended); else if (st === 'active') list = list.filter((u) => !u.suspended); else if (st === 'unverified') list = list.filter((u) => !u.verified);
    list.sort((a, b) => b.created - a.created);
    res.json(page(list, req, 20));
  });
  app.get('/api/sys/users/:id', ...A, (req, res) => {
    const u = db.users.find((x) => x.id === req.params.id); if (!u) return res.status(404).json({ error: 'User not found.' });
    const own = (db.audit || []).filter((e) => e.uid === u.id || (e.email && e.email === u.email)).slice(-30).reverse();
    res.json({
      user: uview(u, usageMap()), activity: own, sessions: db.sessions.filter((s) => s.uid === u.id && s.exp > Date.now()).length,
      qrs: db.qrs.filter((q) => q.uid === u.id).slice(-15).reverse().map((q) => ({ code: q.code, title: q.title, type: q.type, scans: q.scans || 0, state: qState(q) })),
      files: db.files.filter((f) => f.uid === u.id).slice(-15).reverse().map((f) => ({ id: f.id, title: f.title, cat: f.cat, size: f.size, state: fState(f) })),
    });
  });
  app.post('/api/sys/users/:id/action', ...A, limit(60, 60e3), (req, res) => {
    const t = db.users.find((x) => x.id === req.params.id); if (!t) return res.status(404).json({ error: 'User not found.' });
    const b = req.body || {}, act = String(b.action || ''), me = req.user, aRole = roles.roleOf(me), tRole = roles.roleOf(t);
    if (t.id === me.id && ['suspend', 'delete', 'demote'].includes(act)) return res.status(400).json({ error: 'You cannot do that to your own account.' });
    if (tRole === 'superadmin' && act !== 'verify') return res.status(403).json({ error: 'Super Admin accounts are set with the ADMIN_EMAIL environment variable.' });
    if (tRole === 'admin' && aRole !== 'superadmin') return res.status(403).json({ error: 'Only a Super Admin can manage other admins.' });
    const killSessions = () => { db.sessions = db.sessions.filter((s) => s.uid !== t.id); };
    switch (act) {
      case 'suspend':
        t.suspended = true; t.suspendReason = clip(b.reason, 200); killSessions();
        if (b.disableContent) { db.qrs.filter((q) => q.uid === t.id).forEach((q) => { q.adminDisabled = true; }); db.files.filter((f) => f.uid === t.id).forEach((f) => { f.status = 'suspended'; }); }
        break;
      case 'activate':
        t.suspended = false; t.suspendReason = '';
        if (b.restoreContent) { db.qrs.filter((q) => q.uid === t.id).forEach((q) => { q.adminDisabled = false; }); db.files.filter((f) => f.uid === t.id && f.status === 'suspended').forEach((f) => { f.status = 'ok'; f.reports = 0; f.reporters = []; }); }
        break;
      case 'verify': t.verified = true; break;
      case 'logout': killSessions(); break;
      case 'promote': if (aRole !== 'superadmin') return res.status(403).json({ error: 'Only a Super Admin can change roles.' }); t.role = 'admin'; break;
      case 'demote': if (aRole !== 'superadmin') return res.status(403).json({ error: 'Only a Super Admin can change roles.' }); delete t.role; break;
      case 'delete': if (aRole !== 'superadmin') return res.status(403).json({ error: 'Only a Super Admin can delete users.' }); purgeUser(t.id); break;
      default: return res.status(400).json({ error: 'Unknown action.' });
    }
    note(req, 'admin_user_' + act, t.email); save();
    res.json({ ok: true });
  });

  /* ---------- QR codes ---------- */
  app.get('/api/sys/qrs', ...A, (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase(), f = String(req.query.filter || 'all'), own = owners();
    let list = db.qrs.map((x) => ({ id: 'q_' + x.code, code: x.code, title: x.title, type: x.type, kind: x.kind, owner: own.get(x.uid) || '?', ownerId: x.uid, scans: x.scans || 0, state: qState(x), reports: x.reports || 0, access: x.access || 'public', created: x.created, url: base(req) + '/q/' + x.code, target: x.kind === 'url' ? x.target : '' }));
    if (q) list = list.filter((x) => (x.title + ' ' + x.owner + ' ' + x.code + ' ' + x.target + ' ' + x.type).toLowerCase().includes(q));
    if (f === 'reported') list = list.filter((x) => x.reports > 0); else if (f !== 'all') list = list.filter((x) => x.state === f);
    list.sort((a, b) => b.reports - a.reports || b.created - a.created);
    res.json(page(list, req, 20));
  });
  app.post('/api/sys/qrs/:code/action', ...A, limit(60, 60e3), (req, res) => {
    const q = db.qrs.find((x) => x.code === req.params.code); if (!q) return res.status(404).json({ error: 'QR code not found.' });
    const act = String((req.body || {}).action || '');
    if (act === 'disable') q.adminDisabled = true;
    else if (act === 'enable') q.adminDisabled = false;
    else if (act === 'clear') { q.reports = 0; q.reporters = []; }
    else if (act === 'delete') {
      if (q.file && q.file.startsWith('/files/')) fs.unlink(path.join(UPLOADS, path.basename(q.file)), () => {});
      db.history = db.history || []; db.history.push({ id: crypto.randomBytes(6).toString('hex'), uid: q.uid, ev: 'deleted', qid: 'q_' + q.code, title: q.title, type: q.type, meta: 'removed by an admin', t: Date.now() });
      db.qrs = db.qrs.filter((x) => x !== q);
    } else return res.status(400).json({ error: 'Unknown action.' });
    note(req, 'admin_qr_' + act, q.code); save();
    res.json({ ok: true });
  });

  /* ---------- files ---------- */
  function fileUsage(largeMB) {
    const own = owners(), byCat = {}, per = new Map();
    db.files.forEach((f) => { byCat[f.cat] = (byCat[f.cat] || 0) + (f.size || 0); const o = per.get(f.uid) || { bytes: 0, count: 0 }; o.bytes += f.size || 0; o.count++; per.set(f.uid, o); });
    return {
      count: db.files.length, bytes: db.files.reduce((a, f) => a + (f.size || 0), 0), quotaMB: settings.get().limits.totalStorageMB, byCat, large: db.files.filter((f) => f.size >= largeMB * 1048576).length,
      topUsers: [...per].map(([uid, o]) => ({ owner: own.get(uid) || '?', bytes: o.bytes, count: o.count })).sort((a, b) => b.bytes - a.bytes).slice(0, 6),
    };
  }
  app.get('/api/sys/files', ...A, (req, res) => {
    const filter = String(req.query.filter || 'all'), q = String(req.query.q || '').trim().toLowerCase(), largeMB = clamp(req.query.largeMB, 1, 1000, 20), own = owners();
    if (filter === 'deleted') {
      const items = (db.history || []).filter((h) => h.ev === 'deleted' && String(h.qid || '').startsWith('f_')).sort((a, b) => b.t - a.t).slice(0, 200).map((h) => ({ title: h.title, type: h.type, owner: own.get(h.uid) || '(deleted account)', t: h.t, meta: h.meta || '' }));
      return res.json({ deleted: true, items, usage: fileUsage(largeMB) });
    }
    const burst = new Map();
    db.files.forEach((f) => { const k = f.uid + ':' + Math.floor(f.created / 3600e3); burst.set(k, (burst.get(k) || 0) + 1); });
    let list = db.files.map((f) => {
      const r = [], o = db.users.find((u) => u.id === f.uid);
      if (f.reports) r.push('reported ×' + f.reports);
      if (f.status === 'suspended') r.push('suspended');
      if (o && o.verified === false) r.push('unverified owner');
      if ((burst.get(f.uid + ':' + Math.floor(f.created / 3600e3)) || 0) >= 10) r.push('burst upload');
      if (f.size >= (db.settings.maxMB[f.cat] || 50) * 1048576 * 0.8) r.push('near size limit');
      return { id: f.id, code: f.code, title: f.title, name: f.name, owner: own.get(f.uid) || '?', cat: f.cat, size: f.size || 0, access: f.access, state: fState(f), reports: f.reports || 0, views: f.views || 0, scanned: !!f.scanned, created: f.created, url: base(req) + '/f/' + f.code, reasons: r, suspicious: r.some((x) => /reported|suspended|unverified|burst/.test(x)) };
    });
    if (q) list = list.filter((x) => (x.title + ' ' + x.name + ' ' + x.owner).toLowerCase().includes(q));
    if (filter === 'large') list = list.filter((x) => x.size >= largeMB * 1048576); else if (filter === 'suspicious') list = list.filter((x) => x.suspicious); else if (filter === 'reported') list = list.filter((x) => x.reports > 0); else if (filter === 'suspended') list = list.filter((x) => x.state === 'suspended');
    list.sort((a, b) => (filter === 'large' ? b.size - a.size : b.reports - a.reports || b.created - a.created));
    const r = page(list, req, 20); r.usage = fileUsage(largeMB); res.json(r);
  });
  app.post('/api/sys/files/:id/action', ...A, limit(60, 60e3), (req, res) => {
    const f = db.files.find((x) => x.id === req.params.id); if (!f) return res.status(404).json({ error: 'File not found.' });
    const act = String((req.body || {}).action || '');
    if (act === 'suspend') f.status = 'suspended';
    else if (act === 'restore') { f.status = 'ok'; f.reports = 0; f.reporters = []; }
    else if (act === 'clear') { f.reports = 0; f.reporters = []; }
    else if (act === 'delete') {
      fs.unlink(path.join(fsx.STORAGE, f.disk), () => {});
      db.history = db.history || []; db.history.push({ id: crypto.randomBytes(6).toString('hex'), uid: f.uid, ev: 'deleted', qid: 'f_' + f.id, title: f.title, type: f.cat, meta: 'removed by an admin', t: Date.now() });
      db.files = db.files.filter((x) => x !== f);
    } else return res.status(400).json({ error: 'Unknown action.' });
    note(req, 'admin_file_' + act, f.code); save();
    res.json({ ok: true });
  });

  /* ---------- reported content queue ---------- */
  app.get('/api/sys/reports', ...A, (req, res) => {
    const own = owners();
    const items = db.qrs.filter((q) => q.reports > 0).map((q) => ({ kind: 'qr', id: q.code, title: q.title, owner: own.get(q.uid) || '?', reports: q.reports, state: qState(q), created: q.created, url: base(req) + '/q/' + q.code }))
      .concat(db.files.filter((f) => f.reports > 0).map((f) => ({ kind: 'file', id: f.id, title: f.title, owner: own.get(f.uid) || '?', reports: f.reports, state: fState(f), created: f.created, url: base(req) + '/f/' + f.code })))
      .sort((a, b) => b.reports - a.reports);
    res.json({ items });
  });

  /* ---------- platform analytics ---------- */
  app.get('/api/sys/analytics', ...A, (req, res) => {
    const tz = tzOf(req), days = [7, 14, 30, 90].includes(+req.query.days) ? +req.query.days : 30, s = analytics.summarize(analytics.allItems(), { days, tz });
    const key = (t) => new Date(t + tz * 60000).toISOString().slice(0, 10);
    const mk = (arr, f) => { const m = {}; arr.forEach((x) => { const k = key(f(x)); m[k] = (m[k] || 0) + 1; }); return s.series.labels.map((l) => m[l] || 0); };
    const um = usageMap();
    res.json({
      summary: s, labels: s.series.labels,
      signups: mk(db.users, (u) => u.created), created: mk([].concat(db.qrs, db.files, db.statics), (x) => x.created), activity: mk((db.audit || []).filter((e) => ['login', 'signup'].includes(e.type)), (e) => e.t),
      totals: { users: db.users.length, qr: db.qrs.length + db.statics.length, files: db.files.length, scans: s.total, storage: db.files.reduce((a, f) => a + (f.size || 0), 0) },
      topUsers: db.users.map((u) => ({ email: u.email, scans: (um.get(u.id) || {}).scans || 0, qrs: (um.get(u.id) || {}).qrs || 0 })).sort((a, b) => b.scans - a.scans).slice(0, 6),
    });
  });

  /* ---------- configuration (Super Admin writes) ---------- */
  app.get('/api/sys/config', ...A, (req, res) => res.json({ config: settings.get(), canEdit: roles.isSuper(req.user), env: { smtp: mailer.real, adminEmailSet: !!process.env.ADMIN_EMAIL, cspEnv: process.env.CSP || '', corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean) } }));
  app.put('/api/sys/config', auth, staff, superOnly, limit(30, 60e3), (req, res) => {
    const c = settings.update(req.body || {});
    note(req, 'admin_config', Object.keys(req.body || {}).join(', '));
    res.json({ config: c });
  });
  app.post('/api/sys/test-email', auth, staff, superOnly, limit(5, 600e3), async (req, res) => {
    try {
      const r = await mailer.send({ to: req.user.email, subject: 'QRNova test email', title: 'It works 🎉', lines: ['This is a test email from your QRNova admin panel.', mailer.real ? 'It was sent through your SMTP server.' : 'No SMTP server is configured, so it was printed in the server terminal (dev mode).'], cta: null });
      res.json({ sent: r.sent, mode: mailer.real ? 'smtp' : 'dev console' });
    } catch (e) { res.status(502).json({ error: 'The mail server rejected the message: ' + clip(e.message, 160) }); }
  });

  /* ---------- audit + security ---------- */
  const GROUPS = { auth: /^(login|login_failed|signup|forgot_password|reset_password|password_change|account_deleted)$/, security: /^(login_failed|auto_block|spam_blocked|qr_reported|qr_auto_disabled)$/, admin: /^admin_/ };
  app.get('/api/sys/audit', ...A, (req, res) => {
    const g = String(req.query.group || 'all'), q = String(req.query.q || '').trim().toLowerCase();
    let list = (db.audit || []).slice().reverse();
    if (GROUPS[g]) list = list.filter((e) => GROUPS[g].test(e.type));
    if (q) list = list.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
    res.json(page(list, req, 30));
  });
  app.get('/api/sys/security', ...A, (req, res) => {
    const day = Date.now() - 864e5, au = db.audit || [];
    res.json({
      blockedIps: settings.get().security.blockedIps, blockedDomains: settings.get().security.blockedDomains, auto: security.autoBlocks(),
      counts: { failedLogins: au.filter((e) => e.type === 'login_failed' && e.t > day).length, autoBlocks: au.filter((e) => e.type === 'auto_block' && e.t > day).length, spam: au.filter((e) => e.type === 'spam_blocked' && e.t > day).length, reports: au.filter((e) => /^qr_(auto_disabled|reported)$/.test(e.type) && e.t > day).length },
      recent: au.filter((e) => GROUPS.security.test(e.type)).slice(-25).reverse(),
    });
  });
  const ipOf = (req) => String((req.body || {}).ip || '').trim().toLowerCase().replace(/^::ffff:/, '');
  app.post('/api/sys/security/block', auth, staff, superOnly, limit(30, 60e3), (req, res) => {
    const ip = ipOf(req); if (!/^[0-9a-f:.]{3,45}$/.test(ip)) return res.status(400).json({ error: 'Enter a valid IP address.' });
    if (ip === String(req.ip).replace(/^::ffff:/, '')) return res.status(400).json({ error: 'That is your own IP address: blocking it would lock you out.' });
    const c = settings.get().security; settings.update({ security: { blockedIps: c.blockedIps.concat(ip) } }); note(req, 'admin_block_ip', ip);
    res.json({ ok: true });
  });
  app.post('/api/sys/security/unblock', auth, staff, superOnly, limit(30, 60e3), (req, res) => {
    const ip = ipOf(req), c = settings.get().security;
    settings.update({ security: { blockedIps: c.blockedIps.filter((x) => x !== ip) } }); security.unblock(ip); note(req, 'admin_unblock_ip', ip);
    res.json({ ok: true });
  });
};
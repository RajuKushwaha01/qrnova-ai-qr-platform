'use strict';
const roles = require('./roles');

const iso = (t) => (t ? new Date(t).toISOString() : null);
const DATEKEYS = new Set(['createdAt', 'updatedAt', 'expiresAt', 'timestamp']);

/* ═══════════ mappers: JSON-database item → Part 8 record ═══════════ */
function qrStatus(it, k) {
  if (k === 'static') return it.archived ? 'archived' : 'active';
  if (k === 'file') return it.status === 'suspended' ? 'disabled' : it.archived ? 'archived' : it.expires && it.expires <= Date.now() ? 'expired' : 'active';
  return it.adminDisabled ? 'disabled' : it.archived ? 'archived' : it.active === false ? 'inactive' : it.expires && it.expires <= Date.now() ? 'expired' : 'active';
}
function strip(d) { // keep the design small in API responses
  const c = JSON.parse(JSON.stringify(d));
  if (c.logo && c.logo.img) c.logo.img = '(embedded)';
  if (c.bg && c.bg.img) c.bg.img = '(embedded)';
  return c;
}
// 8.4 — QR record. passwordHash is only ever included for migrations ({full:true}), never in API responses.
function toQr(it, o) {
  o = o || {};
  const k = it.disk ? 'file' : it.kind ? 'dyn' : 'static', d = it.design || null;
  const fg = d && d.fg && d.fg.stops && d.fg.stops[0] ? d.fg.stops[0].c : '#111827';
  const bg = d && d.bg ? (d.bg.mode === 'color' ? d.bg.color : d.bg.mode === 'transparent' ? 'transparent' : '#ffffff') : '#ffffff';
  const out = {
    _id: k === 'file' ? 'f_' + it.id : (k === 'dyn' ? 'q_' : 's_') + it.code, userId: it.uid, name: it.title, type: k === 'file' ? it.cat : it.type, mode: k === 'static' ? 'static' : 'dynamic',
    content: k === 'static' ? it.payload : k === 'file' ? it.name : it.kind === 'url' ? it.target : it.kind === 'page' ? it.data || {} : it.fileName || '',
    destinationUrl: k === 'dyn' && it.kind === 'url' ? it.target : null, shortCode: k === 'static' ? null : it.code,
    fileId: k === 'file' ? it.id : k === 'dyn' && it.file ? String(it.file).split('/').pop() : null,
    design: d ? (o.full ? d : strip(d)) : null, logo: d && d.logo && d.logo.img ? (o.full ? d.logo.img : true) : null,
    foregroundColor: fg, backgroundColor: bg, errorCorrection: (d && d.ecl) || 'M', status: qrStatus(it, k),
    isFavorite: !!it.fav, isPasswordProtected: it.access === 'password' && !!it.pw, expiresAt: iso(it.expires),
    createdAt: iso(it.created), updatedAt: iso(it.updated || it.created),
    access: k === 'static' ? 'public' : it.access || 'public', folder: it.folder || null, scans: k === 'file' ? it.views || 0 : it.scans || 0,
  };
  if (o.full) out.passwordHash = it.pw || null;
  return out;
}
// 8.5 — file record
function toFile(f) {
  return { _id: f.id, userId: f.uid, originalName: f.name, storedName: f.disk, mimeType: f.mime, size: f.size, storageKey: 'storage/' + f.disk, publicUrl: '/f/' + f.code, isPublic: f.access === 'public', expiresAt: iso(f.expires), createdAt: iso(f.created), updatedAt: iso(f.updated || f.created), category: f.cat, status: qrStatus(f, 'file') };
}
// 8.6 — scan record (no IP address, no raw user agent; the optional visitor hash is salted)
function toScan(e, qrId, i, full) {
  const s = { _id: qrId + ':' + e.t + ':' + i, qrId, timestamp: iso(e.t), device: e.c || (e.d === 'Android' || e.d === 'iOS' ? 'mobile' : 'desktop'), browser: e.b || null, os: e.o || e.d || null, region: e.g || null, referrer: e.r || null };
  if (full && e.v) s.visitor = e.v;
  return s;
}
const toUser = (u) => ({ _id: u.id, name: u.name, email: u.email, passwordHash: u.pw || null, role: roles.roleOf(u), verified: u.verified !== false, suspended: !!u.suspended, provider: u.provider || 'password', timezoneOffset: Number.isFinite(u.tz) ? u.tz : null, createdAt: iso(u.created) });

const TEMPLATES = [['restaurant', 'Restaurant', '🍽️', 'menu'], ['hotel', 'Hotel', '🏨', 'business'], ['portfolio', 'Portfolio', '💼', 'business'], ['resume', 'Resume', '📄', 'document'], ['business-card', 'Business card', '🪪', 'vcard'], ['product', 'Product', '📦', 'product'], ['event', 'Event', '🎉', 'event'], ['payment', 'Payment', '💸', 'upi'], ['wifi', 'Wi-Fi', '📶', 'wifi'], ['social', 'Social media', '📱', 'social'], ['marketing', 'Marketing', '📣', 'url'], ['education', 'Education', '🎓', 'pdf'], ['real-estate', 'Real estate', '🏡', 'business'], ['healthcare', 'Healthcare', '🩺', 'business'], ['personal', 'Personal', '🧑', 'vcard']].map(([slug, name, icon, qrType]) => ({ _id: 'tpl_' + slug, slug, name, icon, qrType }));

// everything in the database, shaped as the 11 Part 8 collections (8.3)
function collections(db) {
  const scans = [];
  const walk = (it, id) => (it.log || []).forEach((e, i) => scans.push(toScan(e, id, i, true)));
  db.qrs.forEach((q) => walk(q, 'q_' + q.code));
  db.files.forEach((f) => walk(f, 'f_' + f.id));
  const shared = [].concat(db.qrs.filter((q) => q.pubShare).map((q) => ['q_' + q.code, q]), db.files.filter((f) => f.pubShare).map((f) => ['f_' + f.id, f]))
    .map(([qrId, it]) => ({ _id: 'sl_' + it.code, qrId, userId: it.uid, url: '/s/' + it.code, enabled: true, createdAt: iso(it.updated || it.created) }));
  return {
    users: db.users.map(toUser),
    qrCodes: [].concat(db.qrs, db.files, db.statics || []).map((it) => toQr(it, { full: true })),
    files: db.files.map(toFile),
    qrScans: scans,
    aiSessions: (db.aiSessions || []).map((s) => ({ _id: s.id, userId: s.uid, title: s.title, pinned: !!s.pinned, messages: s.messages || [], createdAt: iso(s.created), updatedAt: iso(s.updated) })),
    templates: TEMPLATES,
    categories: (db.folders || []).map((f) => ({ _id: f.id, userId: f.uid, name: f.name, emoji: f.emoji })),
    shareLinks: shared,
    notifications: (db.notifications || []).map((n) => ({ _id: n.id, userId: n.uid, type: n.type, title: n.title, text: n.text, link: n.link, read: !!n.read, createdAt: iso(n.t) })),
    auditLogs: (db.audit || []).map((a) => ({ _id: a.id, type: a.type, userId: a.uid || null, ip: a.ip || null, status: a.status || null, meta: a.meta || null, email: a.email || null, createdAt: iso(a.t) })),
    adminSettings: [{ _id: 'platform', config: db.config || {}, fileRules: db.settings || {}, updatedAt: iso(Date.now()) }],
  };
}

/* ═══════════ MongoDB: validators + indexes (8.18 database indexes) ═══════════ */
const S = (props, required) => ({ bsonType: 'object', required, properties: props });
const VALIDATORS = {
  users: S({ email: { bsonType: 'string' }, role: { enum: ['user', 'admin', 'superadmin'] }, createdAt: { bsonType: 'date' } }, ['email', 'role', 'createdAt']),
  qrCodes: S({ userId: { bsonType: 'string' }, name: { bsonType: 'string' }, mode: { enum: ['static', 'dynamic'] }, status: { enum: ['active', 'inactive', 'archived', 'expired', 'disabled'] }, errorCorrection: { enum: ['L', 'M', 'Q', 'H'] } }, ['userId', 'name', 'mode', 'status', 'createdAt']),
  files: S({ userId: { bsonType: 'string' }, originalName: { bsonType: 'string' }, size: { bsonType: ['int', 'long', 'double'] } }, ['userId', 'originalName', 'storedName', 'size', 'createdAt']),
  qrScans: S({ qrId: { bsonType: 'string' }, timestamp: { bsonType: 'date' } }, ['qrId', 'timestamp']),
};
const INDEXES = {
  users: [{ key: { email: 1 }, unique: true }, { key: { createdAt: -1 } }, { key: { role: 1 } }],
  qrCodes: [{ key: { shortCode: 1 }, unique: true, sparse: true }, { key: { userId: 1, createdAt: -1 } }, { key: { userId: 1, status: 1 } }, { key: { userId: 1, isFavorite: 1 } }, { key: { expiresAt: 1 }, sparse: true }, { key: { name: 'text' } }],
  files: [{ key: { userId: 1, createdAt: -1 } }, { key: { storedName: 1 }, unique: true }, { key: { expiresAt: 1 }, sparse: true }],
  qrScans: [{ key: { qrId: 1, timestamp: -1 } }, { key: { timestamp: 1 }, expireAfterSeconds: 63072000 }], // scans are auto-deleted after 2 years
  aiSessions: [{ key: { userId: 1, updatedAt: -1 } }], templates: [{ key: { slug: 1 }, unique: true }],
  categories: [{ key: { userId: 1, name: 1 }, unique: true }], shareLinks: [{ key: { qrId: 1 } }, { key: { userId: 1 } }],
  notifications: [{ key: { userId: 1, read: 1, createdAt: -1 } }], auditLogs: [{ key: { createdAt: -1 } }, { key: { type: 1, createdAt: -1 } }, { key: { userId: 1 } }],
  adminSettings: [],
};
const dates = (d) => { const o = Object.assign({}, d); Object.keys(o).forEach((k) => { if (DATEKEYS.has(k) && typeof o[k] === 'string') o[k] = new Date(o[k]); }); return o; };
const extJson = (d) => { const o = Object.assign({}, d); Object.keys(o).forEach((k) => { if (DATEKEYS.has(k) && typeof o[k] === 'string') o[k] = { $date: o[k] }; }); return o; };

module.exports = { toQr, toFile, toScan, toUser, collections, VALIDATORS, INDEXES, TEMPLATES, dates, extJson };
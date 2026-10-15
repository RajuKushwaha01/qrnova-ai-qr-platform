'use strict';
const crypto = require('crypto');
const { db, save } = require('./db');

const MILESTONES = [10, 100, 500, 1000, 5000, 10000, 50000, 100000];
const utc = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

function add(uid, type, title, text, link) {
  db.notifications = db.notifications || [];
  db.notifications.push({ id: crypto.randomBytes(5).toString('hex'), uid, type, title, text, link: link || '', read: false, t: Date.now() });
  const mine = db.notifications.filter((n) => n.uid === uid);
  if (mine.length > 100) { const drop = new Set(mine.slice(0, mine.length - 100)); db.notifications = db.notifications.filter((n) => !drop.has(n)); }
}
function tick() {
  const now = Date.now(), soon = now + 24 * 3600e3; let changed = false;
  const check = (it, name, link, count, off) => {
    if (it.expires && it.expires > now && it.expires < soon && it.nExp !== it.expires) { it.nExp = it.expires; add(it.uid, 'expiring', 'QR code expires soon', `“${name}” expires ${utc(it.expires)}. Extend it from My QR Codes.`, link); changed = true; }
    if (it.expires && it.expires <= now && it.nExpd !== it.expires) { it.nExpd = it.expires; add(it.uid, 'expired', 'QR code expired', `“${name}” has expired and now shows an “expired” page.`, link); changed = true; }
    if (off && !it.nDis) { it.nDis = true; add(it.uid, 'disabled', 'QR code disabled', `“${name}” was disabled by a moderator, for example after reports. Contact support if this is a mistake.`, link); changed = true; }
    else if (!off && it.nDis) { it.nDis = false; changed = true; }
    const top = MILESTONES.filter((m) => count >= m).pop();
    if (top && top > (it.nMs || 0)) { it.nMs = top; add(it.uid, 'milestone', `🎉 ${top.toLocaleString()} scans`, `“${name}” reached ${top.toLocaleString()} scans.`, '/analytics'); changed = true; }
  };
  db.qrs.forEach((q) => check(q, q.title, '/my-qr-codes', q.scans || 0, !!q.adminDisabled));
  db.files.forEach((f) => check(f, f.title, '/my-files', f.views || 0, f.status === 'suspended'));
  db.users.forEach((u) => { if (!u.nWel) { u.nWel = true; add(u.id, 'welcome', `Welcome, ${u.name}!`, 'Create your first QR code, then track every scan from Analytics.', '/qr-generator'); changed = true; } });
  if (changed) save();
}

function mount(app, { auth }) {
  app.get('/api/notifications', auth, (req, res) => {
    const mine = (db.notifications || []).filter((n) => n.uid === req.user.id).sort((a, b) => b.t - a.t);
    res.json({ items: mine.slice(0, 30).map((n) => ({ id: n.id, type: n.type, title: n.title, text: n.text, link: n.link, read: n.read, t: n.t })), unread: mine.filter((n) => !n.read).length });
  });
  app.post('/api/notifications/read', auth, (req, res) => {
    const b = req.body || {};
    (db.notifications || []).forEach((n) => { if (n.uid === req.user.id && (b.all === true || n.id === b.id)) n.read = true; });
    save(); res.json({ ok: true });
  });
  app.delete('/api/notifications', auth, (req, res) => { db.notifications = (db.notifications || []).filter((n) => n.uid !== req.user.id); save(); res.json({ ok: true }); });
  setTimeout(tick, 20e3).unref();
  setInterval(tick, 5 * 60e3).unref();
}

module.exports = { mount, add };
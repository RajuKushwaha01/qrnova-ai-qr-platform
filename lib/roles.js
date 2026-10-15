'use strict';
const { db } = require('./db');

// ADMIN_EMAIL may hold several comma-separated addresses → they are Super Admins.
// With no ADMIN_EMAIL, the very first account is the Super Admin.
const list = () => (process.env.ADMIN_EMAIL || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function roleOf(u) {
  if (!u) return 'user';
  const l = list();
  if (l.length ? l.includes(String(u.email).toLowerCase()) : !!db.users[0] && db.users[0].id === u.id) return 'superadmin';
  return u.role === 'admin' ? 'admin' : 'user';
}
const isStaff = (u) => roleOf(u) !== 'user';
const isSuper = (u) => roleOf(u) === 'superadmin';

module.exports = { roleOf, isStaff, isSuper };
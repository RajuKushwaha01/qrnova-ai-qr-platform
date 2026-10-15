'use strict';
const { db, save } = require('./db');

const DEF = () => ({
  brand: { name: 'QRNova', tagline: 'Turn Anything Into a QR Code — Powered by AI', primary: '#7c5cff', accent: '#22d3ee', highlight: '#ff5ea8', logo: '', footer: '' },
  maintenance: { on: false, message: 'We are getting some upgrades. Please check back in a few minutes.' },
  signup: { open: true, requireVerified: false },
  limits: { maxDynamicQr: 100, maxStaticQr: 300, createPerHour: 120, aiPerDay: 200, apiPerMin: 600, scanPerMin: 120, uploadPerHour: 40, totalStorageMB: 0 },
  security: { sessionDays: 30, idleDays: 14, lockAfter: 8, lockMinutes: 10, minPassword: 8, autoBlock: true, strikeLimit: 40, blockMinutes: 15, blockedIps: [], blockedDomains: [], csp: 'enforce' },
  email: { from: '' },
  analytics: { region: true, referrer: true, unique: true, honorDnt: true },
});

let cache = null;
function merge(d, s) {
  if (!s || typeof s !== 'object') return d;
  Object.keys(d).forEach((k) => {
    if (s[k] === undefined) return;
    if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) merge(d[k], s[k]);
    else if (Array.isArray(d[k]) ? Array.isArray(s[k]) : typeof s[k] === typeof d[k]) d[k] = s[k];
  });
  return d;
}
const get = () => cache || (cache = merge(DEF(), db.config));

const num = (v, lo, hi, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>"]/g, '').trim().slice(0, max);
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : d);
const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const LOGO = /^(?:https:\/\/[^\s"'<>\\]{4,290}|data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+\/=]{20,200000})$/;
const IP = /^[0-9a-f:.]{3,45}$/i;
const DOM = /^(?:[a-z0-9-]+\.)+[a-z]{2,24}$/;

function update(p) {
  p = p && typeof p === 'object' ? p : {};
  const c = JSON.parse(JSON.stringify(get())), d = DEF();
  const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const B = p.brand;
  if (B) {
    if (has(B, 'name')) c.brand.name = txt(B.name, 40) || d.brand.name;
    if (has(B, 'tagline')) c.brand.tagline = txt(B.tagline, 120) || d.brand.tagline;
    ['primary', 'accent', 'highlight'].forEach((k) => { if (has(B, k)) c.brand[k] = hex(B[k], c.brand[k]); });
    if (has(B, 'logo')) { const l = String(B.logo || '').trim(); if (!l) c.brand.logo = ''; else if (LOGO.test(l)) c.brand.logo = l; }
    if (has(B, 'footer')) c.brand.footer = txt(B.footer, 120);
  }
  const M = p.maintenance;
  if (M) { if (has(M, 'on')) c.maintenance.on = bool(M.on); if (has(M, 'message')) c.maintenance.message = txt(M.message, 200) || d.maintenance.message; }
  const S = p.signup;
  if (S) { if (has(S, 'open')) c.signup.open = bool(S.open); if (has(S, 'requireVerified')) c.signup.requireVerified = bool(S.requireVerified); }
  const L = p.limits;
  if (L) [['maxDynamicQr', 1, 100000], ['maxStaticQr', 1, 100000], ['createPerHour', 1, 100000], ['aiPerDay', 1, 100000], ['apiPerMin', 30, 100000], ['scanPerMin', 10, 100000], ['uploadPerHour', 1, 100000], ['totalStorageMB', 0, 10000000]].forEach(([k, lo, hi]) => { if (has(L, k)) c.limits[k] = num(L[k], lo, hi, c.limits[k]); });
  const X = p.security;
  if (X) {
    [['sessionDays', 1, 365], ['idleDays', 1, 365], ['lockAfter', 3, 50], ['lockMinutes', 1, 1440], ['minPassword', 6, 64], ['strikeLimit', 5, 1000], ['blockMinutes', 1, 10080]].forEach(([k, lo, hi]) => { if (has(X, k)) c.security[k] = num(X[k], lo, hi, c.security[k]); });
    if (has(X, 'autoBlock')) c.security.autoBlock = bool(X.autoBlock);
    if (has(X, 'csp') && ['enforce', 'report', 'off'].includes(X.csp)) c.security.csp = X.csp;
    if (has(X, 'blockedIps') && Array.isArray(X.blockedIps)) c.security.blockedIps = [...new Set(X.blockedIps.map((v) => String(v).trim().toLowerCase()).filter((v) => IP.test(v)))].slice(0, 200);
    if (has(X, 'blockedDomains') && Array.isArray(X.blockedDomains)) c.security.blockedDomains = [...new Set(X.blockedDomains.map((v) => String(v).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter((v) => DOM.test(v)))].slice(0, 200);
  }
  const E = p.email;
  if (E && has(E, 'from')) { const f = String(E.from || '').replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, 120); c.email.from = !f || /[^\s@<>]+@[^\s@<>]+/.test(f) ? f : c.email.from; }
  const A = p.analytics;
  if (A) ['region', 'referrer', 'unique', 'honorDnt'].forEach((k) => { if (has(A, k)) c.analytics[k] = bool(A[k]); });
  db.config = c; cache = null; save();
  return get();
}

module.exports = { get, update, defaults: DEF };
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, save } = require('./db');
const mailer = require('./mailer');
const fsx = require('./filestore');
const cfg = () => require('./settings').get();

const UPLOADS = require('./paths').UPLOADS;
const PROD = process.env.NODE_ENV === 'production';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const rid = () => crypto.randomBytes(6).toString('hex');
const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
// same format as the original auth, so existing accounts keep working
const hashPw = (pw) => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex'); };
const checkPw = (pw, stored) => { try { const [salt, h] = String(stored).split(':'); const x = crypto.scryptSync(String(pw), salt, 64), y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); } catch (e) { return false; } };
const pwProblem = (pw, email) => (pw.length < cfg().security.minPassword ? 'Password must be at least ' + cfg().security.minPassword + ' characters.' : pw.length > 100 ? 'Password is too long (max 100).' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Use at least one letter and one number.' : email && pw.toLowerCase() === email ? 'Password cannot be your email address.' : null);

function describe(ua) {
  ua = String(ua || '');
  const br = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Browser';
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Unknown OS';
  return `${br} on ${os}`;
}
const mask = (ip) => { ip = String(ip || '').replace(/^::ffff:/, ''); return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split('.').slice(0, 2).join('.') + '.x.x' : ip.split(':').slice(0, 2).join(':') + '::'; };
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, verified: u.verified !== false, provider: u.provider || 'password', hasPassword: !!u.pw, created: u.created, role: require('./roles').roleOf(u) });

function newSession(req, user) {
  const s = { token: crypto.randomBytes(32).toString('hex'), id: rid(), uid: user.id, exp: Date.now() + cfg().security.sessionDays * 864e5, created: Date.now(), last: Date.now(), ip: mask(req.ip), dev: describe(req.headers['user-agent']) };
  db.sessions = db.sessions.filter((x) => x.exp > Date.now());
  const mine = db.sessions.filter((x) => x.uid === user.id);
  if (mine.length >= 15) { const old = mine.sort((a, b) => (a.last || a.created || 0) - (b.last || b.created || 0)).slice(0, mine.length - 14); db.sessions = db.sessions.filter((x) => !old.includes(x)); }
  db.sessions.push(s); save();
  return s;
}

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const s = t && db.sessions.find((x) => x.token === t && x.exp > Date.now() && Date.now() - (x.last || x.created || x.exp - 2592e6) < cfg().security.idleDays * 864e5);
  if (!s) return res.status(401).json({ error: 'Please log in to continue.' });
  const u = db.users.find((x) => x.id === s.uid);
  if (!u) return res.status(401).json({ error: 'Account not found. Please log in again.' });
  if (u.suspended) return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });
  if (!s.id) s.id = rid();
  if (Date.now() - (s.last || 0) > 5 * 60e3) { s.last = Date.now(); save(); }
  req.user = u; req.session = s; req.token = t;
  next();
}

// one-time tokens: only a SHA-256 hash is stored
function issue(u, k) { const raw = crypto.randomBytes(24).toString('base64url'); u[k + 'Tok'] = sha(raw); u[k + 'Exp'] = Date.now() + (k === 'v' ? 48 : 1) * 3600e3; return raw; }
function take(k, raw) { if (!raw || typeof raw !== 'string' || raw.length > 80) return null; const h = sha(raw); return db.users.find((u) => u[k + 'Tok'] === h && u[k + 'Exp'] > Date.now()) || null; }

function mount(app, { limit, base }) {
  ['history', 'folders', 'designs', 'aiSessions', 'statics'].forEach((k) => { db[k] = db[k] || []; });
  const devLink = (url) => (!mailer.real && !PROD ? url : undefined);

  async function sendVerify(req, u) {
    const raw = issue(u, 'v'); save();
    const url = base(req) + '/verify-email?token=' + raw;
    try { await mailer.send({ to: u.email, subject: 'Verify your QRNova email', title: `Welcome, ${u.name}!`, lines: ['Confirm your email address to secure your account and enable password recovery.', 'This link works for 48 hours.'], cta: { label: 'Verify email', url } }); }
    catch (e) { console.error('Mail failed:', e.message); }
    return url;
  }

  /* ---------- register / login / logout ---------- */
  app.post('/api/auth/signup', limit(10, 60e3), async (req, res) => {
    const b = req.body || {}, name = String(b.name || '').trim().slice(0, 60), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
    if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const pp = pwProblem(pw, email); if (pp) return res.status(400).json({ error: pp });
    if (db.users.some((u) => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const u = { id: crypto.randomUUID(), name, email, pw: hashPw(pw), created: Date.now(), verified: false };
    db.users.push(u);
    const url = await sendVerify(req, u);
    const s = newSession(req, u);
    res.json({ token: s.token, user: pub(u), devLink: devLink(url) });
  });

  app.post('/api/auth/login', limit(15, 60e3), (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase(), u = db.users.find((x) => x.email === email);
    const bad = () => res.status(401).json({ error: 'Incorrect email or password.' });
    if (!u || !u.pw) return bad();
    if (u.suspended) return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });
    if (u.lock && u.lock > Date.now()) return res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil((u.lock - Date.now()) / 60e3)} min.` });
    if (!checkPw(String((req.body || {}).password || ''), u.pw)) { u.fails = (u.fails || 0) + 1; if (u.fails >= cfg().security.lockAfter) { u.lock = Date.now() + cfg().security.lockMinutes * 60e3; u.fails = 0; } save(); return bad(); }
    u.fails = 0; u.lock = 0;
    const s = newSession(req, u);
    res.json({ token: s.token, user: pub(u) });
  });

  app.get('/api/auth/me', auth, (req, res) => res.json({ user: pub(req.user), session: { id: req.session.id } }));
  app.post('/api/auth/logout', auth, (req, res) => { db.sessions = db.sessions.filter((s) => s.token !== req.token); save(); res.json({ ok: true }); });

  /* ---------- email verification ---------- */
  app.post('/api/auth/verify', limit(20, 60e3), (req, res) => {
    const u = take('v', (req.body || {}).token);
    if (!u) return res.status(400).json({ error: 'This verification link is invalid or has expired. Request a new one from your account page.' });
    u.verified = true; u.vTok = null; u.vExp = 0; save();
    res.json({ ok: true, email: u.email });
  });
  app.post('/api/auth/resend-verification', auth, limit(5, 600e3), async (req, res) => {
    if (req.user.verified !== false) return res.json({ ok: true, already: true });
    const url = await sendVerify(req, req.user);
    res.json({ ok: true, devLink: devLink(url) });
  });

  /* ---------- forgot / reset ---------- */
  app.post('/api/auth/forgot', limit(5, 600e3), async (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase(), u = db.users.find((x) => x.email === email);
    let url;
    if (u) {
      const raw = issue(u, 'r'); save();
      url = base(req) + '/reset-password?token=' + raw;
      try { await mailer.send({ to: u.email, subject: 'Reset your QRNova password', title: 'Reset your password', lines: ['We received a request to reset your password.', 'This link works for 1 hour. If you did not ask for it, you can ignore this email.'], cta: { label: 'Choose a new password', url } }); }
      catch (e) { console.error('Mail failed:', e.message); }
    }
    res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.', devLink: devLink(url) });
  });
  app.post('/api/auth/reset', limit(10, 600e3), (req, res) => {
    const b = req.body || {}, u = take('r', b.token);
    if (!u) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    const pw = String(b.password || ''), pp = pwProblem(pw, u.email); if (pp) return res.status(400).json({ error: pp });
    u.pw = hashPw(pw); u.rTok = null; u.rExp = 0; u.fails = 0; u.lock = 0;
    if (u.verified === false) u.verified = true; // the emailed link proves they own the address
    db.sessions = db.sessions.filter((s) => s.uid !== u.id); // log out everywhere
    save(); res.json({ ok: true });
  });

  /* ---------- profile, password, sessions ---------- */
  app.put('/api/account', auth, limit(30, 60e3), (req, res) => {
    const name = String((req.body || {}).name || '').trim().slice(0, 60);
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
    req.user.name = name; save(); res.json({ user: pub(req.user) });
  });
  app.post('/api/account/password', auth, limit(10, 600e3), (req, res) => {
    const b = req.body || {}, u = req.user;
    if (u.pw && !checkPw(String(b.current || ''), u.pw)) return res.status(401).json({ error: 'Your current password is incorrect.' });
    const pw = String(b.password || ''), pp = pwProblem(pw, u.email); if (pp) return res.status(400).json({ error: pp });
    u.pw = hashPw(pw);
    db.sessions = db.sessions.filter((s) => s.uid !== u.id || s.token === req.token); // other devices are logged out
    save(); res.json({ ok: true });
  });
  app.get('/api/account/sessions', auth, (req, res) => {
    const items = db.sessions.filter((s) => s.uid === req.user.id && s.exp > Date.now()).map((s) => {
      if (!s.id) s.id = rid();
      return { id: s.id, device: s.dev || 'Unknown device', ip: s.ip || '', created: s.created || null, last: s.last || s.created || null, current: s.token === req.token };
    }).sort((a, b) => (b.last || 0) - (a.last || 0));
    res.json({ items });
  });
  app.delete('/api/account/sessions/:id', auth, (req, res) => {
    const s = db.sessions.find((x) => x.uid === req.user.id && x.id === req.params.id);
    if (!s) return res.status(404).json({ error: 'Session not found.' });
    db.sessions = db.sessions.filter((x) => x !== s); save();
    res.json({ ok: true, self: s.token === req.token });
  });
  app.post('/api/account/sessions/revoke-others', auth, (req, res) => {
    db.sessions = db.sessions.filter((s) => s.uid !== req.user.id || s.token === req.token); save();
    res.json({ ok: true });
  });

  /* ---------- data export + account deletion ---------- */
  app.get('/api/account/export', auth, limit(5, 600e3), (req, res) => {
    const uid = req.user.id, mine = (a) => (a || []).filter((x) => x.uid === uid);
    res.setHeader('Content-Disposition', 'attachment; filename="qrnova-data.json"');
    res.json({
      exported: new Date().toISOString(), user: pub(req.user),
      qrCodes: mine(db.qrs).map(({ log, pw, agg, uv, reporters, ...r }) => r), staticQr: mine(db.statics).map(({ log, ...r }) => r),
      files: mine(db.files).map(({ log, pw, disk, reporters, agg, uv, ...r }) => r), designs: mine(db.designs), folders: mine(db.folders), history: mine(db.history),
    });
  });
  app.delete('/api/account', auth, limit(5, 600e3), (req, res) => {
    const u = req.user, b = req.body || {}, uid = u.id;
    if (u.pw) { if (!checkPw(String(b.password || ''), u.pw)) return res.status(401).json({ error: 'Password is incorrect.' }); }
    else if (String(b.confirm || '').trim().toLowerCase() !== u.email) return res.status(400).json({ error: 'Type your email address to confirm.' });
    if (!process.env.ADMIN_EMAIL && db.users[0] && db.users[0].id === uid && db.users.length > 1) return res.status(400).json({ error: 'This is the admin account. Start the server with ADMIN_EMAIL set to another account first, otherwise admin rights would pass to the next user.' });
    db.qrs.filter((q) => q.uid === uid).forEach((q) => { if (q.file && q.file.startsWith('/files/')) fs.unlink(path.join(UPLOADS, path.basename(q.file)), () => {}); });
    db.files.filter((f) => f.uid === uid).forEach((f) => fs.unlink(path.join(fsx.STORAGE, f.disk), () => {}));
    ['qrs', 'files', 'statics', 'designs', 'aiSessions', 'history', 'folders', 'sessions', 'notifications'].forEach((k) => { db[k] = (db[k] || []).filter((x) => x.uid !== uid); });
    db.users = db.users.filter((x) => x.id !== uid);
    save(); res.json({ ok: true });
  });

  /* ---------- optional OAuth (enabled only when the env vars are set) ---------- */
  const OA = {
    google: { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile', info: 'https://openidconnect.googleapis.com/v1/userinfo' },
    github: { id: process.env.GITHUB_CLIENT_ID, secret: process.env.GITHUB_CLIENT_SECRET, auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email', info: 'https://api.github.com/user' },
  };
  const jsq = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
  const done = (token, user) => `<!doctype html><meta charset="utf-8"><title>Signing you in…</title><body style="background:#07071a;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh">Signing you in…<script>try{localStorage.setItem('qrn_token',${jsq(token)});localStorage.setItem('qrn_user',${jsq(JSON.stringify(user))})}catch(e){}location.replace('/dashboard')</script>`;
  app.get('/api/auth/providers', (req, res) => res.json({ google: !!(OA.google.id && OA.google.secret), github: !!(OA.github.id && OA.github.secret) }));
  app.get('/auth/:p', (req, res) => {
    const o = OA[req.params.p];
    if (!o || !o.id || !o.secret) return res.redirect('/login?error=' + encodeURIComponent('That sign-in method is not configured.'));
    const st = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `qro_state=${st}; Path=/auth; Max-Age=600; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`);
    res.redirect(o.auth + '?' + new URLSearchParams({ client_id: o.id, redirect_uri: base(req) + '/auth/' + req.params.p + '/callback', response_type: 'code', scope: o.scope, state: st }));
  });
  app.get('/auth/:p/callback', async (req, res) => {
    const p = req.params.p, o = OA[p], fail = (m) => res.redirect('/login?error=' + encodeURIComponent(m));
    if (!o || !o.id || !o.secret) return fail('That sign-in method is not configured.');
    const ck = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith('qro_state='));
    if (!ck || !req.query.state || ck.slice(10) !== String(req.query.state) || !req.query.code) return fail('Sign-in was cancelled or expired.');
    try {
      const tr = await fetch(o.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ client_id: o.id, client_secret: o.secret, code: String(req.query.code), redirect_uri: base(req) + '/auth/' + p + '/callback', grant_type: 'authorization_code' }) });
      const tj = await tr.json(); if (!tj.access_token) return fail('Could not complete sign-in.');
      const H = { Authorization: 'Bearer ' + tj.access_token, Accept: 'application/json', 'User-Agent': 'QRNova' };
      const ui = await (await fetch(o.info, { headers: H })).json();
      let email = String(ui.email || '').toLowerCase(), verified = p === 'google' ? ui.email_verified !== false : false;
      const name = ui.name || ui.login || '';
      if (p === 'github') { const em = await (await fetch('https://api.github.com/user/emails', { headers: H })).json(); const e = Array.isArray(em) && (em.find((x) => x.primary && x.verified) || em.find((x) => x.verified)); if (e) { email = String(e.email).toLowerCase(); verified = true; } }
      if (!emailOk(email) || !verified) return fail('Your ' + p + ' account has no verified email address.');
      let u = db.users.find((x) => x.email === email);
      if (!u) { u = { id: crypto.randomUUID(), name: String(name || email.split('@')[0]).slice(0, 60), email, pw: null, created: Date.now(), verified: true, provider: p }; db.users.push(u); }
      else if (u.verified === false) u.verified = true;
      if (u.suspended) return fail('This account has been suspended. Please contact support.');
      const s = newSession(req, u);
      res.setHeader('Set-Cookie', 'qro_state=; Path=/auth; Max-Age=0');
      res.send(done(s.token, pub(u)));
    } catch (e) { fail('Sign-in failed. Please try again.'); }
  });
}

module.exports = { mount, auth, hashPw, checkPw };
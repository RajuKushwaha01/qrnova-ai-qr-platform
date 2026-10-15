'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, PNG, UA, sleep, form } = require('./helpers');

let app, admin, ana;
before(async () => { app = await start(); admin = await app.signup('admin@test.local'); ana = await app.signup('ana@test.local'); });
after(async () => { if (app) await app.stop(); });
const phone = { 'User-Agent': UA.android, 'Accept-Language': 'en-IN,en;q=0.9' };

test('health, readiness and request ids', async () => {
  for (const p of ['/healthz', '/readyz', '/api/health']) { const r = await app.req(p); assert.equal(r.status, 200, p); assert.equal(r.json.ok, true); }
  assert.match((await app.req('/healthz')).headers.get('x-request-id') || '', /^[0-9a-f]{12}$/);
  const nf = await app.req('/api/definitely-missing'); assert.equal(nf.status, 404); assert.ok(nf.json.error);
});

test('every public and app page renders', async () => {
  const pages = ['/', '/about', '/features', '/qr-generator', '/ai-qr', '/design-studio', '/file-to-qr', '/templates', '/pricing', '/faq', '/contact', '/blog', '/privacy', '/terms', '/security', '/cookies', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/dashboard', '/my-qr-codes', '/my-files', '/analytics', '/account', '/admin'];
  for (const p of pages) { const r = await app.req(p); assert.equal(r.status, 200, p); assert.match(r.text, /<title>/, p); assert.match(r.text, /\/js\/ui\.js/, p + ' loads the UI layer'); }
  const nf = await app.req('/definitely-not-here'); assert.equal(nf.status, 404); assert.match(nf.text, /wandered off/);
});

test('SEO: sitemap, robots, canonical, Open Graph, JSON-LD, noindex', async () => {
  const s = await app.req('/sitemap.xml'); assert.equal(s.status, 200); assert.match(s.text, /<urlset/); assert.match(s.text, /\/qr-generator/);
  assert.match((await app.req('/robots.txt')).text, /Sitemap:/);
  const h = await app.req('/');
  assert.match(h.text, /rel="canonical"/); assert.match(h.text, /property="og:title"/); assert.match(h.text, /name="twitter:card"/); assert.match(h.text, /application\/ld\+json/);
  assert.match((await app.req('/dashboard')).text, /noindex/);
  assert.match((await app.req('/faq')).text, /FAQPage/);
});

test('static assets and the QR image API', async () => {
  assert.match((await app.req('/css/style.css')).headers.get('content-type'), /css/);
  assert.equal((await app.req('/js/core.js')).status, 200);
  const svg = await app.req('/api/qr.svg?data=Hello%20QR'); assert.equal(svg.status, 200); assert.match(svg.headers.get('content-type'), /svg/); assert.match(svg.text, /<svg/);
  const png = await app.req('/api/qr.png?data=Hello&size=300'); assert.equal(png.status, 200); assert.equal(png.buf[0], 0x89); assert.equal(png.buf.slice(1, 4).toString(), 'PNG');
  assert.equal((await app.req('/api/qr.png')).status, 400);
});

test('QR engine: matrix, unicode, size limit', async () => {
  let r = await app.req('/api/qr/matrix', { body: { text: 'Héllo 😀 世界', ecl: 'Q' } });
  assert.equal(r.status, 200); assert.ok(r.json.size >= 21); assert.equal(r.json.rows.length, r.json.size);
  r = await app.req('/api/qr/matrix', { body: { text: 'x'.repeat(3500), ecl: 'H' } }); assert.equal(r.status, 400); assert.match(r.json.error, /too long/i);
});

test('auth: register → verify → login → change password → logout', async () => {
  const u = await app.signup('flow@test.local', 'Flow');
  assert.ok(u.devLink, 'dev mode returns the verification link');
  const tok = new URL(u.devLink).searchParams.get('token');
  assert.equal((await app.req('/api/auth/verify-email', { body: { token: tok } })).status, 200);
  assert.equal((await app.req('/api/auth/verify-email', { body: { token: tok } })).status, 400, 'verification links are single-use');
  assert.equal((await app.req('/api/auth/me', { token: u.token })).json.user.verified, true);
  assert.equal((await app.req('/api/auth/login', { body: { email: 'flow@test.local', password: 'wrong' } })).status, 401);
  let r = await app.req('/api/auth/login', { body: { email: 'flow@test.local', password: 'Passw0rd9' } }); assert.equal(r.status, 200);
  const t2 = r.json.token;
  assert.equal((await app.req('/api/account/password', { token: t2, body: { current: 'Passw0rd9', password: 'NewPassw0rd1' } })).status, 200);
  assert.equal((await app.req('/api/auth/me', { token: u.token })).status, 401, 'other devices are logged out after a password change');
  assert.equal((await app.req('/api/auth/logout', { token: t2, method: 'POST' })).status, 200);
  assert.equal((await app.req('/api/auth/me', { token: t2 })).status, 401);
});

test('password reset: single-use token, no account enumeration', async () => {
  const u = await app.signup('reset@test.local', 'Reset');
  let r = await app.req('/api/auth/forgot-password', { body: { email: 'reset@test.local' } }); assert.equal(r.status, 200);
  const tok = new URL(r.json.devLink).searchParams.get('token');
  r = await app.req('/api/auth/forgot-password', { body: { email: 'nobody@test.local' } }); assert.equal(r.status, 200); assert.equal(r.json.devLink, undefined);
  assert.equal((await app.req('/api/auth/reset-password', { body: { token: tok, password: 'Another1Pass' } })).status, 200);
  assert.equal((await app.req('/api/auth/reset-password', { body: { token: tok, password: 'Another1Pass' } })).status, 400);
  assert.equal((await app.req('/api/auth/me', { token: u.token })).status, 401);
  assert.equal((await app.req('/api/auth/login', { body: { email: 'reset@test.local', password: 'Another1Pass' } })).status, 200);
});

test('dynamic QR: create → scan → update → deactivate → password → expiry → duplicate → delete', async () => {
  const T = ana.token;
  let r = await app.req('/api/qr', { token: T, body: { name: 'Promo', mode: 'dynamic', type: 'url', destinationUrl: 'https://example.com/a' } });
  assert.equal(r.status, 200, r.text);
  const code = r.json.shortCode; assert.ok(code); assert.equal(r.json.mode, 'dynamic'); assert.equal(r.json.passwordHash, undefined);

  r = await app.req('/qr/' + code, { redirect: 'manual', headers: phone });           // 8.8: /qr/:shortCode
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), 'https://example.com/a');
  await app.req('/q/' + code, { redirect: 'manual', headers: { 'User-Agent': UA.bot } }); // link-preview bots are not counted
  const a = await app.req('/api/analytics/' + code, { token: T });
  assert.equal(a.json.total, 1); assert.equal(a.json.devices.mobile, 1); assert.equal(a.json.browsers.Chrome, 1); assert.equal(a.json.os.Android, 1); assert.equal(a.json.regions.IN, 1);
  const sc = await app.req('/api/analytics/' + code + '/scans', { token: T }); assert.equal(sc.json.items.length, 1); assert.equal(sc.json.items[0].ip, undefined);

  r = await app.req('/api/qr/q_' + code, { method: 'PUT', token: T, body: { destinationUrl: 'https://example.org/b', isFavorite: true } });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.isFavorite, true);
  assert.equal((await app.req('/q/' + code, { redirect: 'manual', headers: phone })).headers.get('location'), 'https://example.org/b');

  assert.equal((await app.req(`/api/qr/q_${code}/deactivate`, { method: 'POST', token: T })).status, 200);
  r = await app.req('/q/' + code, { redirect: 'manual', headers: phone }); assert.equal(r.status, 403); assert.match(r.text, /inactive/i);
  await app.req(`/api/qr/q_${code}/activate`, { method: 'POST', token: T });
  assert.equal((await app.req('/q/' + code, { redirect: 'manual', headers: phone })).status, 302);

  r = await app.req('/api/qr/q_' + code, { method: 'PUT', token: T, body: { isPasswordProtected: true, password: 'secret1' } }); assert.equal(r.status, 200, r.text);
  r = await app.req('/q/' + code, { headers: phone }); assert.equal(r.status, 200); assert.match(r.text, /Password required/);
  assert.equal((await app.req(`/q/${code}/unlock`, { body: { password: 'nope' } })).status, 401);
  r = await app.req(`/q/${code}/unlock`, { body: { password: 'secret1' } }); assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await app.req('/q/' + code, { redirect: 'manual', headers: Object.assign({ Cookie: cookie }, phone) })).status, 302);
  await app.req('/api/qr/q_' + code, { method: 'PUT', token: T, body: { isPasswordProtected: false } });

  r = await app.req('/api/qr/q_' + code, { method: 'PUT', token: T, body: { expiresAt: new Date(Date.now() + 1500).toISOString() } }); assert.equal(r.status, 200, r.text);
  await sleep(1900);
  r = await app.req('/q/' + code, { redirect: 'manual', headers: phone }); assert.equal(r.status, 410); assert.match(r.text, /expired/i);
  assert.equal((await app.req('/api/qr/q_' + code, { method: 'PUT', token: T, body: { expiresAt: null } })).status, 200);
  assert.equal((await app.req('/q/' + code, { redirect: 'manual', headers: phone })).status, 302);

  r = await app.req(`/api/qr/q_${code}/duplicate`, { method: 'POST', token: T }); assert.equal(r.status, 200); assert.notEqual(r.json.code, code);
  const list = await app.req('/api/qr?page=1&limit=5&format=spec', { token: T });
  assert.equal(list.status, 200); assert.ok(list.json.total >= 2); assert.ok(list.json.items[0]._id && list.json.items[0].userId && list.json.items[0].status);

  const folders = await app.req('/api/folders', { token: T }); assert.equal(folders.json.items.length, 8);
  assert.equal((await app.req(`/api/qr/q_${code}/settings`, { method: 'PUT', token: T, body: { folder: folders.json.items[0].id } })).status, 200);

  assert.equal((await app.req('/api/qr/q_' + code, { method: 'DELETE', token: T })).status, 200);
  assert.equal((await app.req('/q/' + code, { headers: phone })).status, 404);
});

test('static QR saved through the Part 8 API', async () => {
  let r = await app.req('/api/qr', { token: ana.token, body: { name: 'Hello', mode: 'static', type: 'text', content: 'Hello world' } });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.mode, 'static'); assert.match(r.json._id, /^s_/);
  r = await app.req('/api/qr/' + r.json._id + '?format=spec', { token: ana.token }); assert.equal(r.json.content, 'Hello world');
});

test('public share page and sharing', async () => {
  let r = await app.req('/api/qr', { token: ana.token, body: { name: 'Shared', mode: 'dynamic', type: 'url', destinationUrl: 'https://example.com/share' } });
  const code = r.json.shortCode;
  assert.equal((await app.req('/s/' + code)).status, 404, 'private until the owner switches it on');
  assert.equal((await app.req(`/api/qr/q_${code}/public-share`, { token: ana.token, body: { on: true } })).json.on, true);
  r = await app.req('/s/' + code); assert.equal(r.status, 200); assert.match(r.text, /<svg/); assert.match(r.text, /Powered by/); assert.match(r.text, /WhatsApp/);
  await app.req(`/api/qr/q_${code}/public-share`, { token: ana.token, body: { on: false } });
  assert.equal((await app.req('/s/' + code)).status, 404);
  r = await app.req(`/api/qr/q_${code}/share-link`, { token: ana.token, body: { minutes: 30 } }); assert.match(r.json.url, /\/q\/.+\?t=/);
});

test('file hosting: upload, viewer page, raw file, content validation', async () => {
  let r = await app.req('/api/files/upload', { token: ana.token, body: form('pixel.png', PNG, 'image/png', { title: 'Pixel', access: 'public' }) });
  assert.equal(r.status, 200, r.text); const { id, code } = r.json;
  r = await app.req('/f/' + code, { headers: phone }); assert.equal(r.status, 200); assert.match(r.text, /Download/); assert.match(r.text, /Powered by/);
  r = await app.req(`/f/${code}/raw`); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /image\/png/); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await app.req('/api/analytics/f_' + id, { token: ana.token })).json.total, 1);
  r = await app.req('/api/files/' + id, { token: ana.token }); assert.equal(r.json.originalName, 'pixel.png'); assert.ok(r.json.storageKey && r.json.mimeType);
  r = await app.req('/api/files/upload', { token: ana.token, body: form('fake.png', Buffer.from('this is not an image'), 'image/png') }); assert.equal(r.status, 400); assert.match(r.json.error, /match/i);
  r = await app.req('/api/files/upload', { token: ana.token, body: form('tool.exe', Buffer.from('MZ'), 'application/octet-stream') }); assert.equal(r.status, 400);
  assert.equal((await app.req('/api/files/' + id, { method: 'DELETE', token: ana.token })).status, 200);
});

test('AI endpoints (local engine, no API key)', async () => {
  const T = ana.token, ai = (p, body) => app.req('/api/ai/' + p, { token: T, body });
  assert.equal((await ai('detect', { text: 'someone@example.com' })).json.type, 'email');
  assert.equal((await ai('detect', { text: 'https://example.com' })).json.type, 'url');
  const parse = await ai('parse', { text: 'Call +91 98765 43210 or visit example.com' }); assert.equal(parse.json.phones.length, 1); assert.ok(parse.json.urls.length >= 1);
  const val = await ai('validate', { type: 'email', fields: { to: 'jane@gmial.com' } }); assert.ok(val.json.issues.some((i) => /gmail/.test(i.msg)));
  assert.equal((await ai('validate', { type: 'nonsense', fields: {} })).status, 400);
  const gen = await ai('generate', { text: 'Wi-Fi network Cafe_Guest password coffee1234' });
  assert.equal(gen.json.type, 'wifi'); assert.match(gen.json.payload, /^WIFI:/); assert.ok(gen.json.qr.modules >= 21);
  assert.ok((await ai('recommend', { type: 'url', fields: { url: 'example.com' }, text: 'print on a poster' })).json.ecl);
  assert.ok((await ai('design', { text: 'make it professional for a hotel' })).json.style);
  assert.ok((await app.req('/api/ai/types', { token: T })).json.items.length > 10);
});

test('analytics overview, CSV export, notifications, brand designs', async () => {
  const o = await app.req('/api/analytics/overview?days=7', { token: ana.token }); assert.equal(o.status, 200); assert.ok(o.json.series.counts.length === 7);
  const csv = await app.req('/api/analytics/export?id=all&days=7', { token: ana.token }); assert.match(csv.headers.get('content-type'), /csv/); assert.match(csv.text, /Date,Scans/);
  const n = await app.req('/api/notifications', { token: ana.token }); assert.ok(Array.isArray(n.json.items)); assert.equal(typeof n.json.unread, 'number');
  assert.equal((await app.req('/api/designs', { token: ana.token, body: { name: 'Brand', design: { fg: { type: 'solid', stops: [{ o: 0, c: '#111827' }] } } } })).status, 200);
});

test('admin: overview, aliases, suspend / activate, branding, maintenance, backups, errors, metrics', async () => {
  const A = admin.token;
  assert.ok((await app.req('/api/sys/overview?tz=0', { token: A })).json.counts.users >= 4);
  let r = await app.req('/api/admin/users', { token: A }); assert.equal(r.status, 200); assert.ok(r.json.items.length >= 4);
  assert.equal((await app.req('/api/admin/users', { token: ana.token })).status, 403);

  assert.equal((await app.req('/api/admin/users/' + ana.user.id, { method: 'PUT', token: A, body: { suspended: true, reason: 'test' } })).status, 200);
  assert.equal((await app.req('/api/qr', { token: ana.token })).status, 401, 'sessions end when a user is suspended');
  assert.equal((await app.req('/api/auth/login', { body: { email: 'ana@test.local', password: 'Passw0rd9' } })).status, 403);
  await app.req('/api/admin/users/' + ana.user.id, { method: 'PUT', token: A, body: { suspended: false } });
  r = await app.req('/api/auth/login', { body: { email: 'ana@test.local', password: 'Passw0rd9' } }); assert.equal(r.status, 200); ana.token = r.json.token;

  assert.equal((await app.req('/api/sys/config', { method: 'PUT', token: A, body: { brand: { name: 'Acme QR' } } })).status, 200);
  assert.match((await app.req('/')).text, /Acme QR/);
  await app.req('/api/sys/config', { method: 'PUT', token: A, body: { brand: { name: 'QRNova' } } });

  await app.req('/api/sys/config', { method: 'PUT', token: A, body: { maintenance: { on: true, message: 'Back soon' } } });
  r = await app.req('/'); assert.equal(r.status, 503); assert.match(r.text, /Back soon/);
  assert.equal((await app.req('/login')).status, 200); assert.equal((await app.req('/api/health')).status, 200);
  await app.req('/api/sys/config', { method: 'PUT', token: A, body: { maintenance: { on: false } } });
  assert.equal((await app.req('/')).status, 200);

  r = await app.req('/api/sys/backups', { token: A, method: 'POST' }); assert.equal(r.status, 200); assert.match(r.json.name, /\.json\.gz$/);
  assert.ok((await app.req('/api/sys/backups', { token: A })).json.items.some((b) => b.name === r.json.name));

  assert.equal((await app.req('/api/client-error', { body: { message: 'boom from the browser' } })).status, 204);
  assert.ok((await app.req('/api/sys/errors', { token: A })).json.items.some((e) => /boom from the browser/.test(e.msg)));

  const m = await app.req('/metrics'); assert.equal(m.status, 200); assert.match(m.text, /qrnova_http_requests_total/); assert.match(m.text, /qrnova_users_total/);
});
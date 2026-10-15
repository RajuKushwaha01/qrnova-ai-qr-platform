'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, PNG, UA, form } = require('./helpers');

let app, admin, ana, ben;
before(async () => { app = await start(); admin = await app.signup('admin@test.local'); ana = await app.signup('ana@test.local'); ben = await app.signup('ben@test.local'); });
after(async () => { if (app) await app.stop(); });
const newQr = async (token, url) => (await app.req('/api/qr', { token, body: { name: 'Mine', mode: 'dynamic', type: 'url', destinationUrl: url || 'https://example.com/x' } })).json;

test('anonymous callers are rejected everywhere (8.22: unauthorized API access)', async () => {
  const calls = [['GET', '/api/qr'], ['GET', '/api/files'], ['GET', '/api/analytics'], ['GET', '/api/account/sessions'], ['GET', '/api/notifications'], ['GET', '/api/sys/overview'], ['GET', '/api/dynamic'], ['GET', '/api/folders'], ['GET', '/api/designs'], ['GET', '/api/ai/sessions'], ['GET', '/api/qr/q_abc'], ['POST', '/api/qr'], ['POST', '/api/files/upload'], ['POST', '/api/ai/detect'], ['DELETE', '/api/account'], ['PUT', '/api/sys/config']];
  for (const [m, p] of calls) assert.equal((await app.req(p, { method: m, body: m === 'GET' ? undefined : {} })).status, 401, m + ' ' + p);
});

test('invalid, forged and oversized tokens (8.22: invalid JWT/session)', async () => {
  for (const t of ['garbage', 'null', 'a'.repeat(5000), '0'.repeat(64)]) assert.equal((await app.req('/api/qr', { headers: { Authorization: 'Bearer ' + t } })).status, 401);
  assert.equal((await app.req('/api/qr', { headers: { Authorization: 'Bearer ' } })).status, 401);
  assert.equal((await app.req('/api/qr', { headers: { Authorization: ana.token } })).status, 200, 'the bare token also works (legacy format), but only a real one');
});

test('privilege escalation is blocked', async () => {
  const mass = await app.signup('mass@test.local');                       // 4th signup
  const r = await app.req('/api/auth/register', { body: { name: 'Eve', email: 'eve@test.local', password: 'Passw0rd9', role: 'superadmin', suspended: false, verified: true } });
  assert.equal((await app.req('/api/sys/overview', { token: r.json.token })).status, 403, 'a role in the sign-up body is ignored');
  assert.equal((await app.req('/api/account', { method: 'PUT', token: mass.token, body: { name: 'Mass', role: 'admin' } })).status, 200);
  for (const [m, p, b] of [['GET', '/api/sys/overview'], ['GET', '/api/sys/users'], ['PUT', '/api/sys/config', { brand: { name: 'Hacked' } }], ['GET', '/api/admin/users'], ['POST', `/api/sys/users/${ana.user.id}/action`, { action: 'delete' }], ['GET', '/api/admin/settings']]) {
    assert.equal((await app.req(p, { method: m, token: mass.token, body: b })).status, 403, m + ' ' + p);
  }
  assert.doesNotMatch((await app.req('/')).text, /Hacked/);
});

test('roles: an Admin can moderate but not configure, promote or delete', async () => {
  assert.equal((await app.req(`/api/sys/users/${ben.user.id}/action`, { token: admin.token, body: { action: 'promote' } })).status, 200);
  assert.equal((await app.req('/api/auth/me', { token: ben.token })).json.user.role, 'admin');
  assert.equal((await app.req('/api/sys/overview', { token: ben.token })).status, 200);
  assert.equal((await app.req('/api/sys/config', { method: 'PUT', token: ben.token, body: { brand: { name: 'Nope' } } })).status, 403);
  assert.equal((await app.req(`/api/sys/users/${ana.user.id}/action`, { token: ben.token, body: { action: 'delete' } })).status, 403);
  assert.equal((await app.req(`/api/sys/users/${admin.user.id}/action`, { token: ben.token, body: { action: 'suspend' } })).status, 403, 'a Super Admin cannot be suspended');
  assert.equal((await app.req(`/api/sys/users/${ana.user.id}/action`, { token: ben.token, body: { action: 'suspend', reason: 'x' } })).status, 200, 'moderating a plain user is allowed');
  await app.req(`/api/sys/users/${ana.user.id}/action`, { token: ben.token, body: { action: 'activate' } });
  ana.token = (await app.req('/api/auth/login', { body: { email: 'ana@test.local', password: 'Passw0rd9' } })).json.token;
  await app.req(`/api/sys/users/${ben.user.id}/action`, { token: admin.token, body: { action: 'demote' } });
});

test('broken access control: users cannot touch each other’s data (IDOR)', async () => {
  const q = await newQr(ana.token), id = 'q_' + q.shortCode;
  const f = (await app.req('/api/files/upload', { token: ana.token, body: form('p.png', PNG, 'image/png', { title: 'Mine' }) })).json;
  const calls = [['GET', `/api/qr/${id}`], ['PUT', `/api/qr/${id}`, { name: 'x' }], ['DELETE', `/api/qr/${id}`], ['POST', `/api/qr/${id}/duplicate`], ['POST', `/api/qr/${id}/deactivate`], ['PUT', `/api/qr/${id}/settings`, { title: 'x' }], ['GET', `/api/analytics/${q.shortCode}`], ['GET', `/api/analytics?id=${id}`], ['POST', `/api/qr/${id}/public-share`, { on: true }], ['POST', `/api/qr/${id}/share-link`, {}], ['GET', `/api/files/${f.id}`], ['PUT', `/api/files/${f.id}`, { title: 'x' }], ['DELETE', `/api/files/${f.id}`]];
  for (const [m, p, b] of calls) assert.equal((await app.req(p, { method: m, token: ben.token, body: b })).status, 404, 'ben → ' + m + ' ' + p);
  assert.equal((await app.req(`/api/qr/${id}`, { token: ana.token })).status, 200, 'the owner still has access');
});

test('XSS: user content is always escaped on public pages (8.22: XSS)', async () => {
  const fd = new FormData();
  fd.append('kind', 'page'); fd.append('type', 'business'); fd.append('title', '<script>alert(1)</script>');
  fd.append('data', JSON.stringify({ name: '<img src=x onerror=alert(1)>', desc: '"><svg onload=alert(1)>', website: 'javascript:alert(1)', address: '<b>x</b>' }));
  let r = await app.req('/api/dynamic', { token: ana.token, body: fd }); assert.equal(r.status, 200, r.text);
  const page = (await app.req('/q/' + r.json.code)).text;
  assert.ok(!page.includes('<img src=x onerror'), 'raw <img> must not appear'); assert.ok(!page.includes('<svg onload')); assert.ok(!page.includes('<script>alert(1)'));
  assert.match(page, /&lt;img src=x onerror/); assert.ok(!/href="javascript:/i.test(page));
  const up = await app.req('/api/files/upload', { token: ana.token, body: form('x.png', PNG, 'image/png', { title: '<script>alert(2)</script>' }) });
  assert.ok(!(await app.req('/f/' + up.json.code)).text.includes('<script>alert(2)'));
  await app.req(`/api/qr/q_${r.json.code}/public-share`, { token: ana.token, body: { on: true } });
  assert.ok(!(await app.req('/s/' + r.json.code)).text.includes('<script>alert(1)'));
});

test('redirect abuse: bad schemes, blocked domains and loops', async () => {
  for (const u of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) assert.equal((await app.req('/api/qr', { token: ana.token, body: { name: 'bad', mode: 'dynamic', type: 'url', destinationUrl: u } })).status, 400, u);
  await app.req('/api/sys/config', { method: 'PUT', token: admin.token, body: { security: { blockedDomains: ['blocked.example'] } } });
  const b = await newQr(ana.token, 'https://blocked.example/phish'); assert.equal((await app.req('/q/' + b.shortCode, { redirect: 'manual' })).status, 403);
  const loop = await newQr(ana.token, app.url + '/q/abc'); assert.equal((await app.req('/q/' + loop.shortCode, { redirect: 'manual' })).status, 403);
  await app.req('/api/sys/config', { method: 'PUT', token: admin.token, body: { security: { blockedDomains: [] } } });
});

test('upload attacks: extensions, content, scripts, size (8.22: file upload attacks)', async () => {
  for (const name of ['evil.html', 'evil.svg', 'evil.php', 'evil.exe', 'evil.js', 'evil.sh', 'evil.png.exe']) assert.equal((await app.req('/api/files/upload', { token: ana.token, body: form(name, Buffer.from('<script>alert(1)</script>'), 'text/html') })).status, 400, name);
  assert.equal((await app.req('/api/files/upload', { token: ana.token, body: form('evil.html.png', Buffer.from('<script>alert(1)</script>'), 'image/png') })).status, 400, 'content must match the extension');
  assert.equal((await app.req('/api/files/upload', { token: ana.token, body: form('x.png', PNG, 'text/html') })).status, 400, 'declared type must match the extension');
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  let r = await app.req('/api/files/upload', { token: ana.token, body: form('x.pdf', pdf, 'application/pdf') }); assert.equal(r.status, 400); assert.match(r.json.error, /script/i);
  await app.req('/api/admin/settings', { method: 'PUT', token: admin.token, body: { maxMB: { image: 1 } } });
  const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1300000)]);
  r = await app.req('/api/files/upload', { token: ana.token, body: form('big.png', big, 'image/png') }); assert.equal(r.status, 400); assert.match(r.json.error, /at most 1 MB/);
  await app.req('/api/admin/settings', { method: 'PUT', token: admin.token, body: { maxMB: { image: 10 } } });
  r = await app.req('/api/dynamic', { token: ana.token, body: (() => { const fd = form('x.png', Buffer.from('plain text'), 'image/png', { kind: 'page', type: 'business', title: 'T', data: '{"name":"n"}' }); return fd; })() });
  assert.equal(r.status, 400, 'the original upload endpoint now checks content too');
});

test('file access control, path traversal, safe headers', async () => {
  const up = await app.req('/api/files/upload', { token: ana.token, body: form('p.png', PNG, 'image/png', { title: 'P' }) });
  await app.req('/api/files/' + up.json.id, { method: 'PUT', token: ana.token, body: { access: 'private' } });
  assert.equal((await app.req(`/f/${up.json.code}/raw`)).status, 403); assert.equal((await app.req(`/f/${up.json.code}`)).status, 403);
  assert.equal((await app.req(`/f/${up.json.code}/raw?t=forged.token`)).status, 403, 'forged signed links are refused');
  const link = await app.req(`/api/files/${up.json.id}/sign`, { token: ana.token, body: { minutes: 5 } });
  assert.equal((await app.req(new URL(link.json.url).pathname.replace(/\/?$/, '') + '/raw' + new URL(link.json.url).search)).status, 200, 'a genuine signed link works');
  for (const p of ['/files/..%2f..%2fpackage.json', '/css/..%2f..%2fserver.js', '/f/..%2f..%2fpackage.json/raw']) { const r = await app.req(p); assert.ok(!/"dependencies"|require\('express'\)/.test(r.text), p); }
});

test('prototype pollution, injection strings and malformed bodies are harmless', async () => {
  let r = await app.req('/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: '{"__proto__":{"admin":true},"email":"x@y.z","password":"y"}' }); assert.equal(r.status, 401);
  for (const email of [{ $ne: null }, "' OR 1=1 --", '"; DROP TABLE users; --', { $gt: '' }]) assert.equal((await app.req('/api/auth/login', { body: { email, password: { $ne: 1 } } })).status, 401);
  r = await app.req('/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: '{bad json' }); assert.equal(r.status, 400); assert.match(r.json.error, /JSON/);
  r = await app.req('/api/auth/login', { body: { pad: 'a'.repeat(1200000) } }); assert.equal(r.status, 413);
  assert.equal((await app.req('/api/health')).status, 200, 'the server is still healthy');
  assert.equal(({}).admin, undefined);
});

test('AI history never stores passwords', async () => {
  const s = (await app.req('/api/ai/sessions', { token: ana.token, body: { title: 'wifi' } })).json;
  await app.req(`/api/ai/sessions/${s.id}/messages`, { token: ana.token, body: { messages: [{ role: 'user', text: 'wifi cafe password is hunter22' }] } });
  const back = (await app.req('/api/ai/sessions/' + s.id, { token: ana.token })).json;
  assert.ok(!JSON.stringify(back).includes('hunter22')); assert.match(back.messages[0].text, /••••/);
});

test('brute force: the account locks after repeated failures', async () => {
  // lower the lock threshold so this test stays inside the 15-logins-per-minute IP limit
  await app.req('/api/sys/config', { method: 'PUT', token: admin.token, body: { security: { lockAfter: 3 } } });
  await app.signup('brute@test.local');
  for (let i = 0; i < 3; i++) assert.equal((await app.req('/api/auth/login', { body: { email: 'brute@test.local', password: 'wrong' + i } })).status, 401);
  const r = await app.req('/api/auth/login', { body: { email: 'brute@test.local', password: 'Passw0rd9' } });
  assert.equal(r.status, 429, 'even the right password is refused while locked'); assert.match(r.json.error, /try again/i);
  await app.req('/api/sys/config', { method: 'PUT', token: admin.token, body: { security: { lockAfter: 8 } } });
});

test('CORS: only same-origin writes; image endpoints are public', async () => {
  const evil = { Origin: 'https://evil.example' };
  let r = await app.req('/api/qr', { method: 'POST', token: ana.token, headers: evil, body: { name: 'x' } }); assert.equal(r.status, 403); assert.match(r.json.error, /Cross-origin/);
  assert.equal((await app.req('/api/qr', { method: 'OPTIONS', headers: Object.assign({ 'Access-Control-Request-Method': 'POST' }, evil) })).status, 403);
  assert.equal((await app.req('/api/qr', { method: 'OPTIONS', headers: { Origin: app.url, 'Access-Control-Request-Method': 'POST' } })).status, 204);
  r = await app.req('/api/qr.svg?data=hi', { headers: evil }); assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal((await app.req('/api/qr', { token: ana.token, headers: evil })).headers.get('access-control-allow-origin'), null, 'no CORS grant for strangers');
});

test('security headers, cache rules and closed registration', async () => {
  const h = (await app.req('/')).headers, csp = h.get('content-security-policy') || '';
  assert.match(csp, /object-src 'none'/); assert.match(csp, /frame-ancestors 'self'/); assert.match(csp, /base-uri 'self'/);
  assert.equal(h.get('x-content-type-options'), 'nosniff'); assert.equal(h.get('x-frame-options'), 'SAMEORIGIN'); assert.ok(h.get('referrer-policy')); assert.match(h.get('permissions-policy') || '', /camera=\(\)/);
  assert.equal((await app.req('/api/qr', { token: ana.token })).headers.get('cache-control'), 'no-store');
  await app.req('/api/sys/config', { method: 'PUT', token: admin.token, body: { signup: { open: false } } });
  assert.equal((await app.req('/api/auth/register', { body: { name: 'Late', email: 'late@test.local', password: 'Passw0rd9' } })).status, 403);
  await app.req('/api/sys/config', { method: 'PUT', token: admin.token, body: { signup: { open: true } } });
});

test('sessions: logout and "log out other devices" really revoke tokens', async () => {
  const second = (await app.req('/api/auth/login', { body: { email: 'ana@test.local', password: 'Passw0rd9' } })).json.token;
  assert.ok((await app.req('/api/account/sessions', { token: ana.token })).json.items.length >= 2);
  assert.equal((await app.req('/api/account/sessions/revoke-others', { token: ana.token, method: 'POST' })).status, 200);
  assert.equal((await app.req('/api/auth/me', { token: second })).status, 401);
  assert.equal((await app.req('/api/auth/me', { token: ana.token })).status, 200);
});

test('contact form drops link spam silently', async () => {
  const r = await app.req('/api/contact', { body: { name: 'Spam', email: 'spam@example.com', message: 'buy http://a.example http://b.example http://c.example now' } });
  assert.equal(r.status, 200);
});
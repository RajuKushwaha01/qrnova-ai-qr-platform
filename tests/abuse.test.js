'use strict';
// Runs against its own server: the rate-limit test deliberately gets this machine blocked for a minute.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let app, admin, ana;
before(async () => { app = await start(); admin = await app.signup('admin@test.local'); ana = await app.signup('ana@test.local'); });
after(async () => { if (app) await app.stop(); });
const cfg = (body) => app.req('/api/sys/config', { method: 'PUT', token: admin.token, body });
const mk = (n) => app.req('/api/qr', { token: ana.token, body: { name: 'Q' + n, mode: 'dynamic', type: 'url', destinationUrl: 'https://example.com/' + n } });

test('QR limits and hourly creation limits (8.22 / 7.10: excessive QR generation)', async () => {
  await cfg({ limits: { maxDynamicQr: 2, createPerHour: 100 } });
  assert.equal((await mk(1)).status, 200); assert.equal((await mk(2)).status, 200);
  let r = await mk(3); assert.equal(r.status, 403); assert.match(r.json.error, /Limit reached/);
  await cfg({ limits: { maxDynamicQr: 50, createPerHour: 3 } });
  assert.equal((await mk(3)).status, 200);
  r = await mk(4); assert.equal(r.status, 429); assert.match(r.json.error, /hourly/i); assert.ok(r.headers.get('retry-after'));
});

test('daily AI request limit (7.10: excessive AI requests)', async () => {
  await cfg({ limits: { aiPerDay: 3 } });
  for (let i = 0; i < 3; i++) assert.equal((await app.req('/api/ai/detect', { token: ana.token, body: { text: 'example.com' } })).status, 200);
  const r = await app.req('/api/ai/detect', { token: ana.token, body: { text: 'example.com' } });
  assert.equal(r.status, 429); assert.match(r.json.error, /Daily AI limit/);
});

test('verified-email requirement', async () => {
  await cfg({ signup: { requireVerified: true } });
  const r = await mk(9); assert.equal(r.status, 403); assert.match(r.json.error, /verify/i);
  await cfg({ signup: { requireVerified: false } });
});

test('global rate limit answers 429 with Retry-After (8.22: rate limits)', async () => {
  assert.equal((await cfg({ limits: { apiPerMin: 30 } })).status, 200);
  const codes = []; let retry = null;
  for (let i = 0; i < 60; i++) { const r = await app.req('/api/health'); codes.push(r.status); if (r.status === 429) retry = r.headers.get('retry-after'); }
  assert.ok(codes.includes(429), 'some requests must be refused'); assert.ok(codes.filter((c) => c === 200).length <= 30); assert.ok(retry, 'Retry-After header is present');
});
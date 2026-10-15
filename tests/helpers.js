'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  bot: 'WhatsApp/2.23.20.0 A',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const form = (name, bytes, type, fields) => {
  const fd = new FormData();
  Object.entries(fields || {}).forEach(([k, v]) => fd.append(k, v));
  fd.append('file', new Blob([bytes], { type: type || 'application/octet-stream' }), name);
  return fd;
};

async function request(base, p, o) {
  o = o || {};
  const headers = Object.assign({}, o.headers);
  if (o.token) headers.Authorization = 'Bearer ' + o.token;
  let body = o.body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !Buffer.isBuffer(body)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const r = await fetch(base + p, { method: o.method || (body !== undefined ? 'POST' : 'GET'), headers, body, redirect: o.redirect || 'follow' });
  const buf = Buffer.from(await r.arrayBuffer()), text = buf.toString('utf8');
  let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { status: r.status, headers: r.headers, text, json, buf };
}

// Starts a private copy of the server (own port, own empty data folders) so tests never touch real data.
async function start(extra) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qrnova-test-'));
  const port = 41000 + Math.floor(Math.random() * 8000);
  const env = Object.assign({}, process.env, {
    PORT: String(port), NODE_ENV: 'test', ADMIN_EMAIL: 'admin@test.local', BACKUP_HOURS: '0',
    DATA_DIR: path.join(tmp, 'data'), STORAGE_DIR: path.join(tmp, 'storage'), UPLOADS_DIR: path.join(tmp, 'uploads'),
    FORCE_HTTPS: '0', SMTP_URL: '', BASE_URL: '', CORS_ORIGINS: '', METRICS_TOKEN: '', MAINTENANCE: '', CSP: '',
  }, extra || {});
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
  const url = `http://127.0.0.1:${port}`, t0 = Date.now();
  for (;;) {
    try { const r = await fetch(url + '/healthz'); if (r.ok) break; } catch (e) { /* not up yet */ }
    if (Date.now() - t0 > 20000) { child.kill(); throw new Error('The server did not start:\n' + out); }
    await sleep(150);
  }
  return {
    url, out: () => out,
    req: (p, o) => request(url, p, o),
    async signup(email, name) {
      const r = await request(url, '/api/auth/register', { body: { name: name || email.split('@')[0], email, password: 'Passw0rd9' } });
      if (r.status !== 200) throw new Error('signup failed: ' + r.text);
      return { token: r.json.token, user: r.json.user, devLink: r.json.devLink };
    },
    async stop() {
      await new Promise((res) => { child.once('exit', res); child.kill('SIGTERM'); setTimeout(res, 3000); });
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

module.exports = { start, request, PNG, UA, sleep, form };
'use strict';
require('../lib/env');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return null; } };
const tty = process.stdout.isTTY;
const C = tty ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' } : { g: '', r: '', y: '', b: '', d: '', x: '' };
let fails = 0, warns = 0;
const ok = (m) => console.log(`  ${C.g}✔${C.x} ${m}`);
const bad = (m, fix) => { fails++; console.log(`  ${C.r}✘ ${m}${C.x}${fix ? `\n      ${C.d}→ ${fix}${C.x}` : ''}`); };
const warn = (m) => { warns++; console.log(`  ${C.y}!${C.x} ${m}`); };
const head = (t) => console.log(`\n${C.b}${t}${C.x}`);

/* ───────────── 1. environment ───────────── */
function environment() {
  head('1. Environment');
  const major = +process.versions.node.split('.')[0];
  if (major >= 20) ok(`Node.js ${process.versions.node}`);
  else if (major >= 18) { ok(`Node.js ${process.versions.node}`); warn('Node 20+ is recommended (the test runner prints more detail there)'); }
  else bad(`Node.js ${process.versions.node} is too old`, 'Install Node.js 18 or newer: https://nodejs.org');
  const P = require('../lib/paths');
  [['data', P.DATA], ['storage', P.STORAGE], ['uploads', P.UPLOADS]].forEach(([n, d]) => {
    try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); ok(`${n} folder is writable (${path.relative(ROOT, d) || d})`); }
    catch (e) { bad(`${n} folder is not writable: ${d}`, 'Fix the folder permissions or change DATA_DIR / STORAGE_DIR / UPLOADS_DIR in .env'); }
  });
  for (const m of ['express', 'multer', 'qrcode', 'pdf-parse', 'compression']) {
    try { require.resolve(m); ok(`package "${m}" installed`); } catch (e) { bad(`package "${m}" is missing`, 'Run: npm install'); }
  }
  try { require.resolve('nodemailer'); ok('package "nodemailer" installed (real email possible)'); } catch (e) { warn('nodemailer not installed: emails are printed in the terminal (fine for development)'); }
  if (process.env.SMTP_URL) ok('SMTP_URL is set'); else warn('SMTP_URL is not set: verification and reset emails appear in the terminal');
  if (process.env.ADMIN_EMAIL) ok(`ADMIN_EMAIL = ${process.env.ADMIN_EMAIL}`); else warn('ADMIN_EMAIL is not set: the very first account becomes Super Admin');
  if (process.env.NODE_ENV === 'production') {
    if (process.env.BASE_URL) ok('BASE_URL is set'); else bad('BASE_URL is missing in production', 'Set BASE_URL=https://your-domain in .env');
    if (process.env.FORCE_HTTPS === '1') ok('FORCE_HTTPS=1'); else warn('FORCE_HTTPS is off: enable it behind a TLS proxy');
  }
}

/* ───────────── 2. files ───────────── */
const FILES = ['server.js', 'package.json', 'lib/db.js', 'lib/util.js', 'lib/layout.js', 'lib/pages.js', 'lib/public-page.js', 'lib/viewer.js', 'lib/qrengine.js', 'lib/filestore.js', 'lib/files-routes.js', 'lib/extract.js', 'lib/ai-routes.js', 'lib/design-routes.js', 'lib/mailer.js', 'lib/accounts.js', 'lib/qr-routes.js', 'lib/settings.js', 'lib/roles.js', 'lib/security.js', 'lib/analytics.js', 'lib/admin.js', 'lib/brandkit.js', 'lib/env.js', 'lib/ops.js', 'lib/platform.js', 'lib/seo.js', 'lib/ai-engine.js', 'lib/api-v1.js', 'lib/schema.js', 'lib/notify.js', 'lib/paths.js', 'public/css/style.css'].concat(
  ['core', 'home', 'ai', 'generator', 'account', 'countries', 'qrtools', 'filetoqr', 'myfiles', 'admin', 'aibrain', 'studio', 'designer', 'authpages', 'dashboard', 'myqr', 'charts', 'analytics', 'share', 'ui', 'gen-ux'].map((n) => `public/js/${n}.js`),
  ['scripts/backup.js', 'scripts/migrate-mongo.js', 'tests/run.js', 'tests/helpers.js', 'tests/smoke.test.js', 'tests/security.test.js', 'tests/abuse.test.js', 'Dockerfile', 'docker-compose.yml', '.env.example', 'ecosystem.config.js', 'deploy/Caddyfile', 'deploy/nginx.conf']);
const PART = { 'lib/settings.js': '7A', 'lib/roles.js': '7A', 'lib/security.js': '7A', 'lib/analytics.js': '7A', 'lib/admin.js': '7A', 'lib/brandkit.js': '7A', 'lib/env.js': '8A', 'lib/ops.js': '8A', 'lib/platform.js': '8A', 'lib/seo.js': '8A', 'lib/ai-engine.js': '8A', 'lib/api-v1.js': '8A', 'lib/schema.js': '8A', 'lib/notify.js': '8A', 'lib/paths.js': '8B', 'public/js/ui.js': '8C', 'public/js/gen-ux.js': '8C', 'lib/layout.js': '8C', 'public/js/charts.js': '7B', 'public/js/analytics.js': '7B', 'public/js/share.js': '7B', 'public/js/dashboard.js': '6B', 'public/js/myqr.js': '6B', 'public/js/authpages.js': '6A', 'lib/accounts.js': '6A', 'lib/qr-routes.js': '6A', 'public/js/designer.js': '5', 'lib/design-routes.js': '5', 'public/js/studio.js': '4B', 'public/js/aibrain.js': '4A', 'lib/ai-routes.js': '4A', 'lib/extract.js': '4A', 'lib/filestore.js': '3', 'lib/files-routes.js': '3', 'public/js/filetoqr.js': '3', 'public/js/myfiles.js': '3', 'public/js/qrtools.js': '3', 'lib/qrengine.js': '2', 'public/js/generator.js': '2', 'public/js/countries.js': '2' };
function files() {
  head('2. Files');
  let miss = 0;
  FILES.forEach((f) => { if (!fs.existsSync(path.join(ROOT, f))) { miss++; bad(`missing: ${f}`, `Create it from Part ${PART[f] || '1–8'}`); } });
  if (!miss) ok(`all ${FILES.length} project files are present`);
}

/* ───────────── 3. syntax ───────────── */
function syntax() {
  head('3. JavaScript syntax (catches broken copy-and-paste)');
  const list = ['server.js', 'ecosystem.config.js'];
  ['lib', 'public/js', 'scripts', 'tests'].forEach((d) => { try { fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.js')).forEach((f) => list.push(`${d}/${f}`)); } catch (e) { /* folder missing: reported above */ } });
  let broken = 0;
  list.forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, f))) return;
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
    if (r.status !== 0) {
      broken++;
      const m = String(r.stderr).split('\n').filter(Boolean);
      bad(`syntax error in ${f}`, (m.find((l) => /Error/.test(l)) || m[0] || '').slice(0, 140) + ' (see the line shown by: node --check ' + f + ')');
    }
  });
  if (!broken) ok(`${list.length} JavaScript files parse cleanly`);
  return broken;
}

/* ───────────── 4. manual edits applied? ───────────── */
const EDITS = [
  ['server.js', "require('./lib/env')", '8A edit 1'], ['server.js', "require('./lib/platform').early(app)", '8A edit 2'], ['server.js', 'safety.mount(app)', '7A edit 2'],
  ['server.js', 'accounts.mount(app', '6A edit 1'], ['server.js', "require('./lib/qr-routes')(app", '6A edit 1'], ['server.js', "require('./lib/analytics').mount(app", '7A edit 3'], ['server.js', "require('./lib/admin')(app", '7A edit 3'],
  ['server.js', "require('./lib/api-v1').mount(app", '8A edit 3'], ['server.js', "require('./lib/notify').mount(app", '8A edit 3'], ['server.js', "require('./lib/ops').mount(app", '8A edit 3'], ['server.js', "require('./lib/ops').errorHandler", '8A edit 4'],
  ['server.js', "require('./lib/files-routes')(app", 'Part 3 edit 1'], ['server.js', "require('./lib/ai-routes')(app", 'Part 4A server.js edit'], ['server.js', "require('./lib/design-routes')(app", 'Part 5 server.js edit 1'],
  ['server.js', 'safety.inspectLegacy', '7A edit 6'], ['server.js', 'accounts.auth(req, res, next)', '7A edit 4 (replace the old auth function)'], ['server.js', 'limits.maxDynamicQr', '7A edit 5'], ['server.js', "require('./lib/paths').UPLOADS", '8B server.js edit'],
  ['server.js', "'/design-studio': 'design'", 'Part 5 server.js edit 2'], ['server.js', "'/file-to-qr': 'filetoqr'", 'Part 3 edit 2'], ['server.js', "'/forgot-password': 'forgot'", '6A edit 2'], ['server.js', "'/my-qr-codes': 'myqr'", '6B server.js edit'], ['server.js', "'/analytics': 'analytics'", '7B server.js edit'],
  ['lib/db.js', 'DATA_DIR', '8A db.js edit 1'], ['lib/db.js', 'module.exports = { db, save, file, dir, flush }', '8A db.js edit 2'],
  ['lib/accounts.js', 'cfg().security.sessionDays', '7A accounts edit 2'], ['lib/accounts.js', 'cfg().security.lockAfter', '7A accounts edit 3'], ['lib/accounts.js', 'cfg().security.minPassword', '7A accounts edit 4'], ['lib/accounts.js', 'cfg().security.idleDays', '7A accounts edit 5'],
  ['lib/accounts.js', 'if (u.suspended)', '7A accounts edits 6–7'], ['lib/accounts.js', 'roleOf(u)', '7A accounts edit 8'], ['lib/accounts.js', 'agg, uv', '7A accounts edit 9'], ['lib/accounts.js', "require('./paths').UPLOADS", '8B small edits'],
  ['lib/files-routes.js', "analytics.record(f, req, 'views')", '7A files-routes edit 4'], ['lib/files-routes.js', 'safety.mimeOk', '7A files-routes edit 3'], ['lib/files-routes.js', 'roles.isStaff', '7A files-routes edit 2'],
  ['lib/qr-routes.js', "analytics.record(q, req, 'scans')", '7A qr-routes edit 3'], ['lib/qr-routes.js', 'safety.redirectOk', '7A qr-routes edit 3'], ['lib/qr-routes.js', 'q.adminDisabled', '7A qr-routes edit 2'], ['lib/qr-routes.js', 'limits.maxStaticQr', '7A qr-routes edit 4'], ['lib/qr-routes.js', 'limits.maxDynamicQr', '7A qr-routes edit 5'], ['lib/qr-routes.js', "require('./paths').UPLOADS", '8B small edits'],
  ['lib/mailer.js', 'get().email.from', '7A mailer edit'], ['lib/filestore.js', "require('./paths').STORAGE", '8B filestore edit'], ['lib/admin.js', "require('./db').file", '8A admin edit'], ['lib/admin.js', "require('./paths').UPLOADS", '8B small edits'],
  ['lib/security.js', 'detect|parse|generate|validate|recommend|design', '8A security edit'],
  ['lib/layout.js', '/js/ui.js', '8C lib/layout.js (full replacement)'], ['lib/layout.js', 'data-staff', '8C lib/layout.js (full replacement)'], ['lib/layout.js', 'Poppins', '8C lib/layout.js (full replacement)'], ['lib/layout.js', 'matchMedia', '8C lib/layout.js (full replacement)'], ['lib/layout.js', 'tbn', '8C lib/layout.js (full replacement)'],
  ['lib/pages.js', "'/js/qrtools.js', '/js/share.js', '/js/myqr.js'", '7B pages edit D'], ['lib/pages.js', "'/js/charts.js', '/js/analytics.js'", '7B pages edit A'], ['lib/pages.js', "'/js/charts.js', '/js/admin.js'", '7B pages edit B'], ['lib/pages.js', 'href="/analytics">📊 Analytics</a>', '7B pages edit C'],
  ['lib/pages.js', "'/js/countries.js', '/js/generator.js'", 'Part 2 generator block'], ['lib/pages.js', "'/js/filetoqr.js'", 'Part 3 pages block'], ['lib/pages.js', "'/js/designer.js'", 'Part 5 design block'], ['lib/pages.js', "'/js/studio.js'", 'Part 4B ai block'], ['lib/pages.js', "'/js/dashboard.js'", '6B dashboard block'], ['lib/pages.js', "'/js/authpages.js'", '6A pages blocks'],
  ['lib/pages.js', "'/js/generator.js', '/js/gen-ux.js'", '8C pages.js edit 1'], ['lib/pages.js', "'/js/filetoqr.js', '/js/gen-ux.js'", '8C pages.js edit 2'],
  ['public/js/ui.js', 'function avatar', '8C public/js/ui.js (full replacement)'], ['public/js/ui.js', 'function dropdowns', '8C public/js/ui.js (full replacement)'],
  ['public/js/myqr.js', 'QRShare.open', '7B myqr edit 1'], ['public/js/myqr.js', "'/analytics?id='", '7B myqr edit 2'], ['public/js/myqr.js', 'QRX.skeleton', '8B myqr edit 3'], ['public/js/dashboard.js', 'QRX.skeleton', '8B dashboard edit'], ['public/js/analytics.js', 'QRX.skeleton', '8B analytics edit'],
  ['public/js/designer.js', 'dsSaveQr', '6B designer edits'], ['public/js/generator.js', 'toDesign', '6B generator edit'], ['public/js/generator.js', "href: '/file-to-qr?type=image'", 'Part 3 generator edit 1'], ['public/js/studio.js', 'toDesign', 'final studio.js edit'],
  ['package.json', '"test": "node tests/run.js"', '8B package.json edit'], ['package.json', '"doctor"', 'final package.json edit'], ['package.json', '"compression"', '8A package.json'],
  ['public/css/style.css', 'Part 2 ·', 'Part 2 CSS append'], ['public/css/style.css', 'Part 3 ·', 'Part 3 CSS append'], ['public/css/style.css', 'Part 4 ·', 'Part 4B CSS append'], ['public/css/style.css', 'Part 5 ·', 'Part 5 CSS append'], ['public/css/style.css', 'Part 6A', '6A CSS append'], ['public/css/style.css', 'Part 6B', '6B CSS append'], ['public/css/style.css', 'Part 7B', '7B CSS append'], ['public/css/style.css', 'Part 8B', '8B CSS append'], ['public/css/style.css', 'Part 8C', '8C CSS append'],
];
function edits() {
  head('4. Manual edits applied (each ✘ names the Part to re-apply)');
  const cache = {}; let miss = 0;
  EDITS.forEach(([f, needle, where]) => {
    const t = cache[f] === undefined ? (cache[f] = read(f)) : cache[f];
    if (t === null) return; // file missing: already reported
    if (!t.includes(needle)) { miss++; bad(`${f} is missing  ${needle}`, `Re-apply: ${where}`); }
  });
  if (!miss) ok(`all ${EDITS.length} expected edits are in place`);
}

/* ───────────── 5. live checks ───────────── */
async function live() {
  head('5. Live check: starting a private copy of the server on a temporary database');
  const H = require('../tests/helpers');
  let S;
  try { S = await H.start(); } catch (e) { bad('the server did not start', String(e.message).split('\n').filter(Boolean).slice(-6).join(' | ').slice(0, 400)); return; }
  ok('server booted and answers /healthz');
  const probe = async (name, fn, fix) => {
    try { const r = await fn(); if (r === false) { bad(name, fix); return false; } ok(name); return r; }
    catch (e) { bad(name, String(e.message).slice(0, 160)); return false; }
  };
  try {
    const admin = await S.signup('admin@test.local'), user = await S.signup('doctor@test.local');
    const phone = { 'User-Agent': H.UA.android, 'Accept-Language': 'en-IN' };

    head('   Lifecycle: Create → AI understands → Validate → Generate → Download → Share → Scan → Track → Manage → Update');
    let code, id;
    await probe('AI understands the input (detect)', async () => (await S.req('/api/ai/detect', { token: user.token, body: { text: 'https://example.com' } })).json.type === 'url', 'Part 8A api-v1.js / ai-engine.js');
    await probe('Validate (valid content passes)', async () => (await S.req('/api/ai/validate', { token: user.token, body: { type: 'url', fields: { url: 'example.com' } } })).json.valid === true);
    await probe('Generate a dynamic QR', async () => {
      const r = await S.req('/api/qr', { token: user.token, body: { name: 'Doctor QR', mode: 'dynamic', type: 'url', destinationUrl: 'https://example.com/doctor' } });
      code = r.json.shortCode; id = 'q_' + code; return r.status === 200 && !!code;
    });
    await probe('Download: PNG and SVG from the QR engine', async () => {
      const p = await S.req('/api/qr.png?data=' + encodeURIComponent(S.url + '/q/' + code) + '&size=400'), s = await S.req('/api/qr.svg?data=hello');
      return p.buf[0] === 0x89 && /<svg/.test(s.text);
    });
    await probe('Share: public share page', async () => {
      await S.req(`/api/qr/${id}/public-share`, { token: user.token, body: { on: true } });
      const r = await S.req('/s/' + code); return r.status === 200 && /<svg/.test(r.text) && /Powered by/.test(r.text);
    }, 'Part 7A analytics.js / brandkit.js / viewer.js');
    await probe('Scan: /qr/:shortCode redirects the phone', async () => {
      const r = await S.req('/qr/' + code, { redirect: 'manual', headers: phone });
      return r.status === 302 && r.headers.get('location') === 'https://example.com/doctor';
    }, 'Part 8A platform.js + 6A qr-routes.js');
    await probe('Track: device, browser, OS and region are recorded', async () => {
      const a = (await S.req('/api/analytics/' + code, { token: user.token })).json;
      return a.total === 1 && a.devices.mobile === 1 && a.browsers.Chrome === 1 && a.os.Android === 1 && a.regions.IN === 1;
    }, 'Part 7A analytics.js + the qr-routes.js scan edit');
    await probe('Manage: deactivate blocks scans, activate restores them', async () => {
      await S.req(`/api/qr/${id}/deactivate`, { method: 'POST', token: user.token });
      const off = await S.req('/q/' + code, { redirect: 'manual', headers: phone });
      await S.req(`/api/qr/${id}/activate`, { method: 'POST', token: user.token });
      return off.status === 403 && (await S.req('/q/' + code, { redirect: 'manual', headers: phone })).status === 302;
    });
    await probe('Update: the destination changes, the printed QR does not', async () => {
      await S.req('/api/qr/' + id, { method: 'PUT', token: user.token, body: { destinationUrl: 'https://example.org/new' } });
      return (await S.req('/q/' + code, { redirect: 'manual', headers: phone })).headers.get('location') === 'https://example.org/new';
    });

    head('   Your feature checklist');
    const src = (f) => read(f) || '';
    const has = (f, arr) => arr.every((s) => src(f).includes(s));
    const page = async (p) => (await S.req(p)).status === 200;
    await probe('QR creation: Text · URL · Email · Phone · SMS · WhatsApp · Wi-Fi · Contact · Location · UPI · Social · Event · Business · Product · Review · Custom', async () =>
      ['text', 'url', 'email', 'phone', 'sms', 'whatsapp', 'wifi', 'vcard', 'location', 'upi', 'social', 'event', 'business', 'product', 'review', 'custom'].every((t) => new RegExp(`id: '${t}'`).test(src('public/js/generator.js'))) && (await page('/qr-generator')));
    await probe('File QR: Image · PDF · Video · Audio · Documents · preview · download · management · secure URLs', async () => {
      const cats = (await S.req('/api/files/config')).json.cats.map((c) => c.id);
      if (!['image', 'pdf', 'video', 'audio', 'document'].every((c) => cats.includes(c))) return false;
      const up = (await S.req('/api/files/upload', { token: user.token, body: H.form('d.png', H.PNG, 'image/png', { title: 'Doctor file' }) })).json;
      const ok1 = (await S.req('/f/' + up.code)).status === 200 && (await S.req(`/f/${up.code}/raw`)).status === 200 && (await page('/my-files')) && (await page('/file-to-qr'));
      await S.req('/api/files/' + up.id, { method: 'DELETE', token: user.token });
      return ok1;
    });
    await probe('AI: assistant · natural language · detection · extraction · validation · formatting · recommendations · design · quality · history', async () => {
      const gen = (await S.req('/api/ai/generate', { token: user.token, body: { text: 'Wi-Fi network Cafe_Guest password coffee1234' } })).json;
      const parse = (await S.req('/api/ai/parse', { token: user.token, body: { text: 'Call 98765 43210 or visit example.com' } })).json;
      const rec = (await S.req('/api/ai/recommend', { token: user.token, body: { type: 'url', fields: { url: 'example.com' } } })).json;
      const des = (await S.req('/api/ai/design', { token: user.token, body: { text: 'professional for a hotel' } })).json;
      const hist = await S.req('/api/ai/sessions', { token: user.token });
      return gen.type === 'wifi' && parse.phones.length === 1 && !!rec.ecl && !!des.style && hist.status === 200 && has('public/js/aibrain.js', ['quality', 'tidy', 'suggest']) && (await page('/ai-qr'));
    });
    await probe('Design: colours · gradients · styles · eyes · logo · background · error correction · frames · captions · PNG · JPG · SVG · PDF · print layouts', async () =>
      has('public/js/designer.js', ['radial', 'eyeOuter', 'logo', 'brackets', 'makePdf', 'tplSvg', 'image/jpeg', 'ecl']) && (await page('/design-studio')));
    await probe('User platform: register · login · verify · reset · dashboard · history · favorites · folders · search · filters · edit · duplicate · delete · expiry · password', async () => {
      const folders = (await S.req('/api/folders', { token: user.token })).json.items.length === 8;
      const dup = (await S.req(`/api/qr/${id}/duplicate`, { method: 'POST', token: user.token })).status === 200;
      const act = (await S.req('/api/qr/activity', { token: user.token })).status === 200;
      return folders && dup && act && (await page('/dashboard')) && (await page('/my-qr-codes')) && (await page('/forgot-password')) && has('lib/qr-routes.js', ['restrict', 'expires', 'adminDisabled']);
    });
    await probe('Analytics: total · unique · history · device · browser · OS · region · trends · charts', async () => {
      const a = (await S.req('/api/analytics?id=all&days=30', { token: user.token })).json;
      return a.total >= 1 && a.unique >= 0 && !!a.series && !!a.weekly && !!a.monthly && !!a.browsers && !!a.os && !!a.regions && (await page('/analytics'));
    });
    await probe('Sharing: copy QR · copy URL · download · native share · email · WhatsApp · social · public landing page', async () =>
      has('public/js/share.js', ['copyqr', 'copyurl', 'shareqr', 'wa.me', 'twitter.com', 'mailto:', 'public-share']) && /navigator\.share/.test(src('lib/brandkit.js')) && (await page('/s/' + code)));
    await probe('Administration: users · QR · files · analytics · abuse control · settings · storage/file/AI limits · audit log', async () => {
      const ov = await S.req('/api/sys/overview?tz=0', { token: admin.token }), denied = await S.req('/api/sys/overview', { token: user.token });
      const cfg = (await S.req('/api/sys/config', { token: admin.token })).json.config, aud = await S.req('/api/sys/audit', { token: admin.token });
      return ov.status === 200 && denied.status === 403 && !!cfg.limits.aiPerDay && cfg.limits.totalStorageMB !== undefined && aud.status === 200 && (await S.req('/api/sys/security', { token: admin.token })).status === 200 && (await page('/admin'));
    });
    await probe('Quality: responsive · accessibility · dark + light · loading/empty/error/success states · notifications · SEO · security · testing · deployment', async () => {
      const h = (await S.req('/')).headers;
      return (await page('/sitemap.xml')) && (await page('/robots.txt')) && !!h.get('content-security-policy')
        && has('public/js/ui.js', ['skeleton', 'empty', 'errorState', 'notify', 'aria-live', 'skip'])
        && has('public/css/style.css', [':focus-visible', 'prefers-reduced-motion', '[data-theme=light]', '.bnav'])
        && (await S.req('/readyz')).json.ok === true && fs.existsSync(path.join(ROOT, 'Dockerfile')) && fs.existsSync(path.join(ROOT, 'tests/smoke.test.js'));
    });
  } catch (e) { bad('unexpected error during the live checks', String(e.message).slice(0, 200)); }
  await S.stop();
}

/* ───────────── run ───────────── */
(async () => {
  console.log(`${C.b}QRNova doctor${C.x} ${C.d}— checks your installation against the full specification${C.x}`);
  environment(); files(); const broken = syntax(); edits();
  if (broken) { head('5. Live check'); warn('skipped: fix the syntax errors above first'); } else await live();
  console.log('\n' + '─'.repeat(64));
  if (!fails) console.log(`${C.g}${C.b}✅ All checks passed${C.x}${warns ? ` (${warns} optional note${warns > 1 ? 's' : ''})` : ''}. Your install matches the full specification.\n   Next:  npm test   (deeper security + abuse tests)   ·   npm start   (http://localhost:${process.env.PORT || 3000})`);
  else console.log(`${C.r}${C.b}${fails} problem${fails > 1 ? 's' : ''} found.${C.x} Each ✘ above says which Part's edit to re-apply. Fix them, then run  npm run doctor  again.`);
  process.exit(fails ? 1 : 0);
})();
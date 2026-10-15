'use strict';
require('../lib/env');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const file = path.join(dir, 'db.json'), bdir = path.join(dir, 'backups');
fs.mkdirSync(bdir, { recursive: true });
const list = () => fs.readdirSync(bdir).filter((f) => /^db-.*\.json\.gz$/.test(f)).sort();
const cmd = process.argv[2] || 'create';

if (cmd === 'list') {
  list().forEach((f) => console.log(f, Math.round(fs.statSync(path.join(bdir, f)).size / 1024) + ' KB'));
  if (!list().length) console.log('No backups yet.');
} else if (cmd === 'restore') {
  const name = process.argv[3];
  if (!name) { console.error('Usage: npm run restore -- <backup-file.json.gz>\n(stop the server first, then start it again afterwards)\n\nAvailable:\n  ' + (list().join('\n  ') || '(none)')); process.exit(1); }
  const src = path.isAbsolute(name) ? name : path.join(bdir, name);
  if (!fs.existsSync(src)) { console.error('Backup not found:', src); process.exit(1); }
  const json = zlib.gunzipSync(fs.readFileSync(src));
  JSON.parse(json); // refuse to restore a corrupt file
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.before-restore');
  fs.writeFileSync(file, json);
  console.log('✅ Restored', path.basename(src), '→', file, '\n   (the previous data was kept as db.json.before-restore)');
} else {
  if (!fs.existsSync(file)) { console.error('No database found at', file); process.exit(1); }
  const name = `db-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.json.gz`;
  fs.writeFileSync(path.join(bdir, name), zlib.gzipSync(fs.readFileSync(file)));
  console.log('✅ Backup written:', path.join(bdir, name));
  console.log('   Uploaded files live in the "storage" and "uploads" folders: back those up too (e.g. rsync).');
}
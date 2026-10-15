'use strict';
const path = require('path');
require('./env');

// One place for every writable folder. In Docker they all live under a single /data volume.
const ROOT = path.join(__dirname, '..');
const pick = (v, d) => (v ? path.resolve(v) : d);

module.exports = {
  ROOT,
  DATA: pick(process.env.DATA_DIR, path.join(ROOT, 'data')),       // db.json, logs, backups
  STORAGE: pick(process.env.STORAGE_DIR, path.join(ROOT, 'storage')), // hosted files (File → QR)
  UPLOADS: pick(process.env.UPLOADS_DIR, path.join(ROOT, 'uploads')), // legacy page attachments
};
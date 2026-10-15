'use strict';
const fs = require('fs');
const path = require('path');

// Tiny .env loader (no dependency). Real environment variables always win over the file.
// Format: KEY=value  (one per line, "#" starts a comment line, no inline comments).
try {
  const f = path.join(__dirname, '..', '.env');
  if (fs.existsSync(f)) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line) => {
      if (line.trim().startsWith('#')) return;
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m) return;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  }
} catch (e) { console.error('Could not read .env:', e.message); }
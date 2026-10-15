'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { db, save } = require('./db');

const STORAGE = require('./paths').STORAGE; // never exposed via express.static
fs.mkdirSync(STORAGE, { recursive: true });
const HARD_MAX_MB = Math.max(1, parseInt(process.env.MAX_UPLOAD_MB, 10) || 200);

const CATS = {
  image: { label: 'Image', icon: '🖼️', exts: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
  pdf: { label: 'PDF', icon: '📄', exts: ['pdf'] },
  video: { label: 'Video', icon: '🎬', exts: ['mp4', 'webm', 'mov'] },
  audio: { label: 'Audio', icon: '🎵', exts: ['mp3', 'wav', 'm4a'] },
  document: { label: 'Document', icon: '📁', exts: ['doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'] },
};
const ALL_EXT = Object.values(CATS).flatMap((c) => c.exts);
const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/* ---------- admin-configurable settings (stored in data/db.json) ---------- */
const DEFAULTS = () => ({
  allowed: ALL_EXT.slice(),
  maxMB: { image: 10, pdf: 25, document: 25, audio: 40, video: 100 },
  quotaMB: 500, maxFiles: 200, blockActivePdf: true, blockMacros: true, reportsToSuspend: 3,
});
const clamp = (v, lo, hi, d) => { v = parseInt(v, 10); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

db.files = db.files || [];
if (!db.secret) { db.secret = crypto.randomBytes(32).toString('hex'); save(); }
db.settings = Object.assign(DEFAULTS(), db.settings || {});
db.settings.maxMB = Object.assign(DEFAULTS().maxMB, db.settings.maxMB || {});
Object.keys(CATS).forEach((k) => { db.settings.maxMB[k] = clamp(db.settings.maxMB[k], 1, HARD_MAX_MB, DEFAULTS().maxMB[k]); });

function updateSettings(i) {
  const out = JSON.parse(JSON.stringify(db.settings));
  if (Array.isArray(i.allowed)) out.allowed = [...new Set(i.allowed.map((x) => String(x).toLowerCase()).filter((x) => ALL_EXT.includes(x)))];
  if (i.maxMB && typeof i.maxMB === 'object') Object.keys(CATS).forEach((k) => { if (i.maxMB[k] !== undefined) out.maxMB[k] = clamp(i.maxMB[k], 1, HARD_MAX_MB, out.maxMB[k]); });
  if (i.quotaMB !== undefined) out.quotaMB = clamp(i.quotaMB, 10, 1000000, out.quotaMB);
  if (i.maxFiles !== undefined) out.maxFiles = clamp(i.maxFiles, 1, 100000, out.maxFiles);
  if (i.reportsToSuspend !== undefined) out.reportsToSuspend = clamp(i.reportsToSuspend, 1, 100, out.reportsToSuspend);
  if (i.blockActivePdf !== undefined) out.blockActivePdf = !!i.blockActivePdf;
  if (i.blockMacros !== undefined) out.blockMacros = !!i.blockMacros;
  db.settings = out; save();
  return out;
}

/* ---------- helpers ---------- */
const extOf = (n) => path.extname(String(n || '')).slice(1).toLowerCase();
const catOf = (ext) => Object.keys(CATS).find((k) => CATS[k].exts.includes(ext)) || null;
const usedBytes = (uid) => db.files.reduce((a, f) => a + (f.uid === uid ? f.size : 0), 0);

// multer may hand us UTF-8 names decoded as latin1 — repair that
function fixUtf8(n) {
  n = String(n || '');
  if (/[\u0080-\u00ff]/.test(n) && !/[^\u0000-\u00ff]/.test(n)) {
    const t = Buffer.from(n, 'latin1').toString('utf8');
    if (!t.includes('\ufffd')) return t;
  }
  return n;
}
// filename sanitization: no paths, control chars, bidi tricks, reserved characters
function cleanName(n, fallback) {
  n = String(n || '').normalize('NFC').split(/[\\/]/).pop();
  n = n.replace(/[\u0000-\u001f\u007f<>:"|?*\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  if (n.length > 120) { const e = path.extname(n).slice(0, 12); n = n.slice(0, 120 - e.length) + e; }
  return n || (fallback === undefined ? 'file' : fallback);
}

const hashPw = (pw) => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex'); };
const checkPw = (pw, stored) => {
  try {
    const [salt, h] = String(stored).split(':');
    const x = crypto.scryptSync(String(pw), salt, 64), y = Buffer.from(h, 'hex');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  } catch (e) { return false; }
};

/* ---------- signed, expiring tokens (HMAC-SHA256) ---------- */
function sign(code, ttlMs, owner) {
  const p = Buffer.from(JSON.stringify({ c: code, e: Date.now() + ttlMs, o: owner ? 1 : 0 })).toString('base64url');
  return p + '.' + crypto.createHmac('sha256', db.secret).update(p).digest('base64url');
}
function verify(tok, code) {
  if (!tok || typeof tok !== 'string' || tok.length > 400) return null;
  const [p, h] = tok.split('.');
  if (!p || !h) return null;
  const x = crypto.createHmac('sha256', db.secret).update(p).digest();
  let y; try { y = Buffer.from(h, 'base64url'); } catch (e) { return null; }
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
  let d; try { d = JSON.parse(Buffer.from(p, 'base64url').toString()); } catch (e) { return null; }
  return d && d.c === code && d.e > Date.now() ? d : null;
}

/* ---------- optional ClamAV (used automatically if `clamscan` is installed) ---------- */
const scanner = { clam: false };
execFile('clamscan', ['--version'], { timeout: 8000 }, (e) => { scanner.clam = !e; });
function clamScan(fp) {
  return new Promise((res) => {
    if (!scanner.clam) return res({ ran: false });
    execFile('clamscan', ['--no-summary', fp], { timeout: 120000 }, (err, stdout) => {
      if (!err) return res({ ran: true, infected: false });
      if (err.code === 1) return res({ ran: true, infected: true, sig: String(stdout).split(':').pop().replace(/\s*FOUND\s*$/, '').trim() });
      res({ ran: false });
    });
  });
}

/* ---------- content validation: magic bytes + active-content heuristics + optional AV ---------- */
async function inspect(fp, ext, size) {
  const cat = catOf(ext), st = db.settings;
  let fh, head;
  try {
    fh = await fs.promises.open(fp, 'r');
    head = Buffer.alloc(Math.min(size, 8192));
    await fh.read(head, 0, head.length, 0);
  } finally { if (fh) await fh.close(); }
  const s = (a, b) => head.slice(a, b).toString('latin1');
  const at = (arr, off) => arr.every((v, i) => head[(off || 0) + i] === v);
  let ok = false;
  switch (ext) {
    case 'jpg': case 'jpeg': ok = at([0xff, 0xd8, 0xff]); break;
    case 'png': ok = at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); break;
    case 'gif': ok = /^GIF8[79]a/.test(s(0, 6)); break;
    case 'webp': ok = s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP'; break;
    case 'pdf': ok = head.slice(0, 1024).toString('latin1').includes('%PDF-'); break;
    case 'doc': case 'xls': case 'ppt': ok = at([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); break;
    case 'docx': case 'xlsx': case 'pptx': ok = at([0x50, 0x4b, 0x03, 0x04]) && head.includes('[Content_Types].xml'); break;
    case 'txt': ok = !head.includes(0); break;
    case 'mp3': ok = s(0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0); break;
    case 'wav': ok = s(0, 4) === 'RIFF' && s(8, 12) === 'WAVE'; break;
    case 'm4a': case 'mp4': ok = s(4, 8) === 'ftyp'; break;
    case 'mov': ok = ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(s(4, 8)); break;
    case 'webm': ok = at([0x1a, 0x45, 0xdf, 0xa3]); break;
  }
  if (!ok) return { ok: false, error: `The file contents don't match its extension (.${ext}). Upload a genuine ${CATS[cat].label.toLowerCase()} file.` };

  const checkPdf = ext === 'pdf' && st.blockActivePdf, checkOffice = cat === 'document' && ext !== 'txt' && st.blockMacros;
  if ((checkPdf || checkOffice) && size <= 64 * 1048576) {
    const buf = await fs.promises.readFile(fp);
    if (checkPdf && /\/(Launch|JavaScript|JS)\b/.test(buf.toString('latin1'))) return { ok: false, error: 'PDFs with embedded scripts or launch actions are not allowed.' };
    if (checkOffice && (buf.includes('vbaProject') || buf.includes(Buffer.from('_VBA_PROJECT', 'utf16le')))) return { ok: false, error: 'Documents containing macros are not allowed.' };
  }
  const av = await clamScan(fp);
  if (av.infected) return { ok: false, error: `Malware detected${av.sig ? ' (' + av.sig + ')' : ''}. Upload blocked.` };
  return { ok: true, scanned: !!av.ran };
}

module.exports = { STORAGE, HARD_MAX_MB, CATS, ALL_EXT, MIME, scanner, extOf, catOf, usedBytes, fixUtf8, cleanName, hashPw, checkPw, sign, verify, inspect, updateSettings };
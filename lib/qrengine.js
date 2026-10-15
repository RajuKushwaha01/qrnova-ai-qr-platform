'use strict';
const QRCode = require('qrcode');

const CAP = { L: 2953, M: 2331, Q: 1663, H: 1273 }; // max bytes at version 40
const LEVELS = ['L', 'M', 'Q', 'H'];
const fail = (m) => Object.assign(new Error(m), { status: 400 });
const level = (v) => { v = String(v || 'M').toUpperCase(); return LEVELS.includes(v) ? v : 'M'; };
const clamp = (v, lo, hi, d) => { v = parseInt(v, 10); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const hex = (v, d) => { v = String(v || '').trim(); return /^#?[0-9a-f]{6}$/i.test(v) ? '#' + v.replace('#', '') : d; };

/* Encode text (UTF-8, automatic version) and return the module matrix + statistics */
function analyze(text, ecl) {
  text = String(text == null ? '' : text);
  if (!text) throw fail('Nothing to encode yet.');
  const e = level(ecl);
  const bytes = Buffer.byteLength(text, 'utf8');
  let q;
  try { q = QRCode.create(text, { errorCorrectionLevel: e }); }
  catch (err) {
    throw fail(`Content is too long for a QR code (${bytes} bytes; roughly ${CAP[e]} max at level ${e}). Shorten it, lower error correction or use a Dynamic QR.`);
  }
  const n = q.modules.size, rows = [];
  for (let r = 0; r < n; r++) {
    let s = '';
    for (let c = 0; c < n; c++) s += q.modules.get(r, c) ? '1' : '0';
    rows.push(s);
  }
  const modes = [...new Set((q.segments || []).map((s) => s && s.mode && s.mode.id).filter(Boolean))];
  return {
    size: n, version: q.version, ecl: e, bytes, chars: Array.from(text).length,
    capacity: CAP[e], usage: Math.max(1, Math.min(100, Math.round((bytes / CAP[e]) * 100))), modes, rows,
  };
}

/* Server-side SVG / PNG rendering (used by /api/qr.svg and /api/qr.png) */
async function render(text, o, fmt) {
  o = o || {};
  const info = analyze(text, o.ecl); // validates + friendly errors
  const opt = {
    errorCorrectionLevel: info.ecl,
    margin: clamp(o.margin, 0, 16, 4),
    width: clamp(o.size, 128, 4096, 512), // minimum 128 px, maximum 4096 px
    color: { dark: hex(o.fg, '#000000'), light: o.bg === 'transparent' ? '#ffffff00' : hex(o.bg, '#ffffff') },
  };
  if (fmt === 'svg') return QRCode.toString(text, Object.assign({}, opt, { type: 'svg' }));
  return QRCode.toBuffer(text, Object.assign({}, opt, { type: 'png' }));
}

module.exports = { analyze, render, CAP };
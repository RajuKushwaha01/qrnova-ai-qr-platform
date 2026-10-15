'use strict';
const zlib = require('zlib');

let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch (e) { /* optional: PDF reading is disabled if the package is missing */ }

const MAX_CHARS = 20000;

// minimal ZIP reader (enough to pull word/document.xml out of a .docx)
function zipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This is not a valid DOCX file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    if (name === wanted) {
      const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
      const data = buf.subarray(start, start + csize);
      return method === 0 ? data : zlib.inflateRawSync(data, { maxOutputLength: 24 * 1048576 });
    }
    p += 46 + nlen + elen + clen;
  }
  return null;
}

const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, d) => (+d < 0x110000 ? String.fromCodePoint(+d) : '')).replace(/&amp;/g, '&');

function docxText(buf) {
  const xml = zipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('Could not find any text in this DOCX file.');
  return unxml(xml.toString('utf8').replace(/<w:tab\s*\/>/g, '\t').replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''));
}

async function pdfText(buf) {
  if (!pdfParse) throw Object.assign(new Error('PDF reading needs the "pdf-parse" package. Run: npm install'), { status: 501 });
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Reading this PDF took too long.')), 20000); });
  try { const r = await Promise.race([pdfParse(buf, { max: 15 }), timeout]); return { text: r.text || '', pages: r.numpages }; }
  finally { clearTimeout(timer); }
}

exports.extract = async function (buf, ext) {
  let text = '', pages;
  if (ext === 'docx') {
    if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('This is not a valid DOCX file.');
    text = docxText(buf);
  } else if (ext === 'pdf') {
    if (!buf.subarray(0, 1024).toString('latin1').includes('%PDF-')) throw new Error('This is not a valid PDF file.');
    const r = await pdfText(buf); text = r.text; pages = r.pages;
  } else throw new Error('Unsupported file type.');
  text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('No readable text found. Scanned PDFs are images — upload a screenshot instead and I will read it with OCR.');
  return { text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS, pages, chars: text.length };
};
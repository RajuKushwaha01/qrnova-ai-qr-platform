'use strict';
const fs = require('fs');
const path = require('path');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) { /* optional dependency */ }

const FROM = process.env.MAIL_FROM || 'QRNova <no-reply@qrnova.local>';
const transport = process.env.SMTP_URL && nodemailer ? nodemailer.createTransport(process.env.SMTP_URL) : null;
const LOG = path.join(__dirname, '..', 'data', 'outbox.log');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function html(title, lines, cta) {
  return `<!doctype html><html><body style="margin:0;background:#07071a;padding:24px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;overflow:hidden"><div style="background:linear-gradient(120deg,#7c5cff,#22d3ee);padding:22px;color:#fff;font-size:22px;font-weight:700">QRNova</div><div style="padding:26px;color:#111827;line-height:1.6"><h2 style="margin:0 0 12px">${esc(title)}</h2>${lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}${cta ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#6d28d9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700;display:inline-block">${esc(cta.label)}</a></p><p style="font-size:12px;color:#6b7280;word-break:break-all">Or paste this link: ${esc(cta.url)}</p>` : ''}</div></div></body></html>`;
}

// With SMTP_URL set (and `nodemailer` installed) mail is really sent.
// Otherwise it is printed in the terminal and appended to data/outbox.log (dev mode).
async function send({ to, subject, title, lines, cta }) {
  const text = [title, '', ...lines, cta ? '\n' + cta.label + ': ' + cta.url : ''].join('\n');
  if (transport) { await transport.sendMail({ from: require('./settings').get().email.from || FROM, to, subject, text, html: html(title, lines, cta) }); return { sent: true }; }
  console.log(`\n  ✉️  [DEV MAIL — no SMTP configured] to ${to}\n  Subject: ${subject}\n  ${text.split('\n').join('\n  ')}\n`);
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFile(LOG, `[${new Date().toISOString()}] to ${to} | ${subject}\n${text}\n\n`, () => {}); } catch (e) { /* ignore */ }
  return { sent: false };
}

module.exports = { send, real: !!transport };
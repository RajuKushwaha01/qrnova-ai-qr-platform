'use strict';
const crypto = require('crypto');
const multer = require('multer');
const { db, save } = require('./db');
const { extract } = require('./extract');

const MAX_SESSIONS = 100, MAX_MSGS = 300, MAX_TEXT = 4000, MAX_RESULT = 16000;
const TYPES = ['text', 'url', 'email', 'phone', 'sms', 'whatsapp', 'telegram', 'social', 'vcard', 'wifi', 'upi', 'location', 'event', 'business', 'menu', 'product', 'review', 'payurl', 'file'];
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
// passwords typed into a prompt are never written to history
const redact = (s) => String(s).replace(/\b(password|passcode|passwd|pwd|pass(?=\s*(?:is|=|:)))(\s*(?:is|=|:)?\s*)["“']?[^\s"”',;]+["”']?/gi, '$1$2••••••');

function cleanResult(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return undefined;
  let j; try { j = JSON.parse(JSON.stringify(r)); } catch (e) { return undefined; }
  if (!TYPES.includes(j.type)) return undefined;
  if (j.type === 'wifi') { delete j.payload; if (j.fields) delete j.fields.pass; } // Wi-Fi passwords are never stored
  if (typeof j.prompt === 'string') j.prompt = redact(clip(j.prompt, 600));
  return JSON.stringify(j).length <= MAX_RESULT ? j : undefined;
}
function cleanMsg(m) {
  m = m || {};
  const out = { id: crypto.randomBytes(6).toString('hex'), role: m.role === 'ai' ? 'ai' : 'user', t: Date.now(), text: redact(clip(m.text, MAX_TEXT)) };
  const r = cleanResult(m.result); if (r) out.result = r;
  return out;
}
function brief(s) {
  const last = s.messages[s.messages.length - 1];
  let type = '';
  for (let i = s.messages.length - 1; i >= 0; i--) { const r = s.messages[i].result; if (r && r.type) { type = r.type; break; } }
  return { id: s.id, title: s.title, pinned: !!s.pinned, created: s.created, updated: s.updated, count: s.messages.length, type, last: last ? clip(last.text.replace(/\s+/g, ' '), 90) : '' };
}
const full = (s) => ({ id: s.id, title: s.title, pinned: !!s.pinned, created: s.created, updated: s.updated, messages: s.messages });

module.exports = function mount(app, { auth, limit }) {
  db.aiSessions = db.aiSessions || [];
  const own = (req) => db.aiSessions.find((s) => s.id === req.params.id && s.uid === req.user.id);

  app.get('/api/ai/sessions', auth, (req, res) => {
    const items = db.aiSessions.filter((s) => s.uid === req.user.id)
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated).map(brief);
    res.json({ items });
  });

  app.post('/api/ai/sessions', auth, limit(30, 60e3), (req, res) => {
    const mine = db.aiSessions.filter((s) => s.uid === req.user.id);
    if (mine.length >= MAX_SESSIONS) {
      const old = mine.filter((s) => !s.pinned).sort((a, b) => a.updated - b.updated)[0];
      if (!old) return res.status(400).json({ error: 'Session limit reached. Delete some sessions first.' });
      db.aiSessions.splice(db.aiSessions.indexOf(old), 1);
    }
    const s = { id: crypto.randomUUID(), uid: req.user.id, title: redact(clip((req.body || {}).title || 'New session', 80)), pinned: false, created: Date.now(), updated: Date.now(), messages: [] };
    db.aiSessions.push(s); save();
    res.json(full(s));
  });

  app.get('/api/ai/sessions/:id', auth, (req, res) => {
    const s = own(req);
    if (!s) return res.status(404).json({ error: 'Session not found.' });
    res.json(full(s));
  });

  app.post('/api/ai/sessions/:id/messages', auth, limit(120, 60e3), (req, res) => {
    const s = own(req);
    if (!s) return res.status(404).json({ error: 'Session not found.' });
    const list = Array.isArray((req.body || {}).messages) ? req.body.messages.slice(0, 4) : [];
    if (!list.length) return res.status(400).json({ error: 'No messages.' });
    if (s.messages.length + list.length > MAX_MSGS) return res.status(400).json({ error: 'This session is full. Start a new one.' });
    const added = list.map(cleanMsg);
    s.messages.push(...added);
    if (s.title === 'New session' && req.body.title) s.title = redact(clip(req.body.title, 80));
    s.updated = Date.now(); save();
    res.json({ ok: true, messages: added, title: s.title });
  });

  app.put('/api/ai/sessions/:id', auth, limit(60, 60e3), (req, res) => {
    const s = own(req);
    if (!s) return res.status(404).json({ error: 'Session not found.' });
    const b = req.body || {};
    if (b.title !== undefined) { const t = redact(clip(b.title, 80)).trim(); if (!t) return res.status(400).json({ error: 'Title cannot be empty.' }); s.title = t; }
    if (b.pinned !== undefined) s.pinned = b.pinned === true || b.pinned === 'true';
    save(); res.json(brief(s));
  });

  app.delete('/api/ai/sessions/:id', auth, (req, res) => {
    const i = db.aiSessions.findIndex((s) => s.id === req.params.id && s.uid === req.user.id);
    if (i < 0) return res.status(404).json({ error: 'Session not found.' });
    db.aiSessions.splice(i, 1); save(); res.json({ ok: true });
  });
  app.delete('/api/ai/sessions', auth, (req, res) => {
    db.aiSessions = db.aiSessions.filter((s) => s.uid !== req.user.id); save(); res.json({ ok: true });
  });

  // PDF / DOCX → plain text (TXT, VCF, CSV and images are read in the browser)
  const mem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1048576, files: 1, fields: 4 } });
  app.post('/api/ai/extract', auth, limit(15, 60e3), (req, res) => {
    mem.single('file')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large for text extraction (max 8 MB).' : err.message || 'Upload failed.' });
      if (!req.file) return res.status(400).json({ error: 'Choose a file.' });
      const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
      if (!['pdf', 'docx'].includes(ext)) return res.status(400).json({ error: 'Only PDF and DOCX are read on the server.' });
      try { res.json(await extract(req.file.buffer, ext)); }
      catch (e) { res.status(e.status || 422).json({ error: e.message || 'Could not read this file.' }); }
    });
  });
};
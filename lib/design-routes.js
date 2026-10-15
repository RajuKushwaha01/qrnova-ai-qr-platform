'use strict';
const crypto = require('crypto');
const { db, save } = require('./db');

const MAX_DESIGNS = 30, MAX_BYTES = 350 * 1024;
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

module.exports = function mount(app, { auth, limit }) {
  db.designs = db.designs || [];
  const own = (req) => db.designs.find((d) => d.id === req.params.id && d.uid === req.user.id);
  const brief = (d) => ({ id: d.id, name: d.name, updated: d.updated, bytes: d.bytes });

  app.get('/api/designs', auth, (req, res) => {
    res.json({ items: db.designs.filter((d) => d.uid === req.user.id).sort((a, b) => b.updated - a.updated).map(brief) });
  });

  app.get('/api/designs/:id', auth, (req, res) => {
    const d = own(req);
    if (!d) return res.status(404).json({ error: 'Design not found.' });
    res.json({ id: d.id, name: d.name, design: d.design });
  });

  app.post('/api/designs', auth, limit(30, 60e3), (req, res) => {
    const name = clip((req.body || {}).name, 60).trim();
    const design = (req.body || {}).design;
    if (!name) return res.status(400).json({ error: 'Give your design a name.' });
    if (!design || typeof design !== 'object' || Array.isArray(design)) return res.status(400).json({ error: 'Invalid design.' });
    delete design.data; // only the look is stored, never what the QR contains (it may hold a Wi-Fi password)
    let json;
    try { json = JSON.stringify(design); } catch (e) { return res.status(400).json({ error: 'Invalid design.' }); }
    if (json.length > MAX_BYTES) return res.status(400).json({ error: 'This design is too large to save (logo or background image over ~350 KB). Use a smaller image.' });
    const mine = db.designs.filter((d) => d.uid === req.user.id);
    const same = mine.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (same) {
      same.design = JSON.parse(json); same.bytes = json.length; same.updated = Date.now(); save();
      return res.json(Object.assign(brief(same), { replaced: true }));
    }
    if (mine.length >= MAX_DESIGNS) return res.status(400).json({ error: `You can save up to ${MAX_DESIGNS} designs. Delete one first.` });
    const d = { id: crypto.randomUUID(), uid: req.user.id, name, design: JSON.parse(json), bytes: json.length, created: Date.now(), updated: Date.now() };
    db.designs.push(d); save();
    res.json(brief(d));
  });

  app.delete('/api/designs/:id', auth, (req, res) => {
    const i = db.designs.findIndex((d) => d.id === req.params.id && d.uid === req.user.id);
    if (i < 0) return res.status(404).json({ error: 'Design not found.' });
    db.designs.splice(i, 1); save();
    res.json({ ok: true });
  });
};
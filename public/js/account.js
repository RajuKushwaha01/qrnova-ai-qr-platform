(() => {
  const { $, $$, api, toast, esc } = QRX;

  /* ---------- login / signup ---------- */
  const af = $('#authForm');
  if (af) af.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = af.querySelector('button'); b.disabled = true; $('#authMsg').textContent = '';
    try {
      const r = await api('/api/auth/' + af.dataset.mode, { method: 'POST', body: Object.fromEntries(new FormData(af)) });
      QRX.setAuth(r.token, r.user);
      const n = new URLSearchParams(location.search).get('next');
      location.href = n && /^\/(?!\/)/.test(n) ? n : '/dashboard';
    } catch (err) { $('#authMsg').textContent = err.message; b.disabled = false; }
  });

  /* ---------- contact ---------- */
  const cf = $('#contactForm');
  if (cf) cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/contact', { method: 'POST', body: Object.fromEntries(new FormData(cf)) }); cf.reset(); $('#cMsg').textContent = ''; toast('Message sent — thank you!'); }
    catch (err) { $('#cMsg').textContent = err.message; }
  });

  /* ---------- dashboard ---------- */
  if (!$('#dash')) return;
  if (!QRX.token()) { location.href = '/login?next=/dashboard'; return; }
  const STYLE = { fg: '#7c5cff', fg2: '#22d3ee', bg: '#ffffff', eye: '#ff5ea8', dots: 'rounded', eyes: 'rounded', margin: 2 };
  let items = [];

  async function load() {
    try { items = (await api('/api/dynamic')).items; }
    catch (e) { if (/log in|Account/i.test(e.message)) { location.href = '/login?next=/dashboard'; return; } return toast(e.message); }
    const u = QRX.user(); $('#hello').textContent = u ? `Welcome back, ${u.name}` : '';
    const week = Array(7).fill(0), dev = {};
    items.forEach((q) => { q.days.forEach((d, i) => (week[i] += d)); Object.entries(q.dev).forEach(([k, v]) => (dev[k] = (dev[k] || 0) + v)); });
    const top = Object.entries(dev).sort((a, b) => b[1] - a[1])[0];
    $('#kpis').innerHTML = [['Dynamic QRs', items.length], ['Total scans', items.reduce((a, q) => a + q.scans, 0)], ['Scans (7 days)', week.reduce((a, b) => a + b, 0)], ['Top device', top ? top[0] : '—']].map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    const max = Math.max(1, ...week);
    const lbl = week.map((_, i) => new Date(Date.now() - (6 - i) * 864e5).toLocaleDateString(undefined, { weekday: 'short' }));
    $('#chart').innerHTML = `<div class="bars">${week.map((d, i) => `<div><span>${d}</span><i style="height:0" data-h="${Math.max(4, (d / max) * 100)}%"></i><span>${lbl[i]}</span></div>`).join('')}</div>`;
    requestAnimationFrame(() => setTimeout(() => $$('#chart i').forEach((i) => (i.style.height = i.dataset.h)), 50));

    $('#list').innerHTML = items.length ? items.map((q) => `<div class="card qrc"><div class="thumb" data-url="${esc(q.url)}"></div><div><h4>${esc(q.title)}</h4>
      <small>${esc(q.url)}</small><small>${q.kind === 'url' ? '→ ' + esc(q.target) : q.kind === 'page' ? '🧩 Smart page' : '📎 ' + esc(q.fileName || 'File')}</small>
      <p><b>${q.scans}</b> scans</p><div class="acts"><button class="btn btn-ghost sm" data-a="edit" data-c="${q.code}">✏️ Edit</button><button class="btn btn-ghost sm" data-a="dl" data-c="${q.code}">⬇️ PNG</button><button class="btn btn-ghost sm" data-a="copy" data-c="${q.code}">📋 Link</button><button class="btn btn-ghost sm" data-a="del" data-c="${q.code}">🗑️</button></div></div></div>`).join('')
      : `<div class="card" style="grid-column:1/-1;text-align:center"><h3>No dynamic QR codes yet</h3><p>Create one and it will appear here with live scan analytics.</p></div>`;
    $$('.thumb').forEach(async (t) => { try { const m = await QRX.matrix(t.dataset.url, 'M'); t.innerHTML = QRX.svg(m.rows, { ...STYLE, size: 200 }); t.querySelector('svg').style.cssText = 'width:100%;height:100%'; } catch {} });
  }

  const dlg = $('#dlg');
  function editFields(q) {
    let h = `<div class="fld"><label>Title</label><input class="in" name="title" value="${esc(q.title)}"></div>`;
    if (q.kind === 'url') h += `<div class="fld"><label>Destination link</label><input class="in" name="target" value="${esc(q.target)}"></div>`;
    if (q.kind === 'page') Object.entries(q.data || {}).forEach(([k, v]) => (h += `<div class="fld"><label>${esc(({ name: 'Name', desc: 'Description', pid: 'Product ID', hours: 'Opening hours', maps: 'Map link', buy: 'Purchase URL' })[k] || k)}</label><textarea class="in" data-d="${esc(k)}" rows="2">${esc(v)}</textarea></div>`));
    if (q.kind !== 'url') h += `<div class="fld"><label>${q.kind === 'file' ? 'Replace file' : 'Attach / replace file'}</label><input class="in" type="file" name="file"></div>`;
    return h;
  }
  let editing = null;
  $('#dlgCancel').onclick = () => dlg.close();
  $('#dlgForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(), f = e.target;
    fd.append('title', f.title.value);
    if (f.target) fd.append('target', f.target.value);
    const d = {}; $$('[data-d]', f).forEach((i) => (d[i.dataset.d] = i.value)); if (Object.keys(d).length) fd.append('data', JSON.stringify(d));
    if (f.file && f.file.files[0]) fd.append('file', f.file.files[0]);
    try { await api('/api/dynamic/' + editing, { method: 'PUT', body: fd }); dlg.close(); toast('Saved — your printed QR now shows the new content'); load(); }
    catch (err) { toast(err.message); }
  });

  $('#list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const q = items.find((x) => x.code === b.dataset.c); if (!q) return;
    if (b.dataset.a === 'edit') { editing = q.code; $('#dlgFields').innerHTML = editFields(q); dlg.showModal(); }
    if (b.dataset.a === 'copy') navigator.clipboard.writeText(q.url).then(() => toast('Link copied'));
    if (b.dataset.a === 'dl') { const m = await QRX.matrix(q.url, 'M'); QRX.save(await QRX.raster(QRX.svg(m.rows, { ...STYLE, margin: 3, size: 1024 }), 1024), `qrnova-${q.code}.png`); }
    if (b.dataset.a === 'del' && confirm('Delete this QR code? Printed copies will stop working.')) { try { await api('/api/dynamic/' + q.code, { method: 'DELETE' }); toast('Deleted'); load(); } catch (err) { toast(err.message); } }
  });
  load();
})();
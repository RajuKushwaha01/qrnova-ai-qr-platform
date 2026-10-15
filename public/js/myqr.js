(() => {
  'use strict';
  const { $, $$, esc, toast, api } = QRX;
  if (!$('#mq')) return;
  if (!QRX.token()) { location.href = '/login?next=/my-qr-codes'; return; }

  const TZ = -new Date().getTimezoneOffset(), en = encodeURIComponent;
  const ICON = { text: '📝', url: '🔗', email: '✉️', phone: '📞', sms: '💬', whatsapp: '🟢', telegram: '✈️', social: '🌐', vcard: '👤', business: '🏢', website: '🖥️', menu: '🍽️', product: '📦', review: '⭐', location: '📍', wifi: '📶', upi: '💸', payurl: '💳', event: '📅', custom: '🧩', file: '📎', image: '🖼️', pdf: '📄', video: '🎬', audio: '🎵', document: '📁' };
  const EVI = { created: '✨', updated: '✏️', downloaded: '⬇️', shared: '🔗', scanned: '📲', deleted: '🗑️' };
  const EVW = { created: 'Created', updated: 'Updated', downloaded: 'Downloaded', shared: 'Shared', scanned: 'Scanned', deleted: 'Deleted' };
  const LOOK = { fg: '#6d28d9', fg2: '#0e7490', bg: '#ffffff', eye: '#be185d', dots: 'rounded', eyes: 'rounded' };
  const STL = { active: ['● Active', 'ok'], inactive: ['⏸ Inactive', 'archived'], expired: ['⏳ Expired', 'suspended'], archived: ['🗃️ Archived', 'archived'], suspended: ['🚫 Suspended', 'suspended'] };
  const ACC = { public: '🌐 Public', private: '🔒 Private', password: '🔑 Password', restricted: '🚧 Restricted' };
  const DL = { name: 'Name', desc: 'Description', tagline: 'Tagline', website: 'Website', phone: 'Phone', email: 'Email', address: 'Address', hours: 'Opening hours', social: 'Social link', maps: 'Map link', review: 'Review URL', menu: 'Menu link', buy: 'Purchase URL', price: 'Price', pid: 'Product ID', company: 'Company' };
  const DEVI = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧', Other: '🌐' };
  const day = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const dt = (t) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ago = (t) => { const d = (Date.now() - t) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : d < 10080 ? Math.round(d / 1440) + ' d ago' : day(t); };
  const local = (ms) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const srcText = (it) => (it.source === 'static' ? it.payload : it.url);
  const evt = (it, ev, meta) => api(`/api/qr/${it.id}/event`, { method: 'POST', body: { ev, meta } }).catch(() => {});

  let items = [], folders = [], cur = null, hevs = [], hf = 'all';
  const V = { q: '', from: '', to: '', mode: 'all', st: 'all', fav: false, folder: 'all', type: 'all', sort: 'new' };
  const cache = new Map();
  const getRows = (text) => {
    if (!cache.has(text)) cache.set(text, QRX.matrix(text, 'M').then((m) => m.rows).catch((e) => { cache.delete(text); throw e; }));
    return cache.get(text);
  };
  const svgOf = (rows, it, px, margin) => QRX.svg(rows, Object.assign({ margin: margin == null ? 4 : margin, size: px }, it.look || LOOK));

  async function load() {
    try { const r = await api('/api/qr'); items = r.items; folders = r.folders; }
    catch (e) { if (/log in|Account/i.test(e.message)) { location.href = '/login?next=/my-qr-codes'; return; } return toast(e.message); }
    render();
  }
  const folderOf = (it) => folders.find((f) => f.id === it.folder);
  const hay = (it) => it._h || (it._h = [it.title, it.content, it.type, it.kind, it.mode, it.fileName, it.url, new Date(it.created).toISOString().slice(0, 10), new Date(it.created).toLocaleDateString('en', { month: 'long', year: 'numeric' })].join(' ').toLowerCase());
  function visible() {
    const toks = V.q.toLowerCase().split(/\s+/).filter(Boolean), f = V.from ? new Date(V.from + 'T00:00:00').getTime() : 0, t = V.to ? new Date(V.to + 'T23:59:59').getTime() : Infinity;
    const S = { new: (a, b) => b.created - a.created, old: (a, b) => a.created - b.created, mod: (a, b) => b.updated - a.updated, scans: (a, b) => b.scans - a.scans, name: (a, b) => a.title.localeCompare(b.title) };
    return items.filter((it) => (V.mode === 'all' || it.mode === V.mode) && (V.st === 'all' || it.status === V.st) && (!V.fav || it.fav) && (V.folder === 'all' || (V.folder === 'none' ? !it.folder : it.folder === V.folder)) && (V.type === 'all' || it.type === V.type) && it.created >= f && it.created <= t && toks.every((k) => hay(it).includes(k))).sort(S[V.sort]);
  }

  /* ---------- thumbnails (loaded only when a card scrolls into view) ---------- */
  const io = new IntersectionObserver((es) => es.forEach(async (e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const it = items.find((x) => x.id === e.target.dataset.id); if (!it) return;
    try { e.target.innerHTML = svgOf(await getRows(srcText(it)), it, 200, 1).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"'); } catch (err) { /* ignore */ }
  }), { rootMargin: '250px' });

  /* ---------- render ---------- */
  function card(it) {
    const st = STL[it.status] || STL.active, fo = folderOf(it), fileLike = it.source === 'file', stat = it.source === 'static';
    const b = [`<span class="bdg">${ICON[it.type] || '▦'} ${esc(it.type)}</span>`, `<span class="bdg ${stat ? '' : 'ok'}">${stat ? '⚡ Static' : '🔄 Dynamic'}</span>`, `<span class="bdg ${st[1]}">${st[0]}</span>`];
    if (!stat && it.access && it.access !== 'public') b.push(`<span class="bdg">${ACC[it.access]}</span>`);
    if (it.expires && it.status === 'active') b.push(`<span class="bdg">⏳ ${day(it.expires)}</span>`);
    if (fo) b.push(`<span class="bdg">${esc(fo.emoji)} ${esc(fo.name)}</span>`);
    const menu = [`<button type="button" data-a="dup">⧉ Duplicate</button>`, it.source === 'qr' ? `<button type="button" data-a="tog">${it.status === 'inactive' ? '▶️ Activate' : '⏸ Deactivate'}</button>` : '', `<button type="button" data-a="arch">${it.status === 'archived' ? '📤 Restore' : '🗃️ Archive'}</button>`, stat ? '' : `<button type="button" data-a="acc">🔐 Access &amp; expiry</button>`, `<button type="button" data-a="hist">🕘 History</button>`, `<button type="button" data-a="move">📁 Move to folder</button>`, `<button type="button" data-a="del" class="dng">🗑️ Delete</button>`].join('');
    return `<article class="card qc" data-id="${it.id}"><button type="button" class="fav${it.fav ? ' on' : ''}" data-a="fav" aria-label="${it.fav ? 'Remove from favorites' : 'Add to favorites'}">★</button>
<div class="qc-th" data-id="${it.id}"></div>
<div class="qc-b"><h4>${esc(it.title)}</h4><div class="badges">${b.join('')}</div>
<small>Created ${day(it.created)} · Modified ${ago(it.updated)}</small><small>${stat ? 'Content is stored inside the code: no scan tracking' : `📲 <b>${it.scans}</b> scan${it.scans === 1 ? '' : 's'}${fileLike ? ` · ⬇️ ${it.downloads || 0}` : ''}`}</small>
<div class="acts"><button type="button" class="btn btn-ghost sm" data-a="view">👁 View</button><button type="button" class="btn btn-ghost sm" data-a="edit">✏️ Edit</button><button type="button" class="btn btn-ghost sm" data-a="dl">⬇️</button><button type="button" class="btn btn-ghost sm" data-a="share">🔗</button><button type="button" class="btn btn-ghost sm" data-a="ana">📊</button>
<details class="mm"><summary class="btn btn-ghost sm" aria-label="More actions">⋯</summary><div class="mm-m">${menu}</div></details></div></div></article>`;
  }
  function renderBar() {
    const cnt = (fn) => items.filter(fn).length;
    $('#mqMode').innerHTML = [['all', 'All'], ['static', 'Static'], ['dynamic', 'Dynamic']].map(([k, l]) => `<button type="button" data-k="mode" data-v="${k}" class="${V.mode === k ? 'on' : ''}">${l} · ${k === 'all' ? items.length : cnt((i) => i.mode === k)}</button>`).join('');
    $('#mqStatus').innerHTML = [['all', 'Any status'], ['active', 'Active'], ['inactive', 'Inactive'], ['expired', 'Expired'], ['archived', 'Archived']].map(([k, l]) => `<button type="button" data-k="st" data-v="${k}" class="${V.st === k ? 'on' : ''}">${l}${k === 'all' ? '' : ' · ' + cnt((i) => i.status === k)}</button>`).join('');
    const fav = $('#mqFav'); fav.classList.toggle('on', V.fav); fav.textContent = '★ Favorites · ' + cnt((i) => i.fav);
    const types = [...new Set(items.map((i) => i.type))].sort();
    $('#mqType').innerHTML = '<option value="all">All types</option>' + types.map((t) => `<option value="${esc(t)}"${V.type === t ? ' selected' : ''}>${ICON[t] || ''} ${esc(t)}</option>`).join('');
    $('#mqFolders').innerHTML = [['all', '▦', 'All QR codes', items.length]].concat(folders.map((f) => [f.id, f.emoji, f.name, cnt((i) => i.folder === f.id)]), [['none', '📂', 'Unfiled', cnt((i) => !i.folder)]]).map(([id, em, nm, n]) => `<button type="button" data-k="folder" data-v="${esc(id)}" class="fo-b${V.folder === id ? ' on' : ''}"><span>${esc(em)}</span><b>${esc(nm)}</b><small>${n}</small></button>`).join('');
  }
  function render() {
    renderBar();
    const L = visible();
    $('#mqCount').textContent = `${L.length} of ${items.length} QR code${items.length === 1 ? '' : 's'}`;
    $('#mqList').innerHTML = L.length ? L.map(card).join('') : `<div class="card" style="grid-column:1/-1;text-align:center"><h3>${items.length ? 'No QR codes match' : "You haven't created any QR codes yet."}</h3><p>${items.length ? 'Try clearing a filter or the search.' : 'Create one with the generator, the AI studio, File → QR or the Design Studio (use “Save to My QR Codes” there for static QR codes).'}</p>${items.length ? '' : '<a class="btn btn-primary" href="/qr-generator" style="margin-top:1rem">Create Your First QR</a>'}</div>`;
    $$('.qc-th').forEach((el) => io.observe(el));
  }

  /* ---------- filters ---------- */
  let sT;
  $('#mqSearch').addEventListener('input', (e) => { clearTimeout(sT); sT = setTimeout(() => { V.q = e.target.value.trim(); render(); }, 120); });
  $('#mqSort').addEventListener('input', (e) => { V.sort = e.target.value; render(); });
  $('#mqFrom').addEventListener('input', (e) => { V.from = e.target.value; render(); });
  $('#mqTo').addEventListener('input', (e) => { V.to = e.target.value; render(); });
  $('#mqType').addEventListener('input', (e) => { V.type = e.target.value; render(); });
  $('#mqFav').onclick = () => { V.fav = !V.fav; render(); };
  $('#mq').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { V[b.dataset.k] = b.dataset.v; render(); } });
  document.addEventListener('click', (e) => { $$('details.mm[open]').forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); }); });
  $$('dialog [data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));

  /* ---------- helpers ---------- */
  async function setStatus(it, s) {
    try { await api(`/api/qr/${it.id}/settings`, { method: 'PUT', body: { status: s } }); toast(s === 'active' ? 'Activated' : s === 'inactive' ? 'Deactivated. Scans now show an “inactive” page' : 'Archived'); load(); } catch (e) { toast(e.message); }
  }
  async function download(it) {
    const rows = await getRows(srcText(it)), svg = svgOf(rows, it, 1024);
    QRX.save(await QRX.raster(svg, 1024, 'image/png'), `qrnova-${it.type}-${it.code}.png`);
    evt(it, 'downloaded', 'PNG'); toast('Downloaded. Use the Design Studio for custom styles, SVG and PDF');
  }

  /* ---------- card actions ---------- */
  $('#mqList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const it = items.find((x) => x.id === b.closest('.qc').dataset.id); if (!it) return;
    const a = b.dataset.a; b.closest('details.mm') && b.closest('details.mm').removeAttribute('open');
    try {
      if (a === 'fav') { const nv = !it.fav; it.fav = nv; render(); try { await api(`/api/qr/${it.id}/settings`, { method: 'PUT', body: { fav: nv } }); } catch (err) { it.fav = !nv; render(); toast(err.message); } return; }
      if (a === 'view') return openView(it);
      if (a === 'edit') return openEdit(it);
      if (a === 'dl') return await download(it);
      if (a === 'share') return window.QRShare ? QRShare.open(it, { getRows, svgOf, evt }) : openShare(it);
      if (a === 'ana') return it.source === 'static' ? openAna(it) : (location.href = '/analytics?id=' + en(it.id));
      if (a === 'dup') { await api(`/api/qr/${it.id}/duplicate`, { method: 'POST' }); toast('Duplicated'); return load(); }
      if (a === 'tog') return setStatus(it, it.status === 'inactive' ? 'active' : 'inactive');
      if (a === 'arch') return setStatus(it, it.status === 'archived' ? 'active' : 'archived');
      if (a === 'acc') return openAcc(it);
      if (a === 'hist') return openHist(it);
      if (a === 'move') return openMove(it);
      if (a === 'del' && confirm(`Delete “${it.title}” permanently? ${it.mode === 'dynamic' ? 'Printed copies of this QR code will stop working.' : ''}`)) { await api('/api/qr/' + it.id, { method: 'DELETE' }); toast('Deleted'); load(); }
    } catch (err) { toast(err.message); }
  });

  /* ---------- view ---------- */
  async function openView(it) {
    cur = it; $('#vTitle').textContent = it.title;
    let svg = ''; try { svg = QRX.framed(await getRows(srcText(it)), Object.assign({ margin: 4 }, it.look || LOOK), '', 640); } catch (e) { /* ignore */ }
    const st = STL[it.status] || STL.active, fo = folderOf(it);
    const rows = [['Type', `${ICON[it.type] || ''} ${it.type}`], ['Kind', it.mode === 'static' ? 'Static (data inside the code)' : 'Dynamic (managed link)'], ['Status', st[0]], ['Access', it.mode === 'static' ? 'Public (the data is in the code)' : ACC[it.access] || ACC.public], ['Folder', fo ? `${fo.emoji} ${fo.name}` : 'Unfiled'], ['Created', day(it.created)], ['Modified', dt(it.updated)], ['Scans', it.mode === 'static' ? 'Not tracked' : String(it.scans)]];
    if (it.expires) rows.push(['Expires', dt(it.expires)]);
    if (it.fileName) rows.push(['File', it.fileName]);
    if (it.kind === 'url') rows.push(['Destination', it.target]);
    $('#vBody').innerHTML = `<div class="qr-stage" style="max-width:300px;margin:0 auto">${svg}</div>${it.url ? `<div class="info"><code>${esc(it.url)}</code></div>` : `<div class="info"><code>${esc(String(it.payload || '').slice(0, 400))}</code></div>`}<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<div class="row2" style="margin-top:1rem;flex-wrap:wrap"><button class="btn btn-ghost sm" data-v="dl">⬇️ PNG</button>${it.url ? '<button class="btn btn-ghost sm" data-v="open">↗ Open (not counted)</button><button class="btn btn-ghost sm" data-v="copy">📋 Copy link</button>' : '<button class="btn btn-ghost sm" data-v="copy">📋 Copy content</button>'}<button class="btn btn-ghost sm" data-v="hist">🕘 History</button></div>`;
    $('#dView').showModal();
  }
  $('#vBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-v]'); if (!b || !cur) return;
    try {
      if (b.dataset.v === 'dl') await download(cur);
      if (b.dataset.v === 'copy') { await navigator.clipboard.writeText(srcText(cur)); toast('Copied'); }
      if (b.dataset.v === 'hist') { $('#dView').close(); openHist(cur); }
      if (b.dataset.v === 'open') { const w = window.open('', '_blank'); const r = await api(`/api/qr/${cur.id}/link`); if (w) w.location = r.url; }
    } catch (err) { toast(err.message); }
  });

  /* ---------- edit (change destination without reprinting) ---------- */
  function openEdit(it) {
    cur = it;
    const fileInput = (label) => `<div class="fld"><label for="eFile">${label}</label><input class="in" type="file" id="eFile" accept=".pdf,image/*"><small class="fh">${it.fileName ? 'Current: ' + esc(it.fileName) : 'No file attached'}</small></div>`;
    let h = `<div class="fld"><label for="eName">Name</label><input class="in" id="eName" maxlength="120" required value="${esc(it.title)}"></div>`;
    if (it.source === 'qr' && it.kind === 'url') h += `<div class="fld"><label for="eTarget">Destination link</label><input class="in" id="eTarget" required value="${esc(it.target || '')}"></div><p class="hint">Old URL → new URL. The printed QR stays exactly the same.</p>`;
    if (it.source === 'qr' && it.kind === 'page') { Object.entries(it.data || {}).forEach(([k, v]) => { h += `<div class="fld"><label>${esc(DL[k] || k)}</label><textarea class="in" data-d="${esc(k)}" rows="${String(v).length > 60 ? 3 : 1}">${esc(v)}</textarea></div>`; }); h += fileInput('Attach or replace the file (old PDF → new PDF, old image → new image)'); }
    if (it.source === 'qr' && it.kind === 'file') h += fileInput('Replace the file (old PDF → new PDF)');
    if (it.source === 'file') h += '<div class="note">Hosted files are replaced and configured in <a class="lnk" href="/my-files">My Files</a>: <b>Replace</b> keeps the same printed QR.</div>';
    if (it.source === 'static') h += `<div class="note">Static QR codes hold their data inside the pattern, so changing the content makes a new code. <a class="lnk" href="/design-studio?qr=${en(it.id)}">Edit content &amp; design in the Design Studio →</a></div>`;
    h += `<div class="fld"><label for="eFolder">Folder</label><select class="in" id="eFolder"><option value="">Unfiled</option>${folders.map((f) => `<option value="${f.id}"${it.folder === f.id ? ' selected' : ''}>${esc(f.emoji)} ${esc(f.name)}</option>`).join('')}</select></div>`;
    $('#eFields').innerHTML = h; $('#dEdit').showModal();
  }
  $('#eForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const it = cur; if (!it) return;
    try {
      if (it.source === 'qr') {
        const fd = new FormData(); fd.append('title', $('#eName').value);
        if (it.kind === 'url') fd.append('target', $('#eTarget').value);
        if (it.kind === 'page') { const d = {}; $$('[data-d]', e.target).forEach((i) => { d[i.dataset.d] = i.value; }); fd.append('data', JSON.stringify(d)); }
        const f = $('#eFile'); if (f && f.files[0]) fd.append('file', f.files[0]);
        await api('/api/dynamic/' + it.code, { method: 'PUT', body: fd });
      }
      const folder = $('#eFolder').value;
      if (it.source !== 'qr' || folder !== (it.folder || '')) await api(`/api/qr/${it.id}/settings`, { method: 'PUT', body: { title: $('#eName').value, folder } });
      $('#dEdit').close(); toast('Saved. Printed QR codes now show the new content'); load();
    } catch (err) { toast(err.message); }
  });

  /* ---------- access, expiry, password, restrictions ---------- */
  const F = () => $('#accForm');
  function syncAcc() {
    const a = F().acc.value, x = F().exp.value;
    $('#accPwWrap').hidden = a !== 'password'; $('#accRestrict').hidden = a !== 'restricted';
    $('#expAt').hidden = x !== 'date'; $('#expDays').hidden = x !== 'days';
  }
  function openAcc(it) {
    cur = it; const f = F(), r = it.restrict || {};
    $('#rdRestricted').hidden = it.source !== 'qr'; $('#dlWrap').hidden = it.source !== 'file';
    f.acc.value = it.access || 'public'; $('#accPw').value = ''; $('#accPwHint').textContent = it.hasPassword ? 'Leave blank to keep the current password.' : '';
    $('#rsMax').value = r.maxScans || 0; $$('[name=dev]', f).forEach((c) => { c.checked = (r.devices || []).includes(c.value); });
    $('#rsFrom').value = r.from || ''; $('#rsTo').value = r.to || '';
    f.exp.value = it.expires ? 'date' : 'never'; $('#expAt').value = it.expires ? local(it.expires) : ''; $('#expDays').value = 30;
    $('#accDl').checked = it.allowDownload !== false; $('#accMsg').textContent = ''; syncAcc(); $('#dAcc').showModal();
  }
  $('#accForm').addEventListener('input', syncAcc);
  $('#accForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const it = cur, f = e.target, m = $('#accMsg'); m.textContent = '';
    const body = { access: f.acc.value };
    if (body.access === 'password' && $('#accPw').value) body.password = $('#accPw').value;
    if (body.access === 'restricted') body.restrict = { maxScans: +$('#rsMax').value || 0, devices: $$('[name=dev]:checked', f).map((c) => c.value), from: $('#rsFrom').value, to: $('#rsTo').value, tz: TZ };
    const x = f.exp.value;
    if (x === 'never') body.expires = '';
    else if (x === 'date') { if (!$('#expAt').value) { m.textContent = 'Choose the expiry date.'; return; } body.expires = new Date($('#expAt').value).toISOString(); }
    else { const d = +$('#expDays').value; if (!(d >= 1)) { m.textContent = 'Enter the number of days.'; return; } body.expires = new Date(Date.now() + d * 864e5).toISOString(); }
    if (it.source === 'file') body.allowDownload = $('#accDl').checked;
    try { await api(`/api/qr/${it.id}/settings`, { method: 'PUT', body }); $('#dAcc').close(); toast('Access settings saved'); load(); } catch (err) { m.textContent = err.message; }
  });

  /* ---------- share (fallback dialog; the full share dialog lives in share.js) ---------- */
  function openShare(it) {
    cur = it; const url = it.url;
    $('#shBody').innerHTML = (url ? `<div class="fld"><label>QR link</label><div class="row2"><input class="in" id="shUrl" readonly value="${esc(url)}"><button class="btn btn-ghost sm" data-c="shUrl">Copy</button>${navigator.share ? '<button class="btn btn-ghost sm" data-n="shUrl">Share…</button>' : ''}</div>${it.access && it.access !== 'public' ? `<small class="fh">This QR is ${esc(it.access)}: people need the password or a signed link below.</small>` : ''}</div>
<div class="fld"><label>Expiring share link</label><div class="row2"><select class="in" id="shDur"><option value="60">1 hour</option><option value="1440" selected>24 hours</option><option value="10080">7 days</option><option value="43200">30 days</option></select><button class="btn btn-primary sm" id="shMake">Create</button></div><small class="fh">Anyone with this signed link can open the page until it expires, even if it is private or password-protected.</small></div><div id="shOut"></div>` : '<p class="hint">Static QR codes carry their data inside the code: share the image.</p>')
      + `<div class="row2" style="margin-top:.8rem"><button class="btn btn-ghost sm" id="shImg">🖼️ Share QR image</button>${it.source === 'static' ? '<button class="btn btn-ghost sm" data-c-text>📋 Copy content</button>' : ''}</div>`;
    $('#dShare').showModal();
  }
  $('#shBody').addEventListener('click', async (e) => {
    const it = cur, c = e.target.closest('[data-c]'), n = e.target.closest('[data-n]');
    try {
      if (c) { await navigator.clipboard.writeText($('#' + c.dataset.c).value); toast('Link copied'); evt(it, 'shared', 'copied link'); }
      if (n) { await navigator.share({ title: it.title, url: $('#' + n.dataset.n).value }); evt(it, 'shared', 'share sheet'); }
      if (e.target.closest('[data-c-text]')) { await navigator.clipboard.writeText(it.payload); toast('Content copied'); evt(it, 'shared', 'copied content'); }
      if (e.target.id === 'shMake') {
        const r = await api(`/api/qr/${it.id}/share-link`, { method: 'POST', body: { minutes: +$('#shDur').value } });
        $('#shOut').innerHTML = `<div class="fld"><label>Valid until ${esc(new Date(r.expires).toLocaleString())}</label><div class="row2"><input class="in" id="shSigned" readonly value="${esc(r.url)}"><button class="btn btn-ghost sm" data-c="shSigned">Copy</button>${navigator.share ? '<button class="btn btn-ghost sm" data-n="shSigned">Share…</button>' : ''}</div></div>`;
      }
      if (e.target.id === 'shImg') {
        const blob = await QRX.toBlob(svgOf(await getRows(srcText(it)), it, 1024), 1024, 1024, 'image/png'), file = new File([blob], 'qrnova.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: it.title }); evt(it, 'shared', 'image'); }
        else { QRX.save(blob, 'qrnova.png'); evt(it, 'downloaded', 'PNG'); toast('Sharing is not supported here. Image downloaded instead'); }
      }
    } catch (err) { if (err && err.name !== 'AbortError') toast(err.message || 'Could not share'); }
  });

  /* ---------- analytics (static QR codes: explains why there are none) ---------- */
  async function openAna(it) { cur = it; $('#aTitle').textContent = 'Analytics · ' + it.title; $('#dAna').showModal(); loadAna(); }
  async function loadAna() {
    const it = cur, box = $('#aBody');
    if (it.source === 'static') { box.innerHTML = '<div class="note" style="margin-top:1rem">Static QR codes keep their data inside the code, so scans can’t be tracked. Create a <b>Dynamic</b> QR code to get analytics.</div>'; return; }
    box.innerHTML = '<p class="hint">Loading…</p>';
    try {
      const r = await api(`/api/qr/${it.id}/analytics?days=${+$('#aDays').value}&tz=${TZ}`);
      const inRange = r.days.counts.reduce((a, b) => a + b, 0), max = Math.max(1, ...r.days.counts), dev = Object.entries(r.devices).sort((a, b) => b[1] - a[1]), dtot = dev.reduce((a, b) => a + b[1], 0);
      const hmax = Math.max(1, ...r.hours), wmax = Math.max(1, ...r.weekdays), WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const tiles = [['Total scans', r.total], ['In this range', inRange], ['Peak hour', r.peakHour == null ? '—' : `${r.peakHour}:00`], ['Top device', dev[0] ? dev[0][0] : '—']];
      if (r.downloads !== undefined) tiles.push(['Downloads', r.downloads]);
      box.innerHTML = `<div class="stats" style="grid-template-columns:repeat(${Math.min(tiles.length, 4)},1fr)">${tiles.map(([l, v]) => `<div class="stat"><b style="font-size:1.5rem">${esc(v)}</b><span>${l}</span></div>`).join('')}</div>
<h4 class="sub-h">Scans per day</h4><div class="abars">${r.days.counts.map((v, i) => `<i style="height:${Math.max(3, (v / max) * 100)}%" title="${esc(r.days.labels[i])}: ${v}"></i>`).join('')}</div><div class="alab"><span>${esc(r.days.labels[0])}</span><span>${esc(r.days.labels[r.days.labels.length - 1])}</span></div>
<h4 class="sub-h">Devices</h4>${dev.length ? dev.map(([k, v]) => `<div class="hb"><span>${DEVI[k] || '🌐'} ${esc(k)}</span><div class="tr"><i style="--w:${Math.round((v / dtot) * 100)}%"></i></div><b>${Math.round((v / dtot) * 100)}%</b></div>`).join('') : '<p class="hint">No scans recorded yet.</p>'}
<h4 class="sub-h">Time of day (your time zone)</h4><div class="heat">${r.hours.map((v, h) => `<i style="--o:${(0.12 + (v / hmax) * 0.88).toFixed(2)}" title="${h}:00 → ${v}"></i>`).join('')}</div><div class="alab"><span>0:00</span><span>12:00</span><span>23:00</span></div>
<h4 class="sub-h">Day of week</h4><div class="abars wk">${r.weekdays.map((v, i) => `<div><i style="height:${Math.max(3, (v / wmax) * 100)}%" title="${WD[i]}: ${v}"></i><small>${WD[i]}</small></div>`).join('')}</div>
<h4 class="sub-h">Latest scans</h4><ul class="tl">${r.recent.length ? r.recent.map((l) => `<li><span class="ti">📲</span><div>${esc(l.d)}</div><time>${dt(l.t)}</time></li>`).join('') : '<li class="hint">No scans yet.</li>'}</ul><p class="hint">${esc(r.note)}</p>`;
    } catch (err) { box.innerHTML = `<p class="hint">${esc(err.message)}</p>`; }
  }
  $('#aDays').addEventListener('input', loadAna);

  /* ---------- history ---------- */
  async function openHist(it) {
    cur = it || null; hf = 'all'; $('#hTitle').textContent = it ? 'History · ' + it.title : 'QR history'; $('#hList').innerHTML = '<li class="hint">Loading…</li>'; $('#dHist').showModal();
    try { hevs = (await api('/api/qr/activity?limit=200' + (it ? '&qid=' + en(it.id) : ''))).items; } catch (e) { hevs = []; toast(e.message); }
    renderHist();
  }
  function renderHist() {
    const cnt = (k) => hevs.filter((e) => e.ev === k).length;
    $('#hChips').innerHTML = [['all', 'All', hevs.length]].concat(Object.keys(EVW).map((k) => [k, EVI[k] + ' ' + EVW[k], cnt(k)])).map(([k, l, n]) => `<button type="button" class="chip${hf === k ? ' on' : ''}" data-h="${k}">${l} · ${n}</button>`).join('');
    const L = hevs.filter((e) => hf === 'all' || e.ev === hf);
    $('#hList').innerHTML = L.length ? L.map((e) => `<li><span class="ti">${EVI[e.ev] || '•'}</span><div><b>${EVW[e.ev] || e.ev}</b> ${esc(e.title || 'a QR code')}${e.meta ? ` <small class="mut">· ${esc(e.meta)}</small>` : ''}</div><time title="${esc(new Date(e.t).toLocaleString())}">${ago(e.t)}</time></li>`).join('') : '<li class="hint">Nothing here yet.</li>';
  }
  $('#hChips').addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (b) { hf = b.dataset.h; renderHist(); } });
  $('#mqHist').onclick = () => openHist(null);

  /* ---------- folders ---------- */
  function renderFolders() {
    $('#fList').innerHTML = folders.map((f) => `<div class="fo" data-id="${f.id}"><span>${esc(f.emoji)}</span><b>${esc(f.name)}</b><small>${items.filter((i) => i.folder === f.id).length}</small><button type="button" data-fr aria-label="Rename">✏️</button><button type="button" data-fd aria-label="Delete">🗑️</button></div>`).join('') || '<p class="hint">No folders yet.</p>';
  }
  $('#mqFold').onclick = () => { renderFolders(); $('#dFold').showModal(); };
  $('#fList').addEventListener('click', async (e) => {
    const row = e.target.closest('.fo'); if (!row) return; const f = folders.find((x) => x.id === row.dataset.id); if (!f) return;
    try {
      if (e.target.closest('[data-fr]')) { const n = window.prompt('Rename folder', f.name); if (n && n.trim()) { await api('/api/folders/' + f.id, { method: 'PUT', body: { name: n.trim() } }); await load(); renderFolders(); } }
      if (e.target.closest('[data-fd]') && confirm(`Delete the folder “${f.name}”? Its QR codes are kept and become unfiled.`)) { await api('/api/folders/' + f.id, { method: 'DELETE' }); if (V.folder === f.id) V.folder = 'all'; await load(); renderFolders(); }
    } catch (err) { toast(err.message); }
  });
  $('#fForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/folders', { method: 'POST', body: { name: $('#fName').value, emoji: $('#fEmoji').value } }); $('#fName').value = ''; await load(); renderFolders(); } catch (err) { toast(err.message); }
  });
  function openMove(it) {
    cur = it; $('#mvSel').innerHTML = `<option value="">Unfiled</option>${folders.map((f) => `<option value="${f.id}"${it.folder === f.id ? ' selected' : ''}>${esc(f.emoji)} ${esc(f.name)}</option>`).join('')}`; $('#dMove').showModal();
  }
  $('#mvForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api(`/api/qr/${cur.id}/settings`, { method: 'PUT', body: { folder: $('#mvSel').value } }); $('#dMove').close(); toast('Moved'); load(); } catch (err) { toast(err.message); }
  });

  $('#mqList').innerHTML = QRX.skeleton(6, 'card');
  load().then(() => { if (location.hash === '#history') openHist(null); });
})();
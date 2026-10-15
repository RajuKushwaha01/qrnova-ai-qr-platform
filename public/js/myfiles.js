(() => {
  const { $, $$, esc, toast, api } = QRX;
  if (!$('#fm')) return;
  if (!QRX.token()) { location.href = '/login?next=/my-files'; return; }
  const fmt = QRX.fmtSize;
  const CI = { image: '🖼️', pdf: '📄', video: '🎬', audio: '🎵', document: '📁' };
  const DOCI = { doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📽️', pptx: '📽️', txt: '📃' };
  const ico = (f) => DOCI[f.ext] || CI[f.cat] || '📁';
  const day = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const stOf = (f) => (f.status === 'suspended' ? 'suspended' : f.archived ? 'archived' : f.expires && f.expires <= Date.now() ? 'expired' : 'active');
  const left = (t) => { const d = t - Date.now(); if (d <= 0) return 'expired'; const h = d / 36e5; return 'in ' + (h < 1 ? Math.ceil(d / 6e4) + ' min' : h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' days'); };
  const local = (ms) => new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const QS = { fg: '#7c5cff', fg2: '#22d3ee', bg: '#ffffff', eye: '#ff5ea8', dots: 'rounded', eyes: 'rounded' };
  const ACC = { public: '🌐 Public', password: '🔑 Password', private: '🔒 Private' };
  let items = [], usage = { used: 0, quota: 1 }, V = { q: '', st: 'active', cat: 'all', sort: 'new' }, cur = null, curRows = null, replaceId = null;
  const qc = new Map();

  async function load() {
    try { const r = await api('/api/files'); items = r.items; usage = r.usage; }
    catch (e) { if (/log in|Account/i.test(e.message)) { location.href = '/login?next=/my-files'; return; } return toast(e.message); }
    kpis(); render();
  }
  function kpis() {
    const tv = items.reduce((a, f) => a + f.views, 0), td = items.reduce((a, f) => a + f.downloads, 0), pct = Math.min(100, Math.round((usage.used / usage.quota) * 100));
    $('#fmKpis').innerHTML = [['Files', items.length], ['Total views', tv], ['Downloads', td], ['Storage', fmt(usage.used) + ' / ' + fmt(usage.quota)]].map(([l, v]) => `<div class="stat"><b style="${String(v).length > 8 ? 'font-size:1.3rem' : ''}">${v}</b><span>${l}</span></div>`).join('');
    $('#fmMeter').style.width = pct + '%';
  }

  function card(f) {
    const st = stOf(f), max = Math.max(1, ...f.days);
    const b = [`<span class="bdg">${ACC[f.access]}</span>`, `<span class="bdg ${st}">${st === 'active' ? '● Active' : st === 'expired' ? '⏳ Expired' : st === 'archived' ? '🗃️ Archived' : '🚫 Suspended'}</span>`];
    if (f.expires && st === 'active') b.push(`<span class="bdg">⏳ ${left(f.expires)}</span>`);
    if (!f.allowDownload) b.push('<span class="bdg">👁 View only</span>');
    if (f.scanned) b.push('<span class="bdg ok">🛡️ AV scanned</span>');
    if (f.reports) b.push(`<span class="bdg suspended">⚑ ${f.reports} report${f.reports > 1 ? 's' : ''}</span>`);
    return `<div class="card fcard" data-id="${f.id}">
  <div class="fthumb">${f.cat === 'image' ? `<img src="${esc(f.prev)}" alt="" loading="lazy">` : ico(f)}</div>
  <div class="fbody"><h4>${esc(f.title)}</h4><small>${esc(f.name)} · ${fmt(f.size)}</small><div class="badges">${b.join('')}</div>
    <small>👁 ${f.views} views · ⬇️ ${f.downloads} downloads · ${day(f.created)}</small>
    <div class="spark" title="Views, last 7 days">${f.days.map((d) => `<i style="height:${Math.max(8, (d / max) * 100)}%"></i>`).join('')}</div>
    <div class="acts"><button class="btn btn-ghost sm" data-a="prev">👁 Preview</button><button class="btn btn-ghost sm" data-a="qr">▦ QR</button><button class="btn btn-ghost sm" data-a="copy">📋 Copy URL</button><button class="btn btn-ghost sm" data-a="share">🔗 Share</button><button class="btn btn-ghost sm" data-a="edit">✏️ Settings</button><button class="btn btn-ghost sm" data-a="rep">⬆️ Replace</button><button class="btn btn-ghost sm" data-a="dl">⬇️</button><button class="btn btn-ghost sm" data-a="arch">${f.archived ? '📤 Restore' : '🗃️ Archive'}</button><button class="btn btn-ghost sm" data-a="del">🗑️</button></div></div>
  <div class="fqr" data-url="${esc(f.url)}"></div></div>`;
  }
  function render() {
    const cnt = { active: 0, expired: 0, archived: 0, suspended: 0 }; items.forEach((f) => cnt[stOf(f)]++);
    $('#fmState').innerHTML = [['active', 'Active'], ['expired', 'Expired'], ['archived', 'Archived'], ['suspended', 'Suspended'], ['all', 'All']]
      .filter(([k]) => k !== 'suspended' || cnt.suspended).map(([k, l]) => `<button type="button" data-s="${k}" class="${V.st === k ? 'on' : ''}">${l} · ${k === 'all' ? items.length : cnt[k]}</button>`).join('');
    $('#fmCats').innerHTML = ['all'].concat(Object.keys(CI)).map((k) => `<button type="button" class="chip ${V.cat === k ? 'on' : ''}" data-c="${k}">${k === 'all' ? 'All types' : CI[k] + ' ' + k[0].toUpperCase() + k.slice(1)}</button>`).join('');
    const SORT = { new: (a, b) => b.created - a.created, old: (a, b) => a.created - b.created, views: (a, b) => b.views - a.views, size: (a, b) => b.size - a.size, name: (a, b) => a.title.localeCompare(b.title) };
    const L = items.filter((f) => (V.st === 'all' || stOf(f) === V.st) && (V.cat === 'all' || f.cat === V.cat) && (!V.q || (f.title + ' ' + f.name).toLowerCase().includes(V.q))).sort(SORT[V.sort]);
    $('#fmList').innerHTML = L.length ? L.map(card).join('') : `<div class="card" style="text-align:center"><h3>${items.length ? 'No files match' : 'No files yet'}</h3><p>${items.length ? 'Try another filter or search.' : 'Upload an image, PDF, video, audio clip or document to get your first file QR.'}</p>${items.length ? '' : '<a class="btn btn-primary" href="/file-to-qr" style="margin-top:1rem">+ Upload file</a>'}</div>`;
    $$('.fqr').forEach(async (el) => {
      const u = el.dataset.url;
      try {
        if (!qc.has(u)) qc.set(u, (await QRX.matrix(u, 'M')).rows);
        el.innerHTML = QRX.svg(qc.get(u), Object.assign({ margin: 1, size: 200 }, QS)).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"');
      } catch (e) { /* ignore */ }
    });
  }

  /* ---------- filters ---------- */
  $('#fmSearch').addEventListener('input', (e) => { V.q = e.target.value.trim().toLowerCase(); render(); });
  $('#fmSort').addEventListener('input', (e) => { V.sort = e.target.value; render(); });
  $('#fmState').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { V.st = b.dataset.s; render(); } });
  $('#fmCats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { V.cat = b.dataset.c; render(); } });
  $$('dialog [data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));

  /* ---------- preview ---------- */
  function openPrev(f) {
    const u = esc(f.prev); let h;
    if (f.cat === 'image') h = `<img class="fpv" src="${u}" alt="">`;
    else if (f.cat === 'pdf') h = `<iframe class="fpv pdf" src="${u}" title="PDF"></iframe>`;
    else if (f.cat === 'video') h = `<video class="fpv" src="${u}" controls playsinline></video>`;
    else if (f.cat === 'audio') h = `<audio class="fpv" src="${u}" controls></audio>`;
    else if (f.ext === 'txt') h = `<iframe class="fpv pdf" src="${u}" title="Text"></iframe>`;
    else h = `<div class="docbox"><span>${ico(f)}</span><b>${esc(f.ext.toUpperCase())} document</b><small>No in-browser preview — use Download.</small></div>`;
    $('#pvTitle').textContent = f.title; $('#pvBody').innerHTML = h + `<dl class="kv"><dt>Filename</dt><dd>${esc(f.name)}</dd><dt>Size</dt><dd>${fmt(f.size)}</dd><dt>Format</dt><dd>${esc(f.ext.toUpperCase())}</dd></dl>`;
    $('#pvDl').href = f.prev + '&dl=1'; $('#dPrev').showModal();
  }
  $('#dPrev').addEventListener('close', () => { $('#pvBody').innerHTML = ''; });

  /* ---------- QR dialog ---------- */
  async function openQr(f) {
    try {
      cur = f; curRows = (await QRX.matrix(f.url, 'M')).rows;
      $('#qrTitle').textContent = f.title;
      $('#qrBody').innerHTML = `<div class="qr-stage" style="max-width:320px;margin:0 auto">${QRX.framed(curRows, Object.assign({ margin: 4 }, QS), '', 640)}</div><div class="info"><code>${esc(f.url)}</code></div>`;
      $('#dQr').showModal();
    } catch (e) { toast(e.message); }
  }
  const qsvg = (px) => QRX.framed(curRows, Object.assign({ margin: 4 }, QS), '', px);
  $('#qPng').onclick = async () => { try { QRX.save(await QRX.toBlob(qsvg(1024), 1024, 1024, 'image/png'), `qrnova-file-${cur.code}.png`); } catch (e) { toast(e.message); } };
  $('#qSvg').onclick = () => QRX.save(new Blob([qsvg(1024)], { type: 'image/svg+xml' }), `qrnova-file-${cur.code}.svg`);
  $('#qCopy').onclick = () => navigator.clipboard.writeText(cur.url).then(() => toast('Link copied'));
  $('#qPrint').onclick = () => { const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print'); w.document.write(`<!doctype html><title>QR</title><body style="margin:0;display:grid;place-items:center;min-height:100vh"><img src="${QRX.svgUrl(qsvg(1200))}" style="max-width:90vw;max-height:90vh" onload="setTimeout(function(){print()},250)">`); w.document.close(); };

  /* ---------- share dialog (main link + signed expiring link) ---------- */
  function openShare(f) {
    cur = f;
    $('#shBody').innerHTML = `<div class="fld"><label>Main link ${f.access === 'private' ? '(private — only you can open it)' : ''}</label><div class="row2"><input class="in" id="shUrl" readonly value="${esc(f.url)}"><button class="btn btn-ghost sm" data-c="shUrl">Copy</button>${navigator.share ? '<button class="btn btn-ghost sm" data-n="shUrl">Share…</button>' : ''}</div></div>
<div class="fld"><label>Expiring share link</label><div class="row2"><select class="in" id="shDur"><option value="60">1 hour</option><option value="1440" selected>24 hours</option><option value="10080">7 days</option><option value="43200">30 days</option></select><button class="btn btn-primary sm" id="shMake">Create</button></div><small class="fh">Anyone with this signed link can open the file until it expires — even if it is private or password-protected.</small></div><div id="shOut"></div>`;
    $('#dShare').showModal();
  }
  $('#shBody').addEventListener('click', async (e) => {
    const c = e.target.closest('[data-c]'), n = e.target.closest('[data-n]');
    if (c) navigator.clipboard.writeText($('#' + c.dataset.c).value).then(() => toast('Link copied'));
    if (n) navigator.share({ title: cur.title, url: $('#' + n.dataset.n).value }).catch(() => {});
    if (e.target.id === 'shMake') {
      try {
        const r = await api(`/api/files/${cur.id}/sign`, { method: 'POST', body: { minutes: +$('#shDur').value } });
        $('#shOut').innerHTML = `<div class="fld"><label>Link valid until ${new Date(r.expires).toLocaleString()}</label><div class="row2"><input class="in" id="shSigned" readonly value="${esc(r.url)}"><button class="btn btn-ghost sm" data-c="shSigned">Copy</button>${navigator.share ? '<button class="btn btn-ghost sm" data-n="shSigned">Share…</button>' : ''}</div></div>`;
      } catch (err) { toast(err.message); }
    }
  });

  /* ---------- settings dialog ---------- */
  function openEdit(f) {
    cur = f;
    $('#eTitle').value = f.title; $('#eName').value = f.name.replace(/\.[^.]+$/, ''); $('#eExt').textContent = '.' + f.ext;
    $('#eAccess').value = f.access; $('#ePw').value = ''; $('#ePw').placeholder = f.hasPassword ? 'Leave blank to keep the current password' : 'Set a password (min 4)';
    $('#ePwWrap').hidden = f.access !== 'password'; $('#eDl').checked = f.allowDownload; $('#eExp').value = f.expires ? local(f.expires) : '';
    $('#dEdit').showModal();
  }
  $('#eAccess').addEventListener('input', () => { $('#ePwWrap').hidden = $('#eAccess').value !== 'password'; });
  $('#dEdit').addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (!b) return; const h = +b.dataset.h; $('#eExp').value = h ? local(Date.now() + h * 3600e3) : ''; });
  $('#eForm').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!cur) return;
    const body = { title: $('#eTitle').value, name: $('#eName').value, access: $('#eAccess').value, allowDownload: $('#eDl').checked };
    if (body.access === 'password' && $('#ePw').value) body.password = $('#ePw').value;
    const cv = $('#eExp').value;
    if (cv !== (cur.expires ? local(cur.expires) : '')) body.expires = cv ? new Date(cv).toISOString() : '';
    try { await api('/api/files/' + cur.id, { method: 'PUT', body }); $('#dEdit').close(); toast('Saved'); load(); } catch (err) { toast(err.message); }
  });

  /* ---------- replace ---------- */
  $('#replaceIn').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file || !replaceId) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      toast('Replacing…');
      await QRX.upload(`/api/files/${replaceId}/replace`, 'POST', fd, (p) => toast('Replacing… ' + Math.round(p * 100) + '%'));
      toast('File replaced — the same QR now opens the new file ✨'); load();
    } catch (err) { toast(err.message); }
  });

  /* ---------- card actions ---------- */
  $('#fmList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const f = items.find((x) => x.id === b.closest('.fcard').dataset.id); if (!f) return;
    const a = b.dataset.a;
    if (a === 'prev') openPrev(f);
    if (a === 'qr') openQr(f);
    if (a === 'copy') navigator.clipboard.writeText(f.url).then(() => toast('Link copied'));
    if (a === 'share') openShare(f);
    if (a === 'edit') openEdit(f);
    if (a === 'rep') { replaceId = f.id; $('#replaceIn').click(); }
    if (a === 'dl') location.href = f.prev + '&dl=1';
    if (a === 'arch') { try { await api('/api/files/' + f.id, { method: 'PUT', body: { archived: !f.archived } }); toast(f.archived ? 'Restored' : 'Archived — scans now show an “archived” page'); load(); } catch (err) { toast(err.message); } }
    if (a === 'del' && confirm('Delete this file permanently? Its QR code will stop working.')) { try { await api('/api/files/' + f.id, { method: 'DELETE' }); toast('Deleted'); load(); } catch (err) { toast(err.message); } }
  });

  api('/api/files/config').then((c) => { $('#adminLink').hidden = !c.isAdmin; }).catch(() => {});
  load();
})();
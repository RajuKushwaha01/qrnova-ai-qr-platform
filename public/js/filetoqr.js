(() => {
  const { $, $$, esc, toast } = QRX;
  if (!$('#ftq')) return;
  const en = encodeURIComponent;
  const DOCI = { doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📽️', pptx: '📽️', txt: '📃' };
  const PIPE = ['Validated in browser', 'Uploading', 'Server checks (type · content · scan)', 'Stored securely', 'Secure link created', 'QR generated'];
  const S = { preset: 1, dots: 'rounded', eyes: 'rounded' };
  let cfg = null, cat = null, file = null, objUrl = null, created = null, rows = null, seq = 0, busy = false, exported = false, lastUrl = '', lastP = 0;
  const stage = $('#stage');

  const extOf = (n) => (n.includes('.') ? n.split('.').pop().toLowerCase() : '');
  const catOf = (ext) => cfg.cats.find((c) => c.exts.includes(ext));
  const px = () => +$('#size').value;
  const qo = () => { const p = QRX.PRESETS[S.preset]; return { fg: p[1], fg2: p[2], bg: '#ffffff', eye: p[3], dots: S.dots, eyes: S.eyes, margin: 4, size: px() }; };

  /* ---------- stepper + pipeline ---------- */
  function steps() {
    const done = [!!file, !!file, !!file, !!created, exported];
    let act = done.findIndex((d) => !d); if (act < 0) act = 4;
    $$('#stepper li').forEach((li, i) => { li.classList.toggle('done', done[i]); li.classList.toggle('act', i === act); });
  }
  function pipe(active, failed) {
    $('#pipe').innerHTML = active == null ? '' : PIPE.map((s, i) => `<li class="${failed === i ? 'bad' : i < active ? 'done' : i === active ? 'act' : ''}">${s}</li>`).join('');
  }
  const btns = (on) => ['dlPng', 'dlJpg', 'dlWebp', 'dlSvg', 'print', 'share', 'copy'].forEach((id) => ($('#' + id).disabled = !on));

  /* ---------- type tabs + dropzone ---------- */
  function setCat(id) {
    const c = cfg.cats.find((x) => x.id === id) || cfg.cats[0]; cat = c.id;
    $$('#ftabs .chip').forEach((b) => b.classList.toggle('on', b.dataset.c === cat));
    $('#fileIn').accept = c.exts.map((e) => '.' + e).join(',');
    $('#dzTitle').textContent = `Drop your ${c.label.toLowerCase()} here`;
    $('#dzHint').textContent = `or click to browse · ${c.exts.map((e) => e.toUpperCase()).join(', ')} · up to ${cfg.max[c.id]} MB`;
  }
  function pick(f) {
    if (busy) return;
    const ext = extOf(f.name), c = catOf(ext);
    if (!c) return toast(`.${ext || '?'} files are not allowed. Allowed: ${cfg.cats.flatMap((x) => x.exts).join(', ')}`);
    if (!f.size) return toast('That file is empty');
    if (f.size > cfg.max[c.id] * 1048576) return toast(`${c.label} files can be at most ${cfg.max[c.id]} MB (this one is ${QRX.fmtSize(f.size)})`);
    file = f; created = null; rows = null; exported = false; pipe(null);
    if (c.id !== cat) setCat(c.id);
    const t = $('#title');
    if (!t.value || t.dataset.auto === '1') { t.value = f.name.replace(/\.[^.]+$/, '').slice(0, 120); t.dataset.auto = '1'; }
    $('#after').hidden = true; $('#prog').hidden = true;
    renderPreview(); refresh(); steps();
  }
  async function renderPreview() {
    const box = $('#pv');
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    if (!file) { box.innerHTML = '<p class="hint">Your file preview and details will appear here.</p>'; return; }
    const f0 = file, ext = extOf(file.name), c = catOf(ext).id; objUrl = URL.createObjectURL(file);
    let h = '';
    if (c === 'image') h = `<img class="fpv" src="${objUrl}" alt="Image preview">`;
    else if (c === 'pdf') h = `<iframe class="fpv pdf" src="${objUrl}" title="PDF preview"></iframe><p class="hint">Preview blank on your device? The file is still valid and opens from the QR.</p>`;
    else if (c === 'video') h = `<video class="fpv" src="${objUrl}" controls playsinline preload="metadata"></video>`;
    else if (c === 'audio') h = `<audio class="fpv" src="${objUrl}" controls></audio>`;
    else if (ext === 'txt') { const t = await file.slice(0, 1500).text(); if (f0 !== file) return; h = `<pre class="txtpv">${esc(t)}${file.size > 1500 ? '\n…' : ''}</pre>`; }
    else h = `<div class="docbox"><span>${DOCI[ext] || '📁'}</span><b>${esc(ext.toUpperCase())} document</b><small>No in-browser preview for this format</small></div>`;
    box.innerHTML = h + `<dl class="kv"><dt>Filename</dt><dd>${esc(file.name)}</dd><dt>Size</dt><dd>${QRX.fmtSize(file.size)}</dd><dt>Format</dt><dd>${esc(ext.toUpperCase())} · ${esc(file.type || 'unknown type')}</dd><dt>Status</dt><dd><span class="tag ok" id="stTag">✓ Valid · ready to upload</span></dd></dl>`;
  }
  const setStatus = (t, cls) => { const e = $('#stTag'); if (e) { e.textContent = t; e.className = 'tag ' + (cls || 'ok'); } };

  const dz = $('#dz');
  dz.onclick = () => $('#fileIn').click();
  dz.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileIn').click(); } };
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) pick(f); });
  $('#fileIn').onchange = (e) => { const f = e.target.files[0]; if (f) pick(f); };

  /* ---------- security form ---------- */
  const HINTS = {
    public: 'Anyone who scans the QR or has the link can open the file.',
    password: 'Viewers must enter the password after scanning. Choose a password you do not use anywhere else.',
    private: '⚠️ Private files cannot be opened by scanning. Only you can open them while logged in. Choose “Anyone” or “Password” for printed QR codes.',
  };
  function secUi() {
    $('#pwWrap').hidden = $('#access').value !== 'password';
    $('#expWrap').hidden = $('#expiry').value !== 'custom';
    $('#accHint').textContent = HINTS[$('#access').value];
  }
  ['access', 'expiry'].forEach((id) => $('#' + id).addEventListener('input', secUi));
  $('#title').addEventListener('input', (e) => { e.target.dataset.auto = ''; });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-eye]'); if (b) { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; } });
  function expiresVal() {
    const v = $('#expiry').value;
    if (v === 'never') return '';
    if (v === 'custom') { const x = $('#expAt').value; return x ? new Date(x).toISOString() : null; }
    return new Date(Date.now() + { '1h': 1, '24h': 24, '7d': 168, '30d': 720 }[v] * 3600e3).toISOString();
  }

  /* ---------- style controls ---------- */
  $('#presets').innerHTML = QRX.PRESETS.map((p, i) => `<button type="button" title="${p[0]}" data-i="${i}" style="background:linear-gradient(135deg,${p[1]},${p[2] || p[1]})"></button>`).join('');
  $$('#presets button').forEach((b) => (b.onclick = () => { S.preset = +b.dataset.i; repaint(); }));
  ['dots', 'eyes'].forEach((k) => $$(`#${k} button`).forEach((b) => (b.onclick = () => { S[k] = b.dataset.v; $$(`#${k} button`).forEach((x) => x.classList.toggle('on', x === b)); repaint(); })));
  $('#label').addEventListener('input', repaint);
  $('#size').addEventListener('input', repaint);

  /* ---------- QR drawing ---------- */
  function paint() { stage.style.aspectRatio = $('#label').value.trim() ? 'auto' : ''; stage.innerHTML = QRX.framed(rows, qo(), $('#label').value, 640); }
  function repaint() { if (rows) paint(); }
  function info(url, dim, m) {
    $('#info').innerHTML = dim
      ? '<p class="mini"><b>Preview only.</b> Your real, unguessable link is created when you press the button below.</p>'
      : `<div class="eng"><div><b>v${m.version}</b><span>Version</span></div><div><b>${m.size}²</b><span>Modules</span></div><div><b>${m.bytes}</b><span>Bytes</span></div><div><b>${m.ecl}</b><span>Error corr.</span></div></div><p>✅ <b>QR created.</b> Scanning opens:</p><code>${esc(url)}</code><a class="lnk" href="${esc(url)}" target="_blank" rel="noopener">Open viewer page ↗</a><p class="mini">Short link = small, fast-scanning code, however big the file is.</p>`;
  }
  async function draw(url, dim) {
    const my = ++seq;
    try {
      const m = await QRX.matrix(url, 'M');
      if (my !== seq) return;
      rows = m.rows; lastUrl = url; stage.style.opacity = dim ? 0.35 : 1; paint(); info(url, dim, m); btns(!dim); steps();
    } catch (e) { if (my === seq) { rows = null; stage.innerHTML = `<div class="empty">▦<br>${esc(e.message)}</div>`; } }
  }
  function refresh() {
    if (created) return draw(created.url, false);
    if (file) return draw(location.origin + '/f/xxxxxxxx', true);
    rows = null; seq++; stage.style.opacity = 1; stage.style.aspectRatio = '';
    stage.innerHTML = '<div class="empty">▦<br>Upload a file to see its QR code</div>';
    $('#info').innerHTML = ''; btns(false); steps();
  }
  $('#create').disabled = true;

  /* ---------- upload + create ---------- */
  async function create() {
    if (busy || !file) return;
    if (!QRX.token()) { toast('Please log in to upload files'); return setTimeout(() => (location.href = '/login?next=' + en('/file-to-qr')), 900); }
    const access = $('#access').value, pw = $('#pw').value, title = $('#title').value.trim();
    if (!title) return toast('Give your file a title');
    if (access === 'password' && pw.length < 4) return toast('Set a password of at least 4 characters');
    const ex = expiresVal();
    if (ex === null) return toast('Choose the expiry date');
    if (ex && new Date(ex) <= new Date()) return toast('The expiry date must be in the future');
    const fd = new FormData();
    fd.append('title', title); fd.append('access', access); if (access === 'password') fd.append('password', pw);
    fd.append('allowDownload', $('#allowDl').checked ? '1' : '0'); if (ex) fd.append('expires', ex);
    fd.append('file', file);
    busy = true; lastP = 0; $('#create').disabled = true; $('#create').textContent = 'Uploading…';
    $('#prog').hidden = false; $('#progBar').style.width = '0%'; $('#progTxt').textContent = 'Starting upload…'; pipe(1); setStatus('Uploading…', 'warn');
    try {
      const r = await QRX.upload('/api/files', 'POST', fd, (p) => {
        lastP = p; $('#progBar').style.width = Math.round(p * 100) + '%'; $('#progTxt').textContent = p < 1 ? `Uploading… ${Math.round(p * 100)}%` : 'Verifying file contents & scanning…';
        if (p >= 1) pipe(2);
      });
      pipe(3); await new Promise((x) => setTimeout(x, 250)); pipe(4); await new Promise((x) => setTimeout(x, 250));
      created = r; await draw(r.url, false); pipe(6);
      $('#progTxt').textContent = 'Done ✓'; setStatus('✓ Uploaded & stored securely', 'ok');
      $('#after').hidden = false; steps(); toast('QR created ✨ Download, print or share it');
      stage.classList.add('pop'); setTimeout(() => stage.classList.remove('pop'), 900);
    } catch (e) {
      pipe(lastP < 1 ? 1 : 2, lastP < 1 ? 1 : 2); setStatus('✕ Upload failed', 'warn'); $('#progTxt').textContent = e.message; toast(e.message);
    }
    busy = false; $('#create').textContent = '☁️ Upload & Create QR'; $('#create').disabled = !file || !!created;
  }
  const origRefresh = refresh;
  refresh = () => { origRefresh(); $('#create').disabled = !file || busy || !!created; };
  $('#create').onclick = create;

  /* ---------- export ---------- */
  const name = (x) => `qrnova-file-${created ? created.code : 'qr'}.${x}`;
  async function exportImg(mime, ext) {
    const svg = QRX.framed(rows, qo(), $('#label').value, px()), d = QRX.svgDims(svg);
    QRX.save(await QRX.toBlob(svg, d[0], d[1], mime), name(ext)); exported = true; steps();
  }
  const wrap = (fn) => async () => { try { await fn(); } catch (e) { toast(e.message || 'Export failed'); } };
  $('#dlPng').onclick = wrap(() => exportImg('image/png', 'png'));
  $('#dlJpg').onclick = wrap(() => exportImg('image/jpeg', 'jpg'));
  $('#dlWebp').onclick = wrap(() => exportImg('image/webp', 'webp'));
  $('#dlSvg').onclick = () => { QRX.save(new Blob([QRX.framed(rows, qo(), $('#label').value, px())], { type: 'image/svg+xml' }), name('svg')); exported = true; steps(); };
  $('#copy').onclick = () => navigator.clipboard.writeText(lastUrl).then(() => { toast('Link copied'); exported = true; steps(); });
  $('#print').onclick = () => {
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print');
    w.document.write(`<!doctype html><title>QR code</title><body style="margin:0;display:grid;place-items:center;min-height:100vh"><img src="${QRX.svgUrl(QRX.framed(rows, qo(), $('#label').value, 1200))}" style="max-width:90vw;max-height:90vh" onload="setTimeout(function(){print()},250)">`);
    w.document.close(); exported = true; steps();
  };
  $('#share').onclick = wrap(async () => {
    const svg = QRX.framed(rows, qo(), $('#label').value, 1024), d = QRX.svgDims(svg), blob = await QRX.toBlob(svg, d[0], d[1], 'image/png');
    const f = new File([blob], 'qrnova.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'My QR code', url: lastUrl });
    else { await navigator.clipboard.writeText(lastUrl); toast('Sharing is not supported here — link copied'); }
    exported = true; steps();
  });
  $('#another').onclick = () => {
    file = null; created = null; exported = false; $('#fileIn').value = ''; $('#after').hidden = true; $('#prog').hidden = true; pipe(null);
    $('#title').value = ''; $('#pw').value = ''; renderPreview(); refresh(); steps(); $('#s1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---------- init ---------- */
  (async () => {
    try { cfg = await QRX.api('/api/files/config'); } catch (e) { $('#dzTitle').textContent = 'Server unreachable'; return toast(e.message); }
    if (!cfg.loggedIn && QRX.token()) QRX.clearAuth();
    $('#loginBar').hidden = cfg.loggedIn;
    cfg.cats = cfg.cats.filter((c) => c.exts.length);
    if (!cfg.cats.length) { $('#dzTitle').textContent = 'File uploads are currently disabled by the administrator'; dz.style.pointerEvents = 'none'; return; }
    $('#ftabs').innerHTML = cfg.cats.map((c) => `<button type="button" class="chip" data-c="${c.id}">${c.icon} ${esc(c.label)}</button>`).join('');
    $$('#ftabs .chip').forEach((b) => (b.onclick = () => setCat(b.dataset.c)));
    const t = new URLSearchParams(location.search).get('type');
    setCat(cfg.cats.some((c) => c.id === t) ? t : cfg.cats[0].id);
    secUi(); renderPreview(); refresh(); steps();
  })();
})();
(() => {
  'use strict';
  const { $, $$, esc, toast, api, sleep } = QRX;
  const B = window.QRBrain;
  if (!$('#ast') || !B) return;

  /* ═══════════ constants & helpers ═══════════ */
  const TYPES = B.TYPES, en = encodeURIComponent;
  const logged = () => !!QRX.token();
  const HEX = /^#[0-9a-f]{6}$/i;
  const ICON = { pass: '✓', warn: '!', fail: '✕', info: 'i' };
  const LVI = { error: '❌', need: '⏳', warn: '⚠️', info: '💡' };
  const MODE_OK = (t) => TYPES[t].dyn === 'opt' || TYPES[t].dyn === 'page';
  const isBlock = (i) => i.lvl === 'error' || i.lvl === 'need';
  const blank = (type) => { const o = {}; TYPES[type].fields.forEach((f) => { o[f.k] = f.t === 'select' ? f.o[0][0] : f.t === 'check' ? false : ''; }); return o; };
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[\[([^|\]]+)\|(\/(?!\/)[^\]]*)\]\]/g, '<a class="lnk" href="$2">$1</a>').replace(/\n/g, '<br>');
  const when = (t) => { const d = new Date(t); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
  const STARTERS = [
    'Create a QR for my portfolio website.',
    'Create a QR for my restaurant containing my menu PDF, location, phone number and website.',
    'Wi-Fi network Cafe_Guest password coffee1234',
    'Accept a ₹499 payment on UPI id rahul@oksbi',
    'someone@example.com',
    'Event "Annual Tech Meetup" on 5 Dec 2026, 6pm to 9pm, venue Hall B',
  ];
  const DESIGN_PROMPTS = ['Make it professional for a hotel', 'Make it playful and colourful', 'Minimal black and white', 'Use a blue brand colour', 'Make it print-ready for a poster'];

  /* ═══════════ state ═══════════ */
  const S = { ses: { id: null }, msgs: [], unsaved: [], pendingDesign: null };
  const H = { items: [], q: '' };
  let cur = null, seq = 0, timer, scanTimer, flushT, chain = Promise.resolve(), warned = false, busy = false, gbusy = false, tess = null;
  const log = $('#log'), stage = $('#stage'), form = $('#form'), pin = $('#prompt');

  const effEcl = () => (cur.logo ? 'H' : cur.ecl);
  const ready = () => !!(cur && cur.generated && cur.rows && !cur.dim);
  function newCur(type, fields, o) {
    o = o || {};
    return { type, fields: Object.assign(blank(type), fields || {}), mode: o.mode || 'static', style: B.defaultStyle(), label: '', logo: null, ecl: o.ecl || 'M', size: o.size || 1024, file: null, created: null, generated: false, scan: null, prompt: o.prompt || '', ent: o.ent || null, styled: false, print: false, rows: null, stats: null, payload: '', dim: false, issues: [], rec: null, q: null, themeName: '' };
  }
  const qo = (px) => { const s = cur.style; return { fg: s.fg, fg2: s.useGrad && s.fg2 ? s.fg2 : null, bg: s.transp ? 'transparent' : s.bg, eye: s.eye || s.fg, dots: s.dots, eyes: s.eyes, margin: +s.margin, logo: cur.logo, size: px }; };
  function snapshot() {
    if (!cur) return undefined;
    const f = {}; Object.keys(cur.fields).forEach((k) => { const v = cur.fields[k]; f[k] = typeof v === 'string' ? v.slice(0, 1200) : v; });
    return { type: cur.type, mode: cur.mode, fields: f, style: Object.assign({}, cur.style), frame: cur.label, ecl: cur.ecl, size: cur.size, prompt: String(cur.prompt || '').slice(0, 600), created: cur.created ? { url: cur.created.url, code: cur.created.code } : undefined, generated: !!cur.generated, styled: !!cur.styled, hadLogo: !!cur.logo, theme: cur.themeName || undefined, score: cur.q ? cur.q.score : undefined };
  }

  /* ═══════════ chat rendering ═══════════ */
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function qualityList(q) { return `<ul class="q-list">${q.items.map((i) => `<li class="${i.s}"><span class="qi">${ICON[i.s]}</span><div><b>${esc(i.label)}</b><small>${esc(i.detail)}</small></div></li>`).join('')}</ul>`; }
  function qualityCard(c) {
    const q = c.q;
    return `<div class="as-card"><div class="q-head"><div class="q-ring" style="--p:${q.score}"><b>${q.score}</b></div><div><b>${esc(q.verdict)}</b></div></div>${qualityList(q)}${(c.sugg || []).map((s) => `<div class="as-sug"><span>${esc(s.q)}</span><button type="button" class="btn btn-ghost sm" data-sg="${s.id}">${esc(s.yes)}</button></div>`).join('')}</div>`;
  }
  function detectCard(c) {
    const d = c.det;
    return `<div class="as-card">${c.source ? `<div class="as-src">📎 ${esc(c.source.name)} · ${c.source.chars} characters${c.source.pages ? ' · ' + c.source.pages + ' pages' : ''}</div>` : ''}<div class="as-ch"><b>Detected:</b></div><ul class="as-det">${d.items.map((it, n) => `<li style="animation-delay:${n * 90}ms">✓ ${it.i} ${esc(it.l)}</li>`).join('')}</ul><div class="as-conf"><span>${d.icon} ${esc(d.label)}</span><div class="meter"><i style="width:${d.conf}%"></i></div><b>${d.conf}%</b></div>${d.alts.length ? `<div class="as-alts"><small>Not right?</small> ${d.alts.map((a) => `<button type="button" class="chip" data-switch="${a.type}">${a.icon} ${esc(a.label)}</button>`).join('')}</div>` : ''}<div class="as-rec">Recommended:<br><b>${esc(c.rec.title)}</b></div>${c.source && c.source.preview ? `<details class="as-pv"><summary>Show extracted text</summary><pre>${esc(c.source.preview)}</pre></details>` : ''}</div>`;
  }
  function msgHtml(m, i) {
    const ai = m.role === 'ai';
    let extra = '';
    if (m.card && m.card.kind === 'detect') extra = detectCard(m.card);
    else if (m.card && m.card.kind === 'quality') extra = qualityCard(m.card);
    if (m.result && TYPES[m.result.type]) {
      const r = m.result, T = TYPES[r.type];
      extra += `<button type="button" class="as-chip" data-open="${i}" title="Reopen this version in the workspace">↺ ${T.icon} ${esc(T.label)} · ${r.mode === 'dynamic' ? 'Dynamic' : 'Static'}${r.created ? ' · created' : r.generated ? ' · generated' : ''}</button>`;
    }
    return `<div class="as-msg ${ai ? 'ai' : 'user'}"><span class="as-av" aria-hidden="true">${ai ? '🤖' : '🧑'}</span><div class="as-b"><div class="as-t">${md(m.text)}</div>${extra}<time>${esc(when(m.t))}</time></div></div>`;
  }
  function renderLog() {
    log.innerHTML = S.msgs.map(msgHtml).join(''); scroll();
    $('#starters').hidden = S.msgs.some((m) => m.role === 'user');
  }
  function addMsg(m) {
    m.t = m.t || Date.now(); S.msgs.push(m);
    if (!m.local) S.unsaved.push(m);
    log.insertAdjacentHTML('beforeend', msgHtml(m, S.msgs.length - 1)); scroll();
    flushSoon(); return m;
  }
  const say = (text, extra) => addMsg(Object.assign({ role: 'ai', text, result: snapshot() }, extra || {}));
  async function think(stages) {
    const el = document.createElement('div');
    el.className = 'as-msg ai';
    el.innerHTML = '<span class="as-av">🤖</span><div class="as-b"><div class="as-think"><em></em><i></i><i></i><i></i></div></div>';
    log.appendChild(el); scroll();
    const em = $('em', el);
    for (const s of stages) { em.textContent = s; await sleep(380); }
    el.remove();
  }
  const greet = () => S.msgs.push({ role: 'ai', text: B.understand('hello').text, local: true, t: Date.now() });

  /* ═══════════ history (saved on the server for logged-in users) ═══════════ */
  function flushSoon() { clearTimeout(flushT); flushT = setTimeout(flush, 700); }
  function flush() {
    if (!logged() || !S.unsaved.length) return;
    const ses = S.ses;
    const items = S.unsaved.splice(0).map((m) => ({ role: m.role, text: String(m.text || ''), result: m.result }));
    chain = chain.then(async () => {
      try {
        if (!ses.id) {
          const first = items.find((i) => i.role === 'user');
          const s = await api('/api/ai/sessions', { method: 'POST', body: { title: ((first && first.text) || 'AI session').slice(0, 60) } });
          ses.id = s.id;
        }
        for (let i = 0; i < items.length; i += 4) await api(`/api/ai/sessions/${ses.id}/messages`, { method: 'POST', body: { messages: items.slice(i, i + 4) } });
        refreshHistory();
      } catch (e) { if (!warned) { warned = true; toast('History was not saved: ' + e.message); } }
    });
  }
  async function refreshHistory() {
    if (!logged()) { H.items = []; renderHistory(); return; }
    try { H.items = (await api('/api/ai/sessions')).items; } catch (e) { /* ignore */ }
    renderHistory();
  }
  function renderHistory() {
    const box = $('#hList');
    if (!logged()) { box.innerHTML = '<div class="note">🔐 <a class="lnk" href="/login?next=/ai-qr">Log in</a> or <a class="lnk" href="/signup?next=/ai-qr">sign up</a> to save your AI sessions and reopen them later. Without an account this conversation only lives in this tab.</div>'; return; }
    const q = H.q.toLowerCase(), list = H.items.filter((s) => !q || (s.title + ' ' + s.last).toLowerCase().includes(q));
    box.innerHTML = list.length ? list.map((s) => `<div class="h-item${S.ses.id === s.id ? ' on' : ''}" data-id="${s.id}"><button type="button" class="h-main" data-h="open"><b>${s.pinned ? '📌 ' : ''}${esc(s.title)}</b><small>${TYPES[s.type] ? TYPES[s.type].icon + ' ' : ''}${esc(s.last || 'No messages')}</small><small>${esc(when(s.updated))} · ${s.count} messages</small></button><div class="h-acts"><button type="button" data-h="pin" title="Pin">📌</button><button type="button" data-h="ren" title="Rename">✏️</button><button type="button" data-h="del" title="Delete">🗑️</button></div></div>`).join('') : '<p class="hint">No saved sessions yet. Your conversations appear here automatically.</p>';
  }
  async function openSession(id) {
    const s = await api('/api/ai/sessions/' + id);
    flush();
    S.ses = { id: s.id }; S.unsaved = []; S.msgs = s.messages.map((m) => ({ role: m.role, text: m.text, result: m.result, t: m.t }));
    S.msgs.push({ role: 'ai', text: `↺ Reopened **${s.title}**. Keep editing, or ask me for changes.`, local: true, t: Date.now() });
    renderLog(); clearAttach(); $('#hist').hidden = true;
    const last = [...s.messages].reverse().find((m) => m.result);
    if (last) restore(last.result); else clearWork();
    renderHistory();
  }
  function newSession() {
    flush();
    S.ses = { id: null }; S.unsaved = []; S.msgs = []; S.pendingDesign = null; cur = null;
    greet(); renderLog(); clearWork(); clearAttach(); $('#hist').hidden = true; renderHistory(); pin.focus();
  }
  $('#histBtn').onclick = () => { const h = $('#hist'); h.hidden = !h.hidden; if (!h.hidden) refreshHistory(); };
  $('#histClose').onclick = () => { $('#hist').hidden = true; };
  $('#newBtn').onclick = newSession;
  $('#hSearch').addEventListener('input', (e) => { H.q = e.target.value.trim(); renderHistory(); });
  $('#hClear').onclick = async () => {
    if (!logged()) return toast('Log in to manage saved history');
    if (!confirm('Delete ALL saved AI sessions? This cannot be undone.')) return;
    try { await api('/api/ai/sessions', { method: 'DELETE' }); toast('History deleted'); newSession(); refreshHistory(); } catch (e) { toast(e.message); }
  };
  $('#hList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    const it = b.closest('.h-item'); if (!it) return;
    const id = it.dataset.id, s = H.items.find((x) => x.id === id); if (!s) return;
    try {
      if (b.dataset.h === 'open') await openSession(id);
      else if (b.dataset.h === 'pin') { await api('/api/ai/sessions/' + id, { method: 'PUT', body: { pinned: !s.pinned } }); await refreshHistory(); }
      else if (b.dataset.h === 'ren') { const t = window.prompt('Rename session', s.title); if (t && t.trim()) { await api('/api/ai/sessions/' + id, { method: 'PUT', body: { title: t.trim() } }); await refreshHistory(); } }
      else if (b.dataset.h === 'del') { if (!confirm('Delete this AI session? This cannot be undone.')) return; await api('/api/ai/sessions/' + id, { method: 'DELETE' }); if (S.ses.id === id) newSession(); else await refreshHistory(); }
    } catch (err) { toast(err.message); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#hist').hidden = true; });

  /* ═══════════ workspace: details form ═══════════ */
  function fieldHtml(f, v) {
    const id = 'f_' + f.k, ph = esc(f.ph || ''), val = v == null ? '' : v, h = f.h ? ' h' : '';
    if (f.t === 'check') return `<div class="fld${h}" data-f="${f.k}"><label class="chk"><input type="checkbox" data-k="${f.k}"${v ? ' checked' : ''}> ${esc(f.l)}</label></div>`;
    let inp;
    if (f.t === 'area') inp = `<textarea class="in" id="${id}" data-k="${f.k}" rows="${f.rows || 3}" placeholder="${ph}">${esc(val)}</textarea>`;
    else if (f.t === 'select') inp = `<select class="in" id="${id}" data-k="${f.k}">${f.o.map((o) => `<option value="${esc(o[0])}"${String(val) === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    else if (f.t === 'password') inp = `<div class="pwd"><input class="in" id="${id}" type="password" data-k="${f.k}" value="${esc(val)}" autocomplete="off"><button type="button" class="eye" data-eye aria-label="Show or hide password">👁️</button></div>`;
    else inp = `<input class="in" id="${id}" type="${f.t}" data-k="${f.k}" value="${esc(val)}" placeholder="${ph}" autocomplete="off"${f.t === 'number' ? ' step="0.01" min="0" inputmode="decimal"' : ''}>`;
    return `<div class="fld${h}" data-f="${f.k}"><label for="${id}">${esc(f.l)}${f.req ? ' <i class="rq">*</i>' : ''}</label>${inp}</div>`;
  }
  function renderDetails() {
    const T = TYPES[cur.type];
    $('#typeSel').value = cur.type;
    form.innerHTML = T.fields.map((f) => fieldHtml(f, cur.fields[f.k])).join('');
    $('#upWrap').innerHTML = T.upload ? `<div class="fld"><label for="upIn">${esc(T.upload)}</label><input class="in" type="file" id="upIn" accept="${esc(T.accept || '*')}"><small class="fh">Used when you create a Dynamic QR${cur.file ? ' · selected: ' + esc(cur.file.name) : ''}.</small></div>` : '';
    $('#descBtn').hidden = !T.fields.some((f) => f.k === 'desc');
  }
  function renderModeBar() {
    const T = TYPES[cur.type], b = $('#modeBar'), tag = `<div class="onscan">${T.icon} ${esc(T.label)} QR</div>`;
    if (T.dyn === 'file') { b.innerHTML = tag + '<p class="hint">☁️ Hosted file: the QR holds a short link to your uploaded file, so it stays easy to scan.</p>'; return; }
    if (MODE_OK(cur.type)) {
      b.innerHTML = tag + `<div class="seg"><button type="button" data-m="static" class="${cur.mode === 'static' ? 'on' : ''}">⚡ Static</button><button type="button" data-m="dynamic" class="${cur.mode === 'dynamic' ? 'on' : ''}">🔄 Dynamic</button></div><p class="hint">${cur.mode === 'static' ? (T.dyn === 'page' ? 'Static stores your details as plain text inside the QR.' : 'Data is encoded directly in the QR: free and permanent.') : 'The QR points to a managed link you can edit later and track. Free account required.'}</p>`;
    } else b.innerHTML = tag + '<p class="hint">⚡ Static QR: everything is encoded inside the code itself.</p>';
  }
  $('#modeBar').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m); });
  function setMode(m) {
    if (!cur || !MODE_OK(cur.type) || cur.mode === m) return;
    cur.mode = m; cur.created = null; cur.generated = false; cur.scan = null;
    renderModeBar(); refresh();
  }
  function afterEdit() { cur.generated = false; cur.created = null; cur.scan = null; schedule(); }
  function onFormEdit(e) {
    const el = e.target.closest('[data-k]'); if (!el || !cur) return;
    cur.fields[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
    afterEdit();
  }
  form.addEventListener('input', onFormEdit);
  form.addEventListener('change', onFormEdit);
  form.addEventListener('click', (e) => { const b = e.target.closest('[data-eye]'); if (b) { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; } });
  $('#upWrap').addEventListener('change', (e) => {
    if (e.target.id !== 'upIn' || !cur) return;
    const f = e.target.files[0];
    if (!f) { cur.file = null; return; }
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes((f.name.split('.').pop() || '').toLowerCase())) { e.target.value = ''; return toast('Choose an image or a PDF'); }
    if (f.size > 15 * 1048576) { e.target.value = ''; return toast('File is too large (max 15 MB)'); }
    cur.file = f; toast('File attached. It is used when you create a Dynamic QR');
  });
  function setField(k, v) { cur.fields[k] = v; const el = $(`[data-k="${k}"]`, form); if (el) el.value = v; }
  function markFields() {
    $$('[data-f]', form).forEach((el) => el.classList.remove('bad', 'need', 'wrn'));
    cur.issues.forEach((i) => { if (!i.field) return; const el = $(`[data-f="${i.field}"]`, form); if (el) el.classList.add(i.lvl === 'error' ? 'bad' : i.lvl === 'need' ? 'need' : 'wrn'); });
  }
  function paintIssues() {
    const L = cur.issues;
    $('#issues').innerHTML = L.length ? L.map((i, n) => `<li class="iss ${i.lvl}"><span>${LVI[i.lvl]}</span><span class="t">${esc(i.msg)}</span>${i.fix ? `<button type="button" class="btn btn-ghost sm" data-fix="${n}">${esc(i.fix.label || 'Fix')}</button>` : ''}</li>`).join('') : '<li class="iss ok"><span>✅</span><span class="t">No problems found: the content looks valid.</span></li>';
  }
  $('#issues').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fix]'); if (!b || !cur) return;
    const f = (cur.issues[+b.dataset.fix] || {}).fix; if (!f) return;
    if (f.type) return switchType(f.type, f.fields);
    if (f.k) { setField(f.k, f.v); afterEdit(); }
  });
  $('#typeSel').addEventListener('input', (e) => switchType(e.target.value));
  $('#tidyBtn').onclick = () => {
    if (!cur) return;
    const t = B.tidy(cur.type, cur.fields); cur.fields = t.values; renderDetails(); afterEdit();
    toast(t.changes.length ? '✨ Formatted: ' + t.changes.map((c) => c.k).join(', ') : 'Everything is already neatly formatted');
  };
  $('#descBtn').onclick = () => {
    if (!cur) return;
    cur.fields.desc = B.describe(cur.type, cur.fields, cur.ent && cur.ent.category); renderDetails(); afterEdit(); toast('✍️ Description written. Edit it if you like');
  };

  /* ═══════════ workspace: preview, info, recommendations, quality ═══════════ */
  const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(refresh, ms || 250); };
  const recCtx = (m) => ({ text: cur.prompt, fileKind: cur.ent && cur.ent.fileKind, designText: ((cur.ent && cur.ent.category) || '') + ' ' + cur.prompt, print: cur.print, logo: !!cur.logo, bytes: m ? m.bytes : cur.stats ? cur.stats.bytes : 0, modules: m ? m.size : cur.stats ? cur.stats.size : 29 });
  const hostHref = () => '/file-to-qr?type=' + (cur.fields.kind || 'pdf');
  function stageEmpty(msg, ic) { stage.style.aspectRatio = ''; stage.style.opacity = 1; stage.innerHTML = `<div class="empty">${ic || '▦'}<br>${esc(msg)}</div>`; }
  function paint() { stage.style.aspectRatio = cur.label.trim() ? 'auto' : ''; stage.style.opacity = cur.dim ? 0.35 : 1; stage.innerHTML = QRX.framed(cur.rows, qo(640), cur.label, 640); }
  function infoRender() {
    const st = cur.stats; let shown = cur.payload;
    if (cur.type === 'wifi') shown = shown.replace(/(;P:)((?:\\.|[^;\\])*)/, '$1••••••');
    const cm = Math.max(2, Math.ceil((st.size + 8) * 0.08 * 2) / 2), link = /^https?:\/\//i.test(cur.payload);
    $('#info').innerHTML = `<div class="eng"><div><b>v${st.version}</b><span>Version</span></div><div><b>${st.size}²</b><span>Modules</span></div><div><b>${st.bytes}</b><span>Bytes</span></div><div><b>${st.ecl}</b><span>Error corr.</span></div></div><div class="meter"><i style="width:${st.usage}%"></i></div><p class="mini">${st.usage}% of capacity · ${esc((st.modes || []).join(' + ') || 'Byte')} mode · UTF-8 · print at least ${cm} cm wide</p>${cur.dim ? '<p><b>Preview only.</b> Press “Create Dynamic QR” to get your real, trackable code.</p>' : `${cur.created ? '✅ <b>Dynamic QR created</b>. Manage it in your <a class="lnk" href="/dashboard">dashboard</a>.<br>' : cur.generated ? '✅ <b>Generated.</b><br>' : 'This QR contains:'}<code>${esc(shown.slice(0, 400))}</code>${link ? `<a class="lnk" href="${esc(cur.payload)}" target="_blank" rel="noopener noreferrer">Open link to test ↗</a>` : ''}`}`;
  }
  function recsRender() {
    const r = cur.rec; if (!r) { $('#recs').innerHTML = ''; return; }
    const row = (ic, title, val, why, btn) => `<div class="rec-i"><b>${ic} ${title}</b><span>${val}</span><small>${why}</small>${btn || ''}</div>`, ab = (k, t) => `<button type="button" class="btn btn-ghost sm" data-rec="${k}">${t}</button>`;
    $('#recs').innerHTML =
      row('🔄', 'Static vs dynamic', esc(r.title), esc(r.modeWhy), MODE_OK(cur.type) && r.mode !== cur.mode ? ab('mode', 'Use ' + r.mode) : '') +
      row('🛡️', 'Error correction', 'Level ' + esc(r.ecl), esc(r.eclWhy), !cur.logo && r.ecl !== cur.ecl ? ab('ecl', 'Use ' + r.ecl) : '') +
      row('📏', 'Size', `≥ ${r.cm} cm · ${r.px}px`, esc(r.sizeWhy), r.px !== cur.size ? ab('size', 'Use ' + r.px + 'px') : '') +
      row('🏷️', 'Logo placement', r.logo.ok ? 'Allowed' : 'Skip it', esc(r.logo.text)) +
      (r.hosting ? row('📎', 'File hosting', 'Host on QRNova', esc(r.hosting.text), `<a class="btn btn-ghost sm" href="${esc(r.hosting.href)}">Open</a>`) : '') +
      row('🎨', 'Design', esc(r.design.name), esc(r.design.why), ab('design', 'Apply'));
  }
  $('#recs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rec]'); if (!b || !cur || !cur.rec) return;
    const r = cur.rec, k = b.dataset.rec;
    if (k === 'mode') setMode(r.mode);
    if (k === 'ecl') { cur.ecl = r.ecl; syncStyleUi(); cur.scan = null; refresh().then(scheduleScan); }
    if (k === 'size') { cur.size = r.px; syncStyleUi(); qualityRender(); recsRender(); }
    if (k === 'design') { applyDesign(r.design); afterStyle(); toast('🎨 ' + r.design.name); }
  });
  function qualityRender() {
    if (!cur) return;
    const s = cur.style;
    const q = B.quality({ issues: cur.issues || [], style: { fg: s.fg, fg2: s.useGrad ? s.fg2 : null, eye: s.eye, bg: s.transp ? 'transparent' : s.bg, margin: +s.margin }, logo: !!cur.logo, ecl: effEcl(), stats: cur.stats, scan: cur.scan, size: cur.size });
    cur.q = q;
    $('#quality').innerHTML = `<div class="q-head"><div class="q-ring" style="--p:${q.score}"><b>${q.score}</b></div><div><b>${esc(q.verdict)}</b><small class="mut" style="display:block">Updates live as you edit</small></div></div>${qualityList(q)}`;
  }
  function controls() {
    const g = $('#genBtn'), dl = ready();
    ['dlPng', 'dlJpg', 'dlWebp', 'dlSvg', 'print', 'share', 'copy'].forEach((id) => { $('#' + id).disabled = !dl; });
    $('#testBtn').disabled = !(cur && cur.rows && !cur.dim);
    if (!cur) { g.disabled = true; g.textContent = '⚡ Generate QR'; return; }
    if (TYPES[cur.type].dyn === 'file') { g.disabled = false; g.textContent = '☁️ Open File → QR'; return; }
    g.disabled = cur.issues.some(isBlock) || !!cur.created || gbusy;
    g.textContent = cur.created ? '✅ Dynamic QR created' : cur.mode === 'dynamic' ? '🔄 Create Dynamic QR' : cur.generated ? '🔁 Generate again' : '⚡ Generate QR';
  }
  async function refresh() {
    const my = ++seq;
    if (!cur) return;
    const T = TYPES[cur.type], eff = effEcl();
    cur.issues = B.validate(cur.type, cur.fields, { mode: cur.mode, ecl: eff });
    paintIssues(); markFields();
    cur.rec = B.recommend(cur.type, cur.fields, recCtx());
    if (T.dyn === 'file') {
      cur.rows = null; cur.stats = null; stageEmpty('Files are hosted, not embedded. Upload yours on the File → QR page.', '📎');
      $('#info').innerHTML = `<p>${esc(cur.rec.hosting ? cur.rec.hosting.text : 'Host your file securely and the QR will hold a short link.')}</p>`;
      recsRender(); qualityRender(); controls(); return;
    }
    const bad = cur.issues.find(isBlock);
    if (bad) { cur.rows = null; cur.stats = null; cur.dim = false; stageEmpty(bad.msg); $('#info').innerHTML = ''; recsRender(); qualityRender(); controls(); return; }
    let payload, dim = false;
    if (cur.mode === 'dynamic') { if (cur.created) payload = cur.created.url; else { payload = location.origin + '/q/preview'; dim = true; } }
    else payload = B.build(cur.type, cur.fields, 'static');
    if (!payload) { cur.rows = null; cur.stats = null; stageEmpty('Enter your content'); recsRender(); qualityRender(); controls(); return; }
    try {
      const m = await QRX.matrix(payload, eff);
      if (my !== seq) return;
      Object.assign(cur, { rows: m.rows, stats: m, payload, dim });
      cur.rec = B.recommend(cur.type, cur.fields, recCtx(m));
      paint(); infoRender(); recsRender(); qualityRender(); controls();
    } catch (e) { if (my === seq) { cur.rows = null; cur.stats = null; stageEmpty(e.message); qualityRender(); controls(); } }
  }
  function renderAll() {
    $('#work').classList.remove('empty');
    renderDetails(); renderModeBar(); syncStyleUi();
    refresh().then(() => { if (cur && cur.generated) scheduleScan(); });
  }
  function clearWork() {
    cur = null; seq++; $('#work').classList.add('empty');
    stageEmpty('Describe what you want. Your QR appears here'); $('#info').innerHTML = ''; $('#modeBar').innerHTML = ''; controls();
  }

  /* ═══════════ design controls ═══════════ */
  function syncStyleUi() {
    if (!cur) return; const s = cur.style;
    $('#sFg').value = s.fg; $('#sFg2').value = s.fg2 || '#0e7490'; $('#sBg').value = s.bg; $('#sEye').value = s.eye || s.fg;
    $('#sGrad').checked = !!s.useGrad; $('#sTransp').checked = !!s.transp; $('#sMargin').value = s.margin; $('#sMarginOut').textContent = s.margin + ' modules';
    $$('#sDots button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.dots));
    $$('#sEyes button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.eyes));
    $('#sEcl').value = cur.ecl; $('#sEcl').disabled = !!cur.logo; $('#sSize').value = String(cur.size); $('#sLabel').value = cur.label; $('#logoClear').hidden = !cur.logo;
  }
  function applyDesign(d) {
    const s = d.style, base = B.defaultStyle();
    cur.style = Object.assign(base, { fg: s.fg, fg2: s.fg2 || base.fg2, eye: s.eye || s.fg, dots: s.dots, eyes: s.eyes, useGrad: !!s.fg2 });
    if (d.label && !cur.label) cur.label = d.label;
    cur.styled = true; cur.themeName = d.name; cur.scan = null; syncStyleUi();
  }
  function afterStyle() { syncStyleUi(); if (cur.rows) paint(); qualityRender(); scheduleScan(); }
  function scheduleScan() { clearTimeout(scanTimer); if (cur && cur.generated) scanTimer = setTimeout(runScan, 700); }
  const styleChanged = () => { if (!cur) return; cur.styled = true; cur.themeName = ''; cur.scan = null; if (cur.rows) paint(); qualityRender(); scheduleScan(); };
  [['sFg', 'fg'], ['sFg2', 'fg2'], ['sBg', 'bg'], ['sEye', 'eye']].forEach(([id, k]) => $('#' + id).addEventListener('input', (e) => { if (cur) { cur.style[k] = e.target.value; styleChanged(); } }));
  $('#sGrad').addEventListener('input', (e) => { if (cur) { cur.style.useGrad = e.target.checked; styleChanged(); } });
  $('#sTransp').addEventListener('input', (e) => { if (cur) { cur.style.transp = e.target.checked; styleChanged(); } });
  $('#sMargin').addEventListener('input', (e) => { if (cur) { cur.style.margin = +e.target.value; $('#sMarginOut').textContent = e.target.value + ' modules'; styleChanged(); } });
  [['sDots', 'dots'], ['sEyes', 'eyes']].forEach(([id, k]) => $$('#' + id + ' button').forEach((b) => (b.onclick = () => { if (!cur) return; cur.style[k] = b.dataset.v; syncStyleUi(); styleChanged(); })));
  $('#sEcl').addEventListener('input', (e) => { if (cur) { cur.ecl = e.target.value; cur.scan = null; refresh().then(scheduleScan); } });
  $('#sSize').addEventListener('input', (e) => { if (cur) { cur.size = +e.target.value; qualityRender(); recsRender(); } });
  $('#sLabel').addEventListener('input', (e) => { if (cur) { cur.label = e.target.value; cur.scan = null; if (cur.rows) paint(); qualityRender(); scheduleScan(); } });
  $('#frameAuto').onclick = () => { if (cur) { cur.label = B.frameLabel(cur.type); syncStyleUi(); afterStyle(); } };
  $('#logoBtn').onclick = () => $('#logoIn').click();
  $('#logoIn').addEventListener('change', (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f || !cur) return;
    if (!/^image\//.test(f.type)) return toast('Choose an image file');
    if (f.size > 400 * 1024) return toast('Logo must be under 400 KB');
    const r = new FileReader();
    r.onload = () => { cur.logo = r.result; cur.scan = null; syncStyleUi(); refresh().then(scheduleScan); toast('Logo added. Error correction is now H'); };
    r.readAsDataURL(f);
  });
  $('#logoClear').onclick = () => { if (cur) { cur.logo = null; cur.scan = null; syncStyleUi(); refresh().then(scheduleScan); } };
  $('#themes').innerHTML = B.themeList().map((t) => `<button type="button" class="th" data-k="${t.key}" style="--a:${t.c[0]};--b:${t.c[1] || t.c[0]}"><i></i>${esc(t.n)}</button>`).join('');
  $('#themes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b || !cur) return;
    const d = B.designFor('', { key: b.dataset.k, type: cur.type }); applyDesign(d); afterStyle(); toast('🎨 ' + d.name);
  });
  $('#dprompts').innerHTML = DESIGN_PROMPTS.map((p) => `<button type="button" class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('');
  $('#dprompts').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) send(b.dataset.p); });

  /* ═══════════ scan test + export ═══════════ */
  async function runScan() {
    if (!cur || !cur.rows) return;
    if (!('BarcodeDetector' in window)) { cur.scan = 'na'; qualityRender(); return; }
    try {
      const svg = QRX.framed(cur.rows, qo(720), cur.label, 720), d = QRX.svgDims(svg);
      const bmp = await createImageBitmap(await QRX.toBlob(svg, d[0], d[1], 'image/jpeg'));
      const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bmp), norm = (s) => String(s).replace(/\r/g, '');
      cur.scan = r.length ? (norm(r[0].rawValue) === norm(cur.payload) ? 'ok' : 'diff') : 'fail';
    } catch (e) { cur.scan = 'na'; }
    qualityRender();
  }
  $('#testBtn').onclick = async () => { await runScan(); toast(cur && cur.scan === 'ok' ? '✅ Scan test passed' : cur && cur.scan === 'na' ? 'Auto test is not supported here. Test with your phone' : '⚠️ See the quality check'); };
  const safePx = (p) => (cur.label.trim() ? Math.min(p, 3725) : p);
  async function exportImg(mime, ext) {
    if (!ready()) return toast('Generate the QR first');
    const want = cur.size, p = safePx(want); if (p < want) toast(`Framed exports are limited to ${p}px wide`);
    const svg = QRX.framed(cur.rows, qo(p), cur.label, p), d = QRX.svgDims(svg);
    QRX.save(await QRX.toBlob(svg, d[0], d[1], mime), `qrnova-${cur.type}.${ext}`);
  }
  async function exportAs(fmt) {
    if (!ready()) return toast('Generate the QR first');
    if (fmt === 'svg') return QRX.save(new Blob([QRX.framed(cur.rows, qo(cur.size), cur.label, cur.size)], { type: 'image/svg+xml' }), `qrnova-${cur.type}.svg`);
    await exportImg({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png', fmt);
  }
  function printNow() {
    if (!ready()) return toast('Generate the QR first');
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print');
    w.document.write(`<!doctype html><title>QR code</title><body style="margin:0;display:grid;place-items:center;min-height:100vh"><img src="${QRX.svgUrl(QRX.framed(cur.rows, qo(1200), cur.label, 1200))}" style="max-width:90vw;max-height:90vh" onload="setTimeout(function(){print()},250)">`);
    w.document.close();
  }
  const wrap = (fn) => async () => { try { await fn(); } catch (e) { if (e && e.name !== 'AbortError') toast(e.message || 'Export failed'); } };
  $('#dlPng').onclick = wrap(() => exportAs('png'));
  $('#dlJpg').onclick = wrap(() => exportAs('jpg'));
  $('#dlWebp').onclick = wrap(() => exportAs('webp'));
  $('#dlSvg').onclick = wrap(() => exportAs('svg'));
  $('#print').onclick = printNow;
  $('#copy').onclick = () => { if (ready()) navigator.clipboard.writeText(cur.created ? cur.created.url : cur.payload).then(() => toast('Copied')); };
  $('#share').onclick = wrap(async () => {
    if (!ready()) return;
    const svg = QRX.framed(cur.rows, qo(1024), cur.label, 1024), d = QRX.svgDims(svg), blob = await QRX.toBlob(svg, d[0], d[1], 'image/png'), f = new File([blob], 'qrnova.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'My QR code' });
    else { await navigator.clipboard.writeText(cur.created ? cur.created.url : cur.payload); toast('Sharing is not supported here. Content copied'); }
  });

  /* ═══════════ generate / create dynamic ═══════════ */
  async function generate() {
    if (!cur || gbusy) return false;
    if (TYPES[cur.type].dyn === 'file') { location.href = hostHref(); return false; }
    clearTimeout(timer); await refresh();
    const bad = cur.issues.filter(isBlock);
    if (bad.length) { say('⚠️ I can’t generate yet:\n' + bad.slice(0, 4).map((i) => '• ' + i.msg).join('\n') + '\nFix these in the Details panel, or tell me the values here.'); $('#dCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); return false; }
    if (!cur.rows) return false;
    gbusy = true; controls();
    try {
      if (cur.mode === 'dynamic') return await createDynamic();
      cur.generated = true; controls(); await runScan(); afterGenerate(); return true;
    } finally { gbusy = false; controls(); }
  }
  async function createDynamic() {
    if (!logged()) {
      try { sessionStorage.setItem('qrn_ai_draft', JSON.stringify(snapshot())); } catch (e) { /* ignore */ }
      say('🔐 Dynamic QR codes need a free account. Taking you to log in. I will keep your QR ready when you come back.');
      toast('Please log in to create Dynamic QR codes');
      setTimeout(() => { location.href = '/login?next=' + en('/ai-qr'); }, 1100);
      return false;
    }
    const T = TYPES[cur.type], v = cur.fields, fd = new FormData(), kind = T.dyn === 'page' ? 'page' : 'url';
    fd.append('type', cur.type); fd.append('kind', kind);
    if (kind === 'page') {
      const d = {}; Object.keys(v).forEach((k) => { if (v[k] !== '' && v[k] !== false && v[k] != null) d[k] = String(v[k]); });
      fd.append('title', String(v.name || T.label).slice(0, 120)); fd.append('data', JSON.stringify(d));
      if (cur.file) fd.append('file', cur.file);
    } else {
      const link = B.link(cur.type, v);
      if (!/^https?:\/\//i.test(link)) { say('A Dynamic QR needs a web link (http/https). Switch to **Static** or use the “Map link” format.'); return false; }
      fd.append('title', (T.label + ': ' + host(link)).slice(0, 120)); fd.append('target', link);
    }
    try {
      cur.created = await QRX.api('/api/dynamic', { method: 'POST', body: fd });
      cur.generated = true; cur.scan = null; await refresh(); await runScan(); afterGenerate(); return true;
    } catch (e) { toast(e.message); say('⚠️ I could not create the Dynamic QR: ' + e.message); return false; }
  }
  const host = (u) => { const x = B.parseUrl(u); return x ? x.hostname.replace(/^www\./, '') : u; };
  function afterGenerate() {
    qualityRender();
    const q = cur.q, sugg = B.suggest({ type: cur.type, mode: cur.mode, created: !!cur.created, logo: !!cur.logo, stats: cur.stats, label: cur.label, isDefault: !cur.styled });
    stage.classList.add('pop'); setTimeout(() => stage.classList.remove('pop'), 900);
    say(`${cur.created ? '🔄 **Dynamic QR created.** Scanning opens your live page; edit it any time from the [[dashboard|/dashboard]].' : '✅ **QR generated.**'} Quality score **${q.score}/100**: ${q.verdict}.`, { card: { kind: 'quality', q, sugg } });
  }
  $('#genBtn').onclick = () => generate();

  /* ═══════════ chat logic ═══════════ */
  function makeCreate(text) {
    const det = B.detect(text), T = TYPES[det.type];
    const rec = B.recommend(det.type, det.fields, { text, fileKind: det.ent.fileKind, designText: (det.ent.category || '') + ' ' + text });
    const needs = B.needs(det.type, det.fields);
    let s = det.direct ? `**${T.label} QR detected.**` : `I detected a **${T.label} QR** (${det.conf}% confident).`;
    if (det.reason) s += ` ${det.reason}.`;
    s += `\nRecommended: **${rec.title}**: ${rec.modeWhy}`;
    s += needs.length ? `\nI still need: **${needs.join('**, **')}**. Fill it in on the right, or tell me here.` : '\nEverything looks complete. Review the details, then press **Generate**.';
    return { kind: 'create', det, rec, design: null, say: s };
  }
  function startCreation(r, text, src) {
    const det = r.det, t = B.tidy(det.type, Object.assign(blank(det.type), det.fields));
    cur = newCur(det.type, t.values, { mode: r.rec.mode, ecl: r.rec.ecl, size: r.rec.px, prompt: text, ent: det.ent });
    const d = r.design || S.pendingDesign; S.pendingDesign = null;
    if (d) applyDesign(d);
    let s = (src ? `📖 I read **${src.name}** (${src.chars} characters${src.pages ? ', ' + src.pages + ' pages' : ''}${src.truncated ? ', truncated' : ''}).\n` : '') + r.say;
    if (t.changes.length) s += `\n✨ Auto-formatted: **${t.changes.slice(0, 5).map((c) => c.k).join(', ')}**.`;
    if (d) s += `\n🎨 Styled as **${d.name}**: ${d.why}`;
    if (cur.mode === 'dynamic' && !logged()) s += '\n🔐 Creating a Dynamic QR needs a free account. I will take you to log in and bring you back here.';
    renderAll();
    addMsg({ role: 'ai', text: s, card: { kind: 'detect', det, rec: r.rec, source: src ? { name: src.name, chars: src.chars, pages: src.pages, preview: src.preview } : null }, result: snapshot() });
  }
  function applyUpdate(r) {
    const T = TYPES[cur.type], changed = [];
    Object.keys(r.fields || {}).forEach((k) => {
      const v = r.fields[k];
      if (v == null || v === '' || v === false || !(k in cur.fields)) return;
      if ((r.overwrite || !String(cur.fields[k] || '').trim()) && String(cur.fields[k]) !== String(v)) { cur.fields[k] = v; changed.push(k); }
    });
    if (changed.length) cur.fields = B.tidy(cur.type, cur.fields).values;
    cur.generated = false; cur.created = null; cur.scan = null;
    renderDetails(); refresh();
    const needs = B.needs(cur.type, cur.fields), lab = changed.map((k) => (T.fields.find((f) => f.k === k) || { l: k }).l);
    say(changed.length ? `Updated **${lab.join('**, **')}**. ` + (needs.length ? `Still needed: **${needs.join('**, **')}**.` : 'Everything looks complete. Press **Generate**.') : 'I did not find anything new to change. Edit the details on the right, or describe it again.');
  }
  function switchType(type, fields) {
    if (!cur || !TYPES[type] || type === cur.type) return;
    const old = cur, F = fields || (old.ent ? B.fieldsFrom(type, old.ent, old.prompt) : {});
    const n = newCur(type, F, { ecl: old.ecl, size: old.size, prompt: old.prompt, ent: old.ent });
    n.mode = B.recommend(type, n.fields, { text: old.prompt }).mode;
    Object.assign(n, { style: old.style, label: old.label, logo: old.logo, styled: old.styled, themeName: old.themeName, print: old.print });
    cur = n; renderAll();
    const needs = B.needs(type, cur.fields);
    say(`Switched to **${TYPES[type].label} QR**.` + (needs.length ? ` I still need: **${needs.join('**, **')}**.` : ' Everything looks complete.'));
  }
  function focusDesign(sel) {
    $('#sCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const el = $(sel); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2100); }
  }
  function doSuggest(id) {
    if (!cur) return;
    if (id === 'logo') { focusDesign('#logoBtn'); $('#logoIn').click(); }
    else if (id === 'dynamic') { if (!MODE_OK(cur.type)) return toast('This QR type is static only'); setMode('dynamic'); say('Switched to **Dynamic**. You can edit it later and see scans. ' + (logged() ? 'Press **Create Dynamic QR**.' : 'You will be asked to log in when you create it.')); }
    else if (id === 'brand') { focusDesign('#sFg'); toast('Pick your brand colour'); $('#sFg').click(); }
    else if (id === 'frame') { cur.label = B.frameLabel(cur.type); afterStyle(); toast('Frame added'); }
    else if (id === 'dash') location.href = '/dashboard';
    else if (id === 'host') location.href = hostHref();
  }
  async function applyActs(acts, text) {
    if (acts.some((a) => a.a === 'new')) return newSession();
    if (!cur) {
      const d = acts.find((a) => a.a === 'design');
      if (d) S.pendingDesign = d.design;
      addMsg({ role: 'ai', text: d ? `Good idea. I will use the **${d.design.name}** style. Now tell me what the QR should contain (a link, a menu, Wi-Fi, a payment…).` : 'Tell me first what to turn into a QR code, then I can style, check or download it.' });
      return;
    }
    const out = [], post = [], T = TYPES[cur.type];
    for (const a of acts) {
      if (a.a === 'design') { applyDesign(a.design); out.push(`🎨 Styled it as **${a.design.name}**: ${a.design.why}`); }
      else if (a.a === 'logoOff') { cur.logo = null; out.push('Removed the logo.'); }
      else if (a.a === 'logo') { out.push('Use **Add logo** in the Design panel (square PNG/JPG under 400 KB). I will raise error correction to **H** automatically.'); post.push(a); }
      else if (a.a === 'mode') {
        if (!MODE_OK(cur.type)) out.push(`${T.label} codes can only be ${T.dyn === 'file' ? 'hosted files' : 'static'}.`);
        else { cur.mode = a.mode; cur.created = null; cur.generated = false; out.push(a.mode === 'dynamic' ? '🔄 Switched to **Dynamic**: editable later, with scan analytics.' + (logged() ? '' : ' It needs a free account when you create it.') : '⚡ Switched to **Static**.'); }
      }
      else if (a.a === 'print') {
        cur.print = true;
        const rec = B.recommend(cur.type, cur.fields, { text: text + ' ' + cur.prompt, print: true, logo: !!cur.logo, bytes: cur.stats && cur.stats.bytes, modules: cur.stats && cur.stats.size });
        if (!cur.logo) cur.ecl = rec.ecl; cur.size = a.poster ? 4096 : rec.px;
        out.push(`🖨️ Print-ready: error correction **${effEcl()}**, export **${cur.size}px**, and print at least **${rec.cm} cm** wide with a white background.`);
      }
      else if (a.a === 'size') { cur.size = a.px; out.push(`Export size set to **${a.px}px**.`); }
      else if (a.a === 'ecl') { cur.ecl = a.v; out.push(cur.logo ? 'A logo is present, so error correction stays at **H**.' : `Error correction set to **${a.v}**.`); }
      else if (a.a === 'frame') { cur.label = a.label; out.push(a.label ? `Added the frame “${a.label}”.` : 'Removed the frame.'); }
      else if (a.a === 'tidy') { const t = B.tidy(cur.type, cur.fields); cur.fields = t.values; cur.generated = false; cur.created = null; out.push(t.changes.length ? '✨ Formatted: ' + t.changes.map((c) => c.k).join(', ') + '.' : 'Everything is already neatly formatted.'); }
      else if (a.a === 'describe') {
        if (T.fields.some((f) => f.k === 'desc')) { cur.fields.desc = B.describe(cur.type, cur.fields, cur.ent && cur.ent.category); cur.generated = false; cur.created = null; out.push('✍️ Wrote a short description. Edit it in the Details panel.'); }
        else out.push('Descriptions apply to Business, Menu, Product and Event QR codes.');
      }
      else post.push(a);
    }
    cur.scan = null; renderDetails(); renderModeBar(); syncStyleUi();
    if (out.length) say(out.join('\n'));
    await refresh();
    for (const a of post) {
      if (a.a === 'logo') focusDesign('#logoBtn');
      else if (a.a === 'generate') await generate();
      else if (a.a === 'download') { if (!cur.generated && !(await generate())) continue; await exportAs(a.fmt || 'png'); }
      else if (a.a === 'printNow') { if (!cur.generated && !(await generate())) continue; printNow(); }
      else if (a.a === 'test') {
        if (!cur.rows) { say('There is nothing to test yet. Complete the details first.'); continue; }
        await runScan(); say(cur.scan === 'ok' ? '🧪 Scan test passed.' : cur.scan === 'na' ? '🧪 Auto scan-test needs Chrome or Edge. Please test with your phone.' : '🧪 The test found a problem. See the checks below.', { card: { kind: 'quality', q: cur.q, sugg: [] } });
      }
    }
  }
  async function send(raw) {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    busy = true; $('#sendBtn').disabled = true;
    try {
      $('#starters').hidden = true; addMsg({ role: 'user', text });
      const r = B.understand(text, cur ? { type: cur.type, missing: B.needs(cur.type, cur.fields).length > 0 } : null);
      await think(r.kind === 'create' ? ['Reading your request', 'Detecting content types', 'Choosing the best QR format'] : ['Thinking']);
      if (r.kind === 'answer') addMsg({ role: 'ai', text: r.text });
      else if (r.kind === 'edit') await applyActs(r.acts, text);
      else if (r.kind === 'update') applyUpdate(r);
      else startCreation(r, text);
    } catch (e) { console.error(e); addMsg({ role: 'ai', text: 'Sorry, something went wrong: ' + e.message }); }
    busy = false; $('#sendBtn').disabled = false; flushSoon();
  }
  const grow = () => { pin.style.height = 'auto'; pin.style.height = Math.min(pin.scrollHeight, 150) + 'px'; };
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = pin.value.trim();
    if (!t) { if (cur) generate(); else toast('Type what you want to create first'); return; }
    pin.value = ''; grow(); send(t);
  });
  pin.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#sendBtn').click(); } });
  pin.addEventListener('input', grow);
  $('#starters').innerHTML = STARTERS.map((s) => `<button type="button" class="chip" data-p="${esc(s)}">${esc(s.length > 60 ? s.slice(0, 58) + '…' : s)}</button>`).join('');
  $('#starters').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) send(b.dataset.p); });
  log.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-switch]'); if (sw) return switchType(sw.dataset.switch);
    const sg = e.target.closest('[data-sg]'); if (sg) return doSuggest(sg.dataset.sg);
    const op = e.target.closest('[data-open]');
    if (op) { const m = S.msgs[+op.dataset.open]; if (m && m.result) { restore(m.result); toast('Version reopened'); } }
  });

  /* ═══════════ restore a saved version ═══════════ */
  function restore(r) {
    if (!r || !TYPES[r.type]) return;
    const T = TYPES[r.type], mode = (MODE_OK(r.type) || T.dyn === 'file') && r.mode === 'dynamic' ? 'dynamic' : 'static';
    cur = newCur(r.type, r.fields, { mode, ecl: ['L', 'M', 'Q', 'H'].includes(r.ecl) ? r.ecl : 'M', size: [512, 1024, 2048, 4096].includes(+r.size) ? +r.size : 1024, prompt: r.prompt || '', ent: B.entities(r.prompt || '') });
    const st = Object.assign(B.defaultStyle(), r.style || {}), def = B.defaultStyle();
    ['fg', 'fg2', 'bg', 'eye'].forEach((k) => { if (!HEX.test(st[k] || '')) st[k] = def[k]; });
    st.margin = Math.min(8, Math.max(1, +st.margin || 4));
    if (!['square', 'rounded', 'dots', 'diamond'].includes(st.dots)) st.dots = 'rounded';
    if (!['square', 'rounded', 'circle'].includes(st.eyes)) st.eyes = 'rounded';
    cur.style = st; cur.label = String(r.frame || '').slice(0, 32); cur.created = r.created && r.created.url ? r.created : null;
    cur.generated = !!r.generated; cur.styled = !!r.styled; cur.themeName = r.theme || '';
    if (r.hadLogo) toast('Logos are not saved in history. Add it again if you need it.');
    if (r.type === 'wifi' && cur.fields.enc !== 'nopass') toast('For safety Wi-Fi passwords are never saved. Please enter it again.');
    renderAll();
  }

  /* ═══════════ read a file: TXT / VCF / CSV / PDF / DOCX / image (OCR) ═══════════ */
  const attachBar = $('#attachBar');
  const setAttach = (h) => { attachBar.hidden = false; attachBar.innerHTML = h; };
  function clearAttach() { attachBar.hidden = true; attachBar.innerHTML = ''; }
  function loadTess() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tess) tess = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = () => res(window.Tesseract); s.onerror = () => { tess = null; rej(new Error('The OCR engine could not be loaded. Check your internet connection, or paste the text instead.')); };
      document.head.appendChild(s);
    });
    return tess;
  }
  async function ocr(file) {
    const T = await loadTess();
    setAttach('🔍 Reading text from the image… (the first run downloads ~10 MB of language data)');
    const r = await T.recognize(file, 'eng', { logger: (m) => { if (m.status === 'recognizing text') setAttach(`🔍 Reading text… ${Math.round(m.progress * 100)}%`); } });
    return (r.data && r.data.text) || '';
  }
  async function attach(f) {
    if (busy) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (f.size > 8 * 1048576) return toast('File is too large to read (max 8 MB)');
    busy = true; $('#sendBtn').disabled = true;
    setAttach(`📎 ${esc(f.name)}: reading…`);
    let text = '', meta = {};
    try {
      if (['txt', 'vcf', 'csv', 'md'].includes(ext)) text = await f.slice(0, 400000).text();
      else if (['pdf', 'docx'].includes(ext)) {
        if (!logged()) throw new Error('Log in to read PDF and DOCX files');
        const fd = new FormData(); fd.append('file', f);
        meta = await api('/api/ai/extract', { method: 'POST', body: fd }); text = meta.text;
      } else if (/^image\//.test(f.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) text = await ocr(f);
      else throw new Error('This file type cannot be read. Try TXT, VCF, CSV, PDF, DOCX or a photo.');
      text = B.cleanText(text).slice(0, 20000);
      if (/^BEGIN:VCARD/i.test(text)) text = text.split(/END:VCARD/i)[0] + '\nEND:VCARD';
      if (!text) throw new Error('No readable text found in this file');
      clearAttach();
      addMsg({ role: 'user', text: `📎 ${f.name}` });
      await think(['Reading the file', 'Extracting links, emails, phones…', 'Choosing the best QR format']);
      let r = B.understand(text, null);
      if (r.kind !== 'create') r = makeCreate(text);
      startCreation(r, text, { name: f.name, chars: meta.chars || text.length, pages: meta.pages, truncated: meta.truncated, preview: text.slice(0, 600) });
    } catch (e) { clearAttach(); toast(e.message); }
    busy = false; $('#sendBtn').disabled = false; flushSoon();
  }
  $('#attachBtn').onclick = () => $('#attachIn').click();
  $('#attachIn').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) attach(f); });


    /* ═══════════ send to the Design Studio (lifecycle: Customize → Save → Manage) ═══════════ */
  (() => {
    const a = document.createElement('a');
    a.className = 'btn btn-ghost sm'; a.id = 'toDesign'; a.textContent = '🎨 Design & save'; a.href = '/design-studio';
    $('#dl').appendChild(a);
    a.addEventListener('click', (e) => {
      if (!cur || !cur.rows || cur.dim) { e.preventDefault(); return toast('Generate your QR first'); }
      a.href = '/design-studio?data=' + encodeURIComponent(String(cur.payload).slice(0, 2500));
    });
  })();


  /* ═══════════ init ═══════════ */
  (function init() {
    $('#typeSel').innerHTML = Object.keys(TYPES).map((k) => `<option value="${k}">${TYPES[k].icon} ${esc(TYPES[k].label)}</option>`).join('');
    greet(); renderLog(); clearWork(); renderHistory(); refreshHistory();
    let draft = null;
    try { draft = sessionStorage.getItem('qrn_ai_draft'); if (draft) sessionStorage.removeItem('qrn_ai_draft'); } catch (e) { /* ignore */ }
    if (draft && logged()) {
      try { restore(JSON.parse(draft)); addMsg({ role: 'ai', local: true, text: '👋 Welcome back. I kept your QR. Press **Create Dynamic QR** to finish.' }); return; } catch (e) { /* ignore */ }
    }
    const q = new URLSearchParams(location.search).get('prompt');
    if (q) send(q.slice(0, 3000));
  })();
})();
(() => {
  'use strict';
  const Q = window.QRX;
  if (!Q) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement, esc = Q.esc;
  const ago = (t) => { const d = (Date.now() - t) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : new Date(t).toLocaleDateString(); };

  /* ═══════ theme: Light / Dark / System ═══════ */
  const mql = matchMedia('(prefers-color-scheme: light)');
  const getPref = () => { try { const v = localStorage.getItem('qrn_theme'); return v === 'light' || v === 'system' ? v : 'dark'; } catch (e) { return 'dark'; } };
  function applyTheme(p) {
    const r = p === 'system' ? (mql.matches ? 'light' : 'dark') : p;
    root.dataset.theme = r; root.dataset.pref = p;
    const m = $('meta[name=theme-color]'); if (m) m.content = r === 'light' ? '#f6f8fc' : '#020617';
  }
  const setPref = (p) => { try { localStorage.setItem('qrn_theme', p); } catch (e) { /* ignore */ } applyTheme(p); };
  (mql.addEventListener ? mql.addEventListener.bind(mql, 'change') : mql.addListener.bind(mql))(() => { if (getPref() === 'system') applyTheme('system'); });
  applyTheme(getPref());
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('rm');

  /* ═══════ popover helper (keyboard accessible) ═══════ */
  function pop(btn, menu, o) {
    o = o || {};
    const close = (focus) => { if (menu.hidden) return; menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); };
    const open = () => {
      $$('.pop').forEach((m) => { if (m !== menu) m.hidden = true; });
      $$('.dd.open').forEach((d) => { d.classList.remove('open'); $('.dd-b', d).setAttribute('aria-expanded', 'false'); });
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); if (o.onOpen) o.onOpen();
      const f = $('[aria-checked=true],button,a', menu); if (f) f.focus();
    };
    btn.addEventListener('click', () => (menu.hidden ? open() : close(true)));
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) close(false); });
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const it = $$('button:not([disabled]),a[href]', menu), i = it.indexOf(document.activeElement);
        if (it.length) { e.preventDefault(); it[(i + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length].focus(); }
      } else if (e.key === 'Tab') close(false);
    });
    return { open, close };
  }
  function themeMenu() {
    const old = $('#theme'); if (!old) return;
    const w = document.createElement('div'); w.className = 'pop-wrap';
    w.innerHTML = `<button class="icon-btn" id="theme" type="button" aria-label="Theme" aria-haspopup="menu" aria-expanded="false"><span aria-hidden="true">🌓</span></button><div class="pop tm" role="menu" aria-label="Theme" hidden>${[['light', '☀️', 'Light'], ['dark', '🌙', 'Dark'], ['system', '💻', 'System']].map(([k, i, l]) => `<button type="button" role="menuitemradio" data-t="${k}" aria-checked="false"><span aria-hidden="true">${i}</span><span>${l}</span><b aria-hidden="true">✓</b></button>`).join('')}</div>`;
    old.replaceWith(w); // replacing the node drops the old dark/light-only click handler from core.js
    const menu = $('.pop', w), sync = () => $$('[data-t]', menu).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.t === getPref())));
    const p = pop($('#theme', w), menu, { onOpen: sync });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      setPref(b.dataset.t); sync(); p.close(true); Q.notify.info('Theme: ' + $('span:nth-child(2)', b).textContent);
    });
  }

  /* ═══════ header dropdowns: Create ▾ and More ▾ (hover, click and keyboard) ═══════ */
  function dropdowns() {
    const dds = $$('.dd'); if (!dds.length) return;
    const shut = (d) => { d.classList.remove('open'); $('.dd-b', d).setAttribute('aria-expanded', 'false'); };
    const closeAll = (except) => dds.forEach((d) => { if (d !== except) shut(d); });
    dds.forEach((d) => {
      const b = $('.dd-b', d), m = $('.dd-m', d);
      b.addEventListener('click', () => {
        const o = !d.classList.contains('open');
        closeAll(d); $$('.pop').forEach((x) => { x.hidden = true; });
        d.classList.toggle('open', o); b.setAttribute('aria-expanded', String(o));
      });
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown') return;
        e.preventDefault(); closeAll(d); d.classList.add('open'); b.setAttribute('aria-expanded', 'true');
        const f = $('a', m); if (f) f.focus();
      });
      d.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { shut(d); b.focus(); }
        else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target !== b) {
          const it = $$('a', m), i = it.indexOf(document.activeElement); if (!it.length) return;
          e.preventDefault(); it[(i + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length].focus();
        }
      });
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.dd')) closeAll(); });
    $$('.tbn a.act').forEach((a) => a.setAttribute('aria-current', 'page'));
  }

  /* ═══════ avatar menu (logged-in users) ═══════ */
  function avatar() {
    const u = Q.user(); if (!Q.token() || !u) return;
    const hr = $('.hdr-r'); if (!hr || $('.avw')) return;
    const ini = String(u.name || u.email || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';
    const staff = u.role && u.role !== 'user';
    const items = [['/dashboard', '📊', 'Dashboard'], ['/my-qr-codes', '▦', 'My QR codes'], ['/my-files', '📁', 'My files'], ['/analytics', '📈', 'Analytics'], ['/account', '👤', 'Account settings']].concat(staff ? [['/admin', '🛡️', 'Admin panel']] : []);
    const w = document.createElement('div'); w.className = 'pop-wrap avw';
    w.innerHTML = `<button class="avb" id="avBtn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu for ${esc(u.name || u.email)}">${esc(ini)}</button><div class="pop avm" role="menu" hidden><div class="avh"><b>${esc(u.name || '')}</b><small>${esc(u.email || '')}</small>${staff ? `<span class="bdg ok">${u.role === 'superadmin' ? '⭐ Super Admin' : '🛡️ Admin'}</span>` : ''}</div>${items.map(([h, i, l]) => `<a role="menuitem" href="${h}"><span aria-hidden="true">${i}</span>${l}</a>`).join('')}<hr><button type="button" role="menuitem" data-lo><span aria-hidden="true">🚪</span>Log out</button></div>`;
    hr.insertBefore(w, $('#burger', hr));
    pop($('#avBtn', w), $('.pop', w));
    $('[data-lo]', w).onclick = async () => { try { await Q.api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ } Q.clearAuth(); location.href = '/'; };
  }
  // keeps the avatar name and role current (also detects an expired login)
  async function refreshMe() {
    if (!Q.token()) return;
    try { const t = +sessionStorage.getItem('qrn_me'); if (t && Date.now() - t < 300000) return; } catch (e) { /* ignore */ }
    try {
      const r = await Q.api('/api/auth/me'), u = Q.user() || {};
      if (r.user && (r.user.role !== u.role || r.user.name !== u.name)) {
        Q.setAuth(Q.token(), { id: r.user.id, name: r.user.name, email: r.user.email, role: r.user.role });
        const old = $('.avw'); if (old) old.remove();
        avatar();
        if (r.user.role && r.user.role !== 'user') $$('[data-staff]').forEach((e) => { e.hidden = false; });
      }
      try { sessionStorage.setItem('qrn_me', String(Date.now())); } catch (e) { /* ignore */ }
    } catch (e) {
      if (/log in/i.test(e.message)) { Q.clearAuth(); root.classList.remove('authed'); const a = $('.avw'); if (a) a.remove(); const b = $('#bell'); if (b) b.closest('.pop-wrap').remove(); }
    }
  }

  /* ═══════ notifications (toasts) ═══════ */
  const host = document.createElement('div');
  host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('aria-live', 'polite'); host.setAttribute('aria-relevant', 'additions');
  document.body.appendChild(host);
  const ICON = { success: '✓', error: '✕', warning: '!', info: 'i' }, DUR = { success: 3200, info: 4200, warning: 5600, error: 7500 };
  function notify(type, msg, o) {
    o = o || {};
    msg = String(msg == null ? '' : msg).replace(/^[\s\p{Extended_Pictographic}\u2705\u26A0\uFE0F]+/u, '').trim() || String(msg);
    const t = document.createElement('div'), d = o.duration || DUR[type];
    t.className = 'tst ' + type; t.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    t.innerHTML = `<span class="ti" aria-hidden="true">${ICON[type]}</span><div class="tx">${esc(msg)}</div>${o.action ? `<button type="button" class="ta">${esc(o.action.label)}</button>` : ''}<button type="button" class="tc" aria-label="Dismiss notification">✕</button><i class="tp" style="--d:${d}ms"></i>`;
    host.appendChild(t);
    while (host.children.length > 4) host.firstElementChild.remove();
    let timer; const kill = () => { clearTimeout(timer); t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    const arm = (ms) => { clearTimeout(timer); timer = setTimeout(kill, ms); };
    arm(d);
    t.addEventListener('mouseenter', () => { clearTimeout(timer); t.classList.add('hold'); });
    t.addEventListener('mouseleave', () => { t.classList.remove('hold'); arm(2200); });
    t.addEventListener('focusin', () => { clearTimeout(timer); t.classList.add('hold'); });
    $('.tc', t).onclick = kill;
    if (o.action) $('.ta', t).onclick = () => { kill(); o.action.run(); };
    return kill;
  }
  Q.notify = { success: (m, o) => notify('success', m, o), error: (m, o) => notify('error', m, o), warning: (m, o) => notify('warning', m, o), info: (m, o) => notify('info', m, o) };
  const guess = (m) => (/^(⚠|🔐)/.test(m) || /\b(limit|please log in|log in to|allow pop-ups|not supported|too (large|dense|small)|low contrast)\b/i.test(m) ? 'warning'
    : /(could not|couldn.t|can.t|cannot|failed|invalid|incorrect|not allowed|not found|denied|unable|error|expired|must be|is required|too many|wrong|doesn.t match|already exists)/i.test(m) ? 'error'
    : /(saved|created|copied|deleted|done|updated|downloaded|applied|added|moved|sent|restored|activated|deactivated|archived|uploaded|generated|reset|verified|renamed|reopened|imported|unblocked|blocked|passed|✨|✅)/i.test(m) ? 'success' : 'info');
  Q.toast = (m, type) => notify(type || guess(String(m)), m); // every existing toast() call is now typed automatically

  /* ═══════ loading · empty · error · success helpers ═══════ */
  Q.skeleton = (n, kind) => Array.from({ length: n || 3 }, () => `<div class="skel-i ${kind || 'card'}" aria-hidden="true"><i></i><i></i><i></i></div>`).join('') + '<span class="sr-only" role="status">Loading…</span>';
  Q.empty = (o) => `<div class="state empty-st" role="status"><div class="st-i" aria-hidden="true">${o.icon || '📭'}</div><h3>${esc(o.title)}</h3>${o.text ? `<p>${esc(o.text)}</p>` : ''}${o.cta ? `<a class="btn btn-primary" href="${esc(o.cta.href)}">${esc(o.cta.label)}</a>` : ''}</div>`;
  Q.errorState = (o) => `<div class="state err-st" role="alert"><div class="st-i" aria-hidden="true">⚠️</div><h3>${esc(o.title || 'Something went wrong. Please try again.')}</h3>${o.text ? `<p>${esc(o.text)}</p>` : ''}${o.retry ? '<button type="button" class="btn btn-ghost" data-retry>Try again</button>' : ''}</div>`;
  Q.busy = (btn, label) => { // Uploading… / Generating… / Saving… on any button; call the returned function to restore it
    if (!btn) return () => {};
    const html = btn.innerHTML, dis = btn.disabled;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(label || 'Working…')}`;
    return () => { btn.disabled = dis; btn.removeAttribute('aria-busy'); btn.innerHTML = html; };
  };

  /* top progress bar for slow requests + friendlier network errors */
  const bar = document.createElement('div'); bar.className = 'topbar'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  let pending = 0, showT, hideT;
  const begin = () => { if (pending++ === 0) { clearTimeout(hideT); showT = setTimeout(() => { bar.className = 'topbar on'; }, 250); } };
  const end = () => { if (--pending <= 0) { pending = 0; clearTimeout(showT); if (bar.classList.contains('on')) { bar.className = 'topbar done'; hideT = setTimeout(() => { bar.className = 'topbar'; }, 450); } } };
  const api0 = Q.api;
  Q.api = async function () {
    begin();
    try { return await api0.apply(this, arguments); }
    catch (e) { if (e instanceof TypeError) e.message = navigator.onLine ? 'Could not reach the server. Please try again.' : 'You are offline. Check your connection.'; throw e; }
    finally { end(); }
  };
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-retry]'); if (b) location.reload(); });

  /* offline banner */
  const off = document.createElement('div'); off.className = 'offline'; off.setAttribute('role', 'status'); off.hidden = true;
  off.textContent = 'You are offline. Some features will not work until your connection is back.'; document.body.appendChild(off);
  addEventListener('offline', () => { off.hidden = false; });
  addEventListener('online', () => { off.hidden = true; Q.notify.success('Back online.'); });
  if (!navigator.onLine) off.hidden = false;

  /* ═══════ notification bell (server notifications from /api/notifications) ═══════ */
  const NI = { welcome: '👋', expiring: '⏳', expired: '⌛', disabled: '🚫', milestone: '🎉' };
  function bell() {
    if (!Q.token()) return;
    const hr = $('.hdr-r'); if (!hr) return;
    const w = document.createElement('div'); w.className = 'pop-wrap';
    w.innerHTML = '<button class="icon-btn" id="bell" type="button" aria-label="Notifications" aria-haspopup="true" aria-expanded="false"><span aria-hidden="true">🔔</span><span class="bdot" hidden></span></button><div class="pop np" hidden><div class="np-h"><b>Notifications</b><button type="button" class="lnk" data-readall>Mark all read</button></div><ul class="np-l"></ul></div>';
    hr.insertBefore(w, $('#burger', hr));
    const btn = $('#bell', w), menu = $('.pop', w), list = $('.np-l', w), dot = $('.bdot', w);
    const load = async () => {
      try {
        const r = await Q.api('/api/notifications');
        dot.hidden = !r.unread; dot.textContent = r.unread > 9 ? '9+' : r.unread; btn.setAttribute('aria-label', r.unread ? `Notifications, ${r.unread} unread` : 'Notifications');
        list.innerHTML = r.items.length ? r.items.map((n) => `<li class="${n.read ? '' : 'unread'}"><a href="${esc(n.link || '#')}" data-id="${esc(n.id)}"><span aria-hidden="true">${NI[n.type] || '🔔'}</span><div><b>${esc(n.title)}</b><small>${esc(n.text)}</small><time>${ago(n.t)}</time></div></a></li>`).join('') : '<li class="np-e">You are all caught up.</li>';
      } catch (e) { /* the header must never break the page */ }
    };
    pop(btn, menu, { onOpen: load });
    list.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-id]'); if (!a) return;
      Q.api('/api/notifications/read', { method: 'POST', body: { id: a.dataset.id } }).catch(() => {});
      if (a.getAttribute('href') === '#') { e.preventDefault(); a.closest('li').classList.remove('unread'); }
    });
    $('[data-readall]', w).onclick = async () => { try { await Q.api('/api/notifications/read', { method: 'POST', body: { all: true } }); load(); } catch (e) { /* ignore */ } };
    load(); setInterval(() => { if (!document.hidden) load(); }, 60000);
  }

  /* ═══════ mobile bottom navigation (the header handles desktop) ═══════ */
  function shell() {
    if (!Q.token()) return;
    const p = location.pathname;
    if (!/^\/(dashboard|my-qr-codes|my-files|analytics|account|qr-generator|ai-qr|design-studio|file-to-qr|admin)(\/|$)/.test(p)) return;
    const APP = [['/dashboard', '🏠', 'Home'], ['/qr-generator', '➕', 'Create'], ['/my-qr-codes', '▦', 'QR codes'], ['/analytics', '📊', 'Analytics'], ['/account', '👤', 'Account']];
    const link = ([h, i, l]) => `<a href="${h}" class="${p === h ? 'on' : ''}"${p === h ? ' aria-current="page"' : ''}><span aria-hidden="true">${i}</span><small>${l}</small></a>`;
    const bn = document.createElement('nav');
    bn.className = 'bnav'; bn.setAttribute('aria-label', 'App navigation'); bn.innerHTML = APP.map(link).join('');
    document.body.append(bn); document.body.classList.add('has-shell');
  }

  /* ═══════ accessibility ═══════ */
  const main = $('main');
  if (main) { main.id = main.id || 'main'; main.tabIndex = -1; }
  const skip = document.createElement('a'); skip.className = 'skip'; skip.href = '#main'; skip.textContent = 'Skip to main content';
  skip.addEventListener('click', () => { if (main) setTimeout(() => main.focus(), 0); });
  document.body.prepend(skip);
  const nav = $('#nav'); if (nav) nav.setAttribute('aria-label', 'Main');
  const burger = $('#burger');
  if (burger) { burger.setAttribute('aria-controls', 'nav'); burger.setAttribute('aria-expanded', 'false'); burger.addEventListener('click', () => setTimeout(() => burger.setAttribute('aria-expanded', String(burger.classList.contains('open'))), 0)); }

  const LBL = [['🗑', 'Delete'], ['✕', 'Close'], ['✏', 'Edit'], ['⬇', 'Download'], ['🔗', 'Share'], ['📊', 'Analytics'], ['👤', 'Account'], ['🛡', 'Admin'], ['★', 'Favorite'], ['⋯', 'More actions'], ['📋', 'Copy'], ['🔔', 'Notifications'], ['📤', 'Share'], ['🖨', 'Print'], ['＋', 'Add'], ['⧉', 'Duplicate'], ['👁', 'Show or hide'], ['🌓', 'Theme']];
  let dlgId = 0;
  function enhance(r) {
    r = r || document;
    $$('button:not([aria-label]),a.btn:not([aria-label]),a.icon-btn:not([aria-label])', r).forEach((b) => { // icon-only controls get a name
      const t = (b.textContent || '').replace(/[\uFE0F\s]/g, '');
      if (!t || [...t].length > 3 || /[a-z0-9]{2}/i.test(t)) return;
      const hit = LBL.find(([k]) => t.startsWith(k)); if (hit) b.setAttribute('aria-label', hit[1]);
    });
    $$('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([aria-label]):not([aria-labelledby]),select:not([aria-label]):not([aria-labelledby]),textarea:not([aria-label]):not([aria-labelledby])', r).forEach((el) => {
      if ((el.labels && el.labels.length) || el.closest('label')) return;
      const n = el.getAttribute('placeholder') || el.getAttribute('title') || el.name || el.dataset.k || el.dataset.p || el.id;
      if (n) el.setAttribute('aria-label', String(n).replace(/[._-]/g, ' '));
    });
    $$('.qr-stage svg:not([role]),.ds-stage svg:not([role]),.fqr svg:not([role]),.thumb svg:not([role]),.qc-th svg:not([role]),.shx-qr svg:not([role])', r).forEach((s) => { s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'QR code preview'); });
    $$('img:not([alt])', r).forEach((i) => i.setAttribute('alt', ''));
    $$('img:not([loading])', r).forEach((i) => { i.setAttribute('loading', 'lazy'); i.setAttribute('decoding', 'async'); });
    $$('a[target=_blank]:not([rel])', r).forEach((a) => a.setAttribute('rel', 'noopener noreferrer'));
    $$('.err:not([role])', r).forEach((e) => e.setAttribute('role', 'alert'));
    $$('th:not([scope])', r).forEach((h) => h.setAttribute('scope', 'col'));
    $$('dialog:not([aria-labelledby])', r).forEach((d) => { const h = $('h3,h2', d); if (h) { h.id = h.id || 'dlg' + ++dlgId; d.setAttribute('aria-labelledby', h.id); } });
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; enhance(); }, 150); }).observe(document.body, { childList: true, subtree: true });

  // dialogs hand focus back to the control that opened them
  const show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    const opener = document.activeElement;
    this.addEventListener('close', () => { if (opener && opener.isConnected && opener.focus) opener.focus(); }, { once: true });
    return show.apply(this, arguments);
  };
  document.addEventListener('keydown', (e) => { // Esc closes the "⋯" card menus
    if (e.key !== 'Escape') return;
    const d = $('details.mm[open]'); if (d) { d.removeAttribute('open'); const s = $('summary', d); if (s) s.focus(); }
  });

  /* ═══════ error tracking: browser errors go to /api/client-error (shown to admins) ═══════ */
  let sent = 0, shown = false;
  const report = (message, stack) => {
    if (sent++ >= 5) return;
    try {
      const b = JSON.stringify({ message: String(message).slice(0, 300), stack: String(stack || '').slice(0, 600), url: location.href });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/client-error', new Blob([b], { type: 'application/json' }));
      else fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b, keepalive: true });
    } catch (e) { /* ignore */ }
  };
  addEventListener('error', (e) => { if (e.filename && e.filename.indexOf(location.origin) !== 0) return; report(e.message, e.error && e.error.stack); });
  addEventListener('unhandledrejection', (e) => {
    const m = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    report(m, e.reason && e.reason.stack);
    if (!shown) { shown = true; notify('error', 'Something went wrong. Please try again.'); }
  });

  themeMenu(); bell(); avatar(); dropdowns(); shell(); enhance(); refreshMe();
  Q.ui = { notify: Q.notify, busy: Q.busy, skeleton: Q.skeleton, empty: Q.empty, errorState: Q.errorState, enhance, setTheme: setPref };
})();
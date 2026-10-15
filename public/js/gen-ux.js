(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const root = $('#gen') || $('#ftq');
  if (!root || !window.QRX) return;

  const mob = matchMedia('(max-width: 980px)');
  const stage = $('#stage'), create = $('#create'), info = $('#info'), card = $('.gen-r .card');
  if (!stage || !create || !card) return;
  const dlPng = $('#dlPng');

  /* ───────── live mini-preview dock (phones and tablets) ───────── */
  const dock = document.createElement('div');
  dock.className = 'gdock'; dock.hidden = true;
  dock.setAttribute('role', 'region'); dock.setAttribute('aria-label', 'QR quick actions');
  dock.innerHTML = '<div class="gd-qr" aria-hidden="true"></div><div class="gd-t"><b>Live preview</b><small id="gdTxt" aria-live="polite"></small></div><button type="button" class="btn btn-ghost sm" id="gdDl" aria-label="Download PNG">⬇️</button><button type="button" class="btn btn-primary sm" id="gdGo"></button>';
  document.body.appendChild(dock);
  const thumb = $('.gd-qr', dock), txt = $('#gdTxt', dock), go = $('#gdGo', dock), dl = $('#gdDl', dock);

  let raf = 0;
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const svg = $('svg', stage), emp = $('.empty', stage), done = /Generated|QR created/.test(info ? info.textContent : '');
      thumb.innerHTML = svg ? svg.outerHTML.replace(/\swidth="[^"]*"\sheight="[^"]*"/, ' width="100%" height="100%"') : '<span>▦</span>';
      txt.textContent = svg ? (done ? '✅ Generated: download or share it' : 'Updates live as you type') : (emp ? emp.textContent.replace(/^▦\s*/, '').trim().slice(0, 80) : 'Fill in the details to see your QR');
      go.textContent = create.textContent.trim() || 'Generate';
      go.disabled = create.disabled;
      dl.disabled = !dlPng || dlPng.disabled;
      if (hint) hint.textContent = !svg && emp ? 'ℹ️ ' + emp.textContent.replace(/^▦\s*/, '').trim() : '';
    });
  };

  let visible = true;
  const place = () => {
    const showDock = mob.matches && !visible;
    dock.hidden = !showDock;
    document.body.classList.toggle('has-dock', showDock);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; place(); }, { threshold: 0.12 }).observe(card);
  (mob.addEventListener ? mob.addEventListener.bind(mob, 'change') : mob.addListener.bind(mob))(place);

  go.onclick = () => {
    if (create.disabled) return;
    create.click();
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
  };
  dl.onclick = () => { if (dlPng && !dlPng.disabled) dlPng.click(); };

  /* ───────── inline hint + Enter key (generator page) ───────── */
  const form = $('#form');
  let hint = null;
  if (form) {
    hint = document.createElement('p');
    hint.className = 'fhint'; hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite');
    form.after(hint);
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      if (!e.target.matches('input:not([type=file]):not([type=checkbox]):not([type=color]),select')) return;
      if (create.disabled) return;
      e.preventDefault(); create.click();
    });
  }

  /* ───────── compact "Change type" bar on small screens ───────── */
  const sec1 = $('#sec1'), types = $('#types');
  if (sec1 && types) {
    const sum = document.createElement('div');
    sum.className = 'tsum';
    sum.innerHTML = '<span class="tsum-i" aria-hidden="true">▦</span><div><b></b><small></small></div><button type="button" class="btn btn-ghost sm" aria-expanded="false">Change type ▾</button>';
    $('.card-h', sec1).after(sum);
    const updSum = () => {
      const on = $('.chip.on', types); if (!on) return;
      const m = on.textContent.trim().match(/^(\S+)\s+(.*)$/);
      $('.tsum-i', sum).textContent = m ? m[1] : '▦';
      $('b', sum).textContent = m ? m[2] : on.textContent.trim();
      const os = $('#modeBar .onscan');
      $('small', sum).textContent = os ? os.textContent.replace(/^\S+\s*/, '') : '';
    };
    new MutationObserver(updSum).observe(types, { attributes: true, subtree: true, attributeFilter: ['class'] });
    const mb = $('#modeBar'); if (mb) new MutationObserver(updSum).observe(mb, { childList: true, subtree: true });
    updSum();
    if (mob.matches) sec1.classList.add('tcollapsed');
    $('button', sum).onclick = () => { sec1.classList.remove('tcollapsed'); sec1.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    types.addEventListener('click', (e) => {
      if (!e.target.closest('.chip') || !mob.matches) return;
      setTimeout(() => {
        sec1.classList.add('tcollapsed');
        const s2 = $('#sec2'); if (s2) s2.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const f = $('#form input:not([type=checkbox]):not([type=hidden]):not([type=color]), #form textarea');
        if (f) setTimeout(() => f.focus({ preventScroll: true }), 550);
      }, 60);
    });
  }

  /* ───────── keep the dock in step with the real controls ───────── */
  new MutationObserver(sync).observe(stage, { childList: true, subtree: true, attributes: true });
  new MutationObserver(sync).observe(create, { attributes: true, childList: true, characterData: true, subtree: true });
  if (info) new MutationObserver(sync).observe(info, { childList: true, subtree: true });
  if (dlPng) new MutationObserver(sync).observe(dlPng, { attributes: true });
  sync(); place();
})();
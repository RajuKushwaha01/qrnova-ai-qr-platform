(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lum = (h) => {
    const n = parseInt(h.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };

  const QRX = (window.QRX = {
    $, $$, esc, lum,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    token: () => localStorage.getItem('qrn_token'),
    user: () => { try { return JSON.parse(localStorage.getItem('qrn_user') || 'null'); } catch { return null; } },
    setAuth(t, u) { localStorage.setItem('qrn_token', t); localStorage.setItem('qrn_user', JSON.stringify(u)); },
    clearAuth() { localStorage.removeItem('qrn_token'); localStorage.removeItem('qrn_user'); },

    async api(url, o = {}) {
      const h = { ...(o.headers || {}) };
      const t = QRX.token();
      if (t) h.Authorization = 'Bearer ' + t;
      let body = o.body;
      if (body && !(body instanceof FormData) && typeof body === 'object') { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
      const r = await fetch(url, { ...o, headers: h, body });
      let j = {};
      try { j = await r.json(); } catch {}
      if (!r.ok) {
        if (r.status === 401 && t && !url.includes('/auth/')) QRX.clearAuth();
        throw new Error(j.error || 'Something went wrong. Please try again.');
      }
      return j;
    },
    toast(m) {
      const t = $('#toast'); if (!t) return;
      t.textContent = m; t.classList.add('show');
      clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3200);
    },
    matrix: (text, ecl = 'M') => QRX.api('/api/qr/matrix', { method: 'POST', body: { text, ecl } }),
    contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); },

    /* ---------- styled QR renderer (SVG) ---------- */
    svg(rows, o = {}) {
      o = { fg: '#111827', bg: '#ffffff', dots: 'square', eyes: 'square', margin: 4, ...o };
      const n = rows.length, q = o.margin, T = n + q * 2, gid = 'g' + Math.random().toString(36).slice(2, 8);
      const fill = o.fg2 ? `url(#${gid})` : o.fg, eye = o.eye || o.fg;
      let i = 0;
      const an = () => (o.anim ? ` class="d" style="animation-delay:${(i++) * 2}ms"` : '');
      const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      let s = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (rows[r][c] !== '1' || inEye(r, c)) continue;
        const x = c + q, y = r + q;
        if (o.dots === 'dots') s += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r=".46"${an()}/>`;
        else if (o.dots === 'rounded') s += `<rect x="${x + 0.04}" y="${y + 0.04}" width=".92" height=".92" rx=".3"${an()}/>`;
        else if (o.dots === 'diamond') s += `<path d="M${x + 0.5} ${y}l.5 .5l-.5 .5l-.5 -.5z"${an()}/>`;
        else s += `<rect x="${x}" y="${y}" width="1.02" height="1.02"${an()}/>`;
      }
      const rx = o.eyes === 'circle' ? 3 : o.eyes === 'rounded' ? 1.8 : 0, ri = o.eyes === 'circle' ? 1.5 : o.eyes === 'rounded' ? 0.9 : 0;
      let e = '';
      for (const [ex, ey] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
        const x = ex + q, y = ey + q;
        e += `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="${rx}" fill="none" stroke="${eye}" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${ri}" fill="${eye}"/>`;
      }
      let lg = '';
      if (o.logo) {
        const L = Math.round(n * 0.2), x = (T - L) / 2;
        lg = `<rect x="${x - 0.6}" y="${x - 0.6}" width="${L + 1.2}" height="${L + 1.2}" rx="1.6" fill="${o.bg === 'transparent' ? '#fff' : o.bg}"/><image href="${o.logo}" x="${x}" y="${x}" width="${L}" height="${L}" preserveAspectRatio="xMidYMid slice"/>`;
      }
      const defs = o.fg2 ? `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${T}" y2="${T}"><stop offset="0" stop-color="${o.fg}"/><stop offset="1" stop-color="${o.fg2}"/></linearGradient></defs>` : '';
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="${o.size || 1024}" height="${o.size || 1024}" shape-rendering="${o.dots === 'square' ? 'crispEdges' : 'geometricPrecision'}">${defs}${o.bg === 'transparent' ? '' : `<rect width="${T}" height="${T}" fill="${o.bg}"/>`}<g fill="${fill}">${s}</g>${e}${lg}</svg>`;
    },
    svgUrl: (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    async raster(svg, px, mime = 'image/png') {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = QRX.svgUrl(svg); });
      const c = document.createElement('canvas'); c.width = c.height = px;
      const x = c.getContext('2d');
      if (mime !== 'image/png') { x.fillStyle = '#fff'; x.fillRect(0, 0, px, px); }
      x.drawImage(img, 0, 0, px, px);
      return new Promise((r) => c.toBlob(r, mime, 0.95));
    },
    save(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    },
  });

  /* ---------- global UI behaviours ---------- */
  const root = document.documentElement;
  const sync = () => root.classList.toggle('authed', !!QRX.token());
  sync();

  $$('[data-logout]').forEach((b) => b.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await QRX.api('/api/auth/logout', { method: 'POST' }); } catch {}
    QRX.clearAuth(); location.href = '/';
  }));

  const hdr = $('#hdr');
  const onScroll = () => hdr && hdr.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const burger = $('#burger'), nav = $('#nav');
  if (burger) {
    burger.addEventListener('click', () => { burger.classList.toggle('open'); nav.classList.toggle('open'); });
    $$('#nav a').forEach((a) => a.addEventListener('click', () => { burger.classList.remove('open'); nav.classList.remove('open'); }));
  }
  $('#theme')?.addEventListener('click', () => {
    const t = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = t; localStorage.setItem('qrn_theme', t);
  });
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  const ck = $('#cookie');
  if (ck && !localStorage.getItem('qrn_cookie')) setTimeout(() => ck.classList.add('show'), 1200);
  $('#cookieOk')?.addEventListener('click', () => { localStorage.setItem('qrn_cookie', '1'); ck.classList.remove('show'); });

  /* reveal on scroll + stagger */
  $$('.stagger').forEach((g) => [...g.children].forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--i', i); }));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.1 });
  $$('.reveal').forEach((el) => io.observe(el));

  /* animated counters */
  const co = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    co.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach((el) => co.observe(el));

  /* particle network background */
  const cv = $('#bg');
  if (cv && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const x = cv.getContext('2d'); let W, H, P = [];
    const rs = () => {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      P = Array.from({ length: Math.min(70, Math.floor((W * H) / 22000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35 }));
    };
    rs(); addEventListener('resize', rs);
    (function f() {
      x.clearRect(0, 0, W, H);
      x.fillStyle = root.dataset.theme === 'light' ? 'rgba(90,80,200,.45)' : 'rgba(160,170,255,.55)';
      for (const p of P) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; x.fillRect(p.x, p.y, 2, 2); }
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = dx * dx + dy * dy;
        if (d < 14000) { x.strokeStyle = `rgba(124,92,255,${0.2 * (1 - d / 14000)})`; x.beginPath(); x.moveTo(P[i].x, P[i].y); x.lineTo(P[j].x, P[j].y); x.stroke(); }
      }
      requestAnimationFrame(f);
    })();
  }
})();
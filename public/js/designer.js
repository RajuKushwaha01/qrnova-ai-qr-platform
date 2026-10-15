(() => {
  'use strict';
  const { $, $$, esc, toast, api } = QRX;
  const root = $('#ds');
  if (!root) return;

  /* ═══════════ basics ═══════════ */
  const H6 = /^#[0-9a-f]{6}$/i;
  const IMGRE = /^data:image\/(?:png|jpe?g|svg\+xml|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
  const f3 = (v) => +(+v).toFixed(3);
  const normHex = (s) => { s = String(s || '').trim().replace(/^#?/, '#').toLowerCase(); if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]; return H6.test(s) ? s : null; };
  const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => (clamp(v, 0, 255, 0) | 0).toString(16).padStart(2, '0')).join('');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ICON = { pass: '✓', warn: '!', fail: '✕', info: 'i' };

  /* ═══════════ catalogues ═══════════ */
  const FONTS = { sans: 'Arial, Helvetica, sans-serif', serif: "Georgia, 'Times New Roman', serif", mono: "'Courier New', monospace", round: "'Trebuchet MS', Verdana, sans-serif" };
  const STYLES = [['classic', 'Classic'], ['rounded', 'Rounded'], ['dots', 'Dots'], ['soft', 'Soft'], ['modern', 'Modern'], ['minimal', 'Minimal'], ['custom', 'Custom']];
  const STY = { classic: { dots: 'square', eyeOuter: 'square', eyeInner: 'square' }, rounded: { dots: 'rounded', eyeOuter: 'rounded', eyeInner: 'rounded' }, dots: { dots: 'dots', eyeOuter: 'circle', eyeInner: 'circle' }, soft: { dots: 'soft', eyeOuter: 'rounded', eyeInner: 'circle' }, modern: { dots: 'bars', eyeOuter: 'leaf', eyeInner: 'leaf' }, minimal: { dots: 'minimal', eyeOuter: 'square', eyeInner: 'square' } };
  const DOTS = [['square', '▪', 'Square'], ['rounded', '▢', 'Rounded'], ['dots', '●', 'Dots'], ['diamond', '◆', 'Diamond'], ['soft', '◖', 'Soft'], ['bars', '▮', 'Bars'], ['minimal', '▫', 'Minimal']];
  const EYEO = [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle'], ['leaf', 'Leaf']];
  const EYEI = EYEO.concat([['diamond', 'Diamond']]);
  const TPL = {
    a4: ['A4 page', 210, 297, '📄', { t1: 'Scan to learn more', t2: 'Point your phone camera at the code', t3: 'www.example.com' }],
    poster: ['Poster (A3)', 297, 420, '🖼️', { t1: 'SCAN ME', t2: 'Open your camera and point it at the code', t3: 'yourbrand.com' }],
    flyer: ['Flyer (A5)', 148, 210, '📣', { t1: 'Grand Opening', t2: 'Scan for the full offer & location', t3: 'www.example.com' }],
    card: ['Business card', 85, 55, '🪪', { t1: 'Asha Rao', t2: 'Founder · Brand Studio', t3: '+91 98765 43210' }],
    sticker: ['Sticker', 60, 60, '🏷️', { t1: 'SCAN ME', t2: '', t3: '' }],
    tent: ['Table tent', 210, 148, '🍽️', { t1: 'Scan for the menu', t2: 'Order & pay from your table', t3: 'Table 7' }],
    menu: ['Menu (A5)', 148, 210, '📜', { t1: 'Our Menu', t2: 'Scan to view today’s dishes', t3: 'Spice Garden' }],
    label: ['Product label', 80, 50, '📦', { t1: 'Aero Bottle 750 ml', t2: 'Scan for care guide and warranty', t3: 'SKU AB-750' }],
  };
  const G = (type, angle, ...cols) => ({ type, angle, stops: cols.map((c, i) => ({ o: cols.length < 2 ? 0 : f3(i / (cols.length - 1)), c })) });
  const PRE = [
    ['Midnight', G('solid', 0, '#111827'), '#111827'], ['Aurora', G('linear', 45, '#6d28d9', '#0e7490'), '#be185d'], ['Sunset', G('linear', 45, '#b91c1c', '#c2410c'), '#9f1239'],
    ['Ocean', G('linear', 135, '#0369a1', '#1d4ed8'), '#0c4a6e'], ['Forest', G('linear', 45, '#15803d', '#065f46'), '#14532d'], ['Berry', G('linear', 45, '#be185d', '#7e22ce'), '#701a75'],
    ['Gold & Navy', G('linear', 90, '#1b2a49', '#8a6d1d'), '#1b2a49'], ['Candy', G('linear', 45, '#be185d', '#6d28d9', '#0e7490'), '#6d28d9'], ['Radial', G('radial', 0, '#0e7490', '#1d4ed8', '#111827'), '#111827'], ['Mono', G('solid', 0, '#374151'), '#111827'],
  ];
  const STARTERS = [['🔗 URL', 'https://example.com'], ['📶 Wi-Fi', 'WIFI:T:WPA;S:MyNetwork;P:password123;;'], ['📞 Phone', 'tel:+919876543210'], ['👤 vCard', 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Rao;Asha;;;\r\nFN:Asha Rao\r\nTEL;TYPE=CELL:+919876543210\r\nEMAIL:asha@example.com\r\nEND:VCARD'], ['📝 Text', 'Welcome to Grand Vista Hotel!']];
  const CAPS = ['SCAN ME', 'VIEW MENU', 'PAY HERE', 'CONTACT US', 'DOWNLOAD PDF'];
  const ECLI = [['L', 7, 'Smallest code, easiest to scan on clean screens. A scratch or fold can break it.'], ['M', 15, 'Good default for screens and indoor print.'], ['Q', 25, 'Better for print that may get scuffed or folded. Fits modest logos.'], ['H', 30, 'Needed for logos and rough surfaces. The densest code, so print it larger.']];
  const ENUMS = { ecl: ['L', 'M', 'Q', 'H'], style: STYLES.map((s) => s[0]), dots: DOTS.map((d) => d[0]), eyeOuter: EYEO.map((e) => e[0]), eyeInner: EYEI.map((e) => e[0]), frame: ['none', 'border', 'bottom', 'top', 'badge', 'brackets'], capFont: Object.keys(FONTS), tpl: Object.keys(TPL) };

  /* ═══════════ design state ═══════════ */
  const DEF = () => ({
    data: 'https://example.com', ecl: 'Q', margin: 4,
    style: 'rounded', dots: 'rounded', eyeOuter: 'rounded', eyeInner: 'rounded', eyeLink: false, eyeOuterC: '#be185d', eyeInnerC: '#be185d',
    fg: G('linear', 45, '#6d28d9', '#0e7490'),
    bg: { mode: 'color', color: '#ffffff', grad: G('linear', 135, '#ffffff', '#e0f2fe'), img: null, overlay: 0.45, plate: true, plateOp: 0.92 },
    logo: { img: null, size: 20, pos: 'center', dx: 0, dy: 0, pad: 0.75, shape: 'rounded', bgMode: 'color', bgC: '#ffffff', border: 0, borderC: '#111827', clear: true },
    frame: 'none', caption: '', capUpper: true, capFont: 'sans', frameC: '#6d28d9', capC: 'auto',
    px: 1024, pdfMm: 100, tpl: 'a4', tt: Object.assign({}, TPL.a4[4]),
  });
  function normalize(s, keepData) {
    const d = DEF(); if (!s || typeof s !== 'object') return d;
    const en = (v, k) => (ENUMS[k].includes(v) ? v : d[k]);
    const hx = (v, def) => (typeof v === 'string' && H6.test(v) ? v.toLowerCase() : def);
    const im = (v) => (typeof v === 'string' && v.length < 3e6 && IMGRE.test(v) ? v : null);
    const gr = (g, def) => {
      if (!g || typeof g !== 'object') return def;
      const type = ['solid', 'linear', 'radial'].includes(g.type) ? g.type : def.type;
      let st = Array.isArray(g.stops) ? g.stops.slice(0, 6).map((x) => ({ o: clamp(x && x.o, 0, 1, 0), c: hx(x && x.c, '#000000') })) : [];
      if (!st.length || (type !== 'solid' && st.length < 2)) st = def.stops;
      return { type, angle: clamp(g.angle, 0, 360, def.angle), stops: st };
    };
    if (keepData && typeof s.data === 'string') d.data = s.data.slice(0, 2500);
    d.ecl = en(s.ecl, 'ecl'); d.margin = Math.round(clamp(s.margin, 1, 8, d.margin));
    d.style = en(s.style, 'style'); d.dots = en(s.dots, 'dots'); d.eyeOuter = en(s.eyeOuter, 'eyeOuter'); d.eyeInner = en(s.eyeInner, 'eyeInner');
    d.eyeLink = !!s.eyeLink; d.eyeOuterC = hx(s.eyeOuterC, d.eyeOuterC); d.eyeInnerC = hx(s.eyeInnerC, d.eyeInnerC);
    d.fg = gr(s.fg, d.fg);
    const b = s.bg || {};
    d.bg = { mode: ['transparent', 'white', 'color', 'gradient', 'image'].includes(b.mode) ? b.mode : d.bg.mode, color: hx(b.color, d.bg.color), grad: gr(b.grad, d.bg.grad), img: im(b.img), overlay: clamp(b.overlay, 0, 0.9, 0.45), plate: b.plate !== false, plateOp: clamp(b.plateOp, 0.5, 1, 0.92) };
    if (d.bg.mode === 'image' && !d.bg.img) d.bg.mode = 'color';
    const l = s.logo || {};
    d.logo = { img: im(l.img), size: clamp(l.size, 8, 30, 20), pos: ['center', 'br', 'custom'].includes(l.pos) ? l.pos : 'center', dx: clamp(l.dx, -35, 35, 0), dy: clamp(l.dy, -35, 35, 0), pad: clamp(l.pad, 0, 3, 0.75), shape: ['square', 'rounded', 'circle'].includes(l.shape) ? l.shape : 'rounded', bgMode: l.bgMode === 'none' ? 'none' : 'color', bgC: hx(l.bgC, '#ffffff'), border: clamp(l.border, 0, 8, 0), borderC: hx(l.borderC, '#111827'), clear: l.clear !== false };
    d.frame = en(s.frame, 'frame'); d.caption = typeof s.caption === 'string' ? s.caption.slice(0, 28) : ''; d.capUpper = s.capUpper !== false; d.capFont = en(s.capFont, 'capFont');
    d.frameC = hx(s.frameC, d.frameC); d.capC = s.capC === 'auto' ? 'auto' : hx(s.capC, 'auto');
    d.px = Math.round(clamp(s.px, 128, 4096, 1024)); d.pdfMm = clamp(s.pdfMm, 20, 400, 100);
    d.tpl = en(s.tpl, 'tpl'); d.tt = Object.assign({}, TPL[d.tpl][4]);
    const t = s.tt || {}; ['t1', 't2', 't3'].forEach((k) => { if (typeof t[k] === 'string') d.tt[k] = t[k].slice(0, 60); });
    return d;
  }
  let D = DEF();
  const qd = new URLSearchParams(location.search).get('data');
  if (qd) D.data = qd.slice(0, 2500);
  const get = (p) => (p === 'bgFancy' ? D.bg.mode === 'gradient' || D.bg.mode === 'image' : p.split('.').reduce((o, k) => (o == null ? o : o[k]), D));
  const set = (p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], D)[last] = v; };
  const serial = () => { const o = clone(D); delete o.data; return o; };

  let rows = null, stats = null, err = '', UID = 0;

  /* ═══════════ SVG engine ═══════════ */
  const rr = (x, y, w, h, r) => {
    const [a, b, c, d] = r.map((v) => Math.min(f3(v), w / 2, h / 2)), X = f3(x), Y = f3(y), W = f3(w), Hh = f3(h);
    return `M${f3(X + a)} ${Y}H${f3(X + W - b)}${b ? `A${b} ${b} 0 0 1 ${f3(X + W)} ${f3(Y + b)}` : ''}V${f3(Y + Hh - c)}${c ? `A${c} ${c} 0 0 1 ${f3(X + W - c)} ${f3(Y + Hh)}` : ''}H${f3(X + d)}${d ? `A${d} ${d} 0 0 1 ${X} ${f3(Y + Hh - d)}` : ''}V${f3(Y + a)}${a ? `A${a} ${a} 0 0 1 ${f3(X + a)} ${Y}` : ''}Z`;
  };
  const circ = (cx, cy, r) => `M${f3(cx - r)} ${f3(cy)}a${r} ${r} 0 1 0 ${f3(2 * r)} 0a${r} ${r} 0 1 0 ${f3(-2 * r)} 0z`;
  const shp = (k, x, y, s) => {
    if (k === 'diamond') return `M${f3(x + s / 2)} ${f3(y)}L${f3(x + s)} ${f3(y + s / 2)}L${f3(x + s / 2)} ${f3(y + s)}L${f3(x)} ${f3(y + s / 2)}Z`;
    const r = k === 'rounded' ? s * 0.28 : k === 'circle' || k === 'leaf' ? s / 2 : 0;
    return rr(x, y, s, s, k === 'leaf' ? [r, 0, r, 0] : [r, r, r, r]);
  };
  function gdef(id, g, T) {
    const st = [...g.stops].sort((a, b) => a.o - b.o).map((s) => `<stop offset="${s.o}" stop-color="${s.c}"/>`).join('');
    if (g.type === 'radial') return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${T / 2}" cy="${T / 2}" r="${f3(T * 0.72)}">${st}</radialGradient>`;
    const a = (g.angle * Math.PI) / 180, dx = (Math.cos(a) * T) / 2, dy = (Math.sin(a) * T) / 2, c = T / 2;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f3(c - dx)}" y1="${f3(c - dy)}" x2="${f3(c + dx)}" y2="${f3(c + dy)}">${st}</linearGradient>`;
  }
  function logoBox(D, n, q) {
    const L = D.logo, Ls = (n * L.size) / 100, T = n + 2 * q, pw = Ls + 2 * L.pad;
    let cx = T / 2, cy = T / 2;
    if (L.pos === 'br') { cx = q + n - pw / 2 - 0.5; cy = cx; }
    else if (L.pos === 'custom') { cx += (n * L.dx) / 100; cy += (n * L.dy) / 100; }
    return { cx, cy, Ls, pw, x: cx - pw / 2, y: cy - pw / 2 };
  }
  function qr(rows, D, uid) {
    const n = rows.length, q = D.margin, T = n + 2 * q, L = D.logo, B = D.bg, defs = [];
    let fill;
    if (D.fg.type === 'solid') fill = D.fg.stops[0].c; else { defs.push(gdef(uid + 'f', D.fg, T)); fill = `url(#${uid}f)`; }
    let bg = '';
    if (B.mode === 'white') bg = `<rect width="${T}" height="${T}" fill="#ffffff"/>`;
    else if (B.mode === 'color') bg = `<rect width="${T}" height="${T}" fill="${B.color}"/>`;
    else if (B.mode === 'gradient') { defs.push(gdef(uid + 'b', B.grad, T)); bg = `<rect width="${T}" height="${T}" fill="url(#${uid}b)"/>`; }
    else if (B.mode === 'image' && B.img) bg = `<image href="${B.img}" width="${T}" height="${T}" preserveAspectRatio="xMidYMid slice"/>` + (B.overlay > 0 ? `<rect width="${T}" height="${T}" fill="#ffffff" fill-opacity="${B.overlay}"/>` : '');
    if ((B.mode === 'gradient' || B.mode === 'image') && B.plate) bg += `<rect x="${q - 1}" y="${q - 1}" width="${n + 2}" height="${n + 2}" rx="1.4" fill="#ffffff" fill-opacity="${B.plateOp}"/>`;

    const lb = L.img ? logoBox(D, n, q) : null;
    const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const hidden = (r, c) => {
      if (!lb || !L.clear) return false;
      const mx = c + q + 0.5, my = r + q + 0.5;
      if (L.shape === 'circle') { const dx = mx - lb.cx, dy = my - lb.cy; return dx * dx + dy * dy <= (lb.pw / 2) ** 2; }
      return mx >= lb.x && mx <= lb.x + lb.pw && my >= lb.y && my <= lb.y + lb.pw;
    };
    const on = (r, c) => r >= 0 && c >= 0 && r < n && c < n && rows[r][c] === '1' && !inEye(r, c) && !hidden(r, c);
    let p = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!on(r, c)) continue;
      const x = c + q, y = r + q;
      switch (D.dots) {
        case 'dots': p += circ(x + 0.5, y + 0.5, 0.47); break;
        case 'rounded': p += rr(x + 0.04, y + 0.04, 0.92, 0.92, [0.3, 0.3, 0.3, 0.3]); break;
        case 'diamond': p += `M${x + 0.5} ${y}l.5 .5l-.5 .5l-.5-.5z`; break;
        case 'soft': { const u = on(r - 1, c), d = on(r + 1, c), lf = on(r, c - 1), rt = on(r, c + 1); p += rr(x, y, 1, 1, [!u && !lf ? 0.5 : 0, !u && !rt ? 0.5 : 0, !d && !rt ? 0.5 : 0, !d && !lf ? 0.5 : 0]); break; }
        case 'bars': { const u = on(r - 1, c), d = on(r + 1, c); p += rr(x + 0.09, y, 0.82, 1, [u ? 0 : 0.41, u ? 0 : 0.41, d ? 0 : 0.41, d ? 0 : 0.41]); break; }
        case 'minimal': p += rr(x + 0.1, y + 0.1, 0.8, 0.8, [0.12, 0.12, 0.12, 0.12]); break;
        default: p += `M${x} ${y}h1v1h-1z`;
      }
    }
    let po = '', pi = '';
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([ex, ey]) => { const x = ex + q, y = ey + q; po += shp(D.eyeOuter, x, y, 7) + shp(D.eyeOuter, x + 1, y + 1, 5); pi += shp(D.eyeInner, x + 2, y + 2, 3); });
    const eyes = `<path d="${po}" fill="${D.eyeLink ? fill : D.eyeOuterC}" fill-rule="evenodd"/><path d="${pi}" fill="${D.eyeLink ? fill : D.eyeInnerC}"/>`;
    let lg = '';
    if (lb) {
      const rad = (w) => (L.shape === 'circle' ? w / 2 : L.shape === 'rounded' ? w * 0.22 : 0);
      const sh = (x, y, w) => rr(x, y, w, w, [rad(w), rad(w), rad(w), rad(w)]);
      const cid = uid + 'l', bw = L.border / 10;
      defs.push(`<clipPath id="${cid}"><path d="${sh(lb.cx - lb.Ls / 2, lb.cy - lb.Ls / 2, lb.Ls)}"/></clipPath>`);
      lg = `<path d="${sh(lb.x, lb.y, lb.pw)}" fill="${L.bgMode === 'color' ? L.bgC : 'none'}"${bw ? ` stroke="${L.borderC}" stroke-width="${bw}"` : ''}/><image href="${L.img}" x="${f3(lb.cx - lb.Ls / 2)}" y="${f3(lb.cy - lb.Ls / 2)}" width="${f3(lb.Ls)}" height="${f3(lb.Ls)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${cid})"/>`;
    }
    return { defs: defs.join(''), body: bg + `<path d="${p}" fill="${fill}"${D.dots === 'square' ? ' shape-rendering="crispEdges"' : ''}/>` + eyes + lg, T, n };
  }

  /* frame + caption layout (design units: the QR square is always 1000) */
  function lay(D) {
    const S = 1000, cap = (D.capUpper ? D.caption.toUpperCase() : D.caption).trim(), fc = D.frameC, ff = FONTS[D.capFont] || FONTS.sans;
    const onFc = QRX.lum(fc) > 0.4 ? '#111827' : '#ffffff';
    const tcBar = D.capC === 'auto' ? onFc : D.capC;
    const tcFree = D.capC === 'auto' ? (QRX.contrast(fc, '#ffffff') >= 3 ? fc : '#111827') : D.capC;
    const fs = (w) => Math.max(34, Math.min(124, Math.floor((w * 0.8) / (Math.max(cap.length, 4) * 0.7))));
    const T = (x, y, w, fill) => (cap ? `<text x="${f3(x)}" y="${f3(y)}" text-anchor="middle" dy=".35em" font-family="${ff}" font-weight="700" font-size="${fs(w)}" fill="${fill}">${esc(cap)}</text>` : '');
    let W, H, qx = 0, qy = 0, pre = '', post = '', clip = 0;
    switch (D.frame) {
      case 'bottom': case 'top': {
        const pad = 48, bar = cap ? 210 : pad, top = D.frame === 'top';
        W = S + 2 * pad; H = S + pad + bar; qx = pad; qy = top ? bar : pad; clip = 34;
        pre = `<rect width="${W}" height="${H}" rx="76" fill="${fc}"/><rect x="${qx}" y="${qy}" width="${S}" height="${S}" rx="${clip}" fill="#ffffff"/>`;
        post = T(W / 2, top ? bar / 2 : pad + S + bar / 2, W, tcBar); break;
      }
      case 'border': {
        const pad = 56, ch = cap ? 190 : 0;
        W = S + 2 * pad; H = S + 2 * pad + ch; qx = pad; qy = pad; clip = 26;
        pre = `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="66" fill="none" stroke="${fc}" stroke-width="28"/>`;
        post = T(W / 2, (S + pad + H - 28) / 2, W, tcFree); break;
      }
      case 'badge': {
        const pad = 44, ph = 140;
        W = S + 2 * pad; H = S + pad + (cap ? 150 : pad); qx = pad; qy = pad; clip = 30;
        pre = `<rect x="${pad - 14}" y="${pad - 14}" width="${S + 28}" height="${S + 28}" rx="62" fill="none" stroke="${fc}" stroke-width="28"/>`;
        if (cap) { const pw = Math.min(W - 60, Math.max(440, cap.length * fs(W) * 0.78 + 150)), py = pad + S + 50; post = `<rect x="${f3((W - pw) / 2)}" y="${py - ph / 2}" width="${f3(pw)}" height="${ph}" rx="${ph / 2}" fill="${fc}"/>` + T(W / 2, py, pw, tcBar); }
        break;
      }
      case 'brackets': {
        const pad = 70, ch = cap ? 190 : 0, Ln = 170, x0 = 30, y0 = 30;
        W = S + 2 * pad; H = S + 2 * pad + ch; qx = pad; qy = pad;
        const x1 = W - 30, y1 = S + 110, br = (x, y, dx, dy) => `M${x} ${y + dy * Ln}V${y}H${x + dx * Ln}`;
        pre = `<path d="${br(x0, y0, 1, 1)}${br(x1, y0, -1, 1)}${br(x0, y1, 1, -1)}${br(x1, y1, -1, -1)}" fill="none" stroke="${fc}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`;
        post = T(W / 2, (y1 + H) / 2 + 8, W, tcFree); break;
      }
      default: {
        const ch = cap ? 190 : 0;
        W = S; H = S + ch; post = T(W / 2, S + ch / 2, W, D.capC === 'auto' ? '#111827' : D.capC);
      }
    }
    return { S, W, H, qx, qy, pre, post, clip };
  }
  function compose(rows, D, uid) {
    const q = qr(rows, D, uid), l = lay(D);
    let g = `<svg x="${l.qx}" y="${l.qy}" width="${l.S}" height="${l.S}" viewBox="0 0 ${q.T} ${q.T}">${q.body}</svg>`, defs = q.defs;
    if (l.clip) { defs += `<clipPath id="${uid}k"><rect x="${l.qx}" y="${l.qy}" width="${l.S}" height="${l.S}" rx="${l.clip}"/></clipPath>`; g = `<g clip-path="url(#${uid}k)">${g}</g>`; }
    return { defs, content: l.pre + g + l.post, W: l.W, H: l.H, n: q.n };
  }
  function buildSvg(rows, D, px) {
    const c = compose(rows, D, 'u' + ++UID + '_'), h = Math.round((px * c.H) / c.W);
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.W} ${c.H}" width="${px}" height="${h}">${c.defs ? `<defs>${c.defs}</defs>` : ''}${c.content}</svg>`, W: px, H: h };
  }
  const ratio = () => { const l = lay(D); return l.H / l.W; };
  const safePx = () => Math.max(128, Math.min(Math.round(clamp(D.px, 128, 4096, 1024)), Math.floor(Math.sqrt(16e6 / ratio())), 4096));

  /* ═══════════ print templates (units: millimetres) ═══════════ */
  function tplSvg(key, px) {
    const [, w, h] = TPL[key], c = compose(rows, D, 't' + ++UID + '_'), t = D.tt;
    const a0 = D.fg.stops[0].c, acc = QRX.lum(a0) > 0.5 ? '#1f2937' : a0, onAcc = QRX.lum(acc) > 0.4 ? '#111827' : '#ffffff', INK = '#111827', GRY = '#6b7280';
    const fit = (s, mw, mx) => Math.max(1.6, Math.min(mx, mw / (Math.max(String(s).length, 4) * 0.62)));
    const tx = (x, y, s, fill, str, o) => { o = o || {}; return str ? `<text x="${f3(x)}" y="${f3(y)}" text-anchor="${o.a || 'middle'}" font-family="${o.f || FONTS.sans}" font-weight="${o.w || 700}" font-size="${f3(s)}" fill="${fill}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(str)}</text>` : ''; };
    const at = (x, y, bw, bh) => { const s = Math.min(bw / c.W, bh / c.H), qw = c.W * s, qh = c.H * s; return `<svg x="${f3(x + (bw - qw) / 2)}" y="${f3(y + (bh - qh) / 2)}" width="${f3(qw)}" height="${f3(qh)}" viewBox="0 0 ${c.W} ${c.H}">${c.content}</svg>`; };
    const wrapT = (s, m) => { const out = []; let cur = ''; String(s).split(/\s+/).forEach((wd) => { if ((cur + ' ' + wd).trim().length > m && cur) { out.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); }); if (cur) out.push(cur); return out.slice(0, 3); };
    const paper = `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
    let b = '';
    switch (key) {
      case 'a4': b = paper + `<rect width="210" height="58" fill="${acc}"/>` + tx(105, 36, fit(t.t1, 180, 17), onAcc, t.t1) + at(35, 76, 140, 152) + tx(105, 246, 6.5, GRY, t.t2, { w: 500 }) + tx(105, 264, 8, acc, t.t3) + `<rect y="289" width="210" height="8" fill="${acc}"/>`; break;
      case 'poster': b = paper + `<rect width="297" height="110" fill="${acc}"/>` + tx(148.5, 68, fit(t.t1, 260, 46), onAcc, t.t1) + at(38.5, 130, 220, 232) + tx(148.5, 382, 10, GRY, t.t2, { w: 500 }) + tx(148.5, 400, 13, acc, t.t3) + `<rect y="412" width="297" height="8" fill="${acc}"/>`; break;
      case 'flyer': b = `<rect width="148" height="210" fill="${acc}"/><rect x="10" y="10" width="128" height="190" rx="8" fill="#ffffff"/>` + tx(74, 36, fit(t.t1, 108, 14), acc, t.t1) + at(22, 50, 104, 108) + tx(74, 170, 5.2, GRY, t.t2, { w: 500 }) + tx(74, 187, 6.5, acc, t.t3); break;
      case 'card': b = paper + `<rect width="3.5" height="55" fill="${acc}"/>` + tx(9, 19, fit(t.t1, 32, 6.5), INK, t.t1, { a: 'start' }) + tx(9, 25.5, 2.9, GRY, t.t2, { a: 'start', w: 500 }) + tx(9, 46, 3.1, acc, t.t3, { a: 'start' }) + at(45, 6, 35, 43); break;
      case 'sticker': b = `<circle cx="30" cy="30" r="29" fill="#ffffff" stroke="${acc}" stroke-width="1.4"/>` + at(14, 8, 32, 34) + tx(30, 51.5, fit(t.t1, 34, 5), acc, t.t1); break;
      case 'tent': {
        const panel = () => `<rect x="6" y="6" width="93" height="136" rx="6" fill="none" stroke="${acc}" stroke-width=".8"/>` + tx(52.5, 26, fit(t.t1, 80, 9), acc, t.t1) + at(15, 36, 75, 78) + tx(52.5, 126, 4.6, GRY, t.t2, { w: 500 }) + tx(52.5, 136, 5.2, acc, t.t3);
        b = paper + `<g>${panel()}</g><g transform="rotate(180 157.5 74) translate(105 0)">${panel()}</g><line x1="105" y1="0" x2="105" y2="148" stroke="#9ca3af" stroke-width=".3" stroke-dasharray="2 2"/>`; break;
      }
      case 'menu': b = paper + `<rect x="5" y="5" width="138" height="200" fill="none" stroke="${acc}" stroke-width=".9"/><rect x="8" y="8" width="132" height="194" fill="none" stroke="${acc}" stroke-width=".3"/>` + tx(74, 27, 4.2, acc, t.t3, { w: 600, ls: 1 }) + tx(74, 48, fit(t.t1, 112, 15), INK, t.t1, { f: FONTS.serif }) + `<line x1="54" y1="56" x2="94" y2="56" stroke="${acc}" stroke-width=".5"/>` + at(24, 66, 100, 106) + tx(74, 184, 4.8, GRY, t.t2, { w: 500 }); break;
      case 'label': b = paper + `<rect x=".3" y=".3" width="79.4" height="49.4" rx="3" fill="none" stroke="#d1d5db" stroke-width=".4"/>` + at(3, 3, 35, 44) + tx(42, 12, fit(t.t1, 34, 4.8), INK, t.t1, { a: 'start' }) + wrapT(t.t2, 20).map((ln, i) => tx(42, 19 + i * 3.6, 2.6, GRY, ln, { a: 'start', w: 500 })).join('') + tx(42, 44, 3, acc, t.t3, { a: 'start' }); break;
    }
    const H = Math.round((px * h) / w);
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${px}" height="${H}">${c.defs ? `<defs>${c.defs}</defs>` : ''}${b}</svg>`, W: px, H };
  }

  /* ═══════════ files: images, PDF writer ═══════════ */
  const readURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file')); r.readAsDataURL(f); });
  async function readImage(file, o) {
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    if (isSvg) {
      if (!o.svg) throw new Error('Please choose a PNG, JPG or WebP image');
      if (file.size > 300 * 1024) throw new Error('SVG is too large (max 300 KB)');
      const d = (await readURL(file)).replace(/^data:[^;,]*;base64,/, 'data:image/svg+xml;base64,');
      if (!IMGRE.test(d)) throw new Error('Could not use this SVG');
      return d;
    }
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Choose a PNG, JPG' + (o.svg ? ', SVG' : '') + ' or WebP image');
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read this image')); i.src = url; });
    URL.revokeObjectURL(url);
    const alpha = o.alpha && file.type !== 'image/jpeg';
    for (const max of o.sizes) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.85);
      if (d.length < o.maxChars || max === o.sizes[o.sizes.length - 1]) return d;
    }
  }
  async function makePdf(svg, wpx, hpx, wmm, hmm) {
    const jpg = new Uint8Array(await (await QRX.toBlob(svg, wpx, hpx, 'image/jpeg')).arrayBuffer());
    const pt = (mm) => +((mm * 72) / 25.4).toFixed(2), W = pt(wmm), H = pt(hmm), enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n${body}\nendobj\n`); };
    put('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(4, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    offs[5] = len; put(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${wpx} /Height ${hpx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); put(jpg); put('\nendstream\nendobj\n');
    const xr = len; let x = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    put(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  /* ═══════════ page markup ═══════════ */
  const sec = (id, title, body) => `<details class="card ds-sec" id="${id}" open><summary><h3>${title}</h3></summary><div class="ds-body">${body}</div></details>`;
  const seg = (path, items) => `<div class="seg">${items.map(([v, l]) => `<button type="button" data-set="${path}=${v}">${l}</button>`).join('')}</div>`;
  const rng = (path, label, min, max, step) => `<div class="fld"><label>${label} <b class="mut" data-out="${path}"></b></label><input type="range" data-p="${path}" data-t="num" min="${min}" max="${max}" step="${step || 1}"></div>`;
  const chk = (path, label) => `<label class="chk"><input type="checkbox" data-p="${path}" data-t="bool"> ${label}</label>`;
  const cf = (path, label) => `<div class="cf"><label>${label}</label><div class="cf-r"><input type="color" data-p="${path}" data-t="hex" aria-label="${label} colour"><input class="in cf-h" data-p="${path}" data-t="hex" maxlength="7" spellcheck="false" aria-label="${label} HEX"><button type="button" class="btn btn-ghost sm" data-rgbt>RGB</button></div><div class="cf-rgb" hidden>${['R', 'G', 'B'].map((c, i) => `<label>${c}<input type="number" class="in" min="0" max="255" data-rgbp="${path}" data-ch="${i}"></label>`).join('')}</div></div>`;
  const ge = (path) => `<div class="ge">${seg(path + '.type', [['solid', 'Solid'], ['linear', 'Linear'], ['radial', 'Radial']])}<div class="ge-bar" data-bar="${path}"></div><div data-vis="${path}.type=linear">${rng(path + '.angle', 'Angle (°)', 0, 360, 1)}</div><div data-stops="${path}"></div><button type="button" class="btn btn-ghost sm" data-gadd="${path}" data-vis="${path}.type!=solid">＋ Colour stop</button></div>`;

  const left = [
    sec('s0', '⓪ Content', `<div class="fld"><label for="dsData">What should the QR contain?</label><textarea class="in" id="dsData" data-p="data" rows="3" maxlength="2500" placeholder="https://example.com"></textarea><small class="fh" id="dsCount"></small></div><div class="chips">${STARTERS.map((s, i) => `<button type="button" class="chip" data-fill="${i}">${s[0]}</button>`).join('')}</div><p class="ds-hint">Need a guided form for Wi-Fi, UPI, vCard or events? Build it in the <a class="lnk" href="/qr-generator">QR Generator</a> and paste the content here.</p>`),
    sec('s1', '① QR style', `<div class="chips">${STYLES.map(([k, l]) => `<button type="button" class="chip" data-set="style=${k}">${l}</button>`).join('')}</div><label class="lbl" style="margin-top:1rem">Module shape</label><div class="seg">${DOTS.map(([v, i, l]) => `<button type="button" data-set="dots=${v}">${i} ${l}</button>`).join('')}</div><p class="ds-hint">Choosing a shape yourself switches the style to <b>Custom</b>.</p>`),
    sec('s2', '② Colours & gradient', `<label class="lbl">Presets</label><div class="chips">${PRE.map((p, i) => `<button type="button" class="ds-pre" data-pre="${i}"><i style="--bgp:linear-gradient(135deg,${p[1].stops.map((s) => s.c).join(',')}${p[1].stops.length < 2 ? ',' + p[1].stops[0].c : ''})"></i>${p[0]}</button>`).join('')}</div><label class="lbl" style="margin-top:1rem">Foreground — solid, linear or radial, with several stops</label>${ge('fg')}<p class="ds-hint">Every colour has a picker, a HEX box and an RGB panel. Radial gradients work in PNG/JPG/SVG; some design apps flatten them.</p>`),
    sec('s3', '③ QR eyes', `<label class="lbl">Outer eye shape</label>${seg('eyeOuter', EYEO)}<label class="lbl">Inner eye shape</label>${seg('eyeInner', EYEI)}${chk('eyeLink', 'Eyes follow the foreground colour')}<div data-vis="!eyeLink" class="row2" style="margin-top:.7rem"><div style="flex:1">${cf('eyeOuterC', 'Outer eye colour')}</div><div style="flex:1">${cf('eyeInnerC', 'Inner eye colour')}</div></div>`),
    sec('s4', '④ Logo', `<div class="fld"><label for="logoIn">Upload a logo (PNG, JPG or SVG, up to 400 KB)</label><div class="row2"><input class="in" type="file" id="logoIn" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"><button type="button" class="btn btn-ghost sm" id="logoClear" data-vis="logo.img">Remove</button></div></div><div data-vis="logo.img">${rng('logo.size', 'Logo size (% of the code width)', 8, 30, 1)}<label class="lbl">Position</label>${seg('logo.pos', [['center', 'Centre'], ['br', 'Bottom-right'], ['custom', 'Custom']])}<div data-vis="logo.pos=custom">${rng('logo.dx', 'Horizontal offset (%)', -35, 35, 1)}${rng('logo.dy', 'Vertical offset (%)', -35, 35, 1)}</div>${rng('logo.pad', 'Padding around the logo (modules)', 0, 3, 0.25)}<label class="lbl">Shape</label>${seg('logo.shape', [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']])}<label class="lbl">Logo background</label>${seg('logo.bgMode', [['color', 'Colour'], ['none', 'None']])}<div data-vis="logo.bgMode=color">${cf('logo.bgC', 'Plate colour')}</div>${rng('logo.border', 'Border (tenths of a module)', 0, 8, 1)}<div data-vis="logo.border>0"></div>${cf('logo.borderC', 'Border colour')}${chk('logo.clear', 'Remove the QR dots behind the logo (cleaner look)')}</div><p class="ds-hint" data-vis="!logo.img">Adding a logo raises error correction to H automatically, and the studio warns you if it blocks too much of the code.</p>`),
    sec('s5', '⑤ Background', `${seg('bg.mode', [['transparent', 'Transparent'], ['white', 'White'], ['color', 'Colour'], ['gradient', 'Gradient'], ['image', 'Image']])}<div data-vis="bg.mode=color" style="margin-top:.8rem">${cf('bg.color', 'Background colour')}</div><div data-vis="bg.mode=gradient" style="margin-top:.8rem">${ge('bg.grad')}</div><div data-vis="bg.mode=image" style="margin-top:.8rem"><div class="fld"><label for="bgIn">Background image (PNG, JPG or WebP)</label><div class="row2"><input class="in" type="file" id="bgIn" accept="image/png,image/jpeg,image/webp"><button type="button" class="btn btn-ghost sm" id="bgClear">Remove</button></div></div>${rng('bg.overlay', 'White overlay (washes the image out)', 0, 0.9, 0.05)}</div><div data-vis="bgFancy">${chk('bg.plate', 'Add a safe panel behind the code (strongly recommended)')}<div data-vis="bg.plate">${rng('bg.plateOp', 'Panel opacity', 0.5, 1, 0.01)}</div></div>`),
    sec('s6', '⑥ Frame & caption', `${seg('frame', [['none', 'None'], ['border', 'Border'], ['bottom', 'Bar below'], ['top', 'Bar above'], ['badge', 'Badge'], ['brackets', 'Corners']])}<div class="fld" style="margin-top:.9rem"><label for="dsCap">Caption</label><input class="in" id="dsCap" data-p="caption" maxlength="28" placeholder="SCAN ME"></div><div class="chips">${CAPS.map((c) => `<button type="button" class="chip" data-cap="${c}">${c}</button>`).join('')}</div><div class="row3" style="margin-top:.9rem"><div class="fld"><label for="dsFont">Font</label><select class="in" id="dsFont" data-p="capFont"><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option><option value="round">Rounded</option></select></div>${chk('capUpper', 'UPPERCASE')}<label class="chk"><input type="checkbox" id="capAuto"> Auto caption colour</label></div><div class="row2"><div style="flex:1">${cf('frameC', 'Frame colour')}</div><div style="flex:1" data-vis="capC!=auto">${cf('capC', 'Caption colour')}</div></div>`),
    sec('s7', '⑦ Error correction, quiet zone & size', `<p class="ds-hint">Higher error correction repairs more damage and allows bigger logos, but it adds modules, so each module prints smaller. Pick the lowest level that fits your use.</p><div class="ds-eclg" id="dsEcl"></div>${rng('margin', 'Quiet zone (modules)', 1, 8, 1)}<label class="lbl">Export size</label><div class="chips">${[256, 512, 1024, 2048].map((v) => `<button type="button" class="chip" data-set="px=${v}">${v} × ${v}</button>`).join('')}</div><div class="row2" style="margin-top:.8rem"><div class="fld" style="flex:1"><label for="dsPx">Custom width (px, 128–4096)</label><input class="in" id="dsPx" type="number" min="128" max="4096" data-p="px" data-t="num"></div><div class="fld" style="flex:1"><label for="dsPdfMm">PDF page width (mm)</label><input class="in" id="dsPdfMm" type="number" min="20" max="400" data-p="pdfMm" data-t="num"></div></div>`),
    sec('s8', '⑧ Print templates', `<div class="chips">${Object.keys(TPL).map((k) => `<button type="button" class="chip" data-set="tpl=${k}">${TPL[k][3]} ${TPL[k][0]}</button>`).join('')}</div><div class="row3" style="margin-top:.9rem"><div class="fld"><label>Headline</label><input class="in" data-p="tt.t1" maxlength="60"></div><div class="fld"><label>Subline</label><input class="in" data-p="tt.t2" maxlength="60"></div><div class="fld"><label>Footer</label><input class="in" data-p="tt.t3" maxlength="60"></div></div><div class="ds-tp" id="tplPrev"></div><p class="ds-hint" id="tplInfo"></p><div class="dl" style="grid-template-columns:repeat(3,1fr)"><button type="button" class="btn btn-ghost sm" id="tpPng">PNG</button><button type="button" class="btn btn-ghost sm" id="tpPdf">PDF</button><button type="button" class="btn btn-ghost sm" id="tpPrint">🖨️ Print</button></div>`),
    sec('s9', '⑨ Brand designs', `<p class="ds-hint">Save your look (colours, shapes, logo, frame) and reuse it for any content. The QR’s content is never saved.</p><div class="row2"><input class="in" id="svName" maxlength="60" placeholder="e.g. Grand Vista brand" aria-label="Design name"><button type="button" class="btn btn-primary sm" id="svSave">💾 Save</button></div><div id="svList"></div><div class="row2" style="margin-top:.8rem"><button type="button" class="btn btn-ghost sm" id="svExp">⬇️ Export JSON</button><button type="button" class="btn btn-ghost sm" id="svImpBtn">⬆️ Import JSON</button><button type="button" class="btn btn-ghost sm" id="svReset">↺ Reset design</button><input type="file" id="svImp" accept=".json,application/json" hidden></div>`),
  ].join('');

  root.innerHTML = `<div class="ds-grid"><div class="ds-left">${left}</div>
<aside class="ds-right"><div class="card ds-sticky">
  <div class="prev-h"><h3>Live preview</h3><span class="live"><i></i>Live</span></div>
  <div class="ds-stage scan" id="dsStage"></div>
  <div id="dsInfo" class="ds-info"></div>
  <div class="dl ds-dl"><button type="button" class="btn btn-ghost sm" id="dsPng" disabled>PNG</button><button type="button" class="btn btn-ghost sm" id="dsJpg" disabled>JPG</button><button type="button" class="btn btn-ghost sm" id="dsWebp" disabled>WebP</button><button type="button" class="btn btn-ghost sm" id="dsSvg" disabled>SVG</button><button type="button" class="btn btn-ghost sm" id="dsPdf" disabled>PDF</button><button type="button" class="btn btn-ghost sm" id="dsPrint" disabled>🖨️ Print</button><button type="button" class="btn btn-ghost sm" id="dsShare" disabled>🔗 Share</button><button type="button" class="btn btn-ghost sm" id="dsCopy" disabled>📋 Copy</button></div>
  <button type="button" class="btn btn-ghost full" id="dsPrevDl" disabled style="margin-top:.6rem">⬇️ Download preview</button>
  <button type="button" class="btn btn-primary full" id="dsSaveQr" disabled style="margin-top:.6rem">💾 Save to My QR Codes</button>
  <h4 class="ds-h4">✅ Quality &amp; compatibility</h4>
  <div id="dsChecks"></div>
  <div class="row2" style="margin-top:.8rem"><button type="button" class="btn btn-primary sm" id="dsTestBtn" disabled>🧪 Run scan test</button><button type="button" class="btn btn-ghost sm" id="dsPhone" disabled>📱 Phone test</button></div>
  <div id="dsTest"></div>
  <details class="ds-guide"><summary>📲 Scanner compatibility guide</summary><div id="dsGuide"></div></details>
</div></aside></div>`;

  /* ═══════════ controls: binding, refresh, visibility ═══════════ */
  const vis = (x) => {
    const m = x.match(/^(!?)([\w.]+)(?:(!?=|>)(.*))?$/); if (!m) return true;
    const v = get(m[2]); let r;
    if (m[3] === '>') r = +v > +m[4];
    else if (m[3]) { r = String(v) === m[4]; if (m[3] === '!=') r = !r; }
    else r = !!v;
    return m[1] ? !r : r;
  };
  function refreshControls() {
    $$('[data-p]', root).forEach((el) => {
      if (el === document.activeElement) return;
      const v = get(el.dataset.p); if (v === undefined) return;
      if (el.dataset.t === 'bool') el.checked = !!v;
      else if (el.dataset.t === 'hex') { if (H6.test(v)) el.value = v; }
      else el.value = v;
    });
    $$('[data-rgbp]', root).forEach((el) => { if (el === document.activeElement) return; const v = get(el.dataset.rgbp); if (H6.test(v)) el.value = toRgb(v)[+el.dataset.ch]; });
    $$('[data-set]', root).forEach((b) => { const i = b.dataset.set.indexOf('='); b.classList.toggle('on', String(get(b.dataset.set.slice(0, i))) === b.dataset.set.slice(i + 1)); });
    $$('[data-out]', root).forEach((o) => { const v = get(o.dataset.out); o.textContent = typeof v === 'number' ? +v.toFixed(2) : v; });
    $$('[data-vis]', root).forEach((el) => { el.hidden = !vis(el.dataset.vis); });
    $$('[data-bar]', root).forEach((b) => { const g = get(b.dataset.bar); b.style.background = g.type === 'solid' ? g.stops[0].c : `linear-gradient(90deg,${[...g.stops].sort((a, c) => a.o - c.o).map((s) => `${s.c} ${s.o * 100}%`).join(',')})`; });
    const ca = $('#capAuto'); if (ca && ca !== document.activeElement) ca.checked = D.capC === 'auto';
  }
  function renderStops(path) {
    const g = get(path), box = $(`[data-stops="${path}"]`); if (!box) return;
    const list = g.type === 'solid' ? [0] : g.stops.map((_, i) => i);
    box.innerHTML = list.map((i) => `<div class="gs">${cf(`${path}.stops.${i}.c`, g.type === 'solid' ? 'Colour' : 'Stop ' + (i + 1))}${g.type === 'solid' ? '' : `<div class="gs-o"><input type="range" data-p="${path}.stops.${i}.o" data-t="num" min="0" max="1" step="0.01" aria-label="Stop position"><button type="button" class="btn btn-ghost sm" data-gdel="${path}:${i}"${g.stops.length <= 2 ? ' disabled' : ''} aria-label="Remove stop">✕</button></div>`}</div>`).join('');
    refreshControls();
  }
  function renderEcl() {
    $('#dsEcl').innerHTML = ECLI.map(([l, pct, d]) => { const s = ecs[l]; return `<button type="button" class="ds-ecl" data-set="ecl=${l}"><b>${l}</b><span>${pct}% damage repaired</span><i style="--w:${Math.round((pct / 30) * 100)}%"></i><small>${s ? `${s.size}×${s.size} modules · v${s.version}` : 'calculating…'}</small><em>${d}</em></button>`; }).join('');
    refreshControls();
  }
  let ecs = {}, mT, eT, tT, rq = 0, seq = 0, eseq = 0;
  const schedMatrix = () => { clearTimeout(mT); mT = setTimeout(loadMatrix, 220); };
  const schedEcl = () => { clearTimeout(eT); eT = setTimeout(loadEcl, 800); };
  const draw = () => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); };
  async function loadMatrix() {
    const my = ++seq, txt = D.data;
    if (!txt) { rows = null; stats = null; err = 'Enter content to see your QR'; render(); return; }
    try { const m = await QRX.matrix(txt, D.ecl); if (my !== seq) return; rows = m.rows; stats = m; err = ''; }
    catch (e) { if (my !== seq) return; rows = null; stats = null; err = e.message; }
    render();
  }
  async function loadEcl() {
    const my = ++eseq, txt = D.data; if (!txt) return;
    const out = {};
    await Promise.all(['L', 'M', 'Q', 'H'].map(async (l) => { try { out[l] = await api('/api/qr/validate', { method: 'POST', body: { text: txt, ecl: l } }); } catch (e) { out[l] = null; } }));
    if (my !== eseq) return; ecs = out; renderEcl();
  }
  function changed(p) {
    if (['dots', 'eyeOuter', 'eyeInner'].includes(p)) D.style = 'custom';
    if (p === 'data' || p === 'ecl') schedMatrix();
    if (p === 'data') schedEcl();
    refreshControls(); draw();
  }
  function afterSet(p) {
    if (p === 'style') { const sh = STY[D.style]; if (sh) Object.assign(D, sh); }
    if (/^(fg|bg\.grad)\.type$/.test(p)) { const bp = p.replace(/\.type$/, ''), g = get(bp); if (g.type !== 'solid' && g.stops.length < 2) g.stops.push({ o: 1, c: '#0e7490' }); renderStops(bp); }
    if (p === 'tpl') D.tt = Object.assign({}, TPL[D.tpl][4]);
    changed(p);
  }
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.rgbp) { const v = [...el.closest('.cf-rgb').querySelectorAll('input')].map((i) => clamp(i.value, 0, 255, 0)); set(el.dataset.rgbp, toHex(v[0], v[1], v[2])); changed(el.dataset.rgbp); return; }
    const p = el.dataset.p; if (!p) return;
    let v; const t = el.dataset.t;
    if (t === 'bool') v = el.checked; else if (t === 'num') v = +el.value; else if (t === 'hex') { v = normHex(el.value); if (!v) return; } else v = el.value;
    set(p, v); changed(p);
  });
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.p === 'px') { D.px = Math.round(clamp(D.px, 128, 4096, 1024)); refreshControls(); draw(); }
    if (el.id === 'capAuto') { D.capC = el.checked ? 'auto' : '#ffffff'; changed('capC'); }
    if (el.id === 'logoIn') onLogo(el);
    if (el.id === 'bgIn') onBg(el);
    if (el.id === 'svImp') onImport(el);
  });
  root.addEventListener('click', (e) => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-set]'))) { const i = b.dataset.set.indexOf('='), p = b.dataset.set.slice(0, i), v = b.dataset.set.slice(i + 1); set(p, v !== '' && !isNaN(v) ? +v : v); afterSet(p); return; }
    if ((b = t.closest('[data-pre]'))) { const p = PRE[+b.dataset.pre]; D.fg = clone(p[1]); D.eyeLink = false; D.eyeOuterC = D.eyeInnerC = p[2]; renderStops('fg'); changed('fg'); return; }
    if ((b = t.closest('[data-cap]'))) { D.caption = b.dataset.cap; if (D.frame === 'none') D.frame = 'bottom'; changed('caption'); return; }
    if ((b = t.closest('[data-fill]'))) { D.data = STARTERS[+b.dataset.fill][1]; changed('data'); return; }
    if ((b = t.closest('[data-rgbt]'))) { const w = b.closest('.cf').querySelector('.cf-rgb'); w.hidden = !w.hidden; return; }
    if ((b = t.closest('[data-gadd]'))) { const g = get(b.dataset.gadd); if (g.stops.length >= 6) return toast('Up to 6 colour stops'); g.stops.push({ o: 0.5, c: g.stops[g.stops.length - 1].c }); renderStops(b.dataset.gadd); changed(b.dataset.gadd); return; }
    if ((b = t.closest('[data-gdel]'))) { const [path, i] = b.dataset.gdel.split(':'), g = get(path); if (g.stops.length > 2) { g.stops.splice(+i, 1); renderStops(path); changed(path); } return; }
    if ((b = t.closest('[data-svo]'))) { applySaved(b.closest('.ds-sv').dataset.id); return; }
    if ((b = t.closest('[data-svd]'))) { delSaved(b.closest('.ds-sv').dataset.id); }
  });

  /* ═══════════ logo / background uploads ═══════════ */
  async function onLogo(el) {
    const f = el.files[0]; el.value = ''; if (!f) return;
    try {
      const d = await readImage(f, { svg: true, alpha: true, sizes: [512, 320, 200], maxChars: 400 * 1024 * 1.37 });
      if (d.length > 400 * 1024 * 1.37) return toast('Logo must be under 400 KB');
      D.logo.img = d;
      if (D.ecl !== 'H') { D.ecl = 'H'; toast('Logo added. Error correction raised to H'); } else toast('Logo added');
      changed('ecl'); renderEcl();
    } catch (e) { toast(e.message); }
  }
  async function onBg(el) {
    const f = el.files[0]; el.value = ''; if (!f) return;
    try { D.bg.img = await readImage(f, { svg: false, alpha: false, sizes: [1200, 800, 500], maxChars: 330 * 1024 }); D.bg.mode = 'image'; D.bg.plate = true; toast('Background set. Keep the safe panel on for reliable scanning'); changed('bg.img'); }
    catch (e) { toast(e.message); }
  }
  $('#logoClear').onclick = () => { D.logo.img = null; changed('logo.img'); };
  $('#bgClear').onclick = () => { D.bg.img = null; if (D.bg.mode === 'image') D.bg.mode = 'color'; changed('bg.img'); };

  /* ═══════════ quality checks + compatibility guide ═══════════ */
  function bgColors() {
    const B = D.bg;
    if (B.mode === 'color') return [B.color];
    if (B.mode === 'gradient') return B.grad.stops.map((s) => s.c);
    if (B.mode === 'image') return B.img && B.plate && B.plateOp >= 0.75 ? ['#ffffff'] : null;
    return ['#ffffff'];
  }
  function checks() {
    const it = [], add = (s, label, detail) => it.push({ s, label, detail });
    if (!rows) { add('fail', 'Valid content', err || 'Enter content'); return { items: it, score: 0, verdict: 'Enter content to begin', flags: {} }; }
    const n = stats.size, q = D.margin, B = D.bg, L = D.logo;
    const fgs = D.fg.type === 'solid' ? [D.fg.stops[0].c] : D.fg.stops.map((s) => s.c), bgs = bgColors();
    add('pass', 'Valid content', `${stats.bytes} bytes · version ${stats.version} · ${n}×${n} modules`);
    let ratioMin = null, inv = false;
    if (bgs) {
      ratioMin = Math.min(...fgs.flatMap((f) => bgs.map((b) => QRX.contrast(f, b))));
      const mf = fgs.reduce((a, c) => a + QRX.lum(c), 0) / fgs.length, mb = bgs.reduce((a, c) => a + QRX.lum(c), 0) / bgs.length;
      inv = mf > mb;
    }
    if (inv) add('fail', 'Dark on light', 'Light-on-dark (inverted) codes fail on many scanners. Swap the colours.');
    if (ratioMin == null) add('warn', 'Contrast', 'Background image without a safe panel: contrast cannot be guaranteed. Turn the panel on.');
    else add(ratioMin < 2.5 ? 'fail' : ratioMin < 4 ? 'warn' : 'pass', 'Good contrast', `Lowest contrast ${ratioMin.toFixed(1)}:1${ratioMin < 4 ? '. Darker colours scan more reliably.' : ''}`);
    if (B.mode === 'transparent') add('warn', 'Background', 'Transparent: contrast depends on the surface you place the QR on.');
    if (B.mode === 'image' && !B.img) add('warn', 'Background image', 'No image chosen yet.');
    add(q < 2 ? 'fail' : q < 4 ? 'warn' : 'pass', 'Quiet zone', `${q} modules (the standard is 4)`);
    let eyeHit = false, logoWarn = false;
    if (L.img) {
      const lb = logoBox(D, n, q), cover = (lb.pw * lb.pw * (L.shape === 'circle' ? Math.PI / 4 : 1)) / (n * n), tol = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 }[D.ecl];
      eyeHit = [[q, q], [q + n - 7, q], [q, q + n - 7]].some(([ex, ey]) => lb.x < ex + 7 && lb.x + lb.pw > ex && lb.y < ey + 7 && lb.y + lb.pw > ey);
      if (eyeHit) add('fail', 'Logo placement', 'The logo overlaps a corner eye. Move or shrink it.');
      else if (cover > tol * 0.8) add('fail', 'Logo interference', `Covers ${(cover * 100).toFixed(1)}% but level ${D.ecl} repairs only ${tol * 100}%. Shrink the logo or raise error correction.`);
      else if (cover > tol * 0.5 || L.size > 25 || (!L.clear && L.bgMode === 'none')) { logoWarn = true; add('warn', 'Logo interference', `Covers ${(cover * 100).toFixed(1)}% (level ${D.ecl} repairs ${tol * 100}%).${!L.clear && L.bgMode === 'none' ? ' Dots show through the logo. Turn on dot removal or a plate.' : ' Keep it modest for older scanners.'}`); }
      else add('pass', 'Logo size acceptable', `Covers ${(cover * 100).toFixed(1)}%; level ${D.ecl} repairs ${tol * 100}%`);
    } else add('pass', 'Logo', 'No logo: maximum reliability');
    if (!D.eyeLink && bgs) { const er = Math.min(...[D.eyeOuterC, D.eyeInnerC].flatMap((e) => bgs.map((b) => QRX.contrast(e, b)))); if (er < 3) add('warn', 'Eye colours', `Eye contrast is only ${er.toFixed(1)}:1. Scanners find the code by its eyes, so darken them.`); }
    if (D.caption.trim() && ['bottom', 'top', 'badge'].includes(D.frame) && D.capC !== 'auto' && QRX.contrast(D.capC, D.frameC) < 3) add('warn', 'Caption contrast', 'The caption is hard to read on the frame colour.');
    add(n >= 57 ? 'warn' : 'pass', 'Density', n >= 57 ? `${n}×${n} modules is dense. Print larger or shorten the content.` : `${n}×${n} modules: comfortable`);
    const cm = Math.ceil((n + 2 * q) * 0.08 * 2) / 2, ppm = (safePx() * 1000) / lay(D).W / (n + 2 * q);
    add(ppm < 4 ? 'warn' : 'pass', 'Suitable for printing', ppm < 4 ? 'The export size is small for this density. Choose a larger size.' : `Print at least ${cm} cm wide (about 0.8 mm per module)`);
    const w = { pass: 1, info: 0.8, warn: 0.5, fail: 0 }, score = Math.round((100 * it.reduce((a, i) => a + w[i.s], 0)) / it.length);
    const hard = inv || (ratioMin != null && ratioMin < 2.5) || eyeHit;
    const soft = ratioMin == null || ratioMin < 4 || B.mode === 'transparent' || q < 4 || logoWarn;
    return { items: it, score, verdict: it.some((i) => i.s === 'fail') ? 'Needs attention' : it.some((i) => i.s === 'warn') ? 'Good: review the warnings' : 'Excellent: ready to use', flags: { hard, soft, fancy: ['dots', 'diamond', 'bars', 'minimal'].includes(D.dots), logo: !!L.img, grad: D.fg.type !== 'solid' } };
  }
  function renderChecks() {
    const c = checks();
    $('#dsChecks').innerHTML = `<div class="ds-score"><div class="q-ring2" style="--p:${c.score}"><b>${c.score}</b></div><div><b>${esc(c.verdict)}</b><small class="mut" style="display:block">Updates live as you design</small></div></div><ul class="ds-q">${c.items.map((i) => `<li class="${i.s}"><span>${ICON[i.s]}</span><div><b>${esc(i.label)}</b><small>${esc(i.detail)}</small></div></li>`).join('')}</ul>`;
    const f = c.flags;
    if (!rows) { $('#dsGuide').innerHTML = ''; return; }
    const st = (hard, soft) => (hard ? 'fail' : soft ? 'warn' : 'pass');
    const G2 = [
      ['🍎', 'iPhone Camera (iOS 11+)', st(f.hard, f.soft), f.hard ? 'Likely to fail. Fix the red checks first.' : f.soft ? 'Should scan; hold steady and keep light on the code.' : 'Reads this design natively, no app needed.'],
      ['🤖', 'Android Camera & Google Lens', st(f.hard, f.soft), f.hard ? 'Likely to fail. Fix the red checks first.' : f.soft ? 'Should scan; low contrast is the main risk.' : 'Reads this design natively.'],
      ['💬', 'In-app scanners (WhatsApp, Instagram, Snapchat)', f.hard ? 'fail' : f.soft || f.fancy ? 'warn' : 'pass', f.hard ? 'Likely to fail.' : f.fancy ? 'Dots/bars/diamond shapes scan slower in some in-app scanners. Prefer rounded or square.' : 'Good.'],
      ['🖨️', 'Older & barcode-reader apps', f.hard ? 'fail' : f.soft || f.fancy || f.logo || f.grad ? 'warn' : 'pass', f.hard ? 'Likely to fail.' : f.soft || f.fancy || f.logo || f.grad ? 'Stricter: they prefer solid dark-on-white, square modules and no logo. Offer a plain version too.' : 'Plain, high-contrast design: ideal for strict scanners.'],
    ];
    $('#dsGuide').innerHTML = `<ul class="ds-q">${G2.map(([ic, n, s, d]) => `<li class="${s}"><span>${ICON[s]}</span><div><b>${ic} ${esc(n)}</b><small>${esc(d)}</small></div></li>`).join('')}</ul><p class="ds-hint">Always test the printed result with two different phones before a big print run.</p>`;
  }

  /* ═══════════ render ═══════════ */
  const BTN = ['dsPng', 'dsJpg', 'dsWebp', 'dsSvg', 'dsPdf', 'dsPrint', 'dsShare', 'dsCopy', 'dsPrevDl', 'dsTestBtn', 'dsPhone', 'dsSaveQr'];
  function render() {
    const st = $('#dsStage');
    BTN.forEach((id) => { $('#' + id).disabled = !rows; });
    const chars = [...D.data].length, bytes = new TextEncoder().encode(D.data).length;
    $('#dsCount').textContent = `${chars} characters · ${bytes} bytes`;
    if (!rows) { st.innerHTML = `<div class="empty">▦<br>${esc(err || 'Enter content to see your QR')}</div>`; $('#dsInfo').innerHTML = ''; renderChecks(); schedTpl(); return; }
    st.innerHTML = buildSvg(rows, D, 640).svg;
    const px = safePx(), r = ratio(), cm = Math.ceil((stats.size + 2 * D.margin) * 0.08 * 2) / 2;
    $('#dsInfo').innerHTML = `<div class="eng"><div><b>v${stats.version}</b><span>Version</span></div><div><b>${stats.size}²</b><span>Modules</span></div><div><b>${stats.bytes}</b><span>Bytes</span></div><div><b>${stats.ecl}</b><span>Error corr.</span></div></div><p class="mini">Output ${px} × ${Math.round(px * r)} px${px < D.px ? ' (limited for browser safety)' : ''} · print at least ${cm} cm wide</p>`;
    renderChecks(); schedTpl();
  }

  /* ═══════════ exports ═══════════ */
  const wrap = (fn) => async () => { try { await fn(); } catch (e) { if (e && e.name !== 'AbortError') toast(e.message || 'Export failed'); } };
  async function exportRaster(mime, ext) {
    const px = safePx(); if (px < D.px) toast(`Size limited to ${px}px for browser safety`);
    const b = buildSvg(rows, D, px); QRX.save(await QRX.toBlob(b.svg, b.W, b.H, mime), `qrnova-design.${ext}`);
  }
  $('#dsPng').onclick = wrap(() => exportRaster('image/png', 'png'));
  $('#dsJpg').onclick = wrap(() => exportRaster('image/jpeg', 'jpg'));
  $('#dsWebp').onclick = wrap(() => exportRaster('image/webp', 'webp'));
  $('#dsSvg').onclick = () => QRX.save(new Blob([buildSvg(rows, D, safePx()).svg], { type: 'image/svg+xml' }), 'qrnova-design.svg');
  $('#dsPdf').onclick = wrap(async () => {
    const px = safePx(), b = buildSvg(rows, D, px), wmm = clamp(D.pdfMm, 20, 400, 100);
    QRX.save(await makePdf(b.svg, b.W, b.H, wmm, (wmm * b.H) / b.W), 'qrnova-design.pdf');
  });
  $('#dsPrevDl').onclick = wrap(async () => { const b = buildSvg(rows, D, 1024); QRX.save(await QRX.toBlob(b.svg, b.W, b.H, 'image/png'), 'qrnova-preview.png'); });
  $('#dsCopy').onclick = () => navigator.clipboard.writeText(D.data).then(() => toast('Content copied'));
  $('#dsPrint').onclick = () => {
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print');
    w.document.write(`<!doctype html><title>QR code</title><style>@page{margin:12mm}body{margin:0;display:grid;place-items:center;min-height:100vh}img{max-width:90vw;max-height:90vh}</style><img src="${QRX.svgUrl(buildSvg(rows, D, 1200).svg)}" onload="setTimeout(function(){print()},250)">`); w.document.close();
  };
  $('#dsShare').onclick = wrap(async () => {
    const b = buildSvg(rows, D, 1024), blob = await QRX.toBlob(b.svg, b.W, b.H, 'image/png'), f = new File([blob], 'qrnova.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'My QR code' });
    else { await navigator.clipboard.writeText(D.data); toast('Sharing is not supported here. Content copied'); }
  });

  /* template export */
  const schedTpl = () => { clearTimeout(tT); tT = setTimeout(drawTpl, 180); };
  function drawTpl() {
    const box = $('#tplPrev'); if (!box) return;
    const [name, w, h] = TPL[D.tpl];
    $('#tplInfo').textContent = `${name} · ${w} × ${h} mm. Exports at print resolution.`;
    box.innerHTML = rows ? tplSvg(D.tpl, 640).svg : '<div class="empty">Enter content to preview the layout</div>';
    ['tpPng', 'tpPdf', 'tpPrint'].forEach((id) => { $('#' + id).disabled = !rows; });
  }
  function tplDims() { const [, w, h] = TPL[D.tpl], dpi = Math.min(300, Math.floor(4500 / (Math.max(w, h) / 25.4))); return { w, h, px: Math.round((w / 25.4) * dpi), dpi }; }
  $('#tpPng').onclick = wrap(async () => { const d = tplDims(), b = tplSvg(D.tpl, d.px); QRX.save(await QRX.toBlob(b.svg, b.W, b.H, 'image/png'), `qrnova-${D.tpl}.png`); });
  $('#tpPdf').onclick = wrap(async () => { const d = tplDims(), b = tplSvg(D.tpl, d.px); QRX.save(await makePdf(b.svg, b.W, b.H, d.w, d.h), `qrnova-${D.tpl}.pdf`); });
  $('#tpPrint').onclick = () => {
    const d = tplDims(), w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print');
    w.document.write(`<!doctype html><title>QR print</title><style>@page{size:${d.w}mm ${d.h}mm;margin:0}html,body{margin:0}img{width:${d.w}mm;height:${d.h}mm;display:block}</style><img src="${QRX.svgUrl(tplSvg(D.tpl, 1400).svg)}" onload="setTimeout(function(){print()},300)">`); w.document.close();
  };

  /* ═══════════ scan test (browser detector, jsQR fallback) ═══════════ */
  let jq = null;
  const loadJsQR = () => (window.jsQR ? Promise.resolve(window.jsQR) : (jq = jq || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    s.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error('Decoder failed to load'))); s.onerror = () => { jq = null; rej(new Error('The scan-test decoder could not be loaded (offline?)')); };
    document.head.appendChild(s);
  })));
  async function decode(c) {
    if ('BarcodeDetector' in window) { try { const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(c); return { v: r.length ? r[0].rawValue : null, eng: 'browser BarcodeDetector' }; } catch (e) { /* fall through */ } }
    const j = await loadJsQR(), im = c.getContext('2d').getImageData(0, 0, c.width, c.height), r = j(im.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
    return { v: r ? r.data : null, eng: 'jsQR' };
  }
  async function runTest() {
    if (!rows) return toast('Nothing to test yet');
    const box = $('#dsTest'); box.innerHTML = '<div class="ds-note">🧪 Testing…</div>';
    try {
      const b = buildSvg(rows, D, 720), img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not render the design')); i.src = QRX.svgUrl(b.svg); });
      const want = String(D.data).replace(/\r/g, ''), res = []; let eng = '';
      for (const [label, w, sh] of [['Standard camera view', 720, 1], ['Small or far away', 190, 1], ['Blurry / low light', 720, 5]]) {
        const h = Math.round((w * b.H) / b.W), c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
        if (sh > 1) { const s = document.createElement('canvas'); s.width = Math.max(40, Math.round(w / sh)); s.height = Math.max(40, Math.round(h / sh)); const sx = s.getContext('2d'); sx.fillStyle = '#fff'; sx.fillRect(0, 0, s.width, s.height); sx.drawImage(img, 0, 0, s.width, s.height); x.imageSmoothingEnabled = true; x.drawImage(s, 0, 0, w, h); }
        else x.drawImage(img, 0, 0, w, h);
        const r = await decode(c); eng = r.eng;
        res.push([label, r.v == null ? 'fail' : String(r.v).replace(/\r/g, '') === want ? 'pass' : 'warn']);
      }
      const ok = res.every((r) => r[1] === 'pass');
      box.innerHTML = `<ul class="ds-q">${res.map(([l, s]) => `<li class="${s}"><span>${ICON[s]}</span><div><b>${l}</b><small>${s === 'pass' ? 'Decoded exactly' : s === 'warn' ? 'Decoded, but the text differs' : 'Could not read it'}</small></div></li>`).join('')}</ul><div class="ds-note ${ok ? 'ok' : ''}">${ok ? '✅ Passed every condition.' : '⚠️ Some conditions failed. Test decoders can be stricter than phone cameras, but treat this as a warning: raise contrast, simplify the shape or shrink the logo.'} <small>Decoder: ${esc(eng)}. Always confirm with a real phone.</small></div>`;
    } catch (e) { box.innerHTML = `<div class="ds-note">${esc(e.message)}</div>`; }
  }
  $('#dsTestBtn').onclick = runTest;
  $('#dsPhone').onclick = () => {
    if (!rows) return;
    const o = document.createElement('div'); o.className = 'ds-ov';
    o.innerHTML = `<div class="ds-ov-in">${buildSvg(rows, D, 900).svg}<p>Scan this screen with another phone. Turn the brightness up.</p><button class="btn btn-primary" type="button">Close</button></div>`;
    o.onclick = (e) => { if (e.target === o || e.target.tagName === 'BUTTON') o.remove(); };
    document.body.appendChild(o);
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const o = $('.ds-ov'); if (o) o.remove(); } });

  /* ═══════════ brand designs: account + JSON ═══════════ */
  function fullRefresh() { renderStops('fg'); renderStops('bg.grad'); refreshControls(); schedMatrix(); schedEcl(); draw(); }
  function applyDesign(obj) { const keep = D.data; D = normalize(obj); D.data = keep; fullRefresh(); }
  async function listSaved() {
    const box = $('#svList');
    if (!QRX.token()) { box.innerHTML = '<p class="ds-hint">🔐 <a class="lnk" href="/login?next=/design-studio">Log in</a> to save designs to your account. You can still export and import JSON.</p>'; return; }
    try {
      const r = await api('/api/designs');
      box.innerHTML = r.items.length ? r.items.map((d) => `<div class="ds-sv" data-id="${d.id}"><b>${esc(d.name)}</b><small>${new Date(d.updated).toLocaleDateString()} · ${Math.ceil(d.bytes / 1024)} KB</small><div class="ds-sv-a"><button type="button" class="btn btn-ghost sm" data-svo>Apply</button><button type="button" class="btn btn-ghost sm" data-svd aria-label="Delete">🗑️</button></div></div>`).join('') : '<p class="ds-hint">No saved designs yet.</p>';
    } catch (e) { box.innerHTML = `<p class="ds-hint">${esc(e.message)}</p>`; }
  }
  async function applySaved(id) { try { const r = await api('/api/designs/' + id); applyDesign(r.design); toast('Design applied: ' + r.name); } catch (e) { toast(e.message); } }
  async function delSaved(id) { if (!confirm('Delete this saved design?')) return; try { await api('/api/designs/' + id, { method: 'DELETE' }); listSaved(); } catch (e) { toast(e.message); } }
  $('#svSave').onclick = async () => {
    if (!QRX.token()) return toast('Log in to save designs to your account');
    const name = $('#svName').value.trim(); if (!name) return toast('Name your design first');
    const o = serial(); if (JSON.stringify(o).length > 340000) return toast('This design is too large to save. Use a smaller logo or background image.');
    try { const r = await api('/api/designs', { method: 'POST', body: { name, design: o } }); toast(r.replaced ? 'Design updated' : 'Design saved ✨'); listSaved(); } catch (e) { toast(e.message); }
  };
  $('#svExp').onclick = () => QRX.save(new Blob([JSON.stringify(serial(), null, 1)], { type: 'application/json' }), 'qrnova-design.json');
  $('#svImpBtn').onclick = () => $('#svImp').click();
  async function onImport(el) {
    const f = el.files[0]; el.value = ''; if (!f) return;
    try { if (f.size > 4e6) throw new Error('File is too large'); applyDesign(JSON.parse(await f.text())); toast('Design imported'); } catch (e) { toast('Could not import: ' + (e.message || 'invalid file')); }
  }
  $('#svReset').onclick = () => { applyDesign(null); toast('Design reset'); };

    /* ═══════════ save to My QR Codes (Part 6) ═══════════ */
  let editId = null, savedTitle = '';
  const kindOf = (s) => (/^https?:\/\//i.test(s) ? 'url' : /^WIFI:/i.test(s) ? 'wifi' : /^BEGIN:VCARD/i.test(s) ? 'vcard' : /^BEGIN:VCALENDAR/i.test(s) ? 'event' : /^mailto:/i.test(s) ? 'email' : /^tel:/i.test(s) ? 'phone' : /^(sms|smsto):/i.test(s) ? 'sms' : /^upi:\/\//i.test(s) ? 'upi' : /^geo:/i.test(s) ? 'location' : 'text');
  $('#dsSaveQr').onclick = wrap(async () => {
    if (!rows) return;
    if (!QRX.token()) { toast('Log in to save QR codes'); setTimeout(() => { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); }, 900); return; }
    const o = serial(); if (JSON.stringify(o).length > 340000) return toast('This design is too large to save. Use a smaller logo or background image.');
    let title = savedTitle;
    if (!editId) { title = (window.prompt('Name this QR code', D.data.replace(/\s+/g, ' ').slice(0, 40)) || '').trim(); if (!title) return; }
    const r = editId ? await api(`/api/qr/${editId}/static`, { method: 'PUT', body: { payload: D.data, design: o, title } }) : await api('/api/qr/static', { method: 'POST', body: { type: kindOf(D.data), title, payload: D.data, design: o } });
    toast(editId ? 'Saved changes ✨' : 'Saved to My QR Codes ✨'); editId = r.id; savedTitle = r.title; $('#dsSaveQr').textContent = '💾 Update saved QR';
  });
  (async () => {
    const id = new URLSearchParams(location.search).get('qr'); if (!id || !QRX.token()) return;
    try {
      const r = await api('/api/qr/' + encodeURIComponent(id)); if (r.source !== 'static') return;
      editId = r.id; savedTitle = r.title; if (r.design) applyDesign(r.design);
      D.data = r.payload; changed('data'); $('#dsSaveQr').textContent = '💾 Update saved QR'; toast('Editing “' + r.title + '”');
    } catch (e) { toast(e.message); }
  })();
  renderStops('fg'); renderStops('bg.grad'); renderEcl(); refreshControls(); schedMatrix(); schedEcl(); listSaved();

})();
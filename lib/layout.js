const { esc } = require('./util');

const CREATE = [
  ['/qr-generator', '⚡', 'QR Generator', '16 QR types with live preview'],
  ['/ai-qr', '🤖', 'AI QR Studio', 'Describe it in plain English'],
  ['/design-studio', '🎨', 'Design Studio', 'Brand, frame and print layouts'],
  ['/file-to-qr', '☁️', 'File → QR', 'PDF, image, video, audio'],
];
const MORE = [['/#how', 'How it works'], ['/faq', 'FAQ'], ['/blog', 'Blog'], ['/about', 'About us'], ['/contact', 'Contact']];
const FOOT = {
  Product: [['/qr-generator', 'QR Generator'], ['/design-studio', 'Design Studio'], ['/file-to-qr', 'File to QR'], ['/ai-qr', 'AI QR Studio'], ['/templates', 'Templates'], ['/features', 'Features'], ['/pricing', 'Pricing']],
  Company: [['/about', 'About'], ['/blog', 'Blog'], ['/faq', 'FAQ'], ['/contact', 'Contact']],
  Legal: [['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/security', 'Security'], ['/cookies', 'Cookies']],
};
const LOGO = `<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset=".6" stop-color="#22d3ee"/><stop offset="1" stop-color="#ff5ea8"/></linearGradient></defs><rect width="40" height="40" rx="11" fill="url(#lg)"/><g fill="#fff"><rect x="8" y="8" width="9" height="9" rx="2.5"/><rect x="23" y="8" width="9" height="9" rx="2.5"/><rect x="8" y="23" width="9" height="9" rx="2.5"/><rect x="23" y="23" width="4" height="4" rx="1.2"/><rect x="28" y="28" width="4" height="4" rx="1.2"/></g></svg>`;
const FAV = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#7c5cff"/><g fill="#fff"><rect x="8" y="8" width="9" height="9" rx="2.5"/><rect x="23" y="8" width="9" height="9" rx="2.5"/><rect x="8" y="23" width="9" height="9" rx="2.5"/><rect x="23" y="23" width="9" height="9" rx="2.5"/></g></svg>');

function renderPage(p, path = '/') {
  const B = require('./settings').get().brand;
  const BN = B.name === 'QRNova' ? 'QR<b>Nova</b>' : esc(B.name);
  const BL = B.logo ? `<img class="blogo" src="${esc(B.logo)}" alt="" width="34" height="34">` : LOGO;
  const BS = B.primary !== '#7c5cff' || B.accent !== '#22d3ee' || B.highlight !== '#ff5ea8'
    ? `<style>:root{--p:${B.primary};--c:${B.accent};--k:${B.highlight};--g:linear-gradient(120deg,${B.primary},${B.accent} 55%,${B.highlight})}</style>` : '';

  const cls = (h) => (h === path ? ' class="act"' : '');
  const link = ([h, l]) => `<a href="${h}"${cls(h)}>${l}</a>`;
  const guestLinks = [['/features', 'Features'], ['/templates', 'Templates'], ['/pricing', 'Pricing']].map(link).join('');
  const userLinks = [['/dashboard', 'Dashboard'], ['/my-qr-codes', 'My QR codes'], ['/analytics', 'Analytics']].map(link).join('');
  const createItems = CREATE.map(([h, i, t, d]) => `<a role="menuitem" href="${h}"${cls(h)}><span class="dd-i" aria-hidden="true">${i}</span><span><b>${t}</b><small>${d}</small></span></a>`).join('');
  const moreItems = MORE.map(([h, l]) => `<a role="menuitem" href="${h}"${cls(h)}><span><b>${l}</b></span></a>`).join('');
  const dd = (label, items, on, wide) => `<div class="dd${on ? ' act' : ''}"><button type="button" class="dd-b" aria-haspopup="true" aria-expanded="false">${label}<i class="car" aria-hidden="true"></i></button><div class="dd-m${wide ? ' dd-wide' : ''}" role="menu" aria-label="${label}">${items}</div></div>`;

  const foot = Object.entries(FOOT).map(([t, ls]) => `<div><h4>${t}</h4>${ls.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</div>`).join('');
  const scripts = ['/js/core.js', '/js/ui.js', ...(p.scripts || [])].map((s) => `<script src="${s}" defer></script>`).join('');
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc || B.tagline)}">
<meta name="theme-color" content="#07071a">
<link rel="icon" href="${FAV}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">${BS}
<script>try{var t=localStorage.getItem('qrn_theme')||'dark';if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t;if(localStorage.getItem('qrn_token'))document.documentElement.classList.add('authed')}catch(e){}</script>
<noscript><style>.reveal{opacity:1!important;transform:none!important}</style></noscript>
</head>
<body class="${p.cls || ''}">
<div class="aurora" aria-hidden="true"><i style="left:-10%;top:-15%;background:${B.primary}"></i><i style="right:-15%;top:10%;background:${B.accent};animation-delay:-8s"></i><i style="left:25%;bottom:-30%;background:${B.highlight};animation-delay:-14s"></i></div>
<canvas id="bg" aria-hidden="true"></canvas>
<header class="hdr tb" id="hdr"><div class="container hdr-in tb-in">
  <a class="brand" href="/" aria-label="${esc(B.name)} home">${BL}<span>${BN}</span></a>
  <nav class="tbn" id="nav" aria-label="Main">
    <div class="tbg is-in">${userLinks}</div>
    <div class="tbg is-out">${guestLinks}</div>
    ${dd('Create', createItems, CREATE.some((c) => c[0] === path), true)}
    ${dd('More', moreItems, MORE.some((c) => c[0] === path), false)}
    <div class="tbm is-in"><span class="tbm-h">Your account</span><a href="/my-files">My files</a><a href="/account">Account settings</a><a href="/admin" data-staff hidden>Admin panel</a><a href="#" data-logout>Log out</a></div>
    <div class="tbm is-out"><a class="btn btn-ghost" href="/login">Log in</a><a class="btn btn-primary" href="/signup">Sign up free</a></div>
  </nav>
  <div class="hdr-r tb-r">
    <button class="icon-btn" id="theme" type="button" aria-label="Theme"><span aria-hidden="true">🌓</span></button>
    <div class="tb-d is-out"><a class="btn btn-ghost sm" href="/login">Log in</a><a class="btn btn-primary sm" href="/signup">Sign up</a></div>
    <button class="burger" id="burger" type="button" aria-label="Menu"><i></i><i></i><i></i></button>
  </div>
</div></header>
<main>${p.body}</main>
<footer class="ftr"><div class="container">
  <div class="ft-grid">
    <div><a class="brand" href="/">${BL}<span>${BN}</span></a><p class="mut">${esc(B.tagline)}<br>${B.footer ? esc(B.footer) : 'Static &amp; dynamic QR codes with zero API keys.'}</p></div>
    ${foot}
  </div>
  <div class="ft-bot"><span>© <span id="yr">2026</span> ${esc(B.name)}. All rights reserved.</span><span class="mut">Standard ISO/IEC 18004 QR codes</span></div>
</div></footer>
<div class="toast" id="toast" role="status"></div>
<div class="cookie" id="cookie"><span>🍪 We use only essential storage (login &amp; theme). <a href="/cookies">Learn more</a></span><button class="btn btn-primary sm" id="cookieOk">Got it</button></div>
<script>try{var u=JSON.parse(localStorage.getItem('qrn_user')||'null');if(u&&u.role&&u.role!=='user'){document.querySelectorAll('[data-staff]').forEach(function(e){e.hidden=false})}}catch(e){}</script>
${scripts}
</body></html>`;
}
module.exports = { renderPage };
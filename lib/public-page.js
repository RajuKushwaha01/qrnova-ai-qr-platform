'use strict';
const { esc, safeHttp } = require('./util');
const kit = require('./brandkit');

const btn = (href, ic, label, main) => (href ? `<a class="b${main ? ' main' : ''}" href="${esc(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${ic} ${esc(label)}</a>` : '');
const ext = (f) => (String(f || '').split('.').pop() || '').toLowerCase();
const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const ICON = { menu: '🍽️', product: '📦', business: '🏢', restaurant: '🍽️', hotel: '🏨', event: '🎉' };

function preview(file) {
  if (!file) return '';
  const e = ext(file), f = esc(file);
  if (IMG.includes(e)) return `<img class="pv" src="${f}" alt="">`;
  if (e === 'pdf') return `<iframe class="pv pdf" src="${f}"></iframe>`;
  if (['mp4', 'webm', 'mov'].includes(e)) return `<video class="pv" src="${f}" controls playsinline></video>`;
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(e)) return `<audio src="${f}" controls></audio>`;
  return '';
}

exports.page = (q) => {
  const d = q.data || {}, name = d.name || q.title, sub = d.desc || d.tagline || '';
  const phone = String(d.phone || '').replace(/[^\d+]/g, '');
  const maps = safeHttp(d.maps) || (d.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d.address) : '');
  const mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '') ? 'mailto:' + d.email : '';
  const e = ext(q.file), isImg = IMG.includes(e), logo = q.type === 'business' && isImg;
  const head = logo ? `<img class="logo" src="${esc(q.file)}" alt="">` : `<div class="ic">${ICON[q.type] || '✨'}</div>`;
  const fileBtn = q.file && !isImg ? btn(q.file, '📄', e === 'pdf' ? (q.type === 'menu' ? 'Open menu (PDF)' : 'Open PDF') : 'Open file', 1) : '';
  const meta = [d.company && 'by ' + d.company, d.pid && 'ID: ' + d.pid].filter(Boolean).join(' · ');
  const inner = `${kit.bar()}<section class="card">${head}<h1>${esc(name)}</h1>${meta ? `<p class="meta">${esc(meta)}</p>` : ''}${sub ? `<p class="tag">${esc(sub)}</p>` : ''}
${d.price ? `<div class="price">${esc(d.price)}</div>` : ''}${d.address ? `<p class="addr">📍 ${esc(d.address)}</p>` : ''}${logo ? '' : preview(q.file)}
${d.hours ? `<div class="hours"><b>🕒 Opening hours</b><pre>${esc(d.hours)}</pre></div>` : ''}
<div class="btns">${btn(safeHttp(d.buy), '🛒', 'Buy now', 1)}${btn(safeHttp(d.menu), '🍽️', 'View menu', 1)}${fileBtn}${btn(phone && 'tel:' + phone, '📞', 'Call ' + (d.phone || ''))}${btn(mail, '✉️', 'Email')}${btn(safeHttp(d.website), '🌐', 'Website')}${btn(maps, '📍', 'Directions')}${btn(safeHttp(d.social), '💬', 'Social')}${btn(safeHttp(d.review), '⭐', 'Leave a review')}${kit.shareBlock()}</div></section>${kit.powered(true)}`;
  return kit.doc(name, inner, kit.script(), { narrow: true });
};

exports.file = (q) => {
  const e = ext(q.file), canOpen = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov'].includes(e);
  const inner = `${kit.bar()}<section class="card"><div class="ic">📎</div><h1>${esc(q.title)}</h1><p class="tag">${esc(q.fileName || '')}</p>${preview(q.file)}
<div class="btns">${canOpen ? btn(q.file, '↗', 'Open', 1) : ''}${btn(q.file, '⬇️', 'Download', !canOpen)}${kit.shareBlock()}</div></section>${kit.powered(true)}`;
  return kit.doc(q.title, inner, kit.script(), { narrow: true });
};
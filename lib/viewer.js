'use strict';
const { esc: e } = require('./util');
const kit = require('./brandkit');

const fmt = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.ceil(b / 1024) + ' KB' : b + ' B');
const DOCI = { doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📽️', pptx: '📽️', txt: '📃' };
const CI = { image: '🖼️', pdf: '📄', video: '🎬', audio: '🎵', document: '📁' };

const N = {
  notfound: ['🔍', 'Not found', 'This link is invalid, or the content was deleted by its owner.'],
  archived: ['🗃️', 'Archived', 'The owner has archived this content, so it is no longer available.'],
  expired: ['⏳', 'This link has expired', 'The owner set this content to expire. Ask them for a new link.'],
  suspended: ['🚫', 'Temporarily unavailable', 'This content was disabled while it is reviewed.'],
  private: ['🔒', 'Private', 'Only the owner can open this.'],
  inactive: ['⏸️', 'Currently inactive', 'The owner has switched this QR code off for now.'],
  restricted: ['🚧', 'Access restricted', 'This QR code is limited to certain devices or times.'],
  limit: ['📵', 'Scan limit reached', 'This QR code has reached the number of scans its owner allowed.'],
};

exports.notice = (kind) => {
  const n = N[kind] || N.notfound;
  return kit.doc(n[1], `${kit.bar()}<section class="card"><div class="ic">${n[0]}</div><h1>${n[1]}</h1><p class="sub">${n[2]}</p><div class="btns"><a class="b main" href="/">Go to ${e(kit.name())}</a></div></section>${kit.powered(false)}`, '', { narrow: true });
};

exports.password = () => kit.doc('Password required', `${kit.bar()}<section class="card"><div class="ic">🔑</div><h1>Password required</h1><p class="sub">The owner protected this content. Enter the password to continue.</p>
<form id="pf"><input class="pw" name="pw" type="password" placeholder="Password" autocomplete="current-password" required autofocus><p class="err" id="msg"></p><div class="btns"><button class="b main" type="submit">Unlock</button></div></form></section>${kit.powered(false)}`,
`<script>(function(){var f=document.getElementById('pf'),m=document.getElementById('msg');f.onsubmit=function(ev){ev.preventDefault();m.textContent='';fetch(location.pathname+'/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:f.pw.value})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok)location.reload();else m.textContent=x.j.error||'Incorrect password'}).catch(function(){m.textContent='Network error — try again'})}})()</script>`, { narrow: true });

// hosted file page: brand logo · name · preview · Open · Download · Share · Powered by
exports.page = (f, c) => {
  const raw = e(c.raw), ico = DOCI[f.ext] || CI[f.cat] || '📁';
  let media;
  if (f.cat === 'image') media = `<img class="pv" id="img" src="${raw}" alt="${e(f.title)}">`;
  else if (f.cat === 'pdf') media = `<iframe class="pv pdf" src="${raw}#view=FitH" title="${e(f.title)}"></iframe><p class="hint">PDF not showing on your phone? Tap “Open”.</p>`;
  else if (f.cat === 'video') media = `<video class="pv" src="${raw}" controls playsinline preload="metadata"></video>`;
  else if (f.cat === 'audio') media = `<div class="aud" id="aud"><div class="eq">${'<i></i>'.repeat(22)}</div><audio id="au" src="${raw}" controls preload="metadata"></audio></div>`;
  else if (f.ext === 'txt') media = `<pre class="txt">${e(c.text || '')}</pre>${c.more ? '<p class="hint">Preview truncated — download for the full file.</p>' : ''}`;
  else media = `<div class="docbox"><span>${ico}</span><b>${e(f.ext.toUpperCase())} document</b><p>Preview isn’t available for this format.${c.dl ? ' Download it to open on your device.' : ''}</p></div>`;
  const btns = [];
  if (['image', 'pdf', 'video'].includes(f.cat)) btns.push(`<a class="b main" href="${raw}" target="_blank" rel="noopener">↗ Open</a>`);
  if (c.dl) btns.push(`<a class="b${btns.length ? '' : ' main'}" href="${e(c.dlUrl)}">⬇️ Download</a>`);
  btns.push(kit.shareBlock());
  const exp = f.expires ? `<p class="meta">⏳ Link expires <time data-t="${f.expires}"></time></p>` : '';
  const inner = `${kit.bar()}<section class="card"><div class="ic">${ico}</div><h1>${e(f.title)}</h1>
<p class="meta">${e(f.name)} · ${fmt(f.size)}<span class="x">${e(f.ext.toUpperCase())}</span></p>${exp}${media}
<div class="btns">${btns.join('')}</div>${!c.dl && !['image', 'pdf', 'video', 'audio'].includes(f.cat) && f.ext !== 'txt' ? '<p class="hint">The owner disabled downloads for this file.</p>' : ''}</section>${kit.powered(true)}`;
  const extra = `var tm=document.querySelectorAll('time[data-t]');for(var i=0;i<tm.length;i++){tm[i].textContent=new Date(+tm[i].dataset.t).toLocaleString()}var im=document.getElementById('img');if(im)im.onclick=function(){document.body.classList.toggle('zoomed')};var au=document.getElementById('au'),bx=document.getElementById('aud');if(au&&bx){au.onplay=function(){bx.classList.add('on')};au.onpause=au.onended=function(){bx.classList.remove('on')}}`;
  return kit.doc(f.title, inner, kit.script(extra));
};

// public share page for a QR code (/s/<code>)
exports.share = (d) => kit.doc(d.title, `${kit.bar()}<section class="card"><div class="ic">▦</div><h1>${e(d.title)}</h1><p class="sub">Scan with your phone camera${d.host ? ' to open ' + e(d.host) : ''}</p>
<div class="qrbox">${d.svg}</div><div class="btns"><a class="b main" href="${e(d.url)}" target="_blank" rel="noopener">↗ Open</a><a class="b" href="${e(d.png)}">⬇️ PNG</a><a class="b" href="${e(d.svgUrl)}">⬇️ SVG</a>${kit.shareBlock()}</div></section>${kit.powered(false)}`, kit.script(), { narrow: true });
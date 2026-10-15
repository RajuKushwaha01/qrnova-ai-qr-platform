'use strict';
const { esc } = require('./util');
const cfg = () => require('./settings').get();

const CSS = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:#eef0ff;min-height:100vh;background:radial-gradient(900px 500px at 10% -10%,color-mix(in srgb,var(--bp) 70%,#000) 0,transparent 60%),radial-gradient(800px 500px at 100% 10%,color-mix(in srgb,var(--bc) 50%,#000) 0,transparent 55%),#07071a;display:grid;place-items:start center;padding:24px 14px}
.wrap{width:min(720px,100%);animation:up .7s both}.wrap.n{width:min(480px,100%)}@keyframes up{from{opacity:0;transform:translateY(24px)}}
.bk{display:inline-flex;align-items:center;gap:.6rem;color:#fff;text-decoration:none;margin:0 0 .9rem .3rem}.bk b{font-family:'Space Grotesk',Inter,sans-serif;font-size:1.05rem}
.bk-i{width:36px;height:36px;border-radius:11px;object-fit:cover;display:grid;place-items:center;font:700 1rem 'Space Grotesk',sans-serif;color:#fff;background:linear-gradient(135deg,var(--bp),var(--bc))}img.bk-i{background:#fff}
.card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:26px 22px;backdrop-filter:blur(18px);text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.ic{width:84px;height:84px;margin:0 auto 14px;border-radius:26px;display:grid;place-items:center;font-size:2.4rem;background:linear-gradient(135deg,var(--bp),var(--bc) 60%,var(--bk))}
.logo{width:96px;height:96px;margin:0 auto 14px;border-radius:28px;object-fit:cover;border:2px solid rgba(255,255,255,.25);background:#fff;display:block}
h1{font-family:'Space Grotesk',Inter,sans-serif;font-size:1.6rem;letter-spacing:-.02em;word-break:break-word}
.sub,.tag{color:#b6bbe6;margin:.5rem 0 1rem;white-space:pre-line}.meta{color:#9aa0d6;font-size:.88rem;margin:.5rem 0}
.x{display:inline-block;padding:.12rem .6rem;border-radius:99px;background:rgba(34,211,238,.15);color:#67e8f9;font-weight:700;font-size:.74rem;margin-left:.4rem}
.price{display:inline-block;background:rgba(34,211,238,.15);color:#67e8f9;padding:.3rem .9rem;border-radius:99px;font-weight:600;margin-bottom:1rem}.addr{color:#b6bbe6;font-size:.92rem;margin-bottom:1rem}
.hours{text-align:left;margin:1rem 0 0;padding:.9rem 1rem;border-radius:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}.hours b{display:block;margin-bottom:.3rem}.hours pre{white-space:pre-wrap;font-family:inherit;color:#d9dcff;font-size:.92rem}
.pv{width:100%;border-radius:18px;margin-top:1.1rem;border:0;background:#000;display:block}img.pv{max-height:70vh;object-fit:contain;cursor:zoom-in}iframe.pdf{height:70vh;min-height:420px;background:#fff}
.zoomed #img{position:fixed;inset:0;width:100vw;height:100vh;max-height:none;border-radius:0;z-index:9;cursor:zoom-out}
.txt{text-align:left;white-space:pre-wrap;word-break:break-word;margin-top:1.1rem;padding:1rem;border-radius:16px;background:rgba(0,0,0,.3);max-height:60vh;overflow:auto;font-size:.88rem;color:#d9dcff}
.docbox{margin-top:1.1rem;padding:1.6rem 1rem;border-radius:20px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.2)}.docbox span{font-size:3rem;display:block}.docbox p{color:#b6bbe6;font-size:.9rem;margin-top:.4rem}
.aud{margin-top:1.1rem;padding:1.4rem 1rem;border-radius:20px;background:rgba(255,255,255,.06)}audio{width:100%;margin-top:1rem}
.eq{display:flex;align-items:flex-end;justify-content:center;gap:4px;height:84px;margin-bottom:1rem}.eq i{width:6px;height:12%;border-radius:4px;background:linear-gradient(var(--bc),var(--bp))}
.aud.on .eq i{animation:eq .9s ease-in-out infinite}.eq i:nth-child(3n){animation-duration:.7s!important}.eq i:nth-child(3n+1){animation-duration:1.2s!important;animation-delay:.15s!important}.eq i:nth-child(5n){animation-delay:.3s!important}@keyframes eq{0%,100%{height:12%}50%{height:95%}}
.btns{display:grid;gap:.7rem;margin-top:1.2rem;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.wrap.n .btns{grid-template-columns:1fr}
.b{display:block;padding:.9rem 1rem;border-radius:16px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14);color:#fff;text-decoration:none;font:inherit;font-weight:600;cursor:pointer;transition:.25s;text-align:center}
.b:hover{transform:translateY(-3px);background:linear-gradient(120deg,var(--bp),var(--bc));border-color:transparent}.b.main{background:linear-gradient(120deg,var(--bp),var(--bc) 60%,var(--bk));border-color:transparent}
.shr{grid-column:1/-1}.shp{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.5rem;margin-top:.7rem}.shp[hidden]{display:none}
.shp a,.shp button{padding:.7rem .6rem;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#fff;text-decoration:none;font:inherit;font-size:.9rem;cursor:pointer;transition:.2s}.shp a:hover,.shp button:hover{background:rgba(255,255,255,.18)}
.qrbox{background:#fff;border-radius:22px;padding:14px;margin:1rem auto;max-width:360px}.qrbox svg{display:block;width:100%;height:auto}
.hint{color:#9aa0d6;font-size:.82rem;margin-top:.7rem}.err{color:#ff8da1;min-height:1.2rem;margin-top:.6rem;font-size:.9rem}
input.pw{width:100%;margin-top:1.2rem;padding:.9rem 1rem;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font:inherit;outline:none}input.pw:focus{border-color:var(--bp);box-shadow:0 0 0 4px rgba(124,92,255,.25)}
.by{text-align:center;color:#8f95c4;font-size:.8rem;margin-top:18px}.by a,.by button{color:#67e8f9;text-decoration:none;background:none;border:0;font:inherit;cursor:pointer}`;

const name = () => cfg().brand.name;

exports.name = name;
exports.doc = (title, inner, script, o) => {
  const B = cfg().brand;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#07071a"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body style="--bp:${B.primary};--bc:${B.accent};--bk:${B.highlight}"><main class="wrap${o && o.narrow ? ' n' : ''}">${inner}</main>${script || ''}</body></html>`;
};
exports.bar = () => {
  const B = cfg().brand;
  const mark = B.logo ? `<img class="bk-i" src="${esc(B.logo)}" alt="">` : `<span class="bk-i">${esc(B.name.slice(0, 1).toUpperCase())}</span>`;
  return `<a class="bk" href="/">${mark}<b>${esc(B.name)}</b></a>`;
};
exports.powered = (report) => `<p class="by">Powered by <a href="/">${esc(name())}</a>${report ? ' · <button type="button" id="rep">Report</button>' : ''}</p>`;
exports.shareBlock = () => `<div class="shr"><button type="button" class="b" id="shb" style="width:100%">🔗 Share</button><div class="shp" id="shp" hidden>${[['wa', '🟢 WhatsApp'], ['tg', '✈️ Telegram'], ['x', '𝕏 X'], ['fb', '📘 Facebook'], ['in', '💼 LinkedIn'], ['mail', '✉️ Email']].map(([k, l]) => `<a data-s="${k}" target="_blank" rel="noopener noreferrer">${l}</a>`).join('')}<button type="button" data-s="copy">📋 Copy link</button></div></div>`;
// the share links always use the clean public URL (the ?t= access token is never shared)
exports.script = (extra) => `<script>(function(){
var u=location.origin+location.pathname,t=document.title,e=encodeURIComponent;
var L={wa:'https://wa.me/?text='+e(t+' '+u),tg:'https://t.me/share/url?url='+e(u)+'&text='+e(t),x:'https://twitter.com/intent/tweet?url='+e(u)+'&text='+e(t),fb:'https://www.facebook.com/sharer/sharer.php?u='+e(u),in:'https://www.linkedin.com/sharing/share-offsite/?url='+e(u),mail:'mailto:?subject='+e(t)+'&body='+e(u)};
document.querySelectorAll('[data-s]').forEach(function(a){var k=a.getAttribute('data-s');if(L[k])a.href=L[k]});
var b=document.getElementById('shb'),p=document.getElementById('shp');
if(b)b.onclick=function(){if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});return}p.hidden=!p.hidden};
var c=document.querySelector('[data-s=copy]');if(c)c.onclick=function(){if(navigator.clipboard)navigator.clipboard.writeText(u).then(function(){c.textContent='✅ Copied'})};
var r=document.getElementById('rep');if(r)r.onclick=function(){if(!confirm('Report this page as abusive, illegal or harmful?'))return;fetch(location.pathname+'/report',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(){r.textContent='Thanks — reported'}).catch(function(){})};
${extra || ''}})()</script>`;
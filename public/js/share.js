(() => {
  'use strict';
  const { $, esc, toast, api } = QRX;
  const en = encodeURIComponent;
  let dlg = null, it = null, ctx = null;

  const content = () => (it.source === 'static' ? it.payload : it.url);
  const rowsOf = () => ctx.getRows(content());
  const pngBlob = async (px) => QRX.toBlob(ctx.svgOf(await rowsOf(), it, px, 4), px, px, 'image/png');
  const logShare = (m) => ctx.evt(it, 'shared', m);

  function ensure() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog'); dlg.id = 'dShare2'; dlg.className = 'shx';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', onClick); dlg.addEventListener('change', onChange);
    return dlg;
  }

  async function open(item, c) {
    it = item; ctx = c; ensure();
    const url = it.url, dyn = it.source !== 'static', t = it.title;
    const sn = [['wa', '🟢 WhatsApp', 'https://wa.me/?text=' + en(t + ' ' + url)], ['tg', '✈️ Telegram', 'https://t.me/share/url?url=' + en(url) + '&text=' + en(t)], ['x', '𝕏 X', 'https://twitter.com/intent/tweet?url=' + en(url) + '&text=' + en(t)], ['fb', '📘 Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + en(url)], ['in', '💼 LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + en(url)], ['mail', '✉️ Email', 'mailto:?subject=' + en(t) + '&body=' + en(url)]];
    const mail = ['mail', '✉️ Email', 'mailto:?subject=' + en(t) + '&body=' + en(String(it.payload || '').slice(0, 1500))];
    const send = (dyn ? sn : [mail]).map(([k, l, h]) => `<a class="btn btn-ghost sm" data-ch="${k}" href="${esc(h)}" target="_blank" rel="noopener noreferrer">${l}</a>`).join('');
    dlg.innerHTML = `<div class="card-h"><h3>Share</h3><button class="btn btn-ghost sm" data-x aria-label="Close">✕</button></div>
<div class="shx-top"><div class="shx-qr" id="shQr"></div><div><b>${esc(t)}</b><small>${esc(dyn ? url : 'Static QR code: its data is inside the image')}</small>${dyn && it.access && it.access !== 'public' ? `<small>🔐 This QR is <b>${esc(it.access)}</b>: people need the password or a signed link.</small>` : ''}</div></div>
<h4>QR image</h4><div class="shg"><button type="button" class="btn btn-ghost sm" data-sh="copyqr">📋 Copy QR</button><button type="button" class="btn btn-ghost sm" data-sh="shareqr">📤 Share QR</button><button type="button" class="btn btn-ghost sm" data-sh="png">⬇️ PNG</button><button type="button" class="btn btn-ghost sm" data-sh="svg">⬇️ SVG</button></div>
<h4>${dyn ? 'Link' : 'Content'}</h4><div class="shg"><button type="button" class="btn btn-ghost sm" data-sh="copyurl">📋 Copy ${dyn ? 'URL' : 'content'}</button>${dyn && navigator.share ? '<button type="button" class="btn btn-ghost sm" data-sh="shareurl">📤 Share link</button>' : ''}</div>
<h4>Send via</h4><div class="shg">${send}</div>
${dyn ? `<h4>Public share page</h4><label class="tg chk"><input type="checkbox" id="shPub"> Show this QR code on a public page anyone can open</label><div class="pubbox" id="shPubBox" hidden><div class="row2"><input class="in" id="shPubUrl" readonly><button type="button" class="btn btn-ghost sm" data-sh="pubcopy">Copy</button><a class="btn btn-ghost sm" id="shPubOpen" target="_blank" rel="noopener">Open ↗</a></div></div>
<h4>Expiring link</h4><div class="row2"><select class="in" id="shDur"><option value="60">1 hour</option><option value="1440" selected>24 hours</option><option value="10080">7 days</option><option value="43200">30 days</option></select><button type="button" class="btn btn-primary sm" data-sh="mklink">Create</button></div><small class="fh">A signed link opens the page until it expires, even if the QR is private or password-protected.</small><div id="shOut"></div>` : ''}`;
    dlg.showModal();
    try { $('#shQr').innerHTML = ctx.svgOf(await rowsOf(), it, 200, 1).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"'); } catch (e) { /* ignore */ }
    if (dyn) {
      try { const r = await api(`/api/qr/${it.id}/public-share`); setPub(r.on, r.url); } catch (e) { /* ignore */ }
    }
  }
  function setPub(on, url) {
    const c = $('#shPub'); if (!c) return;
    c.checked = !!on; $('#shPubBox').hidden = !on; $('#shPubUrl').value = url || ''; $('#shPubOpen').href = url || '#';
  }
  async function onChange(e) {
    if (e.target.id !== 'shPub') return;
    try { const r = await api(`/api/qr/${it.id}/public-share`, { method: 'POST', body: { on: e.target.checked } }); setPub(r.on, r.url); toast(r.on ? 'Public share page is on' : 'Public share page is off'); if (r.on) logShare('public page'); }
    catch (err) { e.target.checked = !e.target.checked; toast(err.message); }
  }
  async function onClick(e) {
    if (e.target.closest('[data-x]')) return dlg.close();
    const a = e.target.closest('[data-ch]'); if (a) { logShare(a.dataset.ch); return; }
    const b = e.target.closest('[data-sh]'); if (!b) return;
    try {
      switch (b.dataset.sh) {
        case 'copyurl': await navigator.clipboard.writeText(content()); toast('Copied'); logShare('copied ' + (it.url ? 'link' : 'content')); break;
        case 'pubcopy': await navigator.clipboard.writeText($('#shPubUrl').value); toast('Copied'); logShare('copied public page'); break;
        case 'shareurl': await navigator.share({ title: it.title, url: it.url }); logShare('share sheet'); break;
        case 'copyqr': {
          const blob = await pngBlob(1024);
          if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('QR image copied'); logShare('copied QR image'); }
          else { QRX.save(blob, 'qrnova.png'); toast('This browser can’t copy images. Downloaded instead'); ctx.evt(it, 'downloaded', 'PNG'); }
          break;
        }
        case 'shareqr': {
          const blob = await pngBlob(1024), f = new File([blob], 'qrnova.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: it.title }); logShare('QR image'); }
          else { QRX.save(blob, 'qrnova.png'); toast('Sharing files isn’t supported here. Downloaded instead'); ctx.evt(it, 'downloaded', 'PNG'); }
          break;
        }
        case 'png': QRX.save(await pngBlob(1024), `qrnova-${it.code}.png`); ctx.evt(it, 'downloaded', 'PNG'); break;
        case 'svg': QRX.save(new Blob([ctx.svgOf(await rowsOf(), it, 1024, 4)], { type: 'image/svg+xml' }), `qrnova-${it.code}.svg`); ctx.evt(it, 'downloaded', 'SVG'); break;
        case 'mklink': {
          const r = await api(`/api/qr/${it.id}/share-link`, { method: 'POST', body: { minutes: +$('#shDur').value } });
          $('#shOut').innerHTML = `<div class="fld" style="margin-top:.6rem"><label>Valid until ${esc(new Date(r.expires).toLocaleString())}</label><div class="row2"><input class="in" id="shSigned" readonly value="${esc(r.url)}"><button type="button" class="btn btn-ghost sm" data-sh="copysigned">Copy</button></div></div>`;
          break;
        }
        case 'copysigned': await navigator.clipboard.writeText($('#shSigned').value); toast('Link copied'); logShare('expiring link'); break;
      }
    } catch (err) { if (err && err.name !== 'AbortError') toast(err.message || 'Could not share'); }
  }
  window.QRShare = { open };
})();
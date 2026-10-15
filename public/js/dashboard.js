(() => {
  'use strict';
  const { $, esc, toast, api } = QRX;
  if (!$('#dsh')) return;
  if (!QRX.token()) { location.href = '/login?next=/dashboard'; return; }
  const TZ = -new Date().getTimezoneOffset();
  $('#dCards').innerHTML = QRX.skeleton(5, 'stat');
  const EVI = { created: '✨', updated: '✏️', downloaded: '⬇️', shared: '🔗', scanned: '📲', deleted: '🗑️' };
  const EVW = { created: 'Created', updated: 'Updated', downloaded: 'Downloaded', shared: 'Shared', scanned: 'Scanned', deleted: 'Deleted' };
  const DI = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧', Other: '🌐' };
  const ago = (t) => { const d = (Date.now() - t) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : d < 10080 ? Math.round(d / 1440) + ' d ago' : new Date(t).toLocaleDateString(); };
  const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now();
    (function s(t) { const p = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(s); })(t0);
  }
  function chart(s) {
    const n = s.counts.length, W = 640, H = 200, px = 30, py = 26, max = Math.max(1, ...s.counts);
    const x = (i) => px + (i * (W - 2 * px)) / (n - 1), y = (v) => H - py - (v / max) * (H - 2 * py);
    const line = s.counts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    const area = line + `L${x(n - 1).toFixed(1)} ${H - py}L${x(0).toFixed(1)} ${H - py}Z`;
    const grid = [0, 0.5, 1].map((f) => { const yy = y(max * f); return `<line class="gl" x1="${px}" x2="${W - px}" y1="${yy}" y2="${yy}"/><text x="${px - 6}" y="${yy + 3}" text-anchor="end">${Math.round(max * f)}</text>`; }).join('');
    const lbl = s.labels.map((d, i) => ((n - 1 - i) % 3 === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${dayLabel(d)}</text>` : '')).join('');
    const dots = s.counts.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.6" fill="#22d3ee"><title>${dayLabel(s.labels[i])}: ${v} scan${v === 1 ? '' : 's'}</title></circle>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scans per day, last ${n} days"><defs><linearGradient id="dgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c5cff" stop-opacity=".55"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient><linearGradient id="dgL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#dgA)"/><path class="ln" pathLength="1000" d="${line}" fill="none" stroke="url(#dgL)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${lbl}</svg>`;
  }

  (async () => {
    try {
      const [me, ov, act] = await Promise.all([api('/api/auth/me'), api('/api/qr/overview?tz=' + TZ), api('/api/qr/activity?limit=8')]);
      const u = me.user, c = ov.cards;
      $('#hello').textContent = `Welcome back, ${u.name}`;
      $('#vBan').hidden = u.verified;
      if (c.expiring) { const b = $('#expBan'); b.hidden = false; b.innerHTML = `⏳ <b>${c.expiring}</b> QR code${c.expiring > 1 ? 's' : ''} will expire within 7 days. <a class="lnk" href="/my-qr-codes">Review them →</a>`; }

      $('#dCards').innerHTML = [['▦', 'Total QR Codes', c.total], ['✅', 'Active QR Codes', c.active], ['🔄', 'Dynamic QR Codes', c.dynamic], ['📲', 'Total Scans', c.scans], ['📁', 'Files', c.files]]
        .map(([i, l, v], n) => `<div class="dcard" style="--i:${n}"><span class="dc-i">${i}</span><b data-count="${v}">0</b><span>${l}</span></div>`).join('');
      document.querySelectorAll('#dCards [data-count]').forEach(countUp);

      const s = ov.series, total = s.counts.reduce((a, b) => a + b, 0);
      $('#scanTot').textContent = total + ' scans';
      $('#dChart').innerHTML = total ? chart(s) : '<p class="hint">No scans yet. Print or share a dynamic QR code and its scans appear here.</p>';

      const dev = Object.entries(ov.devices).sort((a, b) => b[1] - a[1]), dt = dev.reduce((a, b) => a + b[1], 0);
      $('#dDev').innerHTML = dev.length ? dev.map(([k, v]) => `<div class="hb"><span>${DI[k] || '🌐'} ${esc(k)}</span><div class="tr"><i style="--w:${Math.round((v / dt) * 100)}%"></i></div><b>${Math.round((v / dt) * 100)}%</b></div>`).join('') : '<p class="hint">Device data appears after your first scans.</p>';

      $('#dTop').innerHTML = ov.top.length ? ov.top.map((t, i) => `<div class="hb"><span>${i + 1}. ${esc(t.title.slice(0, 22))}</span><div class="tr"><i style="--w:${Math.round((t.scans / ov.top[0].scans) * 100)}%"></i></div><b>${t.scans}</b></div>`).join('') : '<p class="hint">Your most-scanned QR codes will be ranked here.</p>';
      const pct = Math.min(100, Math.round((ov.storage.used / ov.storage.quota) * 100));
      $('#dMeter').style.width = pct + '%'; $('#dStore').textContent = `${QRX.fmtSize(ov.storage.used)} of ${QRX.fmtSize(ov.storage.quota)} used`;

      $('#dAct').innerHTML = act.items.length ? act.items.map((e) => `<li><span class="ti">${EVI[e.ev] || '•'}</span><div><b>${EVW[e.ev] || e.ev}</b> ${esc(e.title || 'a QR code')}${e.meta && e.ev === 'scanned' ? ` <small class="mut">· ${esc(e.meta)}</small>` : ''}</div><time>${ago(e.t)}</time></li>`).join('') : '<li class="hint">Nothing yet. Create your first QR code and activity shows up here.</li>';
    } catch (e) {
      if (/log in|Account/i.test(e.message)) { location.href = '/login?next=/dashboard'; return; }
      toast(e.message);
    }
  })();
})();
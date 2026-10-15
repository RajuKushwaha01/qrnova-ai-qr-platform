(() => {
  'use strict';
  const { $, $$, esc, toast, api } = QRX;
  const C = QRX.charts;
  if (!$('#an')) return;
  if (!QRX.token()) { location.href = '/login?next=' + encodeURIComponent('/analytics' + location.search); return; }

  const TZ = -new Date().getTimezoneOffset(), en = encodeURIComponent, qs = new URLSearchParams(location.search);
  const S = { id: qs.get('id') || 'all', days: [7, 14, 30, 90, 180, 365].includes(+qs.get('days')) ? +qs.get('days') : 30, gran: 'daily' };
  const n = (v) => Number(v || 0).toLocaleString();
  const when = (t) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const CAT = { mobile: '📱 Mobile', tablet: '📟 Tablet', desktop: '💻 Desktop' };
  let optKey = '';
  $('#anCards').innerHTML = QRX.skeleton(6, 'stat');

  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now();
    (function s(t) { const p = Math.min(1, (t - t0) / 1000); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString(); if (p < 1) requestAnimationFrame(s); })(t0);
  }
  function cards(d) {
    const delta = d.range.prev > 0 ? Math.round(((d.range.total - d.range.prev) / d.range.prev) * 100) : null;
    const rows = [
      ['▦', 'TOTAL SCANS', d.total, 'since the QR was created', ''],
      ['👤', 'UNIQUE SCANS', d.unique, d.uniqueToday ? n(d.uniqueToday) + ' new today' : 'distinct visitors', ''],
      ['☀️', 'TODAY', d.today, 'in your time zone', ''],
      ['📅', 'THIS WEEK', d.week, 'since Monday', ''],
      ['🗓️', 'THIS MONTH', d.month, 'calendar month', ''],
      ['📈', 'LAST ' + d.range.days + ' DAYS', d.range.total, delta == null ? 'no earlier data to compare' : (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '% vs the previous ' + d.range.days + ' days', delta == null ? '' : delta >= 0 ? 'up' : 'dn'],
    ];
    $('#anCards').innerHTML = rows.map(([i, l, v, sub, c], k) => `<div class="acard" style="--i:${k}"><span>${i}</span><small>${l}</small><b data-count="${v}">0</b><em class="${c}">${esc(sub)}</em></div>`).join('');
    $$('#anCards [data-count]').forEach(countUp);
  }
  function trend(d) {
    const g = S.gran, src = g === 'daily' ? d.series : g === 'weekly' ? d.weekly : d.monthly;
    const f = g === 'daily' ? C.fmtD : g === 'weekly' ? (l) => 'Wk ' + C.fmtD(l) : (l) => new Date(l + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    $('#anTrend').innerHTML = src.counts.some((v) => v) ? C.line(src.labels, src.counts, { fmt: f, label: 'Scan trend, ' + g }) : '<p class="hint">No scans in this period.</p>';
  }
  function options(d) {
    const key = d.options.map((o) => o.id).join(',');
    if (key !== optKey) {
      optKey = key;
      $('#anQr').innerHTML = '<option value="all">All QR codes</option>' + d.options.map((o) => `<option value="${esc(o.id)}">${esc(o.title.slice(0, 40))} · ${n(o.scans)}</option>`).join('');
    }
    $('#anQr').value = S.id === 'all' || d.options.some((o) => o.id === S.id) ? S.id : 'all';
  }
  function render(d) {
    options(d);
    const sel = d.options.find((o) => o.id === S.id);
    $('#anSub').textContent = S.id === 'all' ? `All your dynamic QR codes and hosted files (${d.options.length})` : sel ? sel.title : '';
    $('#anEmpty').hidden = d.total > 0;
    cards(d); trend(d);
    $('#anDev').innerHTML = C.donut(Object.entries(d.devices).sort((a, b) => b[1] - a[1]).map(([k, v]) => [(CAT[k] || k).replace(/^\S+\s/, ''), v]), 'Devices');
    $('#anOs').innerHTML = C.hbars(d.os, { pct: true, max: 6 });
    $('#anCal').innerHTML = C.cal(d.series.labels, d.series.counts);
    $('#anHrs').innerHTML = C.hours(d.hours);
    $('#anWk').innerHTML = C.weekdays(d.weekdays);
    $('#anBr').innerHTML = C.hbars(d.browsers, { pct: true, max: 8 });
    $('#anGeo').innerHTML = C.hbars(d.regions, { max: 10, label: (k) => (k === 'Other' ? '🌐 Other' : C.flag(k) + ' ' + esc(C.region(k))), empty: 'Region appears when your CDN or the visitor’s browser language provides it.' }) + '<p class="hint">Approximate: no IP lookup is used.</p>';
    $('#anRef').innerHTML = C.hbars(d.referrers, { max: 8, empty: 'Scans came straight from the camera. Referrers show up when visitors arrive from a website or app that shares one.' });
    const all = S.id === 'all';
    $('#anRecent').innerHTML = `<thead><tr><th>Time</th>${all ? '<th>QR code</th>' : ''}<th>Device</th><th>Browser</th><th>OS</th><th>Region</th><th>Referrer</th></tr></thead><tbody>${d.recent.map((e) => `<tr><td>${when(e.t)}</td>${all ? `<td class="w">${esc(e.title)}</td>` : ''}<td>${CAT[e.c] || '—'}</td><td>${esc(e.b || '—')}</td><td>${esc(e.o || '—')}</td><td>${e.g ? C.flag(e.g) + ' ' + esc(C.region(e.g)) : '—'}</td><td>${esc(e.r || 'Direct')}</td></tr>`).join('') || `<tr><td colspan="${all ? 7 : 6}">No scans yet.</td></tr>`}</tbody>`;
  }

  async function load() {
    try { render(await api(`/api/analytics?id=${en(S.id)}&days=${S.days}&tz=${TZ}`)); }
    catch (e) {
      if (/log in/i.test(e.message)) { location.href = '/login?next=/analytics'; return; }
      if (/not found/i.test(e.message) && S.id !== 'all') { S.id = 'all'; return load(); }
      toast(e.message);
    }
  }
  const url = () => history.replaceState(null, '', '/analytics' + (S.id !== 'all' || S.days !== 30 ? `?id=${en(S.id)}&days=${S.days}` : ''));
  $('#anQr').addEventListener('input', (e) => { S.id = e.target.value; url(); load(); });
  $('#anDays').addEventListener('input', (e) => { S.days = +e.target.value; url(); load(); });
  $('#anDays').value = String(S.days);
  $('#anGran').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    S.gran = b.dataset.g; $$('#anGran button').forEach((x) => x.classList.toggle('on', x === b));
    if (window._anData) trend(window._anData);
  });
  const _render = render; render = (d) => { window._anData = d; _render(d); };
  $('#anCsv').onclick = async () => {
    try {
      const r = await fetch(`/api/analytics/export?id=${en(S.id)}&days=${S.days}&tz=${TZ}`, { headers: { Authorization: 'Bearer ' + QRX.token() } });
      if (!r.ok) throw new Error((await r.json()).error || 'Export failed');
      QRX.save(await r.blob(), 'qrnova-analytics.csv');
    } catch (e) { toast(e.message); }
  };
  setInterval(() => { if (!document.hidden) load(); }, 30000); // live refresh
  load();
})();
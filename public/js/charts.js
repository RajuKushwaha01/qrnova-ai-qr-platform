(() => {
  'use strict';
  const { esc } = QRX;
  const PAL = ['#7c5cff', '#22d3ee', '#ff5ea8', '#fbbf24', '#4ade80', '#fb7185', '#60a5fa', '#a78bfa'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let uid = 0;
  const fmtD = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  QRX.charts = {
    pal: PAL, fmtD,
    flag: (cc) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '🌐'),
    region(cc) { try { return new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(cc) || cc; } catch (e) { return cc; } },

    line(labels, counts, o) {
      o = o || {};
      const N = counts.length, id = 'ln' + ++uid, f = o.fmt || fmtD, W = 640, H = 210, px = 34, py = 28, max = Math.max(1, ...counts);
      if (N < 2) return '<p class="hint">Not enough data yet.</p>';
      const x = (i) => px + (i * (W - 2 * px)) / (N - 1), y = (v) => H - py - (v / max) * (H - 2 * py);
      const line = counts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
      const area = line + `L${x(N - 1).toFixed(1)} ${H - py}L${x(0).toFixed(1)} ${H - py}Z`;
      const grid = [0, 0.5, 1].map((fr) => { const yy = y(max * fr); return `<line class="gl" x1="${px}" x2="${W - px}" y1="${yy}" y2="${yy}"/><text x="${px - 6}" y="${yy + 3}" text-anchor="end">${Math.round(max * fr).toLocaleString()}</text>`; }).join('');
      const step = Math.max(1, Math.ceil(N / 8));
      const lbl = labels.map((l, i) => ((N - 1 - i) % step === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(f(l))}</text>` : '')).join('');
      const dots = N <= 45 ? counts.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.4" fill="#22d3ee"><title>${esc(f(labels[i]))}: ${v} scan${v === 1 ? '' : 's'}</title></circle>`).join('') : '';
      return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Trend')}"><defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c5cff" stop-opacity=".55"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient><linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#${id}a)"/><path class="ln" pathLength="1000" d="${line}" fill="none" stroke="url(#${id}l)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${lbl}</svg>`;
    },

    bars(labels, counts, f) {
      const max = Math.max(1, ...counts); f = f || ((x) => x);
      return `<div class="abars wk bw">${counts.map((v, i) => `<div><i style="height:${Math.max(3, (v / max) * 100)}%" title="${esc(f(labels[i]))}: ${v}"></i><small>${esc(f(labels[i]))}</small></div>`).join('')}</div>`;
    },
    hours(a) {
      const max = Math.max(1, ...a);
      return `<div class="abars hrs">${a.map((v, h) => `<i style="height:${Math.max(3, (v / max) * 100)}%" title="${h}:00 → ${v}"></i>`).join('')}</div><div class="alab"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>`;
    },
    weekdays(a) { return QRX.charts.bars(WD, a); },

    donut(entries, title) {
      const total = entries.reduce((a, e) => a + e[1], 0);
      if (!total) return '<p class="hint">No data yet.</p>';
      const R = 15.9155; let off = 0;
      const segs = entries.map(([k, v], i) => {
        const p = (v / total) * 100;
        const s = `<circle class="dn" r="${R}" cx="21" cy="21" fill="none" stroke="${PAL[i % PAL.length]}" stroke-width="6" stroke-dasharray="${p.toFixed(2)} ${(100 - p).toFixed(2)}" stroke-dashoffset="${(25 - off).toFixed(2)}"><title>${esc(k)}: ${v.toLocaleString()}</title></circle>`;
        off += p; return s;
      }).join('');
      return `<div class="dnw"><svg viewBox="0 0 42 42" class="dnut" role="img" aria-label="${esc(title || 'Breakdown')}"><circle r="${R}" cx="21" cy="21" fill="none" stroke="rgba(127,127,255,.15)" stroke-width="6"/>${segs}</svg><ul class="dlg">${entries.map(([k, v], i) => `<li><i style="background:${PAL[i % PAL.length]}"></i>${esc(k)}<b>${Math.round((v / total) * 100)}%</b></li>`).join('')}</ul></div>`;
    },

    hbars(map, o) {
      o = o || {};
      const all = Object.entries(map || {}), e = all.sort((a, b) => b[1] - a[1]).slice(0, o.max || 8), tot = all.reduce((a, b) => a + b[1], 0);
      if (!e.length) return `<p class="hint">${esc(o.empty || 'No data yet.')}</p>`;
      const top = e[0][1];
      return e.map(([k, v]) => `<div class="hb"><span title="${esc(k)}">${o.label ? o.label(k) : esc(k)}</span><div class="tr"><i style="--w:${Math.max(3, Math.round((v / top) * 100))}%"></i></div><b>${o.pct ? Math.round((v / tot) * 100) + '%' : v.toLocaleString()}</b></div>`).join('');
    },

    cal(labels, counts) {
      const max = Math.max(1, ...counts), lead = (new Date(labels[0] + 'T00:00:00Z').getUTCDay() + 6) % 7;
      return `<div class="cal">${'<b></b>'.repeat(lead)}${counts.map((v, i) => `<i style="--o:${v ? (0.25 + (v / max) * 0.75).toFixed(2) : 0.08}" title="${esc(fmtD(labels[i]))}: ${v} scan${v === 1 ? '' : 's'}"></i>`).join('')}</div><div class="cal-l"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div>`;
    },
  };
})();
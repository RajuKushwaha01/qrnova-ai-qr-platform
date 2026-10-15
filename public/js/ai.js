(() => {
  /* ===================== local "AI" intent engine (no API key) ===================== */
  function analyze(text) {
    const t = String(text || '');
    let rest = t;
    const take = (re) => { const m = rest.match(re); if (m) rest = rest.replace(m[0], ' '); return m; };
    const has = (re) => re.test(t);

    const upi = take(/\b[\w.-]{2,}@(?:upi|ybl|okaxis|oksbi|okhdfcbank|okicici|paytm|apl|axl|ibl|sbi|icici|hdfcbank)\b/i);
    const mail = take(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
    const url = take(/\bhttps?:\/\/[^\s,;]+|\bwww\.[^\s,;]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|io|co|app|dev|ai|me|store|shop|info|xyz)\b(?:\/[^\s,;]*)?/i);
    const geo = take(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
    const ph = take(/(\+?\d[\d\s().-]{8,}\d)/);
    const phone = ph && ph[1].replace(/\D/g, '').length >= 8 ? ph[1].trim() : '';

    const wifiMention = has(/wi-?fi|wireless|ssid/i);
    const ssid = (t.match(/(?:ssid|network name|wi-?fi name|wi-?fi network|network)\s*(?:is|=|:|called|named)?\s*["']?([^\s"',;]+)/i) || [])[1] || '';
    const pass = (t.match(/(?:password|passcode|pass|pwd)\s*(?:is|=|:)?\s*["']?([^\s"',;]+)/i) || [])[1] || '';

    const cat = has(/restaurant|cafe|café|diner|bakery|food|menu/i) ? 'Restaurant'
      : has(/hotel|resort|hostel|rooms?\b/i) ? 'Hotel'
      : has(/resume|\bcv\b/i) ? 'Resume'
      : has(/portfolio/i) ? 'Portfolio'
      : has(/event|party|wedding|conference|meetup|webinar/i) ? 'Event'
      : has(/product|brand/i) ? 'Product'
      : has(/real estate|property|apartment|flat\b/i) ? 'Real estate'
      : has(/clinic|hospital|doctor|health/i) ? 'Healthcare'
      : has(/school|course|class|education|college/i) ? 'Education'
      : has(/shop|store|business|company|office/i) ? 'Business' : '';

    const file = has(/menu/i) && has(/pdf|file|document/i) ? { kind: 'pdf', l: 'Menu PDF', acc: '.pdf' }
      : has(/\bpdf\b/i) ? { kind: 'pdf', l: 'PDF document', acc: '.pdf' }
      : has(/image|photo|picture|poster|flyer/i) ? { kind: 'image', l: 'Image', acc: 'image/*' }
      : has(/video/i) ? { kind: 'video', l: 'Video', acc: 'video/*' }
      : has(/audio|song|podcast/i) ? { kind: 'audio', l: 'Audio', acc: 'audio/*' } : null;

    const P = {
      location: !!geo || has(/location|address|map|directions|located|where/i),
      phone: !!phone || has(/phone|call|mobile|number/i),
      email: !!mail || has(/e-?mail/i),
      website: !!url || has(/website|web ?site|web page|link/i),
      wifi: wifiMention, upi: !!upi || has(/\bupi\b|payment|donat|pay me/i), social: has(/instagram|facebook|twitter|linkedin|youtube|github/i),
    };
    const items = [];
    if (cat) items.push({ k: 'cat', i: '🏷️', l: cat });
    if (file) items.push({ k: 'file', i: '📎', l: file.l });
    if (P.location) items.push({ k: 'address', i: '📍', l: 'Location', v: geo ? `${geo[1]},${geo[2]}` : '' });
    if (P.phone) items.push({ k: 'phone', i: '📞', l: 'Phone', v: phone });
    if (P.email) items.push({ k: 'email', i: '✉️', l: 'Email', v: mail ? mail[0] : '' });
    if (P.website) items.push({ k: 'website', i: '🌐', l: 'Website', v: url ? url[0] : '' });
    if (P.wifi) items.push({ k: 'wifi', i: '📶', l: 'Wi-Fi', v: ssid });
    if (P.upi) items.push({ k: 'upi', i: '💸', l: 'UPI payment', v: upi ? upi[0] : '' });
    if (P.social) items.push({ k: 'social', i: '📱', l: 'Social media' });

    const links = ['location', 'phone', 'email', 'website'].filter((k) => P[k]).length + (file ? 1 : 0);
    let mode, rec;
    if (P.wifi) { mode = 'wifi'; rec = 'Static Wi-Fi QR'; }
    else if (P.upi && !P.website && !cat) { mode = 'upi'; rec = 'Static UPI Payment QR'; }
    else if (cat || links >= 2 || file) { mode = 'page'; rec = 'Dynamic Business QR (Smart Page)'; }
    else if (P.website) { mode = 'url'; rec = 'Dynamic URL QR (editable later)'; }
    else if (P.phone) { mode = 'phone'; rec = 'Static Phone QR'; }
    else if (P.email) { mode = 'email'; rec = 'Static Email QR'; }
    else if (P.location) { mode = geo ? 'geo' : 'address'; rec = 'Static Location QR'; }
    else { mode = 'text'; rec = 'Static Text QR'; }
    if (!items.length) items.push({ k: 'text', i: '📝', l: 'Plain text' });

    return { mode, rec, items, file, v: { name: cat, phone, email: mail ? mail[0] : '', website: url ? url[0] : '', address: geo ? `${geo[1]},${geo[2]}` : '', lat: geo ? geo[1] : '', lng: geo ? geo[2] : '', ssid, pass, upi: upi ? upi[0] : '', text: t } };
  }
  window.QRAI = { analyze };

  /* ===================== AI QR Studio page ===================== */
  const rootEl = document.getElementById('studio');
  if (!rootEl) return;
  const { $, $$, esc, toast, sleep } = QRX;
  const out = $('#aiOut');
  const fix = (u) => { u = (u || '').trim(); return !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u; };
  const wesc = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');
  const STYLE = { fg: '#7c5cff', fg2: '#22d3ee', bg: '#ffffff', eye: '#ff5ea8', dots: 'rounded', eyes: 'rounded', margin: 3 };
  const LABELS = { name: 'Name / title', phone: 'Phone', email: 'Email', website: 'Website', address: 'Address', ssid: 'Network name (SSID)', pass: 'Password', upi: 'UPI ID', pn: 'Payee name', am: 'Amount (optional)', lat: 'Latitude', lng: 'Longitude', text: 'Text' };

  function fieldsFor(r) {
    const has = (k) => r.items.some((i) => i.k === k);
    switch (r.mode) {
      case 'page': { const f = ['name']; ['phone', 'email', 'website', 'address'].forEach((k) => has(k) && f.push(k)); if (f.length === 1) f.push('website'); return f; }
      case 'wifi': return ['ssid', 'pass', 'enc'];
      case 'upi': return ['upi', 'pn', 'am'];
      case 'url': return ['website']; case 'phone': return ['phone']; case 'email': return ['email'];
      case 'geo': return ['lat', 'lng']; case 'address': return ['address']; default: return ['text'];
    }
  }

  async function run() {
    const text = $('#aiPrompt').value.trim();
    if (text.length < 3) return toast('Describe what you want to create first');
    out.innerHTML = '<div class="think">🤖 Reading your request<span>.</span><span>.</span><span>.</span></div>';
    await sleep(500); out.innerHTML = '<div class="think">🔎 Detecting content types<span>.</span><span>.</span><span>.</span></div>';
    await sleep(500); out.innerHTML = '<div class="think">⚙️ Choosing the best QR format<span>.</span><span>.</span><span>.</span></div>';
    await sleep(450);
    show(analyze(text));
  }

  function show(r) {
    const f = fieldsFor(r);
    out.innerHTML = `<div class="out"><b>Detected:</b>${r.items.map((i, n) => `<div class="it" style="animation-delay:${n * 0.1}s">✓ ${i.i} ${esc(i.l)}${i.v ? ` — <span class="mut">${esc(i.v)}</span>` : ''}</div>`).join('')}
      <div class="rec">Recommended:<br>${esc(r.rec)}</div></div>
      <h3 style="margin:1.4rem 0 .8rem">Complete the details</h3><div class="grid g2" id="aiFields">
      ${f.map((k) => k === 'enc' ? `<div class="fld"><label>Security</label><select class="in" data-k="enc"><option>WPA</option><option>WEP</option><option value="nopass">None</option></select></div>`
        : `<div class="fld"><label>${LABELS[k]}</label><input class="in" data-k="${k}" value="${esc(r.v[k] || '')}"></div>`).join('')}
      ${r.mode === 'page' && r.file ? `<div class="fld"><label>${esc(r.file.l)} (upload)</label><input class="in" type="file" id="aiFile" accept="${r.file.acc}"></div>` : ''}</div>
      <button class="btn btn-primary" id="aiGo">⚡ Generate QR</button><div id="aiRes"></div>`;
    $('#aiGo').onclick = () => generate(r);
  }

  async function generate(r) {
    const g = (k) => ($(`[data-k="${k}"]`, out) || {}).value?.trim() || '';
    const en = encodeURIComponent;
    let payload = '', note = '', created = null;
    try {
      switch (r.mode) {
        case 'wifi': { const e = g('enc') || 'WPA'; if (!g('ssid')) throw new Error('Enter the network name'); payload = `WIFI:T:${e};S:${wesc(g('ssid'))};${e === 'nopass' ? '' : 'P:' + wesc(g('pass')) + ';'};`; break; }
        case 'upi': if (!g('upi')) throw new Error('Enter a UPI ID'); payload = `upi://pay?pa=${g('upi')}&pn=${en(g('pn') || '')}${g('am') ? '&am=' + g('am') : ''}&cu=INR`; break;
        case 'url': if (!g('website')) throw new Error('Enter a website'); payload = fix(g('website')); break;
        case 'phone': payload = 'tel:' + g('phone').replace(/[^\d+]/g, ''); break;
        case 'email': payload = 'mailto:' + g('email'); break;
        case 'geo': payload = `geo:${g('lat')},${g('lng')}`; break;
        case 'address': payload = 'https://www.google.com/maps/search/?api=1&query=' + en(g('address')); break;
        case 'text': payload = g('text'); break;
        case 'page': {
          const data = {}; ['name', 'phone', 'email', 'website', 'address'].forEach((k) => { if (g(k)) data[k] = g(k); });
          if (!data.name) throw new Error('Give your page a name');
          const file = $('#aiFile')?.files[0];
          if (QRX.token()) {
            const fd = new FormData();
            fd.append('kind', 'page'); fd.append('type', (r.v.name || 'business').toLowerCase()); fd.append('title', data.name); fd.append('data', JSON.stringify(data));
            if (file) fd.append('file', file);
            created = await QRX.api('/api/dynamic', { method: 'POST', body: fd });
            payload = created.url;
            note = `<div class="note ok">✅ Smart page created and saved. Edit it any time from your <a class="lnk" href="/dashboard">dashboard</a>. Link: <a class="lnk" href="${esc(created.url)}" target="_blank">${esc(created.url)}</a></div>`;
          } else {
            payload = [data.name, data.phone && 'Tel: ' + data.phone, data.email, data.website, data.address].filter(Boolean).join('\n');
            note = `<div class="note">🔄 Smart pages (editable + tracked) need a free account. <a class="lnk" href="/signup?next=/ai-qr">Sign up</a> or <a class="lnk" href="/login?next=/ai-qr">log in</a>. Meanwhile, here is a static QR containing the same info as plain text.</div>`;
          }
        }
      }
      if (!payload) throw new Error('Please fill in the details');
      const m = await QRX.matrix(payload, 'M');
      const svg = QRX.svg(m.rows, STYLE);
      $('#aiRes').innerHTML = `<div class="res"><div class="qr-stage scan">${QRX.svg(m.rows, { ...STYLE, anim: true })}</div><div><h3>Your QR code is ready ✨</h3>${note}
        <div class="info"><code>${esc(payload.slice(0, 300))}</code></div>
        <div class="dl" style="max-width:320px"><button class="btn btn-ghost sm" id="rPng">PNG</button><button class="btn btn-ghost sm" id="rSvg">SVG</button><button class="btn btn-ghost sm" id="rCopy">Copy</button><a class="btn btn-ghost sm" href="/qr-generator">Customize</a></div></div></div>`;
      $('#rPng').onclick = async () => QRX.save(await QRX.raster(svg, 1024), 'qrnova-ai.png');
      $('#rSvg').onclick = () => QRX.save(new Blob([svg], { type: 'image/svg+xml' }), 'qrnova-ai.svg');
      $('#rCopy').onclick = () => navigator.clipboard.writeText(payload).then(() => toast('Copied'));
      $('#aiRes').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { toast(e.message); }
  }

  $('#aiRun').onclick = run;
  $$('#examples .chip').forEach((c) => (c.onclick = () => { $('#aiPrompt').value = c.textContent; run(); }));
  const pre = new URLSearchParams(location.search).get('prompt');
  if (pre) { $('#aiPrompt').value = pre; run(); }
})();
(() => {
  const { $, $$, toast, esc } = QRX;
  if (!$('#gen')) return;

  /* ═══════════ constants & helpers ═══════════ */
  const en = encodeURIComponent;
  const CAP = { L: 2953, M: 2331, Q: 1663, H: 1273 };
  const EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.m4a', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];
  const COUNTRIES = window.COUNTRIES && window.COUNTRIES.length ? window.COUNTRIES : [{ n: 'India', c: 'IN', d: '91', f: '🇮🇳' }];
  const region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
  const DEF = COUNTRIES.find((c) => c.c === region) || COUNTRIES.find((c) => c.c === 'IN') || COUNTRIES[0];

  const fixUrl = (u) => { u = String(u || '').trim(); return !u ? '' : /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : 'https://' + u; };
  const parseUrl = (u) => { try { const x = new URL(fixUrl(u)); if (!/^https?:$/.test(x.protocol)) return null; return x.hostname.includes('.') || x.hostname === 'localhost' ? x : null; } catch (e) { return null; } };
  const urlErr = (u) => { u = String(u || '').trim(); if (!u) return null; if (/\s/.test(u)) return 'Web addresses cannot contain spaces'; return parseUrl(u) ? null : 'Enter a valid web address, e.g. https://example.com'; };
  const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || '');
  const cl = (s) => String(s || '').replace(/[^\d+]/g, '');
  const e164 = (v) => { const raw = (v.num || '').trim(), d = raw.replace(/\D/g, ''); if (!d) return ''; return raw.startsWith('+') ? '+' + d : '+' + String(v.cc || '').replace(/\D/g, '') + d.replace(/^0+/, ''); };
  const phoneErr = (v) => (/^\+\d{7,15}$/.test(e164(v)) ? null : 'Enter a valid phone number');
  const wifiEsc = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');
  const vEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const F = (k, l, ph, o) => Object.assign({ k, l, ph: ph || '', t: 'text' }, o || {});
  const CTRY = [F('country', 'Country', '', { t: 'country', h: 1 }), F('cc', 'Country code', '91', { t: 'cc', h: 1 })];
  const LBL = { website: 'Website', review: 'Review', social: 'Social', maps: 'Map', buy: 'Purchase', menu: 'Menu' };

  /* ═══════════ per-type builders ═══════════ */
  const waLink = (v) => { const p = e164(v).slice(1); return p ? `https://wa.me/${p}${v.msg ? '?text=' + en(v.msg) : ''}` : ''; };
  const tgLink = (v) => (/^https?:/i.test(v.user) ? v.user : 'https://t.me/' + v.user.replace(/^@/, ''));
  const SOC = { instagram: ['Instagram', 'https://instagram.com/'], facebook: ['Facebook', 'https://facebook.com/'], linkedin: ['LinkedIn', 'https://linkedin.com/in/'], youtube: ['YouTube', 'https://youtube.com/@'], x: ['X (Twitter)', 'https://x.com/'], github: ['GitHub', 'https://github.com/'], telegram: ['Telegram', 'https://t.me/'], tiktok: ['TikTok', 'https://tiktok.com/@'] };
  const socialUrl = (v) => {
    const h = (v.h || '').trim(); if (!h) return '';
    if (v.p === 'custom' || /^https?:\/\//i.test(h) || /^www\./i.test(h)) return fixUrl(h);
    const u = h.replace(/^@/, ''), roots = { linkedin: 'https://linkedin.com/', youtube: 'https://youtube.com/' };
    if (roots[v.p] && u.includes('/')) return roots[v.p] + u;
    return SOC[v.p] ? SOC[v.p][1] + u : fixUrl(h);
  };
  const locB = (v) => {
    const has = v.lat !== '' && v.lng !== '', ll = has ? `${+v.lat},${+v.lng}` : '';
    if (v.fmt === 'geo') return has ? 'geo:' + ll : '';
    if (v.fmt === 'url') return v.mapurl ? fixUrl(v.mapurl) : '';
    return 'https://www.google.com/maps/search/?api=1&query=' + en(ll || v.address);
  };
  const STAMP = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const UID = STAMP + '-' + Math.random().toString(36).slice(2, 10) + '@qrnova';
  const evB = (v) => {
    const d = v.date.replace(/-/g, ''), t = (x) => x.replace(':', '') + '00';
    const notes = [v.desc, v.organizer && 'Organizer: ' + v.organizer, v.contact && 'Contact: ' + v.contact, v.website && 'More info: ' + fixUrl(v.website)].filter(Boolean).join('\n');
    if (v.fmt === 'text') return [v.name, `When: ${v.date} ${v.start}${v.end ? ' – ' + v.end : ''}`, v.location && 'Where: ' + v.location, notes].filter(Boolean).join('\n');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QRNova//QR Event//EN', 'BEGIN:VEVENT', 'UID:' + UID, 'DTSTAMP:' + STAMP, `DTSTART:${d}T${t(v.start)}`];
    if (v.end) L.push(`DTEND:${d}T${t(v.end)}`);
    L.push('SUMMARY:' + vEsc(v.name));
    if (v.location) L.push('LOCATION:' + vEsc(v.location));
    if (notes) L.push('DESCRIPTION:' + vEsc(notes));
    if (v.website && parseUrl(v.website)) L.push('URL:' + fixUrl(v.website));
    if (emailOk(v.contact)) L.push(`ORGANIZER;CN="${(v.organizer || 'Organizer').replace(/"/g, '')}":mailto:${v.contact}`);
    L.push('END:VEVENT', 'END:VCALENDAR');
    return L.join('\r\n');
  };
  const vcB = (v) => {
    const L = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEsc(v.last)};${vEsc(v.first)};;;`, 'FN:' + vEsc([v.first, v.last].filter(Boolean).join(' '))];
    if (v.org) L.push('ORG:' + vEsc(v.org));
    if (v.jobtitle) L.push('TITLE:' + vEsc(v.jobtitle));
    if (cl(v.phone)) L.push('TEL;TYPE=WORK,VOICE:' + cl(v.phone));
    if (cl(v.mobile)) L.push('TEL;TYPE=CELL,VOICE:' + cl(v.mobile));
    if (v.email) L.push('EMAIL;TYPE=INTERNET:' + v.email);
    if (v.website) L.push('URL:' + fixUrl(v.website));
    if (v.street || v.city || v.state || v.zip || v.ctry) L.push(`ADR;TYPE=WORK:;;${vEsc(v.street)};${vEsc(v.city)};${vEsc(v.state)};${vEsc(v.zip)};${vEsc(v.ctry)}`);
    if (v.note) L.push('NOTE:' + vEsc(v.note));
    L.push('END:VCARD');
    return L.join('\r\n');
  };
  const pageChk = (v) => {
    for (const k of ['website', 'review', 'social', 'maps', 'buy', 'menu']) if (v[k] && urlErr(v[k])) return `${LBL[k]} link is not a valid web address`;
    if (v.email && !emailOk(v.email)) return 'Enter a valid email address';
    return null;
  };
  const FILE = (label, accept) => ({ file: 1, kind: 'file', x: 'file', upLabel: label, accept, f: [F('title', 'Title (shown on the landing page)', 'My file')] });
  const RV = { page: ['Review page URL', 'https://g.page/r/…/review'], profile: ['Business profile URL', 'https://maps.google.com/?cid=…'], custom: ['Custom review URL', 'https://yourbrand.com/review'] };

  /* ═══════════ QR types ═══════════ */
  const T = [
    { id: 'text', g: 'Basic', i: '📝', n: 'Text', d: 'shows your text', x: 'text', tk: 'text',
      f: [F('text', 'Your text', 'Welcome to Grand Vista Hotel!', { t: 'area', rows: 5, req: 1 })],
      ex: { text: 'Welcome to Grand Vista Hotel! 🏨\nBreakfast 7–10 am · Wi-Fi at the front desk' }, b: (v) => v.text },

    { id: 'url', g: 'Basic', i: '🔗', n: 'URL', d: 'opens the website', dyn: 'opt', x: 'link',
      f: [F('url', 'Website URL', 'https://example.com', { req: 1 })], ex: { url: 'https://example.com' },
      chk: (v) => urlErr(v.url), b: (v) => fixUrl(v.url) },

    { id: 'email', g: 'Basic', i: '✉️', n: 'Email', d: 'opens an email composer',
      f: [F('to', 'Email address', 'name@example.com', { t: 'email', req: 1 }), F('subject', 'Subject', 'Booking enquiry'), F('body', 'Message', 'Hi, I would like to know more…', { t: 'area' })],
      ex: { to: 'hello@example.com', subject: 'Booking enquiry', body: 'Hi, I would like to know more.' },
      chk: (v) => (emailOk(v.to) ? null : 'Enter a valid email address'),
      b: (v) => { const q = []; if (v.subject) q.push('subject=' + en(v.subject)); if (v.body) q.push('body=' + en(v.body.replace(/\r?\n/g, '\r\n'))); return 'mailto:' + v.to + (q.length ? '?' + q.join('&') : ''); } },

    { id: 'phone', g: 'Basic', i: '📞', n: 'Phone', d: 'opens the phone dialer',
      f: CTRY.concat([F('num', 'Phone number', '98765 43210', { t: 'tel', req: 1 })]), ex: { num: '98765 43210' }, chk: phoneErr, b: (v) => 'tel:' + e164(v) },

    { id: 'sms', g: 'Basic', i: '💬', n: 'SMS', d: 'opens the SMS app with your message',
      f: CTRY.concat([F('num', 'Phone number', '98765 43210', { t: 'tel', req: 1 }), F('msg', 'Message', 'Hi! I’d like to book a table.', { t: 'area' }), F('fmt', 'Format', '', { t: 'select', o: [['sms', 'sms: link — iPhone & Android'], ['smsto', 'SMSTO: — most Android scanners']] })]),
      ex: { num: '98765 43210', msg: 'Hi! I’d like to book a table.' }, chk: phoneErr,
      b: (v) => (v.fmt === 'smsto' ? `SMSTO:${e164(v)}:${v.msg || ''}` : `sms:${e164(v)}${v.msg ? '?body=' + en(v.msg) : ''}`) },

    { id: 'whatsapp', g: 'Communication', i: '🟢', n: 'WhatsApp', d: 'opens a WhatsApp chat', dyn: 'opt', x: 'link', lk: waLink,
      f: CTRY.concat([F('num', 'WhatsApp number', '98765 43210', { t: 'tel', req: 1 }), F('msg', 'Pre-filled message', 'Hello, I found your business through your QR code.', { t: 'area' })]),
      ex: { num: '98765 43210', msg: 'Hello, I found your business through your QR code.' }, chk: phoneErr, b: waLink },

    { id: 'telegram', g: 'Communication', i: '✈️', n: 'Telegram', d: 'opens the Telegram chat', dyn: 'opt', x: 'link', lk: tgLink,
      f: [F('user', 'Username or invite link', '@username', { req: 1 })], ex: { user: '@telegram' },
      chk: (v) => (/^(@?[A-Za-z0-9_]{4,32}|https?:\/\/t\.me\/\S+)$/.test(v.user) ? null : 'Enter a Telegram username (4–32 letters, numbers or _)'), b: tgLink },

    { id: 'social', g: 'Communication', i: '🌐', n: 'Social media', d: 'opens the profile', dyn: 'opt', x: 'link', lk: socialUrl,
      f: [F('p', 'Platform', '', { t: 'select', o: Object.keys(SOC).map((k) => [k, SOC[k][0]]).concat([['custom', 'Custom social URL']]) }), F('h', 'Username or profile link', '@yourname', { req: 1 })],
      ex: { p: 'instagram', h: '@natgeo' }, chk: (v) => urlErr(socialUrl(v)), b: socialUrl },

    { id: 'vcard', g: 'Communication', i: '👤', n: 'Contact / vCard', d: 'Save Contact',
      f: [F('first', 'First name', 'Asha', { h: 1, req: 1 }), F('last', 'Last name', 'Rao', { h: 1 }), F('phone', 'Phone', '+91 40 1234 5678', { t: 'tel', h: 1 }), F('mobile', 'Mobile', '+91 98765 43210', { t: 'tel', h: 1 }),
        F('email', 'Email', 'asha@brand.com', { t: 'email', h: 1 }), F('website', 'Website', 'brand.com', { h: 1 }), F('org', 'Company', 'Brand Studio', { h: 1 }), F('jobtitle', 'Job title', 'Founder', { h: 1 }),
        F('street', 'Street address', '12 MG Road'), F('city', 'City', 'Hyderabad', { h: 1 }), F('state', 'State', 'Telangana', { h: 1 }), F('zip', 'Postal code', '500001', { h: 1 }), F('ctry', 'Country', 'India', { h: 1 }), F('note', 'Notes', '', { t: 'area', rows: 2 })],
      ex: { first: 'Asha', last: 'Rao', mobile: '+91 98765 43210', email: 'asha@brand.com', org: 'Brand Studio', jobtitle: 'Founder', website: 'brand.com', city: 'Hyderabad', ctry: 'India' },
      chk: (v) => (v.email && !emailOk(v.email) ? 'Enter a valid email address' : v.website && urlErr(v.website) ? urlErr(v.website) : null), b: vcB },

    { id: 'business', g: 'Business', i: '🏢', n: 'Business profile', d: 'opens your business page', page: 1, kind: 'page', x: 'file', upLabel: 'Business logo (optional)', accept: 'image/*',
      f: [F('name', 'Business name', 'Grand Vista Hotel', { req: 1 }), F('desc', 'Description', 'What you do…', { t: 'area' }), F('website', 'Website', 'grandvista.com', { h: 1 }), F('phone', 'Phone', '+91 98765 43210', { t: 'tel', h: 1 }),
        F('email', 'Email', 'hello@brand.com', { t: 'email', h: 1 }), F('review', 'Review URL', 'g.page/r/…', { h: 1 }), F('address', 'Address', 'Street, City', { t: 'area', rows: 2 }),
        F('hours', 'Opening hours', 'Mon–Fri 9:00–18:00\nSat 10:00–14:00', { t: 'area', rows: 3 }), F('social', 'Social media link', 'instagram.com/yourbrand'), F('maps', 'Map location link', 'https://maps.google.com/…')],
      ex: { name: 'Grand Vista Hotel', desc: 'Boutique stay in the heart of the city.', website: 'example.com', phone: '+91 98765 43210', email: 'hello@example.com', address: '12 MG Road, Hyderabad', hours: 'Open daily 24 hours' }, chk: pageChk },

    { id: 'website', g: 'Business', i: '🖥️', n: 'Website', d: 'opens the website', dyn: 'opt', x: 'link',
      f: [F('url', 'Website link', 'yourbrand.com', { req: 1 })], ex: { url: 'https://example.com' }, chk: (v) => urlErr(v.url), b: (v) => fixUrl(v.url) },

    { id: 'menu', g: 'Business', i: '🍽️', n: 'Restaurant menu', d: 'opens your menu page', page: 1, kind: 'page', x: 'file', upLabel: 'Upload menu (PDF or image)', accept: '.pdf,image/*',
      f: [F('name', 'Restaurant name', 'Spice Garden', { req: 1 }), F('desc', 'Cuisine / description', 'North Indian · Chinese · Desserts', { t: 'area', rows: 2 }), F('phone', 'Phone', '+91 98765 43210', { t: 'tel', h: 1 }), F('website', 'Website', 'spicegarden.in', { h: 1 }),
        F('email', 'Email', '', { t: 'email', h: 1 }), F('menu', 'Menu link (if not uploading)', '', { h: 1 }), F('address', 'Address', '', { t: 'area', rows: 2 }), F('hours', 'Opening hours', '11:00 – 23:00 daily', { t: 'area', rows: 2 }), F('maps', 'Map location link')],
      ex: { name: 'Spice Garden', desc: 'North Indian · Chinese · Desserts', phone: '+91 98765 43210', hours: '11:00 – 23:00 daily' }, chk: pageChk },

    { id: 'product', g: 'Business', i: '📦', n: 'Product information', d: 'opens the product page', page: 1, kind: 'page', x: 'file', upLabel: 'Product image (optional)', accept: 'image/*',
      f: [F('name', 'Product name', 'Aero Bottle 750 ml', { req: 1 }), F('pid', 'Product ID / SKU', 'AB-750', { h: 1 }), F('company', 'Company', 'Aero Goods', { h: 1 }), F('price', 'Price', '₹499', { h: 1 }), F('website', 'Website', '', { h: 1 }),
        F('desc', 'Description', 'Insulated steel bottle, keeps drinks cold for 24 h.', { t: 'area' }), F('buy', 'Purchase URL', 'https://shop.example.com/aero-bottle')],
      ex: { name: 'Aero Bottle 750 ml', pid: 'AB-750', company: 'Aero Goods', price: '₹499', desc: 'Insulated steel bottle, keeps drinks cold for 24 h.' }, chk: pageChk },

    { id: 'review', g: 'Business', i: '⭐', n: 'Review link', d: 'opens your review page', dyn: 'opt', x: 'link', lbl: 'Scan to Review Us',
      f: [F('dest', 'Destination', '', { t: 'select', o: [['page', 'Review page (e.g. Google review form)'], ['profile', 'Business profile'], ['custom', 'Custom review URL']] }),
        F('url', 'Review page URL', 'https://g.page/r/…/review', { req: 1, hint: 'Google: Business Profile → <b>Get more reviews</b> → copy the link.' })],
      ex: { url: 'https://g.page/r/example/review' }, chk: (v) => urlErr(v.url), b: (v) => fixUrl(v.url),
      on: (e, v) => { if (e.target.dataset.k !== 'dest') return; const r = RV[v.dest], lab = $('label[for="f_url"]', form), inp = $('[data-k="url"]', form); if (lab && lab.firstChild) lab.firstChild.nodeValue = r[0] + ' '; if (inp) inp.placeholder = r[1]; } },

    { id: 'location', g: 'Location', i: '📍', n: 'Location', d: 'opens the map', dyn: 'opt', x: 'geo', lk: (v) => { const t = locB(v); return /^https?:/.test(t) ? t : ''; },
      f: [F('fmt', 'Encode as', '', { t: 'select', o: [['link', 'Map link — works on every phone'], ['geo', 'geo: coordinates — opens the default map app'], ['url', 'Custom map URL']] }),
        F('address', 'Address', '221B Baker Street, London', { t: 'area', rows: 2 }), F('lat', 'Latitude', '12.971600', { h: 1 }), F('lng', 'Longitude', '77.594600', { h: 1 }), F('mapurl', 'Map URL (for “Custom map URL”)', 'https://maps.google.com/…')],
      ex: { address: 'Eiffel Tower, Paris', lat: '48.858370', lng: '2.294481' },
      chk: (v) => {
        const has = v.lat !== '' && v.lng !== '';
        if ((v.lat !== '') !== (v.lng !== '')) return 'Enter both latitude and longitude';
        if (has) { const la = parseFloat(v.lat), ln = parseFloat(v.lng); if (!isFinite(la) || !isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return 'Latitude must be −90…90 and longitude −180…180'; }
        if (v.fmt === 'geo' && !has) return 'Coordinates are needed for the geo: format';
        if (v.fmt === 'url') return v.mapurl ? urlErr(v.mapurl) : 'Paste a map URL';
        if (v.fmt === 'link' && !has && !v.address) return 'Enter an address or coordinates';
        return null;
      }, b: locB },

    { id: 'wifi', g: 'Connectivity', i: '📶', n: 'Wi-Fi', d: 'joins the Wi-Fi network',
      f: [F('ssid', 'Network name (SSID)', 'MyNetwork', { req: 1 }), F('pass', 'Password', '', { t: 'password', hint: 'It is encoded into the QR only — our server does not store it.' }),
        F('enc', 'Security', '', { t: 'select', o: [['WPA', 'WPA / WPA2 (recommended)'], ['SAE', 'WPA3 — newer devices only'], ['WEP', 'WEP (legacy)'], ['nopass', 'Open — no password']] }), F('hidden', 'Hidden network', '', { t: 'check' })],
      ex: { ssid: 'Cafe_Guest', pass: 'coffee1234' },
      chk: (v) => (v.ssid.length > 32 ? 'SSID can be at most 32 characters' : (v.enc === 'WPA' || v.enc === 'SAE') && (v.pass.length < 8 || v.pass.length > 63) ? 'WPA / WPA3 passwords must be 8–63 characters' : v.enc === 'WEP' && !v.pass ? 'Enter the WEP key' : null),
      b: (v) => `WIFI:T:${v.enc};S:${wifiEsc(v.ssid)};${v.enc === 'nopass' ? '' : 'P:' + wifiEsc(v.pass) + ';'}${v.hidden ? 'H:true;' : ''};` },

    { id: 'upi', g: 'Payment', i: '💸', n: 'UPI', d: 'opens a UPI app to pay',
      f: [F('pa', 'UPI ID', 'name@oksbi', { req: 1 }), F('pn', 'Payee name', 'Asha Rao', { req: 1 }), F('am', 'Amount (optional)', '499.00', { t: 'number', h: 1 }), F('cu', 'Currency', '', { t: 'select', h: 1, o: [['INR', 'INR ₹ (UPI supports INR only)']] }), F('tn', 'Transaction note', 'Order #1024')],
      ex: { pa: 'rahul@oksbi', pn: 'Rahul Sharma', am: '499', tn: 'Order 1024' },
      chk: (v) => (!/^[\w.\-]{2,256}@[A-Za-z]{2,64}$/.test(v.pa) ? 'Enter a valid UPI ID like name@bank' : v.am && !(/^\d{1,9}(\.\d{1,2})?$/.test(v.am) && +v.am > 0) ? 'Amount must be a positive number (max 2 decimals)' : null),
      b: (v) => `upi://pay?pa=${v.pa}&pn=${en(v.pn)}${v.am ? '&am=' + v.am : ''}&cu=INR${v.tn ? '&tn=' + en(v.tn) : ''}` },

    { id: 'payurl', g: 'Payment', i: '💳', n: 'Payment URL', d: 'opens the payment page', dyn: 'opt', x: 'link',
      f: [F('url', 'Payment link', 'https://pay.example.com/…', { req: 1 })], ex: { url: 'https://pay.example.com/invoice/1024' }, chk: (v) => urlErr(v.url), b: (v) => fixUrl(v.url) },

    { id: 'event', g: 'Events', i: '📅', n: 'Event / Calendar', d: 'adds the event to the calendar',
      f: [F('name', 'Event name', 'Annual Tech Meetup', { req: 1 }), F('organizer', 'Organizer', 'Tech Club', { h: 1 }), F('contact', 'Contact (email or phone)', 'events@club.org', { h: 1 }),
        F('date', 'Date', '', { t: 'date', h: 1, req: 1 }), F('start', 'Start time', '', { t: 'time', h: 1, req: 1 }), F('end', 'End time', '', { t: 'time', h: 1 }),
        F('fmt', 'Format', '', { t: 'select', h: 1, o: [['ics', 'iCalendar (add to calendar)'], ['text', 'Plain text']] }),
        F('location', 'Location', 'Hall B, City Convention Centre'), F('desc', 'Description', '', { t: 'area', rows: 3 }), F('website', 'Website', 'club.org/meetup')],
      ex: { name: 'Annual Tech Meetup', organizer: 'Tech Club', contact: 'events@club.org', date: '2026-12-05', start: '18:00', end: '21:00', location: 'Hall B, City Convention Centre', desc: 'Talks, demos and networking.' },
      chk: (v) => (v.end && v.end <= v.start ? 'End time must be after the start time' : v.website && urlErr(v.website) ? urlErr(v.website) : v.contact && v.contact.includes('@') && !emailOk(v.contact) ? 'Contact email looks invalid' : null), b: evB },

    { id: 'image', g: 'Media', i: '🖼️', n: 'Image', href: '/file-to-qr?type=image' },
    { id: 'pdf', g: 'Media', i: '📄', n: 'PDF', href: '/file-to-qr?type=pdf' },
    { id: 'video', g: 'Media', i: '🎬', n: 'Video', href: '/file-to-qr?type=video' },
    { id: 'audio', g: 'Media', i: '🎵', n: 'Audio', href: '/file-to-qr?type=audio' },
    { id: 'document', g: 'Media', i: '📁', n: 'Document', href: '/file-to-qr?type=document' },

    { id: 'custom', g: 'Advanced', i: '🧩', n: 'Custom QR', d: 'depends on your data', x: 'text', tk: 'data',
      f: [F('kind', 'Data type', '', { t: 'select', o: [['text', 'Plain text'], ['uri', 'URI / deep link'], ['json', 'Structured data (JSON)'], ['url', 'Custom URL']] }), F('data', 'Your data', 'Any text, URI or JSON…', { t: 'area', rows: 5, req: 1 }), F('min', 'Minify JSON to save space', '', { t: 'check', def: 1 })],
      ex: { kind: 'json', data: '{"id": 42, "name": "Sample item"}' },
      chk: (v) => { if (v.kind === 'uri' && !/^[a-z][a-z0-9+.\-]*:\S/i.test(v.data)) return 'A URI needs a scheme, e.g. tel:+123… or myapp://open'; if (v.kind === 'json') { try { JSON.parse(v.data); } catch (e) { return 'This is not valid JSON'; } } return v.kind === 'url' ? urlErr(v.data) : null; },
      b: (v) => (v.kind === 'json' && v.min ? JSON.stringify(JSON.parse(v.data)) : v.kind === 'url' ? fixUrl(v.data) : v.data) },

    { id: 'dynamic', g: 'Advanced', i: '🔄', n: 'Dynamic QR', d: 'redirects to your link (editable later)', dyn: 'only', kind: 'url', x: 'link',
      f: [F('title', 'Name (for your dashboard)', 'Spring campaign'), F('url', 'Destination link', 'example.com', { req: 1 })], ex: { title: 'Spring campaign', url: 'https://example.com' }, chk: (v) => urlErr(v.url), b: (v) => fixUrl(v.url) },
    { id: 'ai', g: 'Advanced', i: '🤖', n: 'AI-generated QR', href: '/ai-qr' },
  ];
  const BYID = {}; T.forEach((t) => (BYID[t.id] = t));
  const PRESET = { map: ['location', { fmt: 'url' }], geo: ['location', { fmt: 'geo' }], address: ['location', { fmt: 'link' }] };

  /* ═══════════ state ═══════════ */
  const S = { dots: 'rounded', eyes: 'rounded', logo: null, label: '', labelAuto: true };
  let cur = BYID.url, mode = 'static', rows = null, stats = null, lastText = '', created = null, generated = false, touched = false, seq = 0, timer;
  let map = null, pin = null, leafletP = null, prevFile = null, prevUrl = null;
  const form = $('#form'), stage = $('#stage'), extra = $('#extra');
  const fileEl = () => $('[data-file]', form);
  const ecl = () => (S.logo ? 'H' : $('#ecl').value);
  const tk = () => cur.tk || 'text';

  /* ═══════════ type picker ═══════════ */
  const GROUPS = [...new Set(T.map((t) => t.g))];
  $('#types').innerHTML = GROUPS.map((g) => `<div class="grp" data-g="${g}"><small>${g}</small><div class="chips">${T.filter((t) => t.g === g).map((t) => `<button type="button" class="chip" data-id="${t.id}">${t.i} ${esc(t.n)}</button>`).join('')}</div></div>`).join('');
  $$('#types .chip').forEach((b) => (b.onclick = () => { const t = BYID[b.dataset.id]; if (t.href) { location.href = t.href; return; } setType(t.id); }));
  $('#typeSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('#types .chip').forEach((c) => (c.hidden = !!q && !c.textContent.toLowerCase().includes(q)));
    $$('#types .grp').forEach((g) => (g.hidden = !$$('.chip', g).some((c) => !c.hidden)));
  });

  /* ═══════════ form rendering ═══════════ */
  function fieldHtml(f) {
    const id = 'f_' + f.k, ph = esc(f.ph || '');
    let inp;
    if (f.t === 'check') return `<div class="fld${f.h ? ' h' : ''}"><label class="chk"><input type="checkbox" data-k="${f.k}"${f.def ? ' checked' : ''}> ${esc(f.l)}</label></div>`;
    if (f.t === 'area') inp = `<textarea class="in" id="${id}" data-k="${f.k}" rows="${f.rows || 3}" placeholder="${ph}"></textarea>`;
    else if (f.t === 'select') inp = `<select class="in" id="${id}" data-k="${f.k}">${f.o.map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`;
    else if (f.t === 'country') inp = `<select class="in" id="${id}" data-k="country">${COUNTRIES.map((c) => `<option value="${c.c}">${c.f} ${esc(c.n)} (+${c.d})</option>`).join('')}</select>`;
    else if (f.t === 'cc') inp = `<div class="pre"><span>+</span><input class="in" id="${id}" data-k="cc" inputmode="numeric" maxlength="4" placeholder="91"></div>`;
    else if (f.t === 'password') inp = `<div class="pwd"><input class="in" id="${id}" type="password" data-k="${f.k}" data-raw autocomplete="off"><button type="button" class="eye" data-eye aria-label="Show or hide password">👁️</button></div>`;
    else inp = `<input class="in" id="${id}" data-k="${f.k}" type="${f.t}" placeholder="${ph}" autocomplete="off"${f.t === 'number' ? ' step="0.01" min="0" inputmode="decimal"' : ''}>`;
    return `<div class="fld${f.h ? ' h' : ''}"><label for="${id}">${esc(f.l)}${f.req ? ' <i class="rq">*</i>' : ''}</label>${inp}${f.hint ? `<small class="fh">${f.hint}</small>` : ''}</div>`;
  }
  function syncCc() {
    const s = $('[data-k="country"]', form), c = $('[data-k="cc"]', form);
    if (s && c) { const k = COUNTRIES.find((x) => x.c === s.value); if (k) c.value = k.d; }
  }
  function initCountries() { const s = $('[data-k="country"]', form); if (s) s.value = DEF.c; syncCc(); }

  function setType(id, pre) {
    pre = pre || {};
    cur = BYID[id] || BYID.url;
    if (map) { map.remove(); map = null; pin = null; }
    $$('#types .chip').forEach((b) => b.classList.toggle('on', b.dataset.id === cur.id));
    mode = cur.dyn === 'only' || cur.page || cur.file || (pre.dyn && cur.dyn === 'opt') ? 'dynamic' : 'static';
    created = null; generated = false;
    form.innerHTML = cur.f.map(fieldHtml).join('') + (cur.upLabel ? `<div class="fld"><label>${esc(cur.upLabel)}</label><input class="in" type="file" data-file accept="${esc(cur.accept || '*')}"></div>` : '');
    extra.onclick = null; extra.innerHTML = '';
    const X = cur.x && EX[cur.x]; if (X) X.init(extra);
    initCountries();
    Object.entries(pre.vals || {}).forEach(([k, v]) => { const el = $(`[data-k="${k}"]`, form); if (el) el.value = v; });
    if (S.labelAuto) { S.label = cur.lbl || ''; $('#label').value = S.label; }
    bar(); refresh();
  }
  function bar() {
    const b = $('#modeBar');
    const scan = cur.d ? `<div class="onscan">📲 On scan: ${esc(cur.d)}</div>` : '';
    if (cur.dyn === 'opt') {
      b.innerHTML = scan + `<div class="seg"><button type="button" data-m="static" class="${mode === 'static' ? 'on' : ''}">⚡ Static</button><button type="button" data-m="dynamic" class="${mode === 'dynamic' ? 'on' : ''}">🔄 Dynamic</button></div><p class="hint">${mode === 'static' ? 'Data is encoded directly in the QR — free and permanent.' : 'The QR points to a managed short link you can edit later and track. Free account required.'}</p>`;
      $$('[data-m]', b).forEach((x) => (x.onclick = () => { mode = x.dataset.m; created = null; generated = false; bar(); refresh(); }));
    } else b.innerHTML = scan + `<p class="hint">${mode === 'dynamic' ? '🔄 This creates a Dynamic QR — hosted, editable and tracked. Free account required.' : '⚡ Static QR — everything is encoded inside the code itself.'}</p>`;
    $('#create').textContent = mode === 'dynamic' ? '🔄 Create Dynamic QR' : '⚡ Generate QR';
  }
  function values() {
    const v = {};
    $$('[data-k]', form).forEach((e) => { v[e.dataset.k] = e.type === 'checkbox' ? e.checked : e.hasAttribute('data-raw') ? e.value : (e.value || '').trim(); });
    return v;
  }
  function onEdit(e) {
    if (e.target.matches('[data-k="country"]')) syncCc();
    if (e.target.closest('[data-eye]')) return;
    if (cur.on) cur.on(e, values());
    created = null; schedule();
  }
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
  form.addEventListener('click', (e) => { const b = e.target.closest('[data-eye]'); if (b) { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; } });

  $('#fillEx').onclick = () => {
    if (!cur.ex) return toast('No example for this type');
    Object.entries(cur.ex).forEach(([k, v]) => { const el = $(`[data-k="${k}"]`, form); if (!el) return; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
    if (cur.on) { const s = $('[data-k="dest"]', form); if (s) cur.on({ target: s }, values()); }
    syncCc(); created = null; refresh();
  };
  $('#clearAll').onclick = () => { form.reset(); initCountries(); created = null; generated = false; refresh(); };

  /* ═══════════ build payload ═══════════ */
  function build() {
    let v = {};
    try {
      v = values();
      const miss = cur.f.find((f) => f.req && !v[f.k]);
      if (miss) return { err: `Fill in “${miss.l}” to see your QR`, v };
      if (cur.chk) { const e = cur.chk(v); if (e) return { err: e, v }; }
      if (cur.upLabel) {
        const fe = fileEl(), f = fe && fe.files[0];
        if (!f) { if (cur.file) return { err: 'Choose a file to upload', v }; }
        else {
          if (!EXT.includes('.' + f.name.split('.').pop().toLowerCase())) return { err: 'This file type is not supported', v };
          if (f.size > 15 * 1048576) return { err: 'File is too large (max 15 MB)', v };
        }
      }
      if (mode === 'dynamic') {
        if (!cur.page && !cur.file && !/^https?:\/\//i.test(cur.b(v) || '')) return { err: 'A Dynamic QR needs a web link (http/https) — choose another format', v };
        return { dyn: true, v };
      }
      const text = cur.b(v);
      return text ? { text, v } : { err: 'Enter your content', v };
    } catch (e) { return { err: 'Please check your input', v }; }
  }

  /* ═══════════ extras (type-specific widgets) ═══════════ */
  const EX = {
    text: {
      init(el) {
        el.innerHTML = `<div class="tb"><button type="button" class="btn btn-ghost sm" data-t="copy">📋 Copy</button><button type="button" class="btn btn-ghost sm" data-t="clear">🗑️ Clear</button><span class="emo">${['😀', '🎉', '❤️', '⭐', '✅', '📍', '📞', '🍽️'].map((e) => `<button type="button" data-e="${e}" aria-label="Insert ${e}">${e}</button>`).join('')}</span></div><div class="cnt" id="cnt"></div><div class="meter"><i id="cntBar"></i></div>`;
        el.onclick = (e) => {
          const b = e.target.closest('button'); if (!b) return;
          const ta = $(`[data-k="${tk()}"]`, form); if (!ta) return;
          if (b.dataset.t === 'copy') navigator.clipboard.writeText(ta.value).then(() => toast('Text copied'));
          if (b.dataset.t === 'clear') { ta.value = ''; ta.focus(); created = null; refresh(); }
          if (b.dataset.e) {
            const s = ta.selectionStart == null ? ta.value.length : ta.selectionStart, en2 = ta.selectionEnd == null ? s : ta.selectionEnd;
            ta.value = ta.value.slice(0, s) + b.dataset.e + ta.value.slice(en2); ta.focus();
            ta.setSelectionRange(s + b.dataset.e.length, s + b.dataset.e.length); created = null; schedule();
          }
        };
      },
      update(v) {
        const s = v[tk()] || '', chars = [...s].length, bytes = new TextEncoder().encode(s).length, lines = s ? s.split(/\r?\n/).length : 0, pct = Math.min(100, Math.round((bytes / CAP[ecl()]) * 100));
        const c = $('#cnt'); if (!c) return;
        c.innerHTML = `<b>${chars}</b> characters · <b>${bytes}</b> bytes (UTF-8) · ${lines} line${lines === 1 ? '' : 's'} · ${pct}% of capacity`;
        $('#cntBar').style.width = pct + '%';
      },
    },
    link: {
      init(el) { el.innerHTML = '<div id="lp"></div>'; },
      update(v) {
        const box = $('#lp'); if (!box) return;
        const u = String(cur.lk ? cur.lk(v) : v.url || '').trim();
        if (!u) { box.innerHTML = ''; return; }
        const x = parseUrl(u);
        if (!x) { box.innerHTML = `<div class="lp bad"><span class="lp-i">!</span><div class="lp-t"><b>Not a valid link yet</b><small>${esc(u.slice(0, 80))}</small></div></div>`; return; }
        const https = x.protocol === 'https:', host = x.hostname.replace(/^www\./, '');
        box.innerHTML = `<div class="lp"><span class="lp-i">${esc(host[0].toUpperCase())}</span><div class="lp-t"><b>${esc(host)}</b><small>${esc((x.pathname + x.search).slice(0, 70) || '/')}</small></div><span class="tag ${https ? 'ok' : 'warn'}">${https ? '🔒 HTTPS' : '⚠️ HTTP'}</span><a class="lnk" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">Open ↗</a></div>${https ? '' : '<p class="hint">This link is not encrypted. Prefer https:// so phones do not show a security warning.</p>'}`;
      },
    },
    file: {
      init(el) { el.innerHTML = '<div id="fileInfo"></div>'; },
      update() {
        const box = $('#fileInfo'); if (!box) return;
        const fe = fileEl(), f = fe && fe.files[0];
        if (!f) { if (prevUrl) URL.revokeObjectURL(prevUrl); prevUrl = null; prevFile = null; box.innerHTML = ''; return; }
        if (f !== prevFile) { if (prevUrl) URL.revokeObjectURL(prevUrl); prevFile = f; prevUrl = f.type.startsWith('image/') ? URL.createObjectURL(f) : null; }
        const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.ceil(f.size / 1024) + ' KB';
        box.innerHTML = `<div class="lp"><span class="lp-i">📎</span><div class="lp-t"><b>${esc(f.name)}</b><small>${size} · ${esc(f.type || 'file')}</small></div></div>${prevUrl ? `<img class="fprev" src="${prevUrl}" alt="">` : ''}`;
      },
    },
    geo: {
      init(el) {
        el.innerHTML = `<div class="tb"><button type="button" class="btn btn-ghost sm" data-g="loc">📍 My location</button><button type="button" class="btn btn-ghost sm" data-g="find">🔎 Find address</button><button type="button" class="btn btn-ghost sm" data-g="copy">📋 Copy coordinates</button></div><div id="map" class="map"><div class="empty">Loading map…</div></div><p class="hint">Click the map or drag the pin to choose a point. Map © OpenStreetMap contributors.</p>`;
        el.onclick = async (e) => {
          const b = e.target.closest('[data-g]'); if (!b) return;
          const v = values();
          if (b.dataset.g === 'copy') { if (v.lat && v.lng) navigator.clipboard.writeText(`${v.lat}, ${v.lng}`).then(() => toast('Coordinates copied')); else toast('Pick a point first'); }
          if (b.dataset.g === 'loc') {
            if (!navigator.geolocation) return toast('Location is not supported in this browser');
            navigator.geolocation.getCurrentPosition((p) => setPoint(p.coords.latitude, p.coords.longitude), () => toast('Location permission was denied'), { enableHighAccuracy: true, timeout: 10000 });
          }
          if (b.dataset.g === 'find') {
            if (!v.address) return toast('Type an address first');
            b.disabled = true;
            try {
              const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + en(v.address)), j = await r.json();
              if (!j.length) toast('Address not found — try adding the city or country'); else setPoint(+j[0].lat, +j[0].lon);
            } catch (err) { toast('Address search is unavailable right now'); }
            b.disabled = false;
          }
        };
        initMap();
      },
      update(v) { syncMap(v); },
    },
  };

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (!leafletP) {
      leafletP = new Promise((res, rej) => {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
        const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        s.onload = () => res(window.L); s.onerror = () => { leafletP = null; rej(new Error('map')); }; document.head.appendChild(s);
      });
    }
    return leafletP;
  }
  async function initMap() {
    const box = $('#map'); if (!box) return;
    try {
      const L = await loadLeaflet();
      if ($('#map') !== box) return;
      box.innerHTML = '';
      map = L.map(box).setView([20.5937, 78.9629], 4);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
      map.on('click', (e) => setPoint(e.latlng.lat, e.latlng.lng));
      syncMap(values());
      setTimeout(() => { if (map) map.invalidateSize(); }, 250);
    } catch (e) { box.innerHTML = '<div class="empty">Map could not load (offline?). You can still type coordinates.</div>'; }
  }
  function syncMap(v) {
    if (!map || !window.L) return;
    const la = parseFloat(v.lat), ln = parseFloat(v.lng);
    if (!isFinite(la) || !isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return;
    const ll = [la, ln];
    if (!pin) {
      pin = window.L.marker(ll, { draggable: true, icon: window.L.divIcon({ className: 'pin', html: '📍', iconSize: [30, 30], iconAnchor: [15, 28] }) }).addTo(map);
      pin.on('dragend', () => { const p = pin.getLatLng(); setPoint(p.lat, p.lng); });
      map.setView(ll, 15);
    } else {
      const p = pin.getLatLng();
      if (Math.abs(p.lat - la) > 1e-6 || Math.abs(p.lng - ln) > 1e-6) { pin.setLatLng(ll); map.setView(ll, Math.max(map.getZoom(), 14)); }
    }
  }
  function setPoint(la, ln) {
    const a = $('[data-k="lat"]', form), b = $('[data-k="lng"]', form); if (!a || !b) return;
    a.value = (+la).toFixed(6); b.value = (+ln).toFixed(6); created = null; refresh();
  }
  const extrasUpdate = (p) => { const X = cur.x && EX[cur.x]; if (X && X.update) X.update(p.v || values(), p); };

  /* ═══════════ style, SVG, frame ═══════════ */
  function opts() {
    const fg = $('#fg').value;
    return { fg, fg2: $('#useGrad').checked ? $('#fg2').value : null, bg: $('#transp').checked ? 'transparent' : $('#bg').value, eye: $('#eyeSame').checked ? fg : $('#eye').value, dots: S.dots, eyes: S.eyes, margin: +$('#margin').value, logo: S.logo, size: +$('#size').value };
  }
  const dims = (px) => [px, Math.round(px * (S.label.trim() ? 1330 / 1100 : 1))];
  function buildSvg(size) {
    const o = Object.assign({}, opts(), { size });
    const label = S.label.trim();
    if (!label) return QRX.svg(rows, o);
    const inner = QRX.svg(rows, Object.assign({}, o, { size: 980 })).replace(/^<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '<svg$1 x="60" y="60" width="980" height="980"');
    const frame = o.fg, light = QRX.lum(frame) > 0.4;
    const fs = Math.max(44, Math.min(120, Math.floor(980 / (Math.max(label.length, 6) * 0.6)))), ty = Math.round(1195 + fs * 0.35);
    const h = dims(size)[1];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1330" width="${size}" height="${h}"><rect width="1100" height="1330" rx="70" fill="${frame}"/><rect x="40" y="40" width="1020" height="1020" rx="24" fill="${o.bg === 'transparent' ? '#ffffff' : o.bg}"/>${inner}<text x="550" y="${ty}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${fs}" fill="${light ? '#111827' : '#ffffff'}">${esc(label)}</text></svg>`;
  }
  function paint() { stage.style.aspectRatio = S.label.trim() ? 'auto' : ''; stage.innerHTML = buildSvg(640); }
  function warnings() {
    if (!stats) return '';
    const o = opts(), w = [];
    if (o.bg !== 'transparent') {
      const c = Math.min(QRX.contrast(o.fg, o.bg), o.fg2 ? QRX.contrast(o.fg2, o.bg) : 99, QRX.contrast(o.eye, o.bg));
      if (c < 3) w.push('⚠️ Low contrast — this code may not scan reliably.');
      else if (QRX.lum(o.fg) > QRX.lum(o.bg)) w.push('⚠️ Light-on-dark (inverted) codes fail on some scanners.');
    } else w.push('ℹ️ Transparent background — place it on a light, plain surface only.');
    if (o.margin < 4) w.push('⚠️ Quiet zone is below the standard 4 modules.');
    if (o.size / (stats.size + 2 * o.margin) < 5) w.push('⚠️ Export size is small for this density — choose a larger size.');
    if (stats.usage > 80) w.push('⚠️ Very dense code — shorten the content or use a Dynamic QR.');
    if (S.logo) w.push('ℹ️ Logo added — error correction raised to H automatically.');
    return w.join('<br>');
  }
  function renderInfo(text, dim) {
    const o = opts(), cm = Math.max(2, Math.round((stats.size + 2 * o.margin) * 0.5) / 10), link = /^https?:\/\//i.test(text);
    $('#info').innerHTML = `<div class="eng"><div><b>v${stats.version}</b><span>Version</span></div><div><b>${stats.size}²</b><span>Modules</span></div><div><b>${stats.bytes}</b><span>Bytes</span></div><div><b>${stats.ecl}</b><span>Error corr.</span></div></div>
<div class="meter"><i style="width:${stats.usage}%"></i></div><p class="mini">${stats.usage}% of capacity · ${esc((stats.modes || []).join(' + ') || 'Byte')} mode · UTF-8 · print at least ${cm} cm wide</p>
${dim ? '<p><b>Preview only.</b> Press “Create Dynamic QR” to get your real, trackable code.</p>' : `${created ? '✅ <b>Dynamic QR created</b> — manage it in your <a class="lnk" href="/dashboard">dashboard</a>.<br>' : generated ? '✅ <b>Generated &amp; verified.</b><br>' : 'This QR contains:'}<code>${esc(text.slice(0, 500))}</code>${link ? `<a class="lnk" href="${esc(text)}" target="_blank" rel="noopener noreferrer">Open link to test ↗</a>` : ''}`}
<div class="warn" id="warn">${warnings()}</div>`;
  }
  const BTNS = ['dlPng', 'dlJpg', 'dlWebp', 'dlSvg', 'print', 'share', 'copy', 'test'];
  const btns = (on) => BTNS.forEach((id) => ($('#' + id).disabled = !on));
  function empty(msg) {
    rows = null; stats = null; stage.style.aspectRatio = ''; stage.style.opacity = 1;
    stage.innerHTML = `<div class="empty">▦<br>${esc(msg)}</div>`;
    $('#info').innerHTML = ''; $('#testRes').innerHTML = ''; btns(false); $('#create').disabled = true; steps();
  }
  function repaint() { if (!rows) return; paint(); const w = $('#warn'); if (w) w.innerHTML = warnings(); }
  function steps() {
    const ok = !!rows, done = [true, ok, touched, ok, generated];
    let act = done.findIndex((d) => !d); if (act < 0) act = 4;
    $$('#stepper li').forEach((li, i) => { li.classList.toggle('done', done[i]); li.classList.toggle('act', i === act); });
  }

  /* ═══════════ render loop ═══════════ */
  const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 250); };
  async function draw(text, dim, my) {
    try {
      const m = await QRX.matrix(text, ecl());
      if (my !== seq) return;
      rows = m.rows; stats = m; lastText = text; generated = !!created;
      stage.style.opacity = dim ? 0.35 : 1; paint(); renderInfo(text, dim); btns(!dim); steps();
    } catch (e) { if (my === seq) empty(e.message); }
  }
  async function refresh() {
    const p = build(), my = ++seq;
    btns(false); extrasUpdate(p);
    if (p.err) return empty(p.err);
    $('#create').disabled = false;
    if (p.dyn) return created ? draw(created.url, false, my) : draw(location.origin + '/q/preview', true, my);
    draw(p.text, false, my);
  }

  /* ═══════════ generate ═══════════ */
  async function generate() {
    if (mode === 'dynamic') return createDynamic();
    if (!rows) return;
    const b = $('#create'); b.disabled = true; b.textContent = 'Generating…';
    try {
      await QRX.api('/api/qr/validate', { method: 'POST', body: { text: lastText, ecl: ecl() } });
      generated = true; renderInfo(lastText, false); btns(true); steps();
      stage.classList.add('pop'); setTimeout(() => stage.classList.remove('pop'), 900);
      toast('QR generated ✨ Download, print or share it below');
      testScan();
    } catch (e) { toast(e.message); }
    b.textContent = '⚡ Generate QR'; b.disabled = false;
  }
  async function createDynamic() {
    if (!QRX.token()) { toast('Please log in to create Dynamic QR codes'); return setTimeout(() => (location.href = '/login?next=' + en('/qr-generator?type=' + cur.id + '&mode=dynamic')), 900); }
    const p = build(); if (p.err) return toast(p.err);
    const v = p.v, fd = new FormData(), kind = cur.page ? 'page' : cur.file ? 'file' : 'url';
    fd.append('type', cur.id); fd.append('kind', kind); fd.append('title', v.title || v.name || cur.n);
    if (kind === 'page') { const d = {}; Object.keys(v).forEach((k) => { if (v[k] !== '' && v[k] !== false) d[k] = v[k]; }); fd.append('data', JSON.stringify(d)); }
    else if (kind === 'url') fd.append('target', cur.b(v));
    const f = fileEl(); if (f && f.files[0]) fd.append('file', f.files[0]);
    const b = $('#create'); b.disabled = true; b.textContent = 'Creating…';
    try { created = await QRX.api('/api/dynamic', { method: 'POST', body: fd }); toast('Dynamic QR created ✨'); await refresh(); testScan(); }
    catch (e) { toast(e.message); }
    b.textContent = '🔄 Create Dynamic QR'; b.disabled = false;
  }
  $('#create').onclick = generate;

  /* ═══════════ scan test (Chrome / Edge BarcodeDetector) ═══════════ */
  function toCanvas(svg, w, h, white) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); } x.drawImage(img, 0, 0, w, h); res(c); };
      img.onerror = () => rej(new Error('Could not render the image'));
      img.src = QRX.svgUrl(svg);
    });
  }
  async function testScan() {
    const out = $('#testRes'); if (!rows) return;
    if (!('BarcodeDetector' in window)) { out.innerHTML = '<div class="note">🧪 Auto scan-test is not available in this browser (works in Chrome / Edge). Always test with a real phone before printing.</div>'; return; }
    out.innerHTML = '<div class="note">🧪 Testing scan…</div>';
    try {
      const d = dims(720), c = await toCanvas(buildSvg(720), d[0], d[1], true);
      const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(c), norm = (s) => String(s).replace(/\r/g, '');
      out.innerHTML = r.length && norm(r[0].rawValue) === norm(lastText) ? '<div class="note ok">✅ Scan test passed — the code decodes to exactly your content.</div>'
        : r.length ? '<div class="note">⚠️ The code decoded, but the text differs slightly. Check it with your phone.</div>'
        : '<div class="note">⚠️ This browser could not read the code. Increase contrast, shrink the logo or raise error correction, then test again.</div>';
    } catch (e) { out.innerHTML = '<div class="note">🧪 Scan test unavailable here. Please test with your phone.</div>'; }
  }

  /* ═══════════ export ═══════════ */
  const fname = (x) => `qrnova-${cur.id}.${x}`;
  function safePx(px) {
    if (!S.label.trim()) return px;
    const m = Math.floor(Math.sqrt(16777216 / (1330 / 1100))) - 2;
    return Math.min(px, m);
  }
  async function exportImg(mime) {
    const want = +$('#size').value, px = safePx(want);
    if (px < want) toast(`Framed exports are limited to ${px}px wide`);
    const d = dims(px), c = await toCanvas(buildSvg(px), d[0], d[1], mime !== 'image/png');
    const blob = await new Promise((r) => c.toBlob(r, mime, 0.95));
    if (!blob) throw new Error('Your browser could not create this file');
    QRX.save(blob, fname(blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'));
  }
  const wrap = (fn) => async () => { try { await fn(); } catch (e) { toast(e.message || 'Export failed'); } };
  $('#dlPng').onclick = wrap(() => exportImg('image/png'));
  $('#dlJpg').onclick = wrap(() => exportImg('image/jpeg'));
  $('#dlWebp').onclick = wrap(() => exportImg('image/webp'));
  $('#dlSvg').onclick = () => QRX.save(new Blob([buildSvg(+$('#size').value)], { type: 'image/svg+xml' }), fname('svg'));
  $('#copy').onclick = () => navigator.clipboard.writeText(lastText).then(() => toast('Content copied'));
  $('#test').onclick = testScan;
  $('#print').onclick = () => {
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print');
    w.document.write(`<!doctype html><title>QR code</title><body style="margin:0;display:grid;place-items:center;min-height:100vh"><img src="${QRX.svgUrl(buildSvg(1200))}" style="max-width:90vw;max-height:90vh" onload="setTimeout(function(){print()},250)">`);
    w.document.close();
  };
  $('#share').onclick = wrap(async () => {
    const d = dims(1024), c = await toCanvas(buildSvg(1024), d[0], d[1], true);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')), file = new File([blob], 'qrnova.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'My QR code' });
    else { await navigator.clipboard.writeText(lastText); toast('Sharing is not supported here — content copied'); }
  });

  /* ═══════════ customize controls ═══════════ */
  const touch = () => { touched = true; steps(); };
  const PRESETS = [['Midnight', '#111827', null, '#111827'], ['Aurora', '#7c5cff', '#22d3ee', '#ff5ea8'], ['Sunset', '#ff5e62', '#ff9966', '#c2185b'], ['Ocean', '#0ea5e9', '#2563eb', '#0b3b8f'], ['Forest', '#16a34a', '#065f46', '#064e3b'], ['Berry', '#c026d3', '#7c3aed', '#701a75']];
  $('#presets').innerHTML = PRESETS.map((p, i) => `<button type="button" title="${p[0]}" data-i="${i}" style="background:linear-gradient(135deg,${p[1]},${p[2] || p[1]})"></button>`).join('');
  $$('#presets button').forEach((b) => (b.onclick = () => {
    const p = PRESETS[b.dataset.i];
    $('#fg').value = p[1]; if (p[2]) $('#fg2').value = p[2]; $('#useGrad').checked = !!p[2]; $('#eye').value = p[3]; $('#eyeSame').checked = false; $('#eyeWrap').hidden = false;
    touch(); repaint();
  }));
  ['dots', 'eyes'].forEach((k) => $$(`#${k} button`).forEach((b) => (b.onclick = () => { S[k] = b.dataset.v; $$(`#${k} button`).forEach((x) => x.classList.toggle('on', x === b)); touch(); repaint(); })));
  ['fg', 'fg2', 'bg', 'eye', 'useGrad', 'transp', 'size', 'margin'].forEach((id) => $('#' + id).addEventListener('input', () => { if (id === 'margin') $('#marginOut').textContent = $('#margin').value + ' modules'; touch(); repaint(); }));
  $('#ecl').addEventListener('input', () => { touch(); refresh(); });
  $('#eyeSame').addEventListener('input', () => { $('#eyeWrap').hidden = $('#eyeSame').checked; touch(); repaint(); });
  $('#label').addEventListener('input', (e) => { S.label = e.target.value; S.labelAuto = false; touch(); repaint(); });
  $('#logo').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 400 * 1024) { e.target.value = ''; return toast('Logo must be under 400 KB'); }
    const r = new FileReader();
    r.onload = () => { S.logo = r.result; $('#ecl').disabled = true; touch(); refresh(); toast('Logo added — error correction set to H'); };
    r.readAsDataURL(f);
  });
  $('#logoClear').onclick = () => { S.logo = null; $('#logo').value = ''; $('#ecl').disabled = false; refresh(); };
  $$('#stepper li').forEach((li) => (li.onclick = () => { const n = +li.dataset.s, t = n <= 3 ? $('#sec' + n) : n === 4 ? stage : $('#create'); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));

    
    /* ═══════════ send to the Design Studio (Part 6) ═══════════ */
  (() => {
    const a = document.createElement('a');
    a.className = 'btn btn-ghost sm'; a.id = 'toDesign'; a.textContent = '🎨 Design & save'; a.href = '/design-studio';
    ($('#dl') || $('#create').parentNode).appendChild(a);
    a.addEventListener('click', (e) => {
      if (!lastText) { e.preventDefault(); return toast('Create your QR content first'); }
      a.href = '/design-studio?data=' + encodeURIComponent(lastText.slice(0, 2500));
    });
  })();

  /* ═══════════ init ═══════════ */
  const q = new URLSearchParams(location.search);
  let id = q.get('type') || 'url';
  const pre = { dyn: q.get('mode') === 'dynamic' };
  if (PRESET[id]) { pre.vals = PRESET[id][1]; id = PRESET[id][0]; }
  if (BYID[id] && BYID[id].href) { location.replace(BYID[id].href); return; }
  setType(BYID[id] ? id : 'url', pre);
})();
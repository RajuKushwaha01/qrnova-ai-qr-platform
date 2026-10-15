(() => {
  'use strict';
  const CAP = { L: 2953, M: 2331, Q: 1663, H: 1273 };
  const en = encodeURIComponent;
  const bytesOf = (s) => new TextEncoder().encode(String(s)).length;
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const trimP = (s) => String(s || '').replace(/[.,;:!?)\]}'"”’]+$/, '');
  const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const p2 = (n) => String(n).padStart(2, '0');
  const val = (v, k) => (v && v[k] != null ? String(v[k]).trim() : '');
  const B = {};

  /* ═══════ colour ═══════ */
  const lum = (h) => { const n = parseInt(String(h).slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const darken = (h, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(h.substr(i, 2), 16) * f).toString(16).padStart(2, '0')).join('');
  const ensure = (h, bg, min) => { let n = 0; while (contrast(h, bg) < min && n++ < 14) h = darken(h, 0.88); return h; };
  B.lum = lum; B.contrast = contrast;
  B.defaultStyle = () => ({ fg: '#6d28d9', fg2: '#0e7490', bg: '#ffffff', eye: '#be185d', dots: 'rounded', eyes: 'rounded', margin: 4, useGrad: true, transp: false });

  /* ═══════ basics: text, url, email, phone, date, time ═══════ */
  B.cleanText = (s) => String(s || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  B.emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim()) && !/\.\./.test(s);
  B.fixUrl = (u) => { u = String(u || '').trim(); if (!u) return ''; if (/^\/\//.test(u)) return 'https:' + u; return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : 'https://' + u; };
  B.parseUrl = (u) => {
    u = String(u || '').trim();
    if (!u || /\s/.test(u) || /^(?:javascript|data|vbscript|file|blob):/i.test(u)) return null;
    try { const x = new URL(B.fixUrl(u)); if (!/^https?:$/.test(x.protocol)) return null; return /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|.+\.[a-z0-9-]{2,})$/i.test(x.hostname) ? x : null; } catch (e) { return null; }
  };
  B.stripTracking = (u) => { try { const x = new URL(u); [...x.searchParams.keys()].forEach((k) => { if (/^(utm_|fbclid$|gclid$|igshid$|mc_eid$)/i.test(k)) x.searchParams.delete(k); }); return x.href; } catch (e) { return u; } };
  B.cc = () => { try { const r = ((navigator.language || '').split('-')[1] || '').toUpperCase(); const c = (window.COUNTRIES || []).find((x) => x.c === r); return c ? c.d : '91'; } catch (e) { return '91'; } };
  B.phone = (raw) => {
    raw = String(raw || '').trim();
    if (!/\d/.test(raw)) return { ok: false, e164: '', pretty: raw };
    const cc = B.cc(); let d = raw.replace(/[^\d+]/g, '');
    if (d.startsWith('00')) d = '+' + d.slice(2);
    if (!d.startsWith('+')) { d = d.replace(/^0+/, ''); d = d.startsWith(cc) && d.length >= cc.length + 10 ? '+' + d : '+' + cc + d; }
    const ok = /^\+\d{8,15}$/.test(d), n = d.slice(1);
    return { ok, e164: d, pretty: ok && n.startsWith(cc) && n.length === cc.length + 10 ? `+${cc} ${n.slice(cc.length, cc.length + 5)} ${n.slice(cc.length + 5)}` : d };
  };
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const yearFor = (m, d) => { const n = new Date(); let y = n.getFullYear(); if (new Date(y, m - 1, d) < new Date(n.toDateString())) y++; return y; };
  B.parseDate = (s) => {
    s = String(s || '').trim().toLowerCase(); let m;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/))) return `${+m[3] < 100 ? +m[3] + 2000 : +m[3]}-${p2(m[2])}-${p2(m[1])}`;
    if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?\s*(\d{4})?$/)) && MON[m[2].slice(0, 3)]) { const mo = MON[m[2].slice(0, 3)]; return `${m[3] || yearFor(mo, +m[1])}-${p2(mo)}-${p2(m[1])}`; }
    if ((m = s.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?$/)) && MON[m[1].slice(0, 3)]) { const mo = MON[m[1].slice(0, 3)]; return `${m[3] || yearFor(mo, +m[2])}-${p2(mo)}-${p2(m[2])}`; }
    return '';
  };
  B.relDate = (t) => {
    const L = String(t).toLowerCase(), d = new Date(), iso = (x) => `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
    if (/\bday after tomorrow\b/.test(L)) { d.setDate(d.getDate() + 2); return iso(d); }
    if (/\btomorrow\b/.test(L)) { d.setDate(d.getDate() + 1); return iso(d); }
    if (/\b(?:today|tonight)\b/.test(L)) return iso(d);
    const m = L.match(/\b(?:next|this|on)\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
    if (!m) return '';
    d.setDate(d.getDate() + ((['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1]) - d.getDay() + 7) % 7 || 7)); return iso(d);
  };
  B.parseTime = (s) => {
    const m = String(s || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/); if (!m) return '';
    let h = +m[1]; const mi = m[2] || '00';
    if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0;
    return h > 23 || +mi > 59 ? '' : `${p2(h)}:${mi}`;
  };

  /* ═══════ entity extraction (4.4) ═══════ */
  const MONRE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
  const DATERE = new RegExp('\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:' + MONRE + ')\\.?(?:,?\\s+\\d{4})?\\b|\\b(?:' + MONRE + ')\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b', 'gi');
  const TIMERE = /\b\d{1,2}:\d{2}\s?(?:am|pm)?\b|\b\d{1,2}\s?(?:am|pm)\b/gi;
  const PRICERE = /(?:[₹$€£]|\b(?:rs\.?|inr|usd|eur))\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:rupees|dollars|euros)\b/gi;
  const GEORE = /(-?\d{1,2}\.\d{3,})\s*[,;]\s*(-?\d{1,3}\.\d{3,})/;
  const EMAILRE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
  const UPIRE = /\b[\w.-]{2,}@[a-z][a-z0-9]{1,24}\b/gi;
  const URLRE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|io|co|app|dev|ai|me|store|shop|info|xyz|edu|gov|biz|online|site|tech|studio|design|pro|us|uk|ca|au|de|fr|eu|tv|page|link|club|blog)\b(?:\/[^\s<>"']*)?/gi;
  const PHONERE = /(?:\+|\b00)?\d[\d ().\-\t]{6,}\d/g;
  const PLAT = { instagram: 'instagram', insta: 'instagram', facebook: 'facebook', fb: 'facebook', linkedin: 'linkedin', youtube: 'youtube', yt: 'youtube', twitter: 'x', github: 'github', telegram: 'telegram', tiktok: 'tiktok', snapchat: 'snapchat' };
  const SOC_HOST = [['instagram.com', 'instagram'], ['facebook.com', 'facebook'], ['fb.com', 'facebook'], ['linkedin.com', 'linkedin'], ['youtube.com', 'youtube'], ['youtu.be', 'youtube'], ['x.com', 'x'], ['twitter.com', 'x'], ['github.com', 'github'], ['tiktok.com', 'tiktok'], ['snapchat.com', 'snapchat']];
  const socialOf = (u) => { try { const h = new URL(B.fixUrl(u)).hostname.replace(/^www\./, '').toLowerCase(); const r = SOC_HOST.find((x) => h === x[0] || h.endsWith('.' + x[0])); return r ? r[1] : ''; } catch (e) { return ''; } };
  const isMaps = (u) => /^https?:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?openstreetmap\.org|maps\.apple\.com)/i.test(u);
  const isReview = (u) => /g\.page\/r\/|writereview|tripadvisor\.[a-z.]+\/UserReview|trustpilot\.com\/evaluate|yelp\.com\/writeareview|\/reviews?(?:[\/?#]|$)/i.test(u);
  const CATS = [['Hotel', /\b(?:hotel|resort|hostel|motel|guest ?house|homestay|lodge|inn)\b/i], ['Restaurant', /\b(?:restaurant|cafe|café|diner|bakery|bistro|eatery|food|kitchen|dhaba|pizzeria|canteen|pub)\b/i], ['Healthcare', /\b(?:clinic|hospital|doctor|dentist|dental|pharmacy|medical|physio|diagnostic|nursing)\b/i], ['Education', /\b(?:school|college|university|academy|institute|tuition|coaching|course|classes|training)\b/i], ['Real estate', /\b(?:real estate|property|apartment|realtor|builder)\b/i], ['Salon & beauty', /\b(?:salon|spa|beauty|barber|parlou?r|makeup)\b/i], ['Fitness', /\b(?:gym|fitness|yoga|crossfit)\b/i], ['Retail', /\b(?:shop|store|boutique|showroom|supermarket|retail)\b/i], ['Portfolio', /\b(?:portfolio|freelancer|designer|photographer)\b/i], ['Tech', /\b(?:startup|software|saas|developer|agency)\b/i]];
  const FILEL = { pdf: 'PDF document', image: 'Image', video: 'Video', audio: 'Audio', document: 'Document' };

  const grab = (t, labels, stops) => { const m = t.match(new RegExp('(?:' + labels + ')\\s*(?:is|are|=|:|-)?\\s*["“]?([^\\n]+?)["”]?(?=\\s+(?:' + (stops || 'zzzz') + ')\\s*(?:is|=|:|-)|\\n|$)', 'i')); return m ? m[1].trim() : ''; };
  const msgAfter = (t, words) => {
    let m = t.match(new RegExp('(?:' + words + ')\\s*(?:is|=|:)?\\s*["“]([^"”]+)["”]', 'i')); if (m) return m[1].trim();
    m = t.match(new RegExp('(?:' + words + ')\\s*(?:is|=|:)\\s*(.+)$', 'im')); if (m) return m[1].trim();
    m = t.match(/\b(?:saying|that says)\s+(.+)$/im); return m ? m[1].trim() : '';
  };
  function wifiFrom(t) {
    let ssid = '', pass = '', m;
    const q = t.match(/(?:ssid|network|wi-?fi)[^"“'\n]{0,30}["“']([^"”']{1,32})["”']/i);
    if (q) ssid = q[1];
    else {
      const re = /(?:ssid|network(?:\s+name)?|wi-?fi(?:\s+(?:name|network))?)\s*(?:name\s*)?(?:is|=|:|called|named)?\s*["“']?([^\s"”',;]+)/gi;
      while ((m = re.exec(t))) { if (!/^(password|passcode|pass|pwd|is|the|for|my|a|an|name|network|qr|code|with|and|to|of|please|that|which)$/i.test(m[1])) { ssid = m[1].replace(/\.+$/, ''); break; } }
    }
    const pq = t.match(/(?:password|passcode|pwd)\s*(?:is|=|:)?\s*["“']([^"”']+)["”']/i);
    if (pq) pass = pq[1];
    else { const pm = t.match(/(?:password|passcode|pwd|pass)\s*(?:is|=|:)?\s*([^\s"”',;]+)/i); if (pm && !/^(is|the|protected)$/i.test(pm[1])) pass = pm[1].replace(/\.+$/, ''); }
    if (!/wi-?fi|wireless|ssid/i.test(t) && !(ssid && pass)) return null;
    const enc = /\b(?:no password|open network|without (?:a )?password|passwordless|no security|open wi-?fi)\b/i.test(t) ? 'nopass' : /\bwep\b/i.test(t) ? 'WEP' : /\bwpa-?3\b|\bsae\b/i.test(t) ? 'SAE' : 'WPA';
    return { ssid, pass, enc, hidden: /\bhidden\b/i.test(t) };
  }
  function findAddress(t) {
    const STOP = /\b(?:phone|call|tel|mobile|contact|email|e-mail|website|web ?site|url|hours|opening|open|timings?|menu)\b/i;
    const m = t.match(/\b(?:address|located (?:at|in|on)|situated (?:at|in)|find us at|we are at|visit us at)\s*(?:is|:|-)?\s*([^\n;]{6,160})/i);
    if (m) { const a = m[1].split(STOP)[0].replace(/[\s,.;:-]+$/, '').trim(); if (a.length >= 6) return a; }
    const line = t.split(/\n/).find((l) => /\d/.test(l) && /\b(?:street|st\.|road|rd\.?|avenue|ave\.?|lane|nagar|colony|sector|block|floor|plot|flat|apartment|building|marg|chowk|near|pin(?:code)?)\b/i.test(l) && l.length >= 8 && l.length <= 160);
    return line ? line.trim() : '';
  }
  function nameFrom(t) {
    const KW = 'Hotel|Restaurant|Cafe|Café|Clinic|Hospital|Salon|Studio|Store|Shop|Bakery|Resort|Gym|School|Academy|Pharmacy|Inn|Lodge|Kitchen|Dental|Spa';
    let m = t.match(/(?:called|named|name is|name:|business is|brand is|company is)\s+["“']?([A-Za-z0-9][\w&'’.\- ]{1,50}?)["”']?(?=$|[,.;\n]|\s+(?:and|with|at|in|on|located|phone|email|website|which|that|who|offering|serving|containing)\b)/i);
    if (m) return m[1].trim();
    m = t.match(new RegExp("\\b(?:for|of)\\s+(?:the\\s+|my\\s+|our\\s+)?([A-Z][\\w&'’\\-]+(?:\\s+[A-Z][\\w&'’\\-]+){0,4}\\s+(?:" + KW + '))\\b'));
    if (m) return m[1].trim();
    m = t.match(new RegExp("\\b([A-Z][\\w&'’\\-]+(?:\\s+[A-Z][\\w&'’\\-]+){0,4}\\s+(?:" + KW + '))\\b'));
    if (m) return m[1].trim();
    m = t.match(/["“]([A-Z0-9][^"”]{1,50})["”]/);
    return m ? m[1].trim() : '';
  }
  function personFrom(t) {
    const m = t.match(/(?:[Mm]y name is|\b[Ii] am|\b[Ii]'m|[Cc]ontact(?: card)? (?:for|of)|[Vv]-?[Cc]ard (?:for|of)|[Bb]usiness card (?:for|of)|[Cc]ard for)\s+(?:(?:Dr|Mr|Ms|Mrs)\.?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
    return m ? m[1] : '';
  }
  B.entities = (text) => {
    const t = String(text || '');
    let rest = ' ' + t + ' ';
    const all = (re) => { const o = []; rest = rest.replace(re, (m) => { o.push(m); return ' '; }); return o; };
    const one = (re) => { const m = rest.match(re); if (m) rest = rest.replace(m[0], ' '); return m; };
    const e = { dates: all(DATERE), times: all(TIMERE), prices: all(PRICERE) };
    const g = one(GEORE); e.geo = g ? { lat: g[1], lng: g[2] } : null;
    e.emails = all(EMAILRE); e.upi = all(UPIRE);
    e.urls = all(URLRE).map(trimP).filter(Boolean);
    e.phones = all(PHONERE).map((s) => s.trim()).filter((s) => { const n = s.replace(/\D/g, '').length; return n >= 8 && n <= 15; });
    e.rest = rest;
    const ps = Object.keys(PLAT).join('|');
    const sm = rest.match(new RegExp('\\b(' + ps + ')\\b[^@\\n]{0,30}?@([\\w.]{2,30})', 'i')) || rest.match(new RegExp('\\b(' + ps + ')\\b\\s*(?:is|handle is|username is|:)\\s*@?([\\w.]{3,30})', 'i'));
    const su = e.urls.map(B.fixUrl).map((u) => [u, socialOf(u)]).find((x) => x[1]);
    e.social = sm ? { p: PLAT[sm[1].toLowerCase()], h: sm[2] } : su ? { p: su[1], h: su[0] } : null;
    e.wifi = wifiFrom(t); e.address = findAddress(t); e.name = nameFrom(t); e.person = personFrom(t);
    const cm = CATS.find((c) => c[1].test(t)); e.category = cm ? cm[0] : '';
    e.fileKind = /\bpdf\b/i.test(t) ? 'pdf' : /\b(?:image|photo|picture|poster|flyer|brochure)\b/i.test(t) ? 'image' : /\bvideo\b/i.test(t) ? 'video' : /\b(?:audio|song|podcast|mp3)\b/i.test(t) ? 'audio' : /\b(?:document|docx?|spreadsheet|excel|powerpoint|presentation|resume|cv|catalogu?e)\b/i.test(t) ? 'document' : '';
    e.mentions = { location: /\b(?:location|address|map|directions|coordinates)\b/i.test(t), phone: /\b(?:phone|call|mobile|contact number)\b/i.test(t), email: /\be-?mail\b/i.test(t), website: /\b(?:web ?site|web page|link|url)\b/i.test(t), hours: /\b(?:hours|timings?|opening)\b/i.test(t) };
    return e;
  };

  /* ═══════ QR types: fields, builders, checks ═══════ */
  const F = (k, l, o) => Object.assign({ k, l, t: 'text' }, o);
  const SOCIALS = { instagram: ['Instagram', 'https://instagram.com/'], facebook: ['Facebook', 'https://facebook.com/'], linkedin: ['LinkedIn', 'https://linkedin.com/in/'], youtube: ['YouTube', 'https://youtube.com/@'], x: ['X (Twitter)', 'https://x.com/'], github: ['GitHub', 'https://github.com/'], tiktok: ['TikTok', 'https://tiktok.com/@'], snapchat: ['Snapchat', 'https://snapchat.com/add/'] };
  const TYPO = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'hotmial.com': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'outlok.com': 'outlook.com' };
  const socialLink = (v) => { const h = val(v, 'h'); if (!h) return ''; if (v.p === 'custom' || /^(?:https?:\/\/|www\.)/i.test(h)) return B.fixUrl(h); return (SOCIALS[v.p] || SOCIALS.instagram)[1] + h.replace(/^@/, ''); };
  const waLink = (v) => { const p = B.phone(val(v, 'phone')).e164.slice(1); return p ? `https://wa.me/${p}${val(v, 'msg') ? '?text=' + en(val(v, 'msg')) : ''}` : ''; };
  const tgLink = (v) => { const u = val(v, 'user'); return /^https?:/i.test(u) ? u : u ? 'https://t.me/' + u.replace(/^@/, '') : ''; };
  const locStr = (v) => { const la = val(v, 'lat'), ln = val(v, 'lng'); return la !== '' && ln !== '' ? `${+la},${+ln}` : ''; };
  const locLink = (v) => (v.fmt === 'url' ? (val(v, 'mapurl') ? B.fixUrl(val(v, 'mapurl')) : '') : 'https://www.google.com/maps/search/?api=1&query=' + en(locStr(v) || val(v, 'address')));
  const vEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const wEsc = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');
  const UID = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + '-' + Math.random().toString(36).slice(2, 10) + '@qrnova';
  const urlChk = (v, k, label, add) => {
    const raw = val(v, k); if (!raw) return;
    if (/^(?:javascript|data|vbscript|file|blob):/i.test(raw)) return add('error', k, `${label}: this kind of link is unsupported or unsafe`);
    if (/\s/.test(raw)) return add('error', k, `${label} cannot contain spaces`, { k, v: raw.replace(/\s+/g, ''), label: 'Remove spaces' });
    const u = B.parseUrl(raw);
    if (!u) return add('error', k, `${label} is not a valid web address (example: https://example.com)`);
    if (!/^https?:\/\//i.test(raw)) add('info', k, `${label}: I will add https:// for you`, { k, v: u.href, label: 'Apply' });
    else if (u.protocol === 'http:') add('warn', k, `${label} uses http:// (not encrypted) — phones may show a warning`, { k, v: 'https://' + u.href.slice(7), label: 'Use https' });
    if (/(?:^|&)(?:utm_[a-z]+|fbclid|gclid)=/i.test(u.search.slice(1))) add('info', k, `${label} has tracking parameters that make the QR denser`, { k, v: B.stripTracking(u.href), label: 'Remove them' });
  };
  const phoneChk = (v, k, label, add) => {
    const raw = val(v, k); if (!raw) return;
    const p = B.phone(raw);
    if (!p.ok) return add('error', k, `${label} looks invalid — use digits with a country code, e.g. +91 98765 43210`);
    if (raw !== p.e164 && raw !== p.pretty) add('info', k, `Standard format: ${p.pretty}`, { k, v: p.e164, label: 'Use it' });
  };
  const mailChk = (v, k, label, add) => {
    const raw = val(v, k); if (!raw) return;
    if (!B.emailOk(raw)) return add('error', k, `${label} is not a valid email address`);
    const [u, d] = raw.split('@');
    if (TYPO[d.toLowerCase()]) add('warn', k, `Did you mean ${u}@${TYPO[d.toLowerCase()]}?`, { k, v: u + '@' + TYPO[d.toLowerCase()], label: 'Fix typo' });
    else if (raw !== raw.toLowerCase()) add('info', k, 'Emails are best written in lowercase', { k, v: raw.toLowerCase(), label: 'Lowercase' });
  };
  const pageChk = (v, add) => { ['website', 'maps', 'review', 'social', 'menu', 'buy'].forEach((k) => urlChk(v, k, cap(k) + ' link', add)); mailChk(v, 'email', 'Email', add); phoneChk(v, 'phone', 'Phone', add); };

  B.TYPES = {
    text: { label: 'Text', icon: '📝', dyn: 'no', fields: [F('text', 'Text', { t: 'area', req: 1, rows: 4 })], build: (v) => v.text,
      check: (v, add) => { const d = direct(val(v, 'text')); if (d && d.type !== 'text') add('info', 'text', `This looks like ${/^[aeiou]/i.test(B.TYPES[d.type].label) ? 'an' : 'a'} ${B.TYPES[d.type].label} — a ${B.TYPES[d.type].label} QR gives phones a one-tap action`, { type: d.type, fields: d.fields, label: 'Switch type' }); } },
    url: { label: 'Website', icon: '🌐', dyn: 'opt', fields: [F('url', 'Website URL', { req: 1, ph: 'https://example.com' })], build: (v) => B.fixUrl(v.url), link: (v) => B.fixUrl(v.url), check: (v, add) => urlChk(v, 'url', 'Website', add) },
    email: { label: 'Email', icon: '✉️', dyn: 'no', fields: [F('to', 'Email address', { t: 'email', req: 1 }), F('subject', 'Subject'), F('body', 'Message', { t: 'area', rows: 3 })],
      build: (v) => { const q = []; if (val(v, 'subject')) q.push('subject=' + en(v.subject)); if (val(v, 'body')) q.push('body=' + en(String(v.body).replace(/\r?\n/g, '\r\n'))); return 'mailto:' + val(v, 'to') + (q.length ? '?' + q.join('&') : ''); }, check: (v, add) => mailChk(v, 'to', 'Email address', add) },
    phone: { label: 'Phone', icon: '📞', dyn: 'no', fields: [F('phone', 'Phone number', { t: 'tel', req: 1, ph: '+91 98765 43210' })], build: (v) => 'tel:' + B.phone(v.phone).e164, check: (v, add) => phoneChk(v, 'phone', 'Phone number', add) },
    sms: { label: 'SMS', icon: '💬', dyn: 'no', fields: [F('phone', 'Phone number', { t: 'tel', req: 1 }), F('msg', 'Message', { t: 'area', rows: 3 })], build: (v) => `sms:${B.phone(v.phone).e164}${val(v, 'msg') ? '?body=' + en(v.msg) : ''}`, check: (v, add) => phoneChk(v, 'phone', 'Phone number', add) },
    whatsapp: { label: 'WhatsApp', icon: '🟢', dyn: 'opt', fields: [F('phone', 'WhatsApp number', { t: 'tel', req: 1 }), F('msg', 'Pre-filled message', { t: 'area', rows: 3 })], build: waLink, link: waLink,
      check: (v, add) => { phoneChk(v, 'phone', 'WhatsApp number', add); if (val(v, 'msg').length > 1000) add('warn', 'msg', 'Very long pre-filled messages may be cut off'); } },
    telegram: { label: 'Telegram', icon: '✈️', dyn: 'opt', fields: [F('user', 'Username or link', { req: 1, ph: '@username' })], build: tgLink, link: tgLink,
      check: (v, add) => { const u = val(v, 'user'); if (u && !/^(@?[A-Za-z0-9_]{4,32}|https?:\/\/t\.me\/\S+)$/.test(u)) add('error', 'user', 'Telegram usernames are 4–32 letters, numbers or _'); } },
    social: { label: 'Social media', icon: '📱', dyn: 'opt', fields: [F('p', 'Platform', { t: 'select', o: Object.keys(SOCIALS).map((k) => [k, SOCIALS[k][0]]).concat([['custom', 'Custom social URL']]) }), F('h', 'Username or profile link', { req: 1, ph: '@yourname' })], build: socialLink, link: socialLink,
      check: (v, add) => { const l = socialLink(v); if (l && !B.parseUrl(l)) add('error', 'h', 'This does not form a valid profile link'); } },
    vcard: { label: 'Contact / vCard', icon: '👤', dyn: 'no',
      fields: [F('first', 'First name', { req: 1, h: 1 }), F('last', 'Last name', { h: 1 }), F('mobile', 'Mobile', { t: 'tel', h: 1 }), F('phone', 'Phone', { t: 'tel', h: 1 }), F('email', 'Email', { t: 'email', h: 1 }), F('website', 'Website', { h: 1 }), F('org', 'Company', { h: 1 }), F('jobtitle', 'Job title', { h: 1 }), F('street', 'Street address'), F('city', 'City', { h: 1 }), F('state', 'State', { h: 1 }), F('zip', 'Postal code', { h: 1 }), F('ctry', 'Country', { h: 1 }), F('note', 'Notes', { t: 'area', rows: 2 })],
      build: (v) => { const L = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEsc(v.last)};${vEsc(v.first)};;;`, 'FN:' + vEsc([v.first, v.last].filter(Boolean).join(' '))]; if (val(v, 'org')) L.push('ORG:' + vEsc(v.org)); if (val(v, 'jobtitle')) L.push('TITLE:' + vEsc(v.jobtitle)); if (val(v, 'phone')) L.push('TEL;TYPE=WORK,VOICE:' + B.phone(v.phone).e164); if (val(v, 'mobile')) L.push('TEL;TYPE=CELL,VOICE:' + B.phone(v.mobile).e164); if (val(v, 'email')) L.push('EMAIL;TYPE=INTERNET:' + v.email); if (val(v, 'website')) L.push('URL:' + B.fixUrl(v.website)); if (val(v, 'street') || val(v, 'city') || val(v, 'state') || val(v, 'zip') || val(v, 'ctry')) L.push(`ADR;TYPE=WORK:;;${vEsc(v.street)};${vEsc(v.city)};${vEsc(v.state)};${vEsc(v.zip)};${vEsc(v.ctry)}`); if (val(v, 'note')) L.push('NOTE:' + vEsc(v.note)); L.push('END:VCARD'); return L.join('\r\n'); },
      check: (v, add) => { phoneChk(v, 'mobile', 'Mobile', add); phoneChk(v, 'phone', 'Phone', add); mailChk(v, 'email', 'Email', add); urlChk(v, 'website', 'Website', add); } },
    wifi: { label: 'Wi-Fi', icon: '📶', dyn: 'no', fields: [F('ssid', 'Network name (SSID)', { req: 1 }), F('pass', 'Password', { t: 'password' }), F('enc', 'Security', { t: 'select', o: [['WPA', 'WPA / WPA2 (recommended)'], ['SAE', 'WPA3 — newer devices only'], ['WEP', 'WEP (legacy)'], ['nopass', 'Open — no password']] }), F('hidden', 'Hidden network', { t: 'check' })],
      build: (v) => `WIFI:T:${v.enc || 'WPA'};S:${wEsc(v.ssid)};${v.enc === 'nopass' ? '' : 'P:' + wEsc(v.pass) + ';'}${v.hidden ? 'H:true;' : ''};`,
      check: (v, add) => {
        const pass = v.pass == null ? '' : String(v.pass), enc = v.enc || 'WPA';
        if (bytesOf(val(v, 'ssid')) > 32) add('error', 'ssid', 'Network names can be at most 32 bytes');
        if ((enc === 'WPA' || enc === 'SAE') && pass && (pass.length < 8 || pass.length > 63)) add('error', 'pass', 'WPA / WPA3 passwords must be 8–63 characters');
        if (enc !== 'nopass' && !pass) add('need', 'pass', 'Wi-Fi password is needed');
        if (enc === 'WEP') add('warn', 'enc', 'WEP is outdated and insecure — use WPA2/WPA3 if your router allows it');
        if (enc === 'nopass' && pass) add('warn', 'pass', 'The network is set to Open, so the password is ignored', { k: 'enc', v: 'WPA', label: 'Use WPA' });
      } },
    upi: { label: 'UPI payment', icon: '💸', dyn: 'no', fields: [F('pa', 'UPI ID', { req: 1, ph: 'name@oksbi' }), F('pn', 'Payee name', { req: 1, h: 1 }), F('am', 'Amount (optional)', { t: 'number', h: 1 }), F('tn', 'Transaction note')],
      build: (v) => `upi://pay?pa=${val(v, 'pa')}&pn=${en(val(v, 'pn'))}${val(v, 'am') ? '&am=' + val(v, 'am') : ''}&cu=INR${val(v, 'tn') ? '&tn=' + en(val(v, 'tn')) : ''}`,
      check: (v, add) => { const pa = val(v, 'pa'), am = val(v, 'am'); if (pa && !/^[\w.\-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/.test(pa)) add('error', 'pa', 'UPI IDs look like name@bank (e.g. rahul@oksbi)'); if (am && !(/^\d{1,9}(\.\d{1,2})?$/.test(am) && +am > 0)) add('error', 'am', 'Amount must be a positive number with at most 2 decimals'); if (val(v, 'tn').length > 50) add('warn', 'tn', 'Notes over 50 characters may be cut off by UPI apps'); if (!am && pa) add('info', 'am', 'No amount set — the payer will type it'); } },
    location: { label: 'Location', icon: '📍', dyn: 'opt', fields: [F('fmt', 'Encode as', { t: 'select', o: [['link', 'Map link — works on every phone'], ['geo', 'geo: coordinates'], ['url', 'Custom map URL']] }), F('address', 'Address', { t: 'area', rows: 2 }), F('lat', 'Latitude', { h: 1 }), F('lng', 'Longitude', { h: 1 }), F('mapurl', 'Map URL')],
      build: (v) => (v.fmt === 'geo' ? (locStr(v) ? 'geo:' + locStr(v) : '') : locLink(v)), link: (v) => { const l = locLink(v); return /^https?:/.test(l) ? l : ''; },
      check: (v, add) => { const la = val(v, 'lat'), ln = val(v, 'lng'); if ((la === '') !== (ln === '')) add('error', 'lat', 'Enter both latitude and longitude'); else if (la !== '' && (!isFinite(+la) || !isFinite(+ln) || Math.abs(+la) > 90 || Math.abs(+ln) > 180)) add('error', 'lat', 'Latitude must be −90…90 and longitude −180…180'); if (v.fmt === 'geo' && la === '') add('need', 'lat', 'Coordinates are needed'); else if (v.fmt === 'url') { if (!val(v, 'mapurl')) add('need', 'mapurl', 'Map URL is needed'); else urlChk(v, 'mapurl', 'Map URL', add); } else if (la === '' && !val(v, 'address')) add('need', 'address', 'An address or coordinates are needed'); } },
    event: { label: 'Event', icon: '📅', dyn: 'no', fields: [F('name', 'Event name', { req: 1 }), F('date', 'Date', { t: 'date', req: 1, h: 1 }), F('start', 'Start time', { t: 'time', req: 1, h: 1 }), F('end', 'End time', { t: 'time', h: 1 }), F('location', 'Location', { h: 1 }), F('organizer', 'Organizer', { h: 1 }), F('contact', 'Contact (email/phone)', { h: 1 }), F('website', 'Website', { h: 1 }), F('desc', 'Description', { t: 'area', rows: 3 })],
      build: (v) => { const d = val(v, 'date').replace(/-/g, ''), t = (x) => x.replace(':', '') + '00', st = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); const notes = [val(v, 'desc'), val(v, 'organizer') && 'Organizer: ' + val(v, 'organizer'), val(v, 'contact') && 'Contact: ' + val(v, 'contact'), val(v, 'website') && 'More info: ' + B.fixUrl(val(v, 'website'))].filter(Boolean).join('\n'); const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QRNova//AI QR Studio//EN', 'BEGIN:VEVENT', 'UID:' + UID, 'DTSTAMP:' + st, `DTSTART:${d}T${t(val(v, 'start'))}`]; if (val(v, 'end')) L.push(`DTEND:${d}T${t(val(v, 'end'))}`); L.push('SUMMARY:' + vEsc(v.name)); if (val(v, 'location')) L.push('LOCATION:' + vEsc(v.location)); if (notes) L.push('DESCRIPTION:' + vEsc(notes)); L.push('END:VEVENT', 'END:VCALENDAR'); return L.join('\r\n'); },
      check: (v, add) => { const d = val(v, 'date'); if (d) { const dt = new Date(d + 'T00:00:00'); if (isNaN(dt)) add('error', 'date', 'Enter a valid date'); else if (dt < new Date(new Date().toDateString())) add('warn', 'date', 'This date is in the past'); } if (val(v, 'end') && val(v, 'start') && val(v, 'end') <= val(v, 'start')) add('error', 'end', 'End time must be after the start time'); urlChk(v, 'website', 'Website', add); const c = val(v, 'contact'); if (c.includes('@') && !B.emailOk(c)) add('error', 'contact', 'Contact email looks invalid'); } },
    business: { label: 'Business profile', icon: '🏢', dyn: 'page', upload: 'Logo (optional)', accept: 'image/*', fields: [F('name', 'Business name', { req: 1 }), F('desc', 'Description', { t: 'area', rows: 2 }), F('website', 'Website', { h: 1 }), F('phone', 'Phone', { t: 'tel', h: 1 }), F('email', 'Email', { t: 'email', h: 1 }), F('review', 'Review URL', { h: 1 }), F('address', 'Address', { t: 'area', rows: 2 }), F('hours', 'Opening hours', { t: 'area', rows: 2 }), F('social', 'Social link', { h: 1 }), F('maps', 'Map link', { h: 1 })], check: (v, add) => pageChk(v, add) },
    menu: { label: 'Restaurant menu', icon: '🍽️', dyn: 'page', upload: 'Menu file — PDF or image (optional)', accept: '.pdf,image/*', fields: [F('name', 'Restaurant name', { req: 1 }), F('desc', 'Cuisine / description', { t: 'area', rows: 2 }), F('phone', 'Phone', { t: 'tel', h: 1 }), F('website', 'Website', { h: 1 }), F('email', 'Email', { t: 'email', h: 1 }), F('menu', 'Menu link', { h: 1 }), F('address', 'Address', { t: 'area', rows: 2 }), F('hours', 'Opening hours', { t: 'area', rows: 2 }), F('maps', 'Map link')], check: (v, add) => pageChk(v, add) },
    product: { label: 'Product', icon: '📦', dyn: 'page', upload: 'Product image (optional)', accept: 'image/*', fields: [F('name', 'Product name', { req: 1 }), F('pid', 'Product ID / SKU', { h: 1 }), F('company', 'Company', { h: 1 }), F('price', 'Price', { h: 1 }), F('website', 'Website', { h: 1 }), F('desc', 'Description', { t: 'area', rows: 3 }), F('buy', 'Purchase URL')], check: (v, add) => pageChk(v, add) },
    review: { label: 'Review link', icon: '⭐', dyn: 'opt', fields: [F('url', 'Review page URL', { req: 1, ph: 'https://g.page/r/…/review' })], build: (v) => B.fixUrl(v.url), link: (v) => B.fixUrl(v.url),
      check: (v, add) => { urlChk(v, 'url', 'Review link', add); const u = B.parseUrl(val(v, 'url')); if (u && !/google|g\.page|yelp|tripadvisor|trustpilot|facebook|zomato|justdial/i.test(u.hostname)) add('info', 'url', 'Make sure this opens a review form directly — customers drop off after extra taps'); } },
    payurl: { label: 'Payment link', icon: '💳', dyn: 'opt', fields: [F('url', 'Payment link', { req: 1, ph: 'https://pay.example.com/…' })], build: (v) => B.fixUrl(v.url), link: (v) => B.fixUrl(v.url), check: (v, add) => urlChk(v, 'url', 'Payment link', add) },
    file: { label: 'File', icon: '📎', dyn: 'file', fields: [F('kind', 'File type', { t: 'select', o: [['pdf', 'PDF'], ['image', 'Image'], ['video', 'Video'], ['audio', 'Audio'], ['document', 'Document']] })] },
  };
  const STATIC_WHY = { wifi: 'Wi-Fi codes must be static: scanning joins the network directly, and your password stays on this device — it is never sent to a server.', vcard: 'Contacts are saved straight into the phone, so a static code works offline and forever.', upi: 'Payment details are encoded directly. Never route payments through a redirect.', event: 'A calendar entry is self-contained, so a static code is perfect.' };
  B.link = (type, v) => { const T = B.TYPES[type]; return T && T.link ? T.link(v) || '' : ''; };
  B.fallbackText = (type, v) => [v.name, v.desc, v.price && 'Price: ' + v.price, v.pid && 'ID: ' + v.pid, v.company && 'By: ' + v.company, v.phone && 'Tel: ' + v.phone, v.email, v.website && B.fixUrl(v.website), v.menu && 'Menu: ' + B.fixUrl(v.menu), v.buy && 'Buy: ' + B.fixUrl(v.buy), v.address, v.hours && 'Hours: ' + v.hours, v.maps && B.fixUrl(v.maps), v.review && 'Review: ' + B.fixUrl(v.review)].filter(Boolean).join('\n');
  B.build = (type, v, mode) => {
    const T = B.TYPES[type]; if (!T) return '';
    if (mode === 'dynamic') return T.dyn === 'opt' ? B.link(type, v) : '';
    if (T.dyn === 'page') return B.fallbackText(type, v);
    if (T.dyn === 'file') return '';
    try { return T.build(v) || ''; } catch (e) { return ''; }
  };

  /* ═══════ AI validation (4.5) ═══════ */
  B.validate = (type, v, o) => {
    o = o || {}; v = v || {};
    const T = B.TYPES[type], out = []; if (!T) return out;
    const add = (lvl, field, msg, fix) => out.push({ lvl, field, msg, fix });
    T.fields.forEach((f) => { if (f.req && !val(v, f.k)) add('need', f.k, `${f.l} is needed`); });
    if (T.check) T.check(v, add);
    const blocked = () => out.some((i) => i.lvl === 'error' || i.lvl === 'need');
    if (!blocked() && o.mode === 'dynamic' && T.dyn === 'opt' && !B.link(type, v)) add('error', null, 'A Dynamic QR needs a web link (http/https). Switch to Static or pick the “Map link” format.');
    if (!blocked()) {
      const p = B.build(type, v, o.mode || 'static'), ecl = o.ecl || 'M';
      if (p) {
        const b = bytesOf(p);
        if (b > CAP[ecl]) add('error', null, `Too long: ${b} bytes — the maximum at level ${ecl} is about ${CAP[ecl]}. Shorten it or use a Dynamic QR.`);
        else if (b > 0.8 * CAP[ecl]) add('warn', null, `Very large content (${b} bytes) — the code will be extremely dense.`);
        else if (b > 500) add('warn', null, `Dense code (${b} bytes). It scans best when printed large; a Dynamic QR keeps it small.`);
      }
    }
    return out;
  };
  B.needs = (type, v) => B.validate(type, v, {}).filter((i) => i.lvl === 'need').map((i) => i.msg.replace(/ is needed$/, ''));

  /* ═══════ direct input detection (4.3) ═══════ */
  function parseWifi(s) {
    const o = {}; s.replace(/^WIFI:/i, '').replace(/(?:^|;)([TSPH]):((?:\\.|[^;\\])*)/g, (m, k, v) => { o[k] = v.replace(/\\(.)/g, '$1'); return ''; });
    return { ssid: o.S || '', pass: o.P || '', enc: o.T ? (/^nopass$/i.test(o.T) ? 'nopass' : o.T.toUpperCase()) : 'WPA', hidden: /^true$/i.test(o.H || '') };
  }
  function parseVcard(s) {
    const f = { first: '', last: '', mobile: '', phone: '', email: '', website: '', org: '', jobtitle: '', street: '', city: '', state: '', zip: '', ctry: '', note: '' };
    const un = (x) => String(x || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
    s.replace(/\r/g, '').split('\n').forEach((l) => {
      const i = l.indexOf(':'); if (i < 0) return;
      const k = l.slice(0, i).toUpperCase(), raw = l.slice(i + 1);
      if (k === 'N') { const p = raw.split(';'); f.last = un(p[0]); f.first = un(p[1]); }
      else if (k.startsWith('TEL')) { if (/CELL/.test(k)) f.mobile = un(raw); else f.phone = un(raw); }
      else if (k.startsWith('EMAIL')) f.email = un(raw);
      else if (k.startsWith('URL')) f.website = un(raw);
      else if (k === 'ORG') f.org = un(raw.split(';')[0]);
      else if (k === 'TITLE') f.jobtitle = un(raw);
      else if (k === 'NOTE') f.note = un(raw);
      else if (k.startsWith('ADR')) { const p = raw.split(';'); f.street = un(p[2]); f.city = un(p[3]); f.state = un(p[4]); f.zip = un(p[5]); f.ctry = un(p[6]); }
    });
    return f;
  }
  function direct(raw) {
    const s = String(raw || '').trim(); if (!s) return null;
    const R = (type, fields, reason) => ({ type, fields, reason });
    let m;
    if (/^WIFI:/i.test(s)) return R('wifi', parseWifi(s), 'This is a Wi-Fi configuration string');
    if (/^BEGIN:VCARD/i.test(s)) return R('vcard', parseVcard(s), 'This is a vCard contact');
    if ((m = s.match(/^upi:\/\/pay\?(.+)$/i))) { const p = new URLSearchParams(m[1]); return R('upi', { pa: p.get('pa') || '', pn: p.get('pn') || '', am: p.get('am') || '', tn: p.get('tn') || '' }, 'This is a UPI payment link'); }
    if ((m = s.match(/^mailto:([^?]+)(?:\?(.*))?$/i))) { const p = new URLSearchParams(m[2] || ''); return R('email', { to: dec(m[1]), subject: p.get('subject') || '', body: p.get('body') || '' }, 'This is a mailto link'); }
    if ((m = s.match(/^tel:(.+)$/i))) return R('phone', { phone: B.phone(m[1]).e164 }, 'This is a tel: link');
    if ((m = s.match(/^(?:sms|smsto|mms):([^?:]+)(?:[?:](?:body=)?(.*))?$/i))) return R('sms', { phone: B.phone(m[1]).e164, msg: m[2] ? dec(m[2]) : '' }, 'This is an SMS link');
    if ((m = s.match(/^geo:(-?[\d.]+),(-?[\d.]+)/i))) return R('location', { fmt: 'geo', address: '', lat: m[1], lng: m[2], mapurl: '' }, 'These are map coordinates');
    if (/^-?\d{1,2}\.\d+\s*[,;]\s*-?\d{1,3}\.\d+$/.test(s)) { const g = s.split(/[,;]/); return R('location', { fmt: 'link', address: '', lat: g[0].trim(), lng: g[1].trim(), mapurl: '' }, 'These look like map coordinates'); }
    const dg = s.replace(/\D/g, '');
    if (/^\+?[\d ().\-]{7,22}$/.test(s) && dg.length >= 8 && dg.length <= 15 && (/^\+/.test(s) || /[ ().\-]/.test(s) || dg.length === 10)) return R('phone', { phone: B.phone(s).e164 }, 'This looks like a phone number');
    if (/\s/.test(s)) return null;
    if (B.emailOk(s)) return R('email', { to: s.toLowerCase(), subject: '', body: '' }, 'This looks like an email address');
    if (/^[\w.\-]{2,256}@[a-z][a-z0-9]{1,24}$/i.test(s)) return R('upi', { pa: s, pn: '', am: '', tn: '' }, 'This looks like a UPI ID');
    if (new RegExp('^(?:' + URLRE.source + ')$', 'i').test(s)) {
      const u = B.fixUrl(s), x = B.parseUrl(u); if (!x) return null;
      const host = x.hostname.replace(/^www\./, '').toLowerCase();
      if (/^(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)$/.test(host)) { const ph = x.pathname.replace(/\D/g, '') || (x.searchParams.get('phone') || '').replace(/\D/g, ''); return R('whatsapp', { phone: ph ? '+' + ph : '', msg: x.searchParams.get('text') || '' }, 'This is a WhatsApp link'); }
      if (host === 't.me') return R('telegram', { user: '@' + x.pathname.replace(/^\//, '').split('/')[0] }, 'This is a Telegram link');
      const sp = socialOf(u); if (sp) return R('social', { p: sp, h: u }, `This is a ${cap(sp)} profile link`);
      if (isMaps(u)) return R('location', { fmt: 'url', address: '', lat: '', lng: '', mapurl: u }, 'This is a map link');
      if (isReview(u)) return R('review', { url: u }, 'This looks like a review link');
      return R('url', { url: u }, 'This looks like a web address');
    }
    return null;
  }
  B.direct = direct;

  /* ═══════ fields from natural language (4.9 content structuring) ═══════ */
  B.fieldsFrom = (type, e, t) => {
    const ph = (i) => (e.phones[i] ? B.phone(e.phones[i]).e164 : '');
    const urls = e.urls.map(B.fixUrl), maps = urls.find(isMaps) || '', rev = urls.find(isReview) || '', soc = urls.find((u) => socialOf(u)) || '';
    const web = urls.find((u) => u !== maps && u !== rev && u !== soc) || urls[0] || '';
    const price = (e.prices[0] || '').trim(), priceNum = ((price.match(/\d[\d,]*(?:\.\d{1,2})?/) || [''])[0]).replace(/,/g, '');
    const msg = msgAfter(t, 'message|saying|says|pre-?filled(?: message)?'), em = e.emails[0] || '', nm = e.name || '';
    const hours = ((t.match(/(?:opening hours|open(?:ing)?|hours|timings?)\s*(?:are|is|:|-)?\s*([^\n.]{4,80})/i) || [])[1] || '').trim();
    switch (type) {
      case 'text': { const m = t.match(/(?:\bsaying\b|\bthat says\b|\bwhich says\b|\bwith (?:the )?(?:text|message|words)\b|\btext\s*(?:is|=|:)|\bmessage\s*(?:is|=|:))\s*["“]?([\s\S]+?)["”]?\s*$/i); return { text: m ? m[1].trim() : B.cleanText(t) }; }
      case 'url': case 'payurl': return { url: web };
      case 'review': return { url: rev || web };
      case 'email': return { to: em, subject: grab(t, 'subject', 'body|message'), body: grab(t, 'body|message', 'subject') };
      case 'phone': return { phone: ph(0) };
      case 'sms': case 'whatsapp': return { phone: ph(0), msg };
      case 'telegram': { const h = (t.match(/t\.me\/(\w{4,32})/i) || e.rest.match(/(?:^|\s)@([A-Za-z0-9_]{4,32})/) || [])[1] || ''; return { user: h ? '@' + h : '' }; }
      case 'social': return e.social ? { p: e.social.p, h: e.social.h } : { p: 'instagram', h: '' };
      case 'vcard': { const n = (e.person || '').split(/\s+/).filter(Boolean); return { first: n[0] || '', last: n.slice(1).join(' '), mobile: ph(0), phone: ph(1), email: em, website: web, org: nm, street: e.address }; }
      case 'wifi': return e.wifi ? { ssid: e.wifi.ssid, pass: e.wifi.pass, enc: e.wifi.enc, hidden: e.wifi.hidden } : {};
      case 'upi': return { pa: e.upi[0] || '', pn: nm || e.person || '', am: priceNum, tn: ((t.match(/\b(?:note|for)\s*(?:is|:)\s*([^\n,.]{1,50})/i) || [])[1] || '').trim() };
      case 'location': return { fmt: maps ? 'url' : 'link', address: e.address, lat: e.geo ? e.geo.lat : '', lng: e.geo ? e.geo.lng : '', mapurl: maps };
      case 'event': {
        const d = e.dates[0] ? B.parseDate(e.dates[0]) : B.relDate(t), tm = e.times.map(B.parseTime).filter(Boolean);
        const w = (t.match(/\b(birthday party|wedding|conference|meetup|webinar|workshop|concert|seminar|party|meeting|festival|ceremony|event)\b/i) || [''])[0];
        return { name: nm || (w ? cap(w.toLowerCase()) : ''), date: d, start: tm[0] || '', end: tm[1] || '', location: ((t.match(/\b(?:venue|location|held at|taking place at|happening at)\s*(?:is|:|-)?\s*([^\n,.;]{3,80})/i) || [])[1] || e.address || '').trim(), contact: em || ph(0), website: web };
      }
      case 'business': return { name: nm, website: web, phone: ph(0), email: em, address: e.address, hours, social: soc, maps, review: rev };
      case 'menu': return { name: nm, phone: ph(0), website: web, email: em, address: e.address, hours, maps };
      case 'product': return { name: nm, pid: (t.match(/\b(?:sku|product id|item code)\s*[:#-]?\s*([A-Za-z0-9-]{2,20})/i) || [])[1] || '', price, website: web };
      case 'file': return { kind: e.fileKind || 'pdf' };
    }
    return {};
  };
  const defaults = (type) => { const o = {}; B.TYPES[type].fields.forEach((f) => { o[f.k] = f.t === 'select' ? f.o[0][0] : f.t === 'check' ? false : ''; }); return o; };
  function itemsOf(type, e, f, t) {
    const L = [], m = e.mentions, push = (i, l) => L.push({ i, l }), host = (u) => { const x = B.parseUrl(u); return x ? x.hostname.replace(/^www\./, '') : u; };
    if (e.category) push('🏷️', e.category);
    if (type === 'url' && f.url) { const x = B.parseUrl(f.url); if (x) { push('🌐', 'Domain — ' + host(f.url)); push(x.protocol === 'https:' ? '🔒' : '⚠️', x.protocol === 'https:' ? 'HTTPS' : 'HTTP (not encrypted)'); } }
    if (e.name) push('🔖', 'Name — ' + e.name);
    if (e.person) push('👤', 'Person — ' + e.person);
    if (e.fileKind) push('📎', (/\bmenu\b/i.test(t) ? 'Menu ' : '') + FILEL[e.fileKind]);
    if (e.wifi) push('📶', 'Wi-Fi' + (e.wifi.ssid ? ' — ' + e.wifi.ssid : ''));
    if (e.upi.length) push('💸', 'UPI ID — ' + e.upi[0]);
    if (e.address || e.geo || m.location) push('📍', e.address ? 'Location — ' + e.address : e.geo ? 'Coordinates' : 'Location');
    if (e.phones.length || m.phone) push('📞', e.phones.length ? 'Phone — ' + B.phone(e.phones[0]).pretty : 'Phone');
    if (e.emails.length || m.email) push('✉️', e.emails.length ? 'Email — ' + e.emails[0] : 'Email');
    if (type !== 'url' && (e.urls.length || m.website)) push('🌐', e.urls.length ? 'Website — ' + host(e.urls[0]) : 'Website');
    if (e.dates.length) push('📅', 'Date — ' + e.dates[0]);
    if (e.times.length) push('🕒', 'Time — ' + e.times.join(' – '));
    if (e.prices.length) push('💰', 'Price — ' + e.prices[0]);
    if (e.social) push('📱', cap(e.social.p));
    if (!L.length) push(B.TYPES[type].icon, B.TYPES[type].label + ' content');
    return L.slice(0, 8);
  }
  function mk(type, e, t, o) {
    const T = B.TYPES[type], fields = Object.assign(defaults(type), o.fields || B.fieldsFrom(type, e, t));
    return { type, label: T.label, icon: T.icon, conf: o.conf, reason: o.reason || '', direct: !!o.direct, fields, items: itemsOf(type, e, fields, t), alts: (o.alts || []).map((k) => ({ type: k, label: B.TYPES[k].label, icon: B.TYPES[k].icon })), ent: e };
  }

  /* ═══════ natural-language type detection (4.2) ═══════ */
  const ORDER = ['wifi', 'upi', 'vcard', 'menu', 'business', 'product', 'event', 'review', 'whatsapp', 'telegram', 'social', 'sms', 'email', 'phone', 'location', 'payurl', 'url', 'file', 'text'];
  const FAMILY = { business: 'page', menu: 'page', product: 'page' };
  B.detect = (text) => {
    const t = String(text || '').trim(), e = B.entities(t), d = direct(t);
    if (d) return mk(d.type, e, t, { conf: 97, reason: d.reason, fields: d.fields, direct: true });
    const S = {}, W = {}, has = (re) => re.test(t);
    const add = (k, n, w) => { S[k] = (S[k] || 0) + n; if (w) (W[k] = W[k] || []).push(w); };
    const m = e.mentions, nVal = [e.phones.length, e.emails.length, e.urls.length, e.address ? 1 : 0].filter(Boolean).length, nMen = Object.values(m).filter(Boolean).length;
    if (e.wifi) add('wifi', 9, 'it is about Wi-Fi');
    if (e.upi.length) add('upi', 8, 'it contains a UPI ID');
    if (has(/\bupi\b|g-?pay|google pay|phonepe|paytm|bhim|donat|accept payments?|collect payments?|pay me|tip jar|payee/i)) add('upi', 4, 'you want to receive a payment');
    if (has(/pay(?:ment)? (?:link|url|page)|checkout|invoice|razorpay|stripe|paypal/i)) add('payurl', 7);
    if (has(/v-?card|contact card|business card|visiting card|save (?:my )?contact|my contact|contact details|digital card/i)) add('vcard', 8, 'you asked for a contact card');
    if (e.person) add('vcard', 3); if (e.phones.length && e.emails.length) add('vcard', 3);
    if (e.category) add('business', 3, 'it describes a ' + e.category.toLowerCase());
    if (nVal + nMen >= 2 && !e.wifi) add('business', 4, 'it lists several contact details');
    if (has(/\b(?:business|company|shop|store|clinic|hotel|restaurant|cafe|salon|profile|brand|firm|agency)\b/i)) add('business', 2);
    if (has(/\bmenu\b/i)) { add('menu', 7, 'it mentions a menu'); if (e.category === 'Restaurant') add('menu', 3); }
    if (has(/\b(?:product|item|sku|buy|purchase|for sale|pricing)\b/i)) add('product', 5, 'it describes a product');
    if (e.prices.length && has(/\b(?:product|item|buy|price|cost|sale)\b/i)) add('product', 3);
    if (has(/\b(?:event|party|wedding|conference|meetup|webinar|workshop|concert|seminar|birthday|meeting|ceremony|festival)\b/i)) add('event', 6, 'it describes an event');
    if (e.dates.length) add('event', 3); else if (B.relDate(t) || e.times.length) add('event', 1);
    if (has(/\b(?:review|feedback|rate us|rating|testimonial)\b/i)) add('review', 8, 'you want reviews');
    if (has(/whatsapp/i)) add('whatsapp', 8, 'it mentions WhatsApp');
    if (has(/telegram|\bt\.me\b/i)) add('telegram', 8, 'it mentions Telegram');
    if (e.social && e.social.p !== 'telegram') add('social', 7, 'it points to a social profile');
    if (has(/\b(?:instagram|facebook|linkedin|youtube|twitter|github|tiktok|snapchat|social media|follow us|follow me)\b/i)) add('social', 3);
    if (has(/\bsms\b|text message|text me|send (?:me )?a text/i)) add('sms', 8, 'it mentions SMS');
    if (e.phones.length) add('phone', 3, 'it contains a phone number');
    if (has(/\b(?:call|phone|dial|ring)\b/i)) add('phone', 3);
    if (e.emails.length) add('email', 4, 'it contains an email address');
    if (has(/\b(?:email|e-mail|mail me|write to)\b/i)) add('email', 3);
    if (e.geo || e.urls.some(isMaps)) add('location', 8, 'it contains a map location');
    if (has(/\b(?:location|map|directions|coordinates|latitude|longitude|navigate|google maps|find us)\b/i)) add('location', 4, 'it asks for a location');
    if (e.address) add('location', 2);
    if (e.urls.length) add('url', 4, 'it contains a web link');
    if (has(/\b(?:website|web ?site|web page|webpage|link|url|blog|portfolio|landing page|online store)\b/i)) add('url', 4, 'you asked for a website link');
    if (has(/\b(?:portfolio|blog)\b/i)) add('url', 1);
    if (e.fileKind && !e.category) add('file', 5 + (has(/\b(?:upload|host|attach|file)\b/i) ? 3 : 0), 'you want to share a file');
    if (has(/\b(?:plain text|text qr|text only|just text)\b/i) || /\b(?:saying|that says)\b/i.test(t)) add('text', 8, 'you asked for plain text');
    add('text', 1);
    const ranked = ORDER.map((k) => [k, S[k] || 0]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1] || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
    const top = ranked[0], other = ranked.find((x) => x[0] !== top[0] && !(FAMILY[x[0]] && FAMILY[x[0]] === FAMILY[top[0]]));
    const conf = Math.max(30, Math.min(96, Math.round((100 * top[1]) / (top[1] + 0.6 * (other ? other[1] : 0) + 1.5))));
    return mk(top[0], e, t, { conf, reason: W[top[0]] ? 'Because ' + W[top[0]].slice(0, 2).join(' and ') : '', alts: ranked.filter((x) => x[0] !== top[0] && x[1] >= top[1] * 0.4).slice(0, 2).map((x) => x[0]) });
  };

  /* ═══════ design assistant (4.7) ═══════ */
  const TH = {
    hotel: { n: 'Hotel · Elegant', c: ['#1b2a49', '#9a7410', '#1b2a49'], d: 'rounded', e: 'rounded', label: 'Scan to Explore', why: 'Deep navy with brass gold feels refined and hospitable, and keeps strong contrast.' },
    restaurant: { n: 'Restaurant · Warm', c: ['#b91c1c', '#c2410c', '#7f1d1d'], d: 'rounded', e: 'circle', label: 'Scan for the Menu', why: 'Warm red-orange feels appetising and stays high-contrast on printed menus.' },
    health: { n: 'Healthcare · Calm', c: ['#0e7490', '#0369a1', '#0c4a6e'], d: 'rounded', e: 'rounded', label: 'Scan to Book', why: 'Calm teal and blue suggest care and cleanliness.' },
    tech: { n: 'Tech · Aurora', c: ['#6d28d9', '#0e7490', '#be185d'], d: 'dots', e: 'rounded', label: 'Scan me', why: 'A violet-to-teal gradient with dotted modules looks modern and techy.' },
    eco: { n: 'Eco · Natural', c: ['#15803d', '#065f46', '#14532d'], d: 'dots', e: 'circle', label: 'Scan to learn more', why: 'Natural greens communicate sustainability.' },
    playful: { n: 'Playful', c: ['#c026d3', '#ea580c', '#2563eb'], d: 'dots', e: 'circle', label: 'Scan me!', why: 'Bright colours and round dots feel fun and friendly.' },
    minimal: { n: 'Minimal · Classic', c: ['#111827', null, '#111827'], d: 'square', e: 'square', label: '', why: 'Pure dark-on-white is the most reliable look for every scanner.' },
    education: { n: 'Education', c: ['#1d4ed8', '#0369a1', '#1e3a8a'], d: 'rounded', e: 'rounded', label: 'Scan to learn', why: 'Friendly blues suggest trust and learning.' },
    realestate: { n: 'Real estate', c: ['#0f766e', '#115e59', '#134e4a'], d: 'square', e: 'rounded', label: 'Scan for details', why: 'Deep teal feels stable and premium.' },
    beauty: { n: 'Beauty · Chic', c: ['#be185d', '#7e22ce', '#9d174d'], d: 'rounded', e: 'circle', label: 'Scan to book', why: 'Rose-to-plum feels stylish.' },
    fitness: { n: 'Fitness · Bold', c: ['#dc2626', '#111827', '#111827'], d: 'square', e: 'square', label: 'Scan to join', why: 'Bold red and black convey energy.' },
    finance: { n: 'Finance · Trust', c: ['#047857', '#0f766e', '#064e3b'], d: 'square', e: 'rounded', label: 'Scan to Pay', why: 'Deep green signals security and trust.' },
    professional: { n: 'Professional', c: ['#0f2a5a', '#1d4ed8', '#0f2a5a'], d: 'square', e: 'rounded', label: 'Scan me', why: 'Navy with a crisp square pattern looks trustworthy and corporate.' },
  };
  const THEME_KEYS = [['hotel', /\b(?:hotel|resort|hospitality|villa|homestay|lodge)\b/i], ['restaurant', /\b(?:restaurant|cafe|café|food|bakery|bistro|diner|kitchen|pizza|coffee)\b/i], ['health', /\b(?:clinic|hospital|health|medical|doctor|dental|pharmacy|wellness)\b/i], ['tech', /\b(?:tech|startup|software|saas|ai|developer|digital|futuristic)\b/i], ['eco', /\b(?:eco|organic|nature|green|farm|sustainab\w*|garden)\b/i], ['education', /\b(?:school|college|education|academy|university|course)\b/i], ['realestate', /\b(?:real estate|property|apartment|realtor)\b/i], ['beauty', /\b(?:salon|beauty|spa|fashion|boutique|makeup|wedding|romantic)\b/i], ['fitness', /\b(?:gym|fitness|sports?|yoga)\b/i], ['finance', /\b(?:bank|finance|payments?|fintech|invest\w*)\b/i]];
  const MOODKEY = { professional: 'professional', corporate: 'professional', formal: 'professional', trustworthy: 'finance', elegant: 'hotel', luxury: 'hotel', luxurious: 'hotel', classy: 'hotel', premium: 'hotel', minimal: 'minimal', simple: 'minimal', clean: 'minimal', classic: 'minimal', playful: 'playful', fun: 'playful', colorful: 'playful', colourful: 'playful', bright: 'playful', bold: 'fitness', modern: 'tech' };
  const MOODRE = new RegExp('\\b(' + Object.keys(MOODKEY).join('|') + ')\\b', 'i');
  const FALLBACK = { wifi: 'tech', upi: 'finance', payurl: 'finance', menu: 'restaurant', business: 'professional', vcard: 'professional', event: 'playful', review: 'professional', product: 'tech' };
  const COLORS = { red: '#b91c1c', orange: '#c2410c', amber: '#a16207', yellow: '#a16207', gold: '#8a6d1d', green: '#15803d', emerald: '#047857', teal: '#0f766e', cyan: '#0e7490', blue: '#1d4ed8', navy: '#0f2a5a', indigo: '#4338ca', purple: '#6d28d9', violet: '#6d28d9', pink: '#be185d', magenta: '#a21caf', rose: '#be123c', brown: '#78350f', black: '#111827', grey: '#374151', gray: '#374151', maroon: '#7f1d1d' };
  const COLRE = new RegExp('\\b(' + Object.keys(COLORS).join('|') + ')\\b', 'gi');
  B.designIntent = (t) => MOODRE.test(t) || /\b(?:design|style|theme|look|brand\w*|colou?rs?|gradient|rounded|dotted|diamond)\b/i.test(t) || /#[0-9a-f]{6}\b/i.test(t) || (new RegExp(COLRE.source, 'i').test(t) && /\b(?:make|use|using|in|with|change|turn)\b/i.test(t)) || /\bfor (?:a|an|my|the) (?:hotel|restaurant|cafe|clinic|hospital|school|salon|gym|shop|store|bakery|resort)\b/i.test(t);
  B.themeList = () => Object.keys(TH).map((k) => ({ key: k, n: TH[k].n, c: TH[k].c }));
  B.designFor = (t, o) => {
    o = o || {}; t = String(t || '');
    const hit = THEME_KEYS.find((x) => x[1].test(t)), mood = ((t.match(MOODRE) || [])[1] || '').toLowerCase();
    const key = o.key || (hit ? hit[0] : mood ? MOODKEY[mood] : FALLBACK[o.type] || 'tech'), th = TH[key];
    const st = { fg: th.c[0], fg2: th.c[1], eye: th.c[2], dots: th.d, eyes: th.e };
    let name = th.n, why = th.why;
    if (mood && hit && !o.key) { name += ' · ' + cap(mood); if (/professional|corporate|formal/.test(mood) && key !== 'minimal') { st.dots = 'square'; why += ' Crisp square modules add a professional finish.'; } else if (/playful|fun|colou?rful|bright/.test(mood)) st.dots = 'dots'; else if (/elegant|luxur|classy|premium/.test(mood)) { st.dots = 'rounded'; st.eyes = 'rounded'; } }
    const cols = [...(t.match(/#[0-9a-f]{6}\b/gi) || []), ...[...t.toLowerCase().matchAll(COLRE)].map((m) => COLORS[m[1]])].filter((c, i, a) => a.indexOf(c) === i);
    if (cols.length && !o.key) { st.fg = ensure(cols[0], '#ffffff', 4.5); st.fg2 = cols[1] ? ensure(cols[1], '#ffffff', 4.5) : null; st.eye = st.fg; name = 'Custom colours'; why = 'Using your colours, adjusted where needed so the code still scans reliably.'; }
    const shape = (t.match(/\b(rounded|dotted|dots|diamond|square|sharp)\b/i) || [])[1];
    if (shape && !o.key) { st.dots = /dot/i.test(shape) ? 'dots' : /diamond/i.test(shape) ? 'diamond' : /square|sharp/i.test(shape) ? 'square' : 'rounded'; if (name === th.n) { name += ' · ' + cap(shape.toLowerCase()); } }
    return { key, name, why, style: st, label: th.label };
  };

  /* ═══════ follow-up commands + knowledge ═══════ */
  const TYPEWORD = /\b(?:wi-?fi|upi|menu|v-?card|contact|business|product|event|review|whatsapp|telegram|sms|e-?mail|phone|call|location|map|website|portfolio|payment|pdf|image|video|audio|file|resume|link|url)\b/i;
  B.followups = (t, cur) => {
    const a = [], L = t.toLowerCase();
    if (B.designIntent(t)) a.push({ a: 'design', design: B.designFor(t, { type: cur && cur.type }) });
    if (/\b(?:remove|without|no|delete)\b.*\blogo\b/.test(L)) a.push({ a: 'logoOff' }); else if (/\blogo\b/.test(L)) a.push({ a: 'logo' });
    if (/\bdynamic\b|\btrackable\b|\beditable\b/.test(L) && /\b(?:make|turn|switch|convert|change|use|want|prefer)\b/.test(L)) a.push({ a: 'mode', mode: 'dynamic' });
    else if (/\bstatic\b/.test(L) && /\b(?:make|turn|switch|convert|change|use|want|prefer)\b/.test(L)) a.push({ a: 'mode', mode: 'static' });
    const pr = L.match(/\b(print|printing|poster|flyer|banner|signage|sticker|packaging|brochure|billboard)\b/);
    if (pr && !/\bprint (?:it|this|the qr)\b/.test(L)) a.push({ a: 'print', poster: /poster|banner|signage|billboard/.test(L) });
    if (/\b(?:bigger|larger|huge|high[- ]res|high resolution|4k)\b/.test(L)) a.push({ a: 'size', px: 4096 });
    if (/\bhigh(?:est)? error correction\b|\bmax(?:imum)? error correction\b/.test(L)) a.push({ a: 'ecl', v: 'H' });
    const fr = t.match(/\b(?:frame|label|caption)\b.*?["“']([^"”']{1,32})["”']/i);
    if (fr) a.push({ a: 'frame', label: fr[1] }); else if (/\b(?:remove|no)\b.*\b(?:frame|label|caption)\b/.test(L)) a.push({ a: 'frame', label: '' });
    if (/\b(?:download|save|export)\b/.test(L)) a.push({ a: 'download', fmt: (L.match(/\b(png|jpe?g|webp|svg)\b/) || ['', 'png'])[1].replace('jpeg', 'jpg') });
    if (/\bprint (?:it|this|the qr)\b/.test(L)) a.push({ a: 'printNow' });
    if (/\b(?:test|verify|validate|scan test|quality|readable|will it scan)\b/.test(L)) a.push({ a: 'test' });
    if (/\b(?:tidy|format|clean up|normali[sz]e|fix (?:it|this|the)|correct)\b/.test(L)) a.push({ a: 'tidy' });
    if (/\b(?:write|generate|create|add|draft)\b.*\b(?:description|profile|bio|about|summary)\b/.test(L)) a.push({ a: 'describe' });
    if (/^(?:new|another|start over|reset|clear)\b/.test(L)) a.push({ a: 'new' });
    if (/^(?:generate|go|done|create it|build it|make it|finali[sz]e|looks good)\W*$/.test(L)) a.push({ a: 'generate' });
    return a;
  };
  const KB = [
    [/static.*dynamic|dynamic.*static|what is (?:a )?dynamic|what is (?:a )?static|difference/i, '**Static** QR codes store the data inside the pattern: free, permanent and offline-friendly, but they cannot be edited after printing.\n**Dynamic** QR codes hold a short link that redirects to your content, so you can change the destination later and see scan analytics.'],
    [/error correction|\becl\b/i, 'Error correction lets a QR survive damage: **L** 7%, **M** 15%, **Q** 25%, **H** 30%. Use **M** for screens, **Q** for print and **H** with a logo. Higher levels make the code denser.'],
    [/\blogo\b/i, 'A centre logo works if it covers no more than about 20% of the width and error correction is **H**. Use a square logo with a white pad, and avoid logos on very dense codes.'],
    [/how big|what size|minimum size|print size/i, 'Roughly 0.8 mm per module is comfortable: a typical link code prints well at 3–4 cm, a business card needs at least 2.5 cm, and a poster should be 10 cm or more. Always leave a 4-module quiet zone.'],
    [/(?:put|store|embed|inside).*(?:pdf|image|video|file|photo)|file.*inside/i, 'A QR code cannot hold a whole file. Instead I host the file securely and put a short link in the QR — that is also what keeps it fast to scan. Use **File → QR** for that.'],
  ];
  const knowledge = (t) => { if (!/^(?:what|why|how|which|should|can|could|does|do|is|are|explain|tell me|difference)\b|\?\s*$/i.test(t)) return ''; const k = KB.find((x) => x[0].test(t)); return k ? k[1] : ''; };
  const GREET = 'Hi! I am your **AI QR Assistant**. Tell me what to turn into a QR code — a link, Wi-Fi, a restaurant menu, a UPI payment, a contact card, an event, a file. You can paste a ready value (like a URL or an email), attach a file to read, or ask for a style such as “make it professional for a hotel”.';
  const HELP = 'Here is what I can do:\n• **Detect** the best QR type from plain English or pasted data\n• **Extract** links, emails, phones, addresses and business details (also from TXT, VCF, PDF, DOCX or a photo)\n• **Validate & fix** bad links, emails, phones and missing fields\n• **Recommend** static vs dynamic, error correction, size and logo\n• **Design** it — try “make it professional for a hotel”\n• **Quality-check** it before you download';

  B.understand = (text, cur) => {
    const t = String(text || '').trim();
    if (!t) return { kind: 'answer', text: HELP };
    if (/^(?:hi|hello|hey|hii+|namaste|good (?:morning|afternoon|evening))\b[\s!.,]*(?:there)?[\s!.]*$/i.test(t)) return { kind: 'answer', text: GREET };
    if (/^(?:help|what can you do|what do you do|how does this work)\b/i.test(t)) return { kind: 'answer', text: HELP };
    const d = direct(t), ent = B.entities(t);
    const hasEnt = !!(ent.urls.length || ent.emails.length || ent.phones.length || ent.upi.length || ent.geo || ent.wifi);
    if (!d && !hasEnt) { const kb = knowledge(t); if (kb) return { kind: 'answer', text: kb }; }
    if (!d && !hasEnt && !TYPEWORD.test(t)) { const acts = B.followups(t, cur); if (acts.length) return { kind: 'edit', acts }; }
    if (cur && cur.type && hasEnt && !/\b(?:create|generate|build|new)\b/i.test(t)) {
      const upd = /^(?:change|update|set|replace|use|edit|correct)\b/i.test(t);
      if (upd || cur.missing || (d && d.type === cur.type)) return { kind: 'update', fields: d && d.type === cur.type ? d.fields : B.fieldsFrom(cur.type, ent, t), overwrite: upd || !!d };
    }
    const det = B.detect(t);
    if (det.type === 'text' && !det.direct && /^(?:create|generate|make|build)\b/i.test(t) && !/\b(?:saying|says|text)\b/i.test(t) && t.split(/\s+/).length < 8) return { kind: 'answer', text: 'Sure! What should the QR contain? Give me a link, a phone number, Wi-Fi details, a menu, a payment ID… or just describe it in a sentence.' };
    const rec = B.recommend(det.type, det.fields, { text: t, fileKind: det.ent.fileKind, designText: (det.ent.category || '') + ' ' + t });
    const design = !det.direct && (MOODRE.test(t) || /\b(?:colou?rs?|gradient)\b/i.test(t) || new RegExp('\\b(?:' + Object.keys(COLORS).join('|') + ')\\s+(?:qr|code)\\b', 'i').test(t)) ? B.designFor(t, { type: det.type }) : null;
    const needs = B.needs(det.type, det.fields), T = B.TYPES[det.type];
    let say = det.direct ? `**${T.label} QR detected.**` : `I detected a **${T.label} QR** (${det.conf}% confident).`;
    if (det.reason) say += ` ${det.reason}.`;
    say += `\nRecommended: **${rec.title}** — ${rec.modeWhy}`;
    say += needs.length ? `\nI still need: **${needs.join('**, **')}** — fill it in on the right, or tell me here.` : '\nEverything looks complete — review the details on the right, then press **Generate**.';
    return { kind: 'create', det, rec, design, say };
  };

  /* ═══════ recommendations (4.6) ═══════ */
  B.recommend = (type, v, c) => {
    c = c || {}; const T = B.TYPES[type], L = String(c.text || '').toLowerCase(), r = {};
    const print = /\b(?:print|poster|flyer|banner|signage|sticker|packaging|brochure|billboard|menu card|table tent|standee)\b/.test(L) || !!c.print;
    const poster = /\b(?:poster|banner|billboard|signage|standee)\b/.test(L);
    const track = /\b(?:track|analytics|campaign|marketing|advert\w*|promotion|promo|discount|offer|change later|edit later|update later|seasonal)\b/.test(L);
    const bytes = c.bytes || 0, modules = c.modules || 29;
    if (T.dyn === 'page') { r.mode = 'dynamic'; r.title = `Dynamic Business QR (smart page${type === 'business' ? '' : ' · ' + T.label})`; r.modeWhy = 'one scan opens a mobile page with your details, map and files, and you can edit it any time without reprinting.'; }
    else if (T.dyn === 'file') { r.mode = 'dynamic'; r.title = 'Hosted file QR'; r.modeWhy = 'the file is hosted securely and the QR holds only a short link, which keeps it easy to scan.'; }
    else if (T.dyn === 'opt') { const dy = track || print || bytes > 350; r.mode = dy ? 'dynamic' : 'static'; r.title = `${dy ? 'Dynamic' : 'Static'} ${T.label} QR`; r.modeWhy = dy ? 'you can change the destination later and see scan analytics, and the code stays small.' : 'simple, free and permanent. Choose Dynamic if you may change the link later or want scan analytics.'; }
    else { r.mode = 'static'; r.title = `Static ${T.label} QR`; r.modeWhy = (STATIC_WHY[type] || 'the data is encoded directly, so it works offline and never expires.').replace(/^./, (x) => x.toLowerCase()); }
    r.ecl = 'M'; r.eclWhy = 'A good balance of density and damage tolerance.';
    if (c.logo) { r.ecl = 'H'; r.eclWhy = 'A centre logo hides part of the code, so the highest correction is needed.'; }
    else if (print) { r.ecl = 'Q'; r.eclWhy = 'Printed codes get scuffed or folded — Q tolerates about 25% damage.'; }
    else if (bytes > 700) { r.ecl = 'L'; r.eclWhy = 'Very long content: lower correction keeps modules bigger and easier to scan.'; }
    r.cm = Math.max(poster ? 10 : 2, Math.ceil((modules + 8) * 0.08 * 2) / 2);
    r.px = poster ? 4096 : print || modules > 60 ? 2048 : 1024;
    r.sizeWhy = `Print at least ${r.cm} cm wide (about 0.8 mm per module) and export ${r.px}px for sharp results.`;
    r.logo = modules > 57 ? { ok: false, text: 'This code is dense — skip the logo, or shorten the content first.' } : { ok: true, text: 'Centre a square logo no wider than 20% of the code, on a white pad. Error correction switches to H automatically.' };
    r.hosting = T.dyn === 'file' || c.fileKind ? { text: 'A file cannot live inside a QR. Host it on QRNova — the QR then holds only a short link.', href: '/file-to-qr?type=' + (c.fileKind || (v && v.kind) || 'pdf') } : null;
    r.design = B.designFor(c.designText || '', { type });
    return r;
  };

  /* ═══════ QR quality assistant (4.8) ═══════ */
  B.quality = (c) => {
    const L = [], st = c.style || {}, add = (id, s, label, detail) => L.push({ id, s, label, detail });
    const iss = c.issues || [], blocking = iss.filter((i) => i.lvl === 'error' || i.lvl === 'need'), warns = iss.filter((i) => i.lvl === 'warn');
    add('valid', blocking.length ? 'fail' : warns.length ? 'warn' : 'pass', 'Valid content', blocking.length ? blocking[0].msg : warns.length ? warns[0].msg : 'Complete and correctly formatted');
    let ratio = 99; const cols = [st.fg, st.fg2, st.eye].filter(Boolean);
    if (st.bg === 'transparent') add('contrast', 'warn', 'Good contrast', 'Transparent background — contrast depends on where you place it');
    else { cols.forEach((x) => { ratio = Math.min(ratio, contrast(x, st.bg)); }); const inv = lum(st.fg) > lum(st.bg); add('contrast', inv || ratio < 3 ? 'fail' : ratio < 4 ? 'warn' : 'pass', 'Good contrast', inv ? 'Light-on-dark codes fail on many scanners' : `Contrast ratio ${ratio.toFixed(1)}:1${ratio < 4 ? ' — darker colours scan more reliably' : ''}`); }
    add('quiet', st.margin >= 4 ? 'pass' : st.margin >= 2 ? 'warn' : 'fail', 'Sufficient quiet zone', `${st.margin} modules (standard is 4)`);
    const dense = c.stats && c.stats.size > 57;
    add('logo', !c.logo ? 'pass' : c.ecl === 'H' && !dense ? 'pass' : 'warn', 'Logo size acceptable', !c.logo ? 'No logo — maximum reliability' : dense ? 'Dense code: a logo may hurt scanning' : 'Logo covers about 4% of the area, error correction H');
    add('gen', c.stats ? 'pass' : 'fail', 'QR generated', c.stats ? `Version ${c.stats.version}, ${c.stats.size}×${c.stats.size} modules, ${c.stats.bytes} bytes` : 'Nothing to encode yet');
    const sc = c.scan;
    add('read', sc === 'ok' ? 'pass' : sc === 'fail' ? 'fail' : sc === 'diff' ? 'warn' : 'info', 'QR readable', sc === 'ok' ? 'Decoded exactly in a test scan' : sc === 'fail' ? 'This browser could not read it — raise contrast or error correction' : sc === 'diff' ? 'Decoded, but the text differs slightly' : sc === 'na' ? 'Auto-test is unsupported in this browser — test with a phone' : 'Press Generate to run a scan test');
    if (c.stats) {
      const ppm = c.size / (c.stats.size + 2 * (st.margin || 4)), ok = ratio >= 3 && st.bg !== 'transparent' && st.margin >= 4 && ppm >= 8;
      add('print', ok ? 'pass' : 'warn', 'Suitable for printing', ok ? `Print at least ${Math.max(2, Math.ceil((c.stats.size + 8) * 0.08 * 2) / 2)} cm wide` : ppm < 8 ? 'Increase the export size for sharper print' : 'Use solid contrast, a white background and a 4-module quiet zone');
    }
    const w = { pass: 1, info: 0.8, warn: 0.5, fail: 0 };
    const score = Math.round((100 * L.reduce((a, i) => a + w[i.s], 0)) / L.length);
    return { items: L, score, verdict: L.some((i) => i.s === 'fail') ? 'Needs attention' : L.some((i) => i.s === 'warn') ? 'Good — review the warnings' : 'Excellent — ready to use' };
  };

  /* ═══════ suggestions (4.11) ═══════ */
  B.suggest = (c) => {
    const T = B.TYPES[c.type], out = [];
    if (T.dyn === 'file') return [{ id: 'host', q: 'Would you like to host your file now?', yes: 'Open File → QR' }];
    if (!c.logo && !(c.stats && c.stats.size > 57)) out.push({ id: 'logo', q: 'Would you like to add a logo?', yes: 'Add logo' });
    if (c.mode === 'static' && (T.dyn === 'opt' || T.dyn === 'page') && !c.created) out.push({ id: 'dynamic', q: 'Would you like to make this QR dynamic, so you can edit it later?', yes: 'Make dynamic' });
    if (c.isDefault) out.push({ id: 'brand', q: 'Would you like to create a branded QR in your own colour?', yes: 'Pick brand colour' });
    if (!c.label) out.push({ id: 'frame', q: 'Add a call-to-action frame such as “' + (B.frameLabel(c.type) || 'Scan me') + '”?', yes: 'Add frame' });
    if (c.created) out.push({ id: 'dash', q: 'Manage scans and edit this code from your dashboard?', yes: 'Open dashboard' });
    return out.slice(0, 3);
  };
  const FRAMES = { wifi: 'Connect to Wi-Fi', upi: 'Scan to Pay', payurl: 'Scan to Pay', menu: 'Scan for the Menu', review: 'Scan to Review Us', vcard: 'Save my contact', event: 'Add to calendar', whatsapp: 'Chat on WhatsApp', business: 'Scan to learn more', product: 'Scan for details', location: 'Scan for directions', social: 'Follow us', telegram: 'Chat on Telegram', phone: 'Scan to call', sms: 'Scan to text us', email: 'Scan to email us', url: 'Scan me' };
  B.frameLabel = (type) => FRAMES[type] || 'Scan me';

  /* ═══════ content formatting (4.9) ═══════ */
  const URLKEYS = ['url', 'website', 'maps', 'mapurl', 'buy', 'menu', 'review'], TITLE = ['first', 'last'];
  B.tidy = (type, v) => {
    const out = Object.assign({}, v), ch = [], T = B.TYPES[type];
    const set = (k, nv, why) => { const o = out[k] == null ? '' : String(out[k]); if (nv !== o) { out[k] = nv; ch.push({ k, from: o, to: nv, why }); } };
    if (!T) return { values: out, changes: ch };
    T.fields.forEach((f) => {
      const raw = out[f.k]; if (raw == null || typeof raw === 'boolean' || f.k === 'pass') return;
      const s = String(raw).trim(); if (!s) return;
      if (f.t === 'area') set(f.k, B.cleanText(s), 'Cleaned spacing');
      else if (URLKEYS.includes(f.k) || (f.k === 'social' && type === 'business')) { const x = B.parseUrl(s); if (x) set(f.k, x.href.replace(/^(https?:\/\/[^/?#]+)\/$/, '$1'), 'Normalised the link'); }
      else if (f.k === 'phone' || f.k === 'mobile') { const p = B.phone(s); if (p.ok) set(f.k, p.e164, 'Standard phone format'); }
      else if (f.k === 'email' || f.k === 'to') { const lo = s.toLowerCase(), [u, d] = lo.split('@'); set(f.k, TYPO[d] ? u + '@' + TYPO[d] : lo, 'Lowercase / fixed typo'); }
      else if (TITLE.includes(f.k) || (f.k === 'name' && ['vcard', 'business', 'menu', 'event'].includes(type))) set(f.k, /^[A-Z][a-z]/.test(s) && s !== s.toUpperCase() ? s.replace(/\s+/g, ' ') : s.replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, a, b) => a + b.toUpperCase()), 'Capitalised');
      else set(f.k, s.replace(/\s+/g, ' '), 'Trimmed');
    });
    return { values: out, changes: ch };
  };
  const TAG = { Hotel: 'comfortable rooms, warm hospitality and a great location', Restaurant: 'fresh food, friendly service and a welcoming atmosphere', Healthcare: 'caring professionals and a comfortable, clean clinic', Education: 'quality teaching and a supportive learning environment', 'Real estate': 'trusted advice and well-chosen properties', 'Salon & beauty': 'expert stylists and a relaxing experience', Fitness: 'great equipment, expert trainers and a motivating community', Retail: 'quality products and friendly service', Portfolio: 'thoughtful design and work that speaks for itself', Tech: 'modern, reliable technology built around you' };
  B.describe = (type, v, cat) => {
    const n = val(v, 'name') || 'Us';
    if (type === 'event') { const d = val(v, 'date'), tm = [val(v, 'start'), val(v, 'end')].filter(Boolean).join('–'); return `Join us for ${n}${d ? ' on ' + new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}${tm ? ', ' + tm : ''}${val(v, 'location') ? ' at ' + val(v, 'location') : ''}.${val(v, 'organizer') ? ' Hosted by ' + val(v, 'organizer') + '.' : ''} Scan to add it to your calendar.`; }
    if (type === 'product') return `${n}${val(v, 'company') ? ' by ' + val(v, 'company') : ''}${val(v, 'price') ? ' — ' + val(v, 'price') : ''}. Scan for details${val(v, 'buy') ? ' and to buy' : ''}.`;
    const tag = TAG[cat] || (/hotel|resort|inn/i.test(n) ? TAG.Hotel : /restaurant|cafe|café|kitchen|bakery/i.test(n) ? TAG.Restaurant : 'quality service you can trust');
    return `${n} — ${tag}. Scan to ${type === 'menu' ? 'see the menu, ' : ''}call us, visit our website or get directions.`;
  };
  window.QRBrain = B;
})();
const { esc } = require('./util'); // eslint-disable-line no-unused-vars

const GROUPS = [
  ['Basic', [['text', '📝', 'Text'], ['url', '🔗', 'URL'], ['email', '✉️', 'Email'], ['phone', '📞', 'Phone'], ['sms', '💬', 'SMS']]],
  ['Communication', [['whatsapp', '🟢', 'WhatsApp'], ['telegram', '✈️', 'Telegram'], ['social', '🌐', 'Social media'], ['vcard', '👤', 'Contact / vCard']]],
  ['Business', [['business', '🏢', 'Business profile'], ['website', '🖥️', 'Website'], ['menu', '🍽️', 'Restaurant menu'], ['product', '📦', 'Product information'], ['review', '⭐', 'Customer review link']]],
  ['Location', [['map', '📍', 'Google Maps / map URL'], ['geo', '🧭', 'Latitude / longitude'], ['address', '🏠', 'Address']]],
  ['Connectivity', [['wifi', '📶', 'Wi-Fi']]],
  ['Payment', [['upi', '💸', 'UPI'], ['payurl', '💳', 'Payment URL']]],
  ['Events', [['event', '📅', 'Event / Calendar']]],
  ['Media', [['image', '🖼️', 'Image'], ['pdf', '📄', 'PDF'], ['video', '🎬', 'Video'], ['audio', '🎵', 'Audio'], ['document', '📁', 'Document']]],
  ['Advanced', [['custom', '🧩', 'Custom QR'], ['dynamic', '🔄', 'Dynamic QR'], ['ai', '🤖', 'AI-generated QR']]],
];
const FEATURES = [
  ['⚡', 'Instant QR generation', 'Your code updates live as you type — no waiting, no reloads.'],
  ['🤖', 'AI-powered creation', 'Describe what you need in plain English; the AI detects and structures it.'],
  ['📁', 'File-to-QR', 'Upload PDFs, images, video, audio or documents and get a scannable link.'],
  ['🎨', 'QR customization', 'Gradients, dot shapes, eye styles, colours and a centre logo.'],
  ['🔄', 'Dynamic QR', 'Change the destination any time — the printed QR never changes.'],
  ['📊', 'Scan analytics', 'Track scans per day and by device from your dashboard.'],
  ['🔐', 'Secure sharing', 'Unguessable file links, hashed passwords and hardened headers.'],
  ['📱', 'Fully responsive', 'Designed mobile-first; works on phones, tablets and desktops.'],
  ['💾', 'Multiple formats', 'Download PNG, JPG, WebP or vector SVG up to 4096 px.'],
  ['🔗', 'Easy sharing', 'Native share sheet, copy link or send straight to a printer.'],
  ['🖨️', 'Print-ready QR', 'Contrast checks and high-resolution exports for flyers and packaging.'],
  ['🌍', 'Standard QR compatibility', 'Every code follows ISO/IEC 18004 — any scanner app can read it.'],
];
const TEMPLATES = [
  ['🍽️', 'Restaurant', 'Menu, location, phone & website on one smart page.', 'menu'],
  ['🏨', 'Hotel', 'Booking link, rooms, contact & directions.', 'business'],
  ['💼', 'Portfolio', 'Showcase your work with a single scan.', 'business'],
  ['📄', 'Resume', 'Share your CV as a document you can replace later.', 'document'],
  ['🪪', 'Business card', 'A vCard that saves straight to contacts.', 'vcard'],
  ['📦', 'Product', 'Specs, price and buy link for packaging.', 'product'],
  ['🎉', 'Event', 'Calendar entry with time, place & details.', 'event'],
  ['💸', 'Payment', 'UPI payment with preset amount & note.', 'upi'],
  ['📶', 'Wi-Fi', 'Guests connect without typing a password.', 'wifi'],
  ['📱', 'Social media', 'Link to Instagram, YouTube, GitHub and more.', 'social'],
  ['📣', 'Marketing', 'Trackable dynamic link for flyers & ads.', 'url&mode=dynamic'],
  ['🎓', 'Education', 'Share notes, syllabi and worksheets.', 'pdf'],
  ['🏡', 'Real estate', 'Property page with price and agent contact.', 'business'],
  ['🩺', 'Healthcare', 'Clinic info, timings and appointment link.', 'business'],
  ['🧑', 'Personal', 'Your own link-in-bio style QR.', 'vcard'],
];
const FAQ = [
  ['What is a QR code?', 'A QR (Quick Response) code is a two-dimensional barcode that stores text, links or data. A phone camera reads it and performs an action such as opening a website, joining Wi-Fi or saving a contact.'],
  ['Does it work on iPhone?', 'Yes. The iPhone Camera app scans standard QR codes natively — just point and tap the banner that appears.'],
  ['Does it work on Android?', 'Yes. Modern Android phones scan QR codes from the Camera app or Google Lens. No extra app needed.'],
  ['What is a dynamic QR?', 'A dynamic QR contains a short link that points to our server, which redirects to your content. Because the link is managed, you can change the destination later and track scans — without reprinting the QR.'],
  ['Can I put a PDF in a QR?', 'Yes. Upload the PDF and we create a dynamic QR that opens it on any phone. You can replace the PDF later and the same QR keeps working.'],
  ['Can I put an image in a QR?', 'Yes — upload an image and the QR opens a clean viewer page. (Pixels cannot be stored inside a QR itself, so images are hosted and linked.)'],
  ['Can I change a dynamic QR later?', 'Yes. Open your dashboard, press Edit, and change the link, details or file. The printed QR never changes.'],
  ['Can I download the QR?', 'Yes — PNG, JPG, WebP and vector SVG, up to 4096 px, plus a print-ready view.'],
  ['Is the QR permanent?', 'Static QR codes are permanent — the data lives inside the pattern. Dynamic QR codes work as long as your account and the link exist.'],
  ['Is my uploaded file secure?', 'Files get random, unguessable names and are served with security headers. Only people who scan or receive your QR link can open them.'],
  ['How does the AI work?', 'You describe what you want in plain English. A built-in intent engine detects links, phones, emails, locations, Wi-Fi, UPI IDs and file mentions, recommends the best QR type and builds it. It runs locally — no API key needed.'],
  ['What file formats are supported?', 'PDF, PNG, JPG, GIF, WebP, MP4, WebM, MOV, MP3, WAV, OGG, M4A, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT and CSV — up to 15 MB each.'],
];

const faqHtml = (n = FAQ.length) => `<div class="faq stagger">${FAQ.slice(0, n).map(([q, a]) => `<details class="card"><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
const tplHtml = () => `<div class="grid g3 stagger">${TEMPLATES.map((t) => `<a class="card tpl" href="/qr-generator?type=${t[3]}"><span class="tpl-i">${t[0]}</span><h3>${t[1]}</h3><p>${t[2]}</p><span class="lnk">Use template →</span></a>`).join('')}</div>`;
const featHtml = () => `<div class="grid g4 stagger">${FEATURES.map((f) => `<div class="card feat"><span class="fi">${f[0]}</span><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div>`;
const hero = (kicker, title, sub) => `<section class="page-hero container"><span class="badge reveal">${kicker}</span><h1 class="reveal">${title}</h1><p class="lead reveal">${sub}</p></section>`;
const cta = `<section class="container"><div class="cta-band reveal"><h2>Ready to turn anything into a QR code?</h2><p>Free to start. No API keys. No credit card.</p><a class="btn btn-primary" href="/qr-generator">⚡ Create QR Code</a> <a class="btn btn-ghost" href="/ai-qr">🤖 Try AI Studio</a></div></section>`;
const legal = (title, kicker, secs) => ({
  title: `${title} — QRNova`, desc: `${title} for QRNova`,
  body: hero(kicker, title, 'Plain-language summary. Replace with text reviewed by your legal counsel before launching publicly.') +
    `<section class="container legal">${secs.map(([h, t]) => `<div class="card reveal"><h3>${h}</h3><p>${t}</p></div>`).join('')}</section>`,
});
const groupsHtml = () => `<div class="grid g3 stagger">${GROUPS.map(([g, items]) => `<div class="card"><h3>${g}</h3><div class="chips">${items.map(([id, ic, n]) => `<a class="chip" href="${id === 'ai' ? '/ai-qr' : '/qr-generator?type=' + id}">${ic} ${n}</a>`).join('')}</div></div>`).join('')}</div>`;
const secH = (t, s) => `<div class="sec-h reveal"><h2>${t}</h2><p>${s}</p></div>`;

const authBox = (mode) => `<section class="container auth-wrap"><div class="card auth reveal"><h1>${mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p class="mut">${mode === 'login' ? 'Log in to manage your dynamic QR codes.' : 'Free forever for static QR. Account needed for dynamic QR & analytics.'}</p>
<form id="authForm" data-mode="${mode}">${mode === 'signup' ? '<div class="fld"><label>Name</label><input class="in" name="name" required autocomplete="name"></div>' : ''}
<div class="fld"><label>Email</label><input class="in" type="email" name="email" required autocomplete="email"></div>
<div class="fld"><label>Password</label><input class="in" type="password" name="password" required minlength="8" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></div>
<p id="authMsg" class="err"></p><button class="btn btn-primary" style="width:100%;justify-content:center">${mode === 'login' ? 'Log in' : 'Sign up free'}</button></form>
<p class="mut" style="margin-top:1rem">${mode === 'login' ? 'New here? <a class="lnk" href="/signup">Create an account</a>' : 'Already have an account? <a class="lnk" href="/login">Log in</a>'}</p></div></section>`;

const stat = (n, l, suf = '') => `<div class="stat"><b data-count="${n}" data-suf="${suf}">0</b><span>${l}</span></div>`;

module.exports = {
  /* ═══════════ public site ═══════════ */
  home: {
    title: 'QRNova — Turn Anything Into a QR Code with AI',
    desc: 'Create smart, customizable static and dynamic QR codes for text, links, images, PDFs, email, contacts, payments, Wi-Fi and more.',
    scripts: ['/js/ai.js', '/js/home.js'],
    body: `
<section class="hero container">
  <div class="hero-l">
    <span class="badge reveal">✨ AI-powered · Static &amp; Dynamic · Zero API keys</span>
    <h1 class="reveal">Turn Anything Into a QR Code with <span class="grad">AI</span></h1>
    <p class="lead reveal">Create smart, customizable QR codes for text, links, images, PDFs, email, contact information, payments, Wi-Fi and more.</p>
    <div class="cta reveal"><a class="btn btn-primary" href="/qr-generator">⚡ Create QR Code</a><a class="btn btn-ghost" href="/ai-qr">🤖 Generate with AI</a><a class="btn btn-ghost" href="/qr-generator">Try It Free</a></div>
    <p class="now reveal">Now encoding: <b id="rot" class="grad">Text</b></p>
  </div>
  <div class="hero-r reveal">
    <div class="float" style="top:2%;left:-4%;--d:0s">📶 Wi-Fi</div>
    <div class="float" style="top:18%;right:-6%;--d:-1.5s">💸 UPI</div>
    <div class="float" style="top:52%;left:-9%;--d:-3s">📄 PDF</div>
    <div class="float" style="bottom:14%;right:-8%;--d:-4.5s">👤 vCard</div>
    <div class="float" style="bottom:-2%;left:10%;--d:-2s">🍽️ Menu</div>
    <div class="float" style="top:-4%;right:20%;--d:-5s">📍 Map</div>
    <div class="qr-card"><div class="qr-stage scan" id="heroQR"></div><input id="heroIn" class="in" placeholder="Type anything — watch it become a QR…" maxlength="200" aria-label="Live QR preview text"></div>
  </div>
</section>

<section class="container"><div class="stats reveal">${stat(25, 'QR types', '+')}${stat(0, 'API keys needed')}${stat(12, 'Download & share options')}${stat(3, 'Seconds to create', 's')}</div></section>

<section class="container sec">${secH('Every QR type you can imagine', 'Pick a type and we generate a standards-compliant, scannable code.')}${groupsHtml()}</section>
<section class="container sec">${secH('Everything you need, nothing you don’t', 'Powerful features wrapped in a beautiful, fast interface.')}${featHtml()}</section>

<section class="container sec" id="how">${secH('How it works', 'From idea to printed QR in six simple steps.')}
<div class="steps stagger">
${['Choose what you want to convert', 'Enter or upload your content', 'AI validates and optimizes it', 'Customize your QR', 'Generate and test', 'Download · Share · Print'].map((s, i) => `<div class="step card"><b>${i + 1}</b><p>${s}</p></div>`).join('')}
</div></section>

<section class="container sec" id="ai-demo">${secH('Tell us what you want to create', 'Describe it in plain English — the AI does the rest.')}
<div class="demo card reveal" id="demoBox">
  <div class="bubble user"><span class="av">🧑</span><span id="demoTxt"></span><i class="caret"></i></div>
  <div class="bubble ai"><span class="av">🤖</span><div id="demoOut" class="out"><span class="mut">Waiting for your prompt…</span></div></div>
</div></section>

<section class="container sec">${secH('Ready-made templates', 'Start from a template and make it yours in seconds.')}${tplHtml()}</section>
<section class="container sec">${secH('Frequently asked questions', 'Quick answers to the things people ask most.')}${faqHtml(6)}<p style="text-align:center;margin-top:1.5rem"><a class="btn btn-ghost" href="/faq">See all questions</a></p></section>
${cta}`,
  },

  about: {
    title: 'About — QRNova', desc: 'Why we built QRNova.',
    body: hero('About us', 'We make the physical world <span class="grad">clickable</span>', 'QRNova started with one idea: creating a QR code should feel like magic, not like filling in a form.') +
      `<section class="container sec"><div class="grid g3 stagger">
      <div class="card"><h3>🎯 Our mission</h3><p>Give everyone — from street-food vendors to global brands — a beautiful, reliable way to connect printed media with digital content.</p></div>
      <div class="card"><h3>🛡️ Our principles</h3><p>Standard-compliant codes, honest pricing, respect for privacy and no lock-in: static QR codes are yours forever.</p></div>
      <div class="card"><h3>🤖 Our approach</h3><p>An intent engine understands plain English, picks the right QR type and does the boring formatting for you.</p></div></div></section>${cta}`,
  },

  features: {
    title: 'Features — QRNova', desc: 'All QRNova features.',
    body: hero('Features', 'Built for <span class="grad">creators &amp; businesses</span>', 'Everything from a quick Wi-Fi code to a tracked, editable campaign QR.') +
      `<section class="container sec">${featHtml()}</section>
      <section class="container sec">${secH('Static vs Dynamic', 'Choose the right one for the job.')}
      <div class="grid g2 stagger"><div class="card"><h3>⚡ Static QR</h3><ul class="ul"><li>Data is encoded directly in the pattern</li><li>Free, instant, never expires</li><li>No account needed</li><li>Cannot be edited after printing</li></ul></div>
      <div class="card"><h3>🔄 Dynamic QR</h3><ul class="ul"><li>Points to a short managed link</li><li>Change destination any time</li><li>Scan analytics by day &amp; device</li><li>Hosts PDFs, images, video, audio and smart pages</li></ul></div></div></section>${cta}`,
  },

  templates: { title: 'Templates — QRNova', desc: 'Ready-made QR templates.', body: hero('Templates', 'Start with a <span class="grad">template</span>', 'Fifteen ready-made starting points for the most common QR use cases.') + `<section class="container sec">${tplHtml()}</section>${cta}` },

  pricing: {
    title: 'Pricing — QRNova', desc: 'Simple pricing.',
    body: hero('Pricing', 'Simple, <span class="grad">honest</span> pricing', 'Demo plans — wire up a payment provider before charging real customers.') + `
<section class="container sec"><div class="grid g3 stagger price-grid">
<div class="card"><h3>Free</h3><div class="price">$0<small>/mo</small></div><ul class="ul"><li>Unlimited static QR codes</li><li>All 25+ QR types</li><li>PNG / JPG / WebP / SVG</li><li>AI QR Studio</li></ul><a class="btn btn-ghost full" href="/qr-generator">Start free</a></div>
<div class="card popular"><span class="badge">Most popular</span><h3>Pro</h3><div class="price">$9<small>/mo</small></div><ul class="ul"><li>Everything in Free</li><li>Dynamic QR (100)</li><li>File hosting up to 15 MB</li><li>Scan analytics</li></ul><a class="btn btn-primary full" href="/signup">Get Pro</a></div>
<div class="card"><h3>Business</h3><div class="price">$29<small>/mo</small></div><ul class="ul"><li>Everything in Pro</li><li>Priority support</li><li>Team workspace</li><li>Custom domain (self-host)</li></ul><a class="btn btn-ghost full" href="/contact">Contact us</a></div>
</div></section>${cta}`,
  },

  faq: { title: 'FAQ — QRNova', desc: 'Frequently asked questions.', body: hero('FAQ', 'Questions? <span class="grad">Answered.</span>', 'Everything you need to know about QR codes and QRNova.') + `<section class="container sec">${faqHtml()}</section>${cta}` },

  contact: {
    title: 'Contact — QRNova', desc: 'Get in touch.', scripts: ['/js/account.js'],
    body: hero('Contact', 'Let’s <span class="grad">talk</span>', 'Questions, feedback or partnership ideas — send us a message.') + `
<section class="container sec"><div class="grid g2"><form class="card reveal" id="contactForm"><div class="fld"><label>Name</label><input class="in" name="name" required></div><div class="fld"><label>Email</label><input class="in" type="email" name="email" required></div><div class="fld"><label>Message</label><textarea class="in" name="message" rows="5" required></textarea></div><p class="err" id="cMsg"></p><button class="btn btn-primary">Send message</button></form>
<div class="card reveal"><h3>Other ways to reach us</h3><p>📧 hello@qrnova.example<br>🕒 Mon–Fri, 9am–6pm<br>🌍 Remote-first team</p></div></div></section>`,
  },

  blog: {
    title: 'Blog — QRNova', desc: 'QR code tips and guides.',
    body: hero('Blog', 'Guides &amp; <span class="grad">ideas</span>', 'Practical tips for getting more from your QR codes.') + `<section class="container sec"><div class="grid g3 stagger">
${[['Static vs Dynamic QR: which should you use?', 'Use static for permanent info like Wi-Fi or a vCard. Use dynamic when the destination may change, you want analytics, or you are printing at scale. Dynamic codes redirect through a short link, so you can fix typos and swap offers without reprinting.'],
['7 rules for QR codes that actually scan', 'Keep strong contrast between code and background, leave a quiet zone around the edge, never invert colours for important codes, keep logos small, print at least 2 cm wide and always test with two different phones before printing.'],
['Restaurant menus: the smart-page trick', 'Instead of a PDF-only link, use a smart page that combines menu, phone, directions and website. Update prices or the menu file whenever you like — the table-top QR stays the same.']].map(([t, b]) => `<details class="card post"><summary><h3>${t}</h3><span class="lnk">Read →</span></summary><p>${b}</p></details>`).join('')}
</div></section>`,
  },

  privacy: legal('Privacy Policy', 'Legal', [['What we collect', 'Account details (name, email, hashed password), the dynamic QR codes you create, files you upload and anonymous scan counts (day and device type).'], ['What we do not collect', 'Static QR content is generated for you and not stored. We do not sell data or use third-party ad trackers.'], ['Your control', 'You can delete any dynamic QR (and its uploaded file) from the dashboard at any time.'], ['Contact', 'Questions? Visit the Contact page.']]),
  terms: legal('Terms of Service', 'Legal', [['Acceptable use', 'Do not use QRNova for phishing, malware, illegal content or to infringe the rights of others. We may disable abusive QR codes.'], ['Your content', 'You keep ownership of everything you upload and are responsible for having the right to share it.'], ['Availability', 'The service is provided “as is”. Dynamic QR codes depend on the service remaining online.'], ['Changes', 'We may update these terms; continued use means acceptance.']]),
  security: legal('Security', 'Trust', [['Passwords', 'Passwords are salted and hashed with scrypt. Sessions use random 256-bit tokens that expire after 30 days.'], ['Uploads', 'File types are allow-listed, size-limited to 15 MB, renamed to random names and served with X-Content-Type-Options: nosniff.'], ['Hardening', 'Rate limiting on sensitive endpoints, escaped output and safe-redirect validation (http/https only).'], ['Reporting', 'Found a vulnerability? Please contact us privately.']]),
  cookies: legal('Cookie Policy', 'Legal', [['Essential storage only', 'We use browser storage for your login token, theme choice and cookie notice. No advertising or cross-site tracking.'], ['Manage', 'Clear site data in your browser to remove everything we store.']]),

  /* ═══════════ tools ═══════════ */
  generator: {
    title: 'QR Generator — QRNova', desc: 'Generate custom static and dynamic QR codes for text, links, Wi-Fi, payments, contacts and more.',
    scripts: ['/js/countries.js', '/js/generator.js', '/js/gen-ux.js'], cls: 'tool',
    body: hero('QR Generator', 'Build your <span class="grad">perfect QR</span>', 'Choose a type, enter your content, customize, preview live and generate — in seconds.') + `
<section class="container"><ol class="stepper" id="stepper">${['Choose type', 'Enter content', 'Customize', 'Preview', 'Generate'].map((s, i) => `<li data-s="${i + 1}"><b>${i + 1}</b><span>${s}</span></li>`).join('')}</ol></section>
<section class="container gen" id="gen">
  <div class="gen-l">
    <div class="card" id="sec1"><div class="card-h"><h3>① Choose QR type</h3><input class="in tsearch" id="typeSearch" type="search" placeholder="Search types…" aria-label="Search QR types"></div><div id="types"></div></div>
    <div class="card" id="sec2"><div class="card-h"><h3>② Enter content</h3><div class="tools"><button type="button" class="btn btn-ghost sm" id="fillEx">✨ Example</button> <button type="button" class="btn btn-ghost sm" id="clearAll">Reset</button></div></div>
      <div id="modeBar"></div><form id="form" onsubmit="return false" novalidate></form><div id="extra"></div></div>
    <div class="card" id="sec3"><h3>③ Customize</h3>
      <label class="lbl">Colour presets</label><div class="sw" id="presets"></div>
      <div class="row3"><div class="fld"><label>Foreground</label><input type="color" id="fg" value="#7c5cff"></div>
        <div class="fld"><label>Gradient end</label><input type="color" id="fg2" value="#22d3ee"></div>
        <div class="fld"><label>Background</label><input type="color" id="bg" value="#ffffff"></div></div>
      <div class="row3"><label class="chk"><input type="checkbox" id="useGrad" checked> Use gradient</label><label class="chk"><input type="checkbox" id="transp"> Transparent bg</label><label class="chk"><input type="checkbox" id="eyeSame" checked> Eyes match</label></div>
      <div class="fld" id="eyeWrap" hidden><label>Eye colour</label><input type="color" id="eye" value="#ff5ea8"></div>
      <label class="lbl">Dot style</label><div class="seg" id="dots"><button type="button" data-v="square">▪ Square</button><button type="button" data-v="rounded" class="on">▢ Rounded</button><button type="button" data-v="dots">● Dots</button><button type="button" data-v="diamond">◆ Diamond</button></div>
      <label class="lbl">Eye style</label><div class="seg" id="eyes"><button type="button" data-v="square">Square</button><button type="button" data-v="rounded" class="on">Rounded</button><button type="button" data-v="circle">Circle</button></div>
      <div class="row3"><div class="fld"><label>Error correction</label><select class="in" id="ecl"><option value="L">L · 7%</option><option value="M" selected>M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option></select></div>
        <div class="fld"><label>Export size (px)</label><select class="in" id="size"><option>256</option><option>512</option><option selected>1024</option><option>2048</option><option>4096</option></select></div>
        <div class="fld"><label>Quiet zone</label><input type="range" id="margin" min="1" max="8" value="4"><small class="fh" id="marginOut">4 modules</small></div></div>
      <div class="fld"><label>Frame label (optional)</label><input class="in" id="label" maxlength="32" list="labels" placeholder="e.g. Scan to Review Us"><datalist id="labels"><option value="Scan me"><option value="Scan to Review Us"><option value="Scan to Pay"><option value="Scan for Menu"><option value="Connect to Wi-Fi"><option value="Save my contact"></datalist></div>
      <div class="fld"><label>Centre logo (optional)</label><div class="row2"><input class="in" type="file" id="logo" accept="image/*"><button type="button" class="btn btn-ghost sm" id="logoClear">Remove</button></div></div>
    </div>
  </div>
  <aside class="gen-r"><div class="card sticky">
    <div class="prev-h"><h3>④ Live preview</h3><span class="live"><i></i>Live</span></div>
    <div class="qr-stage scan checker" id="stage"></div>
    <div id="info" class="info"></div>
    <button class="btn btn-primary full" id="create" disabled>⚡ Generate QR</button>
    <div id="testRes" class="testres"></div>
    <div class="dl" id="dl">
      <button class="btn btn-ghost sm" id="dlPng" disabled>PNG</button><button class="btn btn-ghost sm" id="dlJpg" disabled>JPG</button><button class="btn btn-ghost sm" id="dlWebp" disabled>WebP</button><button class="btn btn-ghost sm" id="dlSvg" disabled>SVG</button>
      <button class="btn btn-ghost sm" id="print" disabled>🖨️ Print</button><button class="btn btn-ghost sm" id="share" disabled>🔗 Share</button><button class="btn btn-ghost sm" id="copy" disabled>📋 Copy</button><button class="btn btn-ghost sm" id="test" disabled>🧪 Test</button>
    </div>
  </div></aside>
</section>`,
  },

  ai: {
    title: 'AI QR Studio — QRNova', desc: 'Describe what you want and let the AI detect, validate, design and quality-check your QR code.',
    scripts: ['/js/countries.js', '/js/qrtools.js', '/js/aibrain.js', '/js/studio.js'], cls: 'tool',
    body: hero('AI QR Studio', 'Just <span class="grad">describe it</span>', 'No forms, no guessing. Tell the AI what your QR should contain. It detects the type, checks your data, designs it and quality-tests it before you download.') + `
<section class="container"><div class="ast" id="ast">
  <div class="card ast-chat" id="chat">
    <div class="ast-head">
      <div class="ast-title"><span class="ast-orb">✨</span><div><b>AI QR Assistant</b><small>Runs locally · no API key · your data stays in your browser</small></div></div>
      <div class="ast-hb"><button type="button" class="btn btn-ghost sm" id="histBtn">🕘 History</button><button type="button" class="btn btn-ghost sm" id="newBtn">＋ New</button></div>
    </div>
    <div class="ast-drawer" id="hist" hidden>
      <div class="card-h"><h3>AI conversation history</h3><button type="button" class="btn btn-ghost sm" id="histClose" aria-label="Close history">✕</button></div>
      <input class="in" id="hSearch" type="search" placeholder="Search sessions…" aria-label="Search sessions">
      <div class="h-list" id="hList"></div>
      <button type="button" class="btn btn-ghost sm" id="hClear">🗑️ Delete all history</button>
    </div>
    <div class="ast-log" id="log" role="log" aria-live="polite"></div>
    <div class="chips ast-starters" id="starters"></div>
    <div class="ast-attach" id="attachBar" hidden></div>
    <form class="ast-form" id="chatForm" autocomplete="off">
      <label class="lbl" for="prompt">What do you want to create?</label>
      <div class="ast-row">
        <button type="button" class="icon-btn" id="attachBtn" title="Read a file: TXT, VCF, CSV, PDF, DOCX or a photo" aria-label="Read a file">📎</button>
        <textarea class="in" id="prompt" rows="2" maxlength="3000" placeholder="Type your request…  e.g. Create a QR for my portfolio website."></textarea>
        <button class="btn btn-primary" id="sendBtn">Generate</button>
      </div>
      <input type="file" id="attachIn" hidden accept=".txt,.vcf,.csv,.md,.pdf,.docx,image/png,image/jpeg,image/webp">
    </form>
  </div>

  <div class="ast-work empty" id="work">
    <div class="card" id="pCard">
      <div class="prev-h"><h3>Live preview</h3><span class="live"><i></i>Live</span></div>
      <div class="qr-stage scan checker" id="stage"></div>
      <div id="info" class="info"></div>
      <div id="modeBar"></div>
      <button type="button" class="btn btn-primary full" id="genBtn" disabled>⚡ Generate QR</button>
      <div class="dl" id="dl">
        <button type="button" class="btn btn-ghost sm" id="dlPng" disabled>PNG</button><button type="button" class="btn btn-ghost sm" id="dlJpg" disabled>JPG</button><button type="button" class="btn btn-ghost sm" id="dlWebp" disabled>WebP</button><button type="button" class="btn btn-ghost sm" id="dlSvg" disabled>SVG</button>
        <button type="button" class="btn btn-ghost sm" id="print" disabled>🖨️ Print</button><button type="button" class="btn btn-ghost sm" id="share" disabled>🔗 Share</button><button type="button" class="btn btn-ghost sm" id="copy" disabled>📋 Copy</button><button type="button" class="btn btn-ghost sm" id="testBtn" disabled>🧪 Test</button>
      </div>
    </div>

    <div class="card" id="dCard">
      <div class="card-h"><h3>① Details</h3><div class="tools"><button type="button" class="btn btn-ghost sm" id="tidyBtn">✨ Auto-format</button> <button type="button" class="btn btn-ghost sm" id="descBtn" hidden>✍️ Write description</button></div></div>
      <div class="fld"><label for="typeSel">QR type</label><select class="in" id="typeSel"></select></div>
      <form id="form" onsubmit="return false" novalidate></form>
      <div id="upWrap"></div>
      <h4 class="sub-h">AI validation</h4>
      <ul class="iss-list" id="issues"></ul>
    </div>

    <div class="card" id="rCard"><h3>② 💡 AI recommendations</h3><div class="rec-grid" id="recs"></div></div>

    <div class="card" id="sCard">
      <h3>③ 🎨 AI design assistant</h3>
      <p class="hint">Ask in the chat, or tap an idea:</p>
      <div class="chips" id="dprompts" style="margin-bottom:1rem"></div>
      <label class="lbl">Style presets</label><div class="themes" id="themes"></div>
      <div class="row3"><div class="fld"><label for="sFg">Foreground</label><input type="color" id="sFg" value="#6d28d9"></div><div class="fld"><label for="sFg2">Gradient end</label><input type="color" id="sFg2" value="#0e7490"></div><div class="fld"><label for="sBg">Background</label><input type="color" id="sBg" value="#ffffff"></div></div>
      <div class="row3"><div class="fld"><label for="sEye">Eye colour</label><input type="color" id="sEye" value="#be185d"></div><label class="chk"><input type="checkbox" id="sGrad" checked> Use gradient</label><label class="chk"><input type="checkbox" id="sTransp"> Transparent bg</label></div>
      <label class="lbl">Dot style</label><div class="seg" id="sDots"><button type="button" data-v="square">▪ Square</button><button type="button" data-v="rounded" class="on">▢ Rounded</button><button type="button" data-v="dots">● Dots</button><button type="button" data-v="diamond">◆ Diamond</button></div>
      <label class="lbl">Eye style</label><div class="seg" id="sEyes"><button type="button" data-v="square">Square</button><button type="button" data-v="rounded" class="on">Rounded</button><button type="button" data-v="circle">Circle</button></div>
      <div class="row3"><div class="fld"><label for="sEcl">Error correction</label><select class="in" id="sEcl"><option value="L">L · 7%</option><option value="M" selected>M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option></select></div><div class="fld"><label for="sSize">Export size (px)</label><select class="in" id="sSize"><option>512</option><option selected>1024</option><option>2048</option><option>4096</option></select></div><div class="fld"><label for="sMargin">Quiet zone</label><input type="range" id="sMargin" min="1" max="8" value="4"><small class="fh" id="sMarginOut">4 modules</small></div></div>
      <div class="fld"><label for="sLabel">Frame label</label><div class="row2"><input class="in" id="sLabel" maxlength="32" placeholder="e.g. Scan to Review Us"><button type="button" class="btn btn-ghost sm" id="frameAuto">Auto</button></div></div>
      <div class="fld"><label>Centre logo</label><div class="row2"><button type="button" class="btn btn-ghost sm" id="logoBtn">🖼️ Add logo</button><button type="button" class="btn btn-ghost sm" id="logoClear" hidden>Remove</button><input type="file" id="logoIn" accept="image/*" hidden></div></div>
    </div>

    <div class="card" id="qCard"><h3>④ ✅ AI quality check</h3><div id="quality"></div></div>
  </div>
</div></section>`,
  },

  design: {
    title: 'QR Design Studio — QRNova', desc: 'Design branded QR codes: styles, gradients, custom eyes, logos, frames, captions, print templates and PDF export.',
    scripts: ['/js/qrtools.js', '/js/designer.js'], cls: 'tool',
    body: hero('Design Studio', 'Make it <span class="grad">unmistakably yours</span>', 'Style, colour, gradient, eyes, logo, background, frame and caption — every change updates the preview instantly. Then test it, download it or lay it out for print.') + `
<section class="container"><div id="ds"><noscript><div class="note">The Design Studio needs JavaScript.</div></noscript></div></section>`,
  },

  filetoqr: {
    title: 'File to QR — QRNova', desc: 'Upload images, PDFs, video, audio and documents and get a secure, scannable QR code.',
    scripts: ['/js/qrtools.js', '/js/filetoqr.js', '/js/gen-ux.js'], cls: 'tool',
    body: hero('File → QR', 'Turn any <span class="grad">file</span> into a QR', 'Upload an image, PDF, video, audio clip or document. We host it securely and give you a QR that opens it on any phone.') + `
<section class="container"><div id="loginBar" class="note" hidden>🔐 Uploading needs a free account. <a class="lnk" href="/login?next=/file-to-qr">Log in</a> or <a class="lnk" href="/signup?next=/file-to-qr">sign up</a>. You can still pick a file and preview it first.</div></section>
<section class="container"><ol class="stepper" id="stepper">${['Upload', 'Preview', 'Security', 'Generate QR', 'Download'].map((s, i) => `<li data-s="${i + 1}"><b>${i + 1}</b><span>${s}</span></li>`).join('')}</ol></section>
<section class="container gen" id="ftq">
  <div class="gen-l">
    <div class="card" id="s1"><div class="card-h"><h3>① Choose &amp; upload a file</h3></div>
      <div class="chips" id="ftabs"></div>
      <div class="dz" id="dz" tabindex="0" role="button" aria-label="Choose or drop a file"><div class="dz-i">☁️</div><b id="dzTitle">Drop your file here</b><span id="dzHint" class="mut">or click to browse</span><input type="file" id="fileIn" hidden></div>
    </div>
    <div class="card" id="s2"><h3>② Validate &amp; preview</h3><div id="pv"></div></div>
    <div class="card" id="s3"><h3>③ Access &amp; security</h3>
      <div class="fld"><label for="title">Title (shown on the viewer page)</label><input class="in" id="title" maxlength="120" placeholder="e.g. Summer menu 2026"></div>
      <div class="row3">
        <div class="fld"><label for="access">Who can open it</label><select class="in" id="access"><option value="public">🌐 Anyone with the QR</option><option value="password">🔑 Password protected</option><option value="private">🔒 Private (only me)</option></select></div>
        <div class="fld"><label for="expiry">Link expires</label><select class="in" id="expiry"><option value="never">Never</option><option value="1h">In 1 hour</option><option value="24h">In 24 hours</option><option value="7d">In 7 days</option><option value="30d">In 30 days</option><option value="custom">Custom date…</option></select></div>
        <label class="chk"><input type="checkbox" id="allowDl" checked> Allow download</label>
      </div>
      <div class="fld" id="pwWrap" hidden><label for="pw">Password (min 4 characters)</label><div class="pwd"><input class="in" id="pw" type="password" autocomplete="new-password"><button type="button" class="eye" data-eye aria-label="Show or hide password">👁️</button></div></div>
      <div class="fld" id="expWrap" hidden><label for="expAt">Expires at</label><input class="in" type="datetime-local" id="expAt"></div>
      <p class="hint" id="accHint"></p>
      <div class="chips trust"><span class="chip">🛡️ Content verified</span><span class="chip">🔑 Unguessable link</span><span class="chip">⏳ Optional expiry</span><span class="chip">🚫 Abuse reporting</span></div>
    </div>
    <div class="card" id="s4"><h3>🎨 QR style (optional)</h3>
      <label class="lbl">Colour presets</label><div class="sw" id="presets"></div>
      <label class="lbl">Dot style</label><div class="seg" id="dots"><button type="button" data-v="square">▪ Square</button><button type="button" data-v="rounded" class="on">▢ Rounded</button><button type="button" data-v="dots">● Dots</button><button type="button" data-v="diamond">◆ Diamond</button></div>
      <label class="lbl">Eye style</label><div class="seg" id="eyes"><button type="button" data-v="square">Square</button><button type="button" data-v="rounded" class="on">Rounded</button><button type="button" data-v="circle">Circle</button></div>
      <div class="row2"><div class="fld" style="flex:1"><label for="label">Frame label</label><input class="in" id="label" maxlength="32" list="flabels" placeholder="e.g. Scan to view"><datalist id="flabels"><option value="Scan to view"><option value="Scan for the menu"><option value="Scan to download"><option value="Scan to watch"><option value="Scan to listen"></datalist></div>
      <div class="fld"><label for="size">Export size</label><select class="in" id="size"><option>512</option><option selected>1024</option><option>2048</option></select></div></div>
    </div>
  </div>
  <aside class="gen-r"><div class="card sticky">
    <div class="prev-h"><h3>④ Your QR code</h3><span class="live"><i></i>Live</span></div>
    <div class="qr-stage scan checker" id="stage"></div>
    <div class="prog" id="prog" hidden><div class="meter"><i id="progBar"></i></div><small id="progTxt" class="mut"></small></div>
    <ul class="pipe" id="pipe"></ul>
    <div id="info" class="info"></div>
    <button class="btn btn-primary full" id="create" disabled>☁️ Upload &amp; Create QR</button>
    <div class="dl" id="dl"><button class="btn btn-ghost sm" id="dlPng" disabled>PNG</button><button class="btn btn-ghost sm" id="dlJpg" disabled>JPG</button><button class="btn btn-ghost sm" id="dlWebp" disabled>WebP</button><button class="btn btn-ghost sm" id="dlSvg" disabled>SVG</button><button class="btn btn-ghost sm" id="print" disabled>🖨️ Print</button><button class="btn btn-ghost sm" id="share" disabled>🔗 Share</button><button class="btn btn-ghost sm" id="copy" disabled>📋 Link</button></div>
    <div class="row2" id="after" hidden style="margin-top:.8rem"><a class="btn btn-ghost sm" href="/my-files">📂 My Files</a><button class="btn btn-ghost sm" id="another">➕ Another file</button></div>
  </div></aside>
</section>`,
  },

  myfiles: {
    title: 'My Files — QRNova', desc: 'Manage your hosted files and their QR codes.', scripts: ['/js/qrtools.js', '/js/myfiles.js'],
    body: `<section class="container dash" id="fm">
<div class="dash-h"><div><h1>My Files</h1><p class="mut" id="fmHello">Everything you host behind a QR code.</p></div><div class="row2"><a class="btn btn-ghost" id="adminLink" href="/admin" hidden>⚙️ Admin</a><a class="btn btn-primary" href="/file-to-qr">+ Upload file</a></div></div>
<div class="stats" id="fmKpis"></div><div class="meter" style="margin:-.2rem 0 1.4rem"><i id="fmMeter"></i></div>
<div class="card" style="margin-bottom:1.2rem"><div class="fm-bar"><input class="in" id="fmSearch" type="search" placeholder="Search files…" aria-label="Search files"><select class="in" id="fmSort" aria-label="Sort"><option value="new">Newest</option><option value="old">Oldest</option><option value="views">Most viewed</option><option value="size">Largest</option><option value="name">Name A–Z</option></select></div>
<div class="seg" id="fmState"></div><div class="chips" id="fmCats"></div></div>
<div id="fmList" class="fm-grid"></div></section>
<input type="file" id="replaceIn" hidden>
<dialog id="dEdit"><form id="eForm"><h3>File settings</h3>
  <div class="fld"><label for="eTitle">Title</label><input class="in" id="eTitle" maxlength="120" required></div>
  <div class="fld"><label for="eName">File name</label><div class="row2"><input class="in" id="eName" maxlength="110" required><b id="eExt" class="mut"></b></div></div>
  <div class="fld"><label for="eAccess">Who can open it</label><select class="in" id="eAccess"><option value="public">🌐 Anyone with the QR</option><option value="password">🔑 Password protected</option><option value="private">🔒 Private (only me)</option></select></div>
  <div class="fld" id="ePwWrap" hidden><label for="ePw">Password</label><input class="in" id="ePw" type="password" autocomplete="new-password"></div>
  <label class="chk" style="margin-bottom:.9rem"><input type="checkbox" id="eDl"> Allow download</label>
  <div class="fld"><label for="eExp">Expires at</label><input class="in" type="datetime-local" id="eExp"><div class="chips" style="margin-top:.5rem"><button type="button" class="chip" data-h="24">+1 day</button><button type="button" class="chip" data-h="168">+7 days</button><button type="button" class="chip" data-h="720">+30 days</button><button type="button" class="chip" data-h="0">No expiry</button></div></div>
  <div class="row2" style="margin-top:1rem"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save changes</button></div></form></dialog>
<dialog id="dPrev"><div class="card-h"><h3 id="pvTitle">Preview</h3><button class="btn btn-ghost sm" data-close>✕</button></div><div id="pvBody"></div><div class="row2" style="margin-top:1rem"><a class="btn btn-primary sm" id="pvDl" href="#">⬇️ Download</a></div></dialog>
<dialog id="dQr"><div class="card-h"><h3 id="qrTitle">QR code</h3><button class="btn btn-ghost sm" data-close>✕</button></div><div id="qrBody"></div><div class="dl" style="grid-template-columns:repeat(4,1fr)"><button class="btn btn-ghost sm" id="qPng">PNG</button><button class="btn btn-ghost sm" id="qSvg">SVG</button><button class="btn btn-ghost sm" id="qPrint">🖨️</button><button class="btn btn-ghost sm" id="qCopy">📋 Link</button></div></dialog>
<dialog id="dShare"><div class="card-h"><h3>Share</h3><button class="btn btn-ghost sm" data-close>✕</button></div><div id="shBody"></div></dialog>`,
  },

  /* ═══════════ accounts ═══════════ */
  login: { title: 'Log in — QRNova', desc: 'Log in', scripts: ['/js/account.js', '/js/authpages.js'], body: authBox('login') },
  signup: { title: 'Sign up — QRNova', desc: 'Create a free account', scripts: ['/js/account.js', '/js/authpages.js'], body: authBox('signup') },

  forgot: {
    title: 'Forgot password — QRNova', desc: 'Reset your QRNova password', scripts: ['/js/authpages.js'],
    body: `<section class="container auth-wrap"><div class="card auth reveal"><h1>Forgot your password?</h1><p class="mut">Enter your account email and we’ll send you a reset link.</p>
<form id="forgotForm"><div class="fld"><label for="fEmail">Email</label><input class="in" id="fEmail" type="email" name="email" required autocomplete="email"></div><p id="fMsg" class="err" role="alert"></p><button class="btn btn-primary" style="width:100%;justify-content:center">Send reset link</button></form>
<div id="fDone" hidden></div><p class="mut" style="margin-top:1rem"><a class="lnk" href="/login">← Back to log in</a></p></div></section>`,
  },
  reset: {
    title: 'Reset password — QRNova', desc: 'Choose a new password', scripts: ['/js/authpages.js'],
    body: `<section class="container auth-wrap"><div class="card auth reveal"><h1>Choose a new password</h1><p class="mut">Use at least 8 characters with a letter and a number. You will be logged out on all devices.</p>
<form id="resetForm"><div class="fld"><label for="rPw">New password</label><input class="in" id="rPw" type="password" name="password" required minlength="8" autocomplete="new-password"></div><div class="fld"><label for="rPw2">Repeat password</label><input class="in" id="rPw2" type="password" name="again" required minlength="8" autocomplete="new-password"></div><p id="rMsg" class="err" role="alert"></p><button class="btn btn-primary" style="width:100%;justify-content:center">Save new password</button></form>
<div id="rDone" hidden></div></div></section>`,
  },
  verify: {
    title: 'Verify email — QRNova', desc: 'Confirm your email address', scripts: ['/js/authpages.js'],
    body: `<section class="container auth-wrap"><div class="card auth reveal" id="vBox" style="text-align:center"><div class="big">⏳</div><h1>Verifying…</h1></div></section>`,
  },
  account: {
    title: 'Account — QRNova', desc: 'Manage your QRNova account', scripts: ['/js/authpages.js'],
    body: `<section class="container"><div class="acct" id="acct">
<div><h1 style="font-size:2.2rem">Account</h1><p class="mut">Profile, security and your data.</p></div>
<div class="note" id="vBanner" hidden>✉️ <b>Verify your email</b> to secure your account and enable recovery. <button type="button" class="btn btn-primary sm" id="vResend">Resend link</button><div id="vDev"></div></div>
<div class="card"><h3>Profile</h3><form id="profForm"><div class="fld"><label for="aName">Name</label><input class="in" id="aName" maxlength="60" required></div>
<div class="acct-row"><span class="mut">Email</span><span><b id="aEmail"></b> <span id="aVer"></span></span><span class="mut">Sign-in method</span><span id="aProv"></span><span class="mut">Member since</span><span id="aSince"></span></div>
<button class="btn btn-primary" style="margin-top:1rem">Save profile</button></form></div>
<div class="card"><h3 id="pwTitle">Change password</h3><form id="pwForm"><div class="fld" id="curWrap"><label for="pwCur">Current password</label><input class="in" id="pwCur" type="password" autocomplete="current-password"></div><div class="row2"><div class="fld" style="flex:1"><label for="pwNew">New password</label><input class="in" id="pwNew" type="password" minlength="8" autocomplete="new-password" required></div><div class="fld" style="flex:1"><label for="pwNew2">Repeat</label><input class="in" id="pwNew2" type="password" minlength="8" autocomplete="new-password" required></div></div><p class="hint">At least 8 characters with a letter and a number. Other devices will be logged out.</p><p class="err" id="pwMsg" role="alert"></p><button class="btn btn-primary">Update password</button></form></div>
<div class="card"><div class="card-h"><h3>Active sessions</h3><button type="button" class="btn btn-ghost sm" id="revokeAll">Log out other devices</button></div><div id="aSess"></div></div>
<div class="card"><h3>Your data</h3><p class="mut">Download everything we store about your account, QR codes, files metadata, designs and history as JSON.</p><button type="button" class="btn btn-ghost" id="expBtn" style="margin-top:.8rem">⬇️ Export my data</button></div>
<div class="card danger"><h3>Delete account</h3><p class="mut">This permanently deletes your account, QR codes, hosted files, designs and history. Printed dynamic QR codes will stop working. This cannot be undone.</p>
<form id="delForm"><div class="fld" id="delPwWrap"><label for="delPw">Confirm with your password</label><input class="in" id="delPw" type="password" autocomplete="current-password"></div><div class="fld" id="delEmailWrap" hidden><label for="delEm">Type your email address to confirm</label><input class="in" id="delEm" type="email" autocomplete="off"></div><p class="err" id="delMsg" role="alert"></p><button class="btn btn-danger">Delete my account</button></form></div>
</div></section>`,
  },

  /* ═══════════ dashboard, QR management, analytics ═══════════ */
  dashboard: {
    title: 'Dashboard — QRNova', desc: 'Your QR codes, scans and activity', scripts: ['/js/qrtools.js', '/js/dashboard.js'],
    body: `<section class="container dash" id="dsh">
<div class="dash-h"><div><h1>Dashboard</h1><p class="mut" id="hello">Loading…</p></div><div class="row2"><a class="btn btn-ghost" href="/analytics">📊 Analytics</a><a class="btn btn-ghost" href="/my-qr-codes">▦ My QR Codes</a><a class="btn btn-primary" href="/qr-generator">＋ Create QR</a></div></div>
<div class="note" id="vBan" hidden>✉️ Your email is not verified yet. <a class="lnk" href="/account">Verify it in Account settings</a> to secure your account.</div>
<div class="note" id="expBan" hidden></div>
<div class="dcards" id="dCards"></div>
<div class="dgrid">
  <div class="card"><div class="card-h"><h3>Scans · last 14 days</h3><b class="mut" id="scanTot"></b></div><div id="dChart"></div></div>
  <div class="card"><h3>Devices</h3><div id="dDev"></div></div>
</div>
<div class="dgrid">
  <div class="card"><div class="card-h"><h3>Recent Activity</h3><a class="lnk" href="/my-qr-codes#history">See all →</a></div><ul class="tl" id="dAct"></ul></div>
  <div class="card"><h3>Top QR codes</h3><div id="dTop"></div><h3 style="margin-top:1.3rem">Storage</h3><div class="meter"><i id="dMeter"></i></div><small class="mut" id="dStore"></small></div>
</div>
<div class="card"><h3>Create something new</h3><div class="qa">
  <a href="/qr-generator"><span>⚡</span><b>QR Generator</b><small>16 QR types</small></a>
  <a href="/ai-qr"><span>🤖</span><b>AI QR Studio</b><small>Describe it</small></a>
  <a href="/file-to-qr"><span>☁️</span><b>File → QR</b><small>PDF, image, video</small></a>
  <a href="/design-studio"><span>🎨</span><b>Design Studio</b><small>Brand your QR</small></a>
</div></div>
</section>`,
  },

  myqr: {
    title: 'My QR Codes — QRNova', desc: 'Manage all your QR codes', scripts: ['/js/qrtools.js', '/js/share.js', '/js/myqr.js'],
    body: `<section class="container dash" id="mq">
<div class="dash-h"><div><h1>My QR Codes</h1><p class="mut">Search, organise, edit and track everything in one place.</p></div>
<div class="row2"><button type="button" class="btn btn-ghost" id="mqHist">🕘 History</button><button type="button" class="btn btn-ghost" id="mqFold">📁 Folders</button>
<details class="mm" id="mqNew"><summary class="btn btn-primary">＋ New QR</summary><div class="mm-m"><a href="/qr-generator">⚡ QR Generator</a><a href="/ai-qr">🤖 AI QR Studio</a><a href="/file-to-qr">☁️ File → QR</a><a href="/design-studio">🎨 Design Studio</a></div></details></div></div>
<div class="mq-wrap">
  <aside class="card mq-side"><h4>Folders</h4><div id="mqFolders"></div></aside>
  <div>
    <div class="card mq-tools">
      <div class="mq-r1"><input class="in" id="mqSearch" type="search" placeholder="Search name, content, type, file or date (e.g. “menu”, “pdf”, “oct 2026”)…" aria-label="Search QR codes"><select class="in" id="mqSort" aria-label="Sort"><option value="new">Newest</option><option value="mod">Recently modified</option><option value="old">Oldest</option><option value="scans">Most scanned</option><option value="name">Name A–Z</option></select></div>
      <div class="mq-r2"><label>From <input class="in" type="date" id="mqFrom"></label><label>To <input class="in" type="date" id="mqTo"></label><label>Type <select class="in" id="mqType"></select></label></div>
      <div class="seg" id="mqMode"></div><div class="seg" id="mqStatus"></div><div class="chips"><button type="button" class="chip" id="mqFav">★ Favorites</button></div>
    </div>
    <p class="mut" id="mqCount" style="margin:.2rem 0 1rem"></p>
    <div id="mqList" class="mq-grid"></div>
  </div>
</div></section>
<dialog id="dView"><div class="card-h"><h3 id="vTitle">QR code</h3><button class="btn btn-ghost sm" data-close aria-label="Close">✕</button></div><div id="vBody"></div></dialog>
<dialog id="dEdit"><form id="eForm"><h3>Edit QR code</h3><div id="eFields"></div><div class="row2" style="margin-top:1rem"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save changes</button></div></form></dialog>
<dialog id="dAcc"><form id="accForm"><h3>Access &amp; expiry</h3>
  <label class="lbl">Who can open it</label>
  <div class="rds">
    <label class="rd"><input type="radio" name="acc" value="public"><span>🌐 <b>Public</b><small>Anyone who scans the QR</small></span></label>
    <label class="rd"><input type="radio" name="acc" value="password"><span>🔑 <b>Password protected</b><small>Scan → password → content</small></span></label>
    <label class="rd"><input type="radio" name="acc" value="private"><span>🔒 <b>Private</b><small>Only you (through your preview link)</small></span></label>
    <label class="rd" id="rdRestricted"><input type="radio" name="acc" value="restricted"><span>🚧 <b>Restricted</b><small>Limit by scans, device or time of day</small></span></label>
  </div>
  <div class="fld" id="accPwWrap" hidden><label for="accPw">Password (min 4 characters)</label><input class="in" id="accPw" type="password" autocomplete="new-password"><small class="fh" id="accPwHint"></small></div>
  <div id="accRestrict" hidden class="rst">
    <div class="fld"><label for="rsMax">Maximum scans (0 = unlimited)</label><input class="in" id="rsMax" type="number" min="0" max="1000000"></div>
    <label class="lbl">Allowed devices (none ticked = all)</label><div class="chips"><label class="chk chip"><input type="checkbox" name="dev" value="android"> Android</label><label class="chk chip"><input type="checkbox" name="dev" value="ios"> iPhone / iPad</label><label class="chk chip"><input type="checkbox" name="dev" value="desktop"> Desktop</label></div>
    <div class="row2" style="margin-top:.7rem"><div class="fld" style="flex:1"><label for="rsFrom">Open from (your time)</label><input class="in" id="rsFrom" type="time"></div><div class="fld" style="flex:1"><label for="rsTo">Until</label><input class="in" id="rsTo" type="time"></div></div>
  </div>
  <label class="lbl" style="margin-top:1rem">Expiration</label>
  <div class="rds">
    <label class="rd"><input type="radio" name="exp" value="never"><span>♾️ <b>Never</b><small>Until you deactivate it</small></span></label>
    <label class="rd"><input type="radio" name="exp" value="date"><span>📅 <b>On a date</b></span></label>
    <label class="rd"><input type="radio" name="exp" value="days"><span>⏱️ <b>After a number of days</b></span></label>
  </div>
  <input class="in" type="datetime-local" id="expAt" hidden aria-label="Expiry date"><input class="in" type="number" id="expDays" min="1" max="1825" value="30" hidden aria-label="Days until expiry">
  <label class="chk" id="dlWrap" hidden style="margin-top:.9rem"><input type="checkbox" id="accDl"> Allow download</label>
  <p class="hint">Manual deactivation: use <b>Deactivate</b> in the card menu at any time.</p><p class="err" id="accMsg" role="alert"></p>
  <div class="row2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save</button></div></form></dialog>
<dialog id="dShare"><div class="card-h"><h3>Share</h3><button class="btn btn-ghost sm" data-close aria-label="Close">✕</button></div><div id="shBody"></div></dialog>
<dialog id="dAna"><div class="card-h"><h3 id="aTitle">Analytics</h3><button class="btn btn-ghost sm" data-close aria-label="Close">✕</button></div><div class="row2"><select class="in" id="aDays" aria-label="Range" style="max-width:190px"><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option></select></div><div id="aBody"></div></dialog>
<dialog id="dHist"><div class="card-h"><h3 id="hTitle">QR history</h3><button class="btn btn-ghost sm" data-close aria-label="Close">✕</button></div><div class="chips" id="hChips"></div><ul class="tl" id="hList"></ul></dialog>
<dialog id="dFold"><div class="card-h"><h3>Folders</h3><button class="btn btn-ghost sm" data-close aria-label="Close">✕</button></div><div id="fList"></div>
  <form id="fForm" class="row2" style="margin-top:1rem"><select class="in" id="fEmoji" style="max-width:84px" aria-label="Icon"><option>📁</option><option>👤</option><option>🏢</option><option>📣</option><option>🍽️</option><option>📄</option><option>🎉</option><option>💸</option><option>🌐</option><option>⭐</option><option>🎓</option><option>🏨</option></select><input class="in" id="fName" maxlength="30" placeholder="New folder name" required><button class="btn btn-primary sm">Add</button></form></dialog>
<dialog id="dMove"><form id="mvForm"><h3>Move to folder</h3><div class="fld"><select class="in" id="mvSel" aria-label="Folder"></select></div><div class="row2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Move</button></div></form></dialog>`,
  },

  analytics: {
    title: 'Analytics — QRNova', desc: 'Scan analytics for your QR codes', scripts: ['/js/qrtools.js', '/js/charts.js', '/js/analytics.js'],
    body: `<section class="container dash" id="an">
<div class="dash-h"><div><h1>Analytics</h1><p class="mut" id="anSub">Loading…</p></div>
<div class="row2 an-ctl"><select class="in" id="anQr" aria-label="QR code"></select><select class="in" id="anDays" aria-label="Range"><option value="7">7 days</option><option value="14">14 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option></select><button type="button" class="btn btn-ghost" id="anCsv">⬇️ CSV</button><span class="live"><i></i>Live</span></div></div>
<div class="note" id="anEmpty" hidden>📭 No scans recorded yet. Scans appear here as soon as someone scans a <b>dynamic</b> QR code (static codes can’t be tracked). Bots and link previews are not counted.</div>
<div class="acards" id="anCards"></div>
<div class="agrid">
  <div class="card"><div class="card-h"><h3>Scan trends</h3><div class="seg" id="anGran"><button type="button" data-g="daily" class="on">Daily</button><button type="button" data-g="weekly">Weekly</button><button type="button" data-g="monthly">Monthly</button></div></div><div id="anTrend"></div></div>
  <div class="card"><h3>Device breakdown</h3><div id="anDev"></div><h4 class="sub-h">Operating system</h4><div id="anOs"></div></div>
</div>
<div class="agrid">
  <div class="card"><h3>Daily activity</h3><div id="anCal"></div></div>
  <div class="card"><h3>Time distribution</h3><h4 class="sub-h" style="margin-top:.2rem">By hour of day</h4><div id="anHrs"></div><h4 class="sub-h">By day of week</h4><div id="anWk"></div></div>
</div>
<div class="agrid3">
  <div class="card"><h3>Browser breakdown</h3><div id="anBr"></div></div>
  <div class="card"><h3>Geographic distribution</h3><div id="anGeo"></div></div>
  <div class="card"><h3>Referrers</h3><div id="anRef"></div></div>
</div>
<div class="card"><h3>Latest scans</h3><div class="tbl-wrap"><table class="tbl" id="anRecent"></table></div>
<p class="hint">Privacy: IP addresses are never stored. Region is approximate (from your CDN’s country header or the visitor’s browser language). Unique scans use a salted hash. Visitors who send Do Not Track share only a coarse device type. Days follow your time zone.</p></div>
</section>`,
  },

  admin: {
    title: 'Admin — QRNova', desc: 'Platform administration', scripts: ['/js/qrtools.js', '/js/charts.js', '/js/admin.js'],
    body: `<section class="container dash adm" id="adm">
<div class="dash-h"><div><h1>Admin</h1><p class="mut" id="admWho">Platform control centre</p></div><a class="btn btn-ghost" href="/dashboard">← Dashboard</a></div>
<div class="note" id="admGate" hidden>🔐 Admin access required. Log in with an admin account. Super Admins are set with the <code>ADMIN_EMAIL</code> environment variable (or the very first account when it is not set).</div>
<div id="admBody" hidden><div class="tabs" id="admTabs"></div><div id="admView"></div></div>
</section>
<dialog id="dAdm"><div class="card-h"><h3 id="dAdmT">Details</h3><button class="btn btn-ghost sm" data-close aria-label="Close">✕</button></div><div id="dAdmB"></div></dialog>`,
  },

  /* ═══════════ system pages ═══════════ */
  maintenance: { title: 'Maintenance — QRNova', body: `<section class="container center-page"><div class="big">🛠️</div><h1>We’ll be <span class="grad">right back</span></h1><p class="lead">QRNova is getting some upgrades. Please check back in a few minutes.</p></section>` },
  '404': { title: 'Page not found — QRNova', body: `<section class="container center-page"><div class="big grad">404</div><h1>This page wandered off</h1><p class="lead">The page you’re looking for doesn’t exist or the QR link was removed.</p><a class="btn btn-primary" href="/">Back to home</a></section>` },
};
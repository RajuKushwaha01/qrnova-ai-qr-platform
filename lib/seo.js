'use strict';
const { esc } = require('./util');
const cfg = () => require('./settings').get();

const PUBLIC = [['/', 1, 'weekly'], ['/qr-generator', 0.9, 'weekly'], ['/ai-qr', 0.9, 'weekly'], ['/design-studio', 0.8], ['/file-to-qr', 0.8], ['/templates', 0.7], ['/features', 0.7], ['/pricing', 0.7], ['/faq', 0.6], ['/about', 0.5], ['/blog', 0.5], ['/contact', 0.4], ['/privacy', 0.3], ['/terms', 0.3], ['/security', 0.3], ['/cookies', 0.2]];
const PRIVATE = /^\/(dashboard|my-qr-codes|my-files|analytics|account|admin|login|signup|forgot-password|reset-password|verify-email|maintenance|404|500)(\/|$)/;
const baseOf = (req) => (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function inject(body, req, status) {
  const B = cfg().brand, base = baseOf(req), path = req.path.replace(/\/$/, '') || '/', canon = base + (path === '/' ? '/' : path);
  const noindex = status >= 400 || PRIVATE.test(path);
  const title = (/<title>([^<]*)<\/title>/.exec(body) || [])[1] || esc(B.name), desc = (/<meta name="description" content="([^"]*)"/.exec(body) || [])[1] || esc(B.tagline);
  let t = `<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}">`;
  if (!noindex) {
    const img = esc(`${base}/api/qr.png?data=${encodeURIComponent(canon)}&size=600&fg=6d28d9&ecl=Q`);
    t += `<link rel="canonical" href="${esc(canon)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${esc(B.name)}"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${esc(canon)}"><meta property="og:image" content="${img}">`
      + `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${img}">`;
    if (path === '/') {
      t += ld({ '@context': 'https://schema.org', '@type': 'Organization', name: B.name, url: base + '/' })
        + ld({ '@context': 'https://schema.org', '@type': 'WebSite', name: B.name, url: base + '/', description: plain(desc) })
        + ld({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: B.name, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } });
    } else if (path === '/faq') {
      const qa = []; const re = /<summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p>/g; let m;
      while ((m = re.exec(body))) qa.push({ '@type': 'Question', name: plain(m[1]), acceptedAnswer: { '@type': 'Answer', text: plain(m[2]) } });
      if (qa.length) t += ld({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa });
    } else {
      t += ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' }, { '@type': 'ListItem', position: 2, name: plain(title).split(' — ')[0], item: canon }] });
    }
  }
  return body.replace('</head>', t + '</head>');
}

function mount(app) {
  app.get('/robots.txt', (req, res) => res.type('text/plain').send(['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /dashboard', 'Disallow: /my-qr-codes', 'Disallow: /my-files', 'Disallow: /analytics', 'Disallow: /account', 'Disallow: /admin', 'Disallow: /login', 'Disallow: /signup', 'Disallow: /q/', 'Disallow: /qr/', 'Disallow: /f/', 'Disallow: /s/', '', `Sitemap: ${baseOf(req)}/sitemap.xml`, ''].join('\n')));
  app.get('/sitemap.xml', (req, res) => {
    const base = baseOf(req), d = new Date().toISOString().slice(0, 10);
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PUBLIC.map(([p, pr, cf]) => `<url><loc>${esc(base + p)}</loc><lastmod>${d}</lastmod><changefreq>${cf || 'monthly'}</changefreq><priority>${pr}</priority></url>`).join('')}</urlset>`);
  });
  // add canonical / Open Graph / Twitter / JSON-LD to every public HTML page
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || /\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
    const send = res.send.bind(res);
    res.send = (body) => {
      if (typeof body === 'string' && body.startsWith('<!DOCTYPE html') && body.includes('</head>') && !body.includes('<meta name="robots"')) body = inject(body, req, res.statusCode);
      return send(body);
    };
    next();
  });
}

module.exports = { mount };
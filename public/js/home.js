(() => {
  const { $, matrix, sleep } = { ...QRX, matrix: QRX.matrix };

  /* live hero QR */
  const stage = $('#heroQR'), inp = $('#heroIn');
  if (stage) {
    const style = { fg: '#7c5cff', fg2: '#22d3ee', bg: '#ffffff', eye: '#ff5ea8', dots: 'rounded', eyes: 'rounded', margin: 3, anim: true };
    let t;
    const draw = async (v) => {
      try { const m = await matrix(v || 'https://qrnova.ai', 'M'); stage.innerHTML = QRX.svg(m.rows, style); } catch {}
    };
    draw();
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => draw(inp.value.trim().slice(0, 200)), 250); });
  }

  /* rotating word */
  const rot = $('#rot');
  if (rot) {
    const words = ['Text', 'Links', 'PDFs', 'Wi-Fi', 'Payments', 'Menus', 'Contacts', 'Images', 'Events', 'Anything'];
    let i = 0; rot.style.transition = 'opacity .3s';
    setInterval(() => { rot.style.opacity = 0; setTimeout(() => { rot.textContent = words[++i % words.length]; rot.style.opacity = 1; }, 300); }, 2200);
  }

  /* AI demo (typed prompt -> real analysis) */
  const box = $('#demoBox');
  if (box && window.QRAI) {
    const text = 'Create a QR for my restaurant containing my menu PDF, location, phone number and website.';
    const typed = $('#demoTxt'), out = $('#demoOut'); let ran = false;
    new IntersectionObserver((e, o) => { if (e[0].isIntersecting && !ran) { ran = true; o.disconnect(); run(); } }, { threshold: 0.45 }).observe(box);
    async function run() {
      for (let i = 1; i <= text.length; i++) { typed.textContent = text.slice(0, i); await sleep(24); }
      out.innerHTML = '<div class="think">AI is analyzing<span>.</span><span>.</span><span>.</span></div>';
      await sleep(1100);
      const r = QRAI.analyze(text);
      out.innerHTML = '<b>Detected:</b><div id="det"></div>';
      for (const it of r.items) { $('#det').insertAdjacentHTML('beforeend', `<div class="it">✓ ${it.l}</div>`); await sleep(260); }
      out.insertAdjacentHTML('beforeend', `<div class="rec">Recommended:<br>${r.rec}</div><a class="btn btn-primary" href="/ai-qr?prompt=${encodeURIComponent(text)}">Generate QR</a>`);
    }
  }
})();
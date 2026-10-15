(() => {
  const { esc } = QRX;

  QRX.PRESETS = [['Midnight', '#111827', null, '#111827'], ['Aurora', '#7c5cff', '#22d3ee', '#ff5ea8'], ['Sunset', '#ff5e62', '#ff9966', '#c2185b'], ['Ocean', '#0ea5e9', '#2563eb', '#0b3b8f'], ['Forest', '#16a34a', '#065f46', '#064e3b'], ['Berry', '#c026d3', '#7c3aed', '#701a75']];

  QRX.fmtSize = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.ceil(b / 1024) + ' KB' : b + ' B');

  /* QR + optional label frame, as one SVG */
  QRX.framed = (rows, o, label, size) => {
    size = size || 1024; label = String(label || '').trim();
    if (!label) return QRX.svg(rows, Object.assign({}, o, { size }));
    const inner = QRX.svg(rows, Object.assign({}, o, { size: 980 })).replace(/^<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '<svg$1 x="60" y="60" width="980" height="980"');
    const frame = o.fg, light = QRX.lum(frame) > 0.4;
    const fs = Math.max(44, Math.min(120, Math.floor(980 / (Math.max(label.length, 6) * 0.6)))), ty = Math.round(1195 + fs * 0.35);
    const h = Math.round((size * 1330) / 1100);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1330" width="${size}" height="${h}"><rect width="1100" height="1330" rx="70" fill="${frame}"/><rect x="40" y="40" width="1020" height="1020" rx="24" fill="${o.bg === 'transparent' ? '#ffffff' : o.bg}"/>${inner}<text x="550" y="${ty}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${fs}" fill="${light ? '#111827' : '#ffffff'}">${esc(label)}</text></svg>`;
  };
  QRX.toBlob = (svg, w, h, mime) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      if (mime !== 'image/png') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
      x.drawImage(img, 0, 0, w, h);
      c.toBlob((b) => (b ? res(b) : rej(new Error('Your browser could not create this file'))), mime, 0.95);
    };
    img.onerror = () => rej(new Error('Could not render the QR image'));
    img.src = QRX.svgUrl(svg);
  });
  QRX.svgDims = (svg) => { const m = svg.match(/width="(\d+)" height="(\d+)"/); return [+m[1], +m[2]]; };

  /* multipart upload with progress */
  QRX.upload = (url, method, fd, onp) => new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    const t = QRX.token(); if (t) x.setRequestHeader('Authorization', 'Bearer ' + t);
    if (onp) x.upload.onprogress = (e) => { if (e.lengthComputable) onp(e.loaded / e.total); };
    x.onload = () => {
      let j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
      if (x.status >= 200 && x.status < 300) res(j);
      else { if (x.status === 401) QRX.clearAuth(); rej(new Error(j.error || 'Upload failed (' + x.status + ')')); }
    };
    x.onerror = () => rej(new Error('Network error — the file may exceed the server limit.'));
    x.send(fd);
  });
})();
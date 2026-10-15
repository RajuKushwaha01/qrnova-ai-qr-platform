(() => {
  const { $, api, toast, esc } = QRX;
  const q = new URLSearchParams(location.search);
  const dev = (u) => (u ? `<div class="note" style="margin-top:.8rem">🧪 <b>Dev mode:</b> no email server is configured, so here is your link: <a class="lnk" href="${esc(u)}">${esc(u)}</a></div>` : '');
  const strong = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
  const ago = (t) => { if (!t) return '—'; const d = (Date.now() - t) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : new Date(t).toLocaleDateString(); };

  /* ---------- log in / sign up extras ---------- */
  const af = $('#authForm');
  if (af) {
    if (q.get('error')) $('#authMsg').textContent = q.get('error');
    if (af.dataset.mode === 'login') af.insertAdjacentHTML('beforeend', '<p style="margin-top:.9rem"><a class="lnk" href="/forgot-password">Forgot your password?</a></p><p class="hint">Signed up with Google or GitHub? Use that button below.</p>');
    else af.insertAdjacentHTML('beforeend', '<p class="hint">Password: at least 8 characters, with a letter and a number. We email a link to verify your address.</p>');
    api('/api/auth/providers').then((p) => {
      if (!p.google && !p.github) return;
      af.closest('.auth').insertAdjacentHTML('beforeend', `<div class="oa"><span>or continue with</span>${p.google ? '<a class="btn btn-ghost" href="/auth/google">Google</a>' : ''}${p.github ? '<a class="btn btn-ghost" href="/auth/github">GitHub</a>' : ''}</div>`);
    }).catch(() => {});
  }

  /* ---------- forgot password ---------- */
  const ff = $('#forgotForm');
  if (ff) ff.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = ff.querySelector('button'); b.disabled = true; $('#fMsg').textContent = '';
    try {
      const r = await api('/api/auth/forgot', { method: 'POST', body: { email: ff.email.value } });
      ff.hidden = true; $('#fDone').hidden = false; $('#fDone').innerHTML = `<div class="note ok" style="margin-top:1rem">✅ ${esc(r.message)}</div>${dev(r.devLink)}`;
    } catch (err) { $('#fMsg').textContent = err.message; b.disabled = false; }
  });

  /* ---------- reset password ---------- */
  const rf = $('#resetForm');
  if (rf) {
    const tok = q.get('token') || '';
    if (!tok) { rf.hidden = true; $('#rDone').hidden = false; $('#rDone').innerHTML = '<div class="note" style="margin-top:1rem">This reset link is incomplete. Please request a new one.</div><a class="btn btn-primary" href="/forgot-password" style="margin-top:1rem">Request a new link</a>'; }
    rf.addEventListener('submit', async (e) => {
      e.preventDefault(); const m = $('#rMsg'); m.textContent = '';
      if (rf.password.value !== rf.again.value) { m.textContent = 'The passwords do not match.'; return; }
      if (!strong(rf.password.value)) { m.textContent = 'Use at least 8 characters, with a letter and a number.'; return; }
      const b = rf.querySelector('button'); b.disabled = true;
      try { await api('/api/auth/reset', { method: 'POST', body: { token: tok, password: rf.password.value } }); QRX.clearAuth(); rf.hidden = true; $('#rDone').hidden = false; $('#rDone').innerHTML = '<div class="note ok" style="margin-top:1rem">✅ Password updated. You can log in now.</div><a class="btn btn-primary" href="/login" style="margin-top:1rem">Log in</a>'; }
      catch (err) { m.textContent = err.message; b.disabled = false; }
    });
  }

  /* ---------- verify email ---------- */
  const vb = $('#vBox');
  if (vb) (async () => {
    const tok = q.get('token');
    const bad = (msg) => { vb.innerHTML = `<div class="big">⚠️</div><h1>Link not valid</h1><p class="mut">${esc(msg)}</p><a class="btn btn-primary" href="/account" style="margin-top:1rem">Open account settings</a>`; };
    if (!tok) return bad('This verification link is incomplete.');
    try { const r = await api('/api/auth/verify', { method: 'POST', body: { token: tok } }); vb.innerHTML = `<div class="big">✅</div><h1>Email verified</h1><p class="mut">${esc(r.email)} is confirmed.</p><a class="btn btn-primary" href="/dashboard" style="margin-top:1rem">Go to dashboard</a>`; }
    catch (err) { bad(err.message); }
  })();

  /* ---------- account settings ---------- */
  const A = $('#acct');
  if (A) (async () => {
    if (!QRX.token()) { location.href = '/login?next=/account'; return; }
    let me = null;
    const paint = () => {
      $('#aName').value = me.name; $('#aEmail').textContent = me.email;
      $('#aProv').textContent = me.provider === 'password' ? 'Email & password' : me.provider[0].toUpperCase() + me.provider.slice(1);
      $('#aSince').textContent = me.created ? new Date(me.created).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
      $('#aVer').innerHTML = me.verified ? '<span class="bdg ok">✓ Verified</span>' : '<span class="bdg archived">Not verified</span>';
      $('#vBanner').hidden = me.verified; $('#curWrap').hidden = !me.hasPassword;
      $('#delPwWrap').hidden = !me.hasPassword; $('#delEmailWrap').hidden = me.hasPassword;
      $('#pwTitle').textContent = me.hasPassword ? 'Change password' : 'Set a password';
    };
    const sessions = async () => {
      const r = await api('/api/account/sessions');
      $('#aSess').innerHTML = r.items.map((s) => `<div class="sess${s.current ? ' cur' : ''}" data-id="${esc(s.id)}"><div class="sess-i">${/Android|iOS/.test(s.device) ? '📱' : '💻'}</div><div><b>${esc(s.device)}</b>${s.current ? ' <span class="bdg ok">This device</span>' : ''}<small>${esc(s.ip)} · active ${ago(s.last)} · signed in ${ago(s.created)}</small></div>${s.current ? '' : '<button type="button" class="btn btn-ghost sm" data-rv>Log out</button>'}</div>`).join('') || '<p class="hint">No active sessions.</p>';
    };
    try { me = (await api('/api/auth/me')).user; } catch (e) { location.href = '/login?next=/account'; return; }
    paint(); sessions().catch((e) => toast(e.message));

    $('#profForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { const r = await api('/api/account', { method: 'PUT', body: { name: $('#aName').value } }); me = Object.assign(me, r.user); QRX.setAuth(QRX.token(), { id: me.id, name: me.name, email: me.email }); toast('Profile saved'); } catch (err) { toast(err.message); }
    });
    $('#vResend').onclick = async () => { try { const r = await api('/api/auth/resend-verification', { method: 'POST' }); toast(r.already ? 'Already verified' : 'Verification email sent'); $('#vDev').innerHTML = dev(r.devLink); } catch (err) { toast(err.message); } };
    $('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const m = $('#pwMsg'); m.textContent = '';
      if ($('#pwNew').value !== $('#pwNew2').value) { m.textContent = 'The passwords do not match.'; return; }
      if (!strong($('#pwNew').value)) { m.textContent = 'Use at least 8 characters, with a letter and a number.'; return; }
      try { await api('/api/account/password', { method: 'POST', body: { current: $('#pwCur').value, password: $('#pwNew').value } }); e.target.reset(); me.hasPassword = true; paint(); sessions(); toast('Password updated. Other devices were logged out'); } catch (err) { m.textContent = err.message; }
    });
    $('#aSess').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-rv]'); if (!b) return;
      try { await api('/api/account/sessions/' + b.closest('.sess').dataset.id, { method: 'DELETE' }); sessions(); } catch (err) { toast(err.message); }
    });
    $('#revokeAll').onclick = async () => { try { await api('/api/account/sessions/revoke-others', { method: 'POST' }); toast('Other devices were logged out'); sessions(); } catch (err) { toast(err.message); } };
    $('#expBtn').onclick = async () => {
      try {
        const r = await fetch('/api/account/export', { headers: { Authorization: 'Bearer ' + QRX.token() } });
        if (!r.ok) throw new Error((await r.json()).error || 'Export failed');
        QRX.save(await r.blob(), 'qrnova-data.json');
      } catch (err) { toast(err.message); }
    };
    $('#delForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const m = $('#delMsg'); m.textContent = '';
      if (!confirm('Delete your account and everything in it permanently?')) return;
      try { await api('/api/account', { method: 'DELETE', body: { password: $('#delPw').value, confirm: $('#delEm').value } }); QRX.clearAuth(); location.href = '/'; } catch (err) { m.textContent = err.message; }
    });
  })();
})();
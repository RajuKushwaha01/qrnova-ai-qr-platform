(() => {
  'use strict';
  const { $, $$, esc, toast, api } = QRX;
  const root = $('#adm');
  if (!root) return;
  if (!QRX.token()) { location.href = '/login?next=/admin'; return; }

  const C = QRX.charts, fmt = QRX.fmtSize, en = encodeURIComponent, TZ = -new Date().getTimezoneOffset();
  const n = (v) => Number(v || 0).toLocaleString();
  const day = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const dt = (t) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ago = (t) => { const d = (Date.now() - t) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : d < 43200 ? Math.round(d / 1440) + ' d ago' : day(t); };
  const up = (s) => { s = Math.round(s); return s >= 86400 ? Math.floor(s / 86400) + ' d ' + Math.floor((s % 86400) / 3600) + ' h' : s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min' : Math.floor(s / 60) + ' min'; };
  const bdg = (t, c) => `<span class="bdg ${c || ''}">${esc(t)}</span>`;
  const STC = { active: 'ok', inactive: 'archived', expired: 'suspended', archived: 'archived', disabled: 'suspended', suspended: 'suspended' };
  const ROLEB = { superadmin: ['⭐ Super Admin', 'ok'], admin: ['🛡️ Admin', ''], user: ['User', ''] };
  const TABS = [['overview', '📊 Overview'], ['users', '👥 Users'], ['qrs', '▦ QR codes'], ['files', '📁 Files'], ['reports', '🚩 Reports'], ['analytics', '📈 Analytics'], ['settings', '⚙️ Settings'], ['security', '🛡️ Security'], ['audit', '🧾 Audit log']];
  const AUD = { login: ['🔑', 'Signed in'], login_failed: ['⚠️', 'Failed sign-in'], signup: ['✨', 'New sign-up'], forgot_password: ['📧', 'Password reset requested'], reset_password: ['🔁', 'Password reset'], password_change: ['🔐', 'Password changed'], account_deleted: ['🗑️', 'Account deleted'], auto_block: ['⛔', 'IP auto-blocked'], spam_blocked: ['🚫', 'Spam blocked'], qr_reported: ['🚩', 'QR reported'], qr_auto_disabled: ['🚫', 'QR auto-disabled'] };
  const audLabel = (t) => (AUD[t] ? AUD[t][1] : t.startsWith('admin_') ? 'Admin: ' + t.slice(6).replace(/_/g, ' ') : t);
  const audIcon = (t) => (AUD[t] ? AUD[t][0] : t.startsWith('admin_') ? '🛡️' : '•');
  const auditRow = (e) => `<li><span class="ti">${audIcon(e.type)}</span><div><b>${esc(audLabel(e.type))}</b> <small class="mut">${esc([e.email, e.meta, e.ip].filter(Boolean).join(' · '))}</small></div><time>${ago(e.t)}</time></li>`;

  const ST = { users: { q: '', role: 'all', status: 'all', page: 1 }, qrs: { q: '', filter: 'all', page: 1 }, files: { q: '', filter: 'all', page: 1, large: 20 }, audit: { group: 'all', q: '', page: 1 }, an: { days: 30 } };
  const view = $('#admView');
  let role = 'user', tab = TABS.some((t) => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'overview', RELOAD = null, T = null;
  const isSuper = () => role === 'superadmin';
  const pager = (r, key) => `<div class="pg"><button type="button" class="btn btn-ghost sm" data-pg="${key}:-1"${r.page <= 1 ? ' disabled' : ''}>← Prev</button><span>Page ${r.page} / ${r.pages} · ${n(r.total)} total</span><button type="button" class="btn btn-ghost sm" data-pg="${key}:1"${r.page >= r.pages ? ' disabled' : ''}>Next →</button></div>`;
  const table = (head, rows, empty) => `<div class="card tbl-wrap"><table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}">${empty}</td></tr>`}</tbody></table></div>`;
  const opt = (v, cur, l) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`;

  /* ═══════════ list scaffold: toolbar + results container ═══════════ */
  function listTab(toolbar, fetcher, renderer) {
    view.innerHTML = `<div class="card adm-bar">${toolbar}</div><div id="res"><p class="hint">Loading…</p></div>`;
    RELOAD = async () => { const box = $('#res'); if (!box) return; try { box.innerHTML = renderer(await fetcher()); } catch (e) { box.innerHTML = `<p class="hint">${esc(e.message)}</p>`; } };
    RELOAD();
  }

  /* ═══════════ tabs ═══════════ */
  async function vOverview() {
    RELOAD = null;
    const o = await api('/api/sys/overview?tz=' + TZ), c = o.counts, s = o.system;
    const card = (i, l, v, sub, k) => `<div class="acard" style="--i:${k}"><span>${i}</span><small>${l}</small><b>${n(v)}</b><em>${esc(sub)}</em></div>`;
    view.innerHTML = `<div class="acards">${[card('👥', 'USERS', c.users, c.newWeek + ' new this week', 0), card('▦', 'QR CODES', c.qrDynamic + c.qrStatic, n(c.qrDynamic) + ' dynamic · ' + n(c.qrStatic) + ' static', 1), card('📁', 'FILES', c.files, fmt(o.storage.bytes), 2), card('📲', 'SCANS TODAY', o.scans.today, n(o.scans.total) + ' total · ' + n(o.scans.month) + ' this month', 3), card('🚩', 'OPEN REPORTS', c.reports, c.disabled + ' items disabled', 4), card('🚫', 'SUSPENDED', c.suspended, c.staff + ' staff · ' + c.verified + '/' + c.users + ' verified', 5)].join('')}</div>
<div class="agrid"><div class="card"><h3>Scans · last 14 days</h3>${C.line(o.scans.series.labels, o.scans.series.counts, { label: 'Scans' })}</div>
<div class="card"><h3>Storage by type</h3>${C.donut(Object.entries(o.storage.byCat), 'Storage')}<p class="hint">${fmt(o.storage.bytes)} used${o.storage.quotaMB ? ' of ' + n(o.storage.quotaMB) + ' MB' : ' (no platform cap set)'}</p></div></div>
<div class="agrid"><div class="card"><div class="card-h"><h3>Recent activity</h3><button type="button" class="btn btn-ghost sm" data-tab="audit">Audit log →</button></div><ul class="tl">${o.activity.map(auditRow).join('') || '<li class="hint">Nothing yet.</li>'}</ul></div>
<div class="card"><h3>Top QR codes</h3>${C.hbars(Object.fromEntries(o.top.map((t) => [t.title.slice(0, 24), t.scans])), { empty: 'No scans yet.' })}<h3 style="margin-top:1.3rem">System</h3>
<dl class="kvs"><dt>Uptime</dt><dd>${up(s.uptime)}</dd><dt>Node.js</dt><dd>${esc(s.node)}</dd><dt>Memory</dt><dd>${s.memL || s.memMB} MB</dd><dt>Database file</dt><dd>${fmt(s.dbBytes)}</dd><dt>Antivirus</dt><dd>${s.clam ? '🛡️ ClamAV active' : 'Built-in checks only'}</dd><dt>Email</dt><dd>${esc(s.mail)}</dd><dt>CSP</dt><dd>${esc(s.csp)}</dd><dt>Maintenance</dt><dd>${s.maintenance ? '🛠️ ON' : 'Off'}</dd><dt>Blocked IPs</dt><dd>${s.blocked}</dd></dl></div></div>`;
  }

  /* ----- users ----- */
  function vUsers() {
    const s = ST.users;
    listTab(`<input class="in" type="search" data-f="users.q" placeholder="Search name, email or ID…" value="${esc(s.q)}" aria-label="Search users"><select class="in" data-f="users.role" aria-label="Role">${opt('all', s.role, 'All roles')}${opt('user', s.role, 'Users')}${opt('admin', s.role, 'Admins')}${opt('superadmin', s.role, 'Super Admins')}</select><select class="in" data-f="users.status" aria-label="Status">${opt('all', s.status, 'Any status')}${opt('active', s.status, 'Active')}${opt('suspended', s.status, 'Suspended')}${opt('unverified', s.status, 'Unverified')}</select>`,
      () => api(`/api/sys/users?q=${en(s.q)}&role=${s.role}&status=${s.status}&page=${s.page}`),
      (r) => table(['User', 'Role', 'Status', 'QR', 'Files', 'Scans', 'Last active', 'Joined', ''], r.items.map((u) => `<tr><td class="w"><b>${esc(u.name)}</b><br><small class="mut">${esc(u.email)}</small></td><td>${bdg(ROLEB[u.role][0], ROLEB[u.role][1])}</td><td>${u.suspended ? bdg('Suspended', 'suspended') : bdg('Active', 'ok')} ${u.verified ? '' : bdg('Unverified', 'archived')}</td><td>${n(u.qrs)}</td><td>${n(u.files)} · ${fmt(u.bytes)}</td><td>${n(u.scans)}</td><td>${u.last ? ago(u.last) : '—'}</td><td>${day(u.created)}</td><td><button type="button" class="btn btn-ghost sm" data-act="user:${u.id}">View</button></td></tr>`), 'No users match.') + pager(r, 'users'));
  }
  async function openUser(id) {
    const r = await api('/api/sys/users/' + id), u = r.user, me = QRX.user(), mine = !!me && me.id === u.id;
    const can = !mine && (u.role === 'user' || (isSuper() && u.role === 'admin'));
    const b = (a, l, cls) => `<button type="button" class="btn ${cls || 'btn-ghost'} sm" data-ua="${a}" data-id="${u.id}">${l}</button>`;
    const acts = [];
    if (can) acts.push(u.suspended ? b('activate', '▶️ Activate') : b('suspend', '⏸ Suspend', 'btn-danger'));
    if (!u.verified) acts.push(b('verify', '✔ Mark verified'));
    if (can) acts.push(b('logout', '🚪 Log out everywhere'));
    if (isSuper() && !mine && u.role === 'user') acts.push(b('promote', '🛡️ Make admin'));
    if (isSuper() && !mine && u.role === 'admin') acts.push(b('demote', '⬇️ Remove admin'));
    if (isSuper() && !mine && u.role !== 'superadmin') acts.push(b('delete', '🗑️ Delete user', 'btn-danger'));
    $('#dAdmT').textContent = u.name;
    $('#dAdmB').innerHTML = `<p>${esc(u.email)} ${bdg(ROLEB[u.role][0], ROLEB[u.role][1])} ${u.suspended ? bdg('Suspended', 'suspended') : bdg('Active', 'ok')} ${u.verified ? '' : bdg('Unverified', 'archived')}</p>${u.reason ? `<p class="hint">Suspension reason: ${esc(u.reason)}</p>` : ''}
<dl class="kv"><dt>Joined</dt><dd>${day(u.created)}</dd><dt>Last active</dt><dd>${u.last ? ago(u.last) : '—'}</dd><dt>Sign-in</dt><dd>${esc(u.provider)}</dd><dt>Sessions</dt><dd>${r.sessions} active</dd><dt>QR codes</dt><dd>${n(u.qrs)}</dd><dt>Files</dt><dd>${n(u.files)} · ${fmt(u.bytes)}</dd><dt>Scans</dt><dd>${n(u.scans)}</dd></dl>
<div class="row2" style="flex-wrap:wrap;margin:1rem 0">${acts.join('') || '<small class="mut">No actions available for this account.</small>'}</div>
<h4 class="sub-h">Recent activity</h4><ul class="tl">${r.activity.map(auditRow).join('') || '<li class="hint">No recorded activity.</li>'}</ul>
<h4 class="sub-h">QR codes</h4><ul class="tl">${r.qrs.map((q) => `<li><span class="ti">▦</span><div><b>${esc(q.title)}</b> <small class="mut">${esc(q.type)} · ${n(q.scans)} scans</small></div>${bdg(q.state, STC[q.state])}</li>`).join('') || '<li class="hint">None.</li>'}</ul>
<h4 class="sub-h">Files</h4><ul class="tl">${r.files.map((f) => `<li><span class="ti">📁</span><div><b>${esc(f.title)}</b> <small class="mut">${esc(f.cat)} · ${fmt(f.size)}</small></div>${bdg(f.state, STC[f.state])}</li>`).join('') || '<li class="hint">None.</li>'}</ul>`;
    $('#dAdm').showModal();
  }
  async function userAct(a, id) {
    const body = { action: a };
    if (a === 'suspend') { const r = window.prompt('Reason for the suspension (only staff can see it):', ''); if (r === null) return; body.reason = r; body.disableContent = confirm('Also disable all of this user’s QR codes and files?'); }
    else if (a === 'activate') body.restoreContent = confirm('Also re-enable their QR codes and files?');
    else if (a === 'delete' && !confirm('Permanently delete this user and ALL their QR codes and files? This cannot be undone.')) return;
    await api(`/api/sys/users/${id}/action`, { method: 'POST', body });
    toast('Done');
    if (a === 'delete') $('#dAdm').close(); else openUser(id);
    if (RELOAD) RELOAD();
  }

  /* ----- QR codes ----- */
  function vQrs() {
    const s = ST.qrs;
    listTab(`<input class="in" type="search" data-f="qrs.q" placeholder="Search title, owner, code or destination…" value="${esc(s.q)}" aria-label="Search QR codes"><select class="in" data-f="qrs.filter" aria-label="Filter">${['all', 'active', 'disabled', 'inactive', 'expired', 'archived', 'reported'].map((v) => opt(v, s.filter, v[0].toUpperCase() + v.slice(1))).join('')}</select>`,
      () => api(`/api/sys/qrs?q=${en(s.q)}&filter=${s.filter}&page=${s.page}`),
      (r) => table(['QR code', 'Owner', 'Type', 'Scans', 'State', 'Reports', 'Created', ''], r.items.map((q) => `<tr><td class="w"><b>${esc(q.title)}</b><br><small class="mut">${esc(q.code)}${q.target ? ' → ' + esc(q.target.replace(/^https?:\/\//, '').slice(0, 40)) : ''}</small></td><td>${esc(q.owner)}</td><td>${esc(q.type)}</td><td>${n(q.scans)}</td><td>${bdg(q.state, STC[q.state])}</td><td>${q.reports ? '🚩 ' + q.reports : '—'}</td><td>${day(q.created)}</td><td>${q.state === 'disabled' ? `<button type="button" class="btn btn-ghost sm" data-act="qr-enable:${q.code}">Enable</button>` : `<button type="button" class="btn btn-ghost sm" data-act="qr-disable:${q.code}">Disable</button>`}${q.reports ? ` <button type="button" class="btn btn-ghost sm" data-act="qr-clear:${q.code}">Dismiss</button>` : ''} <button type="button" class="btn btn-ghost sm" data-act="qr-delete:${q.code}" aria-label="Delete">🗑️</button></td></tr>`), 'No QR codes match.') + pager(r, 'qrs'));
  }

  /* ----- files ----- */
  function vFiles() {
    const s = ST.files;
    listTab(`<input class="in" type="search" data-f="files.q" placeholder="Search title, filename or owner…" value="${esc(s.q)}" aria-label="Search files"><select class="in" data-f="files.filter" aria-label="Filter">${[['all', 'All files'], ['large', 'Large files'], ['suspicious', 'Suspicious uploads'], ['reported', 'Reported'], ['suspended', 'Suspended'], ['deleted', 'Deleted files']].map(([v, l]) => opt(v, s.filter, l)).join('')}</select><label class="mut" style="display:flex;gap:.4rem;align-items:center">“Large” ≥ <input class="in" type="number" min="1" max="1000" style="width:90px" data-f="files.large" value="${s.large}" aria-label="Large file threshold in MB"> MB</label>`,
      () => api(`/api/sys/files?q=${en(s.q)}&filter=${s.filter}&page=${s.page}&largeMB=${s.large}`),
      (r) => {
        const u = r.usage, pct = u.quotaMB ? Math.min(100, Math.round((u.bytes / (u.quotaMB * 1048576)) * 100)) : 0;
        const head = `<div class="agrid"><div class="card"><h3>Storage usage</h3><div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><b style="font-size:1.5rem">${n(u.count)}</b><span>Files</span></div><div class="stat"><b style="font-size:1.5rem">${fmt(u.bytes)}</b><span>Used</span></div><div class="stat"><b style="font-size:1.5rem">${n(u.large)}</b><span>Large (≥ ${s.large} MB)</span></div></div>${u.quotaMB ? `<div class="meter"><i style="width:${pct}%"></i></div><small class="mut">${pct}% of the ${n(u.quotaMB)} MB platform cap</small>` : '<small class="mut">No platform-wide cap is set (Settings → Limits).</small>'}${C.donut(Object.entries(u.byCat), 'By type')}</div><div class="card"><h3>Biggest users</h3>${C.hbars(Object.fromEntries(u.topUsers.map((x) => [x.owner, x.bytes])), { label: (k) => esc(k), empty: 'No files yet.' }).replace(/<b>(\d+)<\/b>/g, (m, v) => `<b>${fmt(+v)}</b>`)}</div></div>`;
        if (r.deleted) return head + `<div class="card"><h3>Deleted files</h3><ul class="tl">${r.items.map((d) => `<li><span class="ti">🗑️</span><div><b>${esc(d.title)}</b> <small class="mut">${esc(d.type || '')} · ${esc(d.owner)}${d.meta ? ' · ' + esc(d.meta) : ''}</small></div><time>${ago(d.t)}</time></li>`).join('') || '<li class="hint">No deletions recorded.</li>'}</ul></div>`;
        return head + table(['File', 'Owner', 'Type', 'Size', 'State', 'Flags', 'Views', 'Created', ''], r.items.map((f) => `<tr><td class="w"><a class="lnk" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.title)}</a><br><small class="mut">${esc(f.name)}${f.scanned ? ' · 🛡️ AV' : ''}</small></td><td>${esc(f.owner)}</td><td>${esc(f.cat)}</td><td>${fmt(f.size)}</td><td>${bdg(f.state, STC[f.state])}</td><td class="w"><div class="rsn">${f.reasons.map((x) => bdg(x, /reported|suspended|unverified|burst/.test(x) ? 'suspended' : 'archived')).join('') || '—'}</div></td><td>${n(f.views)}</td><td>${day(f.created)}</td><td>${f.state === 'suspended' ? `<button type="button" class="btn btn-ghost sm" data-act="file-restore:${f.id}">Restore</button>` : `<button type="button" class="btn btn-ghost sm" data-act="file-suspend:${f.id}">Suspend</button>`}${f.reports ? ` <button type="button" class="btn btn-ghost sm" data-act="file-clear:${f.id}">Dismiss</button>` : ''} <button type="button" class="btn btn-ghost sm" data-act="file-delete:${f.id}" aria-label="Delete">🗑️</button></td></tr>`), 'No files match.') + pager(r, 'files');
      });
  }

  /* ----- reported content queue ----- */
  async function vReports() {
    RELOAD = vReports;
    const r = await api('/api/sys/reports');
    view.innerHTML = r.items.length ? `<div class="reps">${r.items.map((x) => { const k = x.kind === 'qr' ? 'qr' : 'file', off = x.state === 'disabled' || x.state === 'suspended'; return `<div class="card rep"><div><b>${x.kind === 'qr' ? '▦' : '📁'} ${esc(x.title)}</b> ${bdg('🚩 ' + x.reports + ' report' + (x.reports > 1 ? 's' : ''), 'suspended')} ${bdg(x.state, STC[x.state])}<small>Owner: ${esc(x.owner)} · ${day(x.created)} · <a class="lnk" href="${esc(x.url)}" target="_blank" rel="noopener">review page ↗</a> (opening it counts as a view)</small></div><div class="row2">${off ? `<button type="button" class="btn btn-ghost sm" data-act="${k}-${k === 'qr' ? 'enable' : 'restore'}:${x.id}">Restore</button>` : `<button type="button" class="btn btn-danger sm" data-act="${k}-${k === 'qr' ? 'disable' : 'suspend'}:${x.id}">Take down</button>`}<button type="button" class="btn btn-ghost sm" data-act="${k}-clear:${x.id}">Dismiss</button><button type="button" class="btn btn-ghost sm" data-act="${k}-delete:${x.id}" aria-label="Delete">🗑️</button></div></div>`; }).join('')}</div>` : '<div class="card" style="text-align:center"><h3>✅ No reported content</h3><p>Reports from visitors appear here. QR codes and files auto-disable after the threshold set in File rules.</p></div>';
  }

  /* ----- platform analytics ----- */
  function vAnalytics() {
    const s = ST.an;
    listTab(`<label class="mut">Range <select class="in" data-f="an.days" aria-label="Range" style="margin-left:.4rem">${[7, 14, 30, 90].map((v) => opt(String(v), String(s.days), v + ' days')).join('')}</select></label>`,
      () => api(`/api/sys/analytics?days=${s.days}&tz=${TZ}`),
      (r) => {
        const t = r.totals, d = r.summary, sum = (a) => a.reduce((x, y) => x + y, 0);
        const card = (i, l, v, sub, k) => `<div class="acard" style="--i:${k}"><span>${i}</span><small>${l}</small><b>${n(v)}</b><em>${esc(sub)}</em></div>`;
        return `<div class="acards">${[card('👥', 'USERS', t.users, sum(r.signups) + ' joined in range', 0), card('▦', 'QR CODES', t.qr, sum(r.created) + ' created in range', 1), card('📲', 'TOTAL SCANS', t.scans, n(d.range.total) + ' in range', 2), card('💾', 'STORAGE', 0, fmt(t.storage), 3), card('🔑', 'LOGINS & SIGN-UPS', sum(r.activity), 'in range', 4)].join('').replace('<b>0</b>', `<b>${fmt(t.storage).split(' ')[0]}</b>`)}</div>
<div class="agrid"><div class="card"><h3>Scans</h3>${C.line(r.labels, d.series.counts, { label: 'Scans' })}</div><div class="card"><h3>Devices</h3>${C.donut(Object.entries(d.devices), 'Devices')}</div></div>
<div class="agrid"><div class="card"><h3>New users</h3>${C.line(r.labels, r.signups, { label: 'New users' })}</div><div class="card"><h3>New QR codes &amp; files</h3>${C.line(r.labels, r.created, { label: 'Created' })}</div></div>
<div class="agrid3"><div class="card"><h3>Activity (sign-ins &amp; sign-ups)</h3>${C.line(r.labels, r.activity, { label: 'Activity' })}</div><div class="card"><h3>Browsers</h3>${C.hbars(d.browsers, { pct: true })}</div><div class="card"><h3>Regions</h3>${C.hbars(d.regions, { label: (k) => (k === 'Other' ? '🌐 Other' : C.flag(k) + ' ' + esc(C.region(k))) })}<h3 style="margin-top:1.3rem">Top users by scans</h3>${C.hbars(Object.fromEntries(r.topUsers.filter((x) => x.scans).map((x) => [x.email, x.scans])), { label: (k) => esc(k.slice(0, 22)) })}</div></div>`;
      });
  }

  /* ----- settings ----- */
  const CFG = [
    ['brand', '🎨 System branding', [['brand.name', 'Brand name', 'text'], ['brand.tagline', 'Tagline', 'text'], ['brand.primary', 'Primary colour', 'color'], ['brand.accent', 'Accent colour', 'color'], ['brand.highlight', 'Highlight colour', 'color'], ['brand.logo', 'Logo (https URL or upload)', 'logo'], ['brand.footer', 'Footer line', 'text']]],
    ['limits', '📏 Limits & quotas', [['limits.maxDynamicQr', 'Max dynamic QR codes per user', 'num'], ['limits.maxStaticQr', 'Max saved static QR codes per user', 'num'], ['limits.createPerHour', 'QR creations per user per hour', 'num'], ['limits.uploadPerHour', 'Uploads per user per hour', 'num'], ['limits.aiPerDay', 'AI requests per user per day', 'num'], ['limits.totalStorageMB', 'Total platform storage cap in MB (0 = unlimited)', 'num']]],
    ['rate', '⏱️ Rate limits (per IP, per minute)', [['limits.apiPerMin', 'API requests', 'num'], ['limits.scanPerMin', 'QR scans & file views', 'num']]],
    ['signup', '🚪 Registration', [['signup.open', 'Allow new sign-ups', 'bool'], ['signup.requireVerified', 'Require a verified email before creating QR codes', 'bool']]],
    ['security', '🔐 Security', [['security.sessionDays', 'Session lifetime (days)', 'num'], ['security.idleDays', 'Log out after inactivity (days)', 'num'], ['security.minPassword', 'Minimum password length', 'num'], ['security.lockAfter', 'Lock the account after failed logins', 'num'], ['security.lockMinutes', 'Lock duration (minutes)', 'num'], ['security.autoBlock', 'Auto-block abusive IPs', 'bool'], ['security.strikeLimit', 'Strikes before an auto-block', 'num'], ['security.blockMinutes', 'Auto-block duration (minutes)', 'num'], ['security.csp', 'Content-Security-Policy mode', 'csp'], ['security.blockedDomains', 'Blocked redirect domains (one per line)', 'list']]],
    ['analytics', '📊 Analytics & privacy', [['analytics.region', 'Collect approximate region', 'bool'], ['analytics.referrer', 'Collect the referrer (host only)', 'bool'], ['analytics.unique', 'Count unique visitors (salted hash)', 'bool'], ['analytics.honorDnt', 'Honour Do Not Track / Global Privacy Control', 'bool']]],
    ['email', '✉️ Email', [['email.from', 'From address, e.g. QRNova <hello@yourdomain.com>', 'text']]],
    ['maintenance', '🛠️ Maintenance mode', [['maintenance.on', 'Maintenance mode is on', 'bool'], ['maintenance.message', 'Message shown to visitors', 'text']]],
  ];
  const getp = (o, p) => p.split('.').reduce((x, k) => x[k], o);
  async function vSettings() {
    RELOAD = null;
    const [c, f] = await Promise.all([api('/api/sys/config'), api('/api/admin/settings')]);
    const cfg = c.config, edit = c.canEdit, dis = edit ? '' : ' disabled';
    const fld = (p, label, type) => {
      const v = getp(cfg, p), id = 'c_' + p.replace('.', '_');
      if (type === 'bool') return `<label class="chk" style="margin:.4rem 0"><input type="checkbox" data-p="${p}" data-t="bool"${v ? ' checked' : ''}${dis}> ${label}</label>`;
      let inp;
      if (type === 'num') inp = `<input class="in" id="${id}" type="number" data-p="${p}" data-t="num" value="${esc(v)}"${dis}>`;
      else if (type === 'color') inp = `<input type="color" id="${id}" data-p="${p}" value="${esc(v)}"${dis}>`;
      else if (type === 'csp') inp = `<select class="in" id="${id}" data-p="${p}"${dis}>${['enforce', 'report', 'off'].map((o) => opt(o, v, o)).join('')}</select><small class="fh">“report” only logs violations in the browser console. Use it if something is blocked.</small>`;
      else if (type === 'list') inp = `<textarea class="in" id="${id}" rows="3" data-p="${p}" data-t="list"${dis}>${esc((v || []).join('\n'))}</textarea>`;
      else if (type === 'logo') inp = `<div class="row2"><input class="in" id="${id}" data-p="${p}" data-logo-url value="${esc(String(v).startsWith('data:') ? '' : v)}" placeholder="${String(v).startsWith('data:') ? 'An uploaded logo is in use' : 'https://…'}"${dis}><label class="btn btn-ghost sm">Upload<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-logo${dis}></label><button type="button" class="btn btn-ghost sm" data-logoclear${dis}>Clear</button></div>`;
      else inp = `<input class="in" id="${id}" data-p="${p}" value="${esc(v)}"${dis}>`;
      return `<div class="fld"><label for="${id}">${label}</label>${inp}</div>`;
    };
    const sec = (id, title, fields) => `<div class="card set-sec" data-sec="${id}"><h3>${title}</h3>${fields.map(([p, l, t]) => fld(p, l, t)).join('')}${edit ? `<div class="set-save"><button type="button" class="btn btn-primary sm" data-save>Save</button>${id === 'email' ? '<button type="button" class="btn btn-ghost sm" data-act="testmail:">Send me a test email</button>' : ''}</div>` : ''}</div>`;
    const fr = f.settings;
    const files = `<div class="card set-sec" data-files><h3>📁 File rules</h3><p class="hint">Allowed types and maximum sizes. The server ceiling is <b>${f.hardMax} MB</b> (<code>MAX_UPLOAD_MB</code>). Antivirus: <b>${f.clam ? '🛡️ ClamAV active' : 'not installed (built-in content checks only)'}</b>.</p>
<div class="ext-grid">${f.cats.map((k) => `<fieldset class="ext"><legend>${k.icon} ${esc(k.label)}</legend><div class="chips">${k.exts.map((x) => `<label class="chk chip"><input type="checkbox" data-x="${x}"${fr.allowed.includes(x) ? ' checked' : ''}> .${x}</label>`).join('')}</div><div class="fld" style="margin-top:.7rem"><label>Max size (MB)</label><input class="in" type="number" min="1" max="${f.hardMax}" data-m="${k.id}" value="${fr.maxMB[k.id]}"></div></fieldset>`).join('')}</div>
<div class="row3" style="margin-top:1rem"><div class="fld"><label>Storage quota per user (MB)</label><input class="in" type="number" id="fQuota" min="10" value="${fr.quotaMB}"></div><div class="fld"><label>Max files per user</label><input class="in" type="number" id="fFiles" min="1" value="${fr.maxFiles}"></div><div class="fld"><label>Reports before auto-disable</label><input class="in" type="number" id="fRep" min="1" value="${fr.reportsToSuspend}"></div></div>
<label class="chk" style="margin:.4rem 0"><input type="checkbox" id="fPdf"${fr.blockActivePdf ? ' checked' : ''}> Block PDFs with embedded scripts or launch actions</label><label class="chk" style="margin:.4rem 0 1rem"><input type="checkbox" id="fMac"${fr.blockMacros ? ' checked' : ''}> Block Office documents that contain macros</label><div class="set-save"><button type="button" class="btn btn-primary sm" data-savefiles>Save file rules</button></div></div>`;
    view.innerHTML = (edit ? '' : '<div class="note">👀 You are an Admin: these settings are read-only. Only a Super Admin can change them (file rules excepted).</div>')
      + `<div class="note ok">Server environment: email = <b>${c.env.smtp ? 'SMTP configured' : 'dev console (no SMTP_URL)'}</b> · CSP override = <b>${esc(c.env.cspEnv || 'none')}</b> · extra CORS origins = <b>${c.env.corsOrigins.length}</b></div>`
      + files + CFG.map(([id, t, fl]) => sec(id, t, fl)).join('');
  }
  async function saveSection(sec) {
    const patch = {};
    $$('[data-p]', sec).forEach((el) => {
      const p = el.dataset.p, [g, k] = p.split('.'); let v;
      if (el.dataset.t === 'bool') v = el.checked; else if (el.dataset.t === 'num') v = +el.value; else if (el.dataset.t === 'list') v = el.value.split('\n').map((s) => s.trim()).filter(Boolean); else v = el.value;
      if (p === 'brand.logo') { if (!el.dataset.touched) return; v = el.dataset.clear ? '' : el.dataset.data || el.value; }
      (patch[g] = patch[g] || {})[k] = v;
    });
    await api('/api/sys/config', { method: 'PUT', body: patch });
    toast('Saved ✨ Reload the page to see branding changes everywhere');
  }
  async function saveFiles() {
    const maxMB = {}; $$('[data-m]').forEach((i) => { maxMB[i.dataset.m] = +i.value; });
    await api('/api/admin/settings', { method: 'PUT', body: { allowed: $$('[data-x]:checked').map((i) => i.dataset.x), maxMB, quotaMB: +$('#fQuota').value, maxFiles: +$('#fFiles').value, reportsToSuspend: +$('#fRep').value, blockActivePdf: $('#fPdf').checked, blockMacros: $('#fMac').checked } });
    toast('File rules saved. They apply to new uploads immediately');
  }
  async function onLogoFile(el) {
    const f = el.files[0]; el.value = ''; if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast('Choose a PNG, JPG or WebP image');
    const url = URL.createObjectURL(f);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read this image')); i.src = url; });
    URL.revokeObjectURL(url);
    const s = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const inp = $('[data-logo-url]'); inp.dataset.data = c.toDataURL('image/png'); inp.dataset.touched = '1'; delete inp.dataset.clear; inp.value = ''; inp.placeholder = 'Logo ready: press Save';
  }

  /* ----- security ----- */
  async function vSecurity() {
    RELOAD = vSecurity;
    const s = await api('/api/sys/security'), c = s.counts;
    const card = (i, l, v, k) => `<div class="acard" style="--i:${k}"><span>${i}</span><small>${l}</small><b>${n(v)}</b><em>last 24 hours</em></div>`;
    view.innerHTML = `<div class="acards">${card('⚠️', 'FAILED SIGN-INS', c.failedLogins, 0) + card('⛔', 'AUTO-BLOCKS', c.autoBlocks, 1) + card('🚫', 'SPAM DROPPED', c.spam, 2) + card('🚩', 'REPORTS', c.reports, 3)}</div>
<div class="agrid"><div class="card"><h3>Temporarily blocked IPs</h3><p class="hint">Abusive clients are blocked automatically after repeated rate-limit hits, failed logins or code guessing. They clear themselves.</p>${s.auto.length ? s.auto.map((b) => `<div class="rep" style="margin-top:.5rem"><div><b>${esc(b.ip)}</b><small>${esc(b.why)} · until ${dt(b.until)}</small></div>${isSuper() ? `<button type="button" class="btn btn-ghost sm" data-act="unblock:${esc(b.ip)}">Unblock</button>` : ''}</div>`).join('') : '<p class="hint">None right now.</p>'}</div>
<div class="card"><h3>Permanently blocked IPs</h3>${s.blockedIps.length ? s.blockedIps.map((ip) => `<div class="rep" style="margin-top:.5rem"><div><b>${esc(ip)}</b></div>${isSuper() ? `<button type="button" class="btn btn-ghost sm" data-act="unblock:${esc(ip)}">Remove</button>` : ''}</div>`).join('') : '<p class="hint">None.</p>'}${isSuper() ? '<div class="row2" style="margin-top:.8rem"><input class="in" id="blkIp" placeholder="IP address to block" aria-label="IP address"><button type="button" class="btn btn-danger sm" data-act="block:">Block</button></div>' : ''}<h4 class="sub-h">Blocked redirect domains</h4><p class="hint">${s.blockedDomains.length ? s.blockedDomains.map(esc).join(', ') : 'None. Edit the list under Settings → Security.'}</p></div></div>
<div class="card"><h3>Recent security events</h3><ul class="tl">${s.recent.map(auditRow).join('') || '<li class="hint">Nothing suspicious recorded.</li>'}</ul></div>`;
  }

  /* ----- audit log ----- */
  function vAudit() {
    const s = ST.audit;
    listTab(`<input class="in" type="search" data-f="audit.q" placeholder="Search email, IP or details…" value="${esc(s.q)}" aria-label="Search the audit log"><select class="in" data-f="audit.group" aria-label="Group">${[['all', 'Everything'], ['auth', 'Sign-ins & accounts'], ['security', 'Security events'], ['admin', 'Admin actions']].map(([v, l]) => opt(v, s.group, l)).join('')}</select>`,
      () => api(`/api/sys/audit?group=${s.group}&q=${en(s.q)}&page=${s.page}`),
      (r) => table(['Time', 'Event', 'Details', 'IP', 'Status'], r.items.map((e) => `<tr><td>${dt(e.t)}</td><td>${audIcon(e.type)} ${bdg(audLabel(e.type), /failed|block|spam|disabled|deleted/.test(e.type) ? 'suspended' : '')}</td><td class="w">${esc([e.email, e.meta, e.target].filter(Boolean).join(' · ')) || '—'}</td><td>${esc(e.ip || '—')}</td><td>${e.status || '—'}</td></tr>`), 'Nothing recorded yet.') + pager(r, 'audit'));
  }

  const VIEWS = { overview: vOverview, users: vUsers, qrs: vQrs, files: vFiles, reports: vReports, analytics: vAnalytics, settings: vSettings, security: vSecurity, audit: vAudit };
  async function show(k) {
    tab = k; history.replaceState(null, '', '#' + k);
    $('#admTabs').innerHTML = TABS.map(([id, l]) => `<button type="button" class="atab${id === k ? ' on' : ''}" data-tab="${id}">${l}</button>`).join('');
    view.innerHTML = '<p class="hint">Loading…</p>'; RELOAD = null;
    try { await VIEWS[k](); } catch (e) { view.innerHTML = `<div class="note">${esc(e.message)}</div>`; }
  }

  /* ═══════════ events ═══════════ */
  async function act(a, id) {
    if (a === 'user') return openUser(id);
    const m = /^(qr|file)-(\w+)$/.exec(a);
    if (m) {
      if (m[2] === 'delete' && !confirm('Delete this ' + (m[1] === 'qr' ? 'QR code' : 'file') + ' permanently?')) return;
      await api(`/api/sys/${m[1] === 'qr' ? 'qrs' : 'files'}/${id}/action`, { method: 'POST', body: { action: m[2] } });
      toast('Done'); return RELOAD && RELOAD();
    }
    if (a === 'unblock') { await api('/api/sys/security/unblock', { method: 'POST', body: { ip: id } }); toast('Unblocked'); return RELOAD && RELOAD(); }
    if (a === 'block') { const ip = $('#blkIp').value.trim(); if (!ip) return toast('Enter an IP address'); await api('/api/sys/security/block', { method: 'POST', body: { ip } }); toast('Blocked'); return RELOAD && RELOAD(); }
    if (a === 'testmail') { const r = await api('/api/sys/test-email', { method: 'POST' }); toast(r.sent ? 'Test email sent. Check your inbox' : 'Dev mode: the email was printed in the server terminal'); }
  }
  async function onClick(e) {
    const t = e.target; let b;
    try {
      if ((b = t.closest('[data-tab]'))) return show(b.dataset.tab);
      if ((b = t.closest('[data-pg]'))) { const [k, d] = b.dataset.pg.split(':'); ST[k].page = Math.max(1, ST[k].page + +d); return RELOAD && RELOAD(); }
      if ((b = t.closest('[data-act]'))) { const i = b.dataset.act.indexOf(':'); return await act(b.dataset.act.slice(0, i), b.dataset.act.slice(i + 1)); }
      if ((b = t.closest('[data-ua]'))) return await userAct(b.dataset.ua, b.dataset.id);
      if ((b = t.closest('[data-close]'))) return b.closest('dialog').close();
      if ((b = t.closest('[data-save]'))) return await saveSection(b.closest('.set-sec'));
      if (t.closest('[data-savefiles]')) return await saveFiles();
      if (t.closest('[data-logoclear]')) { const i = $('[data-logo-url]'); i.value = ''; i.dataset.clear = '1'; i.dataset.touched = '1'; delete i.dataset.data; i.placeholder = 'Logo cleared: press Save'; }
    } catch (err) { toast(err.message); }
  }
  root.addEventListener('click', onClick);
  $('#dAdm').addEventListener('click', onClick);
  view.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-logo-url]')) { el.dataset.touched = '1'; delete el.dataset.data; delete el.dataset.clear; }
    const fl = el.closest('[data-f]'); if (!fl) return;
    const [k, f] = fl.dataset.f.split('.'); ST[k][f] = fl.type === 'number' ? +fl.value : fl.value; if (f !== 'page') ST[k].page = 1;
    clearTimeout(T); T = setTimeout(() => RELOAD && RELOAD(), fl.type === 'search' ? 300 : 0);
  });
  view.addEventListener('change', (e) => { if (e.target.matches('[data-logo]')) onLogoFile(e.target).catch((err) => toast(err.message)); });

  (async () => {
    try {
      const o = await api('/api/sys/overview?tz=' + TZ); role = o.role;
      const me = QRX.user(); $('#admWho').textContent = `Signed in as ${me ? me.email : 'admin'} · ${ROLEB[role][0]}`;
      $('#admBody').hidden = false; show(tab);
    } catch (e) {
      if (/log in/i.test(e.message)) { location.href = '/login?next=/admin'; return; }
      if (/Admin|suspended/i.test(e.message)) $('#admGate').hidden = false; else toast(e.message);
    }
  })();
})();
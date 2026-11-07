// 10.21: Settings, laid out like the iPhone's own: your profile (photo, name, email) at the top, then grouped rows that open their
// own pages — Transactions, Notifications, Face ID, Appearance, Language, Customize, Backups, Help & FAQ, Terms of Service,
// Privacy Policy — and Log out. The tab bar goes flat while you're here (Settings isn't one of its tabs).
(function () {
  const tab = document.getElementById('settingsTab'); if (!tab) return;
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NB = () => (window.WNNative && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wn) || null;
  const nat = (cmd, a) => { const h = NB(); return h ? h.postMessage(Object.assign({ cmd }, a || {})) : Promise.reject(new Error('Only in the iPhone app')); };
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    receipt: I('<path d="M5 3h14v18l-2.3-1.6L14.4 21 12 19.4 9.6 21l-2.3-1.6L5 21z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>'),
    bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
    gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    pen: I('<path d="M12 20h8"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.9a.5.5 0 0 1-.6-.6l.9-2.9a2 2 0 0 1 .5-.9z"/>'),
    face: I('<path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"/><path d="M9 9v1.5M15 9v1.5M12 9v3.5h-.8M9.2 15.2a4 4 0 0 0 5.6 0"/>'),
    moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    brush: I('<path d="M9.1 14.9 4 20M14 4l6 6-7.5 7.5a2.1 2.1 0 0 1-3 0l-3-3a2.1 2.1 0 0 1 0-3z"/><path d="M11 7l6 6"/>'),
    box: I('<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
    help: I('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.5M12 16.6v.1"/>'),
    doc: I('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'),
    shield: I('<path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z"/><path d="M12 9v4M12 16v.1"/>'),
    out: I('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>',
    cam: I('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  };
  const CSS = `
#settingsTab .settings-head{display:none!important}
.st{max-width:620px;margin:0 auto;padding:4px 0 24px;-webkit-user-select:none;user-select:none}
.st-ttl{margin:4px 4px 14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;font-size:30px;font-weight:600;letter-spacing:.2px;color:var(--ink,#111)}
.st-grp{background:var(--card,#fff);border-radius:22px;margin:0 0 16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.st-row{display:flex;align-items:center;gap:14px;width:100%;min-height:58px;padding:0 16px;border:0;background:none;font:inherit;color:var(--ink,#111);text-align:left;position:relative;touch-action:manipulation;-webkit-tap-highlight-color:transparent;text-decoration:none}
.st-row+.st-row::before{content:"";position:absolute;top:0;left:62px;right:16px;height:1px;background:var(--line,#ececf0)}
.st-row:active{background:var(--pill,#f2f2f5)}
.st-row>svg:first-child{width:32px;height:32px;flex:none;padding:7px;box-sizing:border-box;border-radius:9px;background:var(--brand,#173a5c);fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.st-row b{flex:1;min-width:0;font-weight:500;font-size:16.5px}
.st-row em{font-style:normal;color:var(--ink3,#9a9aa3);font-size:15.5px;white-space:nowrap}
.st-row .chev{width:20px;height:20px;flex:none;fill:none;stroke:var(--ink3,#a8a8b0);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.st-row.red b{color:var(--bad,#e5484d)}.st-row.red>svg:first-child{background:var(--bad,#e5484d);stroke:#fff}
.st-prof{min-height:80px;gap:14px}.st-prof b{font-size:18px;font-weight:600}.st-prof small{display:block;font-size:14px;color:var(--ink2,#6e6e78);font-weight:400;margin-top:2px;overflow:hidden;text-overflow:ellipsis}
.st-av{width:54px;height:54px;border-radius:50%;flex:none;overflow:hidden;background:linear-gradient(135deg,#2a5a88,#173a5c);color:#fff;display:grid;place-items:center;font-weight:600;font-size:20px;letter-spacing:.5px}
.st-av img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.st-sw{position:relative;width:51px;height:31px;flex:none}.st-sw input{position:absolute;opacity:0;inset:0;margin:0;z-index:1}
.st-sw span{position:absolute;inset:0;border-radius:31px;background:var(--line,#e2e3e8);transition:background-color .2s}
.st-sw span::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.2);transition:transform .25s cubic-bezier(.3,1.3,.5,1)}
.st-sw input:checked+span{background:var(--ok,#34c759)}.st-sw input:checked+span::after{transform:translateX(20px)}
.st-note{margin:-8px 18px 18px;font-size:13px;line-height:1.4;color:var(--ink2,#6e6e78)}
.st-ab{display:flex;flex-direction:column;align-items:center;gap:3px;margin:8px 0 6px;text-align:center}.st-ab b{font-size:14px;font-weight:600;color:var(--ink2,#6e6e78)}.st-ab span{font-size:12.5px;color:var(--ink3,#a1a1aa)}
.st-foot{text-align:center;font-size:12px;color:var(--ink3,#a1a1aa);margin:8px 0 0}
/* pages that slide in from the right */
.st-page{position:fixed;inset:0;z-index:26;background:var(--bg,#f2f2f5);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:none;padding:max(14px,env(safe-area-inset-top)) 16px calc(110px + env(safe-area-inset-bottom));transform:translate3d(100%,0,0);transition:transform .36s cubic-bezier(.2,.75,.3,1);will-change:transform}
.st-page.on{transform:none}
.st-ph{display:flex;align-items:center;gap:8px;height:48px;margin:0 0 6px;position:sticky;top:0;z-index:1}
.st-bk{display:flex;align-items:center;gap:2px;border:0;background:var(--card,#fff);color:var(--ink,#111);border-radius:999px;height:40px;padding:0 14px 0 8px;font:inherit;font-weight:600;font-size:15px;box-shadow:0 1px 3px rgba(0,0,0,.08);touch-action:manipulation}
.st-bk svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.st-pt{margin:4px 4px 14px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;font-size:28px;font-weight:600;color:var(--ink,#111)}
.st-opt .tick{width:20px;height:20px;fill:none;stroke:var(--accent,#1565a5);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;opacity:0}.st-opt.on .tick{opacity:1}
.st-txt{background:var(--card,#fff);border-radius:22px;padding:6px 18px 18px;font-size:15px;line-height:1.5;color:var(--ink2,#555)}
.st-txt h4{margin:16px 0 4px;color:var(--ink,#111);font-size:15.5px}.st-txt p{margin:0}
.st-faq details{border-top:1px solid var(--line,#eee);padding:14px 0}.st-faq details:first-child{border-top:0}.st-faq summary{font-weight:600;color:var(--ink,#111);list-style:none;cursor:pointer}.st-faq summary::-webkit-details-marker{display:none}.st-faq summary::after{content:"+";float:right;color:var(--ink3,#aaa);font-weight:500}.st-faq details[open] summary::after{content:"−"}.st-faq details p{margin:8px 0 0}
.st-pf{display:flex;flex-direction:column;align-items:center;margin:4px 0 18px}
.st-pf .st-av{width:104px;height:104px;font-size:36px;position:relative}
.st-pfb{margin-top:12px;border:0;background:none;color:var(--accent,#1565a5);font:inherit;font-weight:600;font-size:15px;display:flex;align-items:center;gap:6px}.st-pfb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.st-in{width:100%;border:0;background:none;font:inherit;font-size:16.5px;color:var(--ink,#111);text-align:right;outline:none;min-width:0;flex:1}
.st-tx{padding:14px 16px}.st-tx+.st-tx{border-top:1px solid var(--line,#ececf0)}
.st-tx .h{display:flex;justify-content:space-between;gap:10px;font-weight:600;font-size:16px;color:var(--ink,#111)}.st-tx .h span{color:var(--ink2,#6e6e78);font-weight:500;font-size:14px}
.st-tx .m{font-size:13.5px;color:var(--ink2,#6e6e78);margin-top:3px}
.st-li{display:flex;justify-content:space-between;gap:12px;padding:9px 16px;font-size:14.5px;color:var(--ink,#111)}.st-li+.st-li{border-top:1px solid var(--line,#f0f0f3)}.st-li span{color:var(--ink2,#6e6e78);white-space:nowrap}
.st-li i{font-style:normal;color:var(--ink3,#9a9aa3);font-size:12.5px;display:block}
.st-sec{margin:4px 18px 8px;font-size:12.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--ink2,#6e6e78)}
.faith,.faith *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}.faith img{pointer-events:none}
@media (prefers-reduced-motion:reduce){.st-page{transition:none}}`;

  const name = () => ls.get('wn-profile-name') || 'Ed Puello';
  const email = () => (window.WN && WN.user && WN.user.email) || ls.get('wn-login-email') || '';
  const initials = () => name().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatar = () => { const a = ls.get('wn-avatar'); return a ? `<img src="${a}" alt="">` : esc(initials()); };
  const themeName = () => ({ light: 'Light', dark: 'Dark', system: 'Auto' })[(window.WNBar && WNBar.getTheme && WNBar.getTheme()) || 'light'] || 'Light';
  const sw = (key, on) => `<label class="st-sw"><input type="checkbox" data-sw="${key}"${on ? ' checked' : ''}><span></span></label>`;
  const row = (go, icon, label, val, cls) => `<button type="button" class="st-row${cls ? ' ' + cls : ''}" data-go="${go}">${IC[icon]}<b>${label}</b>${val != null ? `<em data-val="${go}">${esc(val)}</em>` : ''}${IC.chev}</button>`;

  // ---- the main list
  const cloud = document.getElementById('cloudPanel'), custom = document.getElementById('customPanel'), backup = document.getElementById('backupPanel'), faith = tab.querySelector('.faith');
  if (cloud) cloud.hidden = true;
  const st = document.createElement('div'); st.className = 'st';
  st.innerHTML = `<h1 class="st-ttl">Settings</h1>
<div class="st-grp"><button type="button" class="st-row st-prof" data-go="profile"><span class="st-av" data-av>${avatar()}</span><span style="flex:1;min-width:0"><b data-name>${esc(name())}</b><small data-email>${esc(email() || 'Your profile')}</small></span>${IC.chev}</button></div>
<div class="st-grp">${row('transactions', 'receipt', 'Transactions', '')}${row('notifications', 'bell', 'Notifications', ls.get('wn-notif-pause') === '1' ? 'Paused' : 'On')}<div class="st-row st-nat" style="cursor:default">${IC.face}<b>Log in with Face ID</b>${sw('faceid', ls.get('wn-faceid') !== 'off')}</div></div>
<div class="st-grp">${row('appearance', 'moon', 'Appearance', themeName())}${row('language', 'globe', 'Language', 'English')}${row('customize', 'pen', 'Customize')}${row('backups', 'box', 'Backups')}</div>
<div class="st-grp">${row('faq', 'help', 'Help & FAQ')}${row('terms', 'doc', 'Terms of Service')}${row('privacy', 'shield', 'Privacy Policy')}</div>
<div class="st-grp"><button type="button" class="st-row red" data-act="logout">${IC.out}<b>Log out</b></button></div>
<div data-faith></div>
<div class="st-ab"><b>Workshop Navigator</b><span>Version 10.21_1</span><span>Created by Ed Puello</span></div>`;
  tab.appendChild(st);
  if (faith) st.querySelector('[data-faith]').appendChild(faith);
  [cloud, custom, backup].forEach(p => { if (p && p !== cloud) p.hidden = true; });
  if (!NB()) st.querySelector('.st-nat').remove();
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);

  // ---- pages
  const pages = {};
  function page(key, title, html, onOpen) {
    const p = document.createElement('div'); p.className = 'st-page'; p.dataset.page = key;
    p.innerHTML = `<div class="st-ph"><button type="button" class="st-bk" data-back>${IC.back}Settings</button></div><h2 class="st-pt">${title}</h2><div class="st-body">${html}</div>`;
    document.body.appendChild(p); pages[key] = { el: p, onOpen }; return p;
  }
  function open(key) { const p = pages[key]; if (!p) return; if (p.onOpen) p.onOpen(p.el); p.el.scrollTop = 0; requestAnimationFrame(() => p.el.classList.add('on')); }
  function closeAll() { Object.values(pages).forEach(p => p.el.classList.remove('on')); }

  page('profile', 'Profile', `<div class="st-pf"><span class="st-av" data-av>${avatar()}</span><button type="button" class="st-pfb" data-photo>${IC.cam}Change photo</button><input type="file" accept="image/*" data-file hidden></div>
<div class="st-grp"><label class="st-row" style="cursor:text"><b>Name</b><input class="st-in" data-namein maxlength="40" autocomplete="name"></label><div class="st-row"><b>Email</b><em data-email2></em></div></div>
<p class="st-note">Your photo and name are only shown here, on this device.</p>
<div class="st-grp"><button type="button" class="st-row red" data-act="logout">${IC.out}<b>Log out</b></button></div>`, (el) => { el.querySelector('[data-namein]').value = name(); el.querySelector('[data-email2]').textContent = email() || '—'; });

  page('transactions', 'Transactions', '', (el) => {
    const doc = (window.WN && WN.doc) || { items: [] }, byId = {}; (doc.items || []).forEach(x => byId[x.id] = x);
    const out = (window.WNOrders || []).map(o => {
      const n = o.lines.length + (o.extra || []).length, pcs = o.lines.reduce((a, l) => a + l[1], 0) + (o.extra || []).reduce((a, x) => a + x.qty, 0);
      const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const rows = o.lines.map(([id, q, prod]) => { const x = byId[id]; return `<div class="st-li"><div>${esc(x ? x.name : id)}<i>${esc(x ? x.category : '')}${prod ? ` · ${esc(o.store)} #${esc(prod)}` : ''}</i></div><span>× ${q}</span></div>`; }).join('')
        + (o.extra || []).map(x => `<div class="st-li"><div>${esc(x.name)}<i>${esc(o.store)} #${esc(x.prod)}</i></div><span>× ${x.qty}</span></div>`).join('');
      return `<div class="st-grp">${o.orders.map(r => `<div class="st-tx"><div class="h">${esc(o.store)} · #${esc(r.no)}<span>${fmt(r.date)}</span></div><div class="m">${esc(r.note || 'Order')} · ${esc(o.site)}</div></div>`).join('')}</div>
<p class="st-sec">${n} parts · ${pcs.toLocaleString()} pieces</p><div class="st-grp">${rows}</div>`;
    }).join('');
    const bought = (doc.items || []).filter(x => !x.archived && x.ordered && !x.store);
    el.querySelector('.st-body').innerHTML = (out || '<p class="st-note" style="margin:0">No purchases yet.</p>')
      + (bought.length ? `<p class="st-sec">Bought, not put away yet</p><div class="st-grp">${bought.map(x => `<div class="st-li"><div>${esc(x.name)}<i>${esc(x.category || '')}</i></div><span>${x.qty !== '' && x.qty != null ? '× ' + esc(x.qty) : ''}</span></div>`).join('')}</div>` : '');
  });

  page('notifications', 'Notifications', `<div class="st-grp"><div class="st-row">${IC.bell}<b>Pause notifications</b>${sw('pause', ls.get('wn-notif-pause') === '1')}</div></div>
<p class="st-note">Paused: no red dot on the bell and nothing sent to your phone. The bell still keeps the list.</p>
<div class="st-grp st-nat"><div class="st-row">${IC.bell}<b>Phone notifications</b>${sw('push', ls.get('wn-push') === '1')}</div></div>
<p class="st-note st-nat">Banners on your iPhone when something changes from another device — take-outs, put-backs, new parts, counts.</p>`);
  page('appearance', 'Appearance', `<div class="st-grp">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto — follows your iPhone']].map(([k, l]) => `<button type="button" class="st-row st-opt" data-theme="${k}"><b>${l}</b><svg class="tick" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>`).join('')}</div>`,
    (el) => { const t = (window.WNBar && WNBar.getTheme()) || 'light'; el.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('on', b.dataset.theme === t)); });
  page('language', 'Language', `<div class="st-grp"><button type="button" class="st-row st-opt on"><b>English (US)</b><svg class="tick" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button></div><p class="st-note">More languages are coming.</p>`);
  page('customize', 'Customize', ''); page('backups', 'Backups', '');
  if (custom) { custom.hidden = false; pages.customize.el.querySelector('.st-body').appendChild(custom); }
  if (backup) { backup.hidden = false; pages.backups.el.querySelector('.st-body').appendChild(backup); }
  page('faq', 'Help & FAQ', `<div class="st-txt st-faq">${[
    ['How do I add a part?', 'Tap + then Add part. Give it a name and family; the size, drawer and count are optional.'],
    ['How do I take parts out or put them back?', 'Open a part (or scan its drawer) and tap Take out / Put back. Use −50…+50 for big amounts.'],
    ['What do green, yellow and red mean?', 'Green: in stock. Yellow: running low. Red: out, or never bought.'],
    ['Can a part be in more than one drawer?', 'Yes — open the part and tap “Add another location”. The first one is its main spot.'],
    ['How do labels print?', 'Tap + → Labels to pick your Zebra printer, then print from a storage unit or a part.'],
    ['Do my changes sync?', 'Yes. When you’re logged in, every change goes to your other devices within a second or two. The cloud by the header shows the status.'],
    ['What does the face button on the login page do?', 'After you log in once with Remember me on, it logs you in with Face ID — no typing.'],
    ['What does Lock do?', '+ → Lock covers the app until Face ID (or your passcode) says it’s you.'],
    ['How do I get notifications on my phone?', 'Settings → Notifications → Phone notifications, then allow them when your iPhone asks.']
  ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`);
  page('terms', 'Terms of Service', `<div class="st-txt">${(window.WNLogin && WNLogin.TERMS) || ''}<p style="margin-top:16px;font-size:12.5px">Last updated Nov 6, 2026.</p></div>`);
  page('privacy', 'Privacy Policy', `<div class="st-txt"><h4>What’s collected</h4><p>Your email address (to log in), your inventory — parts, counts, drawers, tools, photos, notes — and your settings. Your profile photo and name stay on this device.</p>
<h4>Where it’s kept</h4><p>On your device, and — when you’re logged in — in the app’s cloud database (Supabase), so your devices stay in sync. Face ID logins are kept only in this iPhone’s Keychain.</p>
<h4>Who sees it</h4><p>Only you. Nothing is sold, shared or used for ads. There are no trackers or analytics.</p>
<h4>Google sign-in</h4><p>If you continue with Google, Google shares your name and email with the app — nothing else.</p>
<h4>Your choices</h4><p>Export a backup any time (Settings → Backups). Log out to stop syncing on a device. To delete your account and its data, contact Ed Puello.</p>
<p style="margin-top:16px;font-size:12.5px">Last updated Nov 6, 2026.</p></div>`);
  if (!NB()) document.querySelectorAll('.st-nat').forEach(x => x.remove());

  // ---- actions
  function refresh() {
    document.querySelectorAll('[data-av]').forEach(a => a.innerHTML = avatar());
    st.querySelector('[data-name]').textContent = name(); st.querySelector('[data-email]').textContent = email() || 'Your profile';
    const v = (k, t) => { const e = st.querySelector(`[data-val="${k}"]`); if (e) e.textContent = t; };
    v('appearance', themeName()); v('notifications', ls.get('wn-notif-pause') === '1' ? 'Paused' : 'On');
  }
  document.addEventListener('click', async (e) => {
    const t = e.target;
    const go = t.closest('.st [data-go], .st-page [data-go]'); if (go) { open(go.dataset.go); return; }
    if (t.closest('.st-page [data-back]')) { closeAll(); refresh(); return; }
    const th = t.closest('.st-page [data-theme]'); if (th) { WNBar.setTheme(th.dataset.theme); th.parentNode.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('on', b === th)); refresh(); return; }
    if (t.closest('[data-act="logout"]')) { closeAll(); if (window.WNLogin) WNLogin.logout(); return; }
    if (t.closest('[data-photo]')) { const f = t.closest('.st-page').querySelector('[data-file]'); f.value = ''; f.click(); }
  });
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.matches('[data-file]') && t.files && t.files[0]) {   // shrink the photo to 256×256 and keep it on this device
      const img = new Image(), url = URL.createObjectURL(t.files[0]);
      img.onload = () => { const c = document.createElement('canvas'), n = 256, s = Math.min(img.width, img.height); c.width = c.height = n; c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n); ls.set('wn-avatar', c.toDataURL('image/jpeg', .85)); URL.revokeObjectURL(url); refresh(); };
      img.src = url; return;
    }
    const k = t.dataset && t.dataset.sw; if (!k) return;
    if (k === 'faceid') ls.set('wn-faceid', t.checked ? 'on' : 'off');
    if (k === 'pause') { ls.set('wn-notif-pause', t.checked ? '1' : '0'); if (window.WNBell && WNBell.repaint) WNBell.repaint(); refresh(); }
    if (k === 'push') {
      if (!t.checked) { ls.set('wn-push', '0'); return; }
      try { const ok = await nat('notifyAsk'); ls.set('wn-push', ok ? '1' : '0'); t.checked = !!ok; if (!ok) alertNote(t, 'Notifications are off for this app in your iPhone’s Settings.'); }
      catch (x) { t.checked = false; ls.set('wn-push', '0'); }
    }
  });
  document.addEventListener('input', (e) => { if (e.target.matches('[data-namein]')) { const v = e.target.value.trim(); if (v) ls.set('wn-profile-name', v); else ls.del('wn-profile-name'); refresh(); } });
  function alertNote(t, msg) { const n = t.closest('.st-grp').nextElementSibling; if (n && n.classList.contains('st-note')) n.textContent = msg; }

  // ---- the tab bar is flat while Settings is open; tapping Checklist just goes back
  const flat = () => { const on = !tab.classList.contains('hidden'); if (window.WNBar && WNBar.mark) WNBar.mark(on ? null : 'checklist'); if (!on) closeAll(); else refresh(); };
  new MutationObserver(flat).observe(tab, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.wnbar a[data-tab="checklist"]');
    if (a && !tab.classList.contains('hidden')) { e.preventDefault(); e.stopImmediatePropagation(); closeAll(); const b = document.getElementById('settingsBack'); if (b) b.click(); }
  }, true);
  // a tab tapped while a Settings page is open: close it
  document.addEventListener('click', (e) => { if (e.target.closest('.wnbar a')) closeAll(); }, true);
  setTimeout(flat, 0);
  window.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.faith, img')) e.preventDefault(); });
})();

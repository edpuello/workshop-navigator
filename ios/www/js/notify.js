// 10.21: the bell — notifications about your inventory.
// What it tracks (on this device, from whatever reaches it — your own edits and the ones synced in from other devices):
//   new parts · parts removed/archived · count changes · put in stock · added to To buy · moved / added to another drawer
//   + take-outs and put-backs from the activity log (with the device that did them).
// Standing alerts (running low, to buy) sit at the top. The red dot = things you haven't looked at yet.
(function () {
  const SNAP = 'wn-bell-snap-v1', FEED = 'wn-bell-feed-v1', SEEN = 'wn-bell-seen-v1', MAX = 200;
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qn = (x) => (x.qty === '' || x.qty == null || isNaN(Number(x.qty))) ? null : Number(x.qty);
  const snapOf = (x) => ({ n: x.name, q: qn(x), s: !!x.store, l: String(x.location || '').trim(), b: !!x.need, a: !!x.archived });
  let feed = ls.get(FEED, []), seenAt = ls.get(SEEN, 0), dlg, body, onChange = [];
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; };
  function add(ev) { feed.unshift(ev); if (feed.length > MAX) feed.length = MAX; }
  // Compare what's here now with what this device saw last time; every difference becomes a notification.
  function scan(doc) {
    if (!doc || !doc.items) return;
    const prev = ls.get(SNAP, null), now = {}, at = Date.now();
    doc.items.forEach(x => { if (x && x.id) now[x.id] = snapOf(x); });
    if (!prev) { ls.set(SNAP, now); if (!feed.length) { add({ t: at, k: 'info', txt: 'Notifications are on. New parts, count changes, moves and take-outs will show up here.' }); ls.set(FEED, feed); } return; }
    const evs = [];
    for (const id in now) {
      const a = prev[id], b = now[id], x = doc.items.find(y => y.id === id), t = (x && x.u) ? Math.min(Math.floor(x.u), at) : at;
      if (!a) { evs.push({ t, k: 'new', id, txt: `New part: <b>${esc(b.n)}</b>${b.q != null ? ` · ${b.q}` : ''}` }); continue; }
      if (b.a && !a.a) { evs.push({ t, k: 'del', id, txt: `Archived: <b>${esc(b.n)}</b>` }); continue; }
      if (a.n !== b.n) evs.push({ t, k: 'edit', id, txt: `Renamed: ${esc(a.n)} → <b>${esc(b.n)}</b>` });
      if (a.q !== b.q) { const d = b.q != null && a.q != null ? b.q - a.q : null; evs.push({ t, k: d != null && d < 0 ? 'down' : 'up', id, txt: `<b>${esc(b.n)}</b>: ${a.q == null ? 'counted' : a.q} → ${b.q == null ? 'no count' : b.q}${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}` }); }
      if (b.s && !a.s) evs.push({ t, k: 'in', id, txt: `In stock: <b>${esc(b.n)}</b>` });
      if (!b.s && a.s) evs.push({ t, k: 'del', id, txt: `No longer in stock: <b>${esc(b.n)}</b>` });
      if (b.b && !a.b) evs.push({ t, k: 'buy', id, txt: `Added to To buy: <b>${esc(b.n)}</b>` });
      if (a.l !== b.l) evs.push({ t, k: 'move', id, txt: `<b>${esc(b.n)}</b> ${b.l ? (a.l ? `moved: ${esc(a.l)} → ${esc(b.l)}` : `put in ${esc(b.l)}`) : `taken out of ${esc(a.l)}`}` });
    }
    for (const id in prev) if (!now[id]) evs.push({ t: at, k: 'del', txt: `Deleted: <b>${esc(prev[id].n)}</b>` });
    // take-outs / put-backs from the shared activity log (any device)
    const logT = ls.get('wn-bell-log', 0); let maxT = logT;
    ((doc.app && doc.app.alerts) || []).filter(e => e && e.kind === 'log' && e.at > logT).forEach(e => {
      maxT = Math.max(maxT, e.at);
      (e.ch || []).forEach(c => { if (c && c.d) evs.push({ t: e.at, k: c.d < 0 ? 'take' : 'back', id: c.id, txt: `${esc(e.from || 'A device')} ${c.d < 0 ? 'took out' : 'put back'} <b>${Math.abs(c.d)}</b> × ${esc(c.name || '')}${c.q != null ? ` · ${c.q} left` : ''}` }); });
    });
    if (maxT !== logT) ls.set('wn-bell-log', maxT);
    // a big batch (e.g. a whole order stocked at once) becomes one line you can open
    const counted = evs.filter(e => e.k !== 'take' && e.k !== 'back');
    if (counted.length > 12) {
      const rest = evs.filter(e => e.k === 'take' || e.k === 'back');
      evs.length = 0; evs.push(...rest, { t: at, k: 'batch', txt: `<b>${counted.length} changes</b> came in`, more: counted.slice(0, 60).map(e => e.txt) });
    }
    if (evs.length) { evs.sort((a, b) => a.t - b.t).forEach(add); ls.set(FEED, feed); }
    ls.set(SNAP, now);
    return evs;
  }
  const paused = () => ls.get('wn-notif-pause', 0) === 1 || (() => { try { return localStorage.getItem('wn-notif-pause') === '1'; } catch (e) { return false; } })();
  const unseen = () => paused() ? 0 : feed.filter(e => e.t > seenAt).length;
  const ICON = { new: '＋', up: '↑', down: '↓', in: '✓', buy: '🛒', move: '⇄', del: '−', edit: '✎', take: '↑', back: '↓', batch: '≡', info: 'ℹ︎' };
  function render(doc) {
    const it = (doc.items || []).filter(x => !x.archived), low = it.filter(x => window.isLow && isLow(x)), buy = it.filter(x => x.need);
    const att = (low.length || buy.length) ? `<a class="nf-att" href="#/attention" data-close>${low.length ? `<span><b>${low.length}</b> running low</span>` : ''}${buy.length ? `<span><b>${buy.length}</b> to buy</span>` : ''}<em>See all ›</em></a>` : `<div class="nf-ok">Nothing running low ✓</div>`;
    const day = (t) => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? 'Today' : new Date(n - 864e5).toDateString() === d.toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
    let last = '', rows = '';
    feed.slice(0, 120).forEach((e, i) => {
      const g = day(e.t); if (g !== last) { rows += `<div class="nf-day">${g}</div>`; last = g; }
      const inner = `<span class="nf-ic k-${e.k}">${ICON[e.k] || '•'}</span><span class="nf-tx">${e.txt}${e.more ? `<details><summary>Show them</summary><ul>${e.more.map(m => `<li>${m}</li>`).join('')}</ul></details>` : ''}<small>${ago(e.t)}</small></span>${e.t > seenAt ? '<i class="nf-new" aria-label="new"></i>' : ''}`;
      rows += e.id ? `<a class="nf-row" href="#part=${encodeURIComponent(e.id)}" data-close>${inner}</a>` : `<div class="nf-row">${inner}</div>`;
    });
    body.innerHTML = att + (rows || '<div class="nf-empty">No notifications yet.</div>') + (feed.length ? '<button type="button" class="nf-clear" data-clear>Clear all</button>' : '');
  }
  function open() {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'sheet nf';
      dlg.innerHTML = '<div class="sh-grab"><span></span></div><div class="sh-top"><div class="ttl">Notifications</div><button type="button" class="sh-done" data-close>Done</button></div><div class="sh-body nf-body" tabindex="-1"></div>';
      document.body.appendChild(dlg); body = dlg.querySelector('.nf-body');
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) return close();
        if (e.target.closest('[data-clear]')) { feed = []; ls.set(FEED, feed); render(window.WN.doc); paintDot(); return; }
        if (e.target.closest('[data-close]')) close();
      });
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    }
    scan(window.WN.doc); render(window.WN.doc);
    dlg.showModal(); body.scrollTop = 0; try { body.focus({ preventScroll: true }); } catch (e) { }   // no focus ring on Done
    seenAt = Date.now(); ls.set(SEEN, seenAt); paintDot();
  }
  function close() { if (dlg && dlg.open) dlg.close(); }
  function paintDot() { const n = unseen(); onChange.forEach(f => f(n)); }
  const st = document.createElement('style');
  st.textContent = `.nf .nf-body{padding-top:4px}.nf-att{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:12px 14px;border-radius:16px;background:#fff3d6;color:#5c3f00;text-decoration:none;margin-bottom:10px;font-size:14.5px}.nf-att em{margin-left:auto;font-style:normal;font-weight:700}
.nf-ok{padding:10px 14px;border-radius:16px;background:#e3f5ea;color:#167a42;font-weight:700;font-size:14px;margin-bottom:10px}
.nf-day{font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--ink2);margin:14px 2px 6px}
.nf-row{display:flex;align-items:flex-start;gap:12px;padding:10px 4px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;position:relative}
.nf-ic{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:800;background:var(--pill);color:var(--ink2)}
.nf-ic.k-new,.nf-ic.k-in{background:#e3f5ea;color:#167a42}.nf-ic.k-down,.nf-ic.k-take,.nf-ic.k-del{background:#fdecec;color:#c23b3f}.nf-ic.k-up,.nf-ic.k-back{background:#e7f0fa;color:#1565a5}.nf-ic.k-buy{background:#fff3d6;color:#8a5f00}.nf-ic.k-move{background:#efe9fb;color:#5b3fb0}
.nf-tx{flex:1;min-width:0;font-size:14.5px;line-height:1.35}.nf-tx small{display:block;color:var(--ink3);font-size:12px;margin-top:2px}.nf-tx details{margin-top:4px;font-size:13px;color:var(--ink2)}.nf-tx ul{margin:4px 0 0;padding-left:18px}
.nf-new{position:absolute;right:4px;top:16px;width:8px;height:8px;border-radius:50%;background:var(--bad,#e5484d)}
.nf .sh-done:focus,.nf .sh-done:focus-visible{outline:none!important;box-shadow:none!important}.nf .nf-body:focus{outline:none}
.nf-empty{padding:24px;text-align:center;color:var(--ink2)}.nf-clear{display:block;margin:16px auto 4px;border:0;background:none;color:var(--ink2);font:inherit;font-weight:700}`;
  document.head.appendChild(st);
  // keep scanning as changes arrive (debounced), so nothing is missed between opens
  let tm = 0;
  // phone notifications (iPhone app, Settings → Notifications): banners for changes that came from another device
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  function push(evs) {
    if (window.parent !== window) return;   // the Checklist inside the Workshop: the Workshop already sends them
    const h = window.WNNative && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wn;
    if (!h || paused() || (function () { try { return localStorage.getItem('wn-push') !== '1'; } catch (e) { return true; } })() || !evs || !evs.length) return;
    const send = (title, body) => { try { const r = h.postMessage({ cmd: 'notify', title, body, thread: 'inventory' }); if (r && r.catch) r.catch(() => { }); } catch (e) { } };
    if (evs.length > 3) send('Workshop Navigator', `${evs.length} changes came in from another device`);
    else evs.forEach(e => send(e.k === 'take' || e.k === 'back' ? 'Take-out' : e.k === 'new' ? 'New part' : e.k === 'move' ? 'Moved' : 'Inventory', strip(e.txt)));
  }
  let remote = false;
  function watch() { scan(window.WN.doc); paintDot(); if (window.WN.on) window.WN.on('change', (d, origin) => { if (origin && origin !== 'local') remote = true; clearTimeout(tm); tm = setTimeout(() => { const evs = scan(window.WN.doc); if (remote) push((evs || []).filter(e => e.k !== 'info')); remote = false; paintDot(); if (dlg && dlg.open) render(window.WN.doc); }, 600); }); }
  window.WNBell = { open, close, watch, onCount: (f) => { onChange.push(f); f(unseen()); }, scan, repaint: paintDot };
})();

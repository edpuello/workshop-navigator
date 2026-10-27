// Workshop Navigator shared data + realtime sync. Used by both pages (index.html and workshop.html).
//
// The whole workshop is one JSON document per account (table public.workshop_state).
// - Every edit is saved in this browser at once, then pushed to the cloud within ~150 ms.
// - Other devices get the change through a realtime subscription (no polling delay).
// - Edits merge per item: each item carries `u` (last-changed time) and deletions leave a
//   tombstone in `del`, so two devices editing different items never overwrite each other.
// - Writes are conditional on the row's previous `updated_at`; if another device wrote first,
//   the client re-reads, merges and retries, so nothing is lost.
(function () {
  const CLOUD_URL = 'https://phrkzabhneiczzujfpgp.supabase.co';
  const CLOUD_KEY = 'sb_publishable_vDY7znrbl-3NKpSZd7SaAw_ArsnZWJO';
  const LOCAL_KEY = 'workshop-navigator-purchase-v1';
  const META_KEY = 'workshop-navigator-sync-meta-v2';
  const PUSH_DELAY = 150;
  const COLLECTIONS = [['items'], ['locations'], ['app', 'inventory'], ['app', 'shopping'], ['app', 'alerts']];

  const listeners = { change: [], status: [], auth: [] };
  const emit = (k, ...a) => listeners[k].forEach(f => { try { f(...a) } catch (e) { console.error(e) } });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const now = () => Date.now();

  let doc = null, shadow = {}, sb = null, user = null, channel = null;
  let pushTimer = null, pushing = false, pushAgain = false, rowStamp = null, pollTimer = null;
  let status = { state: 'off', realtime: false, msg: 'Not signed in.' };

  // ---------- document helpers
  function getCol(d, path) { let x = d; for (const p of path) { if (!x) return null; x = x[p]; } return Array.isArray(x) ? x : null; }
  function setCol(d, path, arr) { let x = d; for (let i = 0; i < path.length - 1; i++) { x[path[i]] = x[path[i]] || {}; x = x[path[i]]; } x[path[path.length - 1]] = arr; }
  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    d.version = 2;
    if (!Array.isArray(d.items)) d.items = [];
    if (!Array.isArray(d.locations)) d.locations = [];
    d.app = d.app && typeof d.app === 'object' ? d.app : {};
    for (const k of ['inventory', 'shopping', 'alerts']) if (!Array.isArray(d.app[k])) d.app[k] = [];
    d.app.state = d.app.state && typeof d.app.state === 'object' && !Array.isArray(d.app.state) ? d.app.state : {};
    d.del = d.del && typeof d.del === 'object' ? d.del : {};
    d.settings = d.settings && typeof d.settings === 'object' ? d.settings : {};
    d.created = d.created || new Date().toISOString();
    d.modified = d.modified || d.created;
    return d;
  }
  const sig = (o) => { const { u, ...rest } = o; return JSON.stringify(rest); };
  function snapshot(d) {
    const s = {};
    for (const path of COLLECTIONS) { const key = path.join('.'); s[key] = {}; (getCol(d, path) || []).forEach(o => { if (o && o.id != null) s[key][o.id] = sig(o); }); }
    s.settings = sig(d.settings || {});
    s.state = sig((d.app && d.app.state) || {});
    return s;
  }

  // Stamp everything that changed since the last snapshot. Returns true if anything changed.
  function stampChanges() {
    const t = now(); let changed = false;
    for (const path of COLLECTIONS) {
      const key = path.join('.'), before = shadow[key] || {}, arr = getCol(doc, path) || [], seen = new Set();
      for (const o of arr) {
        if (!o || o.id == null) continue;
        seen.add(String(o.id));
        if (before[o.id] !== sig(o)) { o.u = t; changed = true; delete doc.del[key + ':' + o.id]; }
      }
      for (const id of Object.keys(before)) if (!seen.has(String(id))) { doc.del[key + ':' + id] = t; changed = true; }
    }
    if ((shadow.settings || '{}') !== sig(doc.settings || {})) { doc.settings.u = t; changed = true; }
    if ((shadow.state || '{}') !== sig(doc.app.state || {})) { doc.app.state.u = t; changed = true; }
    if (changed) doc.modified = new Date(t).toISOString();
    shadow = snapshot(doc);
    return changed;
  }

  // ---------- merge (pure): combine two versions of the document
  function mergeArr(a, b, key, del) {
    const out = new Map(), order = [];
    const take = (o) => {
      if (!o || o.id == null) return;
      const id = String(o.id), tomb = del[key + ':' + id] || 0;
      if ((o.u || 0) < tomb || ((o.u || 0) === tomb && tomb)) return;
      const cur = out.get(id);
      if (!cur) { out.set(id, o); order.push(id); }
      else if ((o.u || 0) > (cur.u || 0)) out.set(id, o);
    };
    (b || []).forEach(take); (a || []).forEach(take);
    return order.filter(id => out.has(id)).map(id => clone(out.get(id)));
  }
  function merge(local, remote) {
    local = normalize(clone(local || {})); remote = normalize(clone(remote || {}));
    const del = { ...remote.del };
    for (const [k, v] of Object.entries(local.del)) del[k] = Math.max(del[k] || 0, v);
    const out = normalize({});
    for (const path of COLLECTIONS) { const key = path.join('.'); setCol(out, path, mergeArr(getCol(local, path), getCol(remote, path), key, del)); }
    // Drop tombstones older than 60 days to keep the document small.
    const cutoff = now() - 60 * 864e5;
    for (const [k, v] of Object.entries(del)) if (v < cutoff) delete del[k];
    out.del = del;
    out.settings = (local.settings.u || 0) > (remote.settings.u || 0) ? local.settings : remote.settings;
    out.app.state = (local.app.state.u || 0) > (remote.app.state.u || 0) ? local.app.state : remote.app.state;
    out.created = [local.created, remote.created].filter(Boolean).sort()[0];
    out.modified = [local.modified, remote.modified].filter(Boolean).sort().pop();
    return out;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ---------- local persistence
  function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(doc)); } catch (e) { setStatus('error', 'This browser blocked saving. Download a backup now.'); } }
  function getMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } }
  function setMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { } }

  function setStatus(state, msg) {
    status = { state, realtime: !!(channel && channel.__live), msg: msg || status.msg };
    emit('status', status);
  }

  // Replace the working document with a merged one and tell the page (only if it changed).
  function adopt(next, source) {
    next = normalize(next);
    if (same(next, doc)) return false;
    doc = next; shadow = snapshot(doc); saveLocal(); emit('change', doc, source);
    return true;
  }

  // ---------- cloud
  async function fetchRow() {
    const { data, error } = await sb.from('workshop_state').select('data,updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function push() {
    if (!sb || !user) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true; setStatus('busy', 'Syncing…');
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const row = await fetchRow();
        const merged = row && row.data ? merge(doc, row.data) : normalize(clone(doc));
        const stamp = new Date(Math.max(now(), row ? Date.parse(row.updated_at) + 1 : 0)).toISOString();
        let ok = false;
        if (!row) {
          const { error } = await sb.from('workshop_state').insert({ user_id: user.id, data: merged, updated_at: stamp });
          if (error && error.code !== '23505') throw error;
          ok = !error;
        } else if (same(merged, row.data)) {
          ok = true; rowStamp = row.updated_at;
        } else {
          const { data, error } = await sb.from('workshop_state').update({ data: merged, updated_at: stamp }).eq('user_id', user.id).eq('updated_at', row.updated_at).select('updated_at');
          if (error) throw error;
          ok = Array.isArray(data) && data.length > 0;
        }
        if (ok) {
          if (rowStamp !== row?.updated_at || !row || !same(merged, row.data)) rowStamp = stamp;
          // Keep anything typed while the request was in flight.
          adopt(merge(doc, merged), 'cloud');
          setMeta({ userId: user.id, at: new Date().toISOString() });
          setStatus('live', 'Synced · ' + new Date().toLocaleTimeString());
          break;
        }
        // Another device wrote first: loop re-reads, merges and tries again.
      }
    } catch (e) {
      setStatus('error', 'Sync problem: ' + (e.message || e) + ' · Changes are kept on this device and will retry.');
      clearTimeout(pushTimer); pushTimer = setTimeout(push, 4000);
    } finally {
      pushing = false;
      if (pushAgain) { pushAgain = false; schedulePush(0); }
    }
  }
  function schedulePush(ms) { if (!user) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, ms == null ? PUSH_DELAY : ms); }

  async function pull(reason) {
    if (!sb || !user) return;
    try {
      const row = await fetchRow();
      if (row && row.data) {
        rowStamp = row.updated_at;
        const merged = merge(doc, row.data);
        adopt(merged, 'cloud');
        if (!same(merged, row.data)) schedulePush(0); // this device has edits the cloud doesn't
      } else schedulePush(0); // first upload
      if (status.state !== 'busy') setStatus('live', 'Synced · ' + new Date().toLocaleTimeString());
    } catch (e) { setStatus('error', 'Sync problem: ' + (e.message || e)); }
  }

  function subscribe() {
    unsubscribe();
    if (!sb || !user) return;
    channel = sb.channel('workshop-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workshop_state', filter: 'user_id=eq.' + user.id }, (payload) => {
        const row = payload.new;
        if (!row || !row.data) return;
        rowStamp = row.updated_at;
        const merged = merge(doc, row.data);
        adopt(merged, 'realtime');
        if (!same(merged, row.data)) schedulePush(0);
        if (status.state !== 'busy') setStatus('live', 'Synced · ' + new Date().toLocaleTimeString());
      })
      .subscribe((st) => {
        channel.__live = st === 'SUBSCRIBED';
        if (st === 'SUBSCRIBED') { pull('subscribed'); }
        if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') setStatus(status.state === 'off' ? 'off' : status.state, status.msg);
        else setStatus(status.state, status.msg);
      });
    // Safety net only: if the realtime link drops, re-check every 20 s while the page is visible.
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (document.visibilityState === 'visible' && !(channel && channel.__live)) pull('poll'); }, 20000);
  }
  function unsubscribe() { if (channel && sb) { try { sb.removeChannel(channel); } catch { } } channel = null; clearInterval(pollTimer); }

  // ---------- public API
  const WN = {
    get doc() { return doc; },
    get user() { return user; },
    get status() { return status; },
    on(k, f) { listeners[k].push(f); return () => { listeners[k] = listeners[k].filter(x => x !== f); }; },
    // Call after changing anything in WN.doc. Saves locally at once and pushes to the cloud.
    commit() { if (!doc) return; if (stampChanges()) { saveLocal(); schedulePush(); } },
    // Swap in a whole new document (restore backup). Everything in it counts as edited now.
    replace(next) {
      const old = doc; next = normalize(clone(next)); const t = now();
      for (const path of COLLECTIONS) (getCol(next, path) || []).forEach(o => { if (o) o.u = t; });
      for (const path of COLLECTIONS) { const key = path.join('.'), ids = new Set((getCol(next, path) || []).map(o => String(o.id))); (getCol(old, path) || []).forEach(o => { if (o && !ids.has(String(o.id))) next.del[key + ':' + o.id] = t; }); }
      next.settings.u = t; next.app.state.u = t; next.modified = new Date(t).toISOString();
      doc = next; shadow = snapshot(doc); saveLocal(); emit('change', doc, 'local'); schedulePush(0);
    },
    async syncNow() { await pull('manual'); await push(); },
    async signIn(email, password) { if (!sb) throw new Error('Cloud sync could not load.'); const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signOut() { if (sb) await sb.auth.signOut(); },
    async resetPassword(email, redirectTo) { if (!sb) throw new Error('Cloud sync could not load.'); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo }); if (error) throw error; },
    async updatePassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; },
    merge, normalize, // exposed for tests
  };

  // ---------- start-up
  function init(seed) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { saved = null; }
    doc = normalize(saved && Array.isArray(saved.items) ? saved : (typeof seed === 'function' ? seed() : {}));
    shadow = snapshot(doc);
    if (!saved) saveLocal();
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, realtime: { params: { eventsPerSecond: 20 } } });
      sb.auth.onAuthStateChange((event, session) => {
        const prev = user && user.id;
        user = session ? session.user : null;
        emit('auth', user, event);
        if (!user) { unsubscribe(); setStatus('off', 'Not signed in. Changes save on this device only.'); return; }
        if (user.id !== prev) { setStatus('busy', 'Connecting…'); subscribe(); pull('signin'); }
      });
      const wake = () => { if (user && document.visibilityState === 'visible') { if (!(channel && channel.__live)) subscribe(); pull('wake'); } };
      document.addEventListener('visibilitychange', wake);
      const flush = () => { if (user && pushTimer) { clearTimeout(pushTimer); pushTimer = null; push(); } };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
      window.addEventListener('pagehide', flush);
      window.addEventListener('online', wake);
      window.addEventListener('focus', () => { if (user && !(channel && channel.__live)) pull('focus'); });
    } else setStatus('error', 'Cloud sync could not load (offline or blocked). Changes save on this device.');
    // Keep two tabs in the same browser in step as well.
    window.addEventListener('storage', (e) => { if (e.key === LOCAL_KEY && e.newValue) { try { adopt(merge(doc, JSON.parse(e.newValue)), 'tab'); } catch { } } });
    return doc;
  }
  WN.init = init;
  window.WN = WN;
})();

// Workshop Navigator shared data + realtime sync. Used by both pages (index.html and workshop.html).
//
// The whole workshop is one JSON document per account (table public.workshop_state).
// - Every edit is saved in this browser at once.
// - INSTANT: the edit (only the parts that changed, usually under 1 KB) is broadcast straight to your other open
//   devices on a private channel only your account can join. No database round trip in between.
// - LIGHT: the cloud copy is updated by sending only what changed (database function wn_save merges it), so saving
//   never downloads the list, no matter how many devices you use. The full list is downloaded only when a device
//   opens and the cloud copy changed since it last looked.
// - Edits merge per item: each item carries `u` (last-changed time) and deletions leave a tombstone in `del`,
//   so two devices editing different items never overwrite each other.
// - Fallbacks: if wn_save isn't installed it saves the whole list (conditional write + merge); if the private
//   channel isn't allowed it listens to database change events. Everything still works, just heavier.
(function () {
  const CLOUD_URL = 'https://phrkzabhneiczzujfpgp.supabase.co';
  const CLOUD_KEY = 'sb_publishable_vDY7znrbl-3NKpSZd7SaAw_ArsnZWJO';
  const LOCAL_KEY = 'workshop-navigator-purchase-v1';
  const META_KEY = 'workshop-navigator-sync-meta-v2';
  const COLLECTIONS = [['items'], ['locations'], ['app', 'inventory'], ['app', 'shopping'], ['app', 'alerts']];
  const CHECK_EVERY = 90000; // tiny "anything new?" check while visible (~0.3 KB), in case a live message was missed

  const listeners = { change: [], status: [], auth: [] };
  const emit = (k, ...a) => listeners[k].forEach(f => { try { f(...a) } catch (e) { console.error(e) } });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const now = () => Date.now();
  const CID = Math.random().toString(36).slice(2) + now().toString(36); // this open copy of the app
  // Edit times get a fixed per-device fraction of a millisecond, so two devices editing the same part in the very same
  // millisecond can't tie: every device and the cloud then pick the same winner.
  const FRAC = (1 + Math.floor(Math.random() * 998)) / 1000;
  // Devices with a wrong clock are corrected with the server's clock, so "the newest edit wins" means newest in real time.
  let clockOff = 0;
  try { clockOff = Number(JSON.parse(localStorage.getItem('workshop-navigator-sync-meta-v2') || '{}').clockOff) || 0; } catch { }
  const stampNow = () => Math.floor(now() + clockOff) + FRAC;
  function learnClock(serverNow, t0, t1) { const s = Date.parse(serverNow); if (!s || t1 - t0 > 5000) return; clockOff = Math.round(s - (t0 + t1) / 2); setMeta({ clockOff }); }

  let doc = null, shadow = {}, sb = null, user = null, channel = null;
  let pushTimer = null, pushing = false, pushAgain = false, rowStamp = null, pollTimer = null, checkTimer = null, retryMs = 0;
  let status = { state: 'off', realtime: false, msg: 'Not signed in.' };
  let mode = 'bc';        // 'bc' = private broadcast channel, 'pg' = database change events (fallback)
  let rpcOK = null;       // wn_save available? null = not known yet
  let lastCloud = null;   // cloud save time this device is known to be up to date with
  let mine = null;        // {prev, at} of our last delta save while we weren't sure we were up to date
  let seq = 0, unsent = false;
  const seqs = {};
  // what still has to reach the cloud
  let dirty = { cols: {}, del: {}, settings: false, state: false, full: false };

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
  // Compare by content, not key order (Postgres hands objects back with its own key order).
  const canon = (v) => Array.isArray(v) ? '[' + v.map(x => x === undefined ? 'null' : canon(x)).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
    : JSON.stringify(v);
  const same = (a, b) => canon(a) === canon(b);
  // Same parts/settings, ignoring the document's own created/modified dates (those alone are no reason to re-save).
  const sameContent = (a, b) => same({ ...a, created: 0, modified: 0 }, { ...b, created: 0, modified: 0 });
  const sig = (o) => { const { u, ...rest } = o; return canon(rest); };
  function snapshot(d) {
    const s = {};
    for (const path of COLLECTIONS) { const key = path.join('.'); s[key] = {}; (getCol(d, path) || []).forEach(o => { if (o && o.id != null) s[key][o.id] = sig(o); }); }
    s.settings = sig(d.settings || {});
    s.state = sig((d.app && d.app.state) || {});
    return s;
  }

  // Stamp everything that changed since the last snapshot. Returns what changed, or null.
  function stampChanges() {
    const t = stampNow(); const ch = { cols: {}, del: {}, settings: false, state: false }; let changed = false;
    for (const path of COLLECTIONS) {
      const key = path.join('.'), before = shadow[key] || {}, arr = getCol(doc, path) || [], seen = new Set();
      for (const o of arr) {
        if (!o || o.id == null) continue;
        seen.add(String(o.id));
        if (before[o.id] !== sig(o)) { o.u = t; changed = true; delete doc.del[key + ':' + o.id]; (ch.cols[key] = ch.cols[key] || {})[o.id] = 1; }
      }
      for (const id of Object.keys(before)) if (!seen.has(String(id))) { doc.del[key + ':' + id] = t; ch.del[key + ':' + id] = 1; changed = true; }
    }
    if ((shadow.settings || '{}') !== sig(doc.settings || {})) { doc.settings.u = t; ch.settings = true; changed = true; }
    if ((shadow.state || '{}') !== sig(doc.app.state || {})) { doc.app.state.u = t; ch.state = true; changed = true; }
    if (changed) doc.modified = new Date(Math.floor(t)).toISOString();
    shadow = snapshot(doc);
    return changed ? ch : null;
  }
  function addDirty(ch) {
    for (const [key, ids] of Object.entries(ch.cols)) Object.assign(dirty.cols[key] = dirty.cols[key] || {}, ids);
    Object.assign(dirty.del, ch.del);
    if (ch.settings) dirty.settings = true;
    if (ch.state) dirty.state = true;
  }
  const isDirty = () => dirty.full || dirty.settings || dirty.state || Object.keys(dirty.del).length > 0 || Object.values(dirty.cols).some(o => Object.keys(o).length);
  // A small document holding only the listed changes (current versions from this device).
  function partial(ch) {
    const p = { version: 2, items: [], locations: [], app: { inventory: [], shopping: [], alerts: [] }, del: {}, created: doc.created, modified: doc.modified };
    for (const path of COLLECTIONS) {
      const key = path.join('.'), ids = ch.cols[key]; if (!ids) continue;
      const arr = getCol(doc, path) || [], out = [];
      for (const o of arr) if (o && o.id != null && ids[o.id]) out.push(clone(o));
      setCol(p, path, out);
    }
    for (const k of Object.keys(ch.del)) if (doc.del[k]) p.del[k] = doc.del[k];
    if (ch.settings) p.settings = clone(doc.settings);
    if (ch.state) p.state = clone(doc.app.state);
    return p;
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
    // Tombstones are kept (a few bytes each). Pruning them by each device's own clock let two devices with different
    // clocks disagree forever and re-save back and forth.
    out.del = del;
    out.settings = (local.settings.u || 0) > (remote.settings.u || 0) ? local.settings : remote.settings;
    out.app.state = (local.app.state.u || 0) > (remote.app.state.u || 0) ? local.app.state : remote.app.state;
    out.created = [local.created, remote.created].filter(Boolean).sort()[0];
    out.modified = [local.modified, remote.modified].filter(Boolean).sort().pop();
    return out;
  }
  // Apply a small "what changed" message. Keeps this device's item order; newer edits win (same rules as wn_merge_delta).
  function applyDelta(d, p) {
    const out = normalize(clone(d)), del = { ...out.del };
    for (const [k, v] of Object.entries((p && p.del) || {})) del[k] = Math.max(del[k] || 0, v);
    for (const path of COLLECTIONS) {
      const key = path.join('.'), arr = getCol(p, path) || [];
      if (arr.length || Object.keys(del).some(k => k.startsWith(key + ':'))) setCol(out, path, mergeArr(arr, getCol(out, path), key, del));
    }
    out.del = del;
    if (p && p.settings && (p.settings.u || 0) > (out.settings.u || 0)) out.settings = p.settings;
    if (p && p.state && (p.state.u || 0) > (out.app.state.u || 0)) out.app.state = p.state;
    if (p && p.modified && p.modified > out.modified) out.modified = p.modified;
    return out;
  }

  // The cloud kept a different version of some of our changes (an older edit from a device with a wrong clock, a
  // deletion that came after a newer edit, ...): show exactly what the cloud has.
  function applyFix(d, f) {
    const out = normalize(clone(d));
    for (const [k, v] of Object.entries(f.del || {})) out.del[k] = Math.max(out.del[k] || 0, v);
    for (const path of COLLECTIONS) {
      const key = path.join('.'), arr = (getCol(out, path) || []).slice(), fx = getCol(f, path) || [];
      for (const x of fx) { const i = arr.findIndex(e => e && String(e.id) === String(x.id)); if (i < 0) arr.push(x); else arr[i] = x; }
      const gone = new Set(Object.keys(f.del || {}).filter(k => k.startsWith(key + ':')).map(k => k.slice(key.length + 1)));
      setCol(out, path, arr.filter(e => !(e && gone.has(String(e.id)) && !fx.some(x => String(x.id) === String(e.id)))));
    }
    if (f.settings) out.settings = f.settings;
    if (f.state) out.app.state = f.state;
    return out;
  }

  // ---------- local persistence
  function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(doc)); } catch (e) { setStatus('error', 'This browser blocked saving. Download a backup now.'); } }
  function getMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } }
  function setMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify({ ...getMeta(), ...m })); } catch { } }
  function saveDirty() { setMeta({ dirty: isDirty() ? dirty : null }); }
  function setCloud(at) { lastCloud = at; if (user) setMeta({ userId: user.id, lastCloud: at, at: new Date().toISOString() }); }
  const sameTime = (a, b) => !!a && !!b && (a === b || Date.parse(a) === Date.parse(b));

  function setStatus(state, msg) {
    status = { state, realtime: !!(channel && channel.__live), msg: msg || status.msg };
    emit('status', status);
  }
  const synced = () => { if (status.state !== 'busy') setStatus('live', 'Synced · ' + new Date().toLocaleTimeString()); };

  // Replace the working document with a merged one and tell the page (only if it changed).
  function adopt(next, source) {
    next = normalize(next);
    if (same(next, doc)) return false;
    doc = next; shadow = snapshot(doc); saveLocal(); emit('change', doc, source);
    return true;
  }

  // ---------- safety brake: if this device ever starts talking to the cloud far more than any person could cause
  // (a bug, a loop), it stops syncing and says so, instead of quietly using up the free plan. Edits stay saved on the
  // device; "Sync now" resumes.
  const LIMITS = [[10 * 60e3, 600, 'requests'], [60 * 60e3, 60, 'full downloads']];
  let paused = false; const hits = { requests: [], 'full downloads': [] };
  function guard(kind) {
    if (paused) throw new Error('sync paused');
    const t = now();
    for (const [win, max, name] of LIMITS) {
      if (name !== 'requests' && name !== kind) continue;
      const a = hits[name]; a.push(t); while (a.length && a[0] < t - win) a.shift();
      if (a.length > max) {
        paused = true; clearTimeout(pushTimer); pushTimer = null;
        setStatus('paused', 'Sync paused: this device was syncing far more than normal (' + a.length + ' ' + name + '). Your changes are kept on this device. Tap “Sync now” to resume.');
        throw new Error('sync paused');
      }
    }
  }
  function resume() { paused = false; hits.requests = []; hits['full downloads'] = []; retryMs = 0; }

  // ---------- cloud
  async function fetchRow(cols) {
    guard(cols === 'updated_at' ? 'requests' : 'full downloads');
    const { data, error } = await sb.from('workshop_state').select(cols || 'data,updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  const missingFn = (e) => e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message || ''));

  async function push() {
    if (!sb || !user) return;
    clearTimeout(pushTimer); pushTimer = null;
    if (pushing) { pushAgain = true; return; }
    if (!isDirty()) return;
    pushing = true; setStatus('busy', 'Syncing…');
    try {
      // 1) Light path: send only what changed; the database merges it.
      if (rpcOK !== false && !dirty.full) {
        guard('requests');
        const taken = dirty; dirty = { cols: {}, del: {}, settings: false, state: false, full: false };
        let data, error; const t0 = now();
        try { ({ data, error } = await sb.rpc('wn_save', { p_delta: partial(taken) })); }
        catch (e) { addDirty(taken); throw e; } // network failure: keep everything for the retry
        const t1 = now();
        if (error) {
          addDirty(taken); if (taken.full) dirty.full = true;
          if (missingFn(error)) rpcOK = false;          // not installed: use the full-list path below
          else if (error.code === 'P0002') dirty.full = true; // no cloud copy yet: first upload below
          else throw error;
        } else {
          rpcOK = true;
          const at = data && data.at, prev = data && data.prev;
          if (data && data.now) learnClock(data.now, t0, t1);
          if (data && data.fix) adopt(applyFix(doc, data.fix), 'cloud');
          rowStamp = at; announceSaved(at, prev);
          if (sameTime(prev, lastCloud)) { setCloud(at); mine = null; } else { mine = { prev, at }; checkSoon(); }
          saveDirty(); retryMs = 0; setStatus('live', 'Synced · ' + new Date().toLocaleTimeString());
          return;
        }
      }
      // 2) Full-list path (first upload, restore, or wn_save not installed): conditional write, merge on conflict.
      const taken = dirty; dirty = { cols: {}, del: {}, settings: false, state: false, full: false };
      let saved = false;
      try {
        for (let attempt = 0; attempt < 6; attempt++) {
          if (attempt === 0 && mode === 'pg' && rowStamp && sameTime(rowStamp, lastCloud)) { // nothing new in the cloud: write straight away
            const stamp = new Date(Math.max(now(), Date.parse(rowStamp) + 1)).toISOString();
            guard('requests');
            const { data, error } = await sb.from('workshop_state').update({ data: normalize(clone(doc)), updated_at: stamp }).eq('user_id', user.id).eq('updated_at', rowStamp).select('updated_at');
            if (error) throw error;
            if (Array.isArray(data) && data.length) { announceSaved(stamp, rowStamp, true); rowStamp = stamp; setCloud(stamp); saved = true; break; }
            continue;
          }
          const row = await fetchRow();
          const merged = row && row.data ? merge(doc, row.data) : normalize(clone(doc));
          const stamp = new Date(Math.max(now(), row ? Date.parse(row.updated_at) + 1 : 0)).toISOString();
          let ok = false, wrote = false;
          guard('requests');
          if (!row) {
            const { error } = await sb.from('workshop_state').insert({ user_id: user.id, data: merged, updated_at: stamp });
            if (error && error.code !== '23505') throw error;
            ok = !error; wrote = ok;
          } else if (sameContent(merged, row.data)) {
            ok = true;
          } else {
            const { data, error } = await sb.from('workshop_state').update({ data: merged, updated_at: stamp }).eq('user_id', user.id).eq('updated_at', row.updated_at).select('updated_at');
            if (error) throw error;
            ok = wrote = Array.isArray(data) && data.length > 0;
          }
          if (ok) {
            adopt(merge(doc, merged), 'cloud'); // keep anything typed while the request was in flight
            if (wrote) { announceSaved(stamp, row ? row.updated_at : null, true); rowStamp = stamp; setCloud(stamp); }
            else { rowStamp = row.updated_at; setCloud(row.updated_at); }
            saved = true; break;
          }
        }
      } catch (e) { addDirty(taken); if (taken.full) dirty.full = true; throw e; }
      if (!saved) { addDirty(taken); dirty.full = true; throw new Error('another device kept saving at the same time'); }
      saveDirty(); retryMs = 0; setStatus('live', 'Synced · ' + new Date().toLocaleTimeString());
    } catch (e) {
      saveDirty();
      if (paused) return;
      // Back off 4 s, 8 s, 16 s … up to 5 min, so a blocked or failing server isn't hammered.
      retryMs = Math.min(retryMs ? retryMs * 2 : 4000, 300000);
      setStatus('error', 'Sync problem: ' + (e.message || e) + ' · Changes are kept on this device and will retry.');
      clearTimeout(pushTimer); pushTimer = setTimeout(push, retryMs);
    } finally {
      pushing = false;
      if (pushAgain) { pushAgain = false; if (isDirty()) schedulePush(0); }
    }
  }
  function schedulePush(ms) { if (!user || paused) return; if (retryMs && ms == null) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, ms || 0); }

  // Download the whole list and merge it in (opening the app after changes elsewhere, or anything missed).
  let lastPull = 0, pulling = null;
  async function pull(reason) {
    if (!sb || !user) return;
    if (pulling) return pulling;
    lastPull = now();
    pulling = (async () => {
      try {
        const row = await fetchRow();
        if (row && row.data) {
          rowStamp = row.updated_at;
          // A device that has never synced and was never edited just takes the cloud copy (so it can't bring back
          // parts deleted long ago from its built-in starter list).
          const fresh = !lastCloud && !isDirty() && !doc.items.some(x => x && x.u);
          const merged = fresh ? normalize(clone(row.data)) : merge(doc, row.data);
          adopt(merged, 'cloud');
          setCloud(row.updated_at); mine = null;
          if (!sameContent(merged, row.data)) { dirty.full = true; schedulePush(0); } // this device has edits the cloud doesn't
        } else { dirty.full = true; schedulePush(0); } // first upload
        synced();
      } catch (e) { if (!paused) setStatus('error', 'Sync problem: ' + (e.message || e)); }
      finally { pulling = null; }
    })();
    return pulling;
  }
  // ~0.3 KB: only download the list if the cloud copy changed since this device last saw it.
  let checking = null;
  async function check(reason) {
    if (!sb || !user) return;
    if (checking) return checking;
    checking = (async () => {
      try {
        const row = await fetchRow('updated_at');
        if (!row) { dirty.full = true; schedulePush(0); return; }
        if (mine && sameTime(lastCloud, mine.prev)) { setCloud(mine.at); mine = null; }
        if (!sameTime(row.updated_at, lastCloud)) await pull(reason);
        else { rowStamp = row.updated_at; synced(); }
      } catch (e) { if (!paused) setStatus('error', 'Sync problem: ' + (e.message || e)); }
      finally { checking = null; }
    })();
    return checking;
  }
  async function syncClock() {
    if (!sb || !user || rpcOK === false) return;
    try { guard('requests'); const t0 = now(); const { data, error } = await sb.rpc('wn_now'); const t1 = now(); if (!error && data) learnClock(data, t0, t1); } catch { }
  }
  let checkT = null;
  function checkSoon() { clearTimeout(checkT); checkT = setTimeout(() => check('verify'), 1500); }

  // ---------- instant updates between devices
  function sendDelta(ch) {
    if (!ch || !user) return;
    if (!channel || mode !== 'bc' || !channel.__live) { unsent = true; return; }
    let msg = { cid: CID, seq: ++seq, doc: partial(ch) };
    if (JSON.stringify(msg).length > 200000) msg = { cid: CID, seq, big: true }; // e.g. a restored backup: others re-read
    try { Promise.resolve(channel.send({ type: 'broadcast', event: 'chg', payload: msg })).then(r => { if (r && r !== 'ok') unsent = true; }, () => { unsent = true; }); } catch { unsent = true; }
  }
  function announceSaved(at, prev, full) {
    if (!channel || mode !== 'bc' || !channel.__live) return;
    const stale = unsent || !!full; unsent = false;
    try { Promise.resolve(channel.send({ type: 'broadcast', event: 'saved', payload: { cid: CID, seq, at, prev, stale } })).catch(() => { }); } catch { }
  }
  function inOrder(m, isChange) { // false if a message from that device was missed
    const last = seqs[m.cid]; seqs[m.cid] = Math.max(last || 0, m.seq || 0);
    if (last == null) return true;
    return isChange ? m.seq <= last + 1 : m.seq <= last;
  }
  function onChange(m) {
    if (!m || m.cid === CID) return;
    if (!inOrder(m, true) || m.big || !m.doc) { check('gap'); return; }
    adopt(applyDelta(doc, m.doc), 'realtime');
    synced();
  }
  function onSaved(m) {
    if (!m || m.cid === CID) return;
    if (!inOrder(m, false) || m.stale) { check('stale'); return; }
    rowStamp = m.at;
    if (sameTime(m.prev, lastCloud)) { setCloud(m.at); if (mine && sameTime(mine.prev, m.at)) { setCloud(mine.at); mine = null; } }
    else checkSoon();
  }
  function onCloudRow(payload) { // database change events (fallback mode)
    const row = payload.new;
    if (!row || !row.data) return;
    rowStamp = row.updated_at; setCloud(row.updated_at);
    const merged = merge(doc, row.data);
    adopt(merged, 'realtime');
    if (!sameContent(merged, row.data)) { dirty.full = true; schedulePush(0); }
    synced();
  }
  async function subscribe() {
    unsubscribe();
    if (!sb || !user) return;
    const uid = user.id, topic = 'workshop-' + uid;
    let ch;
    if (mode === 'bc') {
      try { if (sb.realtime && sb.realtime.setAuth) await sb.realtime.setAuth(); } catch { }
      if (!user || user.id !== uid || channel) return;
      ch = channel = sb.channel(topic, { config: { private: true, broadcast: { self: false } } })
        .on('broadcast', { event: 'chg' }, ({ payload }) => onChange(payload))
        .on('broadcast', { event: 'saved' }, ({ payload }) => onSaved(payload));
    } else {
      ch = channel = sb.channel(topic).on('postgres_changes', { event: '*', schema: 'public', table: 'workshop_state', filter: 'user_id=eq.' + uid }, onCloudRow);
    }
    ch.subscribe((st) => {
      if (channel !== ch) return;
      ch.__live = st === 'SUBSCRIBED';
      if (st === 'SUBSCRIBED') { ch.__ok = true; check('subscribed'); }
      else if (mode === 'bc' && st === 'CHANNEL_ERROR' && !ch.__ok) { mode = 'pg'; subscribe(); return; } // private channel not allowed yet
      setStatus(status.state, status.msg);
    });
    clearInterval(pollTimer); clearInterval(checkTimer);
    // Safety nets: if the live link drops, re-check every 20 s; while connected, a tiny check every 90 s.
    pollTimer = setInterval(() => { if (document.visibilityState === 'visible' && !(channel && channel.__live)) check('poll'); }, 20000);
    checkTimer = setInterval(() => { if (document.visibilityState === 'visible' && channel && channel.__live && !pushing && !pushTimer) check('interval'); }, CHECK_EVERY);
  }
  function unsubscribe() { if (channel && sb) { try { sb.removeChannel(channel); } catch { } } channel = null; clearInterval(pollTimer); clearInterval(checkTimer); }

  // ---------- public API
  const WN = {
    get doc() { return doc; },
    get user() { return user; },
    get client() { return sb; }, // used by the Checklist page for part photos (Supabase Storage)
    get status() { return status; },
    get syncInfo() { return { mode, rpc: rpcOK, lastCloud, pending: isDirty(), paused }; },
    on(k, f) { listeners[k].push(f); return () => { listeners[k] = listeners[k].filter(x => x !== f); }; },
    // Call after changing anything in WN.doc. Saves locally at once, tells your other devices, saves to the cloud.
    commit() {
      if (!doc) return;
      const ch = stampChanges(); if (!ch) return;
      saveLocal(); addDirty(ch); saveDirty(); sendDelta(ch); schedulePush();
    },
    // Swap in a whole new document (restore backup). Everything in it counts as edited now.
    replace(next) {
      const old = doc; next = normalize(clone(next)); const t = stampNow();
      for (const path of COLLECTIONS) (getCol(next, path) || []).forEach(o => { if (o) o.u = t; });
      for (const path of COLLECTIONS) { const key = path.join('.'), ids = new Set((getCol(next, path) || []).map(o => String(o.id))); (getCol(old, path) || []).forEach(o => { if (o && !ids.has(String(o.id))) next.del[key + ':' + o.id] = t; }); }
      next.settings.u = t; next.app.state.u = t; next.modified = new Date(Math.floor(t)).toISOString();
      doc = next; shadow = snapshot(doc); saveLocal(); emit('change', doc, 'local');
      dirty.full = true; unsent = true; saveDirty(); schedulePush(0);
    },
    async syncNow() { resume(); await pull('manual'); await push(); },
    async signIn(email, password) { if (!sb) throw new Error('Cloud sync could not load.'); const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signOut() { if (sb) await sb.auth.signOut(); },
    async resetPassword(email, redirectTo) { if (!sb) throw new Error('Cloud sync could not load.'); const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo }); if (error) throw error; },
    async updatePassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; },
    merge, normalize, applyDelta, // exposed for tests
  };

  // ---------- start-up
  function init(seed) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { saved = null; }
    doc = normalize(saved && Array.isArray(saved.items) ? saved : (typeof seed === 'function' ? seed() : {}));
    shadow = snapshot(doc);
    if (!saved) saveLocal();
    const meta = getMeta();
    if (meta.dirty && typeof meta.dirty === 'object') unsent = true, dirty = { cols: meta.dirty.cols || {}, del: meta.dirty.del || {}, settings: !!meta.dirty.settings, state: !!meta.dirty.state, full: !!meta.dirty.full };
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, realtime: { params: { eventsPerSecond: 40 } } });
      sb.auth.onAuthStateChange((event, session) => {
        const prev = user && user.id;
        user = session ? session.user : null;
        emit('auth', user, event);
        if (event === 'TOKEN_REFRESHED' && session && sb.realtime && sb.realtime.setAuth) { try { sb.realtime.setAuth(session.access_token); } catch { } }
        if (!user) { unsubscribe(); setStatus('off', 'Not signed in. Changes save on this device only.'); return; }
        if (user.id !== prev) {
          const m = getMeta();
          lastCloud = m.userId === user.id ? (m.lastCloud || null) : null;
          if (m.userId && m.userId !== user.id) dirty.full = true;
          setStatus('busy', 'Connecting…'); subscribe(); syncClock();
          if (isDirty()) schedulePush(0); // edits made while offline / app closed mid-save
          check('signin');
        }
      });
      const wake = () => { if (user && document.visibilityState === 'visible') { if (!(channel && channel.__live)) subscribe(); else check('wake'); if (isDirty()) schedulePush(0); } };
      document.addEventListener('visibilitychange', wake);
      const flush = () => { if (user && isDirty() && !pushing) push(); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
      window.addEventListener('pagehide', flush);
      window.addEventListener('online', wake);
      window.addEventListener('focus', () => { if (user && !(channel && channel.__live)) check('focus'); });
    } else setStatus('error', 'Cloud sync could not load (offline or blocked). Changes save on this device.');
    // Keep two tabs in the same browser in step as well.
    window.addEventListener('storage', (e) => {
      if (e.key !== LOCAL_KEY || !e.newValue) return;
      try {
        const before = shadow;
        if (!adopt(merge(doc, JSON.parse(e.newValue)), 'tab')) return;
        const ch = { cols: {}, del: {}, settings: shadow.settings !== before.settings, state: shadow.state !== before.state };
        for (const path of COLLECTIONS) { const key = path.join('.'), a = before[key] || {}, b = shadow[key] || {};
          for (const id of Object.keys(b)) if (a[id] !== b[id]) (ch.cols[key] = ch.cols[key] || {})[id] = 1;
          for (const id of Object.keys(a)) if (!(id in b) && doc.del[key + ':' + id]) ch.del[key + ':' + id] = 1; }
        addDirty(ch); saveDirty(); schedulePush();
      } catch { }
    });
    return doc;
  }
  WN.init = init;
  window.WN = WN;
})();

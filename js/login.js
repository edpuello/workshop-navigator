// 10.21: the login page (+ Sign up, Continue with Google, Face ID), in the app's own colours (navy, white, light grey — dark when
// Dark is on).
//  • Log in: username + password (eye to show/hide it), Log in, Remember me. Next to the username, in the iPhone app, a Face ID button:
//    tap it, look at the phone, and it fills in your login and logs you in (kept in the iPhone's Keychain behind Face ID).
//  • Remember me off → this device forgets you when the app is closed (no saved username, no Face ID login).
//  • Sign up: email + password (twice) → your account. Continue with Google: Google's own sign-in (on the iPhone, in Apple's secure sheet).
//  • Signed in: the app just opens — you stay logged in. + → Lock (iPhone app) locks it behind Face ID until you unlock it.
// The face-scan animation plays above the fields while Face ID runs: scan → corners close into a circle with a smiley → check.
(function () {
  if (window.parent !== window && /[?&]embed/.test(location.search)) { window.WNLogin = new Proxy({}, { get: (o, k) => { try { return window.parent.WNLogin[k]; } catch (e) { return undefined; } } }); return; }
  const SCHEME = 'workshopnavigator', CALLBACK = SCHEME + '://login-callback';
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
  const tokenKeys = () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sb-.+-auth-token$/.test(k)) out.push(k); } } catch (e) { } return out; };
  const hasSession = () => tokenKeys().some(k => /access_token/.test(ls.get(k) || ''));
  const NB = () => (window.WNNative && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wn) || null;
  const nat = (cmd, a) => { const h = NB(); return h ? h.postMessage(Object.assign({ cmd }, a || {})) : Promise.reject(new Error('Only in the iPhone app')); };
  const native = () => !!NB();
  const faceOn = () => ls.get('wn-faceid') !== 'off';
  const remember = () => ls.get('wn-remember') !== '0';
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise(r => setTimeout(r, RM() ? 0 : ms));
  const friendly = (x, fb) => { const m = (x && x.message) || fb || ''; return /signups? not allowed|signup.*disabled/i.test(m) ? 'New accounts aren’t open yet — ask Ed Puello for an invite.' : /provider is not enabled|unsupported provider/i.test(m) ? 'Google sign-in isn’t switched on for this app yet.' : /invalid login credentials/i.test(m) ? 'That username or password isn’t right.' : /email not confirmed/i.test(m) ? 'Confirm your email first — check your inbox for the link.' : m; };
  const pageUrl = () => /^https?:/.test(location.protocol) ? location.origin + location.pathname : undefined;
  const oauthBack = /(^|[#&?])(access_token|error_description)=/.test(location.hash) || /[?&]code=/.test(location.search);

  const CSS = `
html.wl-open,html.wl-open body{overflow:hidden!important}
.wl{position:fixed;inset:0;z-index:2000;overflow-x:hidden;background:var(--bg,#f2f2f5);color:var(--ink,#111114);display:flex;flex-direction:column;align-items:center;overflow-y:auto;-webkit-overflow-scrolling:touch;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro",system-ui,"Segoe UI",Inter,sans-serif;-webkit-tap-highlight-color:transparent;
  padding:max(52px,calc(env(safe-area-inset-top) + 32px)) 20px max(18px,env(safe-area-inset-bottom));transition:opacity .3s ease,transform .34s cubic-bezier(.2,.75,.3,1)}
.wl.out{opacity:0;transform:scale(1.04);pointer-events:none}
.wl-box{width:100%;max-width:380px;display:flex;flex-direction:column;flex:1 0 auto}
.wl-v{margin:0;font-size:10.5px;font-weight:500;letter-spacing:.9px;text-transform:uppercase;color:var(--ink2,#6e6e78)}
.wl-h{margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro",system-ui,"Segoe UI",Inter,sans-serif;font-size:34px;line-height:1.1;font-weight:600;letter-spacing:.2px}
.wl-s{margin:8px 0 0;font-size:15.5px;line-height:1.35;color:var(--ink2,#6e6e78)}
/* the face-scan pop-up: only while Face ID runs (tap the face button), over the page */
.wl-stage{position:fixed;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(8,14,22,.28);opacity:0;pointer-events:none;transition:opacity .22s ease}
.wl.face .wl-stage{opacity:1;pointer-events:auto}
.wl-pop{min-width:118px;max-width:200px;padding:22px 20px 16px;border-radius:24px;background:var(--card,#fff);display:flex;flex-direction:column;align-items:center;box-shadow:0 24px 60px -18px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.04);transform:scale(.88);transition:transform .34s cubic-bezier(.25,1.25,.4,1)}
.wl.face .wl-pop{transform:none}
/* the wheel: 12 spokes fading in turn, like the iPhone's own spinner; when it's done it turns into a green check */
.wl-wheel{position:relative;width:38px;height:38px;flex:none}
.wl-wheel i{position:absolute;left:17.25px;top:2px;width:3.5px;height:10px;border-radius:2px;background:var(--ink2,#6e6e78);transform-origin:1.75px 17px;opacity:.15;animation:wlspoke .9s linear infinite}
.wl-wheel i:nth-child(1){transform:rotate(0deg);animation-delay:-0.900s}.wl-wheel i:nth-child(2){transform:rotate(30deg);animation-delay:-0.825s}.wl-wheel i:nth-child(3){transform:rotate(60deg);animation-delay:-0.750s}.wl-wheel i:nth-child(4){transform:rotate(90deg);animation-delay:-0.675s}.wl-wheel i:nth-child(5){transform:rotate(120deg);animation-delay:-0.600s}.wl-wheel i:nth-child(6){transform:rotate(150deg);animation-delay:-0.525s}.wl-wheel i:nth-child(7){transform:rotate(180deg);animation-delay:-0.450s}.wl-wheel i:nth-child(8){transform:rotate(210deg);animation-delay:-0.375s}.wl-wheel i:nth-child(9){transform:rotate(240deg);animation-delay:-0.300s}.wl-wheel i:nth-child(10){transform:rotate(270deg);animation-delay:-0.225s}.wl-wheel i:nth-child(11){transform:rotate(300deg);animation-delay:-0.150s}.wl-wheel i:nth-child(12){transform:rotate(330deg);animation-delay:-0.075s}
@keyframes wlspoke{0%{opacity:1}100%{opacity:.15}}
.wl.ok .wl-wheel i{animation:none;opacity:0;transition:opacity .15s}
.wl-done{position:absolute;inset:-3px;width:44px;height:44px;opacity:0;transform:scale(.6);transition:opacity .2s,transform .34s cubic-bezier(.25,1.4,.4,1)}
.wl.ok .wl-done{opacity:1;transform:none}
.wl-done circle{fill:var(--ok,#2e9e5b)}.wl-done path{fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .32s cubic-bezier(.65,0,.35,1) .14s}
.wl.ok .wl-done path{stroke-dashoffset:0}
.wl-msg{margin:12px 0 0;font-size:13.5px;font-weight:600;min-height:18px;text-align:center;color:var(--ink,#111);white-space:nowrap}
.wl.shake .wl-pop{animation:wlshake .42s cubic-bezier(.36,.07,.19,.97)}
@keyframes wlshake{15%,85%{transform:translateX(-3px)}30%,70%{transform:translateX(6px)}45%,55%{transform:translateX(-8px)}}
/* the form */
.wl-form{display:flex;flex-direction:column;gap:10px;margin-top:26px}
.wl-lbl{font-size:13px;font-weight:600;color:var(--ink2,#6e6e78);margin:4px 4px -4px}
.wl-row{display:flex;gap:10px;align-items:stretch;min-width:0}
.wl-pw{position:relative;display:flex}
.wl-form input{flex:none;min-width:0;width:100%;box-sizing:border-box;height:54px;border-radius:16px;border:1px solid var(--line,#e8e8ee);background:var(--card,#fff);color:var(--ink,#111);font:inherit;font-size:17px;padding:0 16px;outline:none;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.wl-form .wl-pw input{padding-right:54px}
.wl-form input:focus{border-color:var(--accent,#1565a5);box-shadow:0 0 0 3px rgba(21,101,165,.16)}
.wl-form input::placeholder{color:var(--ink3,#a1a1aa)}
.wl-eye{position:absolute;right:4px;top:4px;width:46px;height:46px;border:0;background:none;border-radius:12px;color:var(--ink2,#6e6e78);display:grid;place-items:center;padding:0;touch-action:manipulation}
.wl-eye:active{background:var(--pill,#f1f1f4)}.wl-eye svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.wl-fid{position:absolute;right:5px;top:5px;width:44px;height:44px;border-radius:12px;border:0;background:var(--brand,#173a5c);color:#fff;display:grid;place-items:center;padding:0;touch-action:manipulation;transition:transform .12s,filter .15s}
.wl-fid:active{transform:scale(.92);filter:brightness(1.25)}.wl-fid[hidden],.wl [hidden]{display:none!important}.wl-urow:has(.wl-fid[hidden]) input{padding-right:16px}
.wl-fid svg{width:24px;height:24px}.wl-fid path{fill:none;stroke:currentColor;stroke-width:7;stroke-linecap:round;stroke-linejoin:round}
.wl-err{margin:2px 4px 0;color:var(--bad,#e5484d);font-size:14px;min-height:19px}.wl-err.good{color:var(--ok,#2e9e5b)}
.wl-btn{height:56px;border:0;border-radius:18px;background:var(--brand,#173a5c);color:#fff;font:inherit;font-size:17px;font-weight:600;touch-action:manipulation;transition:transform .12s,opacity .2s,filter .15s;box-shadow:0 10px 24px -12px rgba(23,58,92,.7)}
.wl-btn:active,.wl-btn.press{transform:scale(.97);filter:brightness(1.2)}.wl-btn[disabled]{opacity:.65}
.wl-rem{display:flex;align-items:center;gap:10px;margin:4px 2px 0;font-size:15px;font-weight:500;color:var(--ink,#111);cursor:pointer;width:max-content}
.wl-rem input{position:absolute;opacity:0;width:1px;height:1px}
.wl-box2{width:22px;height:22px;border-radius:7px;border:1.6px solid var(--line,#d5d8de);background:var(--card,#fff);display:grid;place-items:center;transition:background-color .15s,border-color .15s}
.wl-box2 svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;opacity:0;transform:scale(.6);transition:opacity .15s,transform .2s cubic-bezier(.3,1.5,.5,1)}
.wl-rem input:checked + .wl-box2{background:var(--brand,#173a5c);border-color:var(--brand,#173a5c)}.wl-rem input:checked + .wl-box2 svg{opacity:1;transform:none}
.wl-rem input:focus-visible + .wl-box2{box-shadow:0 0 0 3px rgba(21,101,165,.25)}
.wl-or{display:flex;align-items:center;gap:12px;margin:12px 0 2px;color:var(--ink3,#a1a1aa);font-size:13px;font-weight:600}.wl-or::before,.wl-or::after{content:"";flex:1;height:1px;background:var(--line,#e2e4e9)}
.wl-g{height:54px;border-radius:18px;border:1px solid var(--line,#e2e4e9);background:var(--card,#fff);color:var(--ink,#111);font:inherit;font-size:16.5px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;touch-action:manipulation;transition:transform .12s;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.wl-g:active{transform:scale(.97)}.wl-g svg{width:20px;height:20px}
.wl-sw{margin:16px 0 0;text-align:center;font-size:15px;color:var(--ink2,#6e6e78)}
.wl-link{border:0;background:none;padding:4px 2px;font:inherit;font-weight:600;color:var(--accent,#1565a5);touch-action:manipulation;text-decoration:none}
.wl-tos{margin:6px 0 0;text-align:center;font-size:12.5px;line-height:1.4;color:var(--ink3,#8e8e96)}.wl-tos .wl-link{font-size:12.5px;padding:0}
.wl-foot{margin-top:auto;padding-top:26px;text-align:center;font-size:12px;font-weight:500;color:var(--ink3,#a1a1aa);letter-spacing:.2px}
/* Terms of Service sheet */
.wl-terms{position:fixed;inset:0;z-index:2001;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .2s ease}
.wl-terms.on{opacity:1}
.wl-terms .tb{width:100%;max-width:560px;max-height:86vh;background:var(--card,#fff);color:var(--ink,#111);border-radius:26px 26px 0 0;display:flex;flex-direction:column;transform:translateY(40px);transition:transform .34s cubic-bezier(.2,.75,.3,1);padding-bottom:env(safe-area-inset-bottom)}
.wl-terms.on .tb{transform:none}
.wl-terms .th{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px;border-bottom:1px solid var(--line,#eee)}.wl-terms .th b{font-size:18px}
.wl-terms .tx{overflow:auto;padding:6px 20px 24px;font-size:14.5px;line-height:1.5;color:var(--ink2,#555)}.wl-terms .tx h4{margin:16px 0 4px;color:var(--ink,#111);font-size:15px}.wl-terms .tx p{margin:0}
.wl-done{border:0;border-radius:999px;background:var(--brand,#173a5c);color:#fff;font:inherit;font-weight:600;font-size:15px;padding:8px 16px}
@media (prefers-reduced-motion:reduce){.wl-wheel i{animation-duration:1.8s}.wl-stage,.wl-pop{transition:none}}`;

  const WHEEL = `<div class="wl-wheel" aria-hidden="true">${'<i></i>'.repeat(12)}<svg class="wl-done" viewBox="0 0 44 44"><circle cx="22" cy="22" r="22"/><path d="M13.5 22.5l5.6 5.6 11.4-12.2"/></svg></div>`;
  const MARK = `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M18 44V32A14 14 0 0 1 32 18H44M76 18H88A14 14 0 0 1 102 32V44M102 76V88A14 14 0 0 1 88 102H76M44 102H32A14 14 0 0 1 18 88V76M44 44V52M76 44V52M60 44V62H55M45 76Q60 88 75 76"/></svg>`;
  const EYE = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
  const EYE_OFF = '<path d="M9.9 4.24A9.6 9.6 0 0 1 12 4c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.16 3.19M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/>';
  const G = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.37-2.29V6.6H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4-3.11z"/><path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4 3.11C6.22 6.87 8.87 4.76 12 4.76z"/></svg>';
  const TERMS = `<h4>Using Workshop Navigator</h4><p>Workshop Navigator is a personal tool for keeping track of the hardware, parts, tools and storage in your workshop. Use it for lawful purposes and keep your login to yourself — you're responsible for what's done with your account.</p>
<h4>Your data</h4><p>Your inventory, photos and settings are saved on your device and, when you're logged in, synced to the app's cloud database (Supabase) so your devices stay in step. They aren't sold or shared. You can export a backup from Settings at any time, and ask Ed Puello to delete your account and its data.</p>
<h4>Face ID and Remember me</h4><p>If you use the Face ID button, your login is stored only in this iPhone's Keychain and is unlocked by Face ID or your passcode; it never leaves the device. Turn off Remember me and the app forgets you on this device when it's closed.</p>
<h4>Google sign-in</h4><p>If you continue with Google, Google confirms who you are and shares your name and email address with the app to create or open your account. Nothing is posted to your Google account.</p>
<h4>Printing and labels</h4><p>Labels and counts are only as accurate as what's entered. Check part sizes and quantities before relying on them for anything important.</p>
<h4>No warranty</h4><p>The app is provided as is, without warranties of any kind. To the extent the law allows, its creator isn't liable for lost data, wrong counts or other losses from using it.</p>
<h4>Changes</h4><p>These terms may be updated as the app changes; the version in the app is the current one. Questions: contact Ed Puello.</p>`;

  let el = null, busy = false, view = 'login';
  const $ = (s) => el && el.querySelector(s);
  const say = (m) => { if (el) $('.wl-msg').textContent = m || ''; };
  const err = (m, good) => { if (!el) return; const e = $('.wl-err'); e.textContent = m || ''; e.classList.toggle('good', !!good); };
  function reset() { el.classList.remove('ok', 'shake', 'scan'); }
  const stage = (on) => el && el.classList.toggle('face', !!on);
  const scanning = (on) => el && el.classList.toggle('scan', !!on);
  async function recognised(msg) { scanning(false); say(msg); }
  async function checkmark() { if (!el) return; el.classList.add('ok'); await wait(520); }
  async function shake(msg) { if (!el) return; scanning(false); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); say(msg); await wait(450); el && el.classList.remove('shake'); }
  async function typeIn(input, value, ms) {
    if (RM()) { input.value = value; return; }
    const step = Math.max(8, Math.min(26, (ms || 300) / (value.length || 1)));
    for (let i = 1; i <= value.length; i++) { input.value = value.slice(0, i); await new Promise(r => setTimeout(r, step)); }
  }
  async function done(msg, viaFace, unlockOnly) {   // signed in: (Face ID: finish the check in the pop-up) then lift the page away
    if (viaFace) { if (msg) say(msg); await checkmark(); }
    busy = false;
    if (!unlockOnly) goHome();   // a fresh log-in always lands on Home, scrolled to the top
    close();
  }
  function goHome() {
    try { if (window.WNShell) WNShell.reset(); } catch (e) { }   // fresh login: the Checklist reloads with it
    if (/workshop\.html$/.test(location.pathname)) {
      if (location.hash !== '#/' && location.hash !== '') location.hash = '#/';
      const top = () => { try { window.scrollTo(0, 0); document.scrollingElement && (document.scrollingElement.scrollTop = 0); } catch (e) { } };
      top(); requestAnimationFrame(top); setTimeout(top, 120);
      // Home lit in the bar, bubble already sitting on it (no glide behind the login page)
      const lit = () => { try { if (window.WNBar) { WNBar.mark('home'); WNBar.sync(true); } } catch (e) { } };
      lit(); requestAnimationFrame(lit); setTimeout(lit, 120);
    } else location.replace('workshop.html#/');
  }

  function build() {
    if (el) return el;
    if (!document.getElementById('wl-css')) { const st = document.createElement('style'); st.id = 'wl-css'; st.textContent = CSS; document.head.appendChild(st); }
    el = document.createElement('div'); el.className = 'wl'; el.id = 'wnlogin'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Log in');
    el.innerHTML = `<div class="wl-box"><p class="wl-v">Workshop Navigator · v10.21</p><h1 class="wl-h"></h1><p class="wl-s"></p>
<div class="wl-stage" aria-live="polite"><div class="wl-pop">${WHEEL}<p class="wl-msg"></p></div></div>
<form class="wl-form" autocomplete="on" novalidate>
<label class="wl-lbl" for="wl-u">Username</label>
<div class="wl-pw wl-urow"><input id="wl-u" type="email" name="email" placeholder="you@example.com" autocomplete="username" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false">
<button type="button" class="wl-fid" aria-label="Log in with Face ID" title="Log in with Face ID" hidden>${MARK}</button></div>
<label class="wl-lbl" for="wl-p">Password</label>
<div class="wl-pw"><input id="wl-p" type="password" name="password" placeholder="Password" autocomplete="current-password"><button type="button" class="wl-eye" aria-label="Show password" aria-pressed="false"><svg viewBox="0 0 24 24">${EYE}</svg></button></div>
<label class="wl-lbl wl-only-up" for="wl-p2" hidden>Confirm password</label>
<div class="wl-pw wl-only-up" hidden><input id="wl-p2" type="password" name="password2" placeholder="Type it again" autocomplete="new-password"></div>
<p class="wl-err" role="alert"></p>
<button class="wl-btn" type="submit">Log in</button>
<label class="wl-rem wl-only-in"><input type="checkbox" name="remember"><span class="wl-box2"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>Remember me</label>
<div class="wl-or">or</div>
<button type="button" class="wl-g">${G}<span>Continue with Google</span></button>
<p class="wl-sw"></p>
<p class="wl-tos">By continuing you agree to the <button type="button" class="wl-link wl-tosb">Terms of Service</button>.</p>
</form>
<p class="wl-foot">Created by Ed Puello</p></div>`;
    document.body.appendChild(el); document.documentElement.classList.add('wl-open');
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) { } });
    const f = $('.wl-form');
    if (native()) $('.wl-fid').hidden = false;
    f.remember.checked = remember();
    const last = remember() && ls.get('wn-login-email'); if (last) f.email.value = last;
    reset(); setView('login');
    f.addEventListener('submit', (e) => { e.preventDefault(); view === 'signup' ? signUp() : passwordLogin(false); });
    $('.wl-fid').addEventListener('click', () => faceLogin());
    $('.wl-eye').addEventListener('click', () => {   // show / hide the password
      const show = f.password.type === 'password'; f.password.type = f.password2.type = show ? 'text' : 'password';
      const b = $('.wl-eye'); b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.firstElementChild.innerHTML = show ? EYE_OFF : EYE;
    });
    $('.wl-g').addEventListener('click', () => google());
    $('.wl-tosb').addEventListener('click', terms);
    el.addEventListener('click', (e) => { if (e.target.closest('.wl-swb')) setView(view === 'login' ? 'signup' : 'login'); });
    return el;
  }
  function setView(v) {
    view = v; const up = v === 'signup', f = $('.wl-form');
    $('.wl-h').textContent = up ? 'Create account' : 'Welcome back';
    $('.wl-s').textContent = up ? 'Sign up to keep your workshop in sync.' : 'Please log in to your account.';
    $('.wl-btn').textContent = up ? 'Sign up' : 'Log in';
    el.querySelectorAll('.wl-only-up').forEach(x => x.hidden = !up); el.querySelectorAll('.wl-only-in').forEach(x => x.hidden = up);
    $('.wl-fid').hidden = up || !native();
    f.password.autocomplete = up ? 'new-password' : 'current-password';
    $('.wl-sw').innerHTML = up ? 'Already have an account? <button type="button" class="wl-link wl-swb">Log in</button>' : 'Don’t have an account? <button type="button" class="wl-link wl-swb">Sign up</button>';
    el.setAttribute('aria-label', up ? 'Sign up' : 'Log in'); err('');
  }
  function terms() {
    const t = document.createElement('div'); t.className = 'wl-terms'; t.setAttribute('role', 'dialog'); t.setAttribute('aria-label', 'Terms of Service');
    t.innerHTML = `<div class="tb"><div class="th"><b>Terms of Service</b><button type="button" class="wl-done">Done</button></div><div class="tx">${TERMS}<p style="margin-top:18px;font-size:12.5px">Last updated Nov 6, 2026.</p></div></div>`;
    document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('on'));
    const shut = () => { t.classList.remove('on'); setTimeout(() => t.remove(), 260); };
    t.addEventListener('click', (e) => { if (e.target === t || e.target.closest('.wl-done')) shut(); });
  }
  // after any successful sign-in: remember (or not) on this device
  async function keep(email, pw) {
    const f = $('.wl-form'), rem = !f || f.remember.checked;
    ls.set('wn-remember', rem ? '1' : '0');
    if (rem) { if (email) ls.set('wn-login-email', email); if (native() && email && pw) { try { await nat('credSave', { email, password: pw }); ls.set('wn-faceid', 'on'); } catch (e) { } } }
    else { ls.del('wn-login-email'); if (native()) { try { await nat('credForget'); } catch (e) { } } }
    try { sessionStorage.setItem('wn-live', '1'); } catch (e) { }
  }
  async function passwordLogin(fromFace, savedPw) {
    if (!el || (busy && !fromFace)) return; busy = true;
    const f = $('.wl-form'), btn = $('.wl-btn'), email = f.email.value.trim(), pw = savedPw != null ? savedPw : f.password.value;
    err('');
    if (!email || !pw) { err(!email ? 'Type your username (email).' : 'Type your password.'); (!email ? f.email : f.password).focus(); busy = false; return; }
    btn.disabled = true; if (!fromFace) btn.textContent = 'Logging in…';
    try {
      if (!window.WN || !WN.signIn) throw new Error('Can’t reach the server right now');
      await WN.signIn(email, pw);
      await keep(email, pw); f.password.value = '';
      await done('Logged in', fromFace);
    } catch (x) {
      btn.disabled = false; btn.textContent = 'Log in'; err(friendly(x, 'Couldn’t log in')); busy = false;
      if (fromFace) { await shake('Couldn’t log in'); await wait(300); stage(false); }
    }
  }
  async function signUp() {
    if (!el || busy) return; busy = true;
    const f = $('.wl-form'), btn = $('.wl-btn'), email = f.email.value.trim(), pw = f.password.value, pw2 = f.password2.value;
    err('');
    const bad = !/^\S+@\S+\.\S+$/.test(email) ? 'Type a valid email address.' : pw.length < 8 ? 'Use a password of at least 8 characters.' : pw !== pw2 ? 'The two passwords don’t match.' : '';
    if (bad) { err(bad); busy = false; return; }
    btn.disabled = true; btn.textContent = 'Creating your account…';
    try {
      if (!window.WN || !WN.signUp) throw new Error('Can’t reach the server right now');
      const r = await WN.signUp(email, pw, pageUrl());
      if (r && r.session) { await keep(email, pw); f.password.value = f.password2.value = ''; return done('Account created'); }
      btn.disabled = false; setView('login'); f.email.value = email; f.password.value = '';
      err('Check your email for a link to confirm your account, then log in here.', true); busy = false;
    } catch (x) { btn.disabled = false; btn.textContent = 'Sign up'; err(friendly(x, 'Couldn’t create the account')); busy = false; }
  }
  // Continue with Google. Website: off to Google and back (the page finishes the sign-in when it comes back).
  // iPhone app: Google opens in Apple's secure sign-in sheet; we finish the sign-in with what it hands back.
  async function google() {
    if (!el || busy) return; busy = true; err('');
    try {
      if (!window.WN || !WN.oauth) throw new Error('Can’t reach the server right now');
      ls.set('wn-remember', $('.wl-form').remember.checked ? '1' : '0');
      if (!native()) { await WN.oauth('google', pageUrl()); return; }   // the browser leaves for Google
      const url = await WN.oauth('google', CALLBACK, true);
      const back = await nat('oauth', { url, scheme: SCHEME });
      if (!back) { busy = false; return; }   // closed the sheet
      await WN.finishOAuth(back); await keep();
      await done('Logged in with Google');
    } catch (x) { busy = false; err(friendly(x, 'Google sign-in didn’t work')); }
  }
  // the face button: Face ID → your saved login fills in → logs you in. (Signed in and just locked: Face ID unlocks.)
  async function faceLogin() {
    if (!el || busy || !native()) return; busy = true; err('');
    reset(); stage(true); scanning(true); say('Look at your iPhone');
    try {
      if (hasSession()) {
        const ok = await nat('unlock', { reason: 'Unlock Workshop Navigator' });
        if (ok !== true) { busy = false; await shake('Not unlocked'); await wait(350); stage(false); err('Tap the face button to unlock.'); return; }
        await recognised('Unlocked'); return done('Unlocked', true, true);
      }
      const c = await nat('credLoad', { reason: 'Log in to Workshop Navigator' });
      if (c === false) { busy = false; await shake('Cancelled'); await wait(300); stage(false); return; }
      if (!c || !c.email) { busy = false; await shake(''); stage(false); err('Log in with your password once (with Remember me on) — after that the face button logs you in.'); return; }
      await recognised('Logging in…');
      $('.wl-form').email.value = c.email;   // the username shows; the password is used without ever appearing
      await passwordLogin(true, c.password);
    } catch (x) {
      const m = (x && x.message) || ''; busy = false;
      if (/no-lock/i.test(m) && hasSession()) { ls.set('wn-faceid', 'off'); return close(); }   // no Face ID or passcode on this phone
      await shake(''); stage(false);
      err(/no-lock/i.test(m) ? 'Set up Face ID or a passcode on this iPhone to use the face button.' : m || 'Face ID didn’t work');
    }
  }
  function close() {
    if (!el) return; const x = el; el = null;
    x.classList.add('out'); document.documentElement.classList.remove('wl-open');
    setTimeout(() => x.remove(), RM() ? 0 : 340);
  }
  function show(v) { build(); stage(false); reset(); setView(v || 'login'); }
  function lock() { if (native() && hasSession() && !el) { show(); faceLogin(); } }

  function start() {
    let fresh = true; try { fresh = !sessionStorage.getItem('wn-live'); sessionStorage.setItem('wn-live', '1'); } catch (e) { }
    // Remember me was off: a fresh start of the app forgets you on this device
    if (fresh && !remember() && hasSession() && !oauthBack) tokenKeys().forEach(k => ls.del(k));
    // one time only (this build, iPhone app): log out so the whole login flow can be tried from the start
    if (native() && !ls.get('wn-relogin-1021') && !oauthBack) { ls.set('wn-relogin-1021', '1'); tokenKeys().forEach(k => ls.del(k)); }
    if (oauthBack) { show(); err('Finishing Google sign-in…', true); busy = true; }   // back from Google (website)
    else if (!hasSession()) show();
    // signed in → the app just opens (no Face ID every time). + → Lock locks it when you want.
    const hook = () => {
      if (!(window.WN && WN.on)) return setTimeout(hook, 300);
      WN.on('auth', (u, ev) => {
        if (!u && ev === 'SIGNED_OUT' && !el) show();
        if (u && oauthBack && el && busy) { busy = false; keep().then(() => done()); }
      });
      if (oauthBack) setTimeout(() => { if (el && busy && !hasSession()) { busy = false; err('Google sign-in didn’t finish — try again.'); } }, 8000);
    };
    hook();
  }
  // log out: end the session on this device and show the login page
  async function logout() { try { if (window.WN && WN.signOut) await WN.signOut(); } catch (e) { } tokenKeys().forEach(k => ls.del(k)); show(); }
  window.WNLogin = { TERMS, logout, lock, show, close, faceLogin, faceOn, setFace(on) { ls.set('wn-faceid', on ? 'on' : 'off'); } };
  start();
})();

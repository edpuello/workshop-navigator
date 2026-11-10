// Camera scanner for the WEBSITE (Safari, Chrome, a PC webcam). The iPhone app never uses this: it has its own built-in scanner.
// Reads QR codes and Data Matrix. The reader (js/html5-qrcode.min.js, ~370 KB) loads only the first time you tap Scan.
(function () {
  let lib = null;
  const load = () => lib || (lib = new Promise((ok, no) => {
    if (window.__Html5QrcodeLibrary__) return ok();
    const s = document.createElement('script'); s.src = 'js/html5-qrcode.min.js?v=2.3.8';
    s.onload = () => ok(); s.onerror = () => { lib = null; no(new Error('Could not load the scanner — check the connection')); };
    document.head.appendChild(s);
  }));
  // A camera can be used here: HTTPS (or this computer) and a browser that offers it.
  const available = () => !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  // Resolves with what was read, '' if closed, or rejects with a message you can show.
  function scan() {
    return new Promise((resolve, reject) => {
      const ov = document.createElement('div');
      ov.className = 'wscan'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Scan a drawer');
      ov.innerHTML = '<div class="wscan-top"><b>Scan a drawer</b><button type="button" class="wscan-x" aria-label="Close">×</button></div>'
        + '<div id="wscanView" class="wscan-view"></div><p class="wscan-hint">Point at the square code on a drawer label</p><p class="wscan-err" hidden></p>';
      (document.querySelector('dialog[open]') || document.body).appendChild(ov);   // 10.22: above an open sheet too (scan a place while adding items)
      const errEl = ov.querySelector('.wscan-err');
      let q = null, done = false;
      const finish = async (val, err) => {
        if (done) return; done = true;
        try { if (q && q.isScanning) await q.stop(); } catch (e) { }
        try { if (q) q.clear(); } catch (e) { }
        ov.remove(); document.removeEventListener('keydown', onKey);
        if (err) reject(err); else resolve(val || '');
      };
      const onKey = (e) => { if (e.key === 'Escape') finish(''); };
      document.addEventListener('keydown', onKey);
      ov.querySelector('.wscan-x').onclick = () => finish('');
      load().then(async () => {
        if (done) return;
        const L = window.__Html5QrcodeLibrary__, F = L.Html5QrcodeSupportedFormats;
        q = new L.Html5Qrcode('wscanView', { formatsToSupport: [F.QR_CODE, F.DATA_MATRIX], verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
        const box = (w, h) => { const s = Math.max(120, Math.floor(Math.min(w, h) * 0.7)); return { width: s, height: s }; };
        try {
          await q.start({ facingMode: 'environment' }, { fps: 12, qrbox: box, aspectRatio: 1 }, (text) => { try { navigator.vibrate && navigator.vibrate(40); } catch (e) { } finish(text); }, () => { });
        } catch (e) {
          const m = String((e && (e.name || '')) + ' ' + (e && e.message || e));
          const msg = /NotAllowed|Permission|denied/i.test(m) ? 'Camera access is blocked — allow the camera for this site in the browser settings, then try again.'
            : /NotFound|not found|no camera|OverConstrained/i.test(m) ? 'No camera found on this device.'
            : 'Could not start the camera: ' + m.trim();
          errEl.textContent = msg; errEl.hidden = false;
          setTimeout(() => finish('', new Error(msg)), 2600);
        }
      }, (e) => finish('', e));
    });
  }
  window.WNWebScan = { available, scan };
})();

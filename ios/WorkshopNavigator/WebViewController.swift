// The web view that shows the bundled Workshop pages, plus the bridge the pages use for native features.
import UIKit
import WebKit
import UserNotifications

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var webView: WKWebView!
    private let bridge = NativeBridge()
    private var downloadURL: URL?

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: AppSchemeHandler.scheme)
        config.websiteDataStore = .default()
        config.suppressesIncrementalRendering = true   // 10.21: no flash between Workshop and Checklist — the next page shows only when ready
        config.allowsInlineMediaPlayback = true

        let content = config.userContentController
        content.addScriptMessageHandler(bridge, contentWorld: .page, name: "wn")
        // Tells the pages they are running inside the iPhone app (printers.js and workshop.html check this).
        let device = UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone"
        let flag = "window.WNNative={platform:'ios',device:'\(device)',version:'\(Bundle.main.appVersion)'};document.documentElement.classList.add('native');"
        content.addUserScript(WKUserScript(source: flag, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInsetAdjustmentBehavior = .never   // the pages place themselves around the notch
        // 10.21: no pinch-to-zoom (it's an app, not a web page)
        web.scrollView.minimumZoomScale = 1
        web.scrollView.maximumZoomScale = 1
        web.scrollView.bouncesZoom = false
        UNUserNotificationCenter.current().delegate = NotificationPresenter.shared   // 10.21: banners while open
        web.scrollView.bounces = false            // 10.21: the stretch at the top/bottom is drawn by the page (js/tabbar.js) so the bottom bar never moves or vanishes
        web.scrollView.alwaysBounceVertical = false
        content.addUserScript(WKUserScript(source: "(function(){var m=document.querySelector('meta[name=viewport]');var v='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';if(m)m.setAttribute('content',v);else{m=document.createElement('meta');m.name='viewport';m.content=v;document.head.appendChild(m);}document.addEventListener('gesturestart',function(e){e.preventDefault();},{passive:false});})();", injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        web.isOpaque = false
        web.backgroundColor = .white   // 10.21: white headers (the page tells us when Dark is on — see darkChrome)
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }  // Safari → Develop menu on the Mac
        #endif
        webView = web
        bridge.webView = web
        bridge.presenter = self
        view = web
    }

    // 10.21: Light / Dark theme from the page (Menu + → Theme): status bar text and the colour behind the page follow it
    var darkChrome = false {
        didSet {
            guard darkChrome != oldValue else { return }
            overrideUserInterfaceStyle = darkChrome ? .dark : .light
            webView?.backgroundColor = darkChrome ? UIColor(red: 0.05, green: 0.06, blue: 0.07, alpha: 1) : .white
            setNeedsStatusBarAppearanceUpdate()
        }
    }
    override var preferredStatusBarStyle: UIStatusBarStyle { darkChrome ? .lightContent : .darkContent }

    private var pageReady = false

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: AppSchemeHandler.startURL))
        NotificationCenter.default.addObserver(forName: .wnScan, object: nil, queue: .main) { [weak self] _ in self?.runPendingScan() }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false   // 10.21: no pinch-to-zoom
        pageReady = true
        runPendingScan()
    }

    // The home-screen shortcut: open the scanner on the Workshop page (from the Checklist it switches pages first).
    private func runPendingScan() {
        guard pageReady else { return }
        if let hash = Shortcuts.pendingHash {                 // NFC tag / link: go to the scanner, a drawer, or home
            Shortcuts.pendingHash = nil
            Shortcuts.pendingScan = false
            let h = hash.replacingOccurrences(of: "'", with: "")
            webView.evaluateJavaScript("(function(h){ if (/workshop\\.html$/.test(location.pathname)) { if (location.hash === h) location.hash = '#/'; location.hash = h; } else location.href = 'workshop.html' + h; })('\(h)')", completionHandler: nil)
            return
        }
        guard Shortcuts.pendingScan else { return }
        Shortcuts.pendingScan = false
        webView.evaluateJavaScript("window.WNScan ? window.WNScan() : (location.href = 'workshop.html#scan')", completionHandler: nil)
    }

    // App pages stay in the app; other websites open in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }   // "Download backup", "Export CSV"
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.cancel)
            return
        }
        if scheme == AppSchemeHandler.scheme || scheme == "about" || scheme == "blob" || scheme == "data" {
            decisionHandler(.allow)
            return
        }
        if navigationAction.targetFrame != nil && navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)   // frames inside a page
            return
        }
        if ["http", "https", "mailto", "tel"].contains(scheme) { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }

    // Links that ask for a new window open in Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if url.scheme == AppSchemeHandler.scheme { webView.load(navigationAction.request) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    // Files the pages hand out (backup .json, .csv): saved to a temporary file, then the share sheet (Save to Files, AirDrop…).
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(suggestedFilename)
        try? FileManager.default.removeItem(at: url)
        downloadURL = url
        completionHandler(url)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloadURL else { return }
        downloadURL = nil
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = view
        presentWhenReady(share) {}
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) { downloadURL = nil }

    // The screen on top (an alert, the scanner, the share sheet…), so nothing is presented on a busy screen.
    func topPresenter() -> UIViewController {
        var vc: UIViewController = self
        while let p = vc.presentedViewController, !p.isBeingDismissed { vc = p }
        return vc
    }

    // Shows a screen from the topmost one. If another screen is still opening or closing, waits for it (up to 3 s);
    // if it still can't show, calls `fallback` so the page is never left waiting.
    private func presentWhenReady(_ vc: UIViewController, tries: Int = 0, orElse fallback: @escaping () -> Void) {
        let top = topPresenter()
        if top.presentedViewController != nil || top.isBeingPresented || top.transitionCoordinator != nil {
            guard tries < 10 else { fallback(); return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.presentWhenReady(vc, tries: tries + 1, orElse: fallback) }
            return
        }
        guard top.viewIfLoaded?.window != nil else { fallback(); return }
        top.present(vc, animated: true)
    }

    private func show(_ alert: UIAlertController, orElse fallback: @escaping () -> Void) {
        presentWhenReady(alert, orElse: fallback)
    }

    // alert() / confirm() / prompt() from the pages.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        show(alert) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        show(alert) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text) })
        show(alert) { completionHandler(nil) }
    }

    // If iOS stops the page in the background, bring it back.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

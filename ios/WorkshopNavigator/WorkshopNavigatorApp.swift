// Workshop Navigator for iPhone.
// The Workshop and Checklist pages are bundled inside the app (folder "www") and shown in a web view.
// Native pieces the web page can't do on iPhone: print straight to a Zebra printer over the network (port 9100)
// or Bluetooth LE, AirPrint labels at exact size, and scan drawer labels (Data Matrix / QR) with the camera.
import SwiftUI

@main
struct WorkshopNavigatorApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    var body: some Scene {
        WindowGroup {
            WebContainer()
                .ignoresSafeArea()
                .background(Color(red: 0.09, green: 0.227, blue: 0.361))
        }
    }
}

struct WebContainer: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebViewController { WebViewController() }
    func updateUIViewController(_ controller: WebViewController, context: Context) {}
}

extension Bundle {
    var appVersion: String { (infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0" }
}

// Long-press the app icon → "Scan a drawer": opens the camera straight away (cold start or already running).
enum Shortcuts {
    static var pendingScan = false
    static var pendingHash: String?          // from a universal link (an NFC tag): "#scan", "#loc=A1-D02" or "#/"
    static func handle(_ item: UIApplicationShortcutItem) {
        guard item.type.hasSuffix(".scan") else { return }
        pendingScan = true
        NotificationCenter.default.post(name: .wnScan, object: nil)
    }
    // NFC tag / link: https://edpuello.github.io/workshop-navigator/app/?go=scan · ?loc=A1-D02 · (nothing) = home
    static func handle(link url: URL) {
        guard url.path.hasPrefix("/workshop-navigator/app") else { return }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func value(_ k: String) -> String? { items.first(where: { $0.name == k })?.value }
        let safe = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_."))
        if let loc = value("loc"), !loc.isEmpty { pendingHash = "#loc=" + (loc.addingPercentEncoding(withAllowedCharacters: safe) ?? "") }
        else if value("go") == "scan" { pendingHash = "#scan" }
        else { pendingHash = "#/" }
        NotificationCenter.default.post(name: .wnScan, object: nil)
    }
}
extension Notification.Name { static let wnScan = Notification.Name("wn.scan") }

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        if let item = options.shortcutItem { Shortcuts.handle(item) }
        for activity in options.userActivities where activity.activityType == NSUserActivityTypeBrowsingWeb {
            if let url = activity.webpageURL { Shortcuts.handle(link: url) }      // app opened by an NFC tag / link
        }
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = ShortcutSceneDelegate.self
        return config
    }
}

final class ShortcutSceneDelegate: NSObject, UIWindowSceneDelegate {
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        Shortcuts.handle(shortcutItem)
        completionHandler(true)
    }

    // An NFC tag or link while the app is already running
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL else { return }
        Shortcuts.handle(link: url)
    }
}

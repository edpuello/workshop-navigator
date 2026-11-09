// The pages call native features with:
//   const result = await window.webkit.messageHandlers.wn.postMessage({ cmd: 'printers', … })
// Each command answers with a value, or fails with a plain-English message the page can show.
//   info                                → { platform, version }
//   printers  { seconds, bluetooth }    → [{ id, kind: 'net'|'ble', name, model, conn, likely }]
//   addNetwork { host }                 → { id, kind, name, model, conn }        (checks the printer answers on port 9100)
//   forget    { id }                    → true
//   send      { id, data }              → true                                   (data = ZPL text)
//   status    { id }                    → { text, model? }                       (printer's ~HQES answer, or "connected" + model over Bluetooth)
//   airprint  { pages:[png base64], w, h, sheet } → true if printed              (w, h in inches)
//   scan                                → the text in the code, or null if cancelled
import UIKit
import WebKit
import LocalAuthentication
import AuthenticationServices
import UserNotifications

struct BridgeError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var webView: WKWebView?
    weak var presenter: WebViewController?
    private let network = ZebraNetwork()
    private lazy var bluetooth = ZebraBLE()   // created on first use, so iOS asks for Bluetooth only when needed
    private let airPrinter = AirPrinter()

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else {
            replyHandler(nil, "Unknown request")
            return
        }
        Task { @MainActor in
            do {
                let value = try await self.handle(cmd, body)
                replyHandler(value ?? NSNull(), nil)
            } catch {
                replyHandler(nil, (error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }

    @MainActor
    private func handle(_ cmd: String, _ b: [String: Any]) async throws -> Any? {
        switch cmd {
        case "chrome":   // 10.21: the page's theme (Light / Dark) → status bar + background
            presenter?.darkChrome = (b["dark"] as? Bool) ?? false
            return nil

        case "unlock":   // 10.21: Face ID lock — Face ID, or the phone's passcode if Face ID fails / isn't set up
            let ctx = LAContext()
            ctx.localizedFallbackTitle = "Use Passcode"
            var err: NSError?
            guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else { throw BridgeError("no-lock") }
            do {
                return try await ctx.evaluatePolicy(.deviceOwnerAuthentication,
                                                    localizedReason: (b["reason"] as? String) ?? "Unlock Workshop Navigator")
            } catch let e as LAError {
                switch e.code {
                case .userCancel, .appCancel, .systemCancel, .userFallback: return false
                default: throw BridgeError(e.localizedDescription)
                }
            }

        case "oauth":   // 10.21: Continue with Google — opens Apple's secure sign-in sheet; returns the address it came back to (nil = cancelled)
            guard let s = b["url"] as? String, let url = URL(string: s) else { throw BridgeError("No sign-in address") }
            return try await WebAuth.shared.start(url: url, scheme: (b["scheme"] as? String) ?? "workshopnavigator",
                                                  window: presenter?.view.window)

        case "haptic":   // 10.21: a small tap felt in the hand (picking up a part to drag it)
            let g = UIImpactFeedbackGenerator(style: (b["style"] as? String) == "light" ? .light : .medium)
            g.impactOccurred()
            return true

        case "notifyAsk":   // 10.21: ask to show notifications on this iPhone (true = allowed)
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional { return true }
            if settings.authorizationStatus == .denied { return false }
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])

        case "notify":      // show a notification now (a banner, even while the app is open)
            let content = UNMutableNotificationContent()
            content.title = (b["title"] as? String) ?? "Workshop Navigator"
            content.body = (b["body"] as? String) ?? ""
            content.sound = .default
            if let id = b["thread"] as? String { content.threadIdentifier = id }
            try await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
            return true

        case "credSave":   // 10.21: keep your login in the Keychain, readable only after Face ID / passcode
            guard let email = b["email"] as? String, let pw = b["password"] as? String, !email.isEmpty, !pw.isEmpty else { throw BridgeError("Nothing to save") }
            try LoginKeychain.save(email: email, password: pw)
            return true

        case "credLoad":   // Face ID → your saved login (false = cancelled, null = nothing saved yet)
            return try await LoginKeychain.load(reason: (b["reason"] as? String) ?? "Log in to Workshop Navigator")

        case "credForget":
            LoginKeychain.forget()
            return true

        case "biometry":   // what this phone has: faceid / touchid / none
            let ctx = LAContext()
            var err: NSError?
            let ok = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err)
            return ["kind": !ok ? "none" : ctx.biometryType == .faceID ? "faceid" : ctx.biometryType == .touchID ? "touchid" : "other"]

        case "info":
            return ["platform": "ios", "version": Bundle.main.appVersion]

        case "printers":
            let seconds = (b["seconds"] as? Double) ?? 3
            async let onNetwork = network.discover(seconds: seconds)   // network and Bluetooth at the same time
            let overBluetooth = ((b["bluetooth"] as? Bool) ?? true) ? await bluetooth.discover(seconds: seconds + 1) : []
            return await onNetwork + overBluetooth

        case "addNetwork":
            guard let host = (b["host"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !host.isEmpty else {
                throw BridgeError("Type the printer’s IP address, like 192.168.1.40")
            }
            return try await network.add(host: host)

        case "forget":
            let id = (b["id"] as? String) ?? ""
            network.forget(id: id)
            if id.hasPrefix("ble:") { bluetooth.forget(id: id) }
            return true

        case "send":
            guard let id = b["id"] as? String, let text = b["data"] as? String else { throw BridgeError("Nothing to print") }
            let data = Data(text.utf8)
            if id.hasPrefix("net:") { try await network.send(id: id, data: data) }
            else if id.hasPrefix("ble:") { try await bluetooth.send(id: id, data: data) }
            else { throw BridgeError("That printer isn’t one the app can reach") }
            return true

        case "status":
            guard let id = b["id"] as? String else { throw BridgeError("No printer picked") }
            if id.hasPrefix("net:") { return ["text": try await network.status(id: id)] }
            if id.hasPrefix("ble:") { return try await bluetooth.status(id: id) }
            throw BridgeError("That printer isn’t one the app can reach")

        case "airprint":
            let pages = (b["pages"] as? [String]) ?? []
            let w = (b["w"] as? Double) ?? 1.5, h = (b["h"] as? Double) ?? 0.5
            return try await airPrinter.print(pages: pages, widthIn: w, heightIn: h, sheet: (b["sheet"] as? Bool) ?? false)

        case "scan":
            guard let presenter else { throw BridgeError("The camera isn’t available right now") }
            return try await CodeScanner.scan(from: presenter.topPresenter())

        default:
            throw BridgeError("Unknown request: \(cmd)")
        }
    }
}


// 10.21: the saved login for the Face ID button. Stored on this iPhone only (never synced), and the Keychain hands it back only after
// Face ID or the phone's passcode says it's you.
enum LoginKeychain {
    private static let service = "com.edpuello.workshopnavigator.login"
    private static let account = "owner"

    static func save(email: String, password: String) throws {
        forget()
        var cfErr: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .userPresence, &cfErr) else {
            throw BridgeError("This iPhone needs a passcode to save your login for Face ID")
        }
        let data = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: account, kSecAttrAccessControl as String: access, kSecValueData as String: data]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw BridgeError("Couldn’t save your login for Face ID (\(status))") }
    }

    /// Asks for Face ID (or the passcode), then reads the login. false = cancelled, nil = nothing saved.
    static func load(reason: String) async throws -> Any? {
        guard exists() else { return nil }
        let ctx = LAContext()
        ctx.localizedFallbackTitle = "Use Passcode"
        do { _ = try await ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) }
        catch let e as LAError {
            switch e.code {
            case .userCancel, .appCancel, .systemCancel, .userFallback: return false
            case .passcodeNotSet, .biometryNotEnrolled, .biometryNotAvailable: throw BridgeError("no-lock")
            default: throw BridgeError(e.localizedDescription)
            }
        }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: account, kSecReturnData as String: true,
                                    kSecMatchLimit as String: kSecMatchLimitOne, kSecUseAuthenticationContext as String: ctx]
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        if status == errSecItemNotFound { return nil }
        if status == errSecUserCanceled { return false }
        guard status == errSecSuccess, let data = out as? Data,
              let login = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            throw BridgeError("Couldn’t read your saved login (\(status))")
        }
        return login
    }

    /// Is a login saved? (Checks without asking for Face ID.)
    static func exists() -> Bool {
        let ctx = LAContext()
        ctx.interactionNotAllowed = true
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: account, kSecUseAuthenticationContext as String: ctx]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }

    static func forget() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
    }
}


// 10.21: the sign-in sheet for Google (ASWebAuthenticationSession). Google blocks its sign-in inside an app's own web view,
// so it opens in Apple's secure sheet and comes back to workshopnavigator://login-callback with the sign-in.
final class WebAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuth()
    private var session: ASWebAuthenticationSession?
    private weak var window: UIWindow?

    @MainActor
    func start(url: URL, scheme: String, window: UIWindow?) async throws -> String? {
        self.window = window
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String?, Error>) in
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callback, error in
                self?.session = nil
                if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin { cont.resume(returning: nil); return }
                if let error { cont.resume(throwing: error); return }
                cont.resume(returning: callback?.absoluteString)
            }
            s.presentationContextProvider = self
            s.prefersEphemeralWebBrowserSession = false
            self.session = s
            if !s.start() { self.session = nil; cont.resume(throwing: BridgeError("Couldn’t open the Google sign-in")) }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        window ?? ASPresentationAnchor()
    }
}


// 10.21: show the app's notifications as banners even while it's open
final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationPresenter()
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }
}

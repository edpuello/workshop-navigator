// The pages call native features with:
//   const result = await window.webkit.messageHandlers.wn.postMessage({ cmd: 'printers', … })
// Each command answers with a value, or fails with a plain-English message the page can show.
//   info                                → { platform, version }
//   printers  { seconds, bluetooth }    → [{ id, kind: 'net'|'ble', name, model, conn, likely }]
//   addNetwork { host }                 → { id, kind, name, model, conn }        (checks the printer answers on port 9100)
//   forget    { id }                    → true
//   send      { id, data }              → true                                   (data = ZPL text)
//   status    { id }                    → { text }                               (printer's ~HQES answer, or "connected")
//   airprint  { pages:[png base64], w, h, sheet } → true if printed              (w, h in inches)
//   scan                                → the text in the code, or null if cancelled
import UIKit
import WebKit

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
            if id.hasPrefix("ble:") { return ["text": try await bluetooth.status(id: id)] }
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

// Workshop Navigator for iPhone.
// The Workshop and Checklist pages are bundled inside the app (folder "www") and shown in a web view.
// Native pieces the web page can't do on iPhone: print straight to a Zebra printer over the network (port 9100)
// or Bluetooth LE, AirPrint labels at exact size, and scan drawer labels (Data Matrix / QR) with the camera.
import SwiftUI

@main
struct WorkshopNavigatorApp: App {
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

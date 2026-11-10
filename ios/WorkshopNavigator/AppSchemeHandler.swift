// Serves the bundled web files at wn://workshop/… so the pages have a fixed origin (their saved list and
// sign-in stay put between launches) and everything works with no internet connection.
import Foundation
import UniformTypeIdentifiers
import WebKit

final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "wn"
    static let host = "workshop"
    static let startURL = URL(string: "wn://workshop/workshop.html")!

    private let root: URL = {
        let base = Bundle.main.resourceURL ?? Bundle.main.bundleURL
        return base.appendingPathComponent("www", isDirectory: true).standardizedFileURL
    }()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/workshop.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL

        // Only files inside www/ are served.
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            respond(urlSchemeTask, url: url, status: 404, mime: "text/plain; charset=utf-8", data: Data("Not found".utf8))
            return
        }
        var mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        if file.pathExtension == "js" { mime = "text/javascript" }
        if file.pathExtension == "webmanifest" || file.lastPathComponent == "manifest.json" { mime = "application/manifest+json" }
        if mime.hasPrefix("text/") || mime.hasSuffix("json") || mime.hasSuffix("xml") { mime += "; charset=utf-8" }
        respond(urlSchemeTask, url: url, status: 200, mime: mime, data: data)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, mime: String, data: Data) {
        let headers = ["Content-Type": mime, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }
}

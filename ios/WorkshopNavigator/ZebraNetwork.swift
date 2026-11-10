// Zebra printers on the network (Ethernet or Wi-Fi): labels go as ZPL to the printer's raw port 9100.
// Found three ways, on iPhone and iPad alike:
//   1. a quick look over this device's own home network (Wi-Fi or Ethernet) for anything taking labels on
//      port 9100. Only printers whose built-in web page says Zebra are asked for their name, so other printers
//      never get stray text to print;
//   2. Bonjour ("_pdl-datastream._tcp", which Zebra Link-OS printers announce);
//   3. IP addresses typed in once and remembered.
// iOS asks for Local Network permission the first time.
import Foundation
import Network

final class ZebraNetwork {
    static let bonjourType = "_pdl-datastream._tcp"
    private let savedKey = "wn.net.printers"    // [id: [name, model]]

    private var saved: [String: [String]] {
        get { (UserDefaults.standard.dictionary(forKey: savedKey) as? [String: [String]]) ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: savedKey) }
    }

    // ---------- finding printers
    @MainActor
    func discover(seconds: Double) async -> [[String: Any]] {
        var out: [[String: Any]] = saved.map { id, v in
            ["id": id, "kind": "net", "name": v.first ?? id, "model": v.count > 1 ? v[1] : "", "conn": "Network", "likely": true]
        }
        async let viaBonjour = browse(seconds: min(max(seconds, 1), 8))
        async let viaScan = scanForPrinters(seconds: min(max(seconds, 2), 8))
        for f in await viaScan {
            let id = "net:ip:" + f.host
            if out.contains(where: { ($0["id"] as? String) == id }) { continue }
            out.append(["id": id, "kind": "net", "name": f.name, "model": f.model == f.name ? "" : f.model,
                        "conn": "Network · \(f.host)", "likely": f.zebra])
        }
        for name in await viaBonjour {
            let id = "net:bj:" + name
            // the same printer found by the network look-around is listed once (by its address)
            if out.contains(where: { ($0["id"] as? String) == id || (($0["name"] as? String) ?? "").caseInsensitiveCompare(name) == .orderedSame }) { continue }
            out.append(["id": id, "kind": "net", "name": name, "model": "", "conn": "Network", "likely": true])
        }
        return out
    }

    // ---------- looking over the home network
    private struct NetFound: Sendable { let host: String; let name: String; let model: String; let zebra: Bool }
    private static let askNames = "! U1 getvar \"device.product_name\"\r\n! U1 getvar \"device.friendly_name\"\r\n"

    // The printer answers getvar with quoted values: model first, then its friendly name.
    private static func parseNames(_ reply: Data) -> (model: String, name: String) {
        let quoted = String(decoding: reply, as: UTF8.self).components(separatedBy: "\"").enumerated()
            .filter { $0.offset % 2 == 1 }.map { $0.element.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty && $0 != "?" }
        return (quoted.first ?? "", quoted.count > 1 ? quoted[1] : "")
    }

    @MainActor
    private func scanForPrinters(seconds: Double) async -> [NetFound] {
        let open = await hostsTakingLabels(seconds: seconds)
        guard !open.isEmpty else { return [] }
        return await withTaskGroup(of: NetFound.self) { group in
            for host in open { group.addTask { await self.describe(host: host) } }
            var list: [NetFound] = []
            for await f in group { list.append(f) }
            return list.sorted { ($0.zebra ? 0 : 1, $0.name) < ($1.zebra ? 0 : 1, $1.name) }
        }
    }

    @MainActor
    private func describe(host: String) async -> NetFound {
        let zebra = await webPageSaysZebra(host: host)
        var model = "", name = ""
        if zebra, let reply = try? await exchange(.hostPort(host: NWEndpoint.Host(host), port: 9100), send: Data(Self.askNames.utf8), listen: 1.2) {
            (model, name) = Self.parseNames(reply)
        }
        if name.isEmpty { name = model.isEmpty ? (zebra ? "Zebra printer" : "Printer") + " at \(host)" : model }
        return NetFound(host: host, name: name, model: model, zebra: zebra)
    }

    // Zebra printers serve a small status web page that names Zebra. Reading it never prints anything.
    private func webPageSaysZebra(host: String) async -> Bool {
        guard let url = URL(string: "http://\(host)/") else { return false }
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 2.5)
        guard let (data, response) = try? await URLSession.shared.data(for: request) else { return false }
        let server = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Server") ?? ""
        let text = server + " " + String(decoding: data.prefix(32_000), as: UTF8.self)
        return text.range(of: "zebra", options: .caseInsensitive) != nil
            || text.range(of: #"\bZ[DTQ]\d{3}"#, options: .regularExpression) != nil
    }

    // Every address on this device's own network(s) (the /24 around each Wi-Fi or Ethernet address) that
    // accepts a connection on port 9100. Tried 64 at a time; nothing is sent.
    @MainActor
    private func hostsTakingLabels(seconds: Double) async -> [String] {
        var hosts: [String] = []
        for net in Self.localNetworks() {
            for i in 1...254 where UInt8(i) != net.own { hosts.append("\(net.prefix).\(i)") }
        }
        guard !hosts.isEmpty else { return [] }
        hosts = Array(hosts.prefix(254 * 3))
        let batch = 64
        let rounds = (hosts.count + batch - 1) / batch
        let wait = min(1.5, max(0.6, seconds / Double(rounds)))
        var open: [String] = []
        var start = 0
        while start < hosts.count {
            open += await tryPort9100(Array(hosts[start..<min(start + batch, hosts.count)]), wait: wait)
            start += batch
        }
        return open
    }

    @MainActor
    private func tryPort9100(_ hosts: [String], wait: Double) async -> [String] {
        final class Box: @unchecked Sendable { var open: [String] = []; var conns: [NWConnection] = [] }
        let box = Box()
        for host in hosts {
            let c = NWConnection(host: NWEndpoint.Host(host), port: 9100, using: .tcp)
            c.stateUpdateHandler = { [weak c] state in
                switch state {
                case .ready: box.open.append(host); c?.cancel()
                case .failed: c?.cancel()
                default: break
                }
            }
            box.conns.append(c)
            c.start(queue: .main)
        }
        try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
        for c in box.conns { c.stateUpdateHandler = nil; c.cancel() }
        return box.open
    }

    // This device's IPv4 networks on Wi-Fi or Ethernet (not cellular or VPN): "192.168.1" and its own last number.
    private static func localNetworks() -> [(prefix: String, own: UInt8)] {
        var out: [(prefix: String, own: UInt8)] = []
        var list: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&list) == 0, let first = list else { return [] }
        defer { freeifaddrs(list) }
        var next: UnsafeMutablePointer<ifaddrs>? = first
        while let cur = next {
            next = cur.pointee.ifa_next
            let flags = Int32(bitPattern: cur.pointee.ifa_flags)
            guard (flags & IFF_UP) != 0, (flags & IFF_RUNNING) != 0, (flags & IFF_LOOPBACK) == 0,
                  let sa = cur.pointee.ifa_addr, sa.pointee.sa_family == UInt8(AF_INET) else { continue }
            let ifName = String(cString: cur.pointee.ifa_name)
            guard ifName.hasPrefix("en") || ifName.hasPrefix("bridge") else { continue }
            let raw = sa.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee.sin_addr.s_addr }
            let b = withUnsafeBytes(of: raw) { Array($0) }   // network order: b[0] is the first number
            guard b.count == 4, !(b[0] == 169 && b[1] == 254) else { continue }   // skip "no network yet" addresses
            let prefix = "\(b[0]).\(b[1]).\(b[2])"
            if !out.contains(where: { $0.prefix == prefix }) { out.append((prefix, b[3])) }
        }
        return out
    }

    // Bonjour look-around. The results are kept in a small object (not a captured var) so it's safe with
    // Network's concurrent callbacks; everything runs on the main queue.
    @MainActor
    private func browse(seconds: Double) async -> [String] {
        final class Found: @unchecked Sendable { var names = Set<String>() }
        let found = Found()
        let browser = NWBrowser(for: .bonjour(type: Self.bonjourType, domain: nil), using: .tcp)
        browser.browseResultsChangedHandler = { results, _ in
            for r in results { if case let .service(name, _, _, _) = r.endpoint { found.names.insert(name) } }
        }
        browser.start(queue: .main)
        try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        browser.cancel()
        return found.names.sorted()
    }

    // A printer typed in by IP address: check it answers, ask its name, remember it.
    @MainActor
    func add(host: String) async throws -> [String: Any] {
        guard Self.isLocal(host) else { throw BridgeError("That isn’t an address on your own network — it looks like 192.168.1.40") }
        let id = "net:ip:" + host
        let reply = try await exchange(endpoint(for: id)!, send: Data(Self.askNames.utf8), listen: 1.5)
        let parsed = Self.parseNames(reply)
        let model = parsed.model
        let name = parsed.name.isEmpty ? host : parsed.name
        var s = saved
        s[id] = [name, model]
        saved = s
        return ["id": id, "kind": "net", "name": name, "model": model == name ? "" : model, "conn": "Network · \(host)", "likely": true]
    }

    func forget(id: String) {
        var s = saved
        s.removeValue(forKey: id)
        saved = s
    }

    // ---------- printing
    @MainActor
    func send(id: String, data: Data) async throws {
        guard let ep = endpoint(for: id) else { throw BridgeError("Unknown network printer") }
        _ = try await exchange(ep, send: data, listen: 0)
    }

    // The printer's own status line (~HQES): the page reads paper-out, head-open and paused from it.
    @MainActor
    func status(id: String) async throws -> String {
        guard let ep = endpoint(for: id) else { throw BridgeError("Unknown network printer") }
        let reply = try await exchange(ep, send: Data("~HQES\r\n".utf8), listen: 1.5)
        return String(decoding: reply, as: UTF8.self)
    }

    // 10.21_4 security: printers are only ever on your own network — private and link-local addresses or .local names.
    // Nothing can make the app send data to an address on the internet.
    static func isLocal(_ host: String) -> Bool {
        if let v4 = IPv4Address(host) {
            let b = [UInt8](v4.rawValue)
            return b[0] == 10 || (b[0] == 172 && (16...31).contains(b[1])) || (b[0] == 192 && b[1] == 168) || (b[0] == 169 && b[1] == 254)
        }
        if let v6 = IPv6Address(host) {
            let b = [UInt8](v6.rawValue)
            return (b[0] & 0xfe) == 0xfc || (b[0] == 0xfe && (b[1] & 0xc0) == 0x80)
        }
        let h = host.lowercased()
        return h.hasSuffix(".local") && h.count > 6 && h.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "." }
    }

    private func endpoint(for id: String) -> NWEndpoint? {
        if id.hasPrefix("net:ip:") {
            let host = String(id.dropFirst("net:ip:".count))
            guard Self.isLocal(host) else { return nil }
            return .hostPort(host: NWEndpoint.Host(host), port: 9100)
        }
        if id.hasPrefix("net:bj:") {
            return .service(name: String(id.dropFirst("net:bj:".count)), type: Self.bonjourType, domain: "local.", interface: nil)
        }
        return nil
    }

    // Connect, send, optionally listen for an answer, close. Waits up to 15 s for the connection
    // (the first time, iOS shows the Local Network question while it waits).
    @MainActor
    private func exchange(_ endpoint: NWEndpoint, send data: Data, listen: Double) async throws -> Data {
        let x = TCPExchange(endpoint)
        let typedAddress: Bool = { if case .hostPort = endpoint { return true } else { return false } }()
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Data, Error>) in
            x.cont = cont
            x.conn.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    x.conn.send(content: data, completion: .contentProcessed { error in
                        if let error { x.finish(.failure(error)); return }
                        if listen > 0 {
                            x.receive()
                            DispatchQueue.main.asyncAfter(deadline: .now() + listen) { x.finish(.success(x.buffer)) }
                        } else {
                            // give the printer a moment to take the last bytes before closing
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { x.finish(.success(Data())) }
                        }
                    })
                case .failed(let error):
                    x.finish(.failure(BridgeError("Couldn’t reach the printer (\(error.localizedDescription)). Is it on and on the same network?")))
                case .waiting(let error):
                    // a typed address that definitely isn't a printer: say so now. Anything else (the first Local Network
                    // question, still trying) waits for the 15 s limit, so tapping Allow still works.
                    guard typedAddress else { break }
                    if case .posix(let code) = error, code == .ECONNREFUSED || code == .EHOSTDOWN || code == .EHOSTUNREACH {
                        x.finish(.failure(BridgeError("Couldn’t reach the printer at that address (\(error.localizedDescription)). Check the IP and that it’s on the same network.")))
                    }
                default:
                    break
                }
            }
            x.conn.start(queue: .main)
            DispatchQueue.main.asyncAfter(deadline: .now() + 15) {
                x.finish(.failure(BridgeError("The printer didn’t answer. Check it’s on, on the same network, and that Local Network is allowed for Workshop in Settings.")))
            }
        }
    }
}

// One send/receive with a printer. Only touched on the main queue.
private final class TCPExchange: @unchecked Sendable {
    let conn: NWConnection
    var buffer = Data()
    var cont: CheckedContinuation<Data, Error>?
    init(_ endpoint: NWEndpoint) { conn = NWConnection(to: endpoint, using: .tcp) }
    func finish(_ result: Result<Data, Error>) {
        guard let c = cont else { return }
        cont = nil
        conn.cancel()
        c.resume(with: result)
    }
    func receive() {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { chunk, _, isComplete, error in
            if let chunk { self.buffer.append(chunk) }
            // 10.21_4: a printer's answer is a few hundred bytes — stop at 64 KB whatever a device on the network sends
            if isComplete || error != nil || self.buffer.count >= 65_536 { self.finish(.success(self.buffer)) } else { self.receive() }
        }
    }
}

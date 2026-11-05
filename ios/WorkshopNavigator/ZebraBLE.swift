// Zebra printers over Bluetooth LE (ZD421 with the Bluetooth option). Uses Zebra's published "Parser" service:
//   service 38EB4A80-C570-11E3-9507-0002A5D5C51B · write to printer …4A82 · read from printer …4A81
// (Zebra app note "Bluetooth LE"). No pairing or Apple MFi setup needed. Labels go as ZPL in small chunks.
import CoreBluetooth
import Foundation

final class ZebraBLE: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    static let parserService = CBUUID(string: "38EB4A80-C570-11E3-9507-0002A5D5C51B")
    static let toPrinter = CBUUID(string: "38EB4A82-C570-11E3-9507-0002A5D5C51B")
    static let fromPrinter = CBUUID(string: "38EB4A81-C570-11E3-9507-0002A5D5C51B")
    static let zebraMember = CBUUID(string: "FE79")   // Zebra's Bluetooth SIG member ID, seen in some adverts

    private let savedKey = "wn.ble.printers"   // [uuid: name]
    private var central: CBCentralManager!
    private var seen: [UUID: (peripheral: CBPeripheral, name: String, likely: Bool)] = [:]
    private var stateWaiters: [CheckedContinuation<Void, Error>] = []
    // One Bluetooth step at a time waits here (connect, find service, find channel, write a chunk).
    private var pending: (token: Int, cont: CheckedContinuation<Void, Error>)?
    private var nextToken = 0
    private var connected: CBPeripheral?
    private var target: UUID?            // the printer being connected right now
    private var connecting: UUID?        // set for the whole connect sequence (several Bluetooth steps)
    private var writeChar: CBCharacteristic?
    private var idleTimer: Timer?

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main)
    }

    private var saved: [String: String] {
        get { (UserDefaults.standard.dictionary(forKey: savedKey) as? [String: String]) ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: savedKey) }
    }

    // ---------- Bluetooth on?
    @MainActor
    private func ready() async throws {
        switch central.state {
        case .poweredOn: return
        case .unauthorized: throw BridgeError("Bluetooth is off for Workshop. Turn it on in Settings → Workshop → Bluetooth.")
        case .poweredOff: throw BridgeError("Bluetooth is turned off on this device.")
        case .unsupported: throw BridgeError("This device has no Bluetooth LE.")
        default:
            try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in stateWaiters.append(c) }
        }
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state != .unknown && central.state != .resetting else { return }
        let waiters = stateWaiters
        stateWaiters = []
        for w in waiters {
            if central.state == .poweredOn { w.resume() }
            else {
                let msg: String
                switch central.state {
                case .unauthorized: msg = "Bluetooth is off for Workshop. Turn it on in Settings → Workshop → Bluetooth."
                case .unsupported: msg = "This device has no Bluetooth LE."
                default: msg = "Bluetooth is turned off on this device."
                }
                w.resume(throwing: BridgeError(msg))
            }
        }
    }

    // ---------- finding printers
    @MainActor
    func discover(seconds: Double) async -> [[String: Any]] {
        do { try await ready() } catch { return [] }
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        try? await Task.sleep(nanoseconds: UInt64(min(max(seconds, 2), 10) * 1_000_000_000))
        central.stopScan()
        let names = saved
        // Saved printers that weren't seen this time are still listed (they may be asleep).
        for (key, name) in names {
            guard let uuid = UUID(uuidString: key), seen[uuid] == nil,
                  let p = central.retrievePeripherals(withIdentifiers: [uuid]).first else { continue }
            seen[uuid] = (p, name, true)
        }
        let likely = seen.values.filter { $0.likely }
        let list = likely.isEmpty ? Array(seen.values) : likely   // nothing looks like a Zebra → show what was found
        return list.sorted { $0.name < $1.name }.map { item in
            ["id": "ble:" + item.peripheral.identifier.uuidString, "kind": "ble", "name": item.name, "model": "",
             "conn": "Bluetooth LE", "likely": item.likely]
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? peripheral.name ?? ""
        guard !name.isEmpty else { return }
        let services = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID]) ?? []
        // Zebra printers advertise their serial number or a ZD/ZQ/ZT model name.
        let looksZebra = services.contains(Self.parserService) || services.contains(Self.zebraMember)
            || name.range(of: #"^(z[dqtg]\d|zebra|xx|[a-z0-9]{3}\d{8,})"#, options: [.regularExpression, .caseInsensitive]) != nil
        seen[peripheral.identifier] = (peripheral, name, looksZebra || saved[peripheral.identifier.uuidString] != nil)
    }

    func forget(id: String) {
        var s = saved
        s.removeValue(forKey: String(id.dropFirst("ble:".count)))
        saved = s
    }

    // ---------- connecting
    @MainActor
    private func connect(id: String) async throws -> (CBPeripheral, CBCharacteristic) {
        try await ready()
        guard let uuid = UUID(uuidString: String(id.dropFirst("ble:".count))) else { throw BridgeError("Unknown Bluetooth printer") }
        if let p = connected, p.identifier == uuid, p.state == .connected, let c = writeChar { return (p, c) }
        // already connecting to this printer (the Labels screen warms it up): wait for that instead of failing as busy
        var waited = 0.0
        while connecting == uuid && waited < 25 {
            try? await Task.sleep(nanoseconds: 100_000_000); waited += 0.1
        }
        if let p = connected, p.identifier == uuid, p.state == .connected, let c = writeChar { return (p, c) }
        // another job is still connecting or writing: refuse before touching its connection
        guard pending == nil, connecting == nil else { throw BridgeError("The printer is busy with another job — try again in a moment.") }
        connecting = uuid
        defer { connecting = nil }
        if let old = connected, old.identifier != uuid { central.cancelPeripheralConnection(old) }
        guard let p = seen[uuid]?.peripheral ?? central.retrievePeripherals(withIdentifiers: [uuid]).first else {
            throw BridgeError("That printer isn’t nearby. Tap Look again with the printer on.")
        }
        p.delegate = self
        target = uuid
        do {
            try await waitFor(10, "The printer didn’t connect over Bluetooth. Is it on and close by?") { self.central.connect(p, options: nil) }
            try await waitFor(8, "Connected, but this doesn’t look like a Zebra printer.") { p.discoverServices([Self.parserService]) }
            guard let service = p.services?.first(where: { $0.uuid == Self.parserService }) else {
                throw BridgeError("Connected, but this doesn’t look like a Zebra printer (no Zebra print service).")
            }
            try await waitFor(8, "The printer didn’t answer over Bluetooth.") { p.discoverCharacteristics([Self.toPrinter, Self.fromPrinter], for: service) }
            guard service.characteristics?.contains(where: { $0.uuid == Self.toPrinter }) == true else {
                throw BridgeError("The printer’s Bluetooth print channel is missing.")
            }
        } catch {
            central.cancelPeripheralConnection(p)
            target = nil
            throw error
        }
        guard let write = p.services?.first(where: { $0.uuid == Self.parserService })?.characteristics?.first(where: { $0.uuid == Self.toPrinter }) else {
            throw BridgeError("The printer’s Bluetooth print channel is missing.")
        }
        connected = p
        writeChar = write
        var s = saved
        s[uuid.uuidString] = seen[uuid]?.name ?? p.name ?? "Zebra printer"
        saved = s
        return (p, write)
    }

    // Starts one Bluetooth step and waits until its delegate callback arrives, or fails after `seconds`.
    // Each wait has its own token, so a late timeout can never cut off a later step.
    @MainActor
    private func waitFor(_ seconds: Double, _ timeoutMessage: String, _ start: @escaping () -> Void) async throws {
        guard pending == nil else { throw BridgeError("The printer is busy with another job — try again in a moment.") }
        nextToken += 1
        let token = nextToken
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
            pending = (token, c)
            start()
            DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { [weak self] in
                guard let self, self.pending?.token == token else { return }
                self.finishStep(BridgeError(timeoutMessage))
            }
        }
    }

    private func finishStep(_ error: Error?) {
        guard let p = pending else { return }
        pending = nil
        if let error { p.cont.resume(throwing: error) } else { p.cont.resume() }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard peripheral.identifier == target else { return }
        finishStep(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard peripheral.identifier == target else { return }
        finishStep(BridgeError("Couldn’t connect over Bluetooth: \(error?.localizedDescription ?? "unknown error")"))
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        if connected?.identifier == peripheral.identifier { connected = nil; writeChar = nil }
        if peripheral.identifier == target { finishStep(BridgeError("The printer disconnected.")) }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard peripheral.identifier == target else { return }
        finishStep(error)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard peripheral.identifier == target, service.uuid == Self.parserService else { return }
        finishStep(error)
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral.identifier == target, characteristic.uuid == Self.toPrinter else { return }
        finishStep(error.map { BridgeError("The printer stopped taking the label: \($0.localizedDescription)") })
    }

    // ---------- printing
    @MainActor
    func send(id: String, data: Data) async throws {
        let (p, write) = try await connect(id: id)
        idleTimer?.invalidate()
        defer { scheduleIdleDisconnect() }
        // one radio packet per chunk (iOS reports 512 for "with response" because it would split them itself)
        let size = max(20, min(512, p.maximumWriteValueLength(for: .withoutResponse)))
        var offset = 0
        if write.properties.contains(.writeWithoutResponse) {
            // Fast: stream the packets back to back, pausing only when iOS says its send queue is full.
            while offset < data.count {
                if !p.canSendWriteWithoutResponse {
                    try await waitFor(15, "The printer stopped taking the label over Bluetooth.") { }   // resumed by peripheralIsReady
                }
                let chunk = data.subdata(in: offset..<min(offset + size, data.count))
                p.writeValue(chunk, for: write, type: .withoutResponse)
                offset += chunk.count
            }
            return
        }
        // Printers that only take confirmed writes: one packet, wait for the OK, next packet.
        while offset < data.count {
            let chunk = data.subdata(in: offset..<min(offset + size, data.count))
            try await waitFor(15, "The printer stopped answering over Bluetooth.") { p.writeValue(chunk, for: write, type: .withResponse) }
            offset += chunk.count
        }
    }

    func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
        guard peripheral.identifier == target else { return }
        finishStep(nil)
    }

    // Stay connected for 3 minutes so the next labels go out right away, then let the printer go.
    private func scheduleIdleDisconnect() {
        idleTimer?.invalidate()
        idleTimer = Timer.scheduledTimer(withTimeInterval: 180, repeats: false) { [weak self] _ in
            guard let self, let p = self.connected else { return }
            self.central.cancelPeripheralConnection(p)
        }
    }

    @MainActor
    func status(id: String) async throws -> String {
        _ = try await connect(id: id)
        scheduleIdleDisconnect()
        return "connected"
    }
}

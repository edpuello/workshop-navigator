// Camera scanner for the drawer labels (Data Matrix) and QR codes. Returns the text inside the code.
import AVFoundation
import UIKit

enum CodeScanner {
    @MainActor
    static func scan(from presenter: UIViewController) async throws -> String? {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: break
        case .notDetermined:
            guard await AVCaptureDevice.requestAccess(for: .video) else { throw BridgeError("Camera is off for Workshop. Turn it on in Settings → Workshop → Camera.") }
        default:
            throw BridgeError("Camera is off for Workshop. Turn it on in Settings → Workshop → Camera.")
        }
        guard presenter.viewIfLoaded?.window != nil, presenter.presentedViewController == nil else {
            throw BridgeError("The camera isn’t available right now — close what’s open and try again.")
        }
        return await withCheckedContinuation { (cont: CheckedContinuation<String?, Never>) in
            let vc = ScannerViewController()
            vc.onResult = { [weak vc] text in
                if let host = vc?.presentingViewController { host.dismiss(animated: true) { cont.resume(returning: text) } }
                else { cont.resume(returning: text) }
            }
            vc.modalPresentationStyle = .fullScreen
            presenter.present(vc, animated: true)
        }
    }
}

final class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onResult: ((String?) -> Void)?
    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private var done = false
    private let frameView = UIView()
    private var pendingMessage: String?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        addControls()   // Cancel is there even if the camera can't start

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera), session.canAddInput(input) else {
            showMessage("No camera available")
            return
        }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { showMessage("The camera can’t read codes right now"); return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.dataMatrix, .qr].filter { output.availableMetadataObjectTypes.contains($0) }

        // Small labels: let the camera focus close and zoom in a little (as Apple suggests for small codes).
        if (try? camera.lockForConfiguration()) != nil {
            if camera.isAutoFocusRangeRestrictionSupported { camera.autoFocusRangeRestriction = .near }
            if camera.isFocusModeSupported(.continuousAutoFocus) { camera.focusMode = .continuousAutoFocus }
            let minFocusMM = Double(camera.minimumFocusDistance)
            if minFocusMM > 0 {
                // keep a 0.4-inch code filling the frame from just past the closest focus distance
                let zoom = min(max(minFocusMM / 100.0, 1.0), min(3.0, Double(camera.activeFormat.videoMaxZoomFactor)))
                camera.videoZoomFactor = CGFloat(zoom)
            }
            camera.unlockForConfiguration()
        }

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        view.layer.insertSublayer(layer, at: 0)
        preview = layer

        let s = session
        DispatchQueue.global(qos: .userInitiated).async { s.startRunning() }
    }

    private func addControls() {
        frameView.layer.borderColor = UIColor.white.cgColor
        frameView.layer.borderWidth = 3
        frameView.layer.cornerRadius = 14
        view.addSubview(frameView)

        let hint = UILabel()
        hint.text = "Point at a drawer label"
        hint.textColor = .white
        hint.font = .systemFont(ofSize: 17, weight: .semibold)
        hint.textAlignment = .center
        hint.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hint)

        var cfg = UIButton.Configuration.filled()
        cfg.title = "Cancel"
        cfg.baseBackgroundColor = UIColor(white: 1, alpha: 0.2)
        cfg.cornerStyle = .capsule
        let cancel = UIButton(configuration: cfg, primaryAction: UIAction { [weak self] _ in self?.finish(nil) })
        cancel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cancel)
        NSLayoutConstraint.activate([
            hint.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            hint.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            cancel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            cancel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard let text = pendingMessage else { return }
        pendingMessage = nil
        let alert = UIAlertController(title: nil, message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in self?.finish(nil) })
        present(alert, animated: true)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
        let side = min(view.bounds.width, view.bounds.height) * 0.62
        frameView.frame = CGRect(x: (view.bounds.width - side) / 2, y: (view.bounds.height - side) / 2, width: side, height: side)
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let text = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        finish(text)
    }

    private func finish(_ text: String?) {
        guard !done else { return }
        done = true
        let s = session
        DispatchQueue.global(qos: .userInitiated).async { s.stopRunning() }
        onResult?(text)
    }

    private func showMessage(_ text: String) { pendingMessage = text }   // shown in viewDidAppear
}

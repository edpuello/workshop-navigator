// AirPrint: the page sends each label as a 300-dpi picture; this makes a PDF at the exact label size
// (one label per page, for label printers) or a letter sheet of labels to cut out, and opens the iOS print panel.
import UIKit

final class AirPrinter: NSObject, UIPrintInteractionControllerDelegate {
    private var pageSize = CGSize(width: 108, height: 36)
    @MainActor
    func print(pages: [String], widthIn: Double, heightIn: Double, sheet: Bool) async throws -> Bool {
        let images = pages.compactMap { Data(base64Encoded: $0) }.compactMap { UIImage(data: $0) }
        guard !images.isEmpty else { throw BridgeError("Nothing to print") }
        guard UIPrintInteractionController.isPrintingAvailable else { throw BridgeError("AirPrint isn’t available on this device.") }
        let w = widthIn * 72, h = heightIn * 72   // PDF points
        pageSize = sheet ? CGSize(width: 612, height: 792) : CGSize(width: w, height: h)
        let pdf: Data

        if sheet {
            let page = CGRect(x: 0, y: 0, width: 612, height: 792), margin = 0.4 * 72, gap = 0.12 * 72
            let perRow = max(1, Int((page.width - 2 * margin + gap) / (w + gap)))
            let rows = max(1, Int((page.height - 2 * margin + gap) / (h + gap)))
            pdf = UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
                for (i, img) in images.enumerated() {
                    let k = i % (perRow * rows)
                    if k == 0 { ctx.beginPage() }
                    let x = margin + Double(k % perRow) * (w + gap), y = margin + Double(k / perRow) * (h + gap)
                    let box = CGRect(x: x, y: y, width: w, height: h)
                    ctx.cgContext.interpolationQuality = .none
                    img.draw(in: box)
                    ctx.cgContext.setStrokeColor(UIColor.lightGray.cgColor)
                    ctx.cgContext.setLineDash(phase: 0, lengths: [2, 2])
                    ctx.cgContext.setLineWidth(0.5)
                    ctx.cgContext.stroke(box)
                }
            }
        } else {
            let label = CGRect(x: 0, y: 0, width: w, height: h)
            pdf = UIGraphicsPDFRenderer(bounds: label).pdfData { ctx in
                for img in images {
                    ctx.beginPage(withBounds: label, pageInfo: [:])
                    ctx.cgContext.interpolationQuality = .none
                    img.draw(in: label)
                }
            }
        }

        let info = UIPrintInfo(dictionary: nil)
        info.jobName = "Workshop labels"
        info.outputType = .grayscale
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = pdf
        controller.delegate = self
        final class Once: @unchecked Sendable { var done = false }
        let once = Once()
        return await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            let shown = controller.present(animated: true) { _, completed, _ in
                guard !once.done else { return }
                once.done = true
                cont.resume(returning: completed)
            }
            if !shown && !once.done { once.done = true; cont.resume(returning: false) }   // panel couldn't open
        }
    }

    // Ask the printer for paper the size of the label (or letter for a sheet), so it isn't scaled.
    func printInteractionController(_ controller: UIPrintInteractionController, choosePaper paperList: [UIPrintPaper]) -> UIPrintPaper {
        UIPrintPaper.bestPaper(forPageSize: pageSize, withPapersFrom: paperList)
    }
}

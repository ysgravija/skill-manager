import AppKit
import Foundation

let size = 1024
guard CommandLine.arguments.count == 2 else {
    fatalError("Usage: swift scripts/render-icon.swift /path/to/icon.png")
}

guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("Could not create icon bitmap")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: size, height: size).fill()

let square = NSRect(x: 72, y: 72, width: 880, height: 880)
NSColor(calibratedRed: 0.11, green: 0.15, blue: 0.12, alpha: 1).setFill()
NSBezierPath(roundedRect: square, xRadius: 205, yRadius: 205).fill()

let letter = "S" as NSString
let font = NSFont(name: "Georgia-Bold", size: 610) ?? .systemFont(ofSize: 610, weight: .bold)
let attributes: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor(calibratedRed: 0.97, green: 0.98, blue: 0.95, alpha: 1)
]
let textSize = letter.size(withAttributes: attributes)
letter.draw(
    at: NSPoint(x: (CGFloat(size) - textSize.width) / 2 - 16, y: (CGFloat(size) - textSize.height) / 2 - 12),
    withAttributes: attributes
)
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not encode icon PNG")
}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))

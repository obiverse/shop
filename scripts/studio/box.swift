// Box shots held in a hand: find the box's rectangle with Apple Vision, straighten it with a perspective
// correction and write it as a transparent PNG. The hand and background fall away with the crop.
//   box <photo> <out.png> [inset px] [x,y x,y x,y x,y]   ← optional corners TL TR BR BL, pixels from the top-left
// Without corners Vision finds the biggest rectangle; give corners when a hand hides one.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
let inset = CGFloat(Double(args.count > 3 ? args[3] : "4") ?? 4)
guard var image = CIImage(contentsOf: input, options: [.applyOrientationProperty: true]) else { fatalError("read") }
image = image.transformed(by: CGAffineTransform(translationX: -image.extent.origin.x, y: -image.extent.origin.y))

let W = image.extent.width, H = image.extent.height
var corners: [CGPoint]? = nil
if args.count >= 8 {
  corners = args[4...7].map { s in let v = s.split(separator: ",").map { CGFloat(Double($0)!) }; return CGPoint(x: v[0], y: H - v[1]) }
}

let req = VNDetectRectanglesRequest()
req.minimumAspectRatio = 0.2
req.maximumAspectRatio = 1.0
req.minimumSize = 0.25
req.minimumConfidence = 0.5
req.quadratureTolerance = 25
req.maximumObservations = 8
var confidence: Float = 1
if corners == nil {
  try VNImageRequestHandler(ciImage: image).perform([req])
  // the biggest rectangle is the box
  guard let box = (req.results ?? []).max(by: { a, b in
    let area = { (r: VNRectangleObservation) in r.boundingBox.width * r.boundingBox.height }
    return area(a) < area(b)
  }) else { print("NORECT: pass the four corners"); exit(2) }
  let n = { (p: CGPoint) in CGPoint(x: p.x * W, y: p.y * H) }
  corners = [n(box.topLeft), n(box.topRight), n(box.bottomRight), n(box.bottomLeft)]
  confidence = box.confidence
}
let c = corners!
let fix = CIFilter(name: "CIPerspectiveCorrection")!
fix.setValue(image, forKey: kCIInputImageKey)
fix.setValue(CIVector(cgPoint: c[0]), forKey: "inputTopLeft")
fix.setValue(CIVector(cgPoint: c[1]), forKey: "inputTopRight")
fix.setValue(CIVector(cgPoint: c[2]), forKey: "inputBottomRight")
fix.setValue(CIVector(cgPoint: c[3]), forKey: "inputBottomLeft")
var flat = fix.outputImage!
flat = flat.cropped(to: flat.extent.insetBy(dx: inset, dy: inset))
flat = flat.transformed(by: CGAffineTransform(translationX: -flat.extent.origin.x, y: -flat.extent.origin.y))

let ctx = CIContext()
guard let cg = ctx.createCGImage(flat, from: flat.extent, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)),
      let dst = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("write") }
CGImageDestinationAddImage(dst, cg, nil)
CGImageDestinationFinalize(dst)
print(String(format: "OK %dx%d confidence=%.2f", Int(flat.extent.width), Int(flat.extent.height), confidence))

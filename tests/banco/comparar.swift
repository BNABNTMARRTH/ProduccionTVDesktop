import Cocoa
// Dos retratos lado a lado, recortados a la foto, con su rótulo.
let a = CommandLine.arguments
let recorte = CGRect(x: 505, y: 28, width: 600, height: 802)   // la zona del visor
func carga(_ p: String) -> CGImage {
    let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: p) as CFURL, nil)!
    let full = CGImageSourceCreateImageAtIndex(src, 0, nil)!
    return full.cropping(to: recorte)!
}
let izq = carga(a[1]), der = carga(a[2])
let rotIzq = a[3], rotDer = a[4], salida = a[5]
let M = 18, ROT = 46
let W = Int(recorte.width) * 2 + M * 3, H = Int(recorte.height) + ROT + M * 2
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W*4,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.setFillColor(CGColor(red: 0.11, green: 0.10, blue: 0.09, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
ctx.draw(izq, in: CGRect(x: M, y: M, width: Int(recorte.width), height: Int(recorte.height)))
ctx.draw(der, in: CGRect(x: M*2 + Int(recorte.width), y: M, width: Int(recorte.width), height: Int(recorte.height)))

let ns = NSGraphicsContext(cgContext: ctx, flipped: false)
NSGraphicsContext.current = ns
let attrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 21, weight: .semibold),
    .foregroundColor: NSColor(calibratedRed: 0.95, green: 0.94, blue: 0.91, alpha: 1)]
rotIzq.draw(at: NSPoint(x: M + 2, y: H - ROT + 4), withAttributes: attrs)
rotDer.draw(at: NSPoint(x: M*2 + Int(recorte.width) + 2, y: H - ROT + 4), withAttributes: attrs)
NSGraphicsContext.current = nil

let out = ctx.makeImage()!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: salida) as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, out, nil)
CGImageDestinationFinalize(dest)
print("comparación: \(W)x\(H)")

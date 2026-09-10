import Foundation
import AppKit
import Vision
import CoreImage

// Prepara los dos insumos de la Escuela de cámara a partir de UNA foto:
//   foto.jpg        la escena, reducida
//   profundidad.png a qué distancia está cada pixel (gris: negro=cerca, blanco=lejos)
// El mapa se arma con la geometría de la escena (suelo que se aleja + pared al
// fondo) y se le recorta la persona con Vision, que es lo que hace que el
// desenfoque no se vea como un filtro pegado encima.

let args = CommandLine.arguments
guard args.count >= 3 else { fputs("uso: preparar <entrada> <carpeta-salida>\n", stderr); exit(1) }
let entrada = URL(fileURLWithPath: args[1])
let salida = URL(fileURLWithPath: args[2])

// --- distancias de la escena, en metros -------------------------------------
let D_SUELO_CERCA: Float = 1.4   // la grava al filo de abajo
let D_PARED: Float       = 3.5   // la lámina del fondo
let D_PERSONA: Float     = 2.5
let HORIZONTE: Float     = 0.63  // dónde empieza el suelo (fracción de alto)
let D_MIN: Float = 1.0, D_MAX: Float = 8.0  // rango que codifica el gris

guard let src = CGImageSourceCreateWithURL(entrada as CFURL, nil),
      let original = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    fputs("no pude leer la imagen\n", stderr); exit(1)
}

// --- reducir ----------------------------------------------------------------
let ladoLargo = 1600
let escala = Double(ladoLargo) / Double(max(original.width, original.height))
let W = Int((Double(original.width) * escala).rounded())
let H = Int((Double(original.height) * escala).rounded())

let rgbSpace = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4,
                          space: rgbSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fputs("no pude crear el lienzo\n", stderr); exit(1)
}
ctx.interpolationQuality = .high
ctx.draw(original, in: CGRect(x: 0, y: 0, width: W, height: H))
guard let reducida = ctx.makeImage() else { fputs("falló el reducido\n", stderr); exit(1) }

// guardar foto.jpg
let jpgURL = salida.appendingPathComponent("foto.jpg")
if let dest = CGImageDestinationCreateWithURL(jpgURL as CFURL, "public.jpeg" as CFString, 1, nil) {
    CGImageDestinationAddImage(dest, reducida, [kCGImageDestinationLossyCompressionQuality: 0.88] as CFDictionary)
    CGImageDestinationFinalize(dest)
}

// --- silueta con Vision -----------------------------------------------------
var mascara = [Float](repeating: 0, count: W * H)
var usoVision = false
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
let handler = VNImageRequestHandler(cgImage: reducida, options: [:])
do {
    try handler.perform([req])
    if let obs = req.results?.first {
        let pb = obs.pixelBuffer
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pb, .readOnly) }
        let mw = CVPixelBufferGetWidth(pb), mh = CVPixelBufferGetHeight(pb)
        let bpr = CVPixelBufferGetBytesPerRow(pb)
        if let base = CVPixelBufferGetBaseAddress(pb) {
            let p = base.assumingMemoryBound(to: UInt8.self)
            for y in 0..<H {
                let my = min(mh - 1, y * mh / H)
                for x in 0..<W {
                    let mx = min(mw - 1, x * mw / W)
                    mascara[y * W + x] = Float(p[my * bpr + mx]) / 255.0
                }
            }
            usoVision = true
        }
    }
} catch { fputs("Vision falló: \(error)\n", stderr) }

// --- mapa de profundidad ----------------------------------------------------
var gris = [UInt8](repeating: 0, count: W * H)
for y in 0..<H {
    let t = Float(y) / Float(H - 1)          // 0 arriba, 1 abajo
    var dEscena: Float
    if t < HORIZONTE {
        dEscena = D_PARED                     // la lámina, plano vertical
    } else {
        let u = (t - HORIZONTE) / (1 - HORIZONTE)
        dEscena = D_PARED - u * (D_PARED - D_SUELO_CERCA)   // el suelo se acerca
    }
    for x in 0..<W {
        let a = mascara[y * W + x]
        let d = dEscena * (1 - a) + D_PERSONA * a
        let n = (d - D_MIN) / (D_MAX - D_MIN)
        gris[y * W + x] = UInt8(max(0, min(255, (n * 255).rounded())))
    }
}

let graySpace = CGColorSpaceCreateDeviceGray()
guard let gctx = CGContext(data: &gris, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W,
                           space: graySpace, bitmapInfo: CGImageAlphaInfo.none.rawValue),
      let mapa = gctx.makeImage() else { fputs("falló el mapa\n", stderr); exit(1) }
let pngURL = salida.appendingPathComponent("profundidad.png")
if let dest = CGImageDestinationCreateWithURL(pngURL as CFURL, "public.png" as CFString, 1, nil) {
    CGImageDestinationAddImage(dest, mapa, nil)
    CGImageDestinationFinalize(dest)
}

let cubre = mascara.filter { $0 > 0.5 }.count
print("tamaño: \(W)x\(H)")
print("Vision: \(usoVision ? "sí" : "NO — mapa solo geométrico")")
print("silueta: \(String(format: "%.1f", Double(cubre) * 100 / Double(W*H)))% del cuadro")
print("rango codificado: \(D_MIN)–\(D_MAX) m")

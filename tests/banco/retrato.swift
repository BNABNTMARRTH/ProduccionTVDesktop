import Cocoa
import WebKit

// Banco de pruebas: carga una página en un WKWebView —el MISMO motor que usa
// Wails en macOS— y guarda un retrato. Lo que salga aquí es lo que se verá
// dentro de la app, sin tener que compilarla entera.

let a = CommandLine.arguments
guard a.count >= 5 else { fputs("uso: retrato <url> <salida.png> <ancho> <alto> [js]\n", stderr); exit(1) }
let url = URL(string: a[1])!, salida = URL(fileURLWithPath: a[2])
let ancho = Double(a[3])!, alto = Double(a[4])!
let jsExtra = a.count > 5 ? a[5] : ""

class Piloto: NSObject, WKNavigationDelegate {
    var web: WKWebView!
    var listo = false
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) { esperarMotor(0) }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) {
        fputs("falló la carga: \(e)\n", stderr); exit(1)
    }
    // La herramienta carga dos imágenes y pre-cocina siete desenfoques: hay que
    // esperar a que diga que está lista, no a que termine de bajar el HTML.
    func esperarMotor(_ intento: Int) {
        if intento > 80 { fputs("el motor nunca dijo estar listo\n", stderr); exit(2) }
        web.evaluateJavaScript("(typeof listo !== 'undefined' && listo === true)") { r, _ in
            if let ok = r as? Bool, ok { self.aplicarYRetratar() }
            else { DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.esperarMotor(intento + 1) } }
        }
    }
    func aplicarYRetratar() {
        let seguir = { DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { self.retratar() } }
        if jsExtra.isEmpty { seguir() }
        else { web.evaluateJavaScript(jsExtra) { _, e in
            if let e = e { fputs("js: \(e)\n", stderr) }; seguir() } }
    }
    func retratar() {
        let cfg = WKSnapshotConfiguration()
        cfg.rect = CGRect(x: 0, y: 0, width: ancho, height: alto)
        web.takeSnapshot(with: cfg) { img, err in
            guard let img = img, let tiff = img.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff),
                  let png = rep.representation(using: .png, properties: [:]) else {
                fputs("no salió el retrato: \(String(describing: err))\n", stderr); exit(1)
            }
            try? png.write(to: salida)
            print("retrato guardado: \(Int(ancho))x\(Int(alto))")
            exit(0)
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let piloto = Piloto()
let web = WKWebView(frame: CGRect(x: 0, y: 0, width: ancho, height: alto))
web.navigationDelegate = piloto
piloto.web = web
let win = NSWindow(contentRect: CGRect(x: 0, y: 0, width: ancho, height: alto),
                   styleMask: [.borderless], backing: .buffered, defer: false)
win.contentView = web
win.orderBack(nil)
web.load(URLRequest(url: url))
DispatchQueue.main.asyncAfter(deadline: .now() + 40) { fputs("tiempo agotado\n", stderr); exit(3) }
app.run()

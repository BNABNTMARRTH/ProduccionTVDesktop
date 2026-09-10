import Foundation
import WebKit

/*
 EL SUELO SOBRE EL QUE CORRE LA APP WEB.

 En el Mac, Wails sirve frontend/dist desde una raíz propia, y por eso el HTML
 puede pedir "/assets/index.js" o "/tools/shared/sheets.js" con barra inicial.
 Si aquí se cargara con file:// esas rutas apuntarían a la raíz del sistema de
 archivos del iPad —no existen— y la app arrancaría en blanco. Peor: con file://
 WebKit prohíbe los <script type="module">, que es exactamente cómo está armado
 el paquete, y bloquea el acceso al documento de los iframes, del que dependen
 la impresión multipágina y la exportación a PNG.

 La solución es la misma que usa Wails: un origen propio. Aquí es el esquema
 ptv://app, atendido por este manejador, que sirve la carpeta Web/ del paquete
 de la app. Con eso las rutas absolutas funcionan igual que en el escritorio,
 los módulos cargan, los iframes son del MISMO origen (mismo esquema y mismo
 host) y localStorage se comporta como en un sitio normal.

 Todo se lee del paquete, que es de solo lectura y viaja dentro del .ipa: la
 app no depende de ninguna carpeta del Mac donde se compiló.
*/
final class ServidorDeRecursos: NSObject, WKURLSchemeHandler {

    static let esquema = "ptv"
    static let anfitrion = "app"

    /// ptv://app/index.html — la puerta de entrada, el equivalente de la raíz
    /// del servidor de Wails.
    static var urlDeInicio: URL {
        URL(string: "\(esquema)://\(anfitrion)/index.html")!
    }

    /// La carpeta Web/ dentro del paquete: la copia de frontend/dist.
    private let raiz: URL = {
        let recursos = Bundle.main.resourceURL ?? Bundle.main.bundleURL
        return recursos.appendingPathComponent("Web", isDirectory: true).standardizedFileURL
    }()

    // MARK: - WKURLSchemeHandler

    func webView(_ webView: WKWebView, start tarea: WKURLSchemeTask) {
        guard let url = tarea.request.url else {
            tarea.didFailWithError(Self.error(404, "petición sin URL"))
            return
        }

        var relativa = url.path
        if relativa.hasPrefix("/") { relativa.removeFirst() }
        if relativa.isEmpty { relativa = "index.html" }
        // Un directorio pedido con barra final ("/tools/") sirve su índice.
        if relativa.hasSuffix("/") { relativa += "index.html" }
        // %20 y demás: el disco quiere el nombre real, no el codificado.
        let decodificada = relativa.removingPercentEncoding ?? relativa

        let destino = raiz.appendingPathComponent(decodificada).standardizedFileURL

        // NADIE SALE DE Web/. standardizedFileURL ya resolvió los "..", así que
        // basta comprobar que lo que quedó sigue colgando de la raíz.
        guard destino.path == raiz.path || destino.path.hasPrefix(raiz.path + "/") else {
            tarea.didFailWithError(Self.error(403, "ruta fuera de la carpeta Web"))
            return
        }

        var esCarpeta: ObjCBool = false
        var archivo = destino
        if FileManager.default.fileExists(atPath: destino.path, isDirectory: &esCarpeta), esCarpeta.boolValue {
            archivo = destino.appendingPathComponent("index.html")
        }

        guard let datos = try? Data(contentsOf: archivo) else {
            tarea.didFailWithError(Self.error(404, "no existe \(decodificada)"))
            return
        }

        let respuesta = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": Self.tipoMIME(de: archivo),
                "Content-Length": String(datos.count),
                // Mismo origen para todo, pero el paquete pide su módulo con
                // crossorigin: sin esta cabecera WebKit puede rechazarlo.
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache",
            ]
        )!

        tarea.didReceive(respuesta)
        tarea.didReceive(datos)
        tarea.didFinish()
    }

    /*
     No hace falta llevar la cuenta de tareas canceladas: todo lo de arriba se
     resuelve DENTRO de start, de forma síncrona y en el mismo hilo. Cuando
     WebKit llegue a llamar aquí, la tarea ya terminó. (Responder a una tarea
     ya detenida es lo que hace caer a las apps que sirven en otro hilo.)
    */
    func webView(_ webView: WKWebView, stop tarea: WKURLSchemeTask) { }

    // MARK: - Apoyos

    private static func error(_ codigo: Int, _ mensaje: String) -> NSError {
        NSError(domain: "ProduccionTV.Recursos", code: codigo,
                userInfo: [NSLocalizedDescriptionKey: mensaje])
    }

    /// El tipo de cada archivo. Si el navegador recibe un .js como texto plano
    /// no lo ejecuta, y si recibe la hoja de estilo como otra cosa no la aplica:
    /// esta tabla es lo que hace que la app se vea y funcione.
    private static func tipoMIME(de url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html", "htm":       return "text/html; charset=utf-8"
        case "js", "mjs":         return "text/javascript; charset=utf-8"
        case "css":               return "text/css; charset=utf-8"
        case "json":              return "application/json; charset=utf-8"
        case "webmanifest":       return "application/manifest+json; charset=utf-8"
        case "svg":               return "image/svg+xml"
        case "png":               return "image/png"
        case "jpg", "jpeg":       return "image/jpeg"
        case "gif":               return "image/gif"
        case "webp":              return "image/webp"
        case "ico":               return "image/vnd.microsoft.icon"
        case "woff2":             return "font/woff2"
        case "woff":              return "font/woff"
        case "ttf":               return "font/ttf"
        case "otf":               return "font/otf"
        case "map":               return "application/json; charset=utf-8"
        case "txt", "ptv", "csv", "edl":
                                  return "text/plain; charset=utf-8"
        default:                  return "application/octet-stream"
        }
    }
}

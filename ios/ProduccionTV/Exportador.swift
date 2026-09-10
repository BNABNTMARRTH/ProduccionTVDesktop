import UIKit
import WebKit
import UniformTypeIdentifiers

/*
 GUARDAR E IMPRIMIR: LO QUE EN EL MAC HACÍAN LOS DIÁLOGOS DEL SISTEMA.

 Las herramientas no descargan archivos por su cuenta —dentro de un WebView las
 descargas por blob no funcionan, ni en macOS ni aquí—: le mandan el contenido
 al caparazón y el caparazón lo guarda con el diálogo nativo. Ese diálogo, en el
 iPad, es el selector de Archivos: el usuario elige dónde (iCloud Drive, En mi
 iPad, una carpeta compartida) y ahí queda el CSV, el EDL, el .ptv o el PNG.

 Imprimir es el panel de impresión del sistema, y desde ahí "Compartir ▸ Guardar
 en Archivos" da el PDF, igual que el menú PDF del panel del Mac.
*/
final class Exportador: NSObject {

    static let compartido = Exportador()

    private var alTerminar: ((String) -> Void)?
    /// La carpeta temporal del archivo que está en el selector, para borrarla
    /// en cuanto se cierre: lo que se exporta se COPIA al destino elegido, así
    /// que aquí no tiene por qué quedar nada.
    private var carpetaTemporal: URL?

    // MARK: - Guardar un archivo

    /// Escribe el contenido en un archivo temporal y abre el selector de
    /// Archivos para que el usuario elija dónde queda. Devuelve la ruta
    /// elegida, o "" si canceló (el frontend usa eso para no seguir pidiendo
    /// más archivos de una tanda de PNG).
    func guardarTexto(nombre: String, contenido: String, terminado: @escaping (String) -> Void) {
        let datos = Data(contenido.utf8)
        presentarSelector(nombre: nombre, datos: datos, terminado: terminado)
    }

    /// Igual, pero el contenido llega como data URL de PNG (canvas.toDataURL).
    func guardarBase64(nombre: String, dataURL: String, terminado: @escaping (String) -> Void) {
        var texto = dataURL
        if let coma = texto.firstIndex(of: ",") { texto = String(texto[texto.index(after: coma)...]) }
        guard let datos = Data(base64Encoded: texto, options: .ignoreUnknownCharacters) else {
            terminado("")
            return
        }
        presentarSelector(nombre: nombre, datos: datos, terminado: terminado)
    }

    private func presentarSelector(nombre: String, datos: Data, terminado: @escaping (String) -> Void) {
        DispatchQueue.main.async {
            let limpio = Self.nombreSeguro(nombre)
            let temporal = FileManager.default.temporaryDirectory
                .appendingPathComponent("exportar-\(UUID().uuidString)", isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: temporal, withIntermediateDirectories: true)
                let archivo = temporal.appendingPathComponent(limpio)
                try datos.write(to: archivo)

                guard let anfitrion = Self.controladorAlFrente() else { terminado(""); return }
                // Si por lo que sea quedaba una petición sin contestar, se
                // contesta ahora: una promesa colgada en el frontend deja la
                // exportación a medias sin decir por qué.
                self.responder("")
                let selector = UIDocumentPickerViewController(forExporting: [archivo], asCopy: true)
                selector.delegate = self
                selector.shouldShowFileExtensions = true
                selector.modalPresentationStyle = .formSheet
                self.alTerminar = terminado
                self.carpetaTemporal = temporal
                anfitrion.present(selector, animated: true)
            } catch {
                terminado("")
            }
        }
    }

    /// Nombre de archivo sin rutas ni sorpresas (el nombre lo propone la
    /// herramienta, y de ahí no puede salir una ruta).
    private static func nombreSeguro(_ nombre: String) -> String {
        let base = (nombre as NSString).lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        return base.isEmpty || base.hasPrefix(".") ? "archivo.txt" : base
    }

    // MARK: - Imprimir

    /// Abre el panel de impresión con el documento que el caparazón acaba de
    /// montar. Multipágina: se imprime el documento del propio caparazón (con
    /// #print-host puesto), que es donde los saltos de página sí funcionan.
    func imprimir(_ webView: WKWebView, terminado: @escaping () -> Void) {
        DispatchQueue.main.async {
            let controlador = UIPrintInteractionController.shared
            let info = UIPrintInfo.printInfo()
            info.outputType = .general
            info.jobName = "Producción TV"
            info.orientation = .portrait
            controlador.printInfo = info
            controlador.printFormatter = webView.viewPrintFormatter()

            // En iPad el panel es un popover y EXIGE de dónde sale: sin ancla
            // no aparece nada. Se ancla al centro de la propia app.
            let caja = webView.bounds
            let ancla = CGRect(x: caja.midX - 1, y: caja.midY - 1, width: 2, height: 2)
            let seAbrio = controlador.present(from: ancla, in: webView, animated: true) { _, _, _ in
                terminado()
            }
            // Si no se pudo abrir, el cierre de arriba NO se llama nunca y el
            // frontend se queda esperando para siempre a que termine de
            // imprimir. Se contesta aquí mismo.
            if !seAbrio { terminado() }
        }
    }

    // MARK: - Quién presenta

    static func controladorAlFrente() -> UIViewController? {
        let escenas = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let escena = escenas.first { $0.activationState == .foregroundActive } ?? escenas.first
        var controlador = escena?.keyWindow?.rootViewController
            ?? escena?.windows.first?.rootViewController
        while let presentado = controlador?.presentedViewController {
            controlador = presentado
        }
        return controlador
    }
}

extension Exportador: UIDocumentPickerDelegate {

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        responder(urls.first?.path ?? "")
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        responder("")
    }

    /// Contesta la petición pendiente (si la hay) y limpia lo temporal.
    /// Pasa por un solo sitio para que nunca quede una promesa sin respuesta.
    private func responder(_ ruta: String) {
        let respuesta = alTerminar
        alTerminar = nil
        if let temporal = carpetaTemporal {
            carpetaTemporal = nil
            try? FileManager.default.removeItem(at: temporal)
        }
        respuesta?(ruta)
    }
}

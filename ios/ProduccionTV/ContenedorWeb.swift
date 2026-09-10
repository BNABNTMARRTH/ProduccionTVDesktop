import SwiftUI
import WebKit

/*
 LA APP DE VERDAD, DENTRO DE UNA VISTA NATIVA.

 El caparazón de Producción TV es HTML, CSS y JavaScript, y funciona. Reescribir
 en SwiftUI las siete etapas, el generador de infografías, el diagrama de señal
 y el modo producción sería tirar la app y volver a empezar — y no haría nada
 que no haga ya. Lo que sí hace falta es que corra dentro de una app de iPadOS
 de verdad: firmada, instalable, con sus archivos, su impresión y su exportación
 nativas. Eso es lo que hay aquí.

 SwiftUI pone y mide la vista (respetando el área segura); WKWebView pinta la
 app; PuenteNativo le da lo que antes le daba Go.
*/
struct ContenedorWeb: UIViewRepresentable {

    func makeCoordinator() -> Coordinador { Coordinador() }

    func makeUIView(context: Context) -> WKWebView {
        let coordinador = context.coordinator
        let configuracion = WKWebViewConfiguration()

        // El origen propio: ptv://app sirve la carpeta Web/ del paquete.
        configuracion.setURLSchemeHandler(coordinador.recursos, forURLScheme: ServidorDeRecursos.esquema)

        let contenido = configuracion.userContentController

        // El mostrador de funciones (lo que era window.go.main.App con Wails).
        contenido.addScriptMessageHandler(coordinador.puente,
                                          contentWorld: .page,
                                          name: PuenteNativo.nombreDelCanal)

        // El puente se instala ANTES que cualquier script de la página: cuando
        // el paquete arranca y busca window.go, ya tiene que estar.
        if let puenteJS = Self.leerGuion("puente-ios") {
            contenido.addUserScript(WKUserScript(source: puenteJS,
                                                 injectionTime: .atDocumentStart,
                                                 forMainFrameOnly: true,
                                                 in: .page))
        }
        // Los retoques de tacto van en el caparazón Y en cada herramienta.
        if let tactoJS = Self.leerGuion("adaptacion-ipad") {
            contenido.addUserScript(WKUserScript(source: tactoJS,
                                                 injectionTime: .atDocumentEnd,
                                                 forMainFrameOnly: false,
                                                 in: .page))
        }

        configuracion.defaultWebpagePreferences.allowsContentJavaScript = true
        configuracion.allowsInlineMediaPlayback = true
        configuracion.mediaTypesRequiringUserActionForPlayback = []
        // Nada de ventanas emergentes por su cuenta: la app no las usa, y un
        // window.open sin que nadie lo pida no tiene a dónde ir aquí.
        configuracion.preferences.javaScriptCanOpenWindowsAutomatically = false

        let vista = WKWebView(frame: .zero, configuration: configuracion)
        vista.navigationDelegate = coordinador
        vista.uiDelegate = coordinador
        vista.allowsBackForwardNavigationGestures = false
        vista.isOpaque = true
        vista.backgroundColor = UIColor(named: "FondoLanzamiento") ?? .black
        vista.scrollView.backgroundColor = vista.backgroundColor
        // La app maneja su propio desplazamiento por dentro; el rebote del
        // documento entero solo despega la interfaz del borde.
        vista.scrollView.bounces = false
        vista.scrollView.alwaysBounceVertical = false
        vista.scrollView.alwaysBounceHorizontal = false
        vista.scrollView.contentInsetAdjustmentBehavior = .never
        // El pellizco para acercar es del navegador; la app tiene su propio
        // zoom (la lupa del plano, el tamaño de la Configuración).
        vista.scrollView.pinchGestureRecognizer?.isEnabled = false
        if #available(iOS 16.4, *) {
            // Permite abrir el Inspector web desde Safari en el Mac con el iPad
            // conectado: es la única forma de ver la consola de la app.
            vista.isInspectable = true
        }

        coordinador.puente.webView = vista

        vista.load(URLRequest(url: ServidorDeRecursos.urlDeInicio))
        return vista
    }

    func updateUIView(_ vista: WKWebView, context: Context) { }

    /// Lee un guion de la carpeta Recursos del paquete.
    private static func leerGuion(_ nombre: String) -> String? {
        guard let url = Bundle.main.url(forResource: nombre, withExtension: "js"),
              let texto = try? String(contentsOf: url, encoding: .utf8) else {
            assertionFailure("Falta \(nombre).js en el paquete de la app")
            return nil
        }
        return texto
    }

    // MARK: - Coordinador

    final class Coordinador: NSObject, WKNavigationDelegate, WKUIDelegate {

        let recursos = ServidorDeRecursos()
        let puente = PuenteNativo.compartido

        func webView(_ webView: WKWebView, didFinish navegacion: WKNavigation!) {
            puente.paginaTerminoDeCargar()
        }

        /* Dentro de la app solo se navega por ptv://app. Un enlace a internet
           —los créditos de una herramienta, por ejemplo— sale a Safari, que es
           lo correcto: la app es offline y no tiene barra de direcciones ni
           botón de volver. */
        func webView(_ webView: WKWebView,
                     decidePolicyFor accion: WKNavigationAction,
                     decisionHandler decidir: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = accion.request.url else { decidir(.cancel); return }
            if url.scheme == ServidorDeRecursos.esquema || url.scheme == "about" || url.scheme == "blob" {
                decidir(.allow)
                return
            }
            if accion.navigationType == .linkActivated, UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
            }
            decidir(.cancel)
        }

        /* window.open (target="_blank") no abre otra ventana: va a Safari. */
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for accion: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = accion.request.url, UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
            }
            return nil
        }

        // MARK: Diálogos de JavaScript
        // La app evita alert/confirm/prompt a propósito, pero una herramienta
        // podría usarlos: sin esto el WebView se queda esperando para siempre.

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage mensaje: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler listo: @escaping () -> Void) {
            let alerta = UIAlertController(title: "Producción TV", message: mensaje, preferredStyle: .alert)
            alerta.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in listo() })
            Self.presentar(alerta, respaldo: listo)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage mensaje: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler listo: @escaping (Bool) -> Void) {
            let alerta = UIAlertController(title: "Producción TV", message: mensaje, preferredStyle: .alert)
            alerta.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in listo(false) })
            alerta.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in listo(true) })
            Self.presentar(alerta) { listo(false) }
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt aviso: String,
                     defaultText porOmision: String?, initiatedByFrame frame: WKFrameInfo,
                     completionHandler listo: @escaping (String?) -> Void) {
            let alerta = UIAlertController(title: "Producción TV", message: aviso, preferredStyle: .alert)
            alerta.addTextField { $0.text = porOmision }
            alerta.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in listo(nil) })
            alerta.addAction(UIAlertAction(title: "Aceptar", style: .default) { _ in
                listo(alerta.textFields?.first?.text)
            })
            Self.presentar(alerta) { listo(nil) }
        }

        private static func presentar(_ alerta: UIAlertController, respaldo: @escaping () -> Void) {
            guard let anfitrion = Exportador.controladorAlFrente() else { respaldo(); return }
            anfitrion.present(alerta, animated: true)
        }
    }
}

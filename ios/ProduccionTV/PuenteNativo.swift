import UIKit
import WebKit

/*
 EL MISMO MOSTRADOR QUE TENÍA Go.

 El frontend no sabe —ni tiene por qué saber— si detrás hay Go o Swift: pide
 window.go.main.App.LoadAllProjects() y espera una promesa. Este archivo atiende
 exactamente las mismas 24 funciones que expone app.go, con las mismas firmas y
 los mismos valores de vuelta, para que el paquete web compilado corra tal cual
 está, sin recompilarlo ni tocarle una línea.

 Donde el iPad no puede hacer lo mismo que el Mac es en las VENTANAS: aquí la
 app tiene una sola. Lo que en el Mac abría un proceso nuevo, aquí cambia el
 contexto de arranque y recarga la página, y el resultado en pantalla es el
 mismo: el módulo solo, el proyecto entero o Inicio. Ver EstadoDeArranque.
*/
final class PuenteNativo: NSObject, WKScriptMessageHandlerWithReply {

    static let nombreDelCanal = "producciontv"

    /// Una sola pantalla, un solo mostrador. Tenerlo a mano es lo que permite
    /// que un .ptv abierto desde Archivos llegue al frontend esté donde esté
    /// la app (ver AppProduccionTV.abrir).
    static let compartido = PuenteNativo()

    weak var webView: WKWebView?

    /// La página terminó de cargar y ya hay quien escuche los eventos.
    private var paginaLista = false

    /// Pausa antes de recargar cuando se "cambia de ventana". El guardado
    /// automático del caparazón espera 550 ms desde el último cambio; si se
    /// recargara al instante, ese último guardado se perdería en el camino.
    private let esperaAntesDeRecargar: TimeInterval = 0.9

    // MARK: - Entrada de mensajes

    func userContentController(_ controlador: WKUserContentController,
                               didReceive mensaje: WKScriptMessage,
                               replyHandler responder: @escaping (Any?, String?) -> Void) {

        guard let cuerpo = mensaje.body as? [String: Any],
              let funcion = cuerpo["fn"] as? String else {
            responder(nil, "mensaje del puente sin nombre de función")
            return
        }
        let args = (cuerpo["args"] as? [Any]) ?? []
        atender(funcion, args, responder)
    }

    private func texto(_ args: [Any], _ i: Int) -> String {
        i < args.count ? (args[i] as? String ?? "") : ""
    }

    // MARK: - Las funciones de app.go, una por una

    private func atender(_ funcion: String, _ args: [Any], _ responder: @escaping (Any?, String?) -> Void) {
        let almacen = AlmacenEnDisco.compartido
        let arranque = EstadoDeArranque.compartido

        switch funcion {

        // ---- Contexto de arranque -------------------------------------------------
        case "GetLaunchContext":
            responder(arranque.comoDiccionario(), nil)

        // ---- Ajustes de la app ----------------------------------------------------
        case "LoadSettings":
            responder(almacen.leerAjustes(), nil)

        case "SaveSettings":
            almacen.guardarAjustes(texto(args, 0))
            responder(nil, nil)

        // ---- Proyectos en disco ---------------------------------------------------
        case "LoadAllProjects":
            responder(almacen.cargarTodos(), nil)

        case "SaveProjectFile":
            almacen.guardarProyecto(id: texto(args, 0), contenido: texto(args, 1))
            responder(nil, nil)

        case "LoadProjectFile":
            responder(almacen.leerProyecto(id: texto(args, 0)), nil)

        case "DeleteProjectFile":
            almacen.borrarProyecto(id: texto(args, 0))
            responder(nil, nil)

        // ---- Papelera interna -----------------------------------------------------
        case "ListTrashFiles":
            responder(almacen.listarPapelera(), nil)

        case "ReadTrashFile":
            responder(almacen.leerPapelera(nombre: texto(args, 0)), nil)

        case "DeleteTrashFile":
            almacen.borrarDePapelera(nombre: texto(args, 0))
            responder(nil, nil)

        // ---- Mesa de luz (referencias visuales) -----------------------------------
        case "ListReferences":
            responder(almacen.listarReferencias(), nil)

        case "SaveReference":
            almacen.guardarReferencia(id: texto(args, 0), ficha: texto(args, 1), imagenDataURL: texto(args, 2))
            responder(nil, nil)

        case "LoadReferenceImage":
            responder(almacen.leerImagenReferencia(id: texto(args, 0)), nil)

        case "DeleteReference":
            almacen.borrarReferencia(id: texto(args, 0))
            responder(nil, nil)

        // ---- Exportar e imprimir --------------------------------------------------
        case "SaveTextFile":
            Exportador.compartido.guardarTexto(nombre: texto(args, 0), contenido: texto(args, 1)) { ruta in
                responder(ruta, nil)
            }

        case "SaveBase64File":
            Exportador.compartido.guardarBase64(nombre: texto(args, 0), dataURL: texto(args, 1)) { ruta in
                responder(ruta, nil)
            }

        case "Print":
            guard let vista = webView else { responder(nil, nil); return }
            Exportador.compartido.imprimir(vista) { responder(nil, nil) }

        // ---- La agenda de crew ----------------------------------------------------
        case "ListContacts":
            responder(almacen.listarContactos(), nil)

        case "SaveContact":
            almacen.guardarContacto(id: texto(args, 0), ficha: texto(args, 1))
            responder(nil, nil)

        case "DeleteContact":
            almacen.borrarContacto(id: texto(args, 0))
            responder(nil, nil)

        // ---- El ojo de la app (solo iPad) -----------------------------------------
        /* No existe en app.go: usa Vision, que viene dentro de iPadOS. En el Mac
           la app es Go y no tiene un equivalente a mano, así que allá las
           etiquetas se ponen a mano y la mesa funciona igual. Quien llama lo
           envuelve en un try: si la función no está, no pasa nada.

           Va fuera del hilo principal porque analizar una foto tarda decenas de
           milisegundos y aquí se meten varias seguidas: bloquear el hilo de la
           interfaz haría que la app se sintiera trabada justo al importar. */
        case "AnalizarImagen":
            let dataURL = texto(args, 0)
            DispatchQueue.global(qos: .userInitiated).async {
                let resultado = AnalizadorDeImagen.analizar(dataURL: dataURL)
                DispatchQueue.main.async { responder(resultado, nil) }
            }

        // ---- El tema que se está viendo -------------------------------------------
        /* No existe en app.go: en el Mac la barra de la ventana es de la app y
           se pinta sola. Aquí la franja de la hora la pinta iPadOS, así que la
           app tiene que decir si va en claro o en oscuro. Lo manda
           adaptacion-ipad.js cada vez que el tema cambia. */
        case "ReportarTema":
            let oscuro = texto(args, 0) != "claro"
            DispatchQueue.main.async {
                if EstadoDeInterfaz.compartido.oscuro != oscuro {
                    EstadoDeInterfaz.compartido.oscuro = oscuro
                }
            }
            responder(nil, nil)

        // ---- Título de la ventana -------------------------------------------------
        case "SetWindowTitle":
            let titulo = texto(args, 0)
            DispatchQueue.main.async { [weak self] in
                // En iPadOS el título de la escena es lo que se lee en el
                // conmutador de apps y en Stage Manager: el mismo papel que la
                // barra de la ventana en el Mac.
                self?.webView?.window?.windowScene?.title = titulo.isEmpty ? "Producción TV" : titulo
            }
            responder(nil, nil)

        // ---- "Ventanas" -----------------------------------------------------------
        /* ESTA pantalla deja de ser Inicio y pasa a ser la del proyecto. Es
           idéntico al Mac: no nace nada nuevo, se transforma lo que hay. Por eso
           es la única de las cuatro que no necesita recargar. */
        case "ClaimProject":
            arranque.ponerProyecto(texto(args, 0), json: texto(args, 1))
            responder(true, nil)

        /* Abrir un proyecto teniendo otro abierto. En el Mac nace otra ventana;
           aquí esta pantalla pasa a ser la del proyecto pedido. */
        case "OpenProjectWindow":
            arranque.ponerProyecto(texto(args, 0), json: texto(args, 1))
            recargar()
            responder(true, nil)

        /* Sacar un módulo a su propia ventana. Aquí el módulo se queda solo en
           la pantalla, sin rail ni pestañas, con su botón ⇲ para volver: es lo
           mismo que ve el usuario en el Mac, en la única ventana que hay. */
        case "OpenToolWindow":
            arranque.ponerModulo(texto(args, 0), herramienta: texto(args, 1), json: texto(args, 2))
            recargar()
            responder(true, nil)

        /* Cerrar la ventana del módulo suelto = volver al proyecto. El frontend
           avisa cuál con FocusProjectWindow justo antes. */
        case "CloseWindow":
            let destino = arranque.proyectoAlQueVolver.isEmpty ? arranque.projectID : arranque.proyectoAlQueVolver
            if destino.isEmpty { arranque.ponerInicio() }
            else { arranque.ponerProyecto(destino, json: "") }  // el .ptv se relee del disco
            arranque.proyectoAlQueVolver = ""
            recargar()
            responder(nil, nil)

        /* Volver a Inicio (el botón con el nombre del proyecto). */
        case "FocusLauncher":
            arranque.ponerInicio()
            recargar()
            responder(nil, nil)

        /* No hay otra ventana a la que ir: siempre false, y así el frontend
           sigue por el camino de "no estaba abierto en ningún otro sitio".
           Del id nos quedamos la nota para CloseWindow. */
        case "FocusProjectWindow":
            arranque.proyectoAlQueVolver = texto(args, 0)
            responder(false, nil)

        case "FocusToolWindow":
            responder(false, nil)

        /* Nada vive en otra ventana, así que ningún proyecto ni módulo se marca
           como "abierto en otro sitio" ni se saca del recorrido. */
        case "ListOpenProjects":
            responder([String](), nil)

        case "ListOpenTools":
            responder([String](), nil)

        /* Vigilar el .ptv servía para que dos ventanas se enteraran de lo que
           guardó la otra. Con una sola no hay a quién avisar. */
        case "WatchProject", "StopWatch":
            responder(nil, nil)

        default:
            responder(nil, "función desconocida en el puente: \(funcion)")
        }
    }

    // MARK: - Recargar la página en el modo nuevo

    private func recargar() {
        paginaLista = false
        EstadoDeArranque.compartido.yaEntregado = false
        DispatchQueue.main.asyncAfter(deadline: .now() + esperaAntesDeRecargar) { [weak self] in
            guard let vista = self?.webView else { return }
            vista.load(URLRequest(url: ServidorDeRecursos.urlDeInicio))
        }
    }

    // MARK: - Un .ptv que llega desde Archivos

    /// Con la app ya corriendo entra por evento, igual que en el Mac. Si acaba
    /// de arrancar, espera en el contexto: initializeWindow lo recoge de ahí.
    func entregarArchivo(_ contenido: String) {
        DispatchQueue.main.async { [weak self] in
            guard let yo = self else { return }
            if yo.paginaLista && EstadoDeArranque.compartido.yaEntregado {
                yo.emitir("producciontv:open-file", contenido)
            } else {
                EstadoDeArranque.compartido.archivoAbierto = contenido
            }
        }
    }

    /// La avisa el coordinador del WebView cuando la página terminó de cargar.
    func paginaTerminoDeCargar() {
        paginaLista = true
        // Si el archivo llegó cuando el frontend ya había pedido su contexto,
        // se quedó guardado y nadie lo recogió: se entrega ahora.
        let arranque = EstadoDeArranque.compartido
        if arranque.yaEntregado, !arranque.archivoAbierto.isEmpty {
            let pendiente = arranque.archivoAbierto
            arranque.archivoAbierto = ""
            emitir("producciontv:open-file", pendiente)
        }
    }

    // MARK: - Avisos del sistema hacia el frontend (EventsOn)

    /// El equivalente de runtime.EventsEmit de Wails: así llega, por ejemplo,
    /// el .ptv que el usuario abrió desde Archivos con la app ya corriendo.
    func emitir(_ evento: String, _ dato: String) {
        DispatchQueue.main.async { [weak self] in
            guard let vista = self?.webView,
                  let nombre = Self.aLiteralJS(evento),
                  let carga = Self.aLiteralJS(dato) else { return }
            vista.evaluateJavaScript("window.__ptvEmitir && window.__ptvEmitir(\(nombre), \(carga));")
        }
    }

    /// Un texto cualquiera convertido en literal de JavaScript sin sorpresas
    /// (comillas, saltos de línea o un .ptv entero con comillas dentro).
    private static func aLiteralJS(_ texto: String) -> String? {
        guard let datos = try? JSONSerialization.data(withJSONObject: [texto]),
              let arreglo = String(data: datos, encoding: .utf8) else { return nil }
        return String(arreglo.dropFirst().dropLast())   // ["…"] → "…"
    }
}

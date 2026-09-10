import Foundation

/*
 QUÉ TIENE QUE MOSTRAR ESTA VENTANA AL CARGAR.

 En el Mac cada ventana es un PROCESO aparte y el modo llega por argumentos de
 línea de comandos (--project, --tool). En el iPad la app es una sola ventana,
 así que el mismo dato vive aquí, en memoria, y el frontend lo pide igual que
 antes con GetLaunchContext(). Cuando la app "abre otra ventana" (desanclar un
 módulo, volver a Inicio) lo que pasa de verdad es que se cambia esto y se
 vuelve a cargar la página: para el frontend es indistinguible de haber nacido
 en ese modo, que es justo lo que se quiere.
*/
final class EstadoDeArranque {

    static let compartido = EstadoDeArranque()

    /// "launcher" (Inicio), "project" (proyecto completo) o "tool" (un módulo solo).
    var modo: String = "launcher"
    var projectID: String = ""
    var projectJSON: String = ""
    /// El módulo que vive solo en esta pantalla cuando modo == "tool".
    var herramienta: String = ""

    /// Contenido de un .ptv abierto desde Archivos. Se entrega UNA sola vez,
    /// igual que en el Mac: si no, cada recarga volvería a importarlo.
    var archivoAbierto: String = ""

    /// El proyecto al que hay que volver cuando un módulo suelto se cierra
    /// (el frontend lo anuncia con FocusProjectWindow antes de CloseWindow).
    var proyectoAlQueVolver: String = ""

    /// Si el frontend ya pidió el contexto de esta carga. Sirve para no
    /// entregar dos veces el mismo .ptv abierto desde Archivos.
    var yaEntregado: Bool = false

    func comoDiccionario() -> [String: String] {
        let abierto = archivoAbierto
        archivoAbierto = ""
        yaEntregado = true
        return [
            "mode": modo,
            "projectID": projectID,
            "projectJSON": projectJSON,
            "openedFile": abierto,
            "tool": herramienta,
        ]
    }

    func ponerInicio() {
        modo = "launcher"
        projectID = ""
        projectJSON = ""
        herramienta = ""
    }

    func ponerProyecto(_ id: String, json: String) {
        modo = "project"
        projectID = id
        projectJSON = json
        herramienta = ""
    }

    func ponerModulo(_ id: String, herramienta modulo: String, json: String) {
        modo = "tool"
        projectID = id
        projectJSON = json
        herramienta = modulo
    }
}

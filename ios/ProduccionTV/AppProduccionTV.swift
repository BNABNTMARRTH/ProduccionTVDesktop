import SwiftUI

/*
 PRODUCCIÓN TV PARA IPAD

 Misma app que en el escritorio: las mismas siete etapas, el mismo generador de
 infografías, el mismo diagrama de señal, los mismos proyectos .ptv. Lo que
 cambia es lo de abajo — en el Mac es Wails + Go, aquí es SwiftUI + WKWebView +
 Swift — y no cambia nada de lo que se ve ni de lo que se hace.
*/
@main
struct AppProduccionTV: App {

    @StateObject private var interfaz = EstadoDeInterfaz.compartido

    var body: some Scene {
        WindowGroup {
            VistaPrincipal()
                .environmentObject(interfaz)
                /* Doble toque a un .ptv en Archivos: el equivalente del doble
                   clic en Finder. Si la app ya está corriendo, el proyecto
                   entra por el mismo evento que usaba el Mac; si acaba de
                   arrancar, espera en el contexto de arranque. */
                .onOpenURL { url in Self.abrirArchivo(url) }
        }
    }

    static func abrirArchivo(_ url: URL) {
        // Un archivo que vive fuera de la app (iCloud Drive, otra app) solo se
        // deja leer con permiso, y hay que devolverlo al terminar.
        let conPermiso = url.startAccessingSecurityScopedResource()
        defer { if conPermiso { url.stopAccessingSecurityScopedResource() } }

        guard let texto = try? String(contentsOf: url, encoding: .utf8), !texto.isEmpty else { return }
        PuenteNativo.compartido.entregarArchivo(texto)
    }
}

/// Lo poco que la parte nativa necesita saber de la app web: si está en claro
/// o en oscuro, para que la hora y la batería de arriba se lean sobre el fondo
/// que haya en ese momento.
final class EstadoDeInterfaz: ObservableObject {
    static let compartido = EstadoDeInterfaz()
    @Published var oscuro: Bool = true
}

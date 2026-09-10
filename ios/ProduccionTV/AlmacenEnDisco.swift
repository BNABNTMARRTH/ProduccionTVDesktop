import Foundation

/*
 LA MISMA VERDAD QUE EN EL MAC, EN LA CARPETA QUE EL IPAD SÍ DEJA VER.

 En el escritorio la fuente de verdad es ~/Documents/ProduccionTV: un .ptv por
 proyecto, con el mismo paquete que exporta la app. En iPadOS una app no puede
 escribir en la carpeta Documentos del sistema, pero sí tiene la SUYA — y con
 UIFileSharingEnabled esa carpeta aparece en Archivos ▸ En mi iPad ▸ Producción
 TV. Se conserva la estructura exacta (un .ptv por proyecto dentro de
 ProduccionTV, y su Papelera) para que un .ptv copiado desde el Mac caiga ahí y la app lo vea.

 localStorage del WebView sigue siendo, igual que en el Mac, solo caché de
 arranque: lo que se pierde al reinstalar no es el trabajo.
*/
final class AlmacenEnDisco {

    static let compartido = AlmacenEnDisco()

    private let gestor = FileManager.default

    // MARK: - Carpetas

    /// Documentos de la app ▸ ProduccionTV (el gemelo de ~/Documents/ProduccionTV).
    var carpetaProyectos: URL {
        let documentos = gestor.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let carpeta = documentos.appendingPathComponent("ProduccionTV", isDirectory: true)
        crearSiFalta(carpeta)
        return carpeta
    }

    /// La papelera interna: borrar NO destruye, mueve aquí con marca de tiempo.
    var carpetaPapelera: URL {
        let carpeta = carpetaProyectos.appendingPathComponent("Papelera", isDirectory: true)
        crearSiFalta(carpeta)
        return carpeta
    }

    /// La mesa de luz: la fototeca de referencias visuales. Vive JUNTO a los
    /// proyectos y no dentro de ninguno, igual que en el Mac — una imagen que
    /// te sirvió una vez te sirve para el siguiente proyecto, y un .ptv con
    /// cientos de cuadros adentro este iPad no lo abre.
    var carpetaReferencias: URL {
        let carpeta = carpetaProyectos.appendingPathComponent("Referencias", isDirectory: true)
        crearSiFalta(carpeta)
        return carpeta
    }

    /// La agenda: la gente con la que trabajas. Vive junto a los proyectos por la
    /// misma razón que la fototeca — tu camarógrafo de marzo te sirve en
    /// noviembre. NO es un directorio público: es tu agenda, en tu disco, como
    /// los contactos del teléfono. No se publica ni sale de aquí.
    var carpetaContactos: URL {
        let carpeta = carpetaProyectos.appendingPathComponent("Contactos", isDirectory: true)
        crearSiFalta(carpeta)
        return carpeta
    }

    /// Los ajustes van en Application Support y no en la caché: la caché se
    /// puede vaciar sola, y perder el tamaño de letra que alguien necesita para
    /// poder leer no es un detalle. (Misma razón que en el Mac.)
    var rutaAjustes: URL {
        let soporte = gestor.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let carpeta = soporte.appendingPathComponent("ProduccionTV", isDirectory: true)
        crearSiFalta(carpeta)
        return carpeta.appendingPathComponent("ajustes.json")
    }

    private func crearSiFalta(_ url: URL) {
        guard !gestor.fileExists(atPath: url.path) else { return }
        try? gestor.createDirectory(at: url, withIntermediateDirectories: true)
    }

    // MARK: - Nombres seguros

    /// Limita el id a caracteres seguros para nombre de archivo (mismo criterio
    /// que sanitizeProjectID en app.go: el frontend no puede salirse de la carpeta).
    static func idSeguro(_ id: String) -> String {
        String(id.unicodeScalars.filter { c in
            (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c == "-" || c == "_"
        }.map(Character.init))
    }

    /// Acota un nombre de la papelera a un .ptv plano (sin rutas), para que el
    /// frontend no pueda leer ni borrar otros archivos.
    static func nombrePapeleraSeguro(_ nombre: String) -> String {
        let base = (nombre as NSString).lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        if base.isEmpty || base == "." || base == ".." || base.hasPrefix(".") { return "" }
        guard base.lowercased().hasSuffix(".ptv") else { return "" }
        return base
    }

    // MARK: - Proyectos

    /// Lee todos los .ptv de la carpeta de proyectos (LoadAllProjects).
    func cargarTodos() -> [String] {
        guard let nombres = try? gestor.contentsOfDirectory(atPath: carpetaProyectos.path) else { return [] }
        var salida: [String] = []
        for nombre in nombres.sorted() where nombre.lowercased().hasSuffix(".ptv") {
            let ruta = carpetaProyectos.appendingPathComponent(nombre)
            var esCarpeta: ObjCBool = false
            guard gestor.fileExists(atPath: ruta.path, isDirectory: &esCarpeta), !esCarpeta.boolValue else { continue }
            if let texto = try? String(contentsOf: ruta, encoding: .utf8) { salida.append(texto) }
        }
        return salida
    }

    /// Escritura atómica: si algo falla a mitad, el .ptv anterior sigue entero.
    @discardableResult
    func guardarProyecto(id: String, contenido: String) -> Bool {
        let limpio = Self.idSeguro(id)
        guard !limpio.isEmpty else { return false }
        let destino = carpetaProyectos.appendingPathComponent(limpio + ".ptv")
        do {
            try contenido.write(to: destino, atomically: true, encoding: .utf8)
            return true
        } catch { return false }
    }

    /// Lee el .ptv de UN proyecto ("" si no existe).
    func leerProyecto(id: String) -> String {
        let limpio = Self.idSeguro(id)
        guard !limpio.isEmpty else { return "" }
        let ruta = carpetaProyectos.appendingPathComponent(limpio + ".ptv")
        return (try? String(contentsOf: ruta, encoding: .utf8)) ?? ""
    }

    /// Borrar no destruye: mueve el .ptv a la papelera con marca de tiempo.
    func borrarProyecto(id: String) {
        let limpio = Self.idSeguro(id)
        guard !limpio.isEmpty else { return }
        let origen = carpetaProyectos.appendingPathComponent(limpio + ".ptv")
        guard gestor.fileExists(atPath: origen.path) else { return }
        let formato = DateFormatter()
        formato.dateFormat = "yyyyMMdd-HHmmss"
        formato.locale = Locale(identifier: "en_US_POSIX")
        let destino = carpetaPapelera.appendingPathComponent("\(limpio)-\(formato.string(from: Date())).ptv")
        try? gestor.moveItem(at: origen, to: destino)
    }

    // MARK: - Papelera

    /// Enumera la papelera, lo más reciente primero (ListTrashFiles).
    func listarPapelera() -> [[String: String]] {
        guard let nombres = try? gestor.contentsOfDirectory(atPath: carpetaPapelera.path) else { return [] }
        let formato = DateFormatter()
        formato.dateFormat = "yyyy-MM-dd HH:mm"
        var salida: [[String: String]] = []
        for nombre in nombres where Self.nombrePapeleraSeguro(nombre) != "" {
            let ruta = carpetaPapelera.appendingPathComponent(nombre)
            let atributos = try? gestor.attributesOfItem(atPath: ruta.path)
            let fecha = (atributos?[.modificationDate] as? Date) ?? Date()
            salida.append([
                "name": nombre,
                "title": tituloDe(ruta),
                "deletedAt": formato.string(from: fecha),
            ])
        }
        salida.sort { ($0["deletedAt"] ?? "") > ($1["deletedAt"] ?? "") }
        return salida
    }

    func leerPapelera(nombre: String) -> String {
        let limpio = Self.nombrePapeleraSeguro(nombre)
        guard !limpio.isEmpty else { return "" }
        let ruta = carpetaPapelera.appendingPathComponent(limpio)
        return (try? String(contentsOf: ruta, encoding: .utf8)) ?? ""
    }

    func borrarDePapelera(nombre: String) {
        let limpio = Self.nombrePapeleraSeguro(nombre)
        guard !limpio.isEmpty else { return }
        try? gestor.removeItem(at: carpetaPapelera.appendingPathComponent(limpio))
    }

    /// Lee el nombre del proyecto dentro de un .ptv (acepta el paquete
    /// {project, infographic, diagram} o un cfg suelto del generador).
    private func tituloDe(_ ruta: URL) -> String {
        guard let datos = try? Data(contentsOf: ruta),
              let json = try? JSONSerialization.jsonObject(with: datos) as? [String: Any] else { return "" }
        if let proyecto = json["project"] as? [String: Any], let nombre = proyecto["name"] as? String, !nombre.isEmpty {
            return nombre
        }
        if let info = json["infographic"] as? [String: Any], let titulo = info["titulo"] as? String, !titulo.isEmpty {
            return titulo
        }
        return (json["titulo"] as? String) ?? ""
    }

    // MARK: - Ajustes

    func leerAjustes() -> String {
        (try? String(contentsOf: rutaAjustes, encoding: .utf8)) ?? ""
    }

    @discardableResult
    func guardarAjustes(_ contenido: String) -> Bool {
        (try? contenido.write(to: rutaAjustes, atomically: true, encoding: .utf8)) != nil
    }

    // MARK: - Nombre del proyecto (para el título de la ventana al arrancar)

    static func nombreDeProyecto(en json: String) -> String {
        guard let datos = json.data(using: .utf8),
              let raiz = try? JSONSerialization.jsonObject(with: datos) as? [String: Any] else { return "" }
        if let nombre = raiz["name"] as? String, !nombre.isEmpty { return nombre }
        if let proyecto = raiz["project"] as? [String: Any], let nombre = proyecto["name"] as? String, !nombre.isEmpty {
            return nombre
        }
        if let info = raiz["infographic"] as? [String: Any], let titulo = info["titulo"] as? String, !titulo.isEmpty {
            return titulo
        }
        return (raiz["titulo"] as? String) ?? ""
    }

    // MARK: - Mesa de luz (referencias visuales)

    /* Cada referencia son DOS archivos, y la división es lo que hace que la
       mesa abra rápido con cientos de imágenes:
           <id>.json  etiquetas + MINIATURA — se lee siempre, al abrir la mesa
           <id>.jpg   la imagen completa    — se lee solo al abrirla en grande
       Leer trescientas miniaturas de 10 KB es instantáneo en este iPad; leer
       trescientas imágenes completas lo dejaría pensando varios segundos. */

    /// Lee la ficha de todas las referencias (ListReferences).
    func listarReferencias() -> [String] {
        guard let nombres = try? gestor.contentsOfDirectory(atPath: carpetaReferencias.path) else { return [] }
        return nombres.sorted().compactMap { nombre in
            guard nombre.lowercased().hasSuffix(".json") else { return nil }
            return try? String(contentsOf: carpetaReferencias.appendingPathComponent(nombre), encoding: .utf8)
        }
    }

    /// Guarda la ficha y, si viene, la imagen completa. imagenDataURL vacío =
    /// solo cambiaron etiquetas: no se reescribe el .jpg, que es lo pesado.
    @discardableResult
    func guardarReferencia(id: String, ficha: String, imagenDataURL: String) -> Bool {
        let limpio = AlmacenEnDisco.idSeguro(id)
        guard !limpio.isEmpty else { return false }
        if !imagenDataURL.isEmpty {
            let base64 = imagenDataURL.contains(",")
                ? String(imagenDataURL[imagenDataURL.index(after: imagenDataURL.firstIndex(of: ",")!)...])
                : imagenDataURL
            guard let datos = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else { return false }
            let destino = carpetaReferencias.appendingPathComponent(limpio + ".jpg")
            guard (try? datos.write(to: destino, options: .atomic)) != nil else { return false }
        }
        let ficheroFicha = carpetaReferencias.appendingPathComponent(limpio + ".json")
        return (try? ficha.write(to: ficheroFicha, atomically: true, encoding: .utf8)) != nil
    }

    /// La imagen completa como data URL, lista para un <img src>. Cadena vacía
    /// si ya no está: una ficha puede sobrevivir a su imagen si alguien la borró
    /// desde Archivos, y eso no debe tumbar la mesa entera.
    func leerImagenReferencia(id: String) -> String {
        let limpio = AlmacenEnDisco.idSeguro(id)
        guard !limpio.isEmpty,
              let datos = try? Data(contentsOf: carpetaReferencias.appendingPathComponent(limpio + ".jpg"))
        else { return "" }
        return "data:image/jpeg;base64," + datos.base64EncodedString()
    }

    /// Borrar NO destruye: ficha e imagen se van a la papelera interna con marca
    /// de tiempo, igual que un proyecto. Una referencia buena cuesta encontrarla
    /// y un dedo en un iPad se equivoca de cuadro con facilidad.
    func borrarReferencia(id: String) {
        let limpio = AlmacenEnDisco.idSeguro(id)
        guard !limpio.isEmpty else { return }
        let formato = DateFormatter()
        formato.dateFormat = "yyyyMMdd-HHmmss"
        let marca = formato.string(from: Date())
        for extension_ in ["json", "jpg"] {
            let origen = carpetaReferencias.appendingPathComponent("\(limpio).\(extension_)")
            guard gestor.fileExists(atPath: origen.path) else { continue }
            let destino = carpetaPapelera.appendingPathComponent("\(limpio)-\(marca).\(extension_)")
            try? gestor.moveItem(at: origen, to: destino)
        }
    }

    // MARK: - La agenda de crew

    /* UN archivo por persona, no dos como en la fototeca: el retrato es chico
       y cabe dentro de la propia ficha. Una cara se reconoce a 480 px y eso
       pesa como una página de texto; un fotograma de referencia, en cambio,
       hay que poder abrirlo en grande y por eso allá sí se parte. */

    /// Lee la ficha de todas las personas de la agenda (ListContacts).
    func listarContactos() -> [String] {
        guard let nombres = try? gestor.contentsOfDirectory(atPath: carpetaContactos.path) else { return [] }
        return nombres.sorted().compactMap { nombre in
            guard nombre.lowercased().hasSuffix(".json") else { return nil }
            return try? String(contentsOf: carpetaContactos.appendingPathComponent(nombre), encoding: .utf8)
        }
    }

    /// Guarda (o reemplaza) la ficha de una persona.
    @discardableResult
    func guardarContacto(id: String, ficha: String) -> Bool {
        let limpio = AlmacenEnDisco.idSeguro(id)
        guard !limpio.isEmpty else { return false }
        let destino = carpetaContactos.appendingPathComponent(limpio + ".json")
        return (try? ficha.write(to: destino, atomically: true, encoding: .utf8)) != nil
    }

    /// Borrar NO destruye: la ficha se va a la papelera interna con marca de
    /// tiempo. Los datos de contacto de alguien cuestan meses de conocer gente.
    func borrarContacto(id: String) {
        let limpio = AlmacenEnDisco.idSeguro(id)
        guard !limpio.isEmpty else { return }
        let origen = carpetaContactos.appendingPathComponent(limpio + ".json")
        guard gestor.fileExists(atPath: origen.path) else { return }
        let formato = DateFormatter()
        formato.dateFormat = "yyyyMMdd-HHmmss"
        let destino = carpetaPapelera.appendingPathComponent("\(limpio)-\(formato.string(from: Date())).json")
        try? gestor.moveItem(at: origen, to: destino)
    }
}

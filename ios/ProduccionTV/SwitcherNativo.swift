import CryptoKit
import Darwin
import Foundation
import Network

/// El mismo contrato JSON que `SwitcherStatus` en Go. Es `Sendable` porque los
/// protocolos de red viven fuera del actor principal; sólo la emisión al
/// WKWebView vuelve al hilo de la interfaz.
struct EstadoSwitcherNativo: Codable, Sendable {
    var kind = ""
    var estado = "desconectado"
    var conectado = false
    var programa = ""
    var preview = ""
    var error = ""

    var diccionario: [String: Any] {
        [
            "kind": kind,
            "estado": estado,
            "conectado": conectado,
            "programa": programa,
            "preview": preview,
            "error": error,
        ]
    }
}

private struct FalloSwitcher: LocalizedError, Sendable {
    let mensaje: String
    var errorDescription: String? { mensaje }
}

struct OBSEncontradoNativo: Sendable {
    let host: String
    let nombre: String
    let port: Int

    var diccionario: [String: Any] {
        ["host": host, "nombre": nombre, "port": port]
    }
}

/// Descubre OBS sin Bonjour: toma las interfaces IPv4 privadas activas, limita
/// cada red a un máximo de /24 y confirma el Hello de obs-websocket. Al ser un
/// actor separado, ni getifaddrs ni los timeouts de red ocupan el actor de UI.
actor BuscadorOBSNativo {
    private struct Red: Sendable {
        let ip: UInt32
        let mascara: UInt32
    }

    private final class CajaValor<T>: @unchecked Sendable {
        private let candado = NSLock()
        private var valor: T?

        func guardar(_ nuevo: T) {
            candado.lock()
            valor = nuevo
            candado.unlock()
        }

        func guardarSiVacio(_ nuevo: T) -> Bool {
            candado.lock()
            defer { candado.unlock() }
            guard valor == nil else { return false }
            valor = nuevo
            return true
        }

        func leer() -> T? {
            candado.lock()
            defer { candado.unlock() }
            return valor
        }
    }

    func buscar(puerto: Int) async throws -> [OBSEncontradoNativo] {
        guard (1...65535).contains(puerto) else {
            throw FalloSwitcher(mensaje: "el puerto debe estar entre 1 y 65535")
        }
        let inicio = Date()
        let limite = inicio.addingTimeInterval(3.85)
        let redes = try Self.redesPrivadasActivas()
        let propias = Set(redes.map(\.ip))
        var objetivos = Set<UInt32>()
        for red in redes {
            objetivos.formUnion(Self.hosts(red: red))
        }
        objetivos.subtract(propias) // iPhone/iPad nunca es el servidor OBS.
        var iterator = objetivos.sorted().makeIterator()
        var encontrados: [String] = []

        await withTaskGroup(of: String?.self) { grupo in
            for _ in 0..<64 {
                guard Date() < limite, let ip = iterator.next() else { break }
                let host = Self.textoIPv4(ip)
                grupo.addTask {
                    await Self.sondear(host: host, puerto: puerto, antesDe: limite) ? host : nil
                }
            }
            while let resultado = await grupo.next() {
                if let resultado { encontrados.append(resultado) }
                guard Date() < limite, let ip = iterator.next() else { continue }
                let host = Self.textoIPv4(ip)
                grupo.addTask {
                    await Self.sondear(host: host, puerto: puerto, antesDe: limite) ? host : nil
                }
            }
        }

        var resultado: [OBSEncontradoNativo] = []
        for host in encontrados.sorted() {
            let restante = limite.timeIntervalSinceNow
            let nombre = restante > 0.02
                ? Self.nombreInverso(host, timeout: min(0.3, restante))
                : host
            resultado.append(OBSEncontradoNativo(host: host, nombre: nombre, port: puerto))
        }
        return resultado
    }

    private nonisolated static func redesPrivadasActivas() throws -> [Red] {
        var primero: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&primero) == 0 else {
            throw FalloSwitcher(mensaje: "no se pudieron leer las redes activas")
        }
        defer { freeifaddrs(primero) }
        var redes: [Red] = []
        var actual = primero
        while let interfaz = actual {
            defer { actual = interfaz.pointee.ifa_next }
            let flags = interfaz.pointee.ifa_flags
            guard flags & UInt32(IFF_UP) != 0,
                  flags & UInt32(IFF_RUNNING) != 0,
                  flags & UInt32(IFF_LOOPBACK) == 0,
                  let direccion = interfaz.pointee.ifa_addr,
                  let mascara = interfaz.pointee.ifa_netmask,
                  Int32(direccion.pointee.sa_family) == AF_INET else { continue }
            let ip = direccion.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
                UInt32(bigEndian: $0.pointee.sin_addr.s_addr)
            }
            let mask = mascara.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
                UInt32(bigEndian: $0.pointee.sin_addr.s_addr)
            }
            if Self.esPrivada(ip) {
                redes.append(Red(ip: ip, mascara: mask))
            }
        }
        return redes
    }

    private nonisolated static func esPrivada(_ ip: UInt32) -> Bool {
        (ip & 0xff00_0000) == 0x0a00_0000
            || (ip & 0xfff0_0000) == 0xac10_0000
            || (ip & 0xffff_0000) == 0xc0a8_0000
    }

    private nonisolated static func hosts(red: Red) -> Set<UInt32> {
        let prefijoReal = red.mascara.nonzeroBitCount
        let prefijo = max(24, min(32, prefijoReal))
        guard prefijo < 31 else { return [] }
        let mascara = UInt32.max << UInt32(32 - prefijo)
        let base = red.ip & mascara
        let cantidad = UInt32(1) << UInt32(32 - prefijo)
        return Set((1..<(cantidad - 1)).map { base &+ $0 })
    }

    private nonisolated static func textoIPv4(_ ip: UInt32) -> String {
        "\((ip >> 24) & 255).\((ip >> 16) & 255).\((ip >> 8) & 255).\(ip & 255)"
    }

    private nonisolated static func sondear(host: String, puerto: Int, antesDe limiteGlobal: Date) async -> Bool {
        let limite = min(limiteGlobal, Date().addingTimeInterval(0.45))
        guard await abrirTCP(host: host, puerto: puerto, antesDe: limite), Date() < limite,
              let url = URL(string: "ws://\(host):\(puerto)") else { return false }
        let configuracion = URLSessionConfiguration.ephemeral
        configuracion.timeoutIntervalForRequest = max(0.05, limite.timeIntervalSinceNow)
        configuracion.timeoutIntervalForResource = max(0.05, limite.timeIntervalSinceNow)
        let sesion = URLSession(configuration: configuracion)
        let tarea = sesion.webSocketTask(with: url)
        tarea.resume()
        defer {
            tarea.cancel(with: .normalClosure, reason: nil)
            sesion.invalidateAndCancel()
        }
        do {
            let mensaje = try await recibir(tarea, antesDe: limite)
            let objeto = try objeto(mensaje)
            guard (objeto["op"] as? NSNumber)?.intValue == 0,
                  let datos = objeto["d"] as? [String: Any],
                  !(datos["obsWebSocketVersion"] as? String ?? "").isEmpty else { return false }
            return true
        } catch {
            return false
        }
    }

    private nonisolated static func abrirTCP(host: String, puerto: Int, antesDe limite: Date) async -> Bool {
        guard let endpointPort = NWEndpoint.Port(rawValue: UInt16(puerto)) else { return false }
        return await withCheckedContinuation { continuacion in
            let caja = CajaValor<Bool>()
            let conexion = NWConnection(host: NWEndpoint.Host(host), port: endpointPort, using: .tcp)
            let terminar: @Sendable (Bool) -> Void = { valor in
                guard caja.guardarSiVacio(valor) else { return }
                conexion.cancel()
                continuacion.resume(returning: valor)
            }
            conexion.stateUpdateHandler = { estado in
                switch estado {
                case .ready: terminar(true)
                case .failed, .cancelled: terminar(false)
                default: break
                }
            }
            conexion.start(queue: DispatchQueue.global(qos: .userInitiated))
            DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + max(0.01, limite.timeIntervalSinceNow)) {
                terminar(false)
            }
        }
    }

    private nonisolated static func recibir(_ tarea: URLSessionWebSocketTask,
                                             antesDe limite: Date) async throws -> URLSessionWebSocketTask.Message {
        try await withCheckedThrowingContinuation { continuacion in
            let caja = UnaSolaRespuesta(continuacion)
            let operacion = Task {
                do { caja.terminar(.success(try await tarea.receive())) }
                catch { caja.terminar(.failure(error)) }
            }
            DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + max(0.01, limite.timeIntervalSinceNow)) {
                operacion.cancel()
                caja.terminar(.failure(FalloSwitcher(mensaje: "OBS tardó demasiado en responder")))
            }
        }
    }

    private nonisolated static func objeto(_ mensaje: URLSessionWebSocketTask.Message) throws -> [String: Any] {
        let datos: Data
        switch mensaje {
        case .data(let data): datos = data
        case .string(let texto): datos = Data(texto.utf8)
        @unknown default: throw FalloSwitcher(mensaje: "respuesta inválida de OBS")
        }
        guard let objeto = try JSONSerialization.jsonObject(with: datos) as? [String: Any] else {
            throw FalloSwitcher(mensaje: "respuesta inválida de OBS")
        }
        return objeto
    }

    private nonisolated static func nombreInverso(_ ip: String, timeout: TimeInterval) -> String {
        guard timeout > 0 else { return ip }
        let caja = CajaValor<String>()
        let semaforo = DispatchSemaphore(value: 0)
        DispatchQueue.global(qos: .utility).async {
            var direccion = sockaddr_in()
            direccion.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
            direccion.sin_family = sa_family_t(AF_INET)
            guard inet_pton(AF_INET, ip, &direccion.sin_addr) == 1 else {
                semaforo.signal()
                return
            }
            var buffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let codigo = withUnsafePointer(to: &direccion) { puntero in
                puntero.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    getnameinfo($0, socklen_t(MemoryLayout<sockaddr_in>.size),
                                &buffer, socklen_t(buffer.count), nil, 0, NI_NAMEREQD)
                }
            }
            if codigo == 0 {
                caja.guardar(String(cString: buffer))
            }
            semaforo.signal()
        }
        guard semaforo.wait(timeout: .now() + timeout) == .success,
              var nombre = caja.leer()?.trimmingCharacters(in: .whitespacesAndNewlines),
              !nombre.isEmpty else { return ip }
        while nombre.hasSuffix(".") { nombre.removeLast() }
        if nombre.lowercased().hasSuffix(".local") {
            nombre.removeLast(6)
        }
        return nombre.isEmpty ? ip : nombre
    }
}

private protocol SwitcherNativo: Actor {
    func conectar(host: String, puerto: Int, contrasena: String) async throws
    func desconectar() async
    func ponerPrograma(_ entrada: String) async throws
    func ponerPreview(_ entrada: String) async throws
    func estadoActual() async -> EstadoSwitcherNativo
    func listarEntradas() async throws -> [String]
}

/// Serializa cambios de tipo/conexión igual que `SwitcherManager` en Go. Cada
/// protocolo es a su vez un actor; por eso una respuesta tardía de una conexión
/// anterior no puede pisar el estado de la conexión nueva.
actor GestorSwitcherNativo {
    typealias Emisor = @Sendable (EstadoSwitcherNativo) -> Void

    private var actual: (any SwitcherNativo)?
    private var estado = EstadoSwitcherNativo()
    private var generacion: UInt64 = 0
    private let emitir: Emisor

    init(emitir: @escaping Emisor) {
        self.emitir = emitir
    }

    func conectar(kind tipoCrudo: String, host hostCrudo: String, puerto: Int,
                  contrasena: String) async throws {
        let kind = tipoCrudo.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let host = hostCrudo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard kind == "obs" || kind == "atem" else { throw FalloSwitcher(mensaje: "elige OBS o ATEM") }
        guard !host.isEmpty else { throw FalloSwitcher(mensaje: "escribe la dirección del switcher") }
        guard (1...65535).contains(puerto) else {
            throw FalloSwitcher(mensaje: "el puerto debe estar entre 1 y 65535")
        }

        let anterior = actual
        actual = nil
        generacion &+= 1
        let estaGeneracion = generacion
        if let anterior { await anterior.desconectar() }

        publicar(EstadoSwitcherNativo(kind: kind, estado: "conectando"))
        let aviso: @Sendable (EstadoSwitcherNativo) async -> Void = { [weak self] nuevo in
            await self?.recibir(nuevo, generacion: estaGeneracion)
        }
        let switcher: any SwitcherNativo = kind == "obs"
            ? SwitcherOBS(avisar: aviso)
            : SwitcherATEM(avisar: aviso)
        actual = switcher

        do {
            try await switcher.conectar(host: host, puerto: puerto, contrasena: contrasena)
        } catch {
            await switcher.desconectar()
            guard estaGeneracion == generacion else { throw error }
            actual = nil
            let claro = "no se pudo conectar con \(kind.uppercased()): \(error.localizedDescription)"
            publicar(EstadoSwitcherNativo(kind: kind, estado: "error", error: claro))
            throw FalloSwitcher(mensaje: claro)
        }
    }

    func desconectar() async {
        let anterior = actual
        let kind = estado.kind
        actual = nil
        generacion &+= 1
        if let anterior { await anterior.desconectar() }
        publicar(EstadoSwitcherNativo(kind: kind, estado: "desconectado"))
    }

    func ponerPrograma(_ entrada: String) async throws {
        guard let actual else { throw FalloSwitcher(mensaje: "el switcher no está conectado") }
        try await actual.ponerPrograma(entrada)
    }

    func ponerPreview(_ entrada: String) async throws {
        guard let actual else { throw FalloSwitcher(mensaje: "el switcher no está conectado") }
        try await actual.ponerPreview(entrada)
    }

    func estadoActual() -> EstadoSwitcherNativo { estado }

    func listarEntradas() async throws -> [String] {
        guard let actual else { throw FalloSwitcher(mensaje: "el switcher no está conectado") }
        return try await actual.listarEntradas()
    }

    private func recibir(_ nuevo: EstadoSwitcherNativo, generacion recibida: UInt64) {
        guard recibida == generacion else { return }
        publicar(nuevo)
    }

    private func publicar(_ nuevo: EstadoSwitcherNativo) {
        estado = nuevo
        emitir(nuevo)
    }
}

// MARK: - OBS WebSocket v5

/// Resuelve una continuación exactamente una vez. El WebSocket de Foundation
/// puede terminar su `receive` después del timeout; esta caja evita contestar
/// dos veces y permite que el límite de tres segundos sea real.
private final class UnaSolaRespuesta<T>: @unchecked Sendable {
    private let candado = NSLock()
    private var continuacion: CheckedContinuation<T, Error>?

    init(_ continuacion: CheckedContinuation<T, Error>) {
        self.continuacion = continuacion
    }

    func terminar(_ resultado: Result<T, Error>) {
        candado.lock()
        let pendiente = continuacion
        continuacion = nil
        candado.unlock()
        pendiente?.resume(with: resultado)
    }
}

private actor SwitcherOBS: SwitcherNativo {
    typealias Aviso = @Sendable (EstadoSwitcherNativo) async -> Void

    private var estado = EstadoSwitcherNativo(kind: "obs")
    private var entradas: [String] = []
    private var websocket: URLSessionWebSocketTask?
    private var sesionURL: URLSession?
    private var lector: Task<Void, Never>?
    private var pendientes: [String: CheckedContinuation<Data, Error>] = [:]
    private var siguienteID: UInt64 = 0
    private var intencional = false
    private let avisar: Aviso

    init(avisar: @escaping Aviso) { self.avisar = avisar }

    /// La causa que da iOS, en palabras del usuario. Sin esto todo fallo de red
    /// se ve igual, y el más común en iPhone/iPad no es OBS sino el permiso de
    /// Red local de la app.
    private static func causaDeRed(_ error: Error, host: String) -> String {
        let detalle = String(describing: error)
        if detalle.localizedCaseInsensitiveContains("Local network prohibited") {
            return ". iOS está bloqueando la red local: abre Ajustes → Privacidad y seguridad → Red local y enciende Producción TV."
        }
        let ns = error as NSError
        if error is FalloSwitcher || (ns.domain == NSURLErrorDomain && ns.code == NSURLErrorTimedOut) {
            return ". Nadie contestó en \(host) a tiempo: revisa la IP, que el iPhone/iPad esté en la misma red Wi-Fi que la Mac y que Producción TV esté encendida en Ajustes → Privacidad y seguridad → Red local."
        }
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCannotConnectToHost {
            return ". La Mac en \(host) rechazó la conexión: OBS no está escuchando en ese puerto."
        }
        return " (\(ns.localizedDescription))"
    }

    func conectar(host: String, puerto: Int, contrasena: String) async throws {
        let limite = Date().addingTimeInterval(3)
        guard let url = Self.urlOBS(host: host, puerto: puerto) else {
            throw FalloSwitcher(mensaje: "OBS no contestó. Revisa que OBS esté abierto y que en Herramientas → Ajustes del servidor WebSocket esté marcado «Habilitar servidor WebSocket»")
        }
        let configuracion = URLSessionConfiguration.ephemeral
        configuracion.timeoutIntervalForRequest = 3
        configuracion.timeoutIntervalForResource = 3
        let sesion = URLSession(configuration: configuracion)
        let tarea = sesion.webSocketTask(with: url)
        sesionURL = sesion
        websocket = tarea
        intencional = false
        tarea.resume()

        let saludo: [String: Any]
        do {
            let mensaje = try await Self.recibir(tarea, antesDe: limite)
            saludo = try Self.objeto(mensaje)
        } catch {
            tarea.cancel(with: .goingAway, reason: nil)
            sesion.invalidateAndCancel()
            websocket = nil
            sesionURL = nil
            throw FalloSwitcher(mensaje: "OBS no contestó. Revisa que OBS esté abierto y que en Herramientas → Ajustes del servidor WebSocket esté marcado «Habilitar servidor WebSocket»"
                + Self.causaDeRed(error, host: host))
        }
        guard (saludo["op"] as? NSNumber)?.intValue == 0,
              let datosSaludo = saludo["d"] as? [String: Any] else {
            await limpiarConexion(tarea)
            throw FalloSwitcher(mensaje: "OBS no envió un saludo válido")
        }

        var identificar: [String: Any] = ["rpcVersion": 1, "eventSubscriptions": 4]
        if let autenticacion = datosSaludo["authentication"] as? [String: Any] {
            guard !contrasena.isEmpty else {
                await limpiarConexion(tarea)
                throw FalloSwitcher(mensaje: "OBS pide contraseña. Cópiala de OBS: Herramientas → Ajustes del servidor WebSocket → Mostrar información de conexión")
            }
            identificar["authentication"] = Self.autenticacion(
                contrasena: contrasena,
                sal: autenticacion["salt"] as? String ?? "",
                reto: autenticacion["challenge"] as? String ?? ""
            )
        }

        do {
            try await Self.enviarJSON(["op": 1, "d": identificar], por: tarea)
        } catch {
            await limpiarConexion(tarea)
            throw FalloSwitcher(mensaje: "no se pudo identificar con OBS")
        }
        do {
            let respuesta = try Self.objeto(try await Self.recibir(tarea, antesDe: limite))
            guard (respuesta["op"] as? NSNumber)?.intValue == 2 else { throw FalloSwitcher(mensaje: "") }
        } catch {
            await limpiarConexion(tarea)
            throw FalloSwitcher(mensaje: "la contraseña no coincide con la de OBS. Cópiala otra vez de Herramientas → Ajustes del servidor WebSocket → Mostrar información de conexión")
        }

        lector = Task { [weak self] in await self?.leer(tarea) }
        let restante = limite.timeIntervalSinceNow
        guard restante > 0 else {
            await limpiarConexion(tarea)
            throw FalloSwitcher(mensaje: "OBS tardó demasiado en responder")
        }

        let datosEscenas: Data
        do {
            datosEscenas = try await solicitar("GetSceneList", datos: nil, timeout: min(2, restante))
        } catch {
            await limpiarConexion(tarea)
            throw FalloSwitcher(mensaje: "no se pudo pedir la lista de escenas: \(error.localizedDescription)")
        }
        guard let objeto = try? JSONSerialization.jsonObject(with: datosEscenas) as? [String: Any] else {
            await limpiarConexion(tarea)
            throw FalloSwitcher(mensaje: "no se pudo pedir la lista de escenas: respuesta inválida de OBS")
        }
        let escenas = objeto["scenes"] as? [[String: Any]] ?? []
        // OBS las entrega de abajo hacia arriba; la UI las enseña como OBS.
        entradas = escenas.reversed().compactMap { escena in
            let nombre = (escena["sceneName"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return nombre.isEmpty ? nil : nombre
        }
        estado = EstadoSwitcherNativo(
            kind: "obs", estado: "conectado", conectado: true,
            programa: objeto["currentProgramSceneName"] as? String ?? "",
            preview: objeto["currentPreviewSceneName"] as? String ?? ""
        )
        await avisar(estado)
    }

    func desconectar() async {
        intencional = true
        guard let tarea = websocket else {
            estado = EstadoSwitcherNativo(kind: "obs")
            return
        }
        await limpiarConexion(tarea)
        estado = EstadoSwitcherNativo(kind: "obs")
    }

    func ponerPrograma(_ entradaCruda: String) async throws {
        let entrada = entradaCruda.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !entrada.isEmpty else {
            throw FalloSwitcher(mensaje: "esa cámara no tiene una escena de OBS asignada")
        }
        _ = try await solicitar("SetCurrentProgramScene", datos: ["sceneName": entrada])
    }

    func ponerPreview(_ entradaCruda: String) async throws {
        let entrada = entradaCruda.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !entrada.isEmpty else {
            throw FalloSwitcher(mensaje: "esa cámara no tiene una escena de OBS asignada")
        }
        _ = try await solicitar("SetCurrentPreviewScene", datos: ["sceneName": entrada])
    }

    func estadoActual() -> EstadoSwitcherNativo { estado }

    func listarEntradas() async throws -> [String] {
        guard estado.conectado else { throw FalloSwitcher(mensaje: "conecta OBS para leer sus escenas") }
        return entradas
    }

    private func solicitar(_ tipo: String, datos: [String: Any]?, timeout: TimeInterval = 2) async throws -> Data {
        guard websocket != nil else { throw FalloSwitcher(mensaje: "OBS no está conectado") }
        siguienteID &+= 1
        let id = "ptv-\(siguienteID)"
        var peticion: [String: Any] = ["requestType": tipo, "requestId": id]
        if let datos { peticion["requestData"] = datos }

        return try await withCheckedThrowingContinuation { continuacion in
            pendientes[id] = continuacion
            Task { [weak self] in await self?.enviarPeticion(id: id, contenido: ["op": 6, "d": peticion]) }
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(max(0.01, timeout) * 1_000_000_000))
                await self?.expirar(id)
            }
        }
    }

    private func enviarPeticion(id: String, contenido: [String: Any]) async {
        guard let websocket else {
            resolver(id, con: .failure(FalloSwitcher(mensaje: "OBS no está conectado")))
            return
        }
        do {
            try await Self.enviarJSON(contenido, por: websocket)
        } catch {
            resolver(id, con: .failure(FalloSwitcher(mensaje: "no se pudo enviar la orden a OBS")))
        }
    }

    private func expirar(_ id: String) {
        resolver(id, con: .failure(FalloSwitcher(mensaje: "OBS tardó demasiado en responder")))
    }

    private func resolver(_ id: String, con resultado: Result<Data, Error>) {
        guard let continuacion = pendientes.removeValue(forKey: id) else { return }
        continuacion.resume(with: resultado)
    }

    private func leer(_ tarea: URLSessionWebSocketTask) async {
        while websocket === tarea {
            do {
                let mensaje = try await tarea.receive()
                guard websocket === tarea else { return }
                await atender(try Self.objeto(mensaje))
            } catch {
                guard websocket === tarea else { return }
                websocket = nil
                sesionURL?.invalidateAndCancel()
                sesionURL = nil
                fallarPendientes("se perdió la conexión con OBS")
                estado.conectado = false
                if intencional {
                    estado.estado = "desconectado"
                    estado.error = ""
                } else {
                    estado.estado = "error"
                    estado.error = "se perdió la conexión con OBS"
                    await avisar(estado)
                }
                return
            }
        }
    }

    private func atender(_ mensaje: [String: Any]) async {
        let op = (mensaje["op"] as? NSNumber)?.intValue
        guard let datos = mensaje["d"] as? [String: Any] else { return }
        if op == 5 {
            let tipo = datos["eventType"] as? String ?? ""
            let evento = datos["eventData"] as? [String: Any] ?? [:]
            let escena = evento["sceneName"] as? String ?? ""
            var cambio = false
            if tipo == "CurrentProgramSceneChanged" {
                estado.programa = escena
                cambio = true
            } else if tipo == "CurrentPreviewSceneChanged" {
                estado.preview = escena
                cambio = true
            }
            if cambio {
                await avisar(estado)
            }
            return
        }
        guard op == 7, let id = datos["requestId"] as? String else { return }
        let estadoPeticion = datos["requestStatus"] as? [String: Any] ?? [:]
        if (estadoPeticion["result"] as? Bool) != true {
            var comentario = (estadoPeticion["comment"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if comentario.isEmpty {
                comentario = "OBS rechazó la orden (código \((estadoPeticion["code"] as? NSNumber)?.intValue ?? 0))"
            }
            resolver(id, con: .failure(FalloSwitcher(mensaje: comentario)))
            return
        }
        let respuesta = datos["responseData"] ?? [String: Any]()
        let data = (try? JSONSerialization.data(withJSONObject: respuesta)) ?? Data("{}".utf8)
        resolver(id, con: .success(data))
    }

    private func limpiarConexion(_ tarea: URLSessionWebSocketTask) async {
        if websocket === tarea { websocket = nil }
        lector?.cancel()
        lector = nil
        tarea.cancel(with: .goingAway, reason: nil)
        sesionURL?.invalidateAndCancel()
        sesionURL = nil
        fallarPendientes("se perdió la conexión con OBS")
    }

    private func fallarPendientes(_ mensaje: String) {
        let continuaciones = Array(pendientes.values)
        pendientes.removeAll()
        for continuacion in continuaciones {
            continuacion.resume(throwing: FalloSwitcher(mensaje: mensaje))
        }
    }

    private static func urlOBS(host: String, puerto: Int) -> URL? {
        if host.contains("://"), var partes = URLComponents(string: host) {
            partes.scheme = (partes.scheme == "https" || partes.scheme == "wss") ? "wss" : "ws"
            if partes.port == nil { partes.port = puerto }
            return partes.url
        }
        var partes = URLComponents()
        partes.scheme = "ws"
        partes.host = host
        partes.port = puerto
        return partes.url
    }

    private static func autenticacion(contrasena: String, sal: String, reto: String) -> String {
        let secreto = Data(SHA256.hash(data: Data((contrasena + sal).utf8))).base64EncodedString()
        return Data(SHA256.hash(data: Data((secreto + reto).utf8))).base64EncodedString()
    }

    private static func enviarJSON(_ objeto: [String: Any], por tarea: URLSessionWebSocketTask) async throws {
        let data = try JSONSerialization.data(withJSONObject: objeto)
        guard let texto = String(data: data, encoding: .utf8) else {
            throw FalloSwitcher(mensaje: "no se pudo codificar la orden de OBS")
        }
        try await tarea.send(.string(texto))
    }

    private static func objeto(_ mensaje: URLSessionWebSocketTask.Message) throws -> [String: Any] {
        let data: Data
        switch mensaje {
        case .data(let recibido): data = recibido
        case .string(let texto): data = Data(texto.utf8)
        @unknown default: throw FalloSwitcher(mensaje: "respuesta inválida de OBS")
        }
        guard let objeto = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw FalloSwitcher(mensaje: "respuesta inválida de OBS")
        }
        return objeto
    }

    private static func recibir(_ tarea: URLSessionWebSocketTask,
                                antesDe limite: Date) async throws -> URLSessionWebSocketTask.Message {
        let espera = max(0.01, limite.timeIntervalSinceNow)
        return try await withCheckedThrowingContinuation { continuacion in
            let caja = UnaSolaRespuesta(continuacion)
            let operacion = Task {
                do { caja.terminar(.success(try await tarea.receive())) }
                catch { caja.terminar(.failure(error)) }
            }
            DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + espera) {
                operacion.cancel()
                caja.terminar(.failure(FalloSwitcher(mensaje: "OBS tardó demasiado en responder")))
            }
        }
    }
}

// MARK: - ATEM por UDP

private let atemAckRequest: UInt8 = 0x01
private let atemNewSession: UInt8 = 0x02
private let atemRetransmit: UInt8 = 0x04
private let atemRetransmitRequest: UInt8 = 0x08
private let atemAckReply: UInt8 = 0x10
private let saludoATEM = Data([
    0x10, 0x14, 0x53, 0xab, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3a, 0x00, 0x00,
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])

private struct PendienteATEM: Sendable {
    var paquete: Data
    var enviado: Date
    var reintentos = 0
}

private actor SwitcherATEM: SwitcherNativo {
    typealias Aviso = @Sendable (EstadoSwitcherNativo) async -> Void

    private var estado = EstadoSwitcherNativo(kind: "atem")
    private var conexion: NWConnection?
    private var sessionID: UInt16 = 0x53ab
    private var secuenciaLocal: UInt16 = 0
    private var ultimoRemoto: UInt16 = 0
    private var ultimoContacto = Date()
    private var ultimoSaludo = Date()
    private var pendientes: [UInt16: PendienteATEM] = [:]
    private var esperaConexion: CheckedContinuation<Void, Error>?
    private var timeoutConexion: Task<Void, Never>?
    private var mantenimiento: DispatchSourceTimer?
    private var intencional = false
    private let cola = DispatchQueue(label: "com.producciontv.atem", qos: .userInitiated)
    private let avisar: Aviso

    init(avisar: @escaping Aviso) { self.avisar = avisar }

    func conectar(host: String, puerto: Int, contrasena: String) async throws {
        let limite = Date().addingTimeInterval(3)
        guard let puertoNW = NWEndpoint.Port(rawValue: UInt16(puerto)) else {
            throw FalloSwitcher(mensaje: "no se pudo abrir la conexión UDP")
        }
        let nueva = NWConnection(host: NWEndpoint.Host(host), port: puertoNW, using: .udp)
        conexion = nueva
        sessionID = 0x53ab
        secuenciaLocal = 0
        ultimoRemoto = 0
        ultimoContacto = Date()
        ultimoSaludo = Date()
        pendientes.removeAll()
        intencional = false
        estado = EstadoSwitcherNativo(kind: "atem", estado: "conectando")

        nueva.stateUpdateHandler = { [weak self, weak nueva] nuevo in
            guard let nueva else { return }
            Task { await self?.cambioDeRed(nuevo, conexion: nueva) }
        }
        nueva.start(queue: cola)
        recibirSiguiente(nueva)
        iniciarMantenimiento()
        do {
            try await enviar(saludoATEM, por: nueva, antesDe: limite)
        } catch {
            await cerrar(nueva)
            throw FalloSwitcher(mensaje: "no se pudo enviar el saludo al ATEM")
        }
        if estado.conectado { return }

        try await withCheckedThrowingContinuation { continuacion in
            esperaConexion = continuacion
            let restante = max(0.01, limite.timeIntervalSinceNow)
            timeoutConexion = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(restante * 1_000_000_000))
                await self?.agotarConexion(nueva)
            }
        }
    }

    func desconectar() async {
        intencional = true
        guard let conexion else {
            estado = EstadoSwitcherNativo(kind: "atem")
            return
        }
        await cerrar(conexion)
        estado = EstadoSwitcherNativo(kind: "atem")
    }

    func ponerPrograma(_ entrada: String) async throws { try await enviarOrden("CPgI", entrada: entrada) }
    func ponerPreview(_ entrada: String) async throws { try await enviarOrden("CPvI", entrada: entrada) }
    func estadoActual() -> EstadoSwitcherNativo { estado }
    func listarEntradas() async throws -> [String] { (1...8).map(String.init) }

    private func enviarOrden(_ comando: String, entrada cruda: String) async throws {
        guard let numero = Int(cruda.trimmingCharacters(in: .whitespacesAndNewlines)),
              (0...65535).contains(numero) else {
            throw FalloSwitcher(mensaje: "la entrada ATEM debe ser un número válido")
        }
        guard estado.conectado, let conexion else { throw FalloSwitcher(mensaje: "ATEM no está conectado") }
        secuenciaLocal = (secuenciaLocal &+ 1) & 0x7fff
        if secuenciaLocal == 0 { secuenciaLocal = 1 }
        let secuencia = secuenciaLocal
        let payload = Data([0, 0, UInt8(numero >> 8), UInt8(numero & 0xff)])
        let paquete = Self.paqueteOrden(sesion: sessionID, secuencia: secuencia,
                                       comando: comando, payload: payload)
        pendientes[secuencia] = PendienteATEM(paquete: paquete, enviado: Date())
        do { try await enviar(paquete, por: conexion) }
        catch { throw FalloSwitcher(mensaje: "no se pudo enviar la orden al ATEM: \(error.localizedDescription)") }
    }

    private func recibirSiguiente(_ esperada: NWConnection) {
        esperada.receiveMessage { [weak self, weak esperada] contenido, _, _, error in
            guard let esperada else { return }
            Task { await self?.recibido(contenido, error: error, conexion: esperada) }
        }
    }

    private func recibido(_ contenido: Data?, error: NWError?, conexion esperada: NWConnection) async {
        guard conexion === esperada else { return }
        if let contenido { await atender(contenido) }
        if let error {
            if !intencional {
                estado.conectado = false
                estado.estado = "error"
                estado.error = "se cerró la conexión UDP con el ATEM"
                await avisar(estado)
            }
            _ = error // NWError sólo confirma el cierre; el texto público es estable.
            return
        }
        recibirSiguiente(esperada)
    }

    private func cambioDeRed(_ nuevo: NWConnection.State, conexion esperada: NWConnection) async {
        guard conexion === esperada else { return }
        switch nuevo {
        case .failed:
            if let esperaConexion {
                self.esperaConexion = nil
                esperaConexion.resume(throwing: FalloSwitcher(mensaje: "no se pudo abrir la conexión UDP"))
            } else if !intencional {
                estado.conectado = false
                estado.estado = "error"
                estado.error = "se cerró la conexión UDP con el ATEM"
                await avisar(estado)
            }
        default:
            break
        }
    }

    private func atender(_ paquete: Data) async {
        let bytes = [UInt8](paquete)
        guard bytes.count >= 12 else { return }
        let declarada = Int(Self.u16(bytes, 0) & 0x07ff)
        guard declarada == bytes.count else { return }
        let banderas = bytes[0] >> 3
        let sesion = Self.u16(bytes, 2)
        let idPaquete = Self.u16(bytes, 10)
        ultimoContacto = Date()
        if sesion != 0 { sessionID = sesion }
        if idPaquete != 0 { ultimoRemoto = idPaquete }
        if banderas & atemAckReply != 0 { pendientes.removeValue(forKey: Self.u16(bytes, 4)) }

        if banderas & atemNewSession != 0 {
            estado.estado = "conectado"
            estado.conectado = true
            estado.error = ""
            var acuse = [UInt8](Self.encabezado(banderas: atemAckReply, longitud: 12,
                                                sesion: sesion, reconocido: 0,
                                                retransmitir: 0, id: 0))
            acuse[9] = 0x03
            enviarSinEsperar(Data(acuse))
            timeoutConexion?.cancel()
            timeoutConexion = nil
            if let esperaConexion {
                self.esperaConexion = nil
                esperaConexion.resume()
            }
            await avisar(estado)
            return
        }
        if banderas & atemAckRequest != 0 {
            enviarSinEsperar(Self.encabezado(banderas: atemAckReply, longitud: 12,
                                             sesion: sessionID, reconocido: idPaquete,
                                             retransmitir: 0, id: 0))
        }
        if banderas & atemRetransmitRequest != 0 { reenviar(desde: Self.u16(bytes, 6)) }
        guard bytes.count > 12 else { return }
        var cursor = 12
        while cursor < declarada {
            guard cursor + 8 <= declarada else { return }
            let longitud = Int(Self.u16(bytes, cursor))
            guard longitud >= 8, cursor + longitud <= declarada else { return }
            let nombre = String(bytes: bytes[(cursor + 4)..<(cursor + 8)], encoding: .ascii) ?? ""
            let payload = Array(bytes[(cursor + 8)..<(cursor + longitud)])
            await aplicar(nombre, payload: payload)
            cursor += longitud
        }
    }

    private func aplicar(_ nombre: String, payload: [UInt8]) async {
        guard payload.count >= 4, payload[0] == 0 else { return }
        let entrada = String((UInt16(payload[2]) << 8) | UInt16(payload[3]))
        var cambio = false
        if nombre == "PrgI", estado.programa != entrada {
            estado.programa = entrada
            cambio = true
        } else if nombre == "PrvI", estado.preview != entrada {
            estado.preview = entrada
            cambio = true
        }
        if cambio { await avisar(estado) }
    }

    private func reenviar(desde primera: UInt16) {
        for (secuencia, pendiente) in pendientes where secuencia >= primera {
            var bytes = [UInt8](pendiente.paquete)
            bytes[0] |= atemRetransmit << 3
            enviarSinEsperar(Data(bytes))
        }
    }

    private func iniciarMantenimiento() {
        mantenimiento?.cancel()
        let reloj = DispatchSource.makeTimerSource(queue: cola)
        reloj.schedule(deadline: .now() + 0.5, repeating: 0.5)
        reloj.setEventHandler { [weak self] in Task { await self?.mantener() } }
        mantenimiento = reloj
        reloj.resume()
    }

    private func mantener() async {
        guard conexion != nil, !intencional else { return }
        let ahora = Date()
        for (secuencia, var pendiente) in pendientes {
            guard ahora.timeIntervalSince(pendiente.enviado) >= 0.6 else { continue }
            if pendiente.reintentos >= 3 {
                pendientes.removeValue(forKey: secuencia)
                continue
            }
            pendiente.reintentos += 1
            pendiente.enviado = ahora
            pendientes[secuencia] = pendiente
            var bytes = [UInt8](pendiente.paquete)
            bytes[0] |= atemRetransmit << 3
            enviarSinEsperar(Data(bytes))
        }
        let sinContacto = ahora.timeIntervalSince(ultimoContacto)
        if sinContacto > 5, estado.estado != "error" {
            estado.conectado = false
            estado.estado = "error"
            estado.error = "se perdió la conexión con el ATEM; reintentando"
            await avisar(estado)
        }
        if sinContacto > 5, ahora.timeIntervalSince(ultimoSaludo) > 2 {
            ultimoSaludo = ahora
            enviarSinEsperar(saludoATEM)
        } else if sinContacto > 2, ultimoRemoto != 0 {
            enviarSinEsperar(Self.encabezado(banderas: atemAckReply, longitud: 12,
                                             sesion: sessionID, reconocido: ultimoRemoto,
                                             retransmitir: 0, id: 0))
        }
    }

    private func agotarConexion(_ esperada: NWConnection) async {
        guard conexion === esperada, !estado.conectado else { return }
        if let esperaConexion {
            self.esperaConexion = nil
            esperaConexion.resume(throwing: FalloSwitcher(mensaje: "el ATEM no respondió en tres segundos"))
        }
    }

    private func cerrar(_ esperada: NWConnection) async {
        guard conexion === esperada else { return }
        conexion = nil
        mantenimiento?.cancel()
        mantenimiento = nil
        timeoutConexion?.cancel()
        timeoutConexion = nil
        if let esperaConexion {
            self.esperaConexion = nil
            esperaConexion.resume(throwing: FalloSwitcher(mensaje: "el ATEM no respondió en tres segundos"))
        }
        esperada.stateUpdateHandler = nil
        esperada.cancel()
        pendientes.removeAll()
    }

    private func enviarSinEsperar(_ datos: Data) {
        guard let conexion else { return }
        conexion.send(content: datos, completion: .contentProcessed { _ in })
    }

    private func enviar(_ datos: Data, por conexion: NWConnection) async throws {
        try await withCheckedThrowingContinuation { (continuacion: CheckedContinuation<Void, Error>) in
            conexion.send(content: datos, completion: .contentProcessed { error in
                if let error { continuacion.resume(throwing: error) }
                else { continuacion.resume(returning: ()) }
            })
        }
    }

    private func enviar(_ datos: Data, por conexion: NWConnection, antesDe limite: Date) async throws {
        let espera = max(0.01, limite.timeIntervalSinceNow)
        try await withCheckedThrowingContinuation { (continuacion: CheckedContinuation<Void, Error>) in
            let caja = UnaSolaRespuesta(continuacion)
            conexion.send(content: datos, completion: .contentProcessed { error in
                if let error { caja.terminar(.failure(error)) }
                else { caja.terminar(.success(())) }
            })
            DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + espera) {
                caja.terminar(.failure(FalloSwitcher(mensaje: "el ATEM no respondió en tres segundos")))
            }
        }
    }

    private static func encabezado(banderas: UInt8, longitud: Int, sesion: UInt16,
                                   reconocido: UInt16, retransmitir: UInt16, id: UInt16) -> Data {
        var bytes = [UInt8](repeating: 0, count: longitud)
        poner(UInt16(longitud) & 0x07ff | UInt16(banderas) << 11, en: &bytes, offset: 0)
        poner(sesion, en: &bytes, offset: 2)
        poner(reconocido, en: &bytes, offset: 4)
        poner(retransmitir, en: &bytes, offset: 6)
        poner(id, en: &bytes, offset: 10)
        return Data(bytes)
    }

    private static func paqueteOrden(sesion: UInt16, secuencia: UInt16,
                                     comando: String, payload: Data) -> Data {
        let segmento = 8 + payload.count
        var bytes = [UInt8](encabezado(banderas: atemAckRequest, longitud: 12 + segmento,
                                       sesion: sesion, reconocido: 0,
                                       retransmitir: 0, id: secuencia))
        poner(UInt16(segmento), en: &bytes, offset: 12)
        let nombre = Array(comando.utf8.prefix(4))
        for indice in nombre.indices { bytes[16 + indice] = nombre[indice] }
        bytes.replaceSubrange(20..<(20 + payload.count), with: payload)
        return Data(bytes)
    }

    private static func u16(_ bytes: [UInt8], _ offset: Int) -> UInt16 {
        (UInt16(bytes[offset]) << 8) | UInt16(bytes[offset + 1])
    }

    private static func poner(_ valor: UInt16, en bytes: inout [UInt8], offset: Int) {
        bytes[offset] = UInt8(valor >> 8)
        bytes[offset + 1] = UInt8(valor & 0xff)
    }
}

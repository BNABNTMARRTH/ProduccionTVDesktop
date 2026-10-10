import UIKit
import RoomPlan

/* ESCÁNER DEL FORO — la cinta métrica de Producción TV.
   ---------------------------------------------------------------------------
   RoomPlan reconoce paredes y vanos mientras la persona recorre el espacio.
   Esta pantalla se ocupa sólo de capturar y traducir ese modelo a tres números;
   no toca el proyecto. El resultado vuelve al iframe y allá todavía se pide una
   confirmación antes de pasar por aplicarMedidasForo.

   POR QUÉ LA HUELLA SALE DE LAS PAREDES Y NO DEL PISO. iOS 17 ya expone pisos,
   pero las paredes son la observación que RoomPlan completa de manera más
   uniforme mientras se recorre un foro y, además, traen su dirección y longitud
   de forma directa. Sus extremos forman la misma envolvente del cuarto sin
   depender de que el polígono del piso haya quedado cerrado. */

enum GeometriaDeForo {

    /// Datos mínimos de una pared vistos desde arriba. Es un TUPLE deliberado:
    /// esta función no conoce CapturedRoom ni ningún otro tipo de RoomPlan y se
    /// puede probar con números inventados en cualquier destino Swift.
    typealias Pared = (yaw: Double, centroX: Double, centroZ: Double, ancho: Double)

    /* Devuelve la caja ORIENTADA que envuelve los extremos de las paredes.

       1. Una pared no tiene flecha: yaw y yaw + π son la misma dirección. Por
          eso el promedio se hace duplicando el ángulo y ponderándolo por ancho.
       2. Los muros largos ganan la votación y fijan el eje dominante del foro.
       3. Cada extremo se proyecta sobre ese eje y su perpendicular. La distancia
          entre mínimos y máximos da los dos lados sin inflarlos cuando el escaneo
          está girado respecto a los ejes del mundo de ARKit.

       En un cuarto perfectamente cuadrado los votos paralelos y perpendiculares
       pueden cancelarse; en ese caso se usa la dirección de la pared más larga,
       que sigue produciendo la misma caja salvo por intercambiar sus ejes. */
    static func huella(de paredes: [Pared]) -> (ancho: Double, fondo: Double)? {
        let validas = paredes.filter {
            $0.yaw.isFinite && $0.centroX.isFinite && $0.centroZ.isFinite
                && $0.ancho.isFinite && $0.ancho > 0
        }
        guard !validas.isEmpty else { return nil }

        var votoX = 0.0
        var votoZ = 0.0
        var pesoTotal = 0.0
        for pared in validas {
            votoX += cos(2 * pared.yaw) * pared.ancho
            votoZ += sin(2 * pared.yaw) * pared.ancho
            pesoTotal += pared.ancho
        }

        let dominante: Double
        if hypot(votoX, votoZ) > pesoTotal * 0.001 {
            dominante = 0.5 * atan2(votoZ, votoX)
        } else {
            dominante = validas.max(by: { $0.ancho < $1.ancho })?.yaw ?? 0
        }

        let coseno = cos(dominante)
        let seno = sin(dominante)
        var minimoU = Double.infinity
        var maximoU = -Double.infinity
        var minimoV = Double.infinity
        var maximoV = -Double.infinity

        for pared in validas {
            let dx = cos(pared.yaw) * pared.ancho / 2
            let dz = sin(pared.yaw) * pared.ancho / 2
            for signo in [-1.0, 1.0] {
                let x = pared.centroX + signo * dx
                let z = pared.centroZ + signo * dz
                // u corre con la pared dominante; v, perpendicular a ella.
                let u = x * coseno + z * seno
                let v = -x * seno + z * coseno
                minimoU = min(minimoU, u)
                maximoU = max(maximoU, u)
                minimoV = min(minimoV, v)
                maximoV = max(maximoV, v)
            }
        }

        let ladoU = maximoU - minimoU
        let ladoV = maximoV - minimoV
        guard ladoU.isFinite, ladoV.isFinite, ladoU > 0, ladoV > 0 else { return nil }
        return (max(ladoU, ladoV), min(ladoU, ladoV))
    }
}

@MainActor
final class EscanerDeForo: UIViewController, @preconcurrency RoomCaptureViewDelegate, RoomCaptureSessionDelegate {

    private let alTerminar: ([String: Any]) -> Void
    private let vistaDeCaptura = RoomCaptureView(frame: .zero)
    private let instruccion = UILabel()
    private let botonListo = UIButton(type: .system)
    private var capturaActiva = false
    private var procesando = false
    private var respondio = false

    init(alTerminar: @escaping ([String: Any]) -> Void) {
        self.alTerminar = alTerminar
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
        isModalInPresentation = true
    }

    required init?(coder: NSCoder) {
        fatalError("EscanerDeForo se construye con un cierre de respuesta")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        prepararCaptura()
        prepararControles()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !capturaActiva, !respondio else { return }
        capturaActiva = true
        var configuracion = RoomCaptureSession.Configuration()
        configuracion.isCoachingEnabled = true
        vistaDeCaptura.captureSession.run(configuration: configuracion)
    }

    private func prepararCaptura() {
        vistaDeCaptura.translatesAutoresizingMaskIntoConstraints = false
        vistaDeCaptura.delegate = self
        vistaDeCaptura.captureSession.delegate = self
        view.addSubview(vistaDeCaptura)
        NSLayoutConstraint.activate([
            vistaDeCaptura.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            vistaDeCaptura.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            vistaDeCaptura.topAnchor.constraint(equalTo: view.topAnchor),
            vistaDeCaptura.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func prepararControles() {
        instruccion.text = "Recorre el foro apuntando a las paredes, despacio"
        instruccion.font = .preferredFont(forTextStyle: .body)
        instruccion.adjustsFontForContentSizeCategory = true
        instruccion.textAlignment = .center
        instruccion.numberOfLines = 0
        instruccion.textColor = .label

        let aviso = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
        aviso.translatesAutoresizingMaskIntoConstraints = false
        aviso.layer.cornerRadius = 14
        aviso.clipsToBounds = true
        aviso.contentView.addSubview(instruccion)
        instruccion.translatesAutoresizingMaskIntoConstraints = false

        let botonCancelar = boton(titulo: "Cancelar", color: .secondarySystemBackground, tinta: .label)
        botonCancelar.addTarget(self, action: #selector(cancelar), for: .touchUpInside)

        botonListo.configuration = configuracionDeBoton(titulo: "Listo", color: .systemBlue, tinta: .white)
        botonListo.addTarget(self, action: #selector(terminarCaptura), for: .touchUpInside)
        botonListo.accessibilityHint = "Procesa las paredes recorridas y calcula las medidas"

        let acciones = UIStackView(arrangedSubviews: [botonCancelar, botonListo])
        acciones.translatesAutoresizingMaskIntoConstraints = false
        acciones.axis = .horizontal
        acciones.spacing = 12
        acciones.distribution = .fillEqually

        view.addSubview(aviso)
        view.addSubview(acciones)
        NSLayoutConstraint.activate([
            instruccion.leadingAnchor.constraint(equalTo: aviso.contentView.leadingAnchor, constant: 16),
            instruccion.trailingAnchor.constraint(equalTo: aviso.contentView.trailingAnchor, constant: -16),
            instruccion.topAnchor.constraint(equalTo: aviso.contentView.topAnchor, constant: 12),
            instruccion.bottomAnchor.constraint(equalTo: aviso.contentView.bottomAnchor, constant: -12),

            aviso.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            aviso.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            aviso.leadingAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            aviso.trailingAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),

            acciones.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            acciones.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            acciones.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            acciones.heightAnchor.constraint(greaterThanOrEqualToConstant: 50),
        ])
    }

    private func configuracionDeBoton(titulo: String,
                                      color: UIColor,
                                      tinta: UIColor) -> UIButton.Configuration {
        var configuracion = UIButton.Configuration.filled()
        configuracion.title = titulo
        configuracion.baseBackgroundColor = color
        configuracion.baseForegroundColor = tinta
        configuracion.cornerStyle = .large
        configuracion.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { atributos in
            var nuevos = atributos
            nuevos.font = .preferredFont(forTextStyle: .headline)
            return nuevos
        }
        return configuracion
    }

    private func boton(titulo: String, color: UIColor, tinta: UIColor) -> UIButton {
        let boton = UIButton(type: .system)
        boton.configuration = configuracionDeBoton(titulo: titulo, color: color, tinta: tinta)
        boton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        return boton
    }

    @objc private func cancelar() {
        finalizar(con: ["ok": false, "cancelado": true])
    }

    @objc private func terminarCaptura() {
        guard capturaActiva, !procesando, !respondio else { return }
        procesando = true
        capturaActiva = false
        botonListo.isEnabled = false
        botonListo.configuration?.showsActivityIndicator = true
        botonListo.configuration?.title = "Procesando…"
        instruccion.text = "Calculando las medidas del foro…"
        vistaDeCaptura.captureSession.stop()
    }

    // RoomCaptureView procesa el modelo final sólo después de tocar «Listo».
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData,
                     error: Error?) -> Bool {
        if let error {
            finalizarConError(error.localizedDescription)
            return false
        }
        return procesando && !respondio
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        if let error {
            finalizarConError(error.localizedDescription)
            return
        }
        guard procesando, !respondio else { return }
        finalizar(con: Self.resultado(de: processedResult))
    }

    // Si la sesión termina por temperatura, rastreo o cámara, no dejamos la
    // promesa del WebView esperando: el error vuelve por el mismo cierre.
    // RoomPlan no promete en qué hilo llama a la sesión: se brinca al principal
    // antes de tocar la pantalla o la bandera de «ya respondí».
    nonisolated func captureSession(_ session: RoomCaptureSession,
                                    didEndWith data: CapturedRoomData,
                                    error: Error?) {
        guard let detalle = error?.localizedDescription else { return }
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                if !self.respondio { self.finalizarConError(detalle) }
            }
        }
    }

    private func finalizarConError(_ detalle: String) {
        let texto = detalle.isEmpty ? "No se pudo completar el escaneo del foro." : detalle
        finalizar(con: ["ok": false, "error": texto])
    }

    private func finalizar(con resultado: [String: Any]) {
        guard !respondio else { return }
        respondio = true
        procesando = false
        if capturaActiva {
            capturaActiva = false
            vistaDeCaptura.captureSession.stop()
        }
        let entregar = { [alTerminar] in alTerminar(resultado) }
        if presentingViewController != nil {
            dismiss(animated: true, completion: entregar)
        } else {
            entregar()
        }
    }

    private static func resultado(de cuarto: CapturedRoom) -> [String: Any] {
        let paredes: [GeometriaDeForo.Pared] = cuarto.walls.map { pared in
            // La primera columna de la transformación es el eje local X de la
            // pared: su proyección x/z dice hacia dónde corre el muro.
            let ejeX = pared.transform.columns.0
            let centro = pared.transform.columns.3
            return (
                yaw: atan2(Double(ejeX.z), Double(ejeX.x)),
                centroX: Double(centro.x),
                centroZ: Double(centro.z),
                ancho: Double(pared.dimensions.x)
            )
        }
        guard let huella = GeometriaDeForo.huella(de: paredes),
              let alto = cuarto.walls.map({ Double($0.dimensions.y) }).max(),
              alto.isFinite, alto > 0 else {
            return ["ok": false, "error": "Recorre al menos dos paredes contiguas antes de tocar Listo."]
        }

        let centesimas = { (valor: Double) in (valor * 100).rounded() / 100 }
        return [
            "ok": true,
            "ancho": centesimas(huella.ancho),
            "fondo": centesimas(huella.fondo),
            "alto": centesimas(alto),
            "paredes": cuarto.walls.count,
            "puertas": cuarto.doors.count,
            "ventanas": cuarto.windows.count,
            "aberturas": cuarto.openings.count,
        ]
    }
}

import Foundation
import Vision
import ImageIO
import CoreGraphics

/* EL OJO DE LA APP — leer una imagen y proponer sus etiquetas.
   ---------------------------------------------------------------------------
   La paleta de color se saca sola desde el primer día, y eso es justo lo que
   hace que la mesa de luz sirva sin trabajo previo. Esto extiende la misma idea
   a las otras cuatro etiquetas: cuánta gente sale, qué tan cerrado es el plano,
   si es interior o exterior, y si es de día o de noche.

   POR QUÉ SOLO EN EL iPAD. Usa Vision, el detector que ya viene dentro de
   iPadOS: no hay modelo que descargar, no pesa, no manda nada a internet y no
   hay licencia que leer. En el Mac la app es Go, que no tiene un equivalente a
   mano, así que allá las etiquetas se siguen poniendo a mano. La mesa funciona
   igual en los dos sitios; en el iPad, además, llega medio llena.

   LA REGLA QUE MANDA: PROPONER, NO DECIDIR. Todo esto son conjeturas, y algunas
   fallan. Por eso el analizador devuelve solo aquello de lo que está razonable-
   mente seguro y DEJA VACÍO el resto, y quien lo llama solo rellena las casillas
   que el usuario no haya tocado. Una etiqueta equivocada que aparece sola es
   peor que ninguna: la vas a encontrar meses después buscando otra cosa. */

enum AnalizadorDeImagen {

    /// Analiza una imagen (data URL) y devuelve SOLO las etiquetas de las que
    /// está seguro. Las llaves coinciden con las de la ficha: lugar, momento,
    /// gente, plano. `auto` dice cuáles puso la máquina, para poder marcarlas.
    static func analizar(dataURL: String) -> [String: Any] {
        guard let cg = imagen(de: dataURL) else { return [:] }

        var salida: [String: Any] = [:]

        let (personas, caraMasGrande) = contarGente(cg)
        if let etiqueta = etiquetaDeGente(personas) { salida["gente"] = etiqueta }
        if let plano = etiquetaDePlano(alturaDeCara: caraMasGrande) { salida["plano"] = plano }

        let lugar = detectarLugar(cg)
        if let lugar { salida["lugar"] = lugar }
        if let momento = detectarMomento(cg, lugar: lugar) { salida["momento"] = momento }

        salida["auto"] = salida.keys.sorted()
        return salida
    }

    // MARK: - Descifrar la imagen

    /* Se descifra con ImageIO y no con UIImage a propósito: ImageIO existe
       igual en el Mac, así que este archivo entero se puede compilar suelto con
       swiftc y probarlo de verdad contra fotos, en vez de solo comprobar que
       compila. Un montón de conjeturas sin forma de medirlas no vale nada. */
    static func imagen(de dataURL: String) -> CGImage? {   // interna: la usan las pruebas
        let base64 = dataURL.contains(",")
            ? String(dataURL[dataURL.index(after: dataURL.firstIndex(of: ",")!)...])
            : dataURL
        guard let datos = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
              let fuente = CGImageSourceCreateWithData(datos as CFData, nil),
              let cg = CGImageSourceCreateImageAtIndex(fuente, 0, nil) else { return nil }
        return cg
    }

    // MARK: - Cuánta gente y qué tan cerca

    /* Caras Y cuerpos, no solo caras: alguien de espaldas o a contraluz no tiene
       cara detectable y seguiría siendo una persona en el cuadro. Se queda el
       número MAYOR de los dos.

       La altura de la cara más grande se devuelve aparte porque es de donde sale
       el tipo de plano, y solo sirve si de verdad hubo una cara: un cuerpo se
       recorta con el borde del cuadro y su altura no dice nada. */
    private static func contarGente(_ cg: CGImage) -> (Int, CGFloat?) {
        let manejador = VNImageRequestHandler(cgImage: cg, options: [:])

        let caras = VNDetectFaceRectanglesRequest()
        let cuerpos = VNDetectHumanRectanglesRequest()
        try? manejador.perform([caras, cuerpos])

        let observadasCaras = caras.results ?? []
        let observadosCuerpos = cuerpos.results ?? []

        let cuantas = max(observadasCaras.count, observadosCuerpos.count)
        // La altura viene normalizada (0 a 1) respecto al alto del cuadro.
        let mayor = observadasCaras.map { $0.boundingBox.height }.max()
        return (cuantas, mayor)
    }

    static func etiquetaDeGente(_ n: Int) -> String? {   // interna: se prueba aparte
        switch n {
        case 0: return nil          // no detectar a nadie NO prueba que no haya nadie
        case 1: return "1 persona"
        case 2: return "2 personas"
        case 3...5: return "3 o más"
        default: return "Multitud"
        }
    }

    /* DE LA CARA AL TIPO DE PLANO. Es la misma cuenta que hace un director de
       fotografía sin pensarla: cuánto del alto del cuadro ocupa la cabeza. Los
       cortes salen de las proporciones de manual (la cabeza ronda 1/7 del cuerpo,
       y cada plano nombra dónde se corta la figura).

       Si no hubo cara, no se inventa nada: un cuerpo recortado por el borde del
       cuadro no permite deducir la distancia. */
    static func etiquetaDePlano(alturaDeCara h: CGFloat?) -> String? {   // interna: se prueba aparte
        guard let h, h > 0 else { return nil }
        switch h {
        case 0.50...:     return "Primerísimo Primer Plano"
        case 0.28..<0.50: return "Primer Plano"
        case 0.17..<0.28: return "Plano Medio Corto"
        case 0.11..<0.17: return "Plano Medio"
        case 0.08..<0.11: return "Plano Americano"
        case 0.05..<0.08: return "Plano Entero"
        default:          return "Plano General"
        }
    }

    // MARK: - Interior o exterior

    /* Vision trae un clasificador de escenas con más de mil etiquetas. No se le
       pregunta "¿interior o exterior?" —no responde eso— sino que se suman las
       confianzas de las etiquetas que delatan una cosa o la otra. Se exige un
       margen claro entre las dos sumas: si la imagen no se decide, se deja vacío
       en vez de tirar una moneda. */
    private static let PISTAS_EXTERIOR = [
        "outdoor", "sky", "cloud", "sunset", "sunrise", "beach", "ocean", "sea",
        "mountain", "field", "forest", "tree", "grass", "garden", "park", "snow",
        "desert", "street", "road", "landscape", "building_exterior", "cityscape",
        "bridge", "boat", "lake", "river", "horizon", "sun", "plant",
    ]
    private static let PISTAS_INTERIOR = [
        "indoor", "room", "kitchen", "bedroom", "bathroom", "office", "restaurant",
        "bar", "furniture", "sofa", "couch", "chair", "table", "lamp", "ceiling",
        "curtain", "wall", "door", "window_indoor", "shelf", "bed", "desk",
        "living_room", "dining", "corridor", "staircase", "studio",
    ]

    private static func detectarLugar(_ cg: CGImage) -> String? {
        let peticion = VNClassifyImageRequest()
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([peticion])
        guard let etiquetas = peticion.results else { return nil }

        var fuera: Float = 0, dentro: Float = 0
        for e in etiquetas where e.confidence > 0.05 {
            let id = e.identifier.lowercased()
            if PISTAS_EXTERIOR.contains(where: { id.contains($0) }) { fuera += e.confidence }
            if PISTAS_INTERIOR.contains(where: { id.contains($0) }) { dentro += e.confidence }
        }
        let margen: Float = 0.15
        if fuera > dentro + margen { return "Exterior" }
        if dentro > fuera + margen { return "Interior" }
        return nil
    }

    // MARK: - Día o noche

    /* MANDA LA SOMBRA, NO EL BRILLO MEDIO — y eso salió de medir, no de suponer.
       Sobre la misma foto a tres exposiciones, el promedio daba 0.435 / 0.295 /
       0.115: tres números pegados, y el primero se quedaba por debajo de donde
       yo había puesto el corte del día. La parte del cuadro en sombra profunda
       daba 0.076 / 0.163 / 0.875 — tres mundos distintos. Tiene sentido: la
       noche no es "menos luz repartida", es casi todo negro con algún punto
       encendido, y eso es justo lo que mide la sombra y no el promedio.

       AMANECER Y ATARDECER NO SE PROPONEN. Los tenía puestos por calidez de
       color y al medirlo no se sostiene: la foto de prueba, una aérea de mar,
       da calidez NEGATIVA hasta cuando se la fuerza hacia el naranja, porque el
       azul del agua manda sobre todo lo demás. Sin forma de distinguir un
       atardecer de una tarde azulada —o de una lámpara cálida en un cuarto— la
       conjetura sería una moneda al aire, y una etiqueta falsa que se pone sola
       es peor que ninguna: la encuentras meses después buscando otra cosa.
       Siguen en la lista para ponerlos a mano, que es donde funcionan. */
    private static func detectarMomento(_ cg: CGImage, lugar: String?) -> String? {
        guard let (luz, sombra, _) = medirLuz(cg) else { return nil }
        if sombra > 0.45 && luz < 0.30 { return "Noche" }
        if sombra < 0.22 && luz > 0.33 { return "Día" }
        return nil   // en la duda, callarse
    }

    /// Devuelve (luz media 0-1, parte del cuadro en sombra 0-1, calidez rojo−azul 0-1).
    static func medirLuz(_ cg: CGImage) -> (Double, Double, Double)? {   // interna: se mide en las pruebas
        let ancho = 64, alto = 64
        var pixeles = [UInt8](repeating: 0, count: ancho * alto * 4)
        guard let contexto = CGContext(
            data: &pixeles, width: ancho, height: alto, bitsPerComponent: 8,
            bytesPerRow: ancho * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        contexto.draw(cg, in: CGRect(x: 0, y: 0, width: ancho, height: alto))

        var suma = 0.0, oscuros = 0, sumaR = 0.0, sumaB = 0.0
        let total = ancho * alto
        for i in stride(from: 0, to: pixeles.count, by: 4) {
            let r = Double(pixeles[i]) / 255, g = Double(pixeles[i + 1]) / 255, b = Double(pixeles[i + 2]) / 255
            // Luma de Rec. 709: el ojo no pesa igual los tres canales.
            let y = 0.2126 * r + 0.7152 * g + 0.0722 * b
            suma += y
            if y < 0.20 { oscuros += 1 }
            sumaR += r; sumaB += b
        }
        return (suma / Double(total),
                Double(oscuros) / Double(total),
                (sumaR - sumaB) / Double(total))
    }
}

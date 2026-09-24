import SwiftUI

/*
 EL MARCO NATIVO.

 La app web se pinta de borde a borde —así el fondo llega debajo de la hora y
 del indicador de inicio, y no queda una franja de otro color— pero su CONTENIDO
 se queda dentro del área segura: de eso se encarga adaptacion-ipad.js, que le
 pone al <body> el margen exacto que reporta iOS (env(safe-area-inset-*)).
 Es la misma regla para la isla o muesca del iPhone y para el iPad: fondo
 completo, contenido respetado, en vertical, horizontal, Split View o Stage Manager.
*/
struct VistaPrincipal: View {

    @EnvironmentObject private var interfaz: EstadoDeInterfaz

    var body: some View {
        ZStack {
            // Solo se ve el instante que tarda la app en pintar, y al estirar
            // el contenido más allá del borde.
            (interfaz.oscuro ? Color("FondoLanzamiento") : Color.white)
                .ignoresSafeArea()

            ContenedorWeb()
                .ignoresSafeArea()
        }
        // La hora y la batería, del color que toque según el tema de la app.
        .preferredColorScheme(interfaz.oscuro ? .dark : .light)
        .persistentSystemOverlays(.automatic)
    }
}

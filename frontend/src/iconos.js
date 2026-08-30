// Juego de ICONOS de la app (rediseño 2026-08-11, opción A).
//
// Son dibujos SVG de trazo, no símbolos de teclado: se ven iguales en cualquier
// computadora y se pueden hacer grandes sin que se vean borrosos. Todos usan la
// misma rejilla de 24×24, el mismo grosor de trazo (1.8) y toman el color del
// texto de su botón (`currentColor`), así el icono se ilumina solo cuando su
// herramienta está activa.
//
// Uso:  elemento.innerHTML = icono('perfil');         // tamaño por defecto
//       elemento.innerHTML = icono('perfil', 34);     // tamaño en píxeles
//
// Aquí SOLO viven los dibujos que la app pide de verdad. Antes quedaban los de
// la organización anterior —cuando la barra listaba herramientas y no etapas—
// y ya nadie los llamaba: set, escaleta, diagrama, infografías, inicio.

const TRAZOS = {
  // --- Etapas del flujo de producción (reorganización 2026-08-24) ---
  // Perfil: la ficha de identidad del proyecto (quién habla y a quién).
  perfil: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><circle cx="9" cy="10" r="2.2"/><path d="M5.8 16.5c.5-1.7 1.7-2.6 3.2-2.6s2.7.9 3.2 2.6M15 9.5h3.2M15 13h3.2"/>',
  // Necesidades: la lista de lo que hay que conseguir, con sus palomas.
  necesidades: '<path d="M8 4.5h8a1.5 1.5 0 011.5 1.5v14A1.5 1.5 0 0116 21.5H8A1.5 1.5 0 016.5 20V6A1.5 1.5 0 018 4.5z"/><path d="M9.5 4.5V3h5v1.5M9.3 9.5l1.2 1.2 2.2-2.4M9.3 15l1.2 1.2 2.2-2.4"/>',
  // Planeación: el calendario del rodaje.
  planeacion: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3M8 14h3M8 17h6"/>',
  // Guion: la lista ordenada de lo que pasa y cuánto dura (la escaleta).
  guion: '<path d="M4 6.5h3M4 12h3M4 17.5h3M10 6.5h10M10 12h10M10 17.5h7"/>',
  // Documentos: sacar el paquete terminado de la app.
  salida: '<path d="M12 3.5v11m0 0l-4-4m4 4l4-4M4.5 16.5v2a2 2 0 002 2h11a2 2 0 002-2v-2"/>',
  // Producción / Ensayo: al aire (el punto rojo emitiendo).
  produccion: '<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/><path d="M6.5 6.5a7.8 7.8 0 000 11M17.5 6.5a7.8 7.8 0 010 11M3.5 3.5a12 12 0 000 17M20.5 3.5a12 12 0 010 17"/>',

  // --- Piezas de Inicio (se usan al rediseñar el lanzador) ---
  proyecto: '<path d="M3 9.5h18v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19z"/><path d="M3.6 9.5l1.2-4.3 17 2.2-.5 2.1"/><path d="M8.6 9.2L7.4 5.4M13.6 9.9l-1.2-3.8"/>',
  nuevo: '<path d="M12 5.5v13M5.5 12h13"/>',
  importar: '<path d="M12 20.5v-11m0 0l-4 4m4-4l4 4M4.5 7.5v-2a2 2 0 012-2h11a2 2 0 012 2v2"/>',
  papelera: '<path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10v6M14 10v6"/>',
  ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 114 2.2c-.9.6-1.6 1-1.6 2M12 16.6v.4"/>',
  // Desanclar: sacar el módulo del marco y ponerlo en su propia pestaña.
  // La hoja chica se despega de la grande y sale por la esquina de arriba.
  desanclar: '<path d="M13.5 4.5H19a.5.5 0 01.5.5v5.5M19 5l-6.5 6.5"/><path d="M16 13.5v4A2.5 2.5 0 0113.5 20h-7A2.5 2.5 0 014 17.5v-7A2.5 2.5 0 016.5 8h4"/>',
  // Reanclar: la ventana suelta vuelve a meterse como pestaña.
  reanclar: '<path d="M19.5 10.5V5a.5.5 0 00-.5-.5h-5.5M19 5l-6.5 6.5"/><path d="M16 13.5v4A2.5 2.5 0 0113.5 20h-7A2.5 2.5 0 014 17.5v-7A2.5 2.5 0 016.5 8h4"/>',
  // Cerrar: la cruz de una pestaña.
  cerrar: '<path d="M7 7l10 10M17 7L7 17"/>',
  // Más: agregar una pestaña.
  mas: '<path d="M12 5.5v13M5.5 12h13"/>',
};

// El ensayo ES el aire: mismo dibujo, no una copia del trazo.
TRAZOS.ensayo = TRAZOS.produccion;
// Sol y luna del interruptor de tema.
TRAZOS.sol = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5"/>';
TRAZOS.luna = '<path d="M20.2 14.4A8.4 8.4 0 1 1 9.6 3.8a6.6 6.6 0 0 0 10.6 10.6z"/>';

// Sacar a su propia ventana: una ventana de escritorio con su barra de título
// y una flecha que sale. Es el gesto de arrastrar la pestaña afuera, hecho botón.
TRAZOS.ventana = '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 8.5h18"/><path d="M9.5 15.5l5-5M11 10.5h3.5v3.5"/>';
// Plantillas de set: tarjetas apiladas, la de enfrente con un plano dentro.
TRAZOS.plantillas = '<rect x="3" y="6.5" width="13" height="14" rx="2"/><path d="M7 3.5h11a2 2 0 0 1 2 2v11"/><path d="M6.5 15.5h6M6.5 11.5h3"/>';
// Deshacer / rehacer: la flecha que regresa y la que vuelve a avanzar.
TRAZOS.deshacer = '<path d="M4 8.5h9.5a5.5 5.5 0 1 1 0 11H8"/><path d="M7.5 5 4 8.5 7.5 12"/>';
TRAZOS.rehacer = '<path d="M20 8.5h-9.5a5.5 5.5 0 1 0 0 11H16"/><path d="M16.5 5 20 8.5 16.5 12"/>';
// Guía: la brújula que dice cómo se hace esta pieza y qué le falta.
TRAZOS.guia = '<circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z"/>';

export function icono(nombre, tamano = 24) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return '';
  return `<svg viewBox="0 0 24 24" width="${tamano}" height="${tamano}" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trazo}</svg>`;
}
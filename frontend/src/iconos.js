// Juego de ICONOS de la app (rediseño 2026-08-11, opción A).
//
// Son dibujos SVG de trazo, no símbolos de teclado: se ven iguales en cualquier
// computadora y se pueden hacer grandes sin que se vean borrosos. Todos usan la
// misma rejilla de 24×24, el mismo grosor de trazo (1.8) y toman el color del
// texto de su botón (`currentColor`), así el icono se ilumina solo cuando su
// herramienta está activa.
//
// Uso:  elemento.innerHTML = icono('set');            // tamaño por defecto
//       elemento.innerHTML = icono('set', 34);        // tamaño en píxeles

const TRAZOS = {
  // Infografías: la hoja completa del proyecto (documento con datos).
  infografias: '<rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M7.5 8h9M7.5 16.5v-3M11 16.5v-5.5M14.5 16.5v-2"/>',
  // Set: el espacio físico visto desde arriba (mesa al centro, cámaras a los lados).
  set: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><rect x="9" y="9.5" width="6" height="4" rx="1"/><path d="M6 17.5l2-2M18 17.5l-2-2"/><circle cx="6" cy="7.5" r="1"/><circle cx="18" cy="7.5" r="1"/>',
  // Escaleta: la lista ordenada de lo que pasa y cuánto dura.
  escaleta: '<path d="M4 6.5h3M4 12h3M4 17.5h3M10 6.5h10M10 12h10M10 17.5h7"/>',
  // Diagrama: la ruta de la señal, cajas conectadas por cable.
  diagrama: '<rect x="2.5" y="8.5" width="6" height="7" rx="1.5"/><rect x="15.5" y="4" width="6" height="6" rx="1.5"/><rect x="15.5" y="14" width="6" height="6" rx="1.5"/><path d="M8.5 12h3.5V7h3.5M12 12v5h3.5"/>',
  // Producción: al aire (el punto rojo emitiendo).
  produccion: '<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/><path d="M6.5 6.5a7.8 7.8 0 000 11M17.5 6.5a7.8 7.8 0 010 11M3.5 3.5a12 12 0 000 17M20.5 3.5a12 12 0 010 17"/>',
  // Guías: hojas para imprimir y llenar a mano.
  guias: '<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="8" rx="2"/><path d="M7 13.5h10v7H7z"/>',
  // Exportar: sacar el documento de la app.
  exportar: '<path d="M12 3.5v11m0 0l-4-4m4 4l4-4M4.5 16.5v2a2 2 0 002 2h11a2 2 0 002-2v-2"/>',

  // --- Piezas de Inicio (se usan al rediseñar el lanzador) ---
  proyecto: '<path d="M3 9.5h18v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19z"/><path d="M3.6 9.5l1.2-4.3 17 2.2-.5 2.1"/><path d="M8.6 9.2L7.4 5.4M13.6 9.9l-1.2-3.8"/>',
  nuevo: '<path d="M12 5.5v13M5.5 12h13"/>',
  importar: '<path d="M12 20.5v-11m0 0l-4 4m4-4l4 4M4.5 7.5v-2a2 2 0 012-2h11a2 2 0 012 2v2"/>',
  papelera: '<path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10v6M14 10v6"/>',
  inicio: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19z"/><path d="M9.5 20.5v-6h5v6"/>',
  ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 114 2.2c-.9.6-1.6 1-1.6 2M12 16.6v.4"/>',
  pantalla: '<path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5a1.5 1.5 0 01-1.5 1.5H15M9 20H5.5A1.5 1.5 0 014 18.5V15"/>',
};

// Nombres alternativos: el resto de la app llama 'production' a la pestaña En vivo.
TRAZOS.production = TRAZOS.produccion;

export const NOMBRES_ICONOS = Object.keys(TRAZOS);

export function icono(nombre, tamano = 24) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return '';
  return `<svg viewBox="0 0 24 24" width="${tamano}" height="${tamano}" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trazo}</svg>`;
}

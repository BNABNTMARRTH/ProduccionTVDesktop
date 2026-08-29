/* PUENTE DE ATAJOS: del iframe al caparazón (2026-08-29)
   ------------------------------------------------------------------------
   Cada herramienta de Producción TV vive dentro de un <iframe>, y un iframe es
   OTRO documento: las teclas que recibe no suben a la ventana que lo contiene.
   Por eso los atajos de navegación —⌘1–⌘6 para saltar de etapa, ⌃Tab para
   rotar pestañas, ⌘D para desanclar, ⌘W para cerrar— dejaban de responder en
   cuanto hacías clic dentro de la herramienta, que es justo donde se trabaja.
   Desde fuera parecía que la app se rompía al agrandar la ventana; en realidad
   se rompía al poner el cursor dentro del contenido.

   Aquí se reenvían al caparazón, que es el único que sabe navegar. Se reenvía
   SOLO navegación: deshacer, rehacer y guardar los atiende cada herramienta
   por su cuenta, y mandarlos también por aquí los ejecutaría dos veces. */
(function () {
  // Fuera del escritorio (o abierta suelta) no hay a quién reenviarle nada.
  if (window.parent === window) return;

  var manda = function (e, cancelar) {
    if (cancelar) e.preventDefault();
    try {
      window.parent.postMessage({
        type: 'producciontv:atajo',
        tecla: { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey },
      }, '*');
    } catch (_) { /* si el padre no escucha, no pasa nada */ }
  };

  window.addEventListener('keydown', function (e) {
    // Esc viaja sin cancelarse: el caparazón lo usa para volver a abrir la
    // barra de etapas, pero dentro puede estar cerrando un panel de la
    // herramienta y ese trabajo es suyo.
    if (e.key === 'Escape') { manda(e, false); return; }

    // ⌃Tab / ⌃⇧Tab: rotar entre pestañas del proyecto.
    if (e.key === 'Tab' && e.ctrlKey) { manda(e, true); return; }

    if (!(e.metaKey || e.ctrlKey)) return;

    // ⌘1–⌘6: una etapa por número, en el orden de la barra lateral.
    if (e.key >= '1' && e.key <= '6') { manda(e, true); return; }

    // ⌘D desanclar, ⌘W cerrar la pestaña. Ambos son del caparazón: la
    // herramienta no tiene ni pestañas ni ventanas que gobernar.
    var k = (e.key || '').toLowerCase();
    if (k === 'd' || k === 'w') { manda(e, true); }
  });
})();

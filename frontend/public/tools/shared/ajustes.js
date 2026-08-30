/* PUENTE DE ACCESIBILIDAD: del caparazón a la herramienta (2026-08-30)
   ---------------------------------------------------------------------------
   Cada herramienta vive en un <iframe>, que es OTRO documento: no hereda ni el
   tema ni nada de lo que se estampe en el <html> del marco. El tema ya viajaba
   por su cuenta (producciontv:tema); esto hace lo mismo con los ajustes de
   accesibilidad, que se pintan con shared/accesibilidad.css.

   EL TAMAÑO NO VIAJA, Y ES A PROPÓSITO. La escala se aplica con `zoom` en la
   raíz del caparazón, y el zoom de un documento ARRASTRA a los iframes que
   contiene: la herramienta recibe menos píxeles de CSS y su contenido se ve
   más grande, igual que con el zoom del navegador. Reenviarlo aquí lo
   aplicaría dos veces. */
(function () {
  if (window.parent === window) return;   // abierta suelta: no hay marco que mande

  function poner(a) {
    var raiz = document.documentElement;
    raiz.dataset.contraste = a && a.contraste === 'alto' ? 'alto' : 'normal';
    raiz.dataset.movimiento = a && a.movimiento === 'poco' ? 'poco' : 'normal';
  }

  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'producciontv:ajustes') poner(e.data.ajustes);
  });
})();

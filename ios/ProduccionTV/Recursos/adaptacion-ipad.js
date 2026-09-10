/* AJUSTES DE LA APP AL CRISTAL DEL IPAD
   ---------------------------------------------------------------------------
   Cosas que en un Mac no existen y en una tableta sí. Va en TODOS los
   documentos —el caparazón y cada herramienta dentro de su iframe— porque el
   dedo toca los dos igual; lo que solo tiene sentido en el de afuera (el área
   segura, el color de la hora) va marcado como tal.

   No se toca ni una línea de la app web: todo se aplica desde fuera, para que
   frontend/dist siga siendo la MISMA copia que corre en el escritorio. */

(function () {
  'use strict';
  if (window.__ptvAdaptado) return;
  window.__ptvAdaptado = true;

  var esElDeAfuera = (window.top === window);

  function aplicar() {
    /* 1. QUE NO SE ACERQUE SOLO AL ESCRIBIR. iOS agranda la página cuando el
       cursor entra en un campo con letra chica —y la app tiene muchos—: al
       salir del campo quedaba torcida y había que pellizcar para volver.
       viewport-fit=cover es lo que hace que env(safe-area-inset-*) traiga
       números de verdad más abajo. */
    var vista = document.querySelector('meta[name="viewport"]');
    if (!vista) {
      vista = document.createElement('meta');
      vista.setAttribute('name', 'viewport');
      (document.head || document.documentElement).appendChild(vista);
    }
    metaVista = vista;
    escribirVista(escalaPedida);

    /* 2. EL ÁREA SEGURA, solo en el documento de afuera. La app se pinta de
       borde a borde para que el fondo llegue hasta la orilla, pero su contenido
       se mete hacia adentro lo que diga iPadOS: así la barra de etapas no queda
       debajo de la hora ni el pie debajo del indicador de inicio. El
       border-box es lo que hace que el height:100% de la app siga siendo la
       pantalla y no la pantalla más el margen.
       Dentro de los iframes NO va: ya están colocados dentro de esa zona. */
    var reglas = [
      'html{overscroll-behavior:none}',
      'body{overscroll-behavior:none;-webkit-tap-highlight-color:transparent}',
      /* Mantener apretado un botón no saca la lupa ni el menú de copiar. */
      'button,a,label,summary,[role="button"],[data-modulo],[data-pestana],[data-view],[data-etapa]{',
      '  -webkit-touch-callout:none;-webkit-user-select:none;user-select:none}',
      /* Pero lo que se escribe se selecciona y se copia, como debe ser. */
      'input,textarea,select,[contenteditable="true"],[contenteditable=""]{',
      '  -webkit-user-select:text;user-select:text;-webkit-touch-callout:default}'
    ];
    if (esElDeAfuera) {
      reglas.push(
        '@supports (padding:env(safe-area-inset-top)){',
        '  body{box-sizing:border-box;',
        '       padding-top:env(safe-area-inset-top);',
        '       padding-right:env(safe-area-inset-right);',
        '       padding-bottom:env(safe-area-inset-bottom);',
        '       padding-left:env(safe-area-inset-left)}}'
      );
    }
    var hoja = document.createElement('style');
    hoja.id = 'ptv-ipad';
    hoja.textContent = reglas.join('\n');
    (document.head || document.documentElement).appendChild(hoja);

    seguirElTamano();
    if (esElDeAfuera) vigilarTema();
    else esperarAQueLeDiganQueEs();
  }

  /* LA ETIQUETA DE VISTA, QUE ES DONDE SE DECIDE EL TAMAÑO DE TODO.
     Dos cosas a la vez:

     a) Que no se acerque solo al escribir, y que env(safe-area-inset-*) traiga
        números de verdad (viewport-fit=cover). Eso es lo de siempre.

     b) EL TAMAÑO DE LA CONFIGURACIÓN. La app agranda con `zoom` en la raíz
        (frontend/src/ajustes.js), y en el WebView del iPad eso agranda las
        cajas pero NO la letra: medido a tamaño Máximo, una caja de 100 px se
        dibujaba de 175 y una letra de 14 px se seguía dibujando de 14. Por eso
        crecían los botones y el texto se salía, chico, de su sitio.

        Aquí el tamaño se pide como lo pide una página para móvil: con
        initial-scale. La página se maqueta en un lienzo más chico
        (834 ÷ 1.75 = 476 px a tamaño Máximo) y iPadOS lo dibuja 1.75 veces más
        grande — letra incluida, porque escala el dibujo entero y no cada caja.

        Cuando hay escala NO se pone `width`: `width=device-width` obliga a
        maquetar con los 834 px del iPad y entonces la página se sale por la
        derecha. Sin `width`, el ancho lo deduce de la escala, que es justo el
        que cabe. A tamaño Normal se vuelve a device-width, como cualquier app.

     Probado y descartado por el camino: -webkit-text-size-adjust (está
     desconectado en este WebView: se le puso 175 % y la letra no se movió) y
     el zoom del propio WebView (agranda, pero deja la maquetación en 834 px y
     la página se sale). */
  var metaVista = null;
  var vistaEscrita = null;
  var escalaPedida = 1;

  function escribirVista(escala) {
    if (!metaVista) return;
    if (!(escala > 0)) escala = escalaPedida;
    escalaPedida = escala;
    var contenido = (escala === 1 ? 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0'
      : 'initial-scale=' + escala + ', maximum-scale=' + escala + ', minimum-scale=' + escala)
      + ', user-scalable=no, viewport-fit=cover';
    if (contenido === vistaEscrita) return;
    vistaEscrita = contenido;
    metaVista.setAttribute('content', contenido);
  }

  /* 4. QUE LA LETRA CREZCA CON EL TAMAÑO DE LA CONFIGURACIÓN.
     El problema, tal cual se ve en el iPad: al poner "Enorme" en Configuración
     crecían los botones y las tarjetas, pero el texto de dentro se quedaba
     chico y se salía de su caja. Medido dentro de la app a tamaño Máximo: una
     caja de 100 px se dibujaba de 175 px y una letra de 14 px se seguía
     dibujando de 14.

     Por qué: la app agranda con `zoom` en la raíz (frontend/src/ajustes.js).
     En un Mac eso multiplica todo. En el WebView del iPad, WebKit calcula el
     tamaño de la fuente por su cuenta y el zoom no lo toca; las cajas, que no
     pasan por ahí, sí crecen. De ahí el descuadre.

     Probado y descartado: -webkit-text-size-adjust, que es la perilla con la
     que WebKit recalcula la letra. Se le puso 175 % y getComputedStyle
     confirmaba que estaba en efecto, pero la letra no se movió — en este
     WebView esa perilla está desconectada.

     Lo que sí funciona es el zoom del propio WebView (pageZoom en Swift), el
     mismo que ⌘+ en Safari: agranda la página entera, letra incluida. Así que
     aquí se hace el cambiazo: se le QUITA el zoom de CSS a la raíz y se manda
     el número a la parte nativa, para que el tamaño se aplique una sola vez.

     Quitarlo también deja bien las cuentas de la app: enPxCss() divide entre
     `documentElement.style.zoom`, y con el zoom del WebView las medidas ya
     vienen en píxeles de CSS. Al dejar ese valor vacío, enPxCss() no divide
     nada y el menú de módulos y el recorrido guiado caen donde deben.

     Solo el documento de afuera: el zoom del WebView agranda la página entera,
     iframes incluidos, y dentro de ellos no hay ningún `zoom` que quitar. */
  function seguirElTamano() {
    if (!esElDeAfuera) return;
    var raiz = document.documentElement;
    var borrando = false;

    function igualar() {
      /* La vuelta que provoca nuestro propio borrado no trae nada nuevo. */
      if (borrando) { borrando = false; return; }

      var escrito = raiz.style.zoom;              // vacío = tamaño Normal
      var escala = parseFloat(escrito) || 1;
      /* Se le quita el zoom de CSS: el tamaño lo va a poner la etiqueta de
         vista. Si se quedara, se aplicaría dos veces —el de CSS agrandando las
         cajas y el de la vista agrandando el dibujo— y además enPxCss() de la
         app dividiría entre él sin necesidad, dejando el menú de módulos y el
         recorrido guiado fuera de su sitio. */
      if (escrito) { borrando = true; raiz.style.zoom = ''; }
      escribirVista(escala);
    }

    /* QUÉ SE VIGILA, Y POR QUÉ ESTOS TRES Y NO TODO.
       `style` es donde la app escribe el zoom. Los otros dos son la firma de
       que acaba de pasar `ajustes.aplicar()`: esa función escribe SIEMPRE
       data-contraste y data-movimiento, aunque no cambien. Hacen falta porque
       volver de "Enorme" a "Normal" deja el zoom vacío, y escribir vacío sobre
       vacío no mueve el atributo `style`: sin esa segunda señal la app se
       quedaría agrandada para siempre.

       Y hace falta la lista: mirando TODOS los atributos, esto se disparaba
       también con `data-etapa`, que main.js escribe en <html> cada vez que
       cambias de etapa o de módulo. Como el zoom ya estaba borrado, se leía
       como "la escala volvió a Normal" y el tamaño se perdía al entrar a un
       proyecto o al cambiar de módulo. */
    new MutationObserver(igualar).observe(raiz,
      { attributes: true, attributeFilter: ['style', 'data-contraste', 'data-movimiento'] });
    igualar();
  }

  /* 5. NADA DE ENSEÑAR LA HERRAMIENTA EQUIVOCADA MIENTRAS CARGA.
     Lo que se veía: al entrar a un proyecto, durante un segundo aparecía la
     hoja completa del proyecto (la que empieza por el plano del set) y luego
     saltaba a Perfil.

     Por qué: perfil, set, escaleta, guion… son TODOS el mismo documento
     (tools/infografias/index.html); lo que los distingue es un aviso que manda
     el caparazón después de cargarlo. Hasta que llega, la herramienta se pinta
     en su modo por omisión, que es la hoja completa. En el Mac ese hueco no se
     alcanza a ver; en el iPad, que tarda más en montar, dura casi un segundo.

     La cura es no enseñar nada hasta que el aviso llegue. Se usa visibility y
     no display porque la herramienta MIDE al montarse (el lienzo del plano,
     las columnas de la escaleta): con display:none mediría cero y saldría
     descuadrada, con visibility se calcula todo igual, solo que no se pinta.

     El plazo de gracia es la red de seguridad: si por lo que sea el aviso no
     llega, a los 1.5 s se enseña lo que haya. Más vale la hoja de más que una
     herramienta que no aparece nunca. */
  function esperarAQueLeDiganQueEs() {
    var AVISOS = ['producciontv:load-infografia', 'producciontv:set-mode',
                  'producciontv:hydrate-diagram', 'producciontv:load-exportar'];
    var raiz = document.documentElement;
    var hoja = document.createElement('style');
    hoja.textContent = '.ptv-en-blanco body{visibility:hidden}';
    (document.head || raiz).appendChild(hoja);
    raiz.classList.add('ptv-en-blanco');

    var visto = false;
    function enseniar() {
      if (visto) return;
      visto = true;
      raiz.classList.remove('ptv-en-blanco');
    }

    /* SE ESPERA AL ÚLTIMO AVISO, NO AL PRIMERO. El caparazón manda la
       hidratación DOS veces —en cuanto carga y otra vez 220 ms después— porque
       la herramienta monta sus escuchas al montarse y el primer aviso se le
       pierde. Destapando con el primero se volvía a ver la hoja completa: se
       comprobó en el simulador, con la pantalla equivocada aún en pantalla.
       Por eso cada aviso reinicia una espera corta y solo se destapa cuando
       pasa un rato sin más avisos. */
    var espera = null;
    window.addEventListener('message', function (e) {
      if (!e.data || AVISOS.indexOf(e.data.type) < 0) return;
      clearTimeout(espera);
      espera = setTimeout(function () {
        /* Dos cuadros: el primero es cuando la herramienta reacciona al aviso,
           el segundo cuando ya lo pintó. */
        requestAnimationFrame(function () { requestAnimationFrame(enseniar); });
      }, 350);
    });
    /* Y la red de seguridad: si el aviso no llega nunca, se enseña lo que haya.
       Más vale la hoja de más que una herramienta que no aparece. */
    setTimeout(enseniar, 2000);
  }


  /* 3. DE QUÉ COLOR VA LA HORA. La franja de arriba la pinta iPadOS, no la app,
     y tiene que leerse igual con el tema claro que con el oscuro. La app marca
     el tema en <html data-tema>; sin marca manda el sistema. Se avisa a la
     parte nativa cada vez que eso cambia. */
  function vigilarTema() {
    var canal = window.webkit
      && window.webkit.messageHandlers
      && window.webkit.messageHandlers.producciontv;
    if (!canal) return;

    var oscuroDelSistema = window.matchMedia('(prefers-color-scheme: dark)');
    var ultimo = null;

    function avisar() {
      var elegido = document.documentElement.dataset.tema;
      var tema = elegido || (oscuroDelSistema.matches ? 'oscuro' : 'claro');
      if (tema === ultimo) return;
      ultimo = tema;
      try { canal.postMessage({ fn: 'ReportarTema', args: [tema] }); } catch (e) { /* da igual */ }
    }

    new MutationObserver(avisar).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-tema'] });
    if (oscuroDelSistema.addEventListener) oscuroDelSistema.addEventListener('change', avisar);
    avisar();
  }

  if (document.head) aplicar();
  else document.addEventListener('DOMContentLoaded', aplicar, { once: true });
})();

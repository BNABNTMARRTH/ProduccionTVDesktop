/* PUENTE iPadOS ⟷ APP WEB
   ---------------------------------------------------------------------------
   Esto es lo PRIMERO que corre en la página, antes que una sola línea del
   paquete de la app. Su único trabajo es dejar puestos window.go y
   window.runtime, que es lo que Wails inyectaba en el Mac: el paquete web
   compilado los busca ahí y no pregunta quién los puso.

   Gracias a esto, frontend/dist se copia TAL CUAL a la app del iPad. No hay una
   segunda versión del frontend que mantener ni una rama "para iPad" que se
   separe de la del escritorio a la primera corrección.  */

(function () {
  'use strict';

  /* EN EL IPAD NO HAY SEGUNDA VENTANA. En el Mac, sacar un módulo a su propia
     ventana abre OTRO proceso, que es lo que le da sentido: dos cosas a la vez
     en dos monitores. Aquí una app es una sola ventana, así que "sacar" solo
     tapaba la pantalla con el módulo y había que volver — o sea, lo mismo que
     navegar a él, pero con un rodeo y perdiendo de vista el proyecto.
     La app lee esta bandera y no ofrece el gesto. Las PESTAÑAS sí se quedan:
     ésas viven dentro de la misma ventana y funcionan igual que en el Mac. */
  window.__ptvSinVentanas = true;
  if (window.__ptvPuenteListo) return;
  window.__ptvPuenteListo = true;

  var canal = window.webkit
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers.producciontv;

  /* Cada llamada devuelve una PROMESA, igual que las de Wails: postMessage con
     manejador de respuesta ya es asíncrono del lado nativo. */
  function llamar(nombre, args) {
    if (!canal) {
      return Promise.reject(new Error('El puente nativo no está disponible'));
    }
    return canal.postMessage({ fn: nombre, args: Array.prototype.slice.call(args) });
  }

  /* Las funciones de app.go. La lista es literal a propósito: si algún día
     se agrega una función en Go y no aquí, la app avisa con un error claro en
     lugar de fallar en silencio. */
  var FUNCIONES = [
    'ClaimProject', 'CloseWindow', 'DeleteContact', 'DeleteProjectFile',
    'DeleteReference', 'DeleteTrashFile', 'FocusLauncher', 'FocusProjectWindow',
    'FocusToolWindow', 'GetLaunchContext', 'ListContacts', 'ListOpenProjects',
    'ListOpenTools', 'ListReferences', 'ListTrashFiles', 'LoadAllProjects',
    'LoadProjectFile', 'LoadReferenceImage', 'LoadSettings', 'OpenProjectWindow',
    'OpenToolWindow', 'Print', 'ReadTrashFile', 'SaveBase64File', 'SaveContact',
    'SaveProjectFile', 'SaveReference', 'SaveSettings', 'SaveTextFile',
    'SetWindowTitle', 'StopWatch', 'WatchProject'
  ];

  /* Y estas NO existen en app.go: son capacidades que solo tiene el iPad.
     Van en lista aparte a propósito, para que la de arriba siga siendo un
     espejo exacto de Go y se siga notando si alguna se queda sin puente.
     Quien las use tiene que envolverlas en un try: en el Mac no están. */
  var SOLO_IPAD = ['AnalizarImagen'];

  var App = {};
  FUNCIONES.concat(SOLO_IPAD).forEach(function (nombre) {
    App[nombre] = function () { return llamar(nombre, arguments); };
  });

  window.go = { main: { App: App } };

  /* ------------------------- runtime de Wails -------------------------
     El paquete solo usa EventsOn, WindowIsFullscreen y WindowUnfullscreen,
     pero el módulo runtime.js de Wails toca window.runtime.<lo que sea> en
     cuanto se le llama. Están todas para que ninguna falte, y las que no
     tienen sentido en un iPad no hacen nada en vez de reventar. */

  var oyentes = {};

  function EventsOnMultiple(evento, respuesta, maximo) {
    oyentes[evento] = oyentes[evento] || [];
    var apunte = { respuesta: respuesta, restantes: maximo };
    oyentes[evento].push(apunte);
    return function cancelar() {
      var lista = oyentes[evento] || [];
      var i = lista.indexOf(apunte);
      if (i >= 0) lista.splice(i, 1);
    };
  }

  function repartir(evento, datos) {
    var lista = (oyentes[evento] || []).slice();
    lista.forEach(function (apunte) {
      if (apunte.restantes === 0) return;
      if (apunte.restantes > 0) apunte.restantes -= 1;
      try { apunte.respuesta.apply(null, datos); } catch (e) { console.error(e); }
      if (apunte.restantes === 0) {
        var actual = oyentes[evento] || [];
        var i = actual.indexOf(apunte);
        if (i >= 0) actual.splice(i, 1);
      }
    });
  }

  /* Por aquí entra lo que manda la parte nativa (ver PuenteNativo.emitir):
     hoy, el .ptv que se abre desde Archivos con la app ya corriendo. */
  window.__ptvEmitir = function (evento, dato) { repartir(evento, [dato]); };

  var sinEfecto = function () {};
  var alRegistro = function (nivel) {
    return function (mensaje) { (console[nivel] || console.log).call(console, mensaje); };
  };

  window.runtime = {
    EventsOnMultiple: EventsOnMultiple,
    EventsOn: function (evento, respuesta) { return EventsOnMultiple(evento, respuesta, -1); },
    EventsOnce: function (evento, respuesta) { return EventsOnMultiple(evento, respuesta, 1); },
    EventsOff: function (evento) {
      Array.prototype.slice.call(arguments).forEach(function (nombre) { delete oyentes[nombre]; });
    },
    EventsOffAll: function () { oyentes = {}; },
    EventsEmit: function (evento) { repartir(evento, Array.prototype.slice.call(arguments, 1)); },

    LogPrint: alRegistro('log'),
    LogTrace: alRegistro('log'),
    LogDebug: alRegistro('debug'),
    LogInfo: alRegistro('info'),
    LogWarning: alRegistro('warn'),
    LogError: alRegistro('error'),
    LogFatal: alRegistro('error'),

    /* La app pregunta si está a pantalla completa antes de abrir otra ventana,
       porque en macOS cada ventana a pantalla completa vive en su propio
       escritorio. En el iPad la app SIEMPRE ocupa su espacio y no hay de qué
       salir: se contesta que no y el resto del camino queda igual. */
    WindowIsFullscreen: function () { return Promise.resolve(false); },
    WindowFullscreen: sinEfecto,
    WindowUnfullscreen: sinEfecto,
    WindowIsMaximised: function () { return Promise.resolve(true); },
    WindowIsMinimised: function () { return Promise.resolve(false); },
    WindowIsNormal: function () { return Promise.resolve(true); },
    WindowSetTitle: function (titulo) { return App.SetWindowTitle(titulo); },
    WindowReload: function () { window.location.reload(); },
    WindowReloadApp: function () { window.location.reload(); },
    WindowCenter: sinEfecto,
    WindowShow: sinEfecto,
    WindowHide: sinEfecto,
    WindowMaximise: sinEfecto,
    WindowUnmaximise: sinEfecto,
    WindowToggleMaximise: sinEfecto,
    WindowMinimise: sinEfecto,
    WindowUnminimise: sinEfecto,
    WindowSetSize: sinEfecto,
    WindowGetSize: function () {
      return Promise.resolve({ w: window.innerWidth, h: window.innerHeight });
    },
    WindowSetPosition: sinEfecto,
    WindowGetPosition: function () { return Promise.resolve({ x: 0, y: 0 }); },
    WindowSetBackgroundColour: sinEfecto,
    WindowSetAlwaysOnTop: sinEfecto,
    WindowPrint: function () { return App.Print(); },
    ScreenGetAll: function () { return Promise.resolve([]); },
    BrowserOpenURL: function (url) { window.open(url, '_blank'); },
    Environment: function () {
      return Promise.resolve({ buildType: 'production', platform: 'ios', arch: 'arm64' });
    },
    Quit: function () { return App.CloseWindow(); },
    Hide: sinEfecto,
    Show: sinEfecto,
    ClipboardGetText: function () { return Promise.resolve(''); },
    ClipboardSetText: function (texto) {
      if (navigator.clipboard) return navigator.clipboard.writeText(texto).then(function () { return true; });
      return Promise.resolve(false);
    }
  };
})();

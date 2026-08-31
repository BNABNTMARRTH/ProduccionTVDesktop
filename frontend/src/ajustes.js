/* CONFIGURACIÓN Y ACCESIBILIDAD (2026-08-30)
 * ---------------------------------------------------------------------------
 * De dónde sale: en clase hay quien no alcanza a leer la letra y quien no
 * distingue dónde acaba un botón. La app está hecha de vidrio translúcido y
 * mide TODO en píxeles fijos —el caparazón, las tres herramientas y el
 * generador ya compilado—, así que no había forma de agrandarla desde dentro.
 *
 * EL TAMAÑO SE HACE CON `zoom` EN LA RAÍZ, y ésa es la decisión de fondo:
 *   · Es lo único que agranda A LA VEZ las letras, los botones y las cajas de
 *     texto, que es exactamente lo que se pidió. Pasar la app a `rem` habría
 *     obligado a reescribir 87 tamaños en la hoja del caparazón y otros tantos
 *     en cada herramienta — y el generador es React ya compilado, o sea que no
 *     se puede tocar sin rehacerlo.
 *   · El zoom de un documento ARRASTRA a los iframes que contiene. Medido: a
 *     1.4 el marco de la herramienta pasa de 1330 a 918 px de espacio propio,
 *     o sea que su contenido se ve 1.4 veces más grande. Por eso el tamaño NO
 *     se reenvía a las herramientas: se aplicaría dos veces.
 *   · El precio, y hay que conocerlo: bajo zoom, lo que se MIDE de la pantalla
 *     (getBoundingClientRect) viene ya multiplicado, y si ese número vuelve al
 *     CSS se multiplica otra vez. Para eso está enPxCss() de abajo, y la usan
 *     los tres sitios que miden y devuelven: el vuelo del logo, el menú de
 *     módulos y el recorrido guiado.
 *
 * El contraste y el movimiento sí viajan, por el puente de mensajes, y los
 * pinta una hoja que cargan los cuatro documentos: tools/shared/accesibilidad.css.
 */

import { icono } from './iconos.js';
import { esc } from './constants.js';

const LLAVE = 'producciontv:ajustes';
const LLAVE_TEMA_VIEJA = 'ptv:tema';   // antes del 30-ago el tema vivía aparte

// Los pasos del tamaño. Discretos y con nombre, no un deslizador: quien no
// alcanza a leer tampoco atina a un deslizador fino, y un porcentaje suelto no
// dice nada. El tope son 175 %: más allá, en una ventana de 1440 px, no cabe
// ni una tarjeta de proyecto completa.
export const ESCALAS = [
    { v: 1, nombre: 'Normal' },
    { v: 1.15, nombre: 'Grande' },
    { v: 1.3, nombre: 'Más grande' },
    { v: 1.5, nombre: 'Enorme' },
    { v: 1.75, nombre: 'Máximo' },
];

const POR_OMISION = { tema: '', escala: 1, contraste: 'normal', movimiento: 'normal' };

// Lo guardado puede venir de una versión vieja, de otra ventana o corrupto: se
// acota a valores que la app sabe pintar. Es la única puerta por la que entra
// un ajuste —del disco o de un clic—, así que aquí no pasa nada raro: un
// tamaño inventado vuelve al 100 % en vez de dejar la app en un zoom del que
// no se puede salir porque el panel tampoco se lee.
export const normalizarAjustes = (x = {}) => ({
    tema: x.tema === 'claro' || x.tema === 'oscuro' ? x.tema : '',
    escala: ESCALAS.some((e) => e.v === x.escala) ? x.escala : 1,
    contraste: x.contraste === 'alto' ? 'alto' : 'normal',
    movimiento: x.movimiento === 'poco' ? 'poco' : 'normal',
});

const normalizar = normalizarAjustes;

function leer() {
    let g = {};
    try { g = JSON.parse(localStorage.getItem(LLAVE)) || {}; } catch { /* sin ajustes guardados */ }
    // Migración de una sola vez: quien ya había elegido tema no lo pierde.
    if (g.tema === undefined) {
        try { g.tema = localStorage.getItem(LLAVE_TEMA_VIEJA) || ''; } catch { g.tema = ''; }
    }
    return normalizar(g);
}

const prefiereOscuro = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/* LA ESCALA QUE ESTÁ PUESTA, leída del DOM y no de lo guardado: el DOM es lo
   que de verdad se está viendo, y esto lo consultan las medidas de pantalla.
   Misma razón por la que el tema se lee del DOM (ver más abajo). */
export const escalaAplicada = () => Number(document.documentElement.style.zoom) || 1;

/* De PANTALLA a PÍXELES DE CSS. getBoundingClientRect() devuelve lo que se ve
   —ya multiplicado por la escala—, y un número que vuelve al CSS (un `left`,
   un translate) se multiplica OTRA VEZ al pintarse. Sin esta división, con la
   interfaz al 150 % el logo volaba de más y el menú de módulos aparecía fuera
   de la pantalla. */
export const enPxCss = (medida) => medida / escalaAplicada();

/* `leerDeDisco` / `escribirEnDisco` los pone main.js con las funciones de Go.
   Son opcionales: sin ellas (en las pruebas, o abriendo el HTML suelto) todo
   sigue funcionando contra localStorage, solo que sin compartirse entre
   ventanas. */
export function crearAjustes({ alAplicar, leerDeDisco, escribirEnDisco } = {}) {
    // Se arranca con lo que hay en localStorage —que es instantáneo y evita
    // que la app parpadee al tamaño equivocado— y enseguida se coteja con el
    // disco, que es la verdad compartida (ver sincronizar()).
    let a = leer();

    /* EL TEMA QUE SE ESTÁ VIENDO. Tres estados a propósito: sin elección manda
       el sistema. Se lee del DOM y no de localStorage porque hay WebViews donde
       el almacenamiento no persiste y setItem lanza; leyendo el DOM la app
       sigue funcionando, y lo único que se pierde es recordarlo al reabrir. */
    const temaEfectivo = () => document.documentElement.dataset.tema
        || (prefiereOscuro() ? 'oscuro' : 'claro');

    function guardar() {
        const texto = JSON.stringify(a);
        try { localStorage.setItem(LLAVE, texto); } catch { /* no persiste: se aplica igual */ }
        // Y al disco, que es lo que ven las OTRAS ventanas.
        escribirEnDisco?.(texto);
    }

    /* PONERSE AL DÍA CON LO QUE HAYA EN EL DISCO.
       Cada ventana es un proceso con su propio almacenamiento: la que estaba
       abierta no se entera de que otra cambió el tamaño, y en cuanto tocaba
       cualquier ajuste escribía encima con lo suyo, que estaba viejo. Aquí se
       lee el archivo y se adopta si trae algo distinto.
       Se llama al arrancar y CADA VEZ QUE LA VENTANA RECIBE EL FOCO, que es
       justo el momento en que el usuario vuelve a ella a mirar. */
    async function sincronizar() {
        if (!leerDeDisco) return;
        let texto = '';
        try { texto = (await leerDeDisco()) || ''; } catch { return; }
        if (!texto) { escribirEnDisco?.(JSON.stringify(a)); return; }
        let enDisco;
        try { enDisco = normalizar(JSON.parse(texto)); } catch { return; }
        if (JSON.stringify(enDisco) === JSON.stringify(a)) return;
        a = enDisco;
        try { localStorage.setItem(LLAVE, JSON.stringify(a)); } catch { /* da igual */ }
        aplicar();
        if (!capa.hidden) pinta();
    }

    // Una herramienta recién montada no sabe nada: hay que contárselo entero.
    function mandarA(ventana) {
        if (!ventana) return;
        try {
            ventana.postMessage({ type: 'producciontv:tema', tema: temaEfectivo() }, '*');
            ventana.postMessage({ type: 'producciontv:ajustes',
                ajustes: { contraste: a.contraste, movimiento: a.movimiento } }, '*');
        } catch { /* la herramienta todavía no escucha; la hidratación insiste */ }
    }

    function aplicar() {
        const raiz = document.documentElement;
        if (a.tema) raiz.dataset.tema = a.tema; else delete raiz.dataset.tema;
        raiz.style.zoom = a.escala === 1 ? '' : String(a.escala);
        raiz.dataset.contraste = a.contraste;
        raiz.dataset.movimiento = a.movimiento;
        document.querySelectorAll('iframe').forEach((f) => mandarA(f.contentWindow));
        /* EL TEMA VA COMO ARGUMENTO, no lo va a buscar quien escucha. Esto se
           llama una vez desde dentro de crearAjustes(), o sea ANTES de que la
           constante que recibe el módulo exista: si el aviso tuviera que leer
           `ajustes.temaEfectivo()` reventaría por acceder a una const a medio
           construir — y con ella se caía main.js entero y la ventana se
           quedaba en blanco. Pasado como dato, no hay a quién ir a buscar. */
        alAplicar?.({ tema: temaEfectivo() });
    }

    function poner(campo, valor, foco) {
        a = normalizar({ ...a, [campo]: valor });
        guardar();
        aplicar();
        if (capa && !capa.hidden) pinta(foco);
    }

    /* ------------------------------ EL PANEL ------------------------------ */

    const capa = document.createElement('div');
    capa.className = 'aj-overlay';
    capa.hidden = true;
    document.body.appendChild(capa);

    const ATAJOS = [
        ['⌘1 … ⌘6', 'Saltar a cada etapa del proyecto'],
        ['⌃Tab', 'Rotar entre las pestañas abiertas'],
        ['⌘D', 'Desanclar lo que estás viendo en su propia pestaña'],
        ['⌘W', 'Cerrar la pestaña (el módulo vuelve al recorrido)'],
        ['⌘S', 'Guardar el proyecto en el disco ahora mismo'],
        ['Esc', 'Sacar del logo la barra de etapas · cerrar lo que esté abierto'],
        ['Barra espaciadora', 'En Ensayo: arrancar y pausar el programa'],
    ];

    /* DOS COSAS DISTINTAS, y antes se sacaban de la misma cuenta:
         · si el interruptor SE VE encendido  → ¿lo puesto es el valor de "sí"?
         · qué PONE al picarlo                → lo contrario de lo que hay.
       Se le pasaba un solo valor —el de destino— y el "encendido" se calculaba
       comparando lo actual contra él, o sea contra lo que TODAVÍA no es: daba
       falso siempre. El contraste alto se aplicaba de verdad, pero la palanca
       se quedaba gris, y desde fuera eso se lee como "no registró el cambio".
       Por eso se le dicen los dos valores por su nombre. */
    const interruptor = (campo, siEncendido, siApagado, titulo, cuerpo) => {
        const on = a[campo] === siEncendido;
        const destino = on ? siApagado : siEncendido;
        return `
        <button class="aj-switch${on ? ' on' : ''}" role="switch" aria-checked="${on}"
                data-campo="${campo}" data-valor="${destino}" data-foco="${campo}">
          <span class="aj-switch-caja" aria-hidden="true"><i></i></span>
          <span class="aj-switch-txt"><strong>${esc(titulo)}</strong><small>${esc(cuerpo)}</small></span>
        </button>`;
    };

    function pinta(foco) {
        capa.innerHTML = `
        <div class="aj-card" role="dialog" aria-modal="true" aria-labelledby="aj-titulo">
          <div class="aj-head">
            <h2 id="aj-titulo">${icono('ajustes', 20)} Configuración</h2>
            <button class="aj-cerrar" aria-label="Cerrar configuración">✕</button>
          </div>

          <section class="aj-bloque">
            <h3>Accesibilidad</h3>

            <label class="aj-label" id="aj-tam">Tamaño de la interfaz</label>
            <div class="aj-escalas" role="group" aria-labelledby="aj-tam">
              ${ESCALAS.map((e) => `
                <button class="aj-escala${a.escala === e.v ? ' on' : ''}"
                        data-campo="escala" data-valor="${e.v}" data-foco="escala"
                        aria-pressed="${a.escala === e.v}">
                  <b>${Math.round(e.v * 100)}%</b><span>${e.nombre}</span>
                </button>`).join('')}
            </div>
            <p class="aj-pista">Agranda todo a la vez —las letras, los botones y las cajas de
              texto—, también dentro de las herramientas. Se aplica al momento.</p>

            <div class="aj-muestra" aria-hidden="true">
              <span class="aj-muestra-rot">Así se ve ahora</span>
              <div>
                <label>Nombre del bloque</label>
                <input type="text" value="Entrada del programa" readonly tabindex="-1">
                <button type="button" tabindex="-1">Un botón</button>
              </div>
            </div>

            ${interruptor('contraste', 'alto', 'normal', 'Contraste alto',
                'Quita el vidrio translúcido: fondos sólidos y bordes marcados, para ver dónde empieza y dónde acaba cada botón.')}
            ${interruptor('movimiento', 'poco', 'normal', 'Menos movimiento',
                'Deja la pantalla quieta: sin el vuelo de los botones al logo ni el resto de las animaciones.')}
          </section>

          <section class="aj-bloque">
            <h3>Apariencia</h3>
            <label class="aj-label" id="aj-tema">Tema</label>
            <div class="aj-temas" role="group" aria-labelledby="aj-tema">
              ${[['', 'El del sistema', 'Sigue al Mac'], ['claro', 'Claro', 'Yeso'], ['oscuro', 'Oscuro', 'Foro apagado']]
                .map(([v, n, d]) => `
                <button class="aj-tema${a.tema === v ? ' on' : ''}" data-campo="tema" data-valor="${v}"
                        data-foco="tema" aria-pressed="${a.tema === v}">
                  <b>${n}</b><span>${d}</span>
                </button>`).join('')}
            </div>
          </section>

          <section class="aj-bloque">
            <h3>Atajos de teclado</h3>
            <dl class="aj-atajos">
              ${ATAJOS.map(([k, q]) => `<div><dt>${esc(k)}</dt><dd>${esc(q)}</dd></div>`).join('')}
            </dl>
          </section>

          <p class="aj-nota">Se aplica al momento y vale para toda la app, herramientas incluidas.
            Si tienes otra ventana abierta, se pone al día en cuanto vuelvas a ella.</p>
        </div>`;

        capa.querySelector('.aj-cerrar').onclick = cerrar;
        capa.querySelectorAll('[data-campo]').forEach((b) => {
            b.onclick = () => {
                const v = b.dataset.campo === 'escala' ? Number(b.dataset.valor) : b.dataset.valor;
                poner(b.dataset.campo, v, b.dataset.foco);
            };
        });
        // Volver el foco donde estaba: repintar el panel se lo llevaba, y quien
        // navega con teclado se quedaba en la nada tras cada cambio.
        if (foco) capa.querySelector(`.on[data-foco="${foco}"], [data-foco="${foco}"]`)?.focus();
        else capa.querySelector('.aj-cerrar')?.focus();
    }

    function abrir() {
        if (!capa.hidden) return;
        capa.hidden = false;
        pinta();
    }

    function cerrar() {
        capa.hidden = true;
        capa.innerHTML = '';
    }

    capa.onclick = (e) => { if (e.target === capa) cerrar(); };

    // Arranque: se aplica lo elegido (o nada, y entonces manda el sistema). Y si
    // el usuario cambia el tema del Mac con la app abierta, la app lo sigue —
    // mientras no haya elegido uno a mano.
    aplicar();
    sincronizar();
    window.matchMedia?.('(prefers-color-scheme: dark)')
        .addEventListener?.('change', () => { if (!a.tema) aplicar(); });

    return {
        abrir,
        cerrar,
        sincronizar,
        estaAbierto: () => !capa.hidden,
        mandarA,
        temaEfectivo,
        // El botón de sol/luna del encabezado: un clic, claro ⇄ oscuro. El
        // tercer estado ("el del sistema") vive en el panel, que es donde hay
        // sitio para explicarlo.
        alternarTema: () => poner('tema', temaEfectivo() === 'oscuro' ? 'claro' : 'oscuro'),
    };
}

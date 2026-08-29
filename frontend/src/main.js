import './style.css';
import html2canvas from 'html2canvas';
import appIcon from './assets/images/produccion-tv-256.png';
import { icono } from './iconos.js';
import { CloseWindow, DeleteProjectFile, DeleteTrashFile, FocusLauncher, FocusProjectWindow, GetLaunchContext, ListOpenProjects, ListTrashFiles, LoadAllProjects, LoadProjectFile, OpenProjectWindow, OpenToolWindow, Print, ReadTrashFile, SaveBase64File, SaveProjectFile, SaveTextFile, SetWindowTitle, WatchProject } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { templateCatalog, makeTemplate, diagramFromConfig, infografiaFromDiagram, uid, PROJECT_MODES, normalizeMode } from './templates.js';
import { createProductionView } from './production.js';
import { createNuevoProyecto } from './nuevo-proyecto.js';
import { createTour } from './tour.js';
import { crearPestanas, PRINCIPAL } from './pestanas.js';
import { DEMO_PROJECT_ID, makeDemoProject } from './demo.js';
import { MAX_PROJECTS, STORAGE_KEYS, esc } from './constants.js';
import { PLANTILLAS_SET, cfgDePlantilla, resumenDePlantilla } from './plantillas.js';

/* ----------------------------- Estado ----------------------------- */

const {
    projects: PROJECTS_KEY,
    activeProject: ACTIVE_KEY,
    welcomeSeen: WELCOME_KEY,
    demoSeeded: DEMO_SEEDED_KEY,
    autosave: AUTOSAVE_KEY,
    diagram: DIAGRAM_KEY,
} = STORAGE_KEYS;

// Llama a una función de Go sin que un fallo tumbe lo que sigue. Importa en
// el ARRANQUE: si una versión del .app quedara con el frontend nuevo y el Go
// viejo, una función que no existe lanza en seco (no devuelve promesa, así
// que un .catch no alcanza) y la ventana se quedaría en blanco. Así, a lo
// más, se pierde ese detalle y la app abre igual.
const conGo = (fn, ...args) => {
    try { return Promise.resolve(fn(...args)).catch(() => null); } catch { return Promise.resolve(null); }
};

const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};

/* --------------------- Persistencia en disco (.ptv) ---------------------
La fuente de verdad es ~/Documents/ProduccionTV: un .ptv por proyecto, con el
MISMO paquete que produce el exportador (compartible tal cual). localStorage
queda como caché de arranque y para las ventanas ya abiertas. */

const bundleDeProyecto = (p) => JSON.stringify({
    project: { id: p.id, name: p.name, template: p.template, createdAt: p.createdAt, updatedAt: p.updatedAt },
    infographic: p.cfg,
    diagram: p.diagram || null,
}, null, 2);

// Construye un proyecto a partir de un paquete {project, infographic, diagram}
// o de un cfg suelto del generador. conservarId: true al leer del disco
// (misma identidad), false al importar (identidad nueva, evita colisiones).
function proyectoDesdeBundle(data, { conservarId = true } = {}) {
    let cfg = null;
    let diagram = null;
    let meta = null;
    if (data && data.infographic && Array.isArray(data.infographic.camaras)) {
        cfg = data.infographic;
        diagram = data.diagram || null;
        meta = data.project || null;
    } else if (data && Array.isArray(data.camaras)) {
        cfg = data;
    } else {
        return null;
    }
    // Migración: los proyectos anteriores a los modos se interpretan como
    // "programa en vivo" (el flujo original de circuito cerrado). No destructivo.
    if (cfg && !cfg.modo) cfg.modo = 'live';
    return {
        id: (conservarId && meta?.id) || uid('project'),
        name: String(meta?.name || cfg.titulo || 'Proyecto importado').trim() || 'Proyecto importado',
        template: meta?.template || 'vacio',
        createdAt: meta?.createdAt || new Date().toISOString(),
        updatedAt: meta?.updatedAt || new Date().toISOString(),
        cfg,
        diagram: diagram || diagramFromConfig(cfg),
    };
}

function saveProjectToDisk(p) {
    if (p) SaveProjectFile(p.id, bundleDeProyecto(p)).catch(() => {});
}

let projects = readJSON(PROJECTS_KEY, []);
let activeProjectId = localStorage.getItem(ACTIVE_KEY) || '';
let activeProject = projects.find((p) => p.id === activeProjectId) || null;
let latestInfografia = activeProject?.cfg || readJSON(AUTOSAVE_KEY, null);
let latestDiagram = activeProject?.diagram || readJSON(DIAGRAM_KEY, null);
let activeView = 'home';
let saveTimer;
/* ---- PANELES: cada herramienta, montada y viva ------------------------
Un PANEL es un iframe con una herramienta dentro. La pestaña "Proyecto"
tiene UNO, que va cambiando de herramienta conforme navegas por etapas.
Cada módulo desanclado tiene el SUYO, que se queda montado aunque estés
mirando otra pestaña: por eso al volver sigue exactamente donde lo dejaste.

`sello` es la versión del proyecto que ese panel tiene pintada. Sube con
cada cambio, y un panel se vuelve a hidratar SOLO cuando se muestra y su
sello quedó atrás. Si se hidratara en caliente, a la herramienta escondida
se le reescribiría el contenido mientras tecleas en otra y perdería el
cursor; así, en cambio, se pone al día justo al asomarse. */
let selloEstado = 0;
const marcarCambio = () => { selloEstado += 1; };
const paneles = new Map();          // vista desanclada -> panel
let panelPrincipal;                 // el de la pestaña Proyecto (se arma abajo)
const panelesVivos = () => [panelPrincipal, ...paneles.values()];
const panelDeVentana = (win) => panelesVivos().find((p) => p?.el?.contentWindow === win) || null;
let pendingDeleteId = null;
let pendingDeleteTimer;

/* ------------------------------- ETAPAS -------------------------------
El proyecto se recorre por ETAPAS de producción, no por herramientas
(reorganización 2026-08-24). La barra lateral muestra las etapas; cuando una
etapa tiene más de una sección, aparece la barra de secciones bajo el
encabezado. Cada vista pertenece a UNA sola etapa, para que siempre se sepa
dónde está uno. */
const ETAPAS = [
    { id: 'perfil', n: '1', etiqueta: 'Perfil', icono: 'perfil',
      ayuda: 'Quién habla, qué dice y a quién (⌘1)',
      secciones: [['perfil', 'Datos y mensaje']] },
    { id: 'guion', n: '2', etiqueta: 'Guion', icono: 'guion',
      ayuda: 'Qué pasa, en qué orden y cómo se ve cada toma (⌘2)',
      secciones: [['guionLiterario', 'Guion literario', 'narrative'], ['escaleta', 'Escaleta y guion técnico'], ['tiempos', 'Tiempos']] },
    { id: 'necesidades', n: '3', etiqueta: 'Necesidades', icono: 'necesidades',
      ayuda: 'Todo lo que hay que conseguir: gente y equipo (⌘3)',
      secciones: [['necesidades', 'Personas y equipo'], ['diagrama', 'Ruta de señal']] },
    { id: 'planeacion', n: '4', etiqueta: 'Planeación', icono: 'planeacion',
      ayuda: 'Cómo se organiza el rodaje: plano del set y la infografía del proyecto (⌘4)',
      secciones: [['set', 'Plano del set'], ['infografias', 'Infografía']] },
    { id: 'salida', etiqueta: 'Documentos', icono: 'salida',
      ayuda: 'El resultado: el paquete de entrega y las hojas para imprimir (⌘5)',
      secciones: [['exportar', 'Exportar']] },
    { id: 'ensayo', etiqueta: 'Ensayo', icono: 'ensayo', soloVivo: true,
      ayuda: 'En vivo: cronómetro, tally y teleprompter (⌘6)',
      secciones: [['production', 'En vivo']] },
];

// Vistas del LANZADOR: no pertenecen a ningún proyecto (son la ventana de
// Inicio). No llevan cabecera y comparten la barra lateral de Inicio.
const VISTAS_INICIO = ['home', 'plantillas'];

// Vista -> etapa a la que pertenece (se calcula una vez).
const ETAPA_DE_VISTA = Object.fromEntries(
    ETAPAS.flatMap((e) => e.secciones.map(([vista]) => [vista, e.id])),
);
const etapaPorId = (id) => ETAPAS.find((e) => e.id === id);
// Secciones que aplican al modo del proyecto (el tercer elemento las limita a
// uno solo: el guion literario es de proyectos narrativos, no de un programa
// en vivo, donde la escaleta son bloques y no escenas).
const seccionesDe = (etapa, modo) => (etapa?.secciones || []).filter(([, , soloModo]) => !soloModo || soloModo === modo);
const primeraVista = (etapa, modo) => (seccionesDe(etapa, modo)[0] || etapa.secciones[0])[0];

/* ----------------------------- Estructura ----------------------------- */

const showWelcome = !localStorage.getItem(WELCOME_KEY);

document.querySelector('#app').innerHTML = `
  <div class="pared" aria-hidden="true"></div>
  <div class="desktop-shell">
    <!-- EL LOGO ES EL INTERRUPTOR DE LA BARRA (2026-08-29). Antes esto lo hacía
         un botón ⤢ del encabezado, y escondía la barra lateral Y el encabezado
         entero: al pulsarlo te quedabas sin etapas, sin pestañas y sin
         secciones —o sea, sin manera de cambiar de módulo— y la única salida
         era adivinar la tecla Esc. Ahora el interruptor es el propio logo:
         nunca se va, viaja de la barra al encabezado y de vuelta, y los
         botones de etapa se le meten dentro (y vuelven a salir) con la
         animación de style.css. Cuelga del SHELL y no de <nav> justamente para
         poder viajar entre los dos sitios sin que la barra lo recorte. -->
    <button class="rail-logo" id="logo-btn" type="button" aria-controls="rail" aria-expanded="true">
      <img src="${appIcon}" alt="Producción TV">
      <span class="rail-logo-aro" aria-hidden="true"></span>
    </button>
    <nav class="rail" id="rail" aria-label="Herramientas">
      <div class="rail-group" id="rail-home" hidden>
        <button data-accion="proyectos" class="active" title="Todos tus proyectos">
          <span class="ic">${icono('proyecto', 26)}</span><em>Proyectos</em>
        </button>
        <button data-accion="nuevo" title="Crear un proyecto nuevo con el asistente">
          <span class="ic">${icono('nuevo', 26)}</span><em>Nuevo</em>
        </button>
        <button data-accion="plantillas" title="Sets ya armados: podcast, entrevista, noticiero, panel…">
          <span class="ic">${icono('plantillas', 26)}</span><em>Plantillas</em>
        </button>
        <button id="import-project" title="Abre un proyecto .ptv exportado desde otra computadora (también puedes soltarlo sobre la ventana)">
          <span class="ic">${icono('importar', 26)}</span><em>Importar</em>
        </button>
        <button id="open-trash" title="Los proyectos eliminados se pueden restaurar desde aquí">
          <span class="ic">${icono('papelera', 26)}</span><em>Papelera</em>
        </button>
      </div>
      <div class="rail-group" id="rail-tools">
      ${ETAPAS.map((e, i) => `${e.id === 'salida' ? '<div class="rail-sep"></div>' : ''}
      <button data-etapa="${e.id}" title="${e.ayuda}">
        <span class="ic">${icono(e.icono, 26)}${e.n ? `<b class="rail-num">${e.n}</b>` : ''}</span><em>${e.etiqueta}</em>
      </button>`).join('')}
      </div>
    </nav>
    <main class="workspace">
      <!-- UNA SOLA BARRA (2026-08-28). Antes había dos franjas en la cabeza de
           la ventana —la del shell y la de la herramienta dentro del iframe—
           y en el hueco entre ambas colgaban las pestañas y las secciones.
           Ahora todo eso vive AQUÍ: identidad a la izquierda, navegación al
           centro y acciones a la derecha. La herramienta ya no dibuja barra
           propia (ver GeneradorInfografiaTV.jsx, la bandera EMBEDDED) y sus botones
           —deshacer, rehacer y la guía— se manejan desde esta misma barra por
           el puente de mensajes. -->
      <header class="workspace-header" id="workspace-header">
        <button class="offline-badge" id="active-name" title="Ir a Inicio: proyectos y plantillas">Guardado local</button>
        <span class="mode-chip" id="mode-chip" title="Modo del proyecto. Se elige al crearlo y define las herramientas disponibles."></span>
        <div class="header-nav" id="header-nav">
          <nav class="pestanas" id="pestanas" hidden role="tablist" aria-label="Pestañas del proyecto"></nav>
          <nav class="secciones" id="secciones" hidden aria-label="Secciones de la etapa"></nav>
        </div>
        <div class="header-actions">
          <span class="save-status" id="save-status">Guardado local</span>
          <span class="header-sep" id="tool-acciones" hidden>
            <button id="undo-btn" title="Deshacer (⌘Z)" aria-label="Deshacer">${icono('deshacer', 17)}</button>
            <button id="redo-btn" title="Rehacer (⌘⇧Z)" aria-label="Rehacer">${icono('rehacer', 17)}</button>
            <button id="guia-btn" title="Guía: cómo se hace este tipo de pieza y qué le falta a la tuya" aria-label="Guía">${icono('guia', 17)}</button>
          </span>
          <button id="tema-btn" title="Cambiar entre claro y oscuro">${icono('sol', 17)}</button>
          <button id="tour-btn" title="Recorrido guiado: cómo usar la app paso a paso">${icono('ayuda', 17)}</button>
          <button id="desanclar-btn" title="Desanclar esta sección en su propia pestaña (⌘D). Después puedes arrastrar la pestaña fuera para abrirla en otra ventana.">${icono('desanclar', 17)}</button>
        </div>
      </header>
      <section class="home-view" id="home-view">
        <div class="home-top">
          <div>
            <span class="eyebrow">ATJ · PRODUCCIÓN AUDIOVISUAL</span>
            <h1>Tus proyectos</h1>
            <p class="home-sub"><span id="project-count"></span><span id="home-sub-text"></span></p>
          </div>
          <div class="home-tools">
            <input id="project-search" class="project-search" type="search" placeholder="Buscar proyecto…" aria-label="Buscar proyecto por nombre">
            <button id="new-project-focus">${icono('nuevo', 17)} Nuevo proyecto</button>
          </div>
        </div>
        <div id="continue-slot"></div>
        <div class="proj-grid" id="recent-projects"></div>
        <input type="file" id="import-file" accept=".ptv,.json" hidden>
        <p class="home-credit">Hecha por <strong>Aldo Abiud Torres Juárez</strong>, alumno de la FCC, para las y los alumnos de la FCC.</p>
      </section>

      <!-- GALERÍA DE PLANTILLAS DE SET. Cada tarjeta enseña el plano cenital
           de verdad (el mismo dibujo que sale impreso), no un icono: se ve el
           espacio antes de crear el proyecto. -->
      <section class="tpl-view" id="templates-view" hidden>
        <div class="home-top">
          <div>
            <span class="eyebrow">ATJ · PRODUCCIÓN AUDIOVISUAL</span>
            <h1>Plantillas de set</h1>
            <p class="home-sub">Empieza con el espacio ya armado: cámaras, gente, micrófonos e iluminación puestos. Todo se mueve y se cambia dentro.</p>
          </div>
          <div class="home-tools">
            <button id="tpl-vacio">${icono('nuevo', 17)} Mejor empezar vacío</button>
          </div>
        </div>
        <div class="tpl-grid" id="tpl-grid"></div>
      </section>

      <div class="frame-wrap" id="frame-wrap"><div class="loading" id="loading"><span></span>Cargando herramienta…</div><iframe id="tool-frame" class="panel" title="Herramienta de Producción TV" allow="clipboard-read; clipboard-write"></iframe></div>
      <section class="production-view" id="production-view"></section>
      <div class="export-toast" id="export-toast"></div>
    </main>
  </div>
  ${showWelcome ? `
  <div class="welcome-overlay" id="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div class="welcome-card">
      <img src="${appIcon}" alt="Icono de Producción TV">
      <span class="eyebrow">ATJ · PRODUCCIÓN AUDIOVISUAL</span>
      <h1 id="welcome-title">Herramienta de Producción</h1>
      <p>Hecha por <strong>Aldo Abiud Torres Juárez</strong>, alumno de la FCC, para las y los alumnos de la FCC.</p>
      <button id="welcome-close" autofocus>Comenzar</button>
    </div>
  </div>` : ''}`;

// perfil, necesidades, set y escaleta son vistas enfocadas del MISMO generador:
// cambia el `mode` que se envía al hidratar, no el iframe.
const toolInfo = {
    infografias: { title: 'Infografía del proyecto', description: 'La hoja completa: set, escaleta, personal y branding', src: './tools/infografias/index.html', mode: 'vista' },
    perfil: { title: 'Perfil del proyecto', description: 'Quién habla, qué dice y a quién: datos generales, mensaje e intención', src: './tools/infografias/index.html', mode: 'perfil' },
    necesidades: { title: 'Necesidades', description: 'Qué hace falta conseguir: talentos, personal, cámaras y micrófonos', src: './tools/infografias/index.html', mode: 'necesidades' },
    guionLiterario: { title: 'Guion literario', description: 'El guion en su forma tradicional: encabezado, acción, personaje y diálogo', src: './tools/infografias/index.html', mode: 'guion' },
    tiempos: { title: 'Tiempos y salida a edición', description: 'Rundown con duraciones, análisis de tiempos y exportación EDL/CSV', src: './tools/infografias/index.html', mode: 'tiempos' },
    set: { title: 'Set', description: '¿Qué hay en el espacio físico y quién lo opera?', src: './tools/infografias/index.html', mode: 'set' },
    escaleta: { title: 'Escaleta / Rundown', description: '¿Qué pasa primero, qué pasa después y cuánto dura cada bloque?', src: './tools/infografias/index.html', mode: 'escaleta' },
    diagrama: { title: 'Diagrama de señal', description: 'Diseña y valida el flujo de video, audio y streaming', src: './tools/diagrama/index.html' },
    exportar: { title: 'Exportar', description: 'Configura qué exportar, en qué formato, qué secciones incluir y en qué orden', src: './tools/exportar/index.html' },
};

/* ---- TEMA CLARO / OSCURO ----------------------------------------------
   Tres estados a propósito: si el usuario no elige, se respeta lo que tenga
   puesto el sistema; si elige, manda lo suyo y se recuerda.
   El contenido vive en un IFRAME, que es otro documento y no hereda el tema:
   hay que mandárselo por el mismo puente que ya usa todo lo demás. */
const TEMA_LLAVE = 'ptv:tema';
const leerTema = () => { try { return localStorage.getItem(TEMA_LLAVE) || ''; } catch { return ''; } };
const prefiereOscuro = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/* LO QUE SE ESTÁ VIENDO AHORA. La única verdad es el DOM, no lo guardado.
   Antes el botón calculaba el siguiente tema leyendo localStorage, y si el
   almacenamiento no persiste —pasa en algunos WebView, y ahí setItem lanza y
   el try/catch se lo traga— siempre calculaba el MISMO destino: funcionaba
   una vez y se atoraba. Leyendo el DOM alterna aunque no se pueda guardar
   nada; lo único que se pierde entonces es recordarlo al reabrir. */
const temaActual = () => document.documentElement.dataset.tema
  || (prefiereOscuro() ? 'oscuro' : 'claro');

function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
  const oscuro = temaActual() === 'oscuro';
  const btn = document.querySelector('#tema-btn');
  if (btn) {
    btn.innerHTML = icono(oscuro ? 'luna' : 'sol', 17);
    btn.title = oscuro ? 'Cambiar a claro' : 'Cambiar a oscuro';
  }
  // Al iframe hay que decírselo: no comparte hoja de estilos con el marco.
  document.querySelectorAll('iframe').forEach((f) => {
    try { f.contentWindow?.postMessage({ type: 'producciontv:tema', tema: temaActual() }, '*'); } catch {}
  });
}

function alternarTema() {
  const nuevo = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
  try { localStorage.setItem(TEMA_LLAVE, nuevo); } catch {}
  aplicarTema(nuevo);
}

const shell = document.querySelector('.desktop-shell');
const frame = document.querySelector('#tool-frame');
// El panel de la pestaña "Proyecto": el iframe que ya existía en el HTML.
// Se registra igual que los desanclados para que todo el resto del código
// (hidratar, escuchar mensajes, imprimir) trate a todos por igual.
panelPrincipal = { vista: null, sello: -1, escucha: false, el: frame, temporizador: 0 };
const frameWrap = document.querySelector('#frame-wrap');
const homeView = document.querySelector('#home-view');
const templatesView = document.querySelector('#templates-view');
const productionView = document.querySelector('#production-view');
const header = document.querySelector('#workspace-header');
const rail = document.querySelector('#rail');
const railTools = document.querySelector('#rail-tools');
const railHome = document.querySelector('#rail-home');
const loading = document.querySelector('#loading');
const railButtons = [...document.querySelectorAll('[data-etapa]')];
const toast = document.querySelector('#export-toast');
let toastTimer;

/* ---------------- LA BARRA DE ETAPAS SE METE AL LOGO ----------------------
El logo hace de interruptor de la barra lateral. Al plegarla, cada botón de
etapa VUELA hasta el logo y desaparece dentro de él; al desplegarla, salen de
ahí uno tras otro. El vuelo no está inventado a ojo: antes de plegar se mide
en pantalla cuánto hay del centro de cada botón al centro del logo, y esa
distancia viaja a la animación en --vx / --vy (ver style.css). Por eso se ve
igual de bien con la barra ancha, con la angosta de las ventanas chicas o con
media etapa escondida por el modo del proyecto.

Regla de oro tras el error del botón ⤢: PLEGAR NO PUEDE DEJARTE SIN SALIDA.
El logo se queda siempre a la vista —se muda al encabezado—, el encabezado con
sus pestañas y secciones no se toca, y Esc también despliega. */
const logoBtn = document.querySelector('#logo-btn');
const VUELO_MS = 300;   // lo que tarda un botón en entrar (o salir) del logo
const PASO_MS = 38;     // el retraso entre un botón y el siguiente: la fila

// Los botones que SE VEN: la barra tiene dos grupos (Inicio y etapas) y solo
// uno está a la vista, y dentro de él el modo del proyecto esconde algunos.
const botonesRail = () => [...rail.querySelectorAll('.rail-group:not([hidden]) button')]
    .filter((b) => !b.hidden);
const railPlegado = () => shell.classList.contains('rail-plegado');

// Mide el vuelo con la barra DESPLEGADA (es el único momento en que las
// posiciones son de verdad) y lo deja escrito en cada botón. Las medidas se
// reaprovechan al desplegar: la geometría vertical de la barra es la misma.
function medirVuelo() {
    const logo = logoBtn.getBoundingClientRect();
    const cx = logo.left + logo.width / 2;
    const cy = logo.top + logo.height / 2;
    const botones = botonesRail();
    botones.forEach((boton, i) => {
        const caja = boton.getBoundingClientRect();
        boton.style.setProperty('--vx', `${Math.round(cx - (caja.left + caja.width / 2))}px`);
        boton.style.setProperty('--vy', `${Math.round(cy - (caja.top + caja.height / 2))}px`);
        boton.style.setProperty('--i', i);
    });
    return botones.length;
}

let railTimer;
let railTragar;

function pintarLogo() {
    const plegado = railPlegado();
    logoBtn.setAttribute('aria-expanded', String(!plegado));
    logoBtn.title = logoBtn.disabled ? 'Producción TV'
        : plegado ? 'Mostrar las etapas del proyecto (también con Esc)'
        : 'Guardar las etapas en el logo y dejarle toda la ventana a la herramienta';
}

function plegarRail() {
    // Ya plegada o plegándose: no hay nada que hacer.
    if (railPlegado() || shell.classList.contains('plegando') || logoBtn.disabled) return;
    clearTimeout(railTimer); clearTimeout(railTragar);
    // Si los botones venían SALIENDO del logo, se corta la salida ANTES de
    // medir: a medio brotar están encogidos y desplazados, y medirlos así
    // daría un vuelo torcido.
    shell.classList.remove('desplegando');
    logoBtn.classList.remove('suelta');
    const n = medirVuelo();
    shell.classList.add('plegando');
    // El logo da el respingo cuando le está entrando el primer botón, no antes.
    railTragar = setTimeout(() => logoBtn.classList.add('traga'), VUELO_MS * 0.55);
    railTimer = setTimeout(() => {
        shell.classList.remove('plegando');
        logoBtn.classList.remove('traga');
        shell.classList.add('rail-plegado');   // ahora sí: la barra se encoge
        pintarLogo();
    }, VUELO_MS + n * PASO_MS);
}

function desplegarRail() {
    // Vale también a media entrada: si te arrepientes mientras los botones se
    // están metiendo, salen de vuelta en lugar de dejarte esperando.
    if (!railPlegado() && !shell.classList.contains('plegando')) return;
    clearTimeout(railTimer); clearTimeout(railTragar);
    shell.classList.remove('rail-plegado', 'plegando');   // la barra se abre…
    shell.classList.add('desplegando');                   // …y los botones brotan del logo
    logoBtn.classList.remove('traga');
    logoBtn.classList.add('suelta');
    pintarLogo();
    railTimer = setTimeout(() => {
        shell.classList.remove('desplegando');
        logoBtn.classList.remove('suelta');
        medirVuelo();   // deja las medidas frescas para el próximo pliegue
    }, VUELO_MS + 80 + botonesRail().length * PASO_MS);
}

// Sin animación: para cuando la vista cambia sola (Inicio no tiene encabezado
// donde parar el logo, así que ahí la barra siempre va abierta).
function restablecerRail() {
    clearTimeout(railTimer); clearTimeout(railTragar);
    shell.classList.remove('rail-plegado', 'plegando', 'desplegando');
    logoBtn.classList.remove('traga', 'suelta');
}

logoBtn.onclick = () => (railPlegado() ? desplegarRail() : plegarRail());

/* ----------------------------- Utilidades ----------------------------- */

function showToast(message, error = false) {
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function persistProjects() {
    projects = projects.slice(0, MAX_PROJECTS);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

/* --------------------------- Navegación por etapas ---------------------------
La barra lateral son las ETAPAS del proyecto. Bajo el encabezado aparecen las
SECCIONES de la etapa activa, y solo cuando esa etapa tiene más de una (si tiene
una sola, la barra estorbaría). Cada etapa recuerda en qué sección la dejaste.
Sustituye a la antigua franja "ruta", que repetía con otros nombres lo mismo que
la barra lateral. */

const secciones = document.querySelector('#secciones');
const barraPestanas = document.querySelector('#pestanas');

// Señales REALES de que una etapa ya tiene lo suyo. No se inventa avance: una
// etapa sin señal medible simplemente no se marca.
const ETAPA_LISTA = {
    perfil: (cfg) => !!(cfg?.narrativa || cfg?.duracionObjetivoSeg || cfg?.duracionObjetivoMin),
    guion: (cfg) => (cfg?.escaleta || []).some((seg) => (seg.tomas || []).length),
    necesidades: (cfg, diagram) => (diagram?.edges || []).length > 0,
    planeacion: (cfg) => (cfg?.sets || []).some((x) => (x.muebles || []).length || x.iluminacion || Object.keys(x.setLayout?.pos || {}).length),
    salida: (cfg) => !!cfg?.exportado,
    ensayo: (cfg) => !!cfg?.ensayado,
};

// Diferencias por modo: en narrativo el ensayo en vivo no aplica y algunas
// secciones cambian de nombre (la misma herramienta cambia de función).
const ETAPAS_OCULTAS = { narrative: ['ensayo'] };
const SECCION_ETIQUETAS = { narrative: { set: 'Plano de la locación', escaleta: 'Guion técnico y storyboard', diagrama: 'Escena' } };

// Última sección visitada de cada etapa, para volver donde uno la dejó.
const ultimaSeccion = {};

// La etapa que el rail ilumina es la de lo que SE VE. Con una pestaña de
// módulo al frente no hay etapa activa: ese módulo ya salió del recorrido.
const etapaActiva = () => ETAPA_DE_VISTA[vistaVisible()] || null;

function renderModo() {
    if (!shell.classList.contains('project-window')) return;
    const modo = normalizeMode(latestInfografia?.modo);
    const chip = document.querySelector('#mode-chip');
    if (chip) {
        // La etiqueta CORTA ('EN VIVO'), no la larga: ahora la barra la
        // comparte con las pestañas y las secciones, y el texto largo les
        // quitaba el lugar. El nombre completo sigue en el title.
        chip.textContent = PROJECT_MODES[modo].corto;
        chip.title = `Modo del proyecto: ${PROJECT_MODES[modo].label}. Se elige al crearlo y define las herramientas disponibles.`;
        chip.classList.toggle('narrative', modo === 'narrative');
    }
    const ocultas = ETAPAS_OCULTAS[modo] || [];
    railButtons.forEach((b) => {
        const etapa = etapaPorId(b.dataset.etapa);
        b.hidden = ocultas.includes(b.dataset.etapa) || (etapa?.soloVivo && modo === 'narrative');
        b.classList.toggle('done', !!ETAPA_LISTA[b.dataset.etapa]?.(latestInfografia, latestDiagram));
    });
}

function renderNav() {
    if (!shell.classList.contains('project-window') || shell.classList.contains('tool-window')) { secciones.hidden = true; marcarDesborde(); return; }
    renderModo();
    const etapa = etapaPorId(etapaActiva());
    railButtons.forEach((b) => b.classList.toggle('active', b.dataset.etapa === etapa?.id));
    // DE LA IDEA A LO REAL: la etapa activa decide la temperatura de TODA la
    // pantalla — la luz que baña la pared, el vidrio del rail, los botones y
    // el foco de los campos. La app se calienta conforme el proyecto se vuelve
    // real: 1 azul (una idea) → 5 rojo (al aire).
    document.documentElement.dataset.etapa = etapa?.n || '1';
    // Una sola sección: no hay nada que elegir, la barra sobra.
    const modo = normalizeMode(latestInfografia?.modo);
    const lista = seccionesDe(etapa, modo);
    // La barra de secciones es del recorrido por etapas: solo la pestaña
    // Proyecto la usa. Y las secciones ya desancladas salen de la lista.
    const enPrincipal = pestanas.activa === PRINCIPAL;
    const visibles = lista.filter(([v]) => !pestanas.tiene(v));
    if (!etapa || visibles.length < 2 || header.hidden || !enPrincipal) { secciones.hidden = true; marcarDesborde(); return; }
    const rot = SECCION_ETIQUETAS[modo] || {};
    secciones.hidden = false;
    secciones.innerHTML = visibles.map(([vista, etiqueta]) => `
        <button data-seccion="${vista}" class="${vista === activeView ? 'active' : ''}">
          ${rot[vista] || etiqueta}
        </button>`).join('');
    secciones.querySelectorAll('[data-seccion]').forEach((b) => {
        b.onclick = () => selectView(b.dataset.seccion);
    });
    marcarDesborde();
}

/* Si en una ventana angosta la navegación no cabe, se puede deslizar en
   horizontal — pero un corte limpio parece el final de la lista. El degradado
   del borde dice "hay más de este lado". Se mide DESPUÉS de pintar, cuando el
   navegador ya sabe cuánto ocupa cada botón. */
const headerNav = document.querySelector('#header-nav');
function marcarDesborde() {
    if (!headerNav) return;
    requestAnimationFrame(() => {
        headerNav.classList.toggle('desborda', headerNav.scrollWidth > headerNav.clientWidth + 1);
    });
}
window.addEventListener('resize', marcarDesborde);

// Marca un hito de la ruta (ensayado/exportado) la primera vez que ocurre.
function marcaHito(campo) {
    if (!latestInfografia || latestInfografia[campo]) return;
    latestInfografia = { ...latestInfografia, [campo]: true };
    scheduleSave();
}

function scheduleSave() {
    renderNav();
    document.querySelector('#save-status').textContent = 'Guardando…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        if (activeProject) {
            activeProject.cfg = latestInfografia;
            activeProject.diagram = latestDiagram;
            activeProject.updatedAt = new Date().toISOString();
            projects = [activeProject, ...projects.filter((p) => p.id !== activeProject.id)];
            persistProjects();
            saveProjectToDisk(activeProject);
        }
        document.querySelector('#save-status').textContent = 'Guardado en disco';
        renderRecent();
    }, 550);
}

/* ----------------------------- Proyectos ----------------------------- */

// `profile` viene del asistente: identidad + respuestas técnicas (ver templates.js).
async function createProject(profile) {
    const name = profile.name || `Proyecto ${new Date().toLocaleDateString()}`;
    const template = profile.template || 'vacio';
    // Base mínima y editable (ver nuevo-proyecto.js): cámaras, un talento y la
    // escaleta vacía. Desde la reorganización por etapas el proyecto abre en
    // PERFIL (etapa 1), que es por donde empieza toda producción.
    const cfg = profile.cfg || makeTemplate(template, {
        ...profile, projectName: name, company: profile.company || 'ATJ Producciones',
    });
    const project = {
        id: uid('project'), name, template,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        cfg, diagram: diagramFromConfig(cfg),
    };
    projects = [project, ...projects];
    activeProject = project;
    activeProjectId = project.id;
    latestInfografia = cfg;
    latestDiagram = project.diagram;
    localStorage.setItem(ACTIVE_KEY, project.id);
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(cfg));
    localStorage.setItem(DIAGRAM_KEY, JSON.stringify(project.diagram));
    persistProjects();
    saveProjectToDisk(project);
    renderRecent();
    showToast('Proyecto creado');
    await launchProjectWindow(project.id);
}

// Abrir un proyecto NO significa siempre abrir una ventana. Si ese proyecto
// ya está abierto, Go trae esa ventana al frente y no crea una copia: antes
// picarle a la tarjeta abría una segunda ventana del mismo proyecto y el
// trabajo quedaba repartido en dos. OpenProjectWindow devuelve true cuando
// realmente abrió una ventana nueva, para poder decir cuál de las dos pasó.
async function launchProjectWindow(id) {
    localStorage.setItem(ACTIVE_KEY, id);
    const project = projects.find((item) => item.id === id);
    if (!project) { showToast('El proyecto solicitado ya no existe', true); return; }
    try {
        const abrioNueva = await OpenProjectWindow(id, JSON.stringify(project));
        showToast(abrioNueva
            ? 'Proyecto abierto en una ventana nueva'
            : `“${project.name}” ya estaba abierto: te llevé a esa ventana`);
        refrescarAbiertos();
    } catch (error) {
        showToast(error?.message || 'No se pudo abrir la ventana del proyecto', true);
    }
}

// Eliminación en dos pasos: el primer clic pide confirmación en el propio botón
// (window.confirm no está disponible en el WebView de Wails en macOS).
function requestDeleteProject(id) {
    clearTimeout(pendingDeleteTimer);
    if (pendingDeleteId !== id) {
        pendingDeleteId = id;
        pendingDeleteTimer = setTimeout(() => { pendingDeleteId = null; renderRecent(); }, 4000);
        renderRecent();
        return;
    }
    pendingDeleteId = null;
    projects = projects.filter((p) => p.id !== id);
    if (activeProjectId === id) {
        activeProject = null;
        activeProjectId = '';
        localStorage.removeItem(ACTIVE_KEY);
    }
    persistProjects();
    // El .ptv no se destruye: va a ~/Documents/ProduccionTV/Papelera.
    DeleteProjectFile(id).catch(() => {});
    renderRecent();
    showToast('Proyecto eliminado (recuperable en Documentos/ProduccionTV/Papelera)');
}

function duplicateProject(id) {
    const sourceProject = projects.find((p) => p.id === id);
    if (!sourceProject) return;
    const copy = JSON.parse(JSON.stringify(sourceProject));
    copy.id = uid('project');
    copy.name += ' – copia';
    copy.updatedAt = new Date().toISOString();
    projects.unshift(copy);
    persistProjects();
    saveProjectToDisk(copy);
    renderRecent();
}

// Importa un proyecto desde el contenido de un archivo .ptv (o .json legado):
// acepta el paquete {project, infographic, diagram} del exportador o un cfg
// suelto del generador. Lo agrega a recientes y lo abre en su propia ventana.
function importProjectFromText(text, { launch = true } = {}) {
    let data;
    try { data = JSON.parse(text); } catch { showToast('El archivo no es un proyecto de Producción TV válido', true); return null; }
    const project = proyectoDesdeBundle(data, { conservarId: false });
    if (!project) {
        showToast('El archivo no contiene un proyecto de Producción TV', true);
        return null;
    }
    project.updatedAt = new Date().toISOString();
    projects = [project, ...projects];
    persistProjects();
    saveProjectToDisk(project);
    renderRecent();
    showToast(`Proyecto “${project.name}” importado`);
    if (launch) launchProjectWindow(project.id);
    return project;
}

let projectQuery = '';

/* ---- QUÉ PROYECTOS YA ESTÁN ABIERTOS ------------------------------------
Cada ventana es un proceso aparte, así que el lanzador no "ve" a las demás:
se lo pregunta a Go, que lleva el registro (ver ListOpenProjects en app.go).
Sirve para dos cosas: marcar la tarjeta con un punto de "Abierto" y que al
picarla se traiga esa ventana al frente en vez de abrir una copia. Se vuelve
a preguntar cada vez que la ventana de Inicio regresa al frente, que es justo
cuando el usuario acaba de cerrar o abrir una ventana de proyecto. */
let proyectosAbiertos = new Set();

async function refrescarAbiertos({ redibujar = true } = {}) {
    const ids = (await conGo(ListOpenProjects)) || [];
    const nuevo = new Set(ids);
    const igual = nuevo.size === proyectosAbiertos.size && [...nuevo].every((id) => proyectosAbiertos.has(id));
    proyectosAbiertos = nuevo;
    if (redibujar && !igual && activeView === 'home') renderRecent();
}

// Miniatura de un proyecto: su plano cenital REAL, dibujado por el mismo
// renderizador que usan las hojas imprimibles (window.PTVSheets), así la
// tarjeta muestra el trabajo del alumno y no un icono genérico.
function miniPlano(cfg) {
    try {
        return (cfg && window.PTVSheets?.planoSvg?.(cfg)) || '';
    } catch (e) {
        return '';
    }
}

const durTexto = (seg) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`;

// Resumen de una línea: lo que distingue a un proyecto de otro de un vistazo.
function resumenProyecto(p) {
    const cfg = p.cfg || {};
    const partes = [];
    const total = (cfg.escaleta || []).reduce((a, seg) => a + (seg.dur || 0), 0);
    if (normalizeMode(cfg.modo) === 'narrative') {
        const escenas = (cfg.escaleta || []).length;
        if (escenas) partes.push(`${escenas} escena${escenas === 1 ? '' : 's'}`);
    } else {
        const cams = (cfg.camaras || []).length;
        if (cams) partes.push(`${cams} cámara${cams === 1 ? '' : 's'}`);
    }
    if (total) partes.push(durTexto(total));
    const sets = (cfg.sets || []).length;
    if (sets > 1) partes.push(`${sets} sets`);
    return partes.join(' · ');
}

// Fecha en lenguaje de todos los días: "Hoy, 11:20" pesa menos que una fecha larga.
function fechaCorta(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const soloDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const dias = Math.round((soloDia(new Date()) - soloDia(d)) / 86400000);
    const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (dias === 0) return `Hoy, ${hora}`;
    if (dias === 1) return `Ayer, ${hora}`;
    if (dias < 7) return `Hace ${dias} días`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// La tarjeta de Inicio usa la etiqueta CORTA y el encabezado del proyecto la
// larga: es el mismo dato, pero en 228 px de ancho la larga no cabe.
const chipModo = (p, { corto = false } = {}) => {
    const modo = normalizeMode(p.cfg?.modo);
    const m = PROJECT_MODES[modo];
    return `<span class="proj-badge ${modo}" title="${m.label}">${corto ? m.corto : m.chip}</span>`;
};

const accionesProyecto = (p) => `
  <button data-duplicate="${p.id}" title="Duplicar proyecto">${icono('proyecto', 15)}</button>
  ${pendingDeleteId === p.id
      ? `<button data-delete="${p.id}" class="confirm-delete">¿Eliminar?</button>`
      : `<button data-delete="${p.id}" title="Eliminar proyecto">${icono('papelera', 15)}</button>`}`;

function renderRecent() {
    const box = document.querySelector('#recent-projects');
    const slot = document.querySelector('#continue-slot');
    const cerca = projects.length >= MAX_PROJECTS - 10;
    const count = document.querySelector('#project-count');
    count.textContent = cerca ? `${projects.length} / ${MAX_PROJECTS} ⚠` : `${projects.length} proyecto${projects.length === 1 ? '' : 's'}`;
    count.title = cerca ? `Cerca del tope de ${MAX_PROJECTS} proyectos: exporta o elimina los que ya no uses` : '';
    document.querySelector('#active-name').textContent = activeProject?.name || 'Guardado local';
    const filtrados = projectQuery
        ? projects.filter((p) => (p.name || '').toLowerCase().includes(projectQuery))
        : projects;
    document.querySelector('#home-sub-text').textContent = projects.length
        ? ` · último cambio ${fechaCorta(projects[0].updatedAt).toLowerCase()}`
        : '';

    // Tarjeta "Continuar": el proyecto más reciente, en grande. Es lo primero
    // que se busca al abrir la app, y llena el ancho de la pantalla.
    const seguir = !projectQuery && projects[0];
    slot.innerHTML = seguir ? `
        <article class="continue-card">
          <div class="proj-thumb">${miniPlano(seguir.cfg)}${proyectosAbiertos.has(seguir.id) ? '<span class="proj-abierto">Abierto</span>' : ''}</div>
          <div class="continue-body">
            <span class="continue-eyebrow">Seguir donde te quedaste</span>
            <h2>${seguir.name}</h2>
            <p>${[chipModo(seguir), resumenProyecto(seguir)].filter(Boolean).join(' ')}</p>
            <small>${fechaCorta(seguir.updatedAt)}</small>
            <button class="continue-go" data-open="${seguir.id}">${proyectosAbiertos.has(seguir.id) ? 'Ir a su ventana' : 'Continuar'}</button>
          </div>
        </article>` : '';

    box.innerHTML = filtrados.length
        ? filtrados.filter((p) => p.id !== seguir?.id).slice(0, projectQuery ? 30 : 14).map((p) => `
            <article class="proj-card">
              <div class="proj-thumb" data-open="${p.id}" role="button" tabindex="0" title="${proyectosAbiertos.has(p.id) ? `Ir a la ventana de ${p.name}` : `Abrir ${p.name}`}">
                ${miniPlano(p.cfg)}
                ${p.id === DEMO_PROJECT_ID ? '<span class="proj-tag">Tutorial</span>' : ''}
                ${proyectosAbiertos.has(p.id) ? '<span class="proj-abierto">Abierto</span>' : ''}
              </div>
              <div class="proj-meta">
                <strong title="${p.name}">${p.name}</strong>
                <small>${fechaCorta(p.updatedAt)}${resumenProyecto(p) ? ` · ${resumenProyecto(p)}` : ''}</small>
              </div>
              <div class="proj-foot">
                ${chipModo(p, { corto: true })}
                <span class="proj-acts">${accionesProyecto(p)}</span>
              </div>
            </article>`).join('')
        : `<div class="empty-projects">${projectQuery
              ? `Sin resultados para “${projectQuery}”.`
              : 'Todavía no hay proyectos.<br>Crea el primero con <b>＋ Nuevo proyecto</b>.'}</div>`;

    [slot, box].forEach((zona) => {
        zona.querySelectorAll('[data-open]').forEach((b) => {
            b.onclick = () => launchProjectWindow(b.dataset.open);
            b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launchProjectWindow(b.dataset.open); } };
        });
        zona.querySelectorAll('[data-duplicate]').forEach((b) => b.onclick = () => duplicateProject(b.dataset.duplicate));
        zona.querySelectorAll('[data-delete]').forEach((b) => b.onclick = () => requestDeleteProject(b.dataset.delete));
    });
}

/* --------------------- Galería de plantillas de set ---------------------
Tarjetas con el PLANO DE VERDAD de cada plantilla, no un icono: se arma el
proyecto completo (cámaras, gente, micrófonos e iluminación) y se dibuja con el
mismo renderizador que usan las hojas impresas. Lo que se ve en la tarjeta es
exactamente lo que abre al crear el proyecto. */

// El cfg de cada plantilla se arma una sola vez y se guarda: dibujar ocho
// planos completos en cada visita sería trabajo repetido para nada.
const cfgPlantillaCache = new Map();
const cfgDeTarjeta = (p) => {
    if (!cfgPlantillaCache.has(p.id)) cfgPlantillaCache.set(p.id, cfgDePlantilla(p));
    return cfgPlantillaCache.get(p.id);
};

function renderPlantillas() {
    const grid = document.querySelector('#tpl-grid');
    if (!grid) return;
    grid.innerHTML = PLANTILLAS_SET.map((p) => {
        const cfg = cfgDeTarjeta(p);
        return `
        <article class="tpl-card">
          <div class="tpl-thumb" data-plantilla="${p.id}" role="button" tabindex="0"
               title="Crear un proyecto con el set de ${esc(p.nombre)}">${miniPlano(cfg)}</div>
          <div class="tpl-body">
            <strong>${esc(p.nombre)}</strong>
            <span class="tpl-resumen">${esc(p.resumen)}</span>
            <p>${esc(p.detalle)}</p>
          </div>
          <div class="tpl-foot">
            <small>${esc(resumenDePlantilla(cfg))}</small>
            <button data-plantilla="${p.id}">Usar</button>
          </div>
        </article>`;
    }).join('');
    grid.querySelectorAll('[data-plantilla]').forEach((el) => {
        const usar = () => {
            const p = PLANTILLAS_SET.find((x) => x.id === el.dataset.plantilla);
            if (p) nuevoProyecto.open({ plantilla: p });
        };
        el.onclick = usar;
        el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); usar(); } };
    });
}

/* ----------------------------- Vistas ----------------------------- */

const nuevoProyecto = createNuevoProyecto({ onCreate: createProject });

const production = createProductionView({
    container: productionView,
    getProject: () => activeProject,
    getInfografia: () => latestInfografia,
    getDiagram: () => latestDiagram,
    onGoHome: () => selectView('home'),
    onEnsayo: () => marcaHito('ensayado'),
});

// Recorrido guiado de primera vez (y repetible desde el botón ❔ del header).
const TOUR_KEY = 'producciontv:desktop:tour-hecho';
const tour = createTour({ selectView });

/* =======================================================================
   PESTAÑAS Y PANELES
   =======================================================================
   El proyecto abre en una sola pestaña, "Proyecto", con su recorrido por
   etapas de siempre. Cualquier módulo se puede DESANCLAR (⌘D o el botón ⇱):
   sale del recorrido y se queda en su propia pestaña, con su propio panel
   montado, que conserva su estado al cambiar de pestaña. Y si esa pestaña la
   arrastras fuera de la barra, se despega en una ventana de macOS aparte.

   Lo que se ve en pantalla lo deciden DOS datos, y nada más:
     · qué pestaña está activa
     · si es la del proyecto, en qué sección quedó su recorrido (activeView)
   pintarEspacio() los lee y prende y apaga lo que toca. Todo lo demás
   (navegar, desanclar, cerrar) solo cambia esos dos datos y vuelve a pintar. */

// Qué se puede desanclar: las herramientas y el Ensayo en vivo. (Inicio no:
// es el lanzador, no un módulo del proyecto.)
const DESANCLABLES = [...Object.keys(toolInfo), 'production'];
const etiquetaModulo = (vista) => {
    if (vista === 'production') return 'En vivo';
    const rot = SECCION_ETIQUETAS[normalizeMode(latestInfografia?.modo)] || {};
    if (rot[vista]) return rot[vista];
    for (const etapa of ETAPAS) {
        const s = etapa.secciones.find(([v]) => v === vista);
        if (s) return s[1];
    }
    return toolInfo[vista]?.title || vista;
};
const iconoModulo = (vista) => (vista === 'production' ? 'produccion'
    : ETAPAS.find((e) => e.secciones.some(([v]) => v === vista))?.icono || 'infografias');

const pestanas = crearPestanas({
    barra: barraPestanas,
    etiquetaDe: etiquetaModulo,
    iconoDe: iconoModulo,
    alActivar: (id) => activarPestana(id),
    alCerrar: (id) => reanclar(id),
    alSacar: (id) => sacarAVentana(id),
    alPedirModulo: (ancla) => menuDeModulos(ancla),
});

// Crea (o recupera) el panel de un módulo desanclado: su propio iframe, que
// se queda montado mientras la pestaña exista.
function panelDe(vista) {
    if (paneles.has(vista)) return paneles.get(vista);
    const panel = { vista, sello: -1, escucha: false, el: null, temporizador: 0 };
    if (vista === 'production') {
        // El Ensayo no es un iframe: es una vista del propio shell. Su "panel"
        // es ese mismo contenedor, que ya vive al lado del marco.
        panel.el = productionView;
        panel.esVista = true;
    } else {
        const marco = document.createElement('iframe');
        marco.className = 'panel';
        marco.title = `${etiquetaModulo(vista)} — Producción TV`;
        marco.setAttribute('allow', 'clipboard-read; clipboard-write');
        marco.addEventListener('load', () => { aplicarTema(leerTema()); setTimeout(() => hidratarPanel(panel, vista), 80); });
        marco.src = toolInfo[vista].src;
        frameWrap.appendChild(marco);
        panel.el = marco;
    }
    paneles.set(vista, panel);
    return panel;
}

// Envía el estado del proyecto al panel. Se manda dos veces (ya y a los
// 220 ms) porque la herramienta puede tardar en montar sus escuchas; hasta
// entonces se ignora lo que ella emita, que es el eco de esto mismo.
function hidratarPanel(panel, vista) {
    if (!activeProject || !panel) return;
    if (panel.esVista) { production.render(); panel.sello = selloEstado; return; }
    const enviar = () => {
        const w = panel.el?.contentWindow;
        if (!w) return;
        // EL TEMA VIAJA CON CADA HIDRATACIÓN. Antes se mandaba solo en el
        // evento `load` del iframe, y ahí llegaba demasiado pronto: la
        // herramienta monta sus escuchas después de cargar, así que el mensaje
        // caía en el vacío y TODAS las herramientas arrancaban en claro aunque
        // la app estuviera en oscuro — solo se corregía si el usuario picaba
        // el botón de tema. Se notaba sobre todo en el plano del set, que es
        // casi todo lienzo. La hidratación se manda dos veces (ya y a los
        // 220 ms), así que el tema llega sí o sí.
        w.postMessage({ type: 'producciontv:tema', tema: temaActual() }, '*');
        const info = toolInfo[vista];
        if (info?.src.includes('/infografias/')) w.postMessage({ type: 'producciontv:load-infografia', cfg: latestInfografia, mode: info.mode || 'editar' }, '*');
        if (vista === 'diagrama') w.postMessage({ type: 'producciontv:hydrate-diagram', state: latestDiagram, cfg: latestInfografia }, '*');
        if (vista === 'exportar') w.postMessage({ type: 'producciontv:load-exportar', cfg: latestInfografia, diagram: latestDiagram, project: activeProject, projectName: activeProject?.name || '' }, '*');
    };
    panel.vista = vista;
    panel.escucha = false;
    clearTimeout(panel.temporizador);
    enviar();
    panel.temporizador = setTimeout(() => {
        panel.escucha = true;
        enviar();
        panel.sello = selloEstado;
    }, 220);
}

// Pone al día el panel que se va a ver, si se quedó atrás.
function ponerAlDia(panel, vista) {
    if (!panel || panel.sello === selloEstado) return;
    hidratarPanel(panel, vista);
}

// La vista que de verdad está en pantalla (la de la pestaña activa).
const vistaVisible = () => (pestanas.activa === PRINCIPAL ? activeView : pestanas.activa);

function pintarEspacio() {
    const enPrincipal = pestanas.activa === PRINCIPAL;
    const vista = vistaVisible();
    const esHerramienta = !!toolInfo[vista];
    // Las vistas del LANZADOR (Inicio y la galería de plantillas) no son
    // módulos de un proyecto: no llevan cabecera y comparten la misma barra
    // lateral, la de Inicio.
    const enInicio = VISTAS_INICIO.includes(vista);

    homeView.hidden = vista !== 'home';
    templatesView.hidden = vista !== 'plantillas';
    header.hidden = enInicio;
    railHome.hidden = !enInicio;
    railTools.hidden = enInicio;
    // En Inicio el logo es solo la marca: no hay encabezado donde pararse ni
    // herramienta a la que dejarle sitio, así que la barra se queda abierta.
    logoBtn.disabled = enInicio;
    if (enInicio) restablecerRail();
    pintarLogo();
    railHome.querySelector('[data-accion="proyectos"]')?.classList.toggle('active', vista === 'home');
    railHome.querySelector('[data-accion="plantillas"]')?.classList.toggle('active', vista === 'plantillas');
    frameWrap.hidden = !esHerramienta;
    // El Ensayo se ve si es la vista del proyecto o si es la pestaña activa.
    productionView.hidden = vista !== 'production';
    // De los iframes solo se ve el de la pestaña que manda.
    panelPrincipal.el.hidden = !(enPrincipal && esHerramienta);
    paneles.forEach((p, v) => { if (!p.esVista) p.el.hidden = !(v === vista && !enPrincipal); });
    // El botón de desanclar solo tiene sentido en la pestaña Proyecto, y solo
    // sobre un módulo que todavía no esté desanclado.
    const btn = document.querySelector('#desanclar-btn');
    if (btn) btn.hidden = !(enPrincipal && DESANCLABLES.includes(vista) && !pestanas.tiene(vista));
    pintarAccionesHerramienta();
    renderNav();
}

/* ---- LOS BOTONES DE LA HERRAMIENTA, EN LA BARRA DEL SHELL ---------------
Deshacer, rehacer y la guía son del generador, que vive dentro de un iframe.
Antes dibujaba su propia franja para tenerlos —y esa era la SEGUNDA barra de
la cabeza de la ventana—. Desde 2026-08-28 los botones son de esta barra y la
herramienta solo dice si están disponibles (producciontv:tool-ui) y obedece
cuando se pican (producciontv:undo / :redo / :toggle-guia). */

// El generador es la única herramienta con historial y guía; el diagrama y el
// exportador no tienen nada que ofrecer aquí.
const esGenerador = (vista) => (toolInfo[vista]?.src || '').includes('infografias');

function pintarAccionesHerramienta() {
    const caja = document.querySelector('#tool-acciones');
    if (!caja) return;
    caja.hidden = !esGenerador(vistaVisible());
    if (caja.hidden) return;
    const ui = panelAlFrente()?.ui || {};
    document.querySelector('#undo-btn').disabled = !ui.canUndo;
    document.querySelector('#redo-btn').disabled = !ui.canRedo;
    const guia = document.querySelector('#guia-btn');
    guia.classList.toggle('on', !!ui.guia);
    guia.setAttribute('aria-pressed', String(!!ui.guia));
}

function activarPestana(id) {
    pestanas.activar(id);
    if (id === PRINCIPAL) {
        pintarEspacio();
        ponerAlDia(panelPrincipal, activeView);
        return;
    }
    const panel = panelDe(id);
    pintarEspacio();
    ponerAlDia(panel, id);
}

// DESANCLAR: el módulo sale del recorrido por etapas y se queda en su propia
// pestaña. Si ya estaba desanclado, simplemente se va a esa pestaña.
function desanclar(vista) {
    if (!DESANCLABLES.includes(vista)) return;
    if (!pestanas.tiene(vista)) {
        pestanas.abrir(vista);
        panelDe(vista);
        showToast(`“${etiquetaModulo(vista)}” quedó en su propia pestaña. Con el botón ⧉ de la pestaña (o arrastrándola fuera de la barra) se abre en su propia ventana.`);
    }
    // La pestaña Proyecto se queda en la sección hermana, no en un hueco.
    if (activeView === vista) {
        const etapa = etapaPorId(ETAPA_DE_VISTA[vista]);
        const modo = normalizeMode(latestInfografia?.modo);
        const hermana = seccionesDe(etapa, modo).map(([v]) => v).find((v) => v !== vista && !pestanas.tiene(v));
        activeView = hermana || 'perfil';
        cargarEnPrincipal(activeView);
    }
    activarPestana(vista);
}

// REANCLAR: la pestaña se cierra y su módulo vuelve al recorrido por etapas.
function reanclar(vista) {
    const panel = paneles.get(vista);
    if (panel && !panel.esVista) panel.el.remove();
    paneles.delete(vista);
    pestanas.cerrar(vista);
    activarPestana(PRINCIPAL);
    selectView(vista);
    showToast(`“${etiquetaModulo(vista)}” volvió al recorrido del proyecto`);
}

// Menú del "+": qué módulos quedan por desanclar.
// SACAR A UNA VENTANA: la pestaña se despega y el módulo se abre en una
// ventana de macOS aparte, que puedes mandar al segundo monitor. Aquí la
// pestaña se cierra (ya no vive en esta ventana) pero el módulo NO vuelve al
// recorrido: se fue a otra parte. Las dos ventanas comparten el mismo .ptv
// del disco, y cada una se entera de lo que guardó la otra (ver WatchProject).
async function sacarAVentana(vista) {
    if (!activeProject) return;
    // Antes de despegarla, lo que esté sin guardar tiene que estar en disco:
    // la ventana nueva arranca leyendo de ahí.
    flushSaveNow({ callado: true });
    const panel = paneles.get(vista);
    if (panel && !panel.esVista) panel.el.remove();
    paneles.delete(vista);
    pestanas.cerrar(vista);
    activarPestana(PRINCIPAL);
    try {
        const abrioNueva = await OpenToolWindow(activeProject.id, vista, JSON.stringify(activeProject));
        showToast(abrioNueva
            ? `“${etiquetaModulo(vista)}” se abrió en su propia ventana`
            : `“${etiquetaModulo(vista)}” ya tenía ventana: te llevé a ella`);
    } catch (error) {
        showToast(error?.message || 'No se pudo abrir la ventana del módulo', true);
        // Si Go no pudo, el módulo se queda donde estaba: en el recorrido.
        selectView(vista);
    }
}

function menuDeModulos(ancla) {
    document.querySelector('.menu-modulos')?.remove();
    const modo = normalizeMode(latestInfografia?.modo);
    const disponibles = DESANCLABLES
        .filter((v) => !pestanas.tiene(v))
        .filter((v) => v !== 'production' || modo !== 'narrative');
    if (!disponibles.length) { showToast('Ya están desanclados todos los módulos'); return; }
    const menu = document.createElement('div');
    menu.className = 'menu-modulos';
    menu.innerHTML = `<p class="menu-nota">Cada módulo se queda en su pestaña, y desde ahí puede salir a su propia ventana.</p>`
        + disponibles.map((v) => `
        <button data-modulo="${v}">${icono(iconoModulo(v), 15)}<span>${esc(etiquetaModulo(v))}</span></button>`).join('');
    document.body.appendChild(menu);
    const caja = ancla.getBoundingClientRect();
    menu.style.left = `${Math.min(caja.left, window.innerWidth - menu.offsetWidth - 12)}px`;
    menu.style.top = `${caja.bottom + 6}px`;
    const cerrar = () => { menu.remove(); document.removeEventListener('pointerdown', fuera, true); };
    const fuera = (e) => { if (!menu.contains(e.target)) cerrar(); };
    setTimeout(() => document.addEventListener('pointerdown', fuera, true), 0);
    menu.querySelectorAll('[data-modulo]').forEach((b) => b.onclick = () => { cerrar(); desanclar(b.dataset.modulo); });
}

// Carga una herramienta en el panel de la pestaña Proyecto.
function cargarEnPrincipal(view, forceReload = false) {
    const tool = toolInfo[view];
    if (!tool) return;
    if (forceReload || !panelPrincipal.el.src.includes(tool.src.replace('./', ''))) {
        loading.classList.remove('hidden');
        panelPrincipal.el.src = tool.src;
    } else {
        hidratarPanel(panelPrincipal, view);
    }
}

function selectView(view, forceReload = false) {
    // Si ese módulo ya vive en su propia pestaña, navegar hacia él es ir a esa
    // pestaña: no tiene caso montarlo dos veces.
    if (pestanas.tiene(view)) { activarPestana(view); return; }
    if (pestanas.activa !== PRINCIPAL) pestanas.activar(PRINCIPAL);
    activeView = view;
    if (ETAPA_DE_VISTA[view]) ultimaSeccion[ETAPA_DE_VISTA[view]] = view;
    pintarEspacio();
    if (view === 'home') { renderRecent(); return; }
    if (view === 'plantillas') { renderPlantillas(); return; }
    if (view === 'production') { production.render(); return; }
    cargarEnPrincipal(view, forceReload);
}

/* ----------------------------- Exportación ----------------------------- */
// Toda la exportación vive en la pestaña Exportar (⌘7); el shell solo presta
// los servicios que el WebView no tiene: impresión nativa y captura PNG.

// Captura un elemento del iframe como PNG de alta resolución, ignorando la UI
// de edición (controles, toasts y todo lo marcado como no imprimible).
function captureElementPNG(element, backgroundColor = '#fff') {
    return html2canvas(element, {
        scale: 2, useCORS: true, logging: false, backgroundColor,
        ignoreElements: (el) => el.matches?.('.zoomctl,.legend,.inspector,.checks,.toast,.no-print'),
    });
}

async function nativePrint() {
    try { await Print(); } catch (error) { showToast(error?.message || 'No se pudo abrir el panel de impresión', true); }
}

async function printCurrentTool() {
    document.documentElement.classList.remove('printing-document'); // imprimir la herramienta, no el último documento montado
    await nativePrint();
}

// El panel que está al frente: es el que se imprime y el que se captura.
const panelAlFrente = () => (pestanas.activa === PRINCIPAL ? panelPrincipal : paneles.get(pestanas.activa) || panelPrincipal);

// Impresión multipágina: WindowPrint imprime el documento del shell y un iframe
// solo aporta su viewport (una pantalla). Para PDFs de varias páginas, la
// herramienta manda su HTML+CSS y se monta en un contenedor del documento
// principal, donde los saltos de página sí funcionan.
async function printDocumentHTML(html, css) {
    let host = document.querySelector('#print-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'print-host';
        document.body.appendChild(host);
    }
    host.innerHTML = `<style>${css || ''}</style>${html || ''}`;
    // La clase va en <html>: su overflow:hidden de pantalla recortaría el
    // documento de impresión y hay que anularlo desde la propia raíz.
    document.documentElement.classList.add('printing-document');
    await nativePrint();
    // El contenido se conserva mientras el panel de impresión esté abierto (la
    // vista previa re-renderiza al cambiar opciones); cada nueva impresión lo
    // reemplaza o limpia la bandera.
}

/* ----------------------------- Mensajes de las herramientas ----------------------------- */

window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data?.type) return;
    // Con varias pestañas abiertas hay varios paneles vivos a la vez, así que
    // ya no basta con "¿viene del iframe?": hay que saber de CUÁL viene, para
    // atribuirle el mensaje a su módulo. Lo que no venga de un panel nuestro
    // se ignora, igual que antes.
    const panel = panelDeVentana(event.source);
    if (!panel) return;
    const vista = panel.vista;

    // Teclas reenviadas desde dentro de la herramienta (ver atajoDelCaparazon).
    // Solo navegación: deshacer, rehacer y guardar los resuelve la propia
    // herramienta, y reenviarlos los ejecutaría dos veces.
    if (data.type === 'producciontv:atajo') {
        atajoDelCaparazon(data.tecla || {});
        return;
    }

    // Las herramientas piden el panel nativo de impresión a través del shell
    // (window.print no funciona dentro del WebView).
    if (data.type === 'producciontv:print') {
        await printCurrentTool();
        return;
    }

    // Documento multipágina: la herramienta manda páginas + estilos ya listos.
    if (data.type === 'producciontv:print-document') {
        if (vista === 'exportar') marcaHito('exportado');
        await printDocumentHTML(data.html, data.css);
        return;
    }

    // Exportar pide capturar cada página como PNG independiente. El shell tiene
    // html2canvas y acceso al DOM del iframe (mismo origen), así que captura y
    // guarda página por página con el diálogo nativo.
    if (data.type === 'producciontv:export-pngs') {
        try {
            if (vista === 'exportar') marcaHito('exportado');
            const pages = [...(panel.el.contentDocument?.querySelectorAll('.export-page') || [])];
            if (!pages.length) throw new Error('No hay páginas para exportar.');
            let saved = 0;
            for (const page of pages) {
                const canvas = await captureElementPNG(page);
                const path = await SaveBase64File(`${page.dataset.name || 'seccion'}.png`, canvas.toDataURL('image/png'));
                if (!path) break; // el usuario canceló: no insistir con el resto
                saved += 1;
            }
            showToast(saved ? `${saved} de ${pages.length} PNG exportados` : 'Exportación cancelada', !saved);
        } catch (error) {
            showToast(error?.message || 'No se pudieron exportar los PNG', true);
        }
        return;
    }

    // Las herramientas piden guardar archivos (EDL, CSV, JSON) a través del shell
    // porque las descargas blob no funcionan dentro del WebView.
    if (data.type === 'producciontv:request-save') { flushSaveNow(); return; }
    if (data.type === 'producciontv:save-file') {
        try {
            if (vista === 'exportar') marcaHito('exportado');
            if (await SaveTextFile(data.filename || 'archivo.txt', data.content || '')) showToast('Archivo guardado');
        } catch (error) {
            showToast(error?.message || 'No se pudo guardar el archivo', true);
        }
        return;
    }

    // La herramienta avisa qué puede hacer ahora mismo: si hay algo que
    // deshacer o rehacer y si la guía está abierta. Se guarda POR PANEL —con
    // varias pestañas hay varios historiales— y solo se pinta el del frente.
    if (data.type === 'producciontv:tool-ui') {
        panel.ui = { canUndo: !!data.canUndo, canRedo: !!data.canRedo, guia: !!data.guia };
        if (panel === panelAlFrente()) pintarAccionesHerramienta();
        return;
    }

    if (data.type === 'producciontv:infografia-state') {
        if (!panel.escucha) return;
        latestInfografia = data.cfg;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(latestInfografia));
        // El panel que escribió ya está al día; los demás quedan atrasados y
        // se pondrán al corriente cuando se asomen (ver ponerAlDia).
        marcarCambio();
        panel.sello = selloEstado;
        // El diagrama sí necesita el aviso en caliente: dibuja sobre el mismo
        // dato y si no, se queda pintando el set anterior.
        paneles.forEach((otro, v) => {
            if (v === 'diagrama' && otro !== panel) otro.el.contentWindow?.postMessage({ type: 'producciontv:sync-infografia', cfg: latestInfografia }, '*');
        });
        if (vista === 'diagrama') panel.el.contentWindow?.postMessage({ type: 'producciontv:sync-infografia', cfg: latestInfografia }, '*');
        scheduleSave();
        return;
    }

    if (data.type === 'producciontv:diagram-state') {
        if (!panel.escucha) return;
        latestDiagram = data.state;
        const syncedInfografia = infografiaFromDiagram(latestDiagram, latestInfografia);
        const didSync = syncedInfografia !== latestInfografia;
        latestInfografia = syncedInfografia;
        localStorage.setItem(DIAGRAM_KEY, JSON.stringify(latestDiagram));
        if (didSync) {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(latestInfografia));
            showToast('Infografías actualizadas desde el diagrama');
        }
        marcarCambio();
        panel.sello = selloEstado;
        scheduleSave();
    }
});

/* ----------------------------- Eventos generales ----------------------------- */

frame.addEventListener('load', () => {
    loading.classList.add('hidden');
    aplicarTema(leerTema());
    setTimeout(() => hidratarPanel(panelPrincipal, activeView), 80);
});
railButtons.forEach((button) => button.onclick = () => {
    const etapa = etapaPorId(button.dataset.etapa);
    if (etapa) selectView(ultimaSeccion[etapa.id] || primeraVista(etapa, normalizeMode(latestInfografia?.modo)));
});
document.querySelector('#desanclar-btn').onclick = () => desanclar(vistaVisible());
renderRecent();

// Al volver a Inicio (o al recuperar el foco) se vuelve a preguntar qué
// proyectos siguen abiertos: puede que el usuario acabe de cerrar una ventana.
window.addEventListener('focus', () => refrescarAbiertos());
document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescarAbiertos(); });

document.querySelector('#new-project-focus').onclick = () => nuevoProyecto.open();
document.querySelector('[data-accion="nuevo"]').onclick = () => nuevoProyecto.open();
document.querySelector('[data-accion="proyectos"]').onclick = () => selectView('home');
document.querySelector('[data-accion="plantillas"]').onclick = () => selectView('plantillas');
document.querySelector('#tpl-vacio').onclick = () => nuevoProyecto.open();
// El nombre del proyecto en el header funciona como la pestaña Archivo de
// Word: desde una ventana de proyecto trae al frente la ventana ORIGINAL de
// inicio (el lanzador) — no una copia local; si ya se cerró, Go abre una nueva.
document.querySelector('#active-name').onclick = () => {
    if (shell.classList.contains('project-window')) { FocusLauncher().catch(() => {}); return; }
    selectView('home');
};
// Los tres botones de la herramienta: el shell no sabe deshacer nada, solo se
// lo pide al panel que está al frente.
const pedirAHerramienta = (type) => panelAlFrente()?.el?.contentWindow?.postMessage({ type }, '*');
document.querySelector('#undo-btn').onclick = () => pedirAHerramienta('producciontv:undo');
document.querySelector('#redo-btn').onclick = () => pedirAHerramienta('producciontv:redo');
document.querySelector('#guia-btn').onclick = () => pedirAHerramienta('producciontv:toggle-guia');
document.querySelector('#tema-btn').onclick = alternarTema;
// Arranque: se aplica lo elegido (o nada, y entonces manda el sistema). Y si
// el usuario cambia el tema del Mac con la app abierta, la app lo sigue —
// mientras no haya elegido a mano.
aplicarTema(leerTema());
window.matchMedia?.('(prefers-color-scheme: dark)')
  .addEventListener?.('change', () => { if (!leerTema()) aplicarTema(''); });
document.querySelector('#tour-btn').onclick = () => {
    localStorage.setItem(TOUR_KEY, '1');
    desplegarRail();   // el recorrido señala los botones de etapa: deben verse
    tour.start();
};

// Importar proyecto .ptv: desde el botón de Inicio o con doble clic en Finder
// (el evento llega desde Go vía la asociación de archivos).
const importInput = document.querySelector('#import-file');
document.querySelector('#import-project').onclick = () => importInput.click();
importInput.onchange = () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importProjectFromText(String(reader.result || ''));
    reader.readAsText(file);
};
EventsOn('producciontv:open-file', (content) => importProjectFromText(String(content || '')));

// La otra ventana guardó el proyecto. Se adopta lo que hay en disco si es más
// nuevo que lo que tenemos (gana el último guardado) y se pone al día el panel
// que se está viendo; los escondidos, al asomarse.
EventsOn('producciontv:proyecto-en-disco', (contenido) => {
    if (!activeProject) return;
    let enDisco = null;
    try { enDisco = proyectoDesdeBundle(JSON.parse(String(contenido || ''))); } catch { return; }
    if (!enDisco || enDisco.id !== activeProject.id) return;
    if ((enDisco.updatedAt || '') <= (activeProject.updatedAt || '')) return;
    activeProject = enDisco;
    latestInfografia = enDisco.cfg;
    latestDiagram = enDisco.diagram;
    projects = [enDisco, ...projects.filter((p) => p.id !== enDisco.id)];
    marcarCambio();
    ponerAlDia(panelAlFrente(), vistaVisible());
    showToast('Actualizado desde la otra ventana');
});

// Papelera: lista los .ptv eliminados (Documentos/ProduccionTV/Papelera) y
// permite restaurarlos como proyecto o borrarlos definitivamente (dos pasos).
async function openTrash() {
    const overlay = document.createElement('div');
    overlay.className = 'trash-overlay';
    let confirmName = null;
    let confirmTimer = 0;
    const close = () => {
        clearTimeout(confirmTimer);
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.appendChild(overlay);

    const render = async () => {
        let items = [];
        try { items = (await ListTrashFiles()) || []; } catch { /* papelera ilegible: se muestra vacía */ }
        overlay.innerHTML = `
          <div class="trash-card">
            <div class="trash-head"><h2>🗑 Papelera</h2><button id="trash-close" aria-label="Cerrar papelera">✕</button></div>
            <p class="trash-note">Los proyectos eliminados se guardan en Documentos/ProduccionTV/Papelera. Restaurar los agrega de nuevo a tus proyectos recientes.</p>
            ${items.length ? `<div class="trash-list">${items.map((t) => `
              <article class="trash-item">
                <span><strong>${esc(t.title || t.name)}</strong><small>Eliminado: ${esc(t.deletedAt)}</small></span>
                <div>
                  <button data-restore="${esc(t.name)}">Restaurar</button>
                  ${confirmName === t.name
                    ? `<button data-purge="${esc(t.name)}" class="confirm-delete">¿Borrar para siempre?</button>`
                    : `<button data-purge="${esc(t.name)}" title="Borrar definitivamente">×</button>`}
                </div>
              </article>`).join('')}</div>`
            : '<div class="empty-projects">La papelera está vacía.</div>'}
          </div>`;
        overlay.querySelector('#trash-close').onclick = close;
        overlay.querySelectorAll('[data-restore]').forEach((b) => b.onclick = async () => {
            const name = b.dataset.restore;
            const text = await ReadTrashFile(name).catch(() => '');
            if (!text) { showToast('No se pudo leer el proyecto de la papelera', true); return; }
            // Si la importación falla, el archivo se queda en la papelera.
            if (!importProjectFromText(text, { launch: false })) return;
            await DeleteTrashFile(name).catch(() => {});
            render();
        });
        overlay.querySelectorAll('[data-purge]').forEach((b) => b.onclick = async () => {
            const name = b.dataset.purge;
            clearTimeout(confirmTimer);
            if (confirmName !== name) {
                confirmName = name;
                confirmTimer = setTimeout(() => { confirmName = null; render(); }, 4000);
                render();
                return;
            }
            confirmName = null;
            try { await DeleteTrashFile(name); showToast('Proyecto borrado definitivamente'); }
            catch (error) { showToast(error?.message || 'No se pudo borrar el proyecto', true); }
            render();
        });
    };
    await render();
}

document.querySelector('#open-trash').onclick = openTrash;

// Buscador de proyectos recientes.
document.querySelector('#project-search').oninput = (e) => {
    projectQuery = e.target.value.trim().toLowerCase();
    renderRecent();
};

// Soltar archivos .ptv/.json sobre cualquier parte de la ventana los importa.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])].filter((f) => /\.(ptv|json)$/i.test(f.name));
    if (!files.length) return;
    files.forEach((f, i) => {
        const reader = new FileReader();
        reader.onload = () => importProjectFromText(String(reader.result || ''), { launch: files.length === 1 && i === 0 });
        reader.readAsText(f);
    });
});

// ⌘S: guardado inmediato a disco (también llega desde las herramientas en
// iframe vía el mensaje producciontv:request-save).
function flushSaveNow({ callado = false } = {}) {
    clearTimeout(saveTimer);
    if (!activeProject) { if (!callado) showToast('No hay proyecto activo que guardar'); return; }
    activeProject.cfg = latestInfografia;
    activeProject.diagram = latestDiagram;
    activeProject.updatedAt = new Date().toISOString();
    projects = [activeProject, ...projects.filter((p) => p.id !== activeProject.id)];
    persistProjects();
    saveProjectToDisk(activeProject);
    document.querySelector('#save-status').textContent = 'Guardado en disco';
    renderRecent();
    if (!callado) showToast('Proyecto guardado en disco');
}

const welcomeOverlay = document.querySelector('#welcome-overlay');
const closeWelcome = () => {
    if (!welcomeOverlay || !document.body.contains(welcomeOverlay)) return;
    localStorage.setItem(WELCOME_KEY, '1');
    welcomeOverlay.classList.add('closing');
    setTimeout(() => welcomeOverlay.remove(), 180);
    // Tras la bienvenida, el lanzador entra directo al asistente de producción.
    if (shell.classList.contains('launcher-window')) nuevoProyecto.open();
};
if (welcomeOverlay) {
    document.querySelector('#welcome-close').onclick = closeWelcome;
    welcomeOverlay.onclick = (event) => { if (event.target === welcomeOverlay) closeWelcome(); };
}

/* ------------------------ LOS ATAJOS, EN UN SOLO SITIO ---------------------
Recibe la tecla como DATO, no como evento del navegador, y devuelve `true` si
se la quedó. Así la misma lógica sirve para dos entradas distintas:
  · el teclado de esta ventana (el listener de abajo), y
  · las teclas REENVIADAS desde dentro de una herramienta.
Lo segundo existe porque cada herramienta vive en un <iframe>, que es otro
documento: sus teclas nunca llegaban aquí. En cuanto hacías clic dentro de la
herramienta —lo normal, es donde se trabaja— ⌘1–⌘6 y ⌃Tab dejaban de
responder, y parecía que la app se "rompía" al agrandar la ventana. El puente
que las reenvía es public/tools/shared/atajos.js. */
function atajoDelCaparazon(tecla) {
    const { key = '', metaKey, ctrlKey, shiftKey } = tecla;
    if (key === 'Escape') {
        if (welcomeOverlay && document.body.contains(welcomeOverlay)) { closeWelcome(); return true; }
        if (nuevoProyecto.isOpen()) { nuevoProyecto.close(); return true; }
        desplegarRail();   // la salida de emergencia: Esc siempre trae las etapas
        return false;
    }
    // ⌃Tab / ⌃⇧Tab: rotar entre pestañas, como en cualquier navegador.
    if (key === 'Tab' && ctrlKey && pestanas.abiertas.length) {
        const orden = [PRINCIPAL, ...pestanas.abiertas];
        const i = orden.indexOf(pestanas.activa);
        activarPestana(orden[(i + (shiftKey ? -1 : 1) + orden.length) % orden.length]);
        return true;
    }
    if (!(metaKey || ctrlKey)) return false;
    if (key.toLowerCase() === 's') { flushSaveNow(); return true; }
    // ⌘D: desanclar lo que estás viendo en su propia pestaña.
    if (key.toLowerCase() === 'd' && shell.classList.contains('project-window')) {
        desanclar(vistaVisible()); return true;
    }
    // ⌘W: cerrar la pestaña activa (el módulo vuelve al recorrido). La
    // pestaña Proyecto no se cierra: cerrarla sería cerrar el proyecto.
    if (key.toLowerCase() === 'w') {
        if (shell.classList.contains('tool-window')) { volverAlProyecto(); return true; }
        if (pestanas.activa !== PRINCIPAL) { reanclar(pestanas.activa); return true; }
    }
    // ⌘1–⌘6: una etapa por número, en el orden de la barra lateral.
    const atajo = ETAPAS[Number(key) - 1];
    if (atajo && key >= '1' && key <= '6') {
        selectView(ultimaSeccion[atajo.id] || primeraVista(atajo, normalizeMode(latestInfografia?.modo)));
        return true;
    }
    return false;
}

document.addEventListener('keydown', (event) => {
    if (atajoDelCaparazon(event)) event.preventDefault();
});

// El lanzador refleja los cambios hechos desde las ventanas de proyecto.
window.addEventListener('storage', (event) => {
    if (event.key !== PROJECTS_KEY || shell.classList.contains('project-window')) return;
    projects = readJSON(PROJECTS_KEY, []);
    renderRecent();
});

// Reconciliación entre ventanas vía disco: al recuperar el foco, el lanzador
// relee la lista y una ventana de proyecto recarga su .ptv si otra ventana
// lo guardó más nuevo (gana el último guardado; el disco es la verdad).
window.addEventListener('focus', async () => {
    if (shell.classList.contains('project-window') && activeProject) {
        try {
            const text = await LoadProjectFile(activeProject.id);
            if (!text) return;
            const enDisco = proyectoDesdeBundle(JSON.parse(text));
            if (enDisco && (enDisco.updatedAt || '') > (activeProject.updatedAt || '')) {
                activeProject = enDisco;
                latestInfografia = enDisco.cfg;
                latestDiagram = enDisco.diagram;
                projects = [enDisco, ...projects.filter((p) => p.id !== enDisco.id)];
                // Todos los paneles quedan atrasados de golpe: el que está
                // al frente se pone al día ya, y los escondidos al asomarse.
                marcarCambio();
                const alFrente = panelAlFrente();
                ponerAlDia(alFrente, vistaVisible());
                showToast('Proyecto actualizado desde otra ventana');
            }
        } catch {}
        return;
    }
    if (shell.classList.contains('launcher-window')) {
        await loadProjectsFromDisk();
        renderRecent();
    }
});

/* ------------- Ventana de un módulo desanclado ("tool window") -------------
Es la misma app, arrancada con --tool=<módulo>: muestra ESA herramienta y nada
más. No trae rail ni barra de pestañas —no hay nada que navegar— y su botón ⇲
la devuelve al proyecto: guarda, trae al frente la ventana del proyecto y se
cierra. Comparte el .ptv del disco con la ventana del proyecto, y cada una se
entera de lo que guardó la otra por el aviso de WatchProject. */
function montarVentanaDeModulo(vista) {
    shell.classList.add('project-window', 'tool-window');
    activeView = vista;
    pintarEspacio();
    const acciones = document.querySelector('.header-actions');
    const volver = document.createElement('button');
    volver.id = 'reanclar-btn';
    volver.title = 'Devolver este módulo a la ventana del proyecto y cerrar esta (⌘W)';
    volver.innerHTML = icono('reanclar', 17);
    volver.onclick = () => volverAlProyecto();
    acciones.insertBefore(volver, acciones.firstChild);
    document.querySelector('#desanclar-btn')?.remove();
    // El nombre del módulo, junto al del proyecto: es lo que dice DÓNDE estás.
    const chip = document.querySelector('#mode-chip');
    if (chip) { chip.textContent = etiquetaModulo(vista); chip.classList.remove('narrative'); }
    conGo(SetWindowTitle, `${etiquetaModulo(vista)} — ${activeProject?.name || 'Producción TV'}`);
    cargarEnPrincipal(vista, true);
}

async function volverAlProyecto() {
    flushSaveNow({ callado: true });
    if (activeProject) await conGo(FocusProjectWindow, activeProject.id);
    conGo(CloseWindow);
}

/* ----------------------------- Arranque ----------------------------- */

// Carga los proyectos desde ~/Documents/ProduccionTV (fuente de verdad). Si el
// disco está vacío pero localStorage trae proyectos viejos, se migran una vez.
async function loadProjectsFromDisk() {
    try {
        const files = await LoadAllProjects();
        const fromDisk = (files || [])
            .map((text) => { try { return proyectoDesdeBundle(JSON.parse(text)); } catch { return null; } })
            .filter(Boolean);
        if (fromDisk.length) {
            const porId = new Map();
            fromDisk.forEach((p) => {
                const prev = porId.get(p.id);
                if (!prev || (p.updatedAt || '') > (prev.updatedAt || '')) porId.set(p.id, p);
            });
            projects = [...porId.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
        } else if (projects.length) {
            projects.forEach(saveProjectToDisk);
        }
        activeProject = projects.find((p) => p.id === activeProjectId) || null;
        if (activeProject) {
            latestInfografia = activeProject.cfg;
            latestDiagram = activeProject.diagram || latestDiagram;
        }
    } catch {}
}

async function initializeWindow() {
    await loadProjectsFromDisk();
    let context = { mode: 'launcher', projectID: '' };
    try { context = await GetLaunchContext(); } catch {}

    if ((context.mode === 'project' || context.mode === 'tool') && context.projectID) {
        let transferredProject = null;
        try { transferredProject = context.projectJSON ? JSON.parse(context.projectJSON) : null; } catch {}
        const project = transferredProject?.id === context.projectID
            ? transferredProject
            : projects.find((item) => item.id === context.projectID);
        if (!project) {
            shell.classList.add('launcher-window');
            conGo(SetWindowTitle, 'Producción TV — Inicio');
            selectView('home');
            showToast('El proyecto solicitado ya no existe', true);
            return;
        }
        projects = [project, ...projects.filter((item) => item.id !== project.id)];
        persistProjects();
        saveProjectToDisk(project);
        activeProject = project;
        activeProjectId = project.id;
        latestInfografia = project.cfg;
        latestDiagram = project.diagram || diagramFromConfig(project.cfg);
        localStorage.setItem(ACTIVE_KEY, project.id);
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(latestInfografia));
        localStorage.setItem(DIAGRAM_KEY, JSON.stringify(latestDiagram));
        if (welcomeOverlay && document.body.contains(welcomeOverlay)) welcomeOverlay.remove();
        // Las dos ventanas —la del proyecto y la de un módulo desanclado—
        // escriben el mismo .ptv. Vigilarlo es lo que hace que una se entere
        // de lo que guardó la otra sin tener que hacerle clic.
        conGo(WatchProject, project.id);
        // Ventana de un módulo suelto: solo esa herramienta y ya.
        if (context.mode === 'tool' && toolInfo[context.tool]) {
            montarVentanaDeModulo(context.tool);
            return;
        }
        shell.classList.add('project-window');
        // El nombre del proyecto va en la barra de la ventana: con varias
        // abiertas es lo único que las distingue en Mission Control y en el
        // menú Ventana (antes todas decían "Producción TV — Proyecto").
        conGo(SetWindowTitle, project.name);
        renderRecent();
        // La primera ventana de proyecto arranca con el recorrido guiado, que
        // conduce la navegación desde la etapa 1 (Perfil).
        const primerRecorrido = !localStorage.getItem(TOUR_KEY);
        // Los proyectos nuevos aterrizan en la escaleta/rundown
        // (bandera cfg.abrirEnEscaleta, de un solo uso). El recorrido guiado, si
        // es la primera vez, tiene prioridad y arranca en la vista por defecto.
        const abrirEscaleta = !!latestInfografia?.abrirEnEscaleta;
        if (abrirEscaleta) { latestInfografia = { ...latestInfografia }; delete latestInfografia.abrirEnEscaleta; }
        selectView(!primerRecorrido && abrirEscaleta ? 'escaleta' : 'perfil', true);
        if (primerRecorrido) {
            localStorage.setItem(TOUR_KEY, '1');
            // El recorrido señala los botones de etapa: si la barra quedó
            // recogida dentro del logo, primero se abre.
            setTimeout(() => { desplegarRail(); tour.start(); }, 450);
        }
        if (abrirEscaleta) scheduleSave();
        return;
    }

    activeProject = null;
    activeProjectId = '';
    shell.classList.add('launcher-window');
    refrescarAbiertos();
    // La primera vez se siembra el proyecto demo: un tutorial navegable donde
    // cada sección explica su propia herramienta.
    if (!localStorage.getItem(DEMO_SEEDED_KEY)) {
        localStorage.setItem(DEMO_SEEDED_KEY, '1');
        if (!projects.some((p) => p.id === DEMO_PROJECT_ID)) {
            const demo = makeDemoProject();
            projects = [...projects, demo]; // al final: los proyectos propios primero
            persistProjects();
            saveProjectToDisk(demo);
        }
    }
    selectView('home');
    renderRecent();
    // Si la app se abrió con doble clic a un .ptv, se importa y se abre ese
    // proyecto en lugar de arrancar el asistente.
    if (context.openedFile) {
        importProjectFromText(context.openedFile);
        return;
    }
    // El programa inicia preguntando qué se va a producir hoy (saltable con Esc
    // o "Ir a mis proyectos"). Si la bienvenida está visible, se abre al cerrarla.
    if (!showWelcome) nuevoProyecto.open();
}

selectView('home');
initializeWindow();

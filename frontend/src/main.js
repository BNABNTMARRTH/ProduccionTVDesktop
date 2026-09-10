import './style.css';
import html2canvas from 'html2canvas';
import appIcon from './assets/images/produccion-tv-256.png';
import { icono } from './iconos.js';
import { ClaimProject, CloseWindow, DeleteContact, DeleteProjectFile, DeleteReference, DeleteTrashFile, FocusLauncher, FocusProjectWindow, FocusToolWindow, GetLaunchContext, ListContacts, ListOpenProjects, ListOpenTools, ListReferences, ListTrashFiles, LoadAllProjects, LoadProjectFile, LoadReferenceImage, LoadSettings, OpenProjectWindow, OpenToolWindow, Print, ReadTrashFile, SaveBase64File, SaveContact, SaveProjectFile, SaveReference, SaveSettings, SaveTextFile, SetWindowTitle, WatchProject } from '../wailsjs/go/main/App';
import { EventsOn, WindowIsFullscreen, WindowUnfullscreen } from '../wailsjs/runtime/runtime';
import { makeTemplate, diagramFromConfig, infografiaFromDiagram, uid, PROJECT_MODES, normalizeMode } from './templates.js';
import { createProductionView } from './production.js';
import { createNuevoProyecto } from './nuevo-proyecto.js';
import { createTour } from './tour.js';
import { crearPestanas, PRINCIPAL } from './pestanas.js';
import { DEMO_PROJECT_ID, makeDemoProject } from './demo.js';
import { MAX_PROJECTS, STORAGE_KEYS, esc } from './constants.js';
import { PLANTILLAS_SET, cfgDePlantilla, resumenDePlantilla } from './plantillas.js';
import { crearAjustes, enPxCss } from './ajustes.js';

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
dónde está uno.

DOS NÚMEROS DISTINTOS, y antes se usaba uno solo para las dos cosas:
  · `n`   es el NÚMERO QUE SE VE en la esquina del botón. Solo lo llevan las
          cuatro etapas del recorrido; Documentos y Ensayo van tras el
          separador, fuera de la cuenta.
  · `gel` es la TEMPERATURA de la pantalla (la escala de style.css, 1 azul
          "una idea" → 5 rojo "al aire"). La llevan TODAS.
Confundirlos costaba la identidad entera de la app: como Documentos y Ensayo
no tienen `n`, el gel caía al 1 por omisión y la pantalla volvía al azul de la
primera etapa justo en las dos donde el proyecto ya es real. El rojo del tally
no se veía nunca. */
const ETAPAS = [
    { id: 'perfil', n: '1', gel: '1', etiqueta: 'Perfil', icono: 'perfil',
      ayuda: 'Quién habla, qué dice y a quién (⌘1)',
      secciones: [['perfil', 'Datos y mensaje'], ['referencias', 'Mesa de luz'], ['escuela', 'Escuela de cámara']] },
    { id: 'guion', n: '2', gel: '2', etiqueta: 'Guion', icono: 'guion',
      ayuda: 'Qué pasa, en qué orden y cómo se ve cada toma (⌘2)',
      secciones: [['guionLiterario', 'Guion literario', 'narrative'], ['escaleta', 'Escaleta y guion técnico'], ['tiempos', 'Tiempos']] },
    { id: 'necesidades', n: '3', gel: '3', etiqueta: 'Necesidades', icono: 'necesidades',
      ayuda: 'Todo lo que hay que conseguir: gente y equipo (⌘3)',
      secciones: [['necesidades', 'Personas y equipo'], ['agenda', 'Agenda de crew'], ['diagrama', 'Ruta de señal']] },
    { id: 'planeacion', n: '4', gel: '4', etiqueta: 'Planeación', icono: 'planeacion',
      ayuda: 'Cómo se organiza el rodaje: plano del set y la infografía del proyecto (⌘4)',
      secciones: [['set', 'Plano del set'], ['infografias', 'Infografía']] },
    { id: 'salida', gel: '5', etiqueta: 'Documentos', icono: 'salida',
      ayuda: 'El resultado: el paquete de entrega y las hojas para imprimir (⌘5)',
      secciones: [['exportar', 'Exportar']] },
    { id: 'ensayo', gel: '5', soloVivo: true, etiqueta: 'Ensayo', icono: 'ensayo',
      ayuda: 'En vivo: cronómetro, tally y teleprompter (⌘6)',
      secciones: [['production', 'En vivo']] },
];

// UNA SOLA REGLA para "esta etapa no va en este modo". Antes vivía repartida
// en tres sitios que podían decir cosas distintas —una tabla por modo, una
// bandera en la etapa y un filtro suelto en el menú de módulos— y por eso ⌘6
// abría el Ensayo en un proyecto narrativo, donde la etapa está escondida a
// propósito. Ahora la bandera vive con la etapa y todos preguntan aquí.
const etapaOculta = (etapa, modo) => !!etapa?.soloVivo && modo === 'narrative';

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
        <!-- La configuración también AQUÍ, y no solo dentro de un proyecto:
             quien no alcanza a leer la pantalla tiene que poder agrandarla
             ANTES de abrir nada. -->
        <button id="ajustes-home" title="Configuración: tamaño de la letra y los botones, contraste, tema y atajos">
          <span class="ic">${icono('ajustes', 26)}</span><em>Configuración</em>
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
          <button id="ajustes-btn" title="Configuración: tamaño de la letra y los botones, contraste, tema y atajos">${icono('ajustes', 17)}</button>
          <button id="tour-btn" title="Recorrido guiado: cómo usar la app paso a paso">${icono('ayuda', 17)}</button>
          <button id="desanclar-btn" title="Desanclar esta sección en su propia pestaña (⌘D)${globalThis.__ptvSinVentanas ? '' : '. Después puedes arrastrar la pestaña fuera para abrirla en otra ventana'}.">${icono('desanclar', 17)}</button>
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
    agenda: { title: 'Agenda de crew', description: 'Tu gente: a quién le llamas para cada puesto. Vive en tu disco, no se publica', src: './tools/infografias/index.html', mode: 'agenda' },
    referencias: { title: 'Mesa de luz', description: 'La fototeca de referencias visuales: a qué se tiene que parecer, con etiquetas y color', src: './tools/infografias/index.html', mode: 'referencias' },
    escuela: { title: 'Escuela de cámara', description: 'Una foto, todas las cámaras posibles: probar diafragma, obturador e ISO antes de rodar', src: './tools/escuela/index.html' },
    necesidades: { title: 'Necesidades', description: 'Qué hace falta conseguir: talentos, personal, cámaras y micrófonos', src: './tools/infografias/index.html', mode: 'necesidades' },
    guionLiterario: { title: 'Guion literario', description: 'El guion en su forma tradicional: encabezado, acción, personaje y diálogo', src: './tools/infografias/index.html', mode: 'guion' },
    tiempos: { title: 'Tiempos y salida a edición', description: 'Rundown con duraciones, análisis de tiempos y exportación EDL/CSV', src: './tools/infografias/index.html', mode: 'tiempos' },
    set: { title: 'Set', description: '¿Qué hay en el espacio físico y quién lo opera?', src: './tools/infografias/index.html', mode: 'set' },
    escaleta: { title: 'Escaleta / Rundown', description: '¿Qué pasa primero, qué pasa después y cuánto dura cada bloque?', src: './tools/infografias/index.html', mode: 'escaleta' },
    diagrama: { title: 'Diagrama de señal', description: 'Diseña y valida el flujo de video, audio y streaming', src: './tools/diagrama/index.html' },
    exportar: { title: 'Exportar', description: 'Configura qué exportar, en qué formato, qué secciones incluir y en qué orden', src: './tools/exportar/index.html' },
};

/* ---- AJUSTES: tema, tamaño, contraste y movimiento --------------------
   Todo eso vive en ajustes.js, que es también quien pinta el panel de
   Configuración. Aquí solo se enchufa: al aplicarse un ajuste hay que
   repintar el botón de sol/luna del encabezado. El resto —estampar la raíz y
   avisarle a cada herramienta— lo hace el módulo. */
const ajustes = crearAjustes({
    // Los ajustes viven en un archivo, no en el almacenamiento de esta ventana:
    // cada ventana es un proceso y no ve lo que guardan las demás (ver app.go).
    leerDeDisco: () => conGo(LoadSettings),
    escribirEnDisco: (texto) => conGo(SaveSettings, texto),
    alAplicar: ({ tema }) => {
        const btn = document.querySelector('#tema-btn');
        if (!btn) return;
        btn.innerHTML = icono(tema === 'oscuro' ? 'luna' : 'sol', 17);
        btn.title = tema === 'oscuro' ? 'Cambiar a claro' : 'Cambiar a oscuro';
    },
});

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
const VUELO_MS = 240;   // lo que tarda un botón en entrar (o salir) del logo
const PASO_MS = 20;     // el retraso entre un botón y el siguiente: la fila

// Los botones que SE VEN: la barra tiene dos grupos (Inicio y etapas) y solo
// uno está a la vista, y dentro de él el modo del proyecto esconde algunos.
const botonesRail = () => [...rail.querySelectorAll('.rail-group:not([hidden]) button')]
    .filter((b) => !b.hidden);
const railPlegado = () => shell.classList.contains('rail-plegado');

// Mide el vuelo con la barra DESPLEGADA (es el único momento en que las
// posiciones son de verdad) y lo deja escrito en cada botón. Las medidas se
// reaprovechan al desplegar: la geometría vertical de la barra es la misma.
//
// enPxCss() está por el TAMAÑO de la Configuración: se aplica con `zoom` en la
// raíz, y bajo zoom lo que se mide de la pantalla ya viene multiplicado — si
// ese número vuelve al CSS se multiplica otra vez. Sin la división, al 150 %
// los botones volaban un 50 % de más y se pasaban de largo el logo.
/* PRIMERO SE MIDE TODO, Y DESPUÉS SE ESCRIBE TODO. Nunca alternando.
Ésta era la causa de que la animación arrancara a tirones. Antes el bucle hacía
medir → escribir → medir → escribir…: cada escritura invalida el diseño de la
página, así que la siguiente medición obliga al navegador a RECALCULARLA
ENTERA antes de poder contestar. Seis botones = seis recálculos completos, y
completos incluye el documento de la herramienta que vive en el iframe. Todo
eso caía en el mismo cuadro en el que empieza el vuelo, y el vuelo salía ya
atrasado. Separado en dos pasadas, el recálculo es UNO. */
function medirVuelo() {
    const botones = botonesRail();
    const logo = logoBtn.getBoundingClientRect();
    const cx = logo.left + logo.width / 2;
    const cy = logo.top + logo.height / 2;
    const vuelos = botones.map((boton) => {
        const caja = boton.getBoundingClientRect();
        return { x: Math.round(enPxCss(cx - (caja.left + caja.width / 2))),
                 y: Math.round(enPxCss(cy - (caja.top + caja.height / 2))) };
    });
    botones.forEach((boton, i) => {
        boton.style.setProperty('--vx', `${vuelos[i].x}px`);
        boton.style.setProperty('--vy', `${vuelos[i].y}px`);
        boton.style.setProperty('--i', i);
    });
    return botones.length;
}

/* MIENTRAS LA BARRA SE MUEVE, LA HERRAMIENTA NO SE REACOMODA.
El marco de la herramienta es OTRO DOCUMENTO entero: cada píxel que cambia de
ancho le obliga a recalcular su página completa — y al plegar la barra eso
pasaba en CADA CUADRO de la animación. Es la parte cara de toda la maniobra, y
se notaba justo cuando el logo empieza a viajar.

Así que durante la maniobra se le fija el ancho que va a tener CON LA BARRA
CERRADA, que es el mayor de los dos: al cerrar, el contenido se va descubriendo
por la derecha; al abrir, la barra lo va tapando. Ni un recálculo. Congelarlo en
el más estrecho dejaría un hueco a la derecha. Al terminar se le devuelve el
ancho automático y se reacomoda UNA vez. */
// Partida en dos por lo mismo que medirVuelo: la que LEE va antes que todas
// las escrituras de la maniobra, y así el navegador recalcula la página UNA
// vez en total y no una por cada cosa que le preguntamos.
function anchoCongelado() {
    if (frameWrap.hidden || !frameWrap.clientWidth) return 0;
    const caja = rail.getBoundingClientRect();
    const extra = caja.width > 1
        ? enPxCss(caja.width) + (parseFloat(getComputedStyle(rail).marginLeft) || 0)
        : 0;
    return Math.round(frameWrap.clientWidth + extra);
}

function congelarHerramienta(ancho) {
    if (!(ancho > 0)) return;
    panelesVivos().forEach((p) => { if (p && !p.esVista && p.el) p.el.style.width = `${ancho}px`; });
}

function descongelarHerramienta() {
    panelesVivos().forEach((p) => { if (p && !p.esVista && p.el) p.el.style.width = ''; });
}

let railTimer;
let railTragar;
let railDeshielo;   // cuándo se le devuelve el ancho automático a la herramienta
let railManiobra;   // cuándo se le devuelve el cristal a la barra

// Lo que tarda la barra en encogerse o abrirse (los .24s del CSS) más margen:
// es el rato durante el cual la herramienta va con el ancho congelado.
const ENCOGE_MS = 240 + 120;
// Y la maniobra ENTERA: el vuelo con su fila más el encogimiento.
const maniobraMs = (n) => VUELO_MS + n * PASO_MS + ENCOGE_MS;

/* EL CRISTAL SE APAGA MIENTRAS LA BARRA SE MUEVE.
`backdrop-filter` obliga a volver a desenfocar TODO lo que hay debajo cada vez
que el elemento cambia de sitio o de tamaño: un desenfoque de 30 px sobre
96×870, sesenta veces por segundo, mientras la barra se encoge. Es lo más caro
que hace la app en toda la maniobra.

Y se puede apagar sin que se note. Medido comparando la misma pantalla con y sin
él: la diferencia media es de 0.8/255 en claro y 1.6/255 en oscuro — menos del
1 %—, porque lo único que hay detrás es la pared, que ya es casi lisa. Se paga
un desenfoque carísimo por algo que casi no se ve; durante medio segundo se
puede prescindir de él. */
function empezarManiobra(n) {
    shell.classList.add('maniobra');
    clearTimeout(railManiobra);
    railManiobra = setTimeout(() => shell.classList.remove('maniobra'), maniobraMs(n));
}

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
    empezarManiobra(n);
    shell.classList.add('plegando');
    // El logo da el respingo cuando le está entrando el primer botón, no antes.
    railTragar = setTimeout(() => logoBtn.classList.add('traga'), VUELO_MS * 0.55);
    railTimer = setTimeout(() => {
        // La herramienta se congela JUSTO AQUÍ y no antes: mientras los botones
        // vuelan no cambia de tamaño nada, así que congelarla desde el
        // principio solo le costaría un reacomodo de balde. Se mide con la
        // barra todavía abierta —es cuando se sabe cuánto va a liberar— y se
        // escribe después, para que el navegador recalcule una sola vez.
        const ancho = anchoCongelado();
        shell.classList.remove('plegando');
        logoBtn.classList.remove('traga');
        congelarHerramienta(ancho);
        shell.classList.add('rail-plegado');   // ahora sí: la barra se encoge
        pintarLogo();
        clearTimeout(railDeshielo);
        railDeshielo = setTimeout(descongelarHerramienta, ENCOGE_MS);
    }, VUELO_MS + n * PASO_MS);
}

function desplegarRail() {
    // Vale también a media entrada: si te arrepientes mientras los botones se
    // están metiendo, salen de vuelta en lugar de dejarte esperando.
    if (!railPlegado() && !shell.classList.contains('plegando')) return;
    clearTimeout(railTimer); clearTimeout(railTragar); clearTimeout(railDeshielo);
    empezarManiobra(botonesRail().length);
    // Aquí sí desde el primer instante: al desplegar, la barra empieza a
    // abrirse ya (el hueco primero, los botones después).
    congelarHerramienta(anchoCongelado());
    railDeshielo = setTimeout(descongelarHerramienta, ENCOGE_MS);
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
    clearTimeout(railTimer); clearTimeout(railTragar); clearTimeout(railDeshielo); clearTimeout(railManiobra);
    descongelarHerramienta();
    shell.classList.remove('rail-plegado', 'plegando', 'desplegando', 'maniobra');
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
    // EL PERFIL ya tiene lo suyo en cuanto el proyecto dice qué quiere decir, a
    // quién, o cuánto va a durar. Antes solo miraba la duración y el tipo
    // narrativo: se podía llenar el brief entero —mensaje, intención, receptor,
    // medios, presupuesto— y la etapa no se marcaba nunca, que es justo lo
    // contrario de lo que promete la paloma.
    perfil: (cfg) => {
        const p = cfg?.perfil || {};
        return !!(p.mensaje || p.receptor || p.emisor || p.intencion?.length || p.medios?.length
            || cfg?.narrativa || cfg?.duracionObjetivoSeg || cfg?.duracionObjetivoMin);
    },
    // EL GUION tiene DOS formas, y cualquiera de las dos cuenta: el rundown
    // técnico (las tomas de cada bloque) y el guion literario (los bloques de
    // texto de cada escena). Antes solo contaba el rundown, así que un proyecto
    // narrativo —donde la sección principal de la etapa ES el guion literario—
    // podía tener el guion escrito completo y seguir sin marcar.
    // Se pide texto de verdad: una escena en blanco trae un bloque vacío de
    // plantilla, y ese no es guion escrito.
    guion: (cfg) => (cfg?.escaleta || []).some((seg) => (seg.tomas || []).length
        || (seg.guion || []).some((b) => String(b?.texto || '').trim())),
    necesidades: (cfg, diagram) => (diagram?.edges || []).length > 0,
    planeacion: (cfg) => (cfg?.sets || []).some((x) => (x.muebles || []).length || x.iluminacion || Object.keys(x.setLayout?.pos || {}).length),
    salida: (cfg) => !!cfg?.exportado,
    ensayo: (cfg) => !!cfg?.ensayado,
};

// Diferencias por modo: algunas secciones cambian de nombre porque la misma
// herramienta cambia de función. (Qué etapa no aplica lo dice etapaOculta.)
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
    railButtons.forEach((b) => {
        const etapa = etapaPorId(b.dataset.etapa);
        b.hidden = etapaOculta(etapa, modo);
        b.classList.toggle('done', !!ETAPA_LISTA[b.dataset.etapa]?.(latestInfografia, latestDiagram));
        // Una etapa cuyas secciones se fueron TODAS a otras ventanas sigue en
        // la barra —picarla te lleva a esa ventana— pero se ve apagada, para
        // que no parezca que aquí hay algo que no hay.
        const fuera = !!etapa && seccionesDe(etapa, modo).every(([v]) => modulosEnVentana.has(v));
        b.classList.toggle('fuera', fuera);
        b.title = fuera ? `${etapa.ayuda} · abierto en otra ventana` : (etapa?.ayuda || '');
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
    document.documentElement.dataset.etapa = etapa?.gel || '1';
    // Una sola sección: no hay nada que elegir, la barra sobra.
    const modo = normalizeMode(latestInfografia?.modo);
    const lista = seccionesDe(etapa, modo);
    // La barra de secciones es del recorrido por etapas: solo la pestaña
    // Proyecto la usa. Y las secciones ya desancladas salen de la lista.
    const enPrincipal = pestanas.activa === PRINCIPAL;
    const visibles = lista.filter(([v]) => !pestanas.tiene(v) && !modulosEnVentana.has(v));
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

/* HITOS de la ruta (ensayado / exportado): las palomas ✓ de la barra lateral.
Los pone el shell, NO la herramienta —ensayar y exportar son cosas del shell—,
así que la copia del proyecto que tiene cada herramienta montada no los trae.
Cuando esa herramienta devolvía su cfg, el hito se perdía y la paloma se
apagaba sola: hacías el ensayo, tocabas cualquier campo del guion y el ✓ del
Ensayo desaparecía. Por eso los hitos se arrastran a lo que llega de fuera.
Solo se encienden, nunca se apagan, así que conservarlos es siempre correcto. */
const HITOS = ['ensayado', 'exportado'];
const conHitos = (cfg) => {
    if (!cfg || !latestInfografia) return cfg;
    const faltan = HITOS.filter((h) => latestInfografia[h] && !cfg[h]);
    return faltan.length ? { ...cfg, ...Object.fromEntries(faltan.map((h) => [h, true])) } : cfg;
};

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

/* PANTALLA COMPLETA Y VENTANAS NUEVAS: hay que salir antes.
macOS le da a cada ventana a pantalla completa un ESCRITORIO propio, y una
ventana nueva nace en el escritorio NORMAL. Desde un Inicio a pantalla completa,
el proyecto se abría donde no se veía: parecía que se había abierto "en segundo
plano" o que no había pasado nada. Y al revés era lo mismo — por eso el botón
del nombre del proyecto tampoco encontraba Inicio.

No se puede poner una ventana "encima" de otra a pantalla completa: en ese
escritorio no cabe nada más. La única forma de que la nueva salga al frente es
que las dos vivan en el mismo escritorio, así que primero se sale.

La espera es para el deslizamiento del sistema: pedir una ventana a media
transición se pierde. */
async function dejarPantallaCompleta() {
    try {
        if (await WindowIsFullscreen()) {
            WindowUnfullscreen();
            await new Promise((listo) => setTimeout(listo, 700));
        }
    } catch { /* fuera de Wails no hay ventana a la que preguntarle */ }
}

// Abrir un proyecto NO significa siempre abrir una ventana. Si ese proyecto
// ya está abierto, Go trae esa ventana al frente y no crea una copia: antes
// picarle a la tarjeta abría una segunda ventana del mismo proyecto y el
// trabajo quedaba repartido en dos. OpenProjectWindow devuelve true cuando
// realmente abrió una ventana nueva, para poder decir cuál de las dos pasó.
async function launchProjectWindow(id) {
    const project = projects.find((item) => item.id === id);
    if (!project) { showToast('El proyecto solicitado ya no existe', true); return; }
    localStorage.setItem(ACTIVE_KEY, id);
    /* COMO LA PANTALLA DE INICIO DE WORD: esta MISMA ventana se convierte en el
    proyecto. No nace una ventana nueva, y eso resuelve de raíz lo de pantalla
    completa —macOS le da a cada ventana a pantalla completa un escritorio
    propio, y la nueva nacía en otro, donde no se veía: parecía que el proyecto
    se había abierto "en segundo plano"—. Ahora el proyecto ocupa la pantalla al
    instante, sin salir de pantalla completa ni cambiar de escritorio.
    Para volver a Inicio, el botón del nombre llama una ventana NUEVA en ese
    estado (ver irAInicio), que es también lo que hace Word. */
    if (shell.classList.contains('launcher-window')) {
        const tomada = await conGo(ClaimProject, id, JSON.stringify(project));
        if (tomada) { montarProyecto(project); return; }
        // Ese proyecto ya vive en otra ventana y Go la trajo al frente. Aquí no
        // pasa nada: dos ventanas sobre el mismo .ptv se pisan el trabajo.
        showToast(`“${project.name}” ya estaba abierto: te llevé a esa ventana`);
        refrescarAbiertos();
        return;
    }
    /* Desde una ventana que YA tiene proyecto —pasa al abrir un .ptv con doble
    clic en Finder mientras trabajas— el proyecto nuevo va a su propia ventana:
    convertir ésta te dejaría sin lo que estabas haciendo. */
    await dejarPantallaCompleta();
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

/* ---- QUÉ MÓDULOS SE FUERON A SU PROPIA VENTANA --------------------------
Un módulo que ya vive en otra ventana NO puede seguir estando también en el
recorrido de ésta. Si sigue, hay dos copias vivas del mismo documento y se
pisan entre sí — que es exactamente el fallo que dejaba inservible desanclar
(ver "quien no se ve, no escribe" en el manejador de mensajes) y que volvía a
entrar por la puerta de las ventanas: sacabas el Guion a su ventana y el Guion
seguía ahí, en la barra de secciones de la ventana principal.

Así que desaparece de aquí —de la barra de secciones y del menú del "+"— y
navegar hacia él trae al frente SU ventana en vez de montarlo otra vez.

Quién lo sabe: Go, que lleva el registro de ventanas; los procesos no se
conocen entre sí. Se vuelve a preguntar al recuperar el foco, que es cuando
puede haberse cerrado esa ventana y toca devolver el módulo al recorrido. */
let modulosEnVentana = new Set();

async function refrescarModulosEnVentana() {
    if (!activeProject
        || !shell.classList.contains('project-window')
        || shell.classList.contains('tool-window')) return;
    const vistas = (await conGo(ListOpenTools, activeProject.id)) || [];
    const nuevo = new Set(vistas);
    const igual = nuevo.size === modulosEnVentana.size && [...nuevo].every((v) => modulosEnVentana.has(v));
    if (igual) return;
    modulosEnVentana = nuevo;
    // Si lo que estabas viendo acaba de irse a su ventana, hay que moverse.
    if (modulosEnVentana.has(vistaVisible())) selectView(vistaHermana(vistaVisible()));
    else pintarEspacio();
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
    onGoHome: () => irAInicio(),
    onEnsayo: () => marcaHito('ensayado'),
});

// Recorrido guiado de primera vez (y repetible desde el botón ❔ del header).
const TOUR_KEY = 'producciontv:desktop:tour-hecho';
// El recorrido no puede enseñar una etapa que este proyecto no tiene: en un
// proyecto narrativo el paso del Ensayo en vivo señalaba un botón escondido y
// la tarjeta se quedaba flotando en el centro hablando de una cabina de TV.
const tour = createTour({
    selectView,
    vistaDisponible: (vista) => !etapaOculta(etapaPorId(ETAPA_DE_VISTA[vista]), normalizeMode(latestInfografia?.modo)),
});

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
// ¿Este sistema puede abrir una SEGUNDA ventana de la app? En el Mac sí; en el
// iPad no, y ahí sacar un módulo "a su ventana" solo tapaba la pantalla. La
// pone el puente de iPadOS antes de que arranque la app (ver pestanas.js).
const haySegundaVentana = !globalThis.__ptvSinVentanas;
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
// Cada módulo lleva el icono de SU etapa; el Ensayo, el del aire. Si algún día
// hubiera un módulo fuera del recorrido, la pestaña va sin icono y ya (icono()
// devuelve cadena vacía y pestanas.js lo tiene previsto).
const iconoModulo = (vista) => (vista === 'production' ? 'produccion'
    : ETAPAS.find((e) => e.secciones.some(([v]) => v === vista))?.icono || '');

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
        marco.addEventListener('load', () => { ajustes.mandarA(marco.contentWindow); setTimeout(() => hidratarPanel(panel, vista), 80); });
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
    // El Ensayo no es un iframe: se pinta solo. Vale tanto para su pestaña
    // (panel.esVista) como para su VENTANA suelta, donde el que lo muestra es
    // el panel principal. Sin esta segunda mitad, la ventana de En vivo no se
    // enteraba de lo que guardaba la ventana del proyecto.
    if (panel.esVista || vista === 'production') { production.render(); panel.sello = selloEstado; return; }
    const enviar = () => {
        const w = panel.el?.contentWindow;
        if (!w) return;
        // LOS AJUSTES VIAJAN CON CADA HIDRATACIÓN (el tema, el contraste y el
        // movimiento). Antes el tema se mandaba solo en el evento `load` del
        // iframe, y ahí llegaba demasiado pronto: la herramienta monta sus
        // escuchas después de cargar, así que el mensaje caía en el vacío y
        // TODAS las herramientas arrancaban en claro aunque la app estuviera
        // en oscuro — solo se corregía si el usuario picaba el botón de tema.
        // Se notaba sobre todo en el plano del set, que es casi todo lienzo.
        // La hidratación se manda dos veces (ya y a los 220 ms), así que
        // llegan sí o sí.
        ajustes.mandarA(w);
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

/* A DÓNDE CAER cuando la vista que estabas mirando deja de estar disponible
—porque se desancló a una pestaña o se fue a su propia ventana—. Primero una
hermana de su misma etapa, que es lo menos desorientador; si la etapa entera se
vació, la primera vista libre del recorrido. Antes esto caía a 'perfil' a
secas, y si perfil también estaba desanclado se montaba dos veces. */
function vistaHermana(vista) {
    const modo = normalizeMode(latestInfografia?.modo);
    const libre = (v) => v !== vista && !pestanas.tiene(v) && !modulosEnVentana.has(v);
    const etapa = etapaPorId(ETAPA_DE_VISTA[vista]);
    return seccionesDe(etapa, modo).map(([v]) => v).find(libre)
        || ETAPAS.filter((e) => !etapaOculta(e, modo)).flatMap((e) => seccionesDe(e, modo).map(([v]) => v)).find(libre)
        || 'perfil';
}

// DESANCLAR: el módulo sale del recorrido por etapas y se queda en su propia
// pestaña. Si ya estaba desanclado, simplemente se va a esa pestaña.
function desanclar(vista) {
    if (!DESANCLABLES.includes(vista)) return;
    if (!pestanas.tiene(vista)) {
        pestanas.abrir(vista);
        panelDe(vista);
        showToast(haySegundaVentana
            ? `“${etiquetaModulo(vista)}” quedó en su propia pestaña. Con el botón ⧉ de la pestaña (o arrastrándola fuera de la barra) se abre en su propia ventana.`
            : `“${etiquetaModulo(vista)}” quedó en su propia pestaña.`);
    }
    // La pestaña Proyecto se queda en la sección hermana, no en un hueco.
    if (activeView === vista) {
        activeView = vistaHermana(vista);
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
    await dejarPantallaCompleta();   // si no, nace en otro escritorio y no se ve
    const panel = paneles.get(vista);
    if (panel && !panel.esVista) panel.el.remove();
    paneles.delete(vista);
    pestanas.cerrar(vista);
    activarPestana(PRINCIPAL);
    try {
        const abrioNueva = await OpenToolWindow(activeProject.id, vista, JSON.stringify(activeProject));
        /* Y AQUÍ DESAPARECE DE ESTA VENTANA. Se apunta al momento, sin esperar
        a preguntarle a Go: la ventana nueva tarda un instante en anotarse en el
        registro, y en ese hueco el módulo volvería a asomarse en la barra de
        secciones. Al recuperar el foco se coteja con Go y se corrige solo. */
        modulosEnVentana.add(vista);
        if (vistaVisible() === vista) selectView(vistaHermana(vista));
        else pintarEspacio();
        showToast(abrioNueva
            ? `“${etiquetaModulo(vista)}” se abrió en su propia ventana y salió de ésta`
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
        .filter((v) => !pestanas.tiene(v) && !modulosEnVentana.has(v))
        .filter((v) => !etapaOculta(etapaPorId(ETAPA_DE_VISTA[v]), modo));
    if (!disponibles.length) { showToast('Ya están desanclados todos los módulos'); return; }
    const menu = document.createElement('div');
    menu.className = 'menu-modulos';
    menu.innerHTML = `<p class="menu-nota">Cada módulo se queda en su pestaña, y desde ahí puede salir a su propia ventana.</p>`
        + disponibles.map((v) => `
        <button data-modulo="${v}">${icono(iconoModulo(v), 15)}<span>${esc(etiquetaModulo(v))}</span></button>`).join('');
    document.body.appendChild(menu);
    /* Todo en PÍXELES DE CSS, que es el idioma en el que se van a escribir el
       left y el top. `getBoundingClientRect` y `innerWidth` hablan en píxeles
       de PANTALLA (ya multiplicados por la escala de la Configuración) y
       `offsetWidth` en los de CSS: mezclarlos ponía el menú fuera de la
       ventana en cuanto se agrandaba la interfaz. Ver medirVuelo. */
    const caja = ancla.getBoundingClientRect();
    const izquierdaTope = enPxCss(window.innerWidth) - menu.offsetWidth - 12;
    menu.style.left = `${Math.min(enPxCss(caja.left), izquierdaTope)}px`;
    menu.style.top = `${enPxCss(caja.bottom + 6)}px`;
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
    // LO QUE EL MODO ESCONDE NO SE ABRE POR NINGÚN CAMINO. Aquí, y no en cada
    // atajo, porque esta es la única puerta: por ella pasan la barra lateral,
    // ⌘1–⌘6, el recorrido guiado y el menú de módulos. En un proyecto
    // narrativo el Ensayo en vivo no existe; que ⌘6 lo abriera igual —y de
    // paso encendiera en la barra un botón oculto— era eso, una puerta trasera.
    if (etapaOculta(etapaPorId(ETAPA_DE_VISTA[view]), normalizeMode(latestInfografia?.modo))) return;
    // Si ese módulo ya vive en su propia VENTANA, navegar hacia él es ir a esa
    // ventana. Montarlo aquí otra vez sería tener dos copias del mismo
    // documento peleándose, que es justo lo que se quiso evitar al sacarlo.
    if (modulosEnVentana.has(view)) {
        conGo(FocusToolWindow, activeProject?.id || '', view);
        showToast(`“${etiquetaModulo(view)}” está en su propia ventana: te llevé a ella`);
        return;
    }
    // Si ya vive en su propia pestaña, navegar hacia él es ir a esa pestaña:
    // no tiene caso montarlo dos veces.
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
// Toda la exportación vive en la etapa Documentos (⌘5); el shell solo presta
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
    // El contenido se conserva mientras el panel de impresión esté abierto: su
    // vista previa vuelve a leer el documento al cambiar de opciones. Quién lo
    // apaga, más abajo (soltarImpresion): el panel es del sistema y no avisa
    // cuando se cierra, así que la señal es que el usuario vuelva a tocar la
    // app. Antes NADIE lo apagaba —el único que lo hacía colgaba de un mensaje
    // que ninguna herramienta manda ya— y el documento entero se quedaba
    // montado en memoria, y la bandera puesta, hasta cerrar la ventana.
}

// El panel de impresión ya no está: se suelta el documento montado.
function soltarImpresion() {
    if (!document.documentElement.classList.contains('printing-document')) return;
    document.documentElement.classList.remove('printing-document');
    document.querySelector('#print-host')?.replaceChildren();
}
document.addEventListener('pointerdown', soltarImpresion, true);

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

    /* LA AGENDA. Misma historia que la mesa de luz: la gente no vive en el
       proyecto sino junto a él, en el disco, y la herramienta corre dentro de
       un iframe que no alcanza el puente nativo. Mismo folio por la misma
       razón: con varias pestañas hay varias preguntando a la vez. */
    if (data.type === 'producciontv:agenda') {
        const responder = (extra) => event.source?.postMessage(
            { type: 'producciontv:agenda-respuesta', folio: data.folio, ...extra }, '*');
        try {
            let datos = null;
            if (data.op === 'list') datos = await ListContacts();
            else if (data.op === 'save') await SaveContact(data.id || '', data.ficha || '');
            else if (data.op === 'delete') await DeleteContact(data.id || '');
            else throw new Error(`operación desconocida en la agenda: ${data.op}`);
            responder({ ok: true, datos });
        } catch (error) {
            responder({ ok: false, error: error?.message || 'No se pudo llegar a la agenda' });
        }
        return;
    }

    /* MESA DE LUZ. La fototeca no vive en el proyecto sino junto a él, en el
       disco, así que la herramienta —que corre dentro de un iframe y no
       alcanza el puente nativo— tiene que pedirla por aquí. Cada petición
       trae un FOLIO y la respuesta lo devuelve: con varias pestañas abiertas
       hay varias herramientas preguntando a la vez, y sin folio una podría
       quedarse con la respuesta de otra. */
    if (data.type === 'producciontv:ref') {
        const responder = (extra) => event.source?.postMessage(
            { type: 'producciontv:ref-respuesta', folio: data.folio, ...extra }, '*');
        try {
            let datos = null;
            if (data.op === 'list') datos = await ListReferences();
            else if (data.op === 'save') await SaveReference(data.id || '', data.ficha || '', data.imagen || '');
            else if (data.op === 'image') datos = await LoadReferenceImage(data.id || '');
            else if (data.op === 'delete') await DeleteReference(data.id || '');
            else if (data.op === 'analizar') {
                /* EL OJO DE LA APP SOLO EXISTE EN EL iPAD. Usa Vision, que viene
                   dentro de iPadOS; en el Mac no hay equivalente a mano, así que
                   aquí no se llama a Go: se pregunta si la función está, y si no
                   se responde vacío. La mesa funciona igual en los dos sitios,
                   solo que en el iPad llega medio llena. */
                const ojo = globalThis.go?.main?.App?.AnalizarImagen;
                datos = ojo ? await ojo(data.imagen || '') : null;
            }
            else throw new Error(`operación desconocida en la mesa de luz: ${data.op}`);
            responder({ ok: true, datos });
        } catch (error) {
            responder({ ok: false, error: error?.message || 'No se pudo llegar a la mesa de luz' });
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

    /* QUIEN NO SE VE, NO ESCRIBE (2026-08-29).
    Cada panel es una copia VIVA del proyecto entero: al desanclar un módulo
    quedan dos herramientas montadas a la vez, la de la pestaña nueva y la que
    sigue en la pestaña Proyecto. Las dos mandaban su cfg completo, y el shell
    se quedaba con el último que llegara. La escondida guarda lo de ANTES de
    que empezaras a escribir en la otra, así que en cuanto emitía —al
    rehidratarse, al cambiarle el tema, al reacomodarse— devolvía el proyecto
    al estado viejo y borraba lo recién escrito. Eso es lo que dejaba inservible
    desanclar un módulo: escribías en la pestaña y se te borraba al instante.

    La regla ahora: SOLO EL PANEL QUE ESTÁ AL FRENTE puede cambiar el proyecto.
    Es el único donde el usuario puede haber escrito algo; lo que mande
    cualquier otro es, por definición, un eco o una copia atrasada. Los demás
    no se pierden nada: se ponen al día solos al asomarse (ver ponerAlDia). */
    if (data.type === 'producciontv:infografia-state') {
        if (!panel.escucha) return;
        if (panel !== panelAlFrente()) return;
        /* Y LO QUE NO CAMBIÓ NO SE GUARDA. Hidratar un panel le cambia el
        estado, así que contesta con un eco de lo que acabamos de mandarle. Al
        aceptarlo se marcaba el proyecto como modificado y se escribía el .ptv
        con hora nueva; la OTRA ventana veía un archivo "más reciente", lo
        adoptaba y le arrancaba de las manos lo que su usuario estaba
        escribiendo. Sin cambio real no hay guardado, y se acaba el ping-pong. */
        const entrante = conHitos(data.cfg);
        const texto = JSON.stringify(entrante);
        if (texto === JSON.stringify(latestInfografia)) { panel.sello = selloEstado; return; }
        latestInfografia = entrante;
        localStorage.setItem(AUTOSAVE_KEY, texto);
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
        // El diagrama SÍ puede hablar desde el fondo: el shell le manda el set
        // en caliente (sync-infografia) y lo que devuelve es la ruta de señal
        // recalculada, no una copia atrasada del proyecto. Pero el eco tampoco
        // se guarda: si no cambió ni el diagrama ni lo que se deriva de él, no
        // hay nada que escribir.
        const syncedInfografia = infografiaFromDiagram(data.state, latestInfografia);
        const didSync = syncedInfografia !== latestInfografia;
        if (!didSync && JSON.stringify(data.state) === JSON.stringify(latestDiagram)) { panel.sello = selloEstado; return; }
        latestDiagram = data.state;
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
    ajustes.mandarA(frame.contentWindow);
    setTimeout(() => hidratarPanel(panelPrincipal, activeView), 80);
});
/* CADA ETAPA RECUERDA EN QUÉ SECCIÓN LA DEJASTE — salvo que esa sección se
haya ido a su propia ventana. Si no, picar la etapa te sacaba SIEMPRE a la otra
ventana y no había manera de llegar a las secciones que sí siguen aquí: en
Necesidades, con la Ruta de señal fuera, no se podía volver a Personas y equipo.
Cuando TODAS se fueron sí se va a la otra ventana, que es lo único que queda. */
railButtons.forEach((button) => button.onclick = () => {
    const etapa = etapaPorId(button.dataset.etapa);
    if (!etapa) return;
    const modo = normalizeMode(latestInfografia?.modo);
    const aqui = (v) => !!v && !modulosEnVentana.has(v);
    const recordada = ultimaSeccion[etapa.id];
    const lista = seccionesDe(etapa, modo).map(([v]) => v);
    selectView((aqui(recordada) && recordada) || lista.find(aqui)
        || recordada || primeraVista(etapa, modo));
});
document.querySelector('#desanclar-btn').onclick = () => desanclar(vistaVisible());
renderRecent();

// Al volver a Inicio (o al recuperar el foco) se vuelve a preguntar qué
// proyectos siguen abiertos: puede que el usuario acabe de cerrar una ventana.
// Solo el lanzador: es el único que pinta esas tarjetas.
const revisarAbiertos = () => { if (shell.classList.contains('launcher-window')) refrescarAbiertos(); };
window.addEventListener('focus', revisarAbiertos);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarAbiertos(); });
// Y al volver a esta ventana se cotejan los ajustes con el disco: puede que en
// OTRA ventana hayan cambiado el tamaño de la letra o el contraste. Sin esto,
// la ventana que ya estaba abierta se quedaba como estaba y, en cuanto tocabas
// cualquier ajuste aquí, escribía encima y se perdía el cambio de la otra.
window.addEventListener('focus', () => ajustes.sincronizar());
// Y qué módulos siguen en su propia ventana: si una se cerró, su módulo vuelve
// solo al recorrido de esta ventana.
window.addEventListener('focus', () => refrescarModulosEnVentana());

document.querySelector('#new-project-focus').onclick = () => nuevoProyecto.open();
document.querySelector('[data-accion="nuevo"]').onclick = () => nuevoProyecto.open();
document.querySelector('[data-accion="proyectos"]').onclick = () => selectView('home');
document.querySelector('[data-accion="plantillas"]').onclick = () => selectView('plantillas');
document.querySelector('#tpl-vacio').onclick = () => nuevoProyecto.open();
/* EL NOMBRE DEL PROYECTO funciona como la pestaña Archivo de Word: te devuelve
a Inicio. Y como en Word, Inicio viene en una VENTANA NUEVA —esta ventana era
Inicio y se convirtió en el proyecto, así que no hay ninguna esperando detrás—.
Si ya tuvieras otra ventana de Inicio abierta, se trae ésa al frente en vez de
abrir una tercera (ver FocusLauncher en app.go).

EN PANTALLA COMPLETA NO HACÍA NADA, y no era culpa del botón: macOS le da a
cada ventana a pantalla completa un ESCRITORIO propio, y traer al frente una
ventana que vive en otro escritorio no se ve — el sistema simplemente no
cambia de escritorio. Así que primero se sale de pantalla completa (eso te
devuelve al escritorio donde está Inicio) y ahí sí se la llama. La espera es
para el deslizamiento del sistema: pedir el frente a media transición se
pierde, y volvías a quedarte con la sensación de que el botón no sirve. */
async function irAInicio() {
    if (!shell.classList.contains('project-window')) { selectView('home'); return; }
    await dejarPantallaCompleta();
    conGo(FocusLauncher);
}
document.querySelector('#active-name').onclick = irAInicio;
// Los tres botones de la herramienta: el shell no sabe deshacer nada, solo se
// lo pide al panel que está al frente.
const pedirAHerramienta = (type) => panelAlFrente()?.el?.contentWindow?.postMessage({ type }, '*');
document.querySelector('#undo-btn').onclick = () => pedirAHerramienta('producciontv:undo');
document.querySelector('#redo-btn').onclick = () => pedirAHerramienta('producciontv:redo');
document.querySelector('#guia-btn').onclick = () => pedirAHerramienta('producciontv:toggle-guia');
document.querySelector('#tema-btn').onclick = () => ajustes.alternarTema();
// La Configuración se abre desde los dos sitios: el encabezado de un proyecto
// y la barra de Inicio. Lo segundo importa: quien no alcanza a leer la pantalla
// tiene que poder agrandarla antes de abrir un proyecto.
document.querySelector('#ajustes-btn')?.addEventListener('click', () => ajustes.abrir());
document.querySelector('#ajustes-home')?.addEventListener('click', () => ajustes.abrir());
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
        if (ajustes.estaAbierto()) { ajustes.cerrar(); return true; }
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
    /* UNA VENTANA DE MÓDULO ES UN SOLO MÓDULO, y punto. Ni se desancla nada
    dentro de ella ni se cambia de etapa: ahí no hay barra, ni pestañas, ni
    secciones que gobernar, y su título y su chip dicen de qué módulo es.
    Sin este freno, ⌘D montaba un SEGUNDO iframe del mismo módulo en la misma
    ventana —dos copias vivas del proyecto peleándose, con una barra de
    pestañas escondida detrás del CSS—, y ⌘1–⌘6 cambiaban la herramienta por
    debajo dejando el título mintiendo. */
    const ventanaDeModulo = shell.classList.contains('tool-window');
    // ⌘D: desanclar lo que estás viendo en su propia pestaña.
    if (key.toLowerCase() === 'd' && shell.classList.contains('project-window')) {
        if (!ventanaDeModulo) desanclar(vistaVisible());
        return true;
    }
    // ⌘W: cerrar la pestaña activa (el módulo vuelve al recorrido). La
    // pestaña Proyecto no se cierra: cerrarla sería cerrar el proyecto.
    if (key.toLowerCase() === 'w') {
        if (shell.classList.contains('tool-window')) { volverAlProyecto(); return true; }
        if (pestanas.activa !== PRINCIPAL) { reanclar(pestanas.activa); return true; }
    }
    // ⌘1–⌘6: una etapa por número, en el orden de la barra lateral. Si el modo
    // del proyecto la esconde, selectView la deja pasar de largo.
    const atajo = ETAPAS[Number(key) - 1];
    if (atajo && key >= '1' && key <= '6') {
        const modo = normalizeMode(latestInfografia?.modo);
        if (!ventanaDeModulo) selectView(ultimaSeccion[atajo.id] || primeraVista(atajo, modo));
        return true;
    }
    return false;
}

document.addEventListener('keydown', (event) => {
    if (atajoDelCaparazon(event)) event.preventDefault();
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
    // El nombre del proyecto en la barra: aquí no hay herramienta que conteste
    // con un guardado que lo pusiera de rebote, así que se pinta a mano.
    renderRecent();
    if (vista === 'production') { panelPrincipal.vista = vista; production.render(); }
    else cargarEnPrincipal(vista, true);
}

async function volverAlProyecto() {
    flushSaveNow({ callado: true });
    if (activeProject) await conGo(FocusProjectWindow, activeProject.id);
    conGo(CloseWindow);
}

/* -------- CONVERTIR ESTA VENTANA EN LA VENTANA DE UN PROYECTO --------
Pasa por dos caminos y tiene que hacer exactamente lo mismo en los dos:
  · al arrancar, cuando la ventana nace ya con un proyecto (--project=…), y
  · en caliente, cuando la ventana de INICIO se convierte en el proyecto al
    picarle a su tarjeta (ver launchProjectWindow).
Estaba escrito solo para el primero, dentro de initializeWindow; sacarlo aquí
es lo que permite el segundo sin tener dos copias que se separen. */

// El proyecto pasa a ser EL de esta ventana (memoria, caché y disco).
function adoptarProyecto(project) {
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
    // Las dos ventanas —la del proyecto y la de un módulo desanclado— escriben
    // el mismo .ptv. Vigilarlo es lo que hace que una se entere de lo que
    // guardó la otra sin tener que hacerle clic.
    conGo(WatchProject, project.id);
}

// …y la ventana se viste de ventana de proyecto y abre por donde toca.
function montarProyecto(project) {
    adoptarProyecto(project);
    shell.classList.remove('launcher-window');
    shell.classList.add('project-window');
    // El nombre del proyecto va en la barra de la ventana: con varias abiertas
    // es lo único que las distingue en Mission Control y en el menú Ventana.
    conGo(SetWindowTitle, project.name);
    renderRecent();
    // La primera ventana de proyecto arranca con el recorrido guiado, que
    // conduce la navegación desde la etapa 1 (Perfil).
    const primerRecorrido = !localStorage.getItem(TOUR_KEY);
    // Los proyectos nuevos aterrizan en la escaleta/rundown (bandera
    // cfg.abrirEnEscaleta, de un solo uso). El recorrido guiado, si es la
    // primera vez, tiene prioridad y arranca en la vista por defecto.
    const abrirEscaleta = !!latestInfografia?.abrirEnEscaleta;
    if (abrirEscaleta) { latestInfografia = { ...latestInfografia }; delete latestInfografia.abrirEnEscaleta; }
    selectView(!primerRecorrido && abrirEscaleta ? 'escaleta' : 'perfil', true);
    if (primerRecorrido) {
        localStorage.setItem(TOUR_KEY, '1');
        // El recorrido señala los botones de etapa: si la barra quedó recogida
        // dentro del logo, primero se abre.
        setTimeout(() => { desplegarRail(); tour.start(); }, 450);
    }
    if (abrirEscaleta) scheduleSave();
    // Al final, y no antes: si el módulo por el que abre resulta estar en otra
    // ventana, esto lo detecta y se mueve al hermano.
    refrescarModulosEnVentana();
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
        if (context.mode === 'tool' && DESANCLABLES.includes(context.tool)) {
            /* Ventana de un módulo suelto: solo ese módulo y ya.
            Se pregunta por DESANCLABLES y no por toolInfo, que es la lista de
            las herramientas de iframe. El Ensayo se puede desanclar pero NO es
            un iframe, así que no estaba en toolInfo: al sacarlo a su propia
            ventana esta condición fallaba, la ventana se caía al camino de
            abajo y se abría una SEGUNDA VENTANA COMPLETA del mismo proyecto
            —con su barra de etapas, parada en Perfil— mientras el módulo se
            perdía por el camino. */
            adoptarProyecto(project);
            montarVentanaDeModulo(context.tool);
            return;
        }
        montarProyecto(project);
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

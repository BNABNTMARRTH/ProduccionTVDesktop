import './style.css';
import html2canvas from 'html2canvas';
import appIcon from './assets/images/atj-icon-small.png';
import { icono } from './iconos.js';
import { DeleteProjectFile, DeleteTrashFile, FocusLauncher, GetLaunchContext, ListTrashFiles, LoadAllProjects, LoadProjectFile, OpenProjectWindow, Print, ReadTrashFile, SaveBase64File, SaveProjectFile, SaveTextFile } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { templateCatalog, makeTemplate, diagramFromConfig, infografiaFromDiagram, uid, PROJECT_MODES, normalizeMode } from './templates.js';
import { createProductionView } from './production.js';
import { createNuevoProyecto } from './nuevo-proyecto.js';
import { createTour } from './tour.js';
import { DEMO_PROJECT_ID, makeDemoProject } from './demo.js';
import { MAX_PROJECTS, STORAGE_KEYS, esc } from './constants.js';

/* ----------------------------- Estado ----------------------------- */

const {
    projects: PROJECTS_KEY,
    activeProject: ACTIVE_KEY,
    welcomeSeen: WELCOME_KEY,
    demoSeeded: DEMO_SEEDED_KEY,
    autosave: AUTOSAVE_KEY,
    diagram: DIAGRAM_KEY,
} = STORAGE_KEYS;

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
let acceptFrameState = false;
let hydrationTimer;
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
      secciones: [['escaleta', 'Escaleta y guion técnico']] },
    { id: 'necesidades', n: '3', etiqueta: 'Necesidades', icono: 'necesidades',
      ayuda: 'Todo lo que hay que conseguir: gente y equipo (⌘3)',
      secciones: [['necesidades', 'Personas y equipo'], ['diagrama', 'Ruta de señal']] },
    { id: 'planeacion', n: '4', etiqueta: 'Planeación', icono: 'planeacion',
      ayuda: 'Cómo se organiza el rodaje: plano del set y hojas de trabajo (⌘4)',
      secciones: [['set', 'Plano del set'], ['guias', 'Hojas imprimibles']] },
    { id: 'salida', etiqueta: 'Documentos', icono: 'salida',
      ayuda: 'El resultado: infografía y paquete de entrega (⌘5)',
      secciones: [['infografias', 'Infografía'], ['exportar', 'Exportar']] },
    { id: 'ensayo', etiqueta: 'Ensayo', icono: 'ensayo', soloVivo: true,
      ayuda: 'En vivo: cronómetro, tally y teleprompter (⌘6)',
      secciones: [['production', 'En vivo']] },
];

// Vista -> etapa a la que pertenece (se calcula una vez).
const ETAPA_DE_VISTA = Object.fromEntries(
    ETAPAS.flatMap((e) => e.secciones.map(([vista]) => [vista, e.id])),
);
const etapaPorId = (id) => ETAPAS.find((e) => e.id === id);
const primeraVista = (etapa) => etapa.secciones[0][0];

/* ----------------------------- Estructura ----------------------------- */

const showWelcome = !localStorage.getItem(WELCOME_KEY);

document.querySelector('#app').innerHTML = `
  <div class="desktop-shell">
    <nav class="rail" id="rail" aria-label="Herramientas">
      <img class="rail-logo" src="${appIcon}" alt="">
      <div class="rail-group" id="rail-home" hidden>
        <button data-accion="proyectos" class="active" title="Todos tus proyectos">
          <span class="ic">${icono('proyecto', 26)}</span><em>Proyectos</em>
        </button>
        <button data-accion="nuevo" title="Crear un proyecto nuevo con el asistente">
          <span class="ic">${icono('nuevo', 26)}</span><em>Nuevo</em>
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
      <header class="workspace-header" id="workspace-header">
        <button class="offline-badge" id="active-name" title="Ir a Inicio: proyectos y plantillas">Guardado local</button>
        <span class="mode-chip" id="mode-chip" title="Modo del proyecto. Se elige al crearlo y define las herramientas disponibles."></span>
        <div class="header-actions">
          <span class="save-status" id="save-status">Guardado local</span>
          <button id="tour-btn" title="Recorrido guiado: cómo usar la app paso a paso">${icono('ayuda', 17)}</button>
          <button id="focus-mode" title="Modo pantalla completa">${icono('pantalla', 17)}</button>
        </div>
      </header>
      <nav class="secciones" id="secciones" hidden aria-label="Secciones de la etapa"></nav>
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

      <div class="frame-wrap" id="frame-wrap"><div class="loading" id="loading"><span></span>Cargando herramienta…</div><iframe id="tool-frame" title="Herramienta de Producción TV" allow="clipboard-read; clipboard-write"></iframe></div>
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
    set: { title: 'Set', description: '¿Qué hay en el espacio físico y quién lo opera?', src: './tools/infografias/index.html', mode: 'set' },
    escaleta: { title: 'Escaleta / Rundown', description: '¿Qué pasa primero, qué pasa después y cuánto dura cada bloque?', src: './tools/infografias/index.html', mode: 'escaleta' },
    diagrama: { title: 'Diagrama de señal', description: 'Diseña y valida el flujo de video, audio y streaming', src: './tools/diagrama/index.html' },
    guias: { title: 'Guías de set imprimibles', description: 'Hojas rellenables a mano: escaleta, cámaras, checklist, plano y registro de cambios', src: './tools/guias/index.html' },
    exportar: { title: 'Exportar', description: 'Configura qué exportar, en qué formato, qué secciones incluir y en qué orden', src: './tools/exportar/index.html' },
};

const shell = document.querySelector('.desktop-shell');
const frame = document.querySelector('#tool-frame');
const frameWrap = document.querySelector('#frame-wrap');
const homeView = document.querySelector('#home-view');
const productionView = document.querySelector('#production-view');
const header = document.querySelector('#workspace-header');
const rail = document.querySelector('#rail');
const railTools = document.querySelector('#rail-tools');
const railHome = document.querySelector('#rail-home');
const loading = document.querySelector('#loading');
const railButtons = [...document.querySelectorAll('[data-etapa]')];
const toast = document.querySelector('#export-toast');
let toastTimer;

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

// Señales REALES de que una etapa ya tiene lo suyo. No se inventa avance: una
// etapa sin señal medible simplemente no se marca.
const ETAPA_LISTA = {
    perfil: (cfg) => !!(cfg?.narrativa || cfg?.duracionObjetivoMin),
    guion: (cfg) => (cfg?.escaleta || []).some((seg) => (seg.tomas || []).length),
    necesidades: (cfg, diagram) => (diagram?.edges || []).length > 0,
    planeacion: (cfg) => (cfg?.sets || []).some((x) => (x.muebles || []).length || x.iluminacion || Object.keys(x.setLayout?.pos || {}).length),
    salida: (cfg) => !!cfg?.exportado,
    ensayo: (cfg) => !!cfg?.ensayado,
};

// Diferencias por modo: en narrativo el ensayo en vivo no aplica y algunas
// secciones cambian de nombre (la misma herramienta cambia de función).
const ETAPAS_OCULTAS = { narrative: ['ensayo'] };
const SECCION_ETIQUETAS = { narrative: { set: 'Plano de la locación', escaleta: 'Historia y guion', diagrama: 'Escena' } };

// Última sección visitada de cada etapa, para volver donde uno la dejó.
const ultimaSeccion = {};

const etapaActiva = () => ETAPA_DE_VISTA[activeView] || null;

function renderModo() {
    if (!shell.classList.contains('project-window')) return;
    const modo = normalizeMode(latestInfografia?.modo);
    const chip = document.querySelector('#mode-chip');
    if (chip) {
        chip.textContent = PROJECT_MODES[modo].chip;
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
    if (!shell.classList.contains('project-window')) { secciones.hidden = true; return; }
    renderModo();
    const etapa = etapaPorId(etapaActiva());
    railButtons.forEach((b) => b.classList.toggle('active', b.dataset.etapa === etapa?.id));
    // Una sola sección: no hay nada que elegir, la barra sobra.
    if (!etapa || etapa.secciones.length < 2 || header.hidden) { secciones.hidden = true; return; }
    const modo = normalizeMode(latestInfografia?.modo);
    const rot = SECCION_ETIQUETAS[modo] || {};
    secciones.hidden = false;
    secciones.innerHTML = etapa.secciones.map(([vista, etiqueta]) => `
        <button data-seccion="${vista}" class="${vista === activeView ? 'active' : ''}">
          ${rot[vista] || etiqueta}
        </button>`).join('');
    secciones.querySelectorAll('[data-seccion]').forEach((b) => {
        b.onclick = () => selectView(b.dataset.seccion);
    });
}

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

async function launchProjectWindow(id) {
    localStorage.setItem(ACTIVE_KEY, id);
    const project = projects.find((item) => item.id === id);
    if (!project) { showToast('El proyecto solicitado ya no existe', true); return; }
    try {
        await OpenProjectWindow(id, JSON.stringify(project));
        showToast('Proyecto abierto en una ventana nueva');
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

const chipModo = (p) => {
    const modo = normalizeMode(p.cfg?.modo);
    return `<span class="proj-badge ${modo}">${PROJECT_MODES[modo].chip}</span>`;
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
          <div class="proj-thumb">${miniPlano(seguir.cfg)}</div>
          <div class="continue-body">
            <span class="continue-eyebrow">Seguir donde te quedaste</span>
            <h2>${seguir.name}</h2>
            <p>${[chipModo(seguir), resumenProyecto(seguir)].filter(Boolean).join(' ')}</p>
            <small>${fechaCorta(seguir.updatedAt)}</small>
            <button class="continue-go" data-open="${seguir.id}">Continuar</button>
          </div>
        </article>` : '';

    box.innerHTML = filtrados.length
        ? filtrados.filter((p) => p.id !== seguir?.id).slice(0, projectQuery ? 30 : 14).map((p) => `
            <article class="proj-card">
              <div class="proj-thumb" data-open="${p.id}" role="button" tabindex="0" title="Abrir ${p.name}">
                ${miniPlano(p.cfg)}
                ${p.id === DEMO_PROJECT_ID ? '<span class="proj-tag">Tutorial</span>' : ''}
              </div>
              <div class="proj-meta">
                <strong title="${p.name}">${p.name}</strong>
                <small>${fechaCorta(p.updatedAt)}${resumenProyecto(p) ? ` · ${resumenProyecto(p)}` : ''}</small>
              </div>
              <div class="proj-foot">
                ${chipModo(p)}
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

function selectView(view, forceReload = false) {
    activeView = view;
    acceptFrameState = false;
    clearTimeout(hydrationTimer);
    if (ETAPA_DE_VISTA[view]) ultimaSeccion[ETAPA_DE_VISTA[view]] = view;
    const isTool = !!toolInfo[view];
    homeView.hidden = view !== 'home';
    productionView.hidden = view !== 'production';
    // Las pestañas viven en el header: visible siempre, salvo en Inicio
    // (el lanzador es solo la pantalla de inicio).
    header.hidden = view === 'home';
    // La barra lateral acompaña siempre: en Inicio muestra las acciones del
    // lanzador (proyectos, nuevo, importar, papelera) y dentro de un proyecto,
    // las herramientas.
    railHome.hidden = view !== 'home';
    railTools.hidden = view === 'home';
    renderNav();
    frameWrap.hidden = !isTool;
    if (view === 'home') { renderRecent(); return; }
    if (view === 'production') { production.render(); return; }
    const tool = toolInfo[view];
    if (forceReload || !frame.src.includes(tool.src.replace('./', ''))) {
        loading.classList.remove('hidden');
        frame.src = tool.src;
    } else {
        hydrateFrame();
    }
}

// Envía el estado del proyecto al iframe de la herramienta. Se manda dos veces
// (inmediato y tras 220 ms) porque el iframe puede tardar en montar sus listeners;
// hasta entonces se ignoran los mensajes de estado que el iframe emite al arrancar.
function hydrateFrame() {
    if (!activeProject) return;
    const hydratedView = activeView;
    const sendState = () => {
        if (activeView !== hydratedView) return;
        if (toolInfo[hydratedView]?.src.includes('/infografias/')) {
            frame.contentWindow.postMessage({ type: 'producciontv:load-infografia', cfg: latestInfografia, mode: toolInfo[hydratedView].mode || 'editar' }, '*');
        }
        if (hydratedView === 'diagrama') frame.contentWindow.postMessage({ type: 'producciontv:hydrate-diagram', state: latestDiagram, cfg: latestInfografia }, '*');
        if (hydratedView === 'guias') frame.contentWindow.postMessage({ type: 'producciontv:load-guias', cfg: latestInfografia, projectName: activeProject?.name || '' }, '*');
        if (hydratedView === 'exportar') frame.contentWindow.postMessage({ type: 'producciontv:load-exportar', cfg: latestInfografia, diagram: latestDiagram, project: activeProject, projectName: activeProject?.name || '' }, '*');
    };
    acceptFrameState = false;
    sendState();
    clearTimeout(hydrationTimer);
    hydrationTimer = setTimeout(() => {
        if (activeView !== hydratedView) return;
        acceptFrameState = true;
        sendState();
    }, 220);
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

    // Las herramientas piden el panel nativo de impresión a través del shell
    // (window.print no funciona dentro del WebView).
    if (data.type === 'producciontv:print' && event.source === frame.contentWindow) {
        await printCurrentTool();
        return;
    }

    // Documento multipágina: la herramienta manda páginas + estilos ya listos.
    if (data.type === 'producciontv:print-document' && event.source === frame.contentWindow) {
        if (activeView === 'exportar') marcaHito('exportado');
        await printDocumentHTML(data.html, data.css);
        return;
    }

    // Exportar pide capturar cada página como PNG independiente. El shell tiene
    // html2canvas y acceso al DOM del iframe (mismo origen), así que captura y
    // guarda página por página con el diálogo nativo.
    if (data.type === 'producciontv:export-pngs' && event.source === frame.contentWindow) {
        try {
            if (activeView === 'exportar') marcaHito('exportado');
            const pages = [...(frame.contentDocument?.querySelectorAll('.export-page') || [])];
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
    if (data.type === 'producciontv:save-file' && event.source === frame.contentWindow) {
        try {
            if (activeView === 'exportar') marcaHito('exportado');
            if (await SaveTextFile(data.filename || 'archivo.txt', data.content || '')) showToast('Archivo guardado');
        } catch (error) {
            showToast(error?.message || 'No se pudo guardar el archivo', true);
        }
        return;
    }

    if (data.type === 'producciontv:infografia-state') {
        if (!acceptFrameState || event.source !== frame.contentWindow) return;
        latestInfografia = data.cfg;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(latestInfografia));
        if (activeView === 'diagrama') frame.contentWindow.postMessage({ type: 'producciontv:sync-infografia', cfg: latestInfografia }, '*');
        scheduleSave();
        return;
    }

    if (data.type === 'producciontv:diagram-state') {
        if (!acceptFrameState || event.source !== frame.contentWindow) return;
        latestDiagram = data.state;
        const syncedInfografia = infografiaFromDiagram(latestDiagram, latestInfografia);
        const didSync = syncedInfografia !== latestInfografia;
        latestInfografia = syncedInfografia;
        localStorage.setItem(DIAGRAM_KEY, JSON.stringify(latestDiagram));
        if (didSync) {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(latestInfografia));
            showToast('Infografías actualizadas desde el diagrama');
        }
        scheduleSave();
    }
});

/* ----------------------------- Eventos generales ----------------------------- */

frame.addEventListener('load', () => { loading.classList.add('hidden'); setTimeout(hydrateFrame, 80); });
railButtons.forEach((button) => button.onclick = () => {
    const etapa = etapaPorId(button.dataset.etapa);
    if (etapa) selectView(ultimaSeccion[etapa.id] || primeraVista(etapa));
});
renderRecent();

document.querySelector('#new-project-focus').onclick = () => nuevoProyecto.open();
document.querySelector('[data-accion="nuevo"]').onclick = () => nuevoProyecto.open();
// El nombre del proyecto en el header funciona como la pestaña Archivo de
// Word: desde una ventana de proyecto trae al frente la ventana ORIGINAL de
// inicio (el lanzador) — no una copia local; si ya se cerró, Go abre una nueva.
document.querySelector('#active-name').onclick = () => {
    if (shell.classList.contains('project-window')) { FocusLauncher().catch(() => {}); return; }
    selectView('home');
};
document.querySelector('#focus-mode').onclick = () => shell.classList.toggle('focus-mode');
document.querySelector('#tour-btn').onclick = () => { localStorage.setItem(TOUR_KEY, '1'); tour.start(); };

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
function flushSaveNow() {
    clearTimeout(saveTimer);
    if (!activeProject) { showToast('No hay proyecto activo que guardar'); return; }
    activeProject.cfg = latestInfografia;
    activeProject.diagram = latestDiagram;
    activeProject.updatedAt = new Date().toISOString();
    projects = [activeProject, ...projects.filter((p) => p.id !== activeProject.id)];
    persistProjects();
    saveProjectToDisk(activeProject);
    document.querySelector('#save-status').textContent = 'Guardado en disco';
    renderRecent();
    showToast('Proyecto guardado en disco');
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

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (welcomeOverlay && document.body.contains(welcomeOverlay)) { closeWelcome(); return; }
        if (nuevoProyecto.isOpen()) { nuevoProyecto.close(); return; }
        shell.classList.remove('focus-mode');
    }
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); flushSaveNow(); return; }
    // ⌘1–⌘6: una etapa por número, en el orden de la barra lateral.
    const atajo = ETAPAS[Number(event.key) - 1];
    if (atajo && event.key >= '1' && event.key <= '6') {
        selectView(ultimaSeccion[atajo.id] || primeraVista(atajo));
    }
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
                if (activeView === 'production') production.render();
                else hydrateFrame();
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

    if (context.mode === 'project' && context.projectID) {
        let transferredProject = null;
        try { transferredProject = context.projectJSON ? JSON.parse(context.projectJSON) : null; } catch {}
        const project = transferredProject?.id === context.projectID
            ? transferredProject
            : projects.find((item) => item.id === context.projectID);
        if (!project) {
            shell.classList.add('launcher-window');
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
        shell.classList.add('project-window');
        if (welcomeOverlay && document.body.contains(welcomeOverlay)) welcomeOverlay.remove();
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
            setTimeout(() => tour.start(), 450);
        }
        if (abrirEscaleta) scheduleSave();
        return;
    }

    activeProject = null;
    activeProjectId = '';
    shell.classList.add('launcher-window');
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

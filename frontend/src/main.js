import './style.css';
import html2canvas from 'html2canvas';
import appIcon from './assets/images/atj-icon-small.png';
import { DeleteProjectFile, DeleteTrashFile, GetLaunchContext, ListTrashFiles, LoadAllProjects, LoadProjectFile, OpenProjectWindow, Print, ReadTrashFile, SaveBase64File, SaveProjectFile, SaveTextFile } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { templateCatalog, makeTemplate, diagramFromConfig, infografiaFromDiagram, uid } from './templates.js';
import { createProductionView } from './production.js';
import { createWizard } from './wizard.js';
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

/* ----------------------------- Estructura ----------------------------- */

const showWelcome = !localStorage.getItem(WELCOME_KEY);

document.querySelector('#app').innerHTML = `
  <div class="desktop-shell">
    <aside class="sidebar">
      <div class="brand"><img class="brand-logo" src="${appIcon}" alt=""><span><strong>Producción TV</strong><small>Centro de trabajo</small></span></div>
      <nav class="tool-nav" aria-label="Navegación">
        <button data-view="home"><span class="nav-icon">⌂</span><span><strong>Inicio</strong><small>Proyectos y plantillas</small></span></button>
        <button data-view="infografias"><span class="nav-icon">▤</span><span><strong>Infografías</strong><small>La hoja completa del proyecto</small></span><kbd>⌘1</kbd></button>
        <button data-view="set"><span class="nav-icon">▦</span><span><strong>Set</strong><small>Espacio físico y quién lo opera</small></span><kbd>⌘2</kbd></button>
        <button data-view="escaleta"><span class="nav-icon">≡</span><span><strong>Escaleta / Rundown</strong><small>Orden narrativo y temporal</small></span><kbd>⌘3</kbd></button>
        <button data-view="diagrama"><span class="nav-icon">⌁</span><span><strong>Diagrama</strong><small>Ruta de señal</small></span><kbd>⌘4</kbd></button>
        <button data-view="production"><span class="nav-icon">●</span><span><strong>Producción</strong><small>En vivo y validaciones</small></span><kbd>⌘5</kbd></button>
        <button data-view="guias"><span class="nav-icon">⎙</span><span><strong>Guías de set</strong><small>Hojas imprimibles para llenar a mano</small></span><kbd>⌘6</kbd></button>
        <button data-view="exportar"><span class="nav-icon">⇩</span><span><strong>Exportar</strong><small>Arma el documento: formato, secciones y orden</small></span><kbd>⌘7</kbd></button>
      </nav>
      <div class="sidebar-resizer" id="sidebar-resizer"></div>
      <div class="sidebar-footer"><span class="status-dot"></span><span><strong id="save-status">Guardado local</strong><small id="project-label">Sin proyecto activo</small></span></div>
    </aside>

    <main class="workspace">
      <section class="home-view" id="home-view">
        <div class="home-hero"><div><span class="eyebrow">ATJ · PRODUCCIÓN AUDIOVISUAL</span><h1>¿Qué vas a producir hoy?</h1><p>Crea un proyecto desde cero o comienza con una estructura técnica preparada.</p></div><button id="new-project-focus">＋ Nuevo proyecto</button></div>
        <div class="home-grid">
          <div class="home-main">
            <h2>Plantillas</h2>
            <p class="template-hint">Cada plantilla abre el asistente con la base técnica ya sugerida.</p>
            <div class="template-grid" id="template-grid"></div>
          </div>
          <aside class="recent-panel"><div class="section-title"><h2>Proyectos recientes</h2><span id="project-count"></span></div><input id="project-search" class="project-search" type="search" placeholder="Buscar proyecto…" aria-label="Buscar proyecto por nombre"><div id="recent-projects"></div><button class="import-project" id="import-project" title="Abre un proyecto .ptv exportado desde otra computadora (también puedes soltarlo sobre la ventana)">⬆ Importar proyecto (.ptv)</button><input type="file" id="import-file" accept=".ptv,.json" hidden><button class="trash-link" id="open-trash" title="Los proyectos eliminados se pueden restaurar desde aquí">🗑 Ver papelera</button></aside>
        </div>
        <p class="home-credit">Hecha por <strong>Aldo Abiud Torres Juárez</strong>, alumno de la FCC, para las y los alumnos de la FCC.</p>
      </section>

      <header class="workspace-header" id="workspace-header"><div><h1 id="tool-title"></h1><p id="tool-description"></p></div><div class="header-actions"><span class="offline-badge" id="active-name">Guardado local</span><button id="focus-mode" title="Modo pantalla completa">⛶</button></div></header>
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

// set y escaleta son vistas enfocadas del mismo generador: cambia el `mode`
// que se envía al hidratar, no el iframe.
const toolInfo = {
    infografias: { title: 'Generador de infografías', description: 'La hoja completa: set, escaleta, personal y branding', src: './tools/infografias/index.html' },
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
const loading = document.querySelector('#loading');
const navButtons = [...document.querySelectorAll('[data-view]')];
const title = document.querySelector('#tool-title');
const description = document.querySelector('#tool-description');
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

function scheduleSave() {
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
    const cfg = makeTemplate(template, { ...profile, projectName: name, company: profile.company || 'ATJ Producciones' });
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
    // Este proyecto ya vive en esta ventana: volver a la herramienta en vez
    // de abrir una ventana duplicada del mismo proyecto.
    if (id === activeProjectId && shell.classList.contains('project-window')) { selectView('infografias'); return; }
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

function renderRecent() {
    const box = document.querySelector('#recent-projects');
    const cerca = projects.length >= MAX_PROJECTS - 10;
    const count = document.querySelector('#project-count');
    count.textContent = cerca ? `${projects.length} / ${MAX_PROJECTS} ⚠` : `${projects.length}`;
    count.title = cerca ? `Cerca del tope de ${MAX_PROJECTS} proyectos: exporta o elimina los que ya no uses` : '';
    document.querySelector('#project-label').textContent = activeProject?.name || 'Sin proyecto activo';
    document.querySelector('#active-name').textContent = activeProject?.name || 'Guardado local';
    const filtrados = projectQuery
        ? projects.filter((p) => (p.name || '').toLowerCase().includes(projectQuery))
        : projects;
    box.innerHTML = filtrados.length
        ? filtrados.slice(0, projectQuery ? 30 : 8).map((p) => `
            <article class="recent-item">
              <span class="recent-icon">${p.id === DEMO_PROJECT_ID ? '🎓' : templateCatalog.find((t) => t.id === p.template)?.icon || '◆'}</span>
              <span><strong>${p.name}</strong><small>${new Date(p.updatedAt).toLocaleString()}</small></span>
              <div>
                <button data-open="${p.id}">Abrir</button>
                <button data-duplicate="${p.id}" title="Duplicar">⧉</button>
                ${pendingDeleteId === p.id
                    ? `<button data-delete="${p.id}" class="confirm-delete">¿Eliminar?</button>`
                    : `<button data-delete="${p.id}" title="Eliminar">×</button>`}
              </div>
            </article>`).join('')
        : `<div class="empty-projects">${projectQuery ? `Sin resultados para “${projectQuery}”.` : 'Todavía no hay proyectos.<br>Elige una plantilla para comenzar.'}</div>`;
    box.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => launchProjectWindow(b.dataset.open));
    box.querySelectorAll('[data-duplicate]').forEach((b) => b.onclick = () => duplicateProject(b.dataset.duplicate));
    box.querySelectorAll('[data-delete]').forEach((b) => b.onclick = () => requestDeleteProject(b.dataset.delete));
}

function renderTemplates() {
    const box = document.querySelector('#template-grid');
    box.innerHTML = templateCatalog.map((t) => `<button class="template-card" data-template="${t.id}"><span>${t.icon}</span><strong>${t.name}</strong><small>${t.detail}</small></button>`).join('');
    box.querySelectorAll('[data-template]').forEach((button) => button.onclick = () => wizard.open(button.dataset.template));
}

/* ----------------------------- Vistas ----------------------------- */

const wizard = createWizard({ onCreate: createProject });

const production = createProductionView({
    container: productionView,
    getProject: () => activeProject,
    getInfografia: () => latestInfografia,
    getDiagram: () => latestDiagram,
    onGoHome: () => selectView('home'),
});

function selectView(view, forceReload = false) {
    activeView = view;
    acceptFrameState = false;
    clearTimeout(hydrationTimer);
    navButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    const isTool = !!toolInfo[view];
    homeView.hidden = view !== 'home';
    productionView.hidden = view !== 'production';
    header.hidden = !isTool;
    frameWrap.hidden = !isTool;
    if (view === 'home') {
        renderRecent();
        // Inicio desde una ventana de proyecto (estilo Word: Archivo →
        // pantalla de inicio): su lista puede estar vieja, así que guarda lo
        // actual en silencio y relee el disco, donde escriben todas las ventanas.
        if (shell.classList.contains('project-window') && activeProject) {
            flushSaveNow(true);
            loadProjectsFromDisk().then(renderRecent);
        }
        return;
    }
    if (view === 'production') { production.render(); return; }
    const tool = toolInfo[view];
    title.textContent = tool.title;
    description.textContent = tool.description;
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
        if (hydratedView === 'infografias' || hydratedView === 'set' || hydratedView === 'escaleta') {
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
        await printDocumentHTML(data.html, data.css);
        return;
    }

    // Exportar pide capturar cada página como PNG independiente. El shell tiene
    // html2canvas y acceso al DOM del iframe (mismo origen), así que captura y
    // guarda página por página con el diálogo nativo.
    if (data.type === 'producciontv:export-pngs' && event.source === frame.contentWindow) {
        try {
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
navButtons.forEach((button) => button.onclick = () => selectView(button.dataset.view));
renderTemplates();
renderRecent();

document.querySelector('#new-project-focus').onclick = () => wizard.open();
document.querySelector('#focus-mode').onclick = () => shell.classList.toggle('focus-mode');

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
function flushSaveNow(silent = false) {
    clearTimeout(saveTimer);
    if (!activeProject) { if (!silent) showToast('No hay proyecto activo que guardar'); return; }
    activeProject.cfg = latestInfografia;
    activeProject.diagram = latestDiagram;
    activeProject.updatedAt = new Date().toISOString();
    projects = [activeProject, ...projects.filter((p) => p.id !== activeProject.id)];
    persistProjects();
    saveProjectToDisk(activeProject);
    document.querySelector('#save-status').textContent = 'Guardado en disco';
    renderRecent();
    if (!silent) showToast('Proyecto guardado en disco');
}

const welcomeOverlay = document.querySelector('#welcome-overlay');
const closeWelcome = () => {
    if (!welcomeOverlay || !document.body.contains(welcomeOverlay)) return;
    localStorage.setItem(WELCOME_KEY, '1');
    welcomeOverlay.classList.add('closing');
    setTimeout(() => welcomeOverlay.remove(), 180);
    // Tras la bienvenida, el lanzador entra directo al asistente de producción.
    if (shell.classList.contains('launcher-window')) wizard.open();
};
if (welcomeOverlay) {
    document.querySelector('#welcome-close').onclick = closeWelcome;
    welcomeOverlay.onclick = (event) => { if (event.target === welcomeOverlay) closeWelcome(); };
}

const resizer = document.querySelector('#sidebar-resizer');
resizer.onpointerdown = (event) => {
    resizer.setPointerCapture(event.pointerId);
    resizer.onpointermove = (move) => shell.style.setProperty('--sidebar-width', `${Math.max(210, Math.min(360, move.clientX))}px`);
    resizer.onpointerup = () => { resizer.onpointermove = null; };
};

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (welcomeOverlay && document.body.contains(welcomeOverlay)) { closeWelcome(); return; }
        if (wizard.isOpen()) { wizard.close(); return; }
        shell.classList.remove('focus-mode');
    }
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); flushSaveNow(); return; }
    if (event.key === '1') selectView('infografias');
    if (event.key === '2') selectView('set');
    if (event.key === '3') selectView('escaleta');
    if (event.key === '4') selectView('diagrama');
    if (event.key === '5') selectView('production');
    if (event.key === '6') selectView('guias');
    if (event.key === '7') selectView('exportar');
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
        selectView('infografias', true, 'editar');
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
    if (!showWelcome) wizard.open();
}

selectView('home');
initializeWindow();

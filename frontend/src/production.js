// Sala de control y emisión en vivo: Cabina Apple Studio Broadcast (Sin Scroll).
// Arquitectura GoF: State (ProductionFSM), Composite (PreflightChecklistComposite),
// Command (ProductionCommandManager) y Decorator (Liquid Glass Materials).

import { esc } from './constants.js';
import { ProductionFSM } from './production_fsm.js';

export function formatTime(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Composite Pattern GoF: PreflightChecklistComposite
 * Árbol jerárquico de validaciones con ponderación matemática y filtros por subsistema.
 */
export class PreflightChecklistComposite {
    constructor() {
        this.items = [];
    }

    addItem(type, text, category = 'general') {
        this.items.push({ type, text, category });
    }

    get errors() {
        return this.items.filter((i) => i.type === 'error');
    }

    get warnings() {
        return this.items.filter((i) => i.type === 'warn');
    }

    get isReady() {
        return this.errors.length === 0;
    }

    get readinessPercentage() {
        if (!this.items.length) return 100;
        const errPenalty = this.errors.length * 20;
        const warnPenalty = this.warnings.length * 8;
        const raw = 100 - (errPenalty + warnPenalty);
        return Math.max(10, Math.min(100, Math.round(raw)));
    }

    get statusLabel() {
        if (this.readinessPercentage === 100) return 'Aprobado';
        if (this.errors.length > 0) return `${this.errors.length} Críticos`;
        return `${this.warnings.length} Pendientes`;
    }

    byCategory(cat) {
        if (!cat || cat === 'all') return this.items;
        return this.items.filter((i) => i.category === cat);
    }
}

/**
 * Construye el árbol de verificaciones técnicas.
 */
export function buildPreflightChecklist(cfg, diagram) {
    const composite = new PreflightChecklistComposite();
    const config = cfg || { camaras: [], microfonos: [], extras: [], escaleta: [] };
    const sources = new Set([...(config.camaras || []), ...(config.extras || [])].map((x) => x.id));

    if (!(config.camaras || []).length) {
        composite.addItem('error', 'No hay cámaras configuradas en el set.', 'video');
    }
    if (!(config.microfonos || []).length) {
        composite.addItem('warn', 'No hay micrófonos configurados en el proyecto.', 'audio');
    }

    (config.escaleta || []).forEach((s) => {
        const nombre = esc(s.segmento || 'Segmento sin nombre');
        if (!sources.has(s.fuente)) {
            composite.addItem('error', `“${nombre}” no tiene una fuente asignada.`, 'rundown');
        }
        if (!s.dur) {
            composite.addItem('warn', `“${nombre}” tiene duración 00:00.`, 'rundown');
        } else if (s.dur > 900) {
            composite.addItem('warn', `“${nombre}” supera 15 minutos continuos.`, 'rundown');
        }
    });

    const diag = diagram || { nodes: [], edges: [] };
    const used = new Set();
    (diag.edges || []).forEach((e) => {
        if (e.from?.node) used.add(e.from.node);
        if (e.to?.node) used.add(e.to.node);
    });

    (diag.nodes || [])
        .filter((n) => ['camara', 'microfono', 'fuente'].includes(n.type))
        .forEach((n) => {
            if (!used.has(n.id)) {
                composite.addItem('warn', `${esc(n.label || 'Dispositivo')} sin cablear en el diagrama.`, 'diagram');
            }
        });

    if (!(diag.nodes || []).some((n) => n.type === 'encoder')) {
        composite.addItem('info', 'El diagrama no incluye un encoder/PC de salida.', 'diagram');
    }

    return composite;
}

// Compatibilidad con validaciones anteriores
export function validations(cfg, diagram) {
    const composite = buildPreflightChecklist(cfg, diagram);
    return composite.items.map((item) => [item.type, item.text]);
}

/**
 * Renderiza el plano cenital en modo Blueprint Oscuro.
 */
function liveSetSVG(cfg, air, preview) {
    if (!window.PTVSheets?.planoSvg) {
        return '<p class="set-live-note">El plano del set no está disponible.</p>';
    }
    const isDark = document.documentElement.dataset.tema === 'oscuro' ||
        (!document.documentElement.dataset.tema && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);

    return window.PTVSheets.planoSvg(cfg, {
        display: true,
        dark: isDark,
        blueprint: isDark,
        air: air || null,
        preview: preview && preview !== air ? preview : null,
    });
}

/**
 * Convierte la escaleta en una línea de tiempo ordenada de pasos broadcast.
 */
export function construirPrograma(cfg) {
    const pasos = [];
    let t = 0;
    const empujar = (paso, dur) => {
        pasos.push({ ...paso, t0: t, dur });
        t += dur;
    };

    (cfg?.escaleta || []).forEach((s, i) => {
        const cues = (s.tomas || []).filter((c) => (c.dur || 0) > 0);
        const dur = Math.max(0, s.dur || 0);
        const base = { seg: i, segNombre: s.segmento || `Segmento ${i + 1}`, nota: s.nota || '' };
        let usado = 0;
        cues.forEach((c) => {
            const cueDur = Math.max(1, c.dur);
            empujar({
                ...base,
                cue: c,
                tipo: c.tipo || 'camara',
                aire: c.alAire || s.fuente,
                previo: c.previo || '',
                texto: c.texto || '',
                transicion: c.transicion || '',
                grafico: c.grafico || '',
                audio: c.audio || '',
            }, cueDur);
            usado += cueDur;
        });

        if (dur - usado > 0.5 || !cues.length) {
            empujar({
                ...base,
                cue: null,
                tipo: 'segmento',
                aire: s.fuente,
                previo: '',
                texto: s.nota || '',
                transicion: '',
                grafico: '',
                audio: '',
            }, Math.max(0, cues.length ? dur - usado : dur));
        }
    });

    pasos.forEach((paso, i) => {
        paso.i = i;
        paso.t1 = paso.t0 + paso.dur;
        if (!paso.previo) {
            paso.previo = pasos[i + 1]?.aire || '';
        }
    });

    return { pasos, total: t };
}

/**
 * Obtiene el paso activo para el segundo `t`.
 */
export function pasoEn(programa, t) {
    const { pasos } = programa || { pasos: [] };
    if (!pasos || !pasos.length) return null;
    if (t >= programa.total) return pasos[pasos.length - 1];
    return pasos.find((p) => t >= p.t0 && t < p.t1) || pasos[0];
}

/**
 * Command Pattern: Gestor de órdenes discretas de emisión con soporte de atajos.
 */
export class ProductionCommandManager {
    constructor(fsm) {
        this.fsm = fsm;
    }

    takeCamera(camId) {
        if (!camId) return;
        this.fsm.takeCamera(camId);
    }

    toggleTransport() {
        this.fsm.toggle();
    }

    resetTransport() {
        this.fsm.reset();
    }

    nextStep() {
        this.fsm.nextStep();
    }

    prevStep() {
        this.fsm.prevStep();
    }

    seek(seconds) {
        this.fsm.seek(seconds);
    }

    cut() {
        const cams = this.fsm._getCams?.() || [];
        if (this.fsm.preview && this.fsm.preview !== this.fsm.air) {
            this.fsm.takeCamera(this.fsm.preview);
        } else if (cams.length > 1) {
            const currIdx = cams.findIndex((c) => c.id === this.fsm.air);
            const nextCam = cams[(currIdx + 1) % cams.length];
            if (nextCam) this.fsm.takeCamera(nextCam.id);
        }
    }
}

/**
 * Factoría de la vista de Producción / Ensayo estilo Cabina Apple Studio.
 */
export function createProductionView({ container, getProject, getInfografia, getDiagram, onGoHome, onEnsayo }) {
    let nodos = {};
    let inspectorVisible = false; // Por omisión plegado para máxima amplitud de estudio
    let filtroActivo = 'all';

    const fsm = new ProductionFSM({
        onTick: () => refrescar(),
        onEnsayo,
        getPrograma: () => nodos.programa,
    });

    const commandManager = new ProductionCommandManager(fsm);

    const rows = () => getInfografia()?.escaleta || [];
    const transcurrido = () => fsm.transcurrido();

    function fuente(cfg, id) {
        if (!id) return null;
        const cam = (cfg?.camaras || []).find((c) => c.id === id);
        if (cam) return { ...cam, esCamara: true };
        const extra = (cfg?.extras || []).find((x) => x.id === id);
        return extra ? { ...extra, plano: extra.esCorte ? 'Corte' : '', esCamara: false } : null;
    }

    // Modal de Teleprompter con controles táctiles Liquid Glass
    function openPrompter() {
        const cfg = getInfografia();
        const list = cfg?.escaleta || [];
        const index = pasoEn(construirPrograma(cfg), transcurrido())?.seg || 0;
        if (!list.length) return;

        const overlay = document.createElement('div');
        overlay.className = 'prompter-overlay';
        overlay.innerHTML = `
            <div class="prompter-bar lg-container">
                <button id="pp-play" class="apple-studio-btn lg-interactive" aria-label="Iniciar o pausar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>Rodar</span>
                </button>
                <label class="pp-speed-control">
                    <span>Velocidad</span>
                    <input id="pp-speed" type="range" min="10" max="220" step="5" value="55" aria-label="Velocidad">
                </label>
                <button id="pp-smaller" class="apple-studio-btn icon-only" aria-label="Texto más chico">A−</button>
                <button id="pp-bigger" class="apple-studio-btn icon-only" aria-label="Texto más grande">A+</button>
                <button id="pp-mirror" class="apple-studio-btn" aria-label="Modo espejo">Espejo</button>
                <button id="pp-here" class="apple-studio-btn" aria-label="Ir al segmento al aire">● Al aire</button>
                <span class="pp-hint">Espacio: rodar · ↑↓: velocidad · Esc: salir</span>
                <button id="pp-close" class="apple-studio-btn icon-only close-btn" aria-label="Cerrar teleprompter">✕</button>
            </div>
            <div class="prompter-scroll" id="pp-scroll">
                <div class="prompter-text" id="pp-text" style="--pfs:46px">
                    <div class="pp-pad"></div>
                    ${list.map((s, i) => `
                    <section class="pp-seg${i === index ? ' current' : ''}" data-i="${i}">
                        <h3>${i + 1} · ${esc(s.segmento || 'Segmento')} · ${formatTime(s.dur)}</h3>
                        <p>${esc(s.nota || '(Sin guion para este segmento: escríbelo en la nota de la escaleta)')}</p>
                    </section>`).join('')}
                    <div class="pp-pad"></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const scroller = overlay.querySelector('#pp-scroll');
        const texto = overlay.querySelector('#pp-text');
        const playBtn = overlay.querySelector('#pp-play');
        let playing = false;
        let speed = 55;
        let fs = 46;
        let raf = null;
        let last = 0;

        function step(t) {
            if (!playing) return;
            scroller.scrollTop += speed * ((t - last) / 1000);
            last = t;
            raf = requestAnimationFrame(step);
        }

        function togglePlay() {
            playing = !playing;
            playBtn.querySelector('span').textContent = playing ? 'Pausa' : 'Rodar';
            playBtn.classList.toggle('on', playing);
            if (playing) {
                last = performance.now();
                raf = requestAnimationFrame(step);
            } else {
                cancelAnimationFrame(raf);
            }
        }

        function irAlAire() {
            const cur = overlay.querySelector(`.pp-seg[data-i="${index}"]`);
            if (cur) scroller.scrollTop = cur.offsetTop - scroller.clientHeight * 0.28;
        }

        function close() {
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', keys, true);
            overlay.remove();
        }

        function keys(e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
            if (e.key === ' ') { e.preventDefault(); togglePlay(); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); speed = Math.min(220, speed + 10); overlay.querySelector('#pp-speed').value = speed; }
            if (e.key === 'ArrowDown') { e.preventDefault(); speed = Math.max(10, speed - 10); overlay.querySelector('#pp-speed').value = speed; }
        }

        playBtn.onclick = togglePlay;
        overlay.querySelector('#pp-speed').oninput = (e) => { speed = Number(e.target.value); };
        overlay.querySelector('#pp-bigger').onclick = () => { fs = Math.min(96, fs + 5); texto.style.setProperty('--pfs', `${fs}px`); };
        overlay.querySelector('#pp-smaller').onclick = () => { fs = Math.max(24, fs - 5); texto.style.setProperty('--pfs', `${fs}px`); };
        overlay.querySelector('#pp-mirror').onclick = (e) => { texto.classList.toggle('mirror'); e.target.classList.toggle('on'); };
        overlay.querySelector('#pp-here').onclick = irAlAire;
        overlay.querySelector('#pp-close').onclick = close;
        document.addEventListener('keydown', keys, true);
        irAlAire();
    }

    function renderChecklistItems(checklist) {
        const items = checklist.byCategory(filtroActivo);
        if (!items.length) {
            return `
                <div class="studio-check ok">
                    <span class="studio-check-icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    <div class="studio-check-text">Todos los elementos de esta categoría están verificados.</div>
                </div>`;
        }
        return items.map((item) => {
            const isErr = item.type === 'error';
            const isWarn = item.type === 'warn';
            const iconSvg = isErr
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
                : isWarn
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
                : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
            return `
                <div class="studio-check ${item.type}">
                    <span class="studio-check-icon">${iconSvg}</span>
                    <div class="studio-check-text">${item.text}</div>
                </div>`;
        }).join('');
    }

    function render() {
        const project = getProject();
        const cfg = getInfografia();
        if (!project || !cfg) {
            container.innerHTML = `
                <div class="production-empty lg-container">
                    <h1>Sala de Control</h1>
                    <p>Abre un proyecto para iniciar la suite broadcast.</p>
                    <button id="go-home" class="apple-studio-btn">Ir a Inicio</button>
                </div>`;
            container.querySelector('#go-home')?.addEventListener('click', onGoHome);
            return;
        }

        const checklist = buildPreflightChecklist(cfg, getDiagram());
        const listo = checklist.isReady;
        const alistamientoPct = checklist.readinessPercentage;
        const cams = cfg.camaras || [];

        if (fsm.air && !cams.some((c) => c.id === fsm.air)) fsm.air = null;
        if (fsm.preview && !cams.some((c) => c.id === fsm.preview)) fsm.preview = null;

        const programa = construirPrograma(cfg);
        const hayPrograma = programa.pasos.length > 0;
        const nom = (id) => fuente(cfg, id)?.nombre || '—';

        const totalItems = checklist.items.length;
        const diagCount = checklist.byCategory('diagram').length;
        const runCount = checklist.byCategory('rundown').length;

        container.innerHTML = `
            <div class="studio-workspace ${inspectorVisible ? 'with-inspector' : 'inspector-collapsed'}">
                <!-- CABECERA PRINCIPAL APPLE STUDIO: TÍTULO, MASTER TRANSPORT Y ACCIONES -->
                <header class="studio-header">
                    <div class="studio-header-identity">
                        <span class="studio-eyebrow">SALA DE CONTROL · MASTER CONTROL ROOM</span>
                        <h1 class="studio-title">${esc(project.name)}</h1>
                    </div>

                    <!-- MASTER TRANSPORT HUD (ISLA DINÁMICA DE CRISTAL LÍQUIDO) -->
                    <div class="studio-transport-hud lg-container" aria-label="Transporte principal de emisión">
                        <div class="studio-transport-controls">
                            <button id="vivo-prev-step" class="transport-step-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                title="Paso anterior (J)">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                            </button>
                            <button id="vivo-play" class="transport-btn play-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                title="${hayPrograma ? 'Arrancar o pausar la emisión (Espacio)' : 'Sin segmentos'}">
                                <span class="play-btn-icon-wrap" id="vivo-play-icon">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                                </span>
                                <b id="vivo-play-t">Arrancar</b>
                            </button>
                            <button id="vivo-next-step" class="transport-step-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                title="Paso siguiente (L)">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                            </button>
                            <button id="vivo-reset" class="transport-btn reset-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                title="Reiniciar tiempo a 00:00 (R)">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            </button>
                        </div>

                        <div class="studio-timecode-box">
                            <div class="timecode-primary">
                                <span id="vivo-t" class="timecode-digits">00:00</span>
                                <span class="timecode-badge standby">STANDBY</span>
                            </div>
                            <div class="timecode-secondary">
                                <span id="vivo-resta-total">Restante: -${formatTime(programa.total)}</span>
                                <span class="timecode-sep">·</span>
                                <span>Total: ${formatTime(programa.total)}</span>
                            </div>
                        </div>

                        <!-- SCRUBBER INTERACTIVO DE LÍNEA DE TIEMPO (SEEKABLE) -->
                        <div class="studio-scrubber-track" id="vivo-scrubber" title="Hacer clic para saltar en la línea de tiempo">
                            <i id="vivo-avance" class="studio-scrubber-fill"></i>
                            <span class="studio-scrubber-thumb"></span>
                        </div>
                    </div>

                    <!-- ACCIONES SUPERIORES APPLE: TELEPROMPTER E INSPECTOR TOGGLE -->
                    <div class="studio-header-actions">
                        <button id="open-prompter" class="apple-studio-btn lg-interactive" ${rows().length ? '' : 'disabled'}
                            title="Guion en teleprompter con auto-scroll y modo espejo">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            <span>Teleprompter</span>
                        </button>
                        <button id="toggle-inspector" class="apple-studio-btn toggle-btn lg-interactive ${inspectorVisible ? 'active' : ''}"
                            title="Mostrar u ocultar inspector de alistamiento técnico (I)">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                            <span>Alistamiento</span>
                            <span class="inspector-badge ${listo ? 'ok' : 'pending'}">${listo ? '✓' : totalItems}</span>
                        </button>
                    </div>
                </header>

                <!-- CUERPO DE CABINA: CABINA PRINCIPAL + INSPECTOR LATERAL -->
                <div class="studio-body">
                    <!-- CABINA PRINCIPAL BROADCAST (CERO SCROLL) -->
                    <main class="studio-main-stage">
                        <!-- FILA SUPERIOR: MONITORES BROADCAST PGM & PVW + HUD RUNDOWN -->
                        <section class="studio-monitors-row">
                            <!-- MONITOR PGM / AL AIRE (ROJO NEÓN BROADCAST) -->
                            <div class="studio-monitor pgm lg-container">
                                <div class="monitor-tally-strip"></div>
                                <div class="monitor-header">
                                    <span class="tally-tag pgm"><span class="tally-led"></span> PGM · AL AIRE</span>
                                    <span class="monitor-signal-chip">SDI 1 · 1080p59.94</span>
                                </div>
                                <div class="monitor-content">
                                    <h2 id="vivo-aire" class="monitor-source-title">—</h2>
                                    <p id="vivo-aire-sub" class="monitor-source-sub">—</p>
                                </div>
                            </div>

                            <!-- MONITOR PVW / EN PREVIO (VERDE ESMERALDA BROADCAST) -->
                            <div class="studio-monitor pvw lg-container">
                                <div class="monitor-tally-strip"></div>
                                <div class="monitor-header">
                                    <span class="tally-tag pvw"><span class="tally-led"></span> PVW · EN PREVIO</span>
                                    <span class="monitor-signal-chip">SDI 2 · 1080p59.94</span>
                                </div>
                                <div class="monitor-content">
                                    <h2 id="vivo-previo" class="monitor-source-title">—</h2>
                                    <p id="vivo-previo-sub" class="monitor-source-sub">—</p>
                                </div>
                            </div>

                            <!-- HUD DE RUNDOWN: AHORA & SIGUE -->
                            <div class="studio-rundown-hud lg-container">
                                <div class="rundown-col now">
                                    <div class="rundown-label">
                                        <span>AHORA</span>
                                        <em id="vivo-pos">1 de ${programa.pasos.length || 1}</em>
                                    </div>
                                    <h3 id="vivo-seg" class="rundown-title">—</h3>
                                    <p id="vivo-texto" class="rundown-instruction"></p>
                                    <div id="vivo-etiquetas" class="rundown-tags"></div>
                                </div>
                                <div class="rundown-col next">
                                    <div class="rundown-label">
                                        <span>SIGUE</span>
                                        <span id="vivo-resta" class="rundown-countdown"></span>
                                    </div>
                                    <h4 id="vivo-sig" class="rundown-title">—</h4>
                                    <small id="vivo-sig-sub" class="rundown-instruction"></small>
                                </div>
                            </div>
                        </section>

                        <p class="vivo-desvio" id="vivo-desvio" hidden></p>

                        <!-- LIENZO PANORÁMICO BLUEPRINT DEL SET (CON MARCADORES TÉCNICOS HUD) -->
                        <section class="studio-blueprint-viewport lg-container" aria-label="Plano cenital del foro">
                            <div class="blueprint-glass">
                                <span class="blueprint-corner tl"></span>
                                <span class="blueprint-corner tr"></span>
                                <span class="blueprint-corner bl"></span>
                                <span class="blueprint-corner br"></span>
                                <div class="set-live" id="vivo-plano"></div>
                            </div>
                            <div class="blueprint-footer-bar">
                                <div class="legend-pills-wrap">
                                    <span class="studio-pill pgm"><span class="led-dot"></span> PGM Al aire</span>
                                    <span class="studio-pill pvw"><span class="led-dot"></span> PVW En previo</span>
                                </div>
                                <span class="blueprint-status-note">Telemetría de set interactiva con tally en tiempo real</span>
                                <span class="blueprint-hint">Teclas 1..${cams.length || 1} conmutan cortes · Enter: CUT</span>
                            </div>
                        </section>

                        <!-- SWITCHER FÍSICO DE CÁMARAS (ATEM APPLE GLASS BROADCAST PAD) -->
                        <section class="studio-switcher-bus lg-container" aria-label="Switcher de cámaras">
                            <div class="switcher-bus-brand">
                                <span class="switcher-brand-title">BUS DE CORTE</span>
                                <span class="switcher-brand-sub">ATEM Glass Pad</span>
                            </div>
                            <div class="switcher-buttons-row">
                                ${cams.length
                                    ? cams.map((c, i) => `
                                        <button class="switcher-cam-btn switcher-cam-pad lg-interactive" data-cam="${c.id}" data-idx="${i + 1}"
                                            title="Conmutar ${esc(c.nombre || `CAM ${i + 1}`)} al aire (Tecla ${i + 1})">
                                            <div class="cam-pad-top">
                                                <span class="cam-pad-tally-bar"></span>
                                                <span class="cam-btn-num">${i + 1}</span>
                                            </div>
                                            <div class="cam-pad-info">
                                                <b class="cam-btn-name">${esc(c.nombre || `CAM ${i + 1}`)}</b>
                                                <span class="cam-btn-plano">${esc(c.plano || 'Plano')}</span>
                                            </div>
                                        </button>`).join('')
                                    : '<p class="set-live-note">Sin cámaras configuradas. Agrégalas en la etapa Necesidades.</p>'}
                            </div>
                            <div class="switcher-trans-actions">
                                <button id="vivo-cut-btn" class="switcher-action-btn cut-action-btn lg-interactive" title="Conmutar previo al aire inmediatamente (Enter)">
                                    <b>CUT</b>
                                    <small>CORTE</small>
                                </button>
                                <button id="vivo-auto-btn" class="switcher-action-btn auto-action-btn lg-interactive" title="Conmutación automática de señal">
                                    <b>AUTO</b>
                                    <small>TRANS</small>
                                </button>
                            </div>
                        </section>
                    </main>

                    <!-- INSPECTOR LATERAL DE ALISTAMIENTO TÉCNICO (FLIGHT READINESS) -->
                    <aside class="studio-readiness-inspector lg-container ${inspectorVisible ? '' : 'hidden'}" aria-label="Alistamiento del foro">
                        <div class="inspector-cab">
                            <div class="inspector-title-wrap">
                                <span class="inspector-eyebrow">PRE-FLIGHT CHECKLIST</span>
                                <h2>Alistamiento</h2>
                            </div>
                            <span class="inspector-status-pill ${listo ? 'ok' : 'pending'}">${checklist.statusLabel}</span>
                        </div>

                        <!-- GAUGE DE PREPARACIÓN -->
                        <div class="inspector-gauge-card">
                            <div class="gauge-meta">
                                <span>Preparación técnica</span>
                                <b class="gauge-pct">${alistamientoPct}%</b>
                            </div>
                            <div class="gauge-track">
                                <div class="gauge-bar ${listo ? 'ok' : ''}" style="width:${alistamientoPct}%"></div>
                            </div>
                        </div>

                        <!-- FILTROS RÁPIDOS POR SUBSISTEMA -->
                        <div class="inspector-filter-chips">
                            <button class="filter-chip ${filtroActivo === 'all' ? 'active' : ''}" data-filter="all">Todos (${totalItems})</button>
                            <button class="filter-chip ${filtroActivo === 'diagram' ? 'active' : ''}" data-filter="diagram">Diagrama (${diagCount})</button>
                            <button class="filter-chip ${filtroActivo === 'rundown' ? 'active' : ''}" data-filter="rundown">Guion (${runCount})</button>
                        </div>

                        <!-- LISTA DE VERIFICACIONES CON MICRO-TARJETAS -->
                        <div class="inspector-items-scroll" id="inspector-items-box">
                            ${renderChecklistItems(checklist)}
                        </div>
                    </aside>
                </div>
            </div>`;

        nodos = {
            play: container.querySelector('#vivo-play'),
            playIcon: container.querySelector('#vivo-play-icon'),
            playT: container.querySelector('#vivo-play-t'),
            prevStep: container.querySelector('#vivo-prev-step'),
            nextStep: container.querySelector('#vivo-next-step'),
            reset: container.querySelector('#vivo-reset'),
            scrubber: container.querySelector('#vivo-scrubber'),
            scrubberThumb: container.querySelector('.studio-scrubber-thumb'),
            t: container.querySelector('#vivo-t'),
            restaTotal: container.querySelector('#vivo-resta-total'),
            avance: container.querySelector('#vivo-avance'),
            aire: container.querySelector('#vivo-aire'),
            aireSub: container.querySelector('#vivo-aire-sub'),
            previo: container.querySelector('#vivo-previo'),
            previoSub: container.querySelector('#vivo-previo-sub'),
            desvio: container.querySelector('#vivo-desvio'),
            pos: container.querySelector('#vivo-pos'),
            seg: container.querySelector('#vivo-seg'),
            texto: container.querySelector('#vivo-texto'),
            etiquetas: container.querySelector('#vivo-etiquetas'),
            sig: container.querySelector('#vivo-sig'),
            sigSub: container.querySelector('#vivo-sig-sub'),
            resta: container.querySelector('#vivo-resta'),
            plano: container.querySelector('#vivo-plano'),
            cams: [...container.querySelectorAll('[data-cam]')],
            timeBadge: container.querySelector('.timecode-badge'),
            programa, cfg, nom,
        };

        container.querySelector('#go-home')?.addEventListener('click', onGoHome);
        container.querySelector('#open-prompter')?.addEventListener('click', openPrompter);
        nodos.play?.addEventListener('click', () => commandManager.toggleTransport());
        nodos.reset?.addEventListener('click', () => commandManager.resetTransport());
        nodos.prevStep?.addEventListener('click', () => commandManager.prevStep());
        nodos.nextStep?.addEventListener('click', () => commandManager.nextStep());

        // Manejador interactivo de Scrubber (Seek en la línea de tiempo con arrastre continuo)
        let isScrubbing = false;
        const handleScrubberSeek = (e) => {
            if (!programa?.total || !nodos.scrubber) return;
            const rect = nodos.scrubber.getBoundingClientRect();
            if (!rect.width) return;
            const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const pct = clickX / rect.width;
            commandManager.seek(pct * programa.total);
        };
        nodos.scrubber?.addEventListener('click', handleScrubberSeek);
        nodos.scrubber?.addEventListener('pointerdown', (e) => {
            if (!programa?.total) return;
            isScrubbing = true;
            try { nodos.scrubber.setPointerCapture(e.pointerId); } catch (_) {}
            handleScrubberSeek(e);
        });
        nodos.scrubber?.addEventListener('pointermove', (e) => {
            if (!isScrubbing || !programa?.total) return;
            handleScrubberSeek(e);
        });
        const endScrub = (e) => {
            if (!isScrubbing) return;
            isScrubbing = false;
            try { nodos.scrubber.releasePointerCapture(e.pointerId); } catch (_) {}
        };
        nodos.scrubber?.addEventListener('pointerup', endScrub);
        nodos.scrubber?.addEventListener('pointercancel', endScrub);

        // Botón toggle del Inspector lateral
        container.querySelector('#toggle-inspector')?.addEventListener('click', () => {
            inspectorVisible = !inspectorVisible;
            const ws = container.querySelector('.studio-workspace');
            const inspector = container.querySelector('.studio-readiness-inspector');
            const btn = container.querySelector('#toggle-inspector');
            ws?.classList.toggle('with-inspector', inspectorVisible);
            ws?.classList.toggle('inspector-collapsed', !inspectorVisible);
            inspector?.classList.toggle('hidden', !inspectorVisible);
            btn?.classList.toggle('active', inspectorVisible);
        });

        // Filtros del inspector
        container.querySelectorAll('.filter-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                filtroActivo = chip.dataset.filter || 'all';
                container.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
                const box = container.querySelector('#inspector-items-box');
                if (box) box.innerHTML = renderChecklistItems(checklist);
            });
        });

        fsm._getCams = () => cams;
        container.querySelector('#vivo-cut-btn')?.addEventListener('click', () => commandManager.cut());
        container.querySelector('#vivo-auto-btn')?.addEventListener('click', () => commandManager.cut());

        nodos.cams.forEach((b) => {
            b.onclick = () => commandManager.takeCamera(b.dataset.cam);
        });

        // Atajos de teclado profesionales: 1..9 (cámaras), Enter (CUT), J/L (paso prev/next), R (reset), I (inspector)
        const handleKeys = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const target = e.target;
            if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                commandManager.cut();
                return;
            }

            const key = e.key.toLowerCase();
            if (key === 'r') {
                e.preventDefault();
                commandManager.resetTransport();
            } else if (key === 'j' || e.key === 'ArrowLeft') {
                e.preventDefault();
                commandManager.prevStep();
            } else if (key === 'l' || e.key === 'ArrowRight') {
                e.preventDefault();
                commandManager.nextStep();
            } else if (key === 'i') {
                e.preventDefault();
                container.querySelector('#toggle-inspector')?.click();
            } else {
                const num = parseInt(e.key, 10);
                if (!isNaN(num) && num >= 1 && num <= cams.length) {
                    const targetCam = cams[num - 1];
                    if (targetCam) {
                        e.preventDefault();
                        commandManager.takeCamera(targetCam.id);
                    }
                }
            }
        };
        container.removeEventListener('keydown', container._camKeyHandler);
        container._camKeyHandler = handleKeys;
        container.addEventListener('keydown', handleKeys);

        fsm.pasoActual = -1;
        fsm.mount(container);
        refrescar();
    }

    /**
     * Refresco broadcast continuo a 60 FPS con manejo robusto de excepciones.
     */
    function refrescar() {
        try {
            if (!nodos.t) return;
            const { programa, cfg, nom } = nodos;
            if (!programa) return;

            const t = Math.min(fsm.transcurrido(), programa.total);
            const paso = pasoEn(programa, t);
            const fin = t >= programa.total && programa.total > 0;
            if (fin && fsm.isRunning) {
                fsm.finish();
            }

            nodos.t.textContent = formatTime(t);
            nodos.t.classList.toggle('corriendo', fsm.isRunning);

            if (nodos.timeBadge) {
                nodos.timeBadge.textContent = fsm.isRunning ? 'LIVE' : (fin ? 'FIN' : (fsm.isPaused ? 'PAUSA' : 'STANDBY'));
                nodos.timeBadge.className = `timecode-badge ${fsm.isRunning ? 'live' : (fin ? 'fin' : (fsm.isPaused ? 'paused' : 'standby'))}`;
            }

            if (nodos.restaTotal) {
                const restante = Math.max(0, programa.total - t);
                nodos.restaTotal.textContent = `Restante: -${formatTime(restante)}`;
            }

            const pct = programa.total ? Math.min(100, (t / programa.total) * 100) : 0;
            if (nodos.avance) {
                nodos.avance.style.width = `${pct}%`;
            }
            if (nodos.scrubberThumb) {
                nodos.scrubberThumb.style.left = `${pct}%`;
            }

            // Actualizar etiqueta e icono del botón principal solo ante cambios de estado de transporte
            const estadoActual = fin ? 'finished' : (fsm.isRunning ? 'running' : (fsm.isPaused ? 'paused' : 'stopped'));
            if (nodos.ultimoEstado !== estadoActual) {
                nodos.ultimoEstado = estadoActual;
                if (nodos.playT) {
                    nodos.playT.textContent = fin ? 'Otra vez' : (fsm.isRunning ? 'Pausa' : (fsm.isPaused ? 'Seguir' : 'Arrancar'));
                }
                if (nodos.playIcon) {
                    nodos.playIcon.innerHTML = fsm.isRunning
                        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
                }
                nodos.play?.classList.toggle('on', fsm.isRunning);
                nodos.play?.classList.toggle('paused', fsm.isPaused);

                if (nodos.timeBadge) {
                    nodos.timeBadge.textContent = fsm.isRunning ? 'LIVE' : (fin ? 'FIN' : (fsm.isPaused ? 'PAUSA' : 'STANDBY'));
                    nodos.timeBadge.className = `timecode-badge ${fsm.isRunning ? 'live' : (fin ? 'fin' : (fsm.isPaused ? 'paused' : 'standby'))}`;
                }
            }

            if (!paso) return;

            if (paso.i !== fsm.pasoActual) {
                if (fsm.isRunning) {
                    fsm.air = null;
                    fsm.preview = null;
                }
                fsm.pasoActual = paso.i;
            }

            const aireReal = fsm.air || paso.aire;
            const previoReal = fsm.preview || paso.previo;
            const fAire = fuente(cfg, aireReal);
            const fPrevio = fuente(cfg, previoReal);

            if (nodos.aire) nodos.aire.textContent = nom(paso.aire);
            if (nodos.aireSub) nodos.aireSub.textContent = fuente(cfg, paso.aire)?.plano || '';
            if (nodos.previo) nodos.previo.textContent = nom(paso.previo);
            if (nodos.previoSub) nodos.previoSub.textContent = fuente(cfg, paso.previo)?.plano || '';

            const desviado = fsm.air && paso.aire && fsm.air !== paso.aire;
            if (nodos.desvio) {
                nodos.desvio.hidden = !desviado;
                if (desviado) {
                    nodos.desvio.textContent = `Al aire tienes ${nom(fsm.air)}, y el programa pide ${nom(paso.aire)}.`;
                }
            }

            const total = (programa.pasos || []).length;
            if (nodos.pos) nodos.pos.textContent = `${paso.i + 1} de ${total}`;
            if (nodos.seg) nodos.seg.textContent = paso.segNombre;
            if (nodos.texto) {
                nodos.texto.textContent = paso.texto || paso.nota || '(Sin instrucción escrita para este paso)';
                nodos.texto.classList.toggle('vacio', !(paso.texto || paso.nota));
            }

            if (nodos.etiquetas) {
                const etiquetas = [];
                if (paso.transicion) etiquetas.push(paso.transicion);
                if (paso.grafico) etiquetas.push(`GFX · ${paso.grafico}`);
                if (paso.audio) etiquetas.push(`AUDIO · ${paso.audio}`);
                if (paso.cue) etiquetas.push(paso.tipo);
                nodos.etiquetas.innerHTML = etiquetas.map((e) => `<span>${esc(e)}</span>`).join('');
            }

            const sigue = programa.pasos[paso.i + 1];
            const mismoSeg = sigue && sigue.seg === paso.seg;
            if (nodos.sig) {
                nodos.sig.textContent = fin
                    ? 'Fin del programa'
                    : !sigue
                    ? 'Último paso'
                    : (mismoSeg && sigue.texto) ? sigue.texto : sigue.segNombre;
            }

            const sigTitulo = nodos.sig?.textContent || '';
            const sigFuente = nom(sigue?.aire);
            if (nodos.sigSub) {
                nodos.sigSub.textContent = sigue
                    ? [sigFuente.toLowerCase() === sigTitulo.toLowerCase() ? '' : sigFuente,
                       !mismoSeg && sigue.texto ? sigue.texto : ''].filter(Boolean).join(' · ')
                    : '';
            }
            if (nodos.resta) {
                nodos.resta.textContent = fin ? '' : `en ${formatTime(Math.max(0, paso.t1 - t))}`;
            }

            // Actualización reactiva del plano del set
            const firma = `${aireReal}|${previoReal}`;
            if (nodos.firma !== firma && nodos.plano) {
                nodos.firma = firma;
                nodos.plano.innerHTML = liveSetSVG(
                    cfg,
                    fAire?.esCamara ? aireReal : null,
                    fPrevio?.esCamara ? previoReal : null
                );
            }

            nodos.cams.forEach((b) => {
                b.classList.toggle('aire', b.dataset.cam === aireReal);
                b.classList.toggle('previo', b.dataset.cam === previoReal && b.dataset.cam !== aireReal);
                b.classList.toggle('pide', !!paso.aire && b.dataset.cam === paso.aire && b.dataset.cam !== aireReal);
            });
        } catch (err) {
            console.error('Error en refresco de producción:', err);
        }
    }

    return {
        render,
        unmount: () => fsm.unmount(),
    };
}

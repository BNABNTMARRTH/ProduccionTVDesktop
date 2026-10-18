// Sala de control y emisión en vivo: Cabina Apple Studio Broadcast (Sin Scroll).
// Arquitectura GoF: State (ProductionFSM), Composite (PreflightChecklistComposite),
// Command (ProductionCommandManager) y Decorator (Liquid Glass Materials).

import { esc } from './constants.js';
import { ProductionFSM } from './production_fsm.js';
import { formatTime } from './formato_tiempo.js';
import { abrirTeleprompter } from './teleprompter.js';
import { etiquetaEstadoSwitcher, htmlChecklist, htmlMapeoSwitcher, htmlSalaDeControl, htmlSalaVacia } from './sala_control_html.js';
import { crearControlSwitcher, SWITCHER_PUERTOS } from './switcher.js';

export { formatTime };

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
/**
 * Atajos de la Sala de Control: Enter = CUT, R = reiniciar, J/← y L/→ = paso
 * anterior/siguiente, I = inspector, 1..9 = cámara al aire. Devuelve qué hacer
 * (o null si la tecla no es un atajo o el foco está en un campo de texto), sin
 * tocar el DOM, para poder probarla sola.
 */
export function accionDeTecla(e, numCams) {
    if (e.metaKey || e.ctrlKey || e.altKey) return null;
    const target = e.target;
    if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return null;
    if (e.key === 'Enter') return { tipo: 'cut' };
    const key = String(e.key || '').toLowerCase();
    if (key === 'r') return { tipo: 'resetTransport' };
    if (key === 'j' || e.key === 'ArrowLeft') return { tipo: 'prevStep' };
    if (key === 'l' || e.key === 'ArrowRight') return { tipo: 'nextStep' };
    if (key === 'i') return { tipo: 'inspector' };
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= numCams) return { tipo: 'camara', indice: num - 1 };
    return null;
}

export function createProductionView({
    container, getProject, getInfografia, getDiagram, onGoHome, onEnsayo,
    onConfigChange, loadSettings, saveSettings,
}) {
    let nodos = {};
    let inspectorVisible = false; // Por omisión plegado para máxima amplitud de estudio
    let filtroActivo = 'all';
    let visible = false;
    let switcher;
    let avisoSwitcherTimer = 0;

    const fsm = new ProductionFSM({
        onTick: () => refrescar(),
        onEnsayo,
        getPrograma: () => nodos.programa,
        onProgram: (camId) => switcher?.setProgram(camId),
        onPreview: (camId) => switcher?.setPreview(camId),
    });

    switcher = crearControlSwitcher({
        getConfig: getInfografia,
        onConfigChange,
        loadSettings,
        saveSettings,
        onState: (status) => pintarEstadoSwitcher(status),
        onInputs: () => pintarMapeoSwitcher(),
        onDiscovery: (estado) => pintarBusquedaOBS(estado),
        onNotice: (mensaje) => mostrarAvisoSwitcher(mensaje),
        onExternal: (estado) => {
            fsm.syncFromSwitcher(estado);
            refrescar();
        },
    });

    const commandManager = new ProductionCommandManager(fsm);

    const rows = () => getInfografia()?.escaleta || [];
    const transcurrido = () => fsm.transcurrido();

    const etiquetaSwitcher = (status = switcher.status) => etiquetaEstadoSwitcher(status);

    function pintarEstadoSwitcher(status = switcher.status) {
        if (!nodos.switcherStatus) return;
        nodos.switcherStatus.className = `apple-studio-btn lg-interactive switcher-status ${status.estado || 'desconectado'}`;
        if (nodos.switcherStatusLabel) nodos.switcherStatusLabel.textContent = etiquetaSwitcher(status);
        if (nodos.switcherPanelState) nodos.switcherPanelState.textContent = etiquetaSwitcher(status);
        if (nodos.switcherError) {
            nodos.switcherError.hidden = !status.error;
            nodos.switcherError.textContent = status.error || '';
        }
        if (nodos.switcherConnect) nodos.switcherConnect.disabled = status.estado === 'conectando';
        if (nodos.switcherDisconnect) nodos.switcherDisconnect.disabled = !(status.conectado || status.estado === 'conectando' || status.estado === 'error');
    }

    function mostrarAvisoSwitcher(mensaje) {
        if (!nodos.switcherNotice) return;
        clearTimeout(avisoSwitcherTimer);
        nodos.switcherNotice.textContent = mensaje || '';
        nodos.switcherNotice.hidden = !mensaje;
        if (mensaje) {
            avisoSwitcherTimer = setTimeout(() => {
                if (nodos.switcherNotice) nodos.switcherNotice.hidden = true;
            }, 6500);
        }
    }

    function pintarBusquedaOBS(estado = switcher.discovery) {
        if (!nodos.switcherSearchBox) return;
        const esOBS = (nodos.switcherKind?.value || switcher.options.kind) === 'obs';
        nodos.switcherSearchBox.hidden = !esOBS;
        if (!esOBS) return;
        const buscando = estado?.buscando === true;
        const resultados = Array.isArray(estado?.resultados) ? estado.resultados : [];
        if (nodos.switcherSearch) nodos.switcherSearch.disabled = buscando;
        if (nodos.switcherSearchStatus) {
            nodos.switcherSearchStatus.textContent = buscando
                ? 'Buscando OBS en tu red…'
                : estado?.error
                ? `No se pudo buscar OBS: ${estado.error}`
                : switcher.lastDiscoveryAt && resultados.length === 0
                ? 'No encontré OBS. Revisa que OBS esté abierto en la Mac, que el servidor WebSocket esté habilitado y que estés en la misma Wi-Fi.'
                : resultados.length
                ? `${resultados.length === 1 ? 'Encontré un OBS' : `Encontré ${resultados.length} equipos con OBS`}. Toca uno para usarlo:`
                : '';
        }
        if (nodos.switcherSearchResults) {
            nodos.switcherSearchResults.innerHTML = resultados.map((item) =>
                `<button type="button" class="switcher-search-result" data-obs-host="${esc(item.host)}" data-obs-port="${item.port}"><b>${esc(item.nombre)}</b><span>· ${esc(item.host)}</span></button>`
            ).join('');
            nodos.switcherSearchResults.querySelectorAll('[data-obs-host]').forEach((boton) => {
                boton.addEventListener('click', () => {
                    if (nodos.switcherHost) nodos.switcherHost.value = boton.dataset.obsHost || '';
                    if (nodos.switcherPort) nodos.switcherPort.value = boton.dataset.obsPort || String(SWITCHER_PUERTOS.obs);
                    switcher.persistOptions({
                        ...switcher.options, kind: 'obs', host: boton.dataset.obsHost || '',
                        port: Number(boton.dataset.obsPort) || SWITCHER_PUERTOS.obs,
                    });
                });
            });
        }
        if (!buscando && !String(nodos.switcherHost?.value || '').trim() && switcher.options.host) {
            nodos.switcherHost.value = switcher.options.host;
        }
    }

    function enlazarSelectoresMapeo(kind) {
        container.querySelectorAll('[data-switcher-map]').forEach((select) => {
            select.addEventListener('change', () => switcher.setMapping(select.dataset.switcherMap, kind, select.value));
        });
    }

    function pintarMapeoSwitcher(kind = nodos.switcherKind?.value || switcher.options.kind) {
        if (!nodos.switcherMapBody) return;
        const cfg = getInfografia();
        nodos.switcherMapBody.innerHTML = htmlMapeoSwitcher(
            cfg?.camaras || [], cfg?.switcher?.mapa || {}, kind, switcher.inputs || []
        );
        if (nodos.switcherInputHeading) nodos.switcherInputHeading.textContent = kind === 'obs' ? 'Escena de OBS' : 'Entrada ATEM';
        enlazarSelectoresMapeo(kind);
    }

    function fuente(cfg, id) {
        if (!id) return null;
        const cam = (cfg?.camaras || []).find((c) => c.id === id);
        if (cam) return { ...cam, esCamara: true };
        const extra = (cfg?.extras || []).find((x) => x.id === id);
        return extra ? { ...extra, plano: extra.esCorte ? 'Corte' : '', esCamara: false } : null;
    }

    function openPrompter() {
        const cfg = getInfografia();
        abrirTeleprompter({
            escaleta: cfg?.escaleta || [],
            index: pasoEn(construirPrograma(cfg), transcurrido())?.seg || 0,
        });
    }

    const renderChecklistItems = (checklist) => htmlChecklist(checklist.byCategory(filtroActivo));

    function render() {
        switcher.loadMachineSettings();
        switcher.ensureMapping();
        const project = getProject();
        const cfg = getInfografia();
        if (!project || !cfg) {
            container.innerHTML = htmlSalaVacia();
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

        container.innerHTML = htmlSalaDeControl({
            project, programa, hayPrograma, hayEscaleta: rows().length > 0, cams, checklist, listo,
            alistamientoPct, totalItems, diagCount, runCount, inspectorVisible, filtroActivo,
            switcher: switcher.viewModel(),
        });

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
            switcherStatus: container.querySelector('#switcher-status-btn'),
            switcherStatusLabel: container.querySelector('#switcher-status-label'),
            switcherSheet: container.querySelector('#switcher-sheet'),
            switcherKind: container.querySelector('#switcher-kind'),
            switcherHost: container.querySelector('#switcher-host'),
            switcherSearch: container.querySelector('#switcher-search'),
            switcherSearchBox: container.querySelector('#switcher-search-box'),
            switcherSearchStatus: container.querySelector('#switcher-search-status'),
            switcherSearchResults: container.querySelector('#switcher-search-results'),
            switcherPort: container.querySelector('#switcher-port'),
            switcherPassword: container.querySelector('#switcher-password'),
            switcherPasswordRow: container.querySelector('#switcher-password-row'),
            switcherConnect: container.querySelector('#switcher-connect'),
            switcherDisconnect: container.querySelector('#switcher-disconnect'),
            switcherPanelState: container.querySelector('#switcher-panel-state'),
            switcherError: container.querySelector('#switcher-panel-error'),
            switcherNotice: container.querySelector('#switcher-panel-notice'),
            switcherMapBody: container.querySelector('#switcher-map-body'),
            switcherInputHeading: container.querySelector('#switcher-input-heading'),
            programa, cfg, nom,
        };
        fsm._getEffectiveAir = () => pasoEn(nodos.programa, fsm.transcurrido())?.aire || null;

        container.querySelector('#go-home')?.addEventListener('click', onGoHome);
        container.querySelector('#open-prompter')?.addEventListener('click', openPrompter);
        nodos.play?.addEventListener('click', () => commandManager.toggleTransport());
        nodos.reset?.addEventListener('click', () => commandManager.resetTransport());
        nodos.prevStep?.addEventListener('click', () => commandManager.prevStep());
        nodos.nextStep?.addEventListener('click', () => commandManager.nextStep());

        const cerrarSwitcher = () => { if (nodos.switcherSheet) nodos.switcherSheet.hidden = true; };
        const abrirSwitcher = () => {
            if (nodos.switcherSheet) nodos.switcherSheet.hidden = false;
            if (nodos.switcherKind?.value === 'obs' && !String(nodos.switcherHost?.value || '').trim()) {
                switcher.buscarOBS(Number(nodos.switcherPort?.value), { hostActual: '' });
            }
        };
        nodos.switcherStatus?.addEventListener('click', abrirSwitcher);
        container.querySelector('.switcher-sheet-close')?.addEventListener('click', cerrarSwitcher);
        nodos.switcherSheet?.addEventListener('click', (event) => { if (event.target === nodos.switcherSheet) cerrarSwitcher(); });
        nodos.switcherKind?.addEventListener('change', () => {
            const kind = nodos.switcherKind.value;
            if (nodos.switcherPort) nodos.switcherPort.value = String(SWITCHER_PUERTOS[kind]);
            if (nodos.switcherPasswordRow) nodos.switcherPasswordRow.hidden = kind === 'atem';
            if (nodos.switcherSearch) nodos.switcherSearch.hidden = kind === 'atem';
            if (nodos.switcherSearchBox) nodos.switcherSearchBox.hidden = kind === 'atem';
            const ayuda = container.querySelector('#switcher-password-help');
            if (ayuda) ayuda.hidden = kind === 'atem';
            pintarMapeoSwitcher(kind);
            pintarBusquedaOBS();
        });
        nodos.switcherSearch?.addEventListener('click', () => switcher.buscarOBS(
            Number(nodos.switcherPort?.value), { hostActual: nodos.switcherHost?.value || '' }
        ));
        nodos.switcherConnect?.addEventListener('click', async () => {
            await switcher.connect({
                kind: nodos.switcherKind?.value,
                host: nodos.switcherHost?.value,
                port: Number(nodos.switcherPort?.value),
                password: nodos.switcherPassword?.value || '',
            });
            pintarEstadoSwitcher();
            pintarMapeoSwitcher();
        });
        nodos.switcherDisconnect?.addEventListener('click', async () => {
            await switcher.disconnect();
            pintarEstadoSwitcher();
        });
        container.querySelector('#switcher-follow')?.addEventListener('click', (event) => {
            const next = !switcher.followRundown;
            switcher.setFollowRundown(next);
            event.currentTarget.classList.toggle('active', next);
            event.currentTarget.setAttribute('aria-checked', String(next));
        });
        enlazarSelectoresMapeo(nodos.switcherKind?.value || switcher.options.kind);
        pintarEstadoSwitcher();
        pintarBusquedaOBS();

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
            const accion = accionDeTecla(e, cams.length);
            if (!accion) return;
            e.preventDefault();
            if (accion.tipo === 'camara') commandManager.takeCamera(cams[accion.indice].id);
            else if (accion.tipo === 'inspector') container.querySelector('#toggle-inspector')?.click();
            else commandManager[accion.tipo]();
        };
        container.removeEventListener('keydown', container._camKeyHandler);
        container._camKeyHandler = handleKeys;
        container.addEventListener('keydown', handleKeys);

        if (visible || !container.hidden) {
            visible = true;
            fsm.mount(container);
            switcher.activate();
        }
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

            }

            if (!paso) return;

            if (paso.i !== fsm.pasoActual) {
                fsm.pasoActual = paso.i;
                if (fsm.isRunning && !switcher.status.conectado) {
                    // Ensayo sin switcher: cada paso nuevo vuelve a lo que pide el programa.
                    fsm.air = null;
                    fsm.preview = null;
                } else if (fsm.isRunning) {
                    // Con switcher, lo que está al aire se queda hasta que alguien corte.
                    if (switcher.followRundown && paso.aire) fsm.takeCamera(paso.aire);
                    if (paso.previo && paso.previo !== fsm.air) fsm.setPreview(paso.previo);
                }
            }

            const aireReal = fsm.air || paso.aire;
            const previoReal = fsm.preview || paso.previo;
            const fAire = fuente(cfg, aireReal);
            const fPrevio = fuente(cfg, previoReal);

            if (nodos.aire) nodos.aire.textContent = nom(aireReal);
            if (nodos.aireSub) nodos.aireSub.textContent = fuente(cfg, aireReal)?.plano || '';
            if (nodos.previo) nodos.previo.textContent = nom(previoReal);
            if (nodos.previoSub) nodos.previoSub.textContent = fuente(cfg, previoReal)?.plano || '';

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
        setVisible: (value) => {
            visible = value === true;
            if (visible) {
                fsm.mount(container);
                switcher.activate();
            } else {
                // La conexión con el switcher sigue viva fuera de Producción:
                // en vivo no puede caerse por ir a mirar el guion.
                fsm.unmount();
            }
        },
        unmount: () => {
            visible = false;
            fsm.unmount();
            switcher.deactivate();
        },
    };
}

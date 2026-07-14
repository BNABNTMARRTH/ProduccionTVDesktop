// Modo producción: cronómetro en vivo de la escaleta + checklist técnico +
// teleprompter de pantalla completa.
import { esc } from './constants.js';

function formatTime(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Revisa la configuración y el diagrama y devuelve [tipo, mensaje] por cada hallazgo.
function validations(cfg, diagram) {
    const config = cfg || { camaras: [], microfonos: [], extras: [], escaleta: [] };
    const sources = new Set([...(config.camaras || []), ...(config.extras || [])].map((x) => x.id));
    const result = [];

    if (!(config.camaras || []).length) result.push(['error', 'No hay cámaras configuradas.']);
    if (!(config.microfonos || []).length) result.push(['warn', 'No hay micrófonos configurados.']);
    (config.escaleta || []).forEach((s) => {
        if (!sources.has(s.fuente)) result.push(['error', `“${s.segmento}” no tiene una fuente válida.`]);
        if (!s.dur) result.push(['warn', `“${s.segmento}” tiene duración 00:00.`]);
        if (s.dur > 900) result.push(['warn', `“${s.segmento}” supera 15 minutos.`]);
    });

    const diag = diagram || { nodes: [], edges: [] };
    const used = new Set();
    (diag.edges || []).forEach((e) => { used.add(e.from.node); used.add(e.to.node); });
    (diag.nodes || [])
        .filter((n) => ['camara', 'microfono', 'fuente'].includes(n.type))
        .forEach((n) => { if (!used.has(n.id)) result.push(['warn', `${n.label} todavía no está conectado en el diagrama.`]); });
    if (!(diag.nodes || []).some((n) => n.type === 'encoder')) result.push(['info', 'El diagrama no incluye un encoder/PC.']);
    return result;
}

// Set en vivo: plano cenital con tally sincronizado a la escaleta. Rojo = la
// cámara del segmento al aire, verde = la del siguiente; si la fuente al aire
// no es cámara (VTR/corte), nadie enciende y se muestra un letrero.
function liveSetSVG(cfg, current, next) {
    if (!window.PTVSheets) return '<p class="set-live-note">El plano del set no está disponible.</p>';
    const cams = cfg.camaras || [];
    const camDe = (segment) => cams.find((c) => c.id === segment?.fuente) || null;
    const airCam = camDe(current);
    const nextCam = camDe(next);
    const extra = !airCam && current
        ? (cfg.extras || []).find((x) => x.id === current.fuente)
        : null;
    return window.PTVSheets.planoSvg(cfg, {
        display: true,
        air: airCam?.id || null,
        preview: nextCam && nextCam.id !== airCam?.id ? nextCam.id : null,
        badge: extra ? { text: extra.nombre, color: extra.color } : (!airCam && current ? { text: 'FUENTE SIN ASIGNAR', color: '#64748B' } : null),
    });
}

export function createProductionView({ container, getProject, getInfografia, getDiagram, onGoHome, onEnsayo }) {
    let index = 0;
    let elapsed = 0;
    let running = false;
    let timer = null;
    let panel = 'checklist'; // panel derecho: 'checklist' | 'set'
    let colLive = false;  // cronómetro/prompter colapsado a barra compacta
    let colAside = false; // panel derecho oculto (todo el ancho al prompter)

    const rows = () => getInfografia()?.escaleta || [];

    function stop() {
        running = false;
        clearInterval(timer);
        timer = null;
    }

    function tick() {
        const list = rows();
        const current = list[index];
        elapsed += 1;
        if (current && elapsed >= (current.dur || 0)) {
            elapsed = 0;
            if (index < list.length - 1) {
                index += 1;
                render();
                return;
            }
            stop();
            render();
            return;
        }
        updateClock();
    }

    function toggle() {
        if (running) {
            stop();
        } else {
            if (!rows().length) return; // sin escaleta no hay nada que cronometrar
            running = true;
            clearInterval(timer);
            timer = setInterval(tick, 1000);
            onEnsayo?.(); // hito de la ruta de producción: ya ensayó
        }
        render();
    }

    // Teleprompter de pantalla completa: guion por segmento (las notas de la
    // escaleta), auto-scroll con velocidad regulable, tamaño de letra y modo
    // espejo para cristal de prompter. Atajos: espacio, ↑/↓, Esc.
    function openPrompter() {
        const cfg = getInfografia();
        const list = cfg?.escaleta || [];
        if (!list.length) return;
        const overlay = document.createElement('div');
        overlay.className = 'prompter-overlay';
        overlay.innerHTML = `
            <div class="prompter-bar">
                <button id="pp-play" aria-label="Iniciar o pausar el desplazamiento">▶ Rodar</button>
                <label>Velocidad <input id="pp-speed" type="range" min="10" max="220" step="5" value="55" aria-label="Velocidad de desplazamiento"></label>
                <button id="pp-smaller" aria-label="Texto más chico">A−</button>
                <button id="pp-bigger" aria-label="Texto más grande">A+</button>
                <button id="pp-mirror" aria-label="Activar o desactivar modo espejo">🪞 Espejo</button>
                <button id="pp-here" aria-label="Ir al segmento al aire">● Al aire</button>
                <span class="pp-hint">Espacio: rodar/pausar · ↑↓: velocidad · Esc: salir</span>
                <button id="pp-close" aria-label="Cerrar teleprompter">✕</button>
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
            playBtn.textContent = playing ? 'Ⅱ Pausa' : '▶ Rodar';
            playBtn.classList.toggle('on', playing);
            if (playing) { last = performance.now(); raf = requestAnimationFrame(step); }
            else cancelAnimationFrame(raf);
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

    // Actualiza solo cronómetro y barra de progreso (cada segundo, sin re-render completo).
    function updateClock() {
        const current = rows()[index];
        const remainingEl = container.querySelector('#seg-remaining');
        const progressEl = container.querySelector('#seg-progress');
        if (!remainingEl || !progressEl) return;
        remainingEl.textContent = formatTime(Math.max(0, (current?.dur || 0) - elapsed));
        progressEl.style.width = current?.dur ? `${Math.min(100, (elapsed / current.dur) * 100)}%` : '0%';
    }

    function render() {
        const project = getProject();
        const cfg = getInfografia();
        if (!project || !cfg) {
            stop();
            container.innerHTML = `
                <div class="production-empty">
                    <h1>Modo producción</h1>
                    <p>Crea o abre un proyecto para comenzar.</p>
                    <button id="go-home">Ir a Inicio</button>
                </div>`;
            container.querySelector('#go-home').onclick = onGoHome;
            return;
        }

        const list = rows();
        index = Math.min(index, Math.max(0, list.length - 1));
        const current = list[index];
        const next = list[index + 1];
        const remaining = Math.max(0, (current?.dur || 0) - elapsed);
        const checks = validations(cfg, getDiagram());
        const errors = checks.filter((c) => c[0] === 'error').length;
        const warns = checks.filter((c) => c[0] === 'warn').length;

        container.innerHTML = `
            <div class="production-header">
                <div><span class="eyebrow">MODO PRODUCCIÓN</span><h1>${esc(project.name)}</h1></div>
                <button id="open-prompter" ${list.length ? '' : 'disabled'} title="Guion en pantalla completa con auto-scroll y modo espejo">🗒 Teleprompter</button>
            </div>
            <div class="production-layout">
                <section class="live-card${colLive ? ' collapsed' : ''}">
                    <div class="live-meta">
                        <span>SEGMENTO ${list.length ? index + 1 : 0} / ${list.length}${colLive && current ? ` · ${current.segmento}` : ''}</span>
                        <span class="live-meta-right">
                            <strong id="seg-remaining">${formatTime(remaining)}</strong>
                            <button class="collapse-btn" id="col-live" title="${colLive ? 'Expandir prompter' : 'Colapsar a barra compacta'}">${colLive ? '⌄' : '⌃'}</button>
                        </span>
                    </div>
                    <div class="progress"><i id="seg-progress" style="width:${current?.dur ? Math.min(100, (elapsed / current.dur) * 100) : 0}%"></i></div>
                    ${colLive ? '' : `
                    <div class="live-main">
                        <span>AL AIRE</span>
                        <h2>${current?.segmento || 'Escaleta vacía'}</h2>
                        <p>${current?.nota || 'Sin notas para este segmento.'}</p>
                    </div>
                    <div class="next-row">
                        <span>SIGUE</span>
                        <strong>${next?.segmento || 'Fin del programa'}</strong>
                        <small>${next ? formatTime(next.dur) : ''}</small>
                    </div>`}
                    <div class="production-controls">
                        <button id="prev-seg" title="Segmento anterior" aria-label="Segmento anterior" ${index === 0 ? 'disabled' : ''}>◀</button>
                        <button id="play-seg" class="play" title="${running ? 'Pausar' : 'Iniciar'}" aria-label="${running ? 'Pausar cronómetro' : 'Iniciar cronómetro'}" ${list.length ? '' : 'disabled'}>${running ? 'Ⅱ' : '▶'}</button>
                        <button id="next-seg" title="Siguiente segmento" aria-label="Siguiente segmento" ${index >= list.length - 1 ? 'disabled' : ''}>▶</button>
                        <button id="reset-seg" title="Reiniciar segmento" aria-label="Reiniciar segmento">↺</button>
                    </div>
                </section>
                <aside class="checklist-card${colAside ? ' collapsed' : ''}">
                    ${colAside ? `
                    <button class="collapse-btn" id="col-aside" title="Mostrar panel">◂</button>
                    <span class="aside-vertical">${panel === 'set' ? 'SET EN VIVO' : 'CHECKLIST'}</span>` : `
                    <div class="panel-tabs">
                        <button data-panel="checklist" class="${panel === 'checklist' ? 'active' : ''}">Checklist</button>
                        <button data-panel="set" class="${panel === 'set' ? 'active' : ''}">● Set en vivo</button>
                        <button class="collapse-btn" id="col-aside" title="Ocultar panel (todo el ancho al prompter)">▸</button>
                    </div>
                    ${panel === 'checklist' ? `
                    <div class="validation-summary"><strong>${errors}</strong> errores · <strong>${warns}</strong> avisos</div>
                    <div class="checks-list">
                        ${checks.length
                            ? checks.map(([type, text]) => `<div class="check ${type}"><span>${type === 'error' ? '×' : type === 'warn' ? '!' : 'i'}</span>${text}</div>`).join('')
                            : '<div class="check ok"><span>✓</span>Todo listo para salir al aire.</div>'}
                    </div>` : `
                    <div class="set-live">${liveSetSVG(cfg, current, next)}</div>
                    <p class="set-live-note">🔴 al aire · 🟢 sigue · Acomoda el set en la pestaña Set (⌘2)</p>`}`}
                </aside>
            </div>`;
        const layout = container.querySelector('.production-layout');
        layout.classList.toggle('set-live-open', panel === 'set' && !colAside);
        layout.classList.toggle('aside-collapsed', colAside);

        container.querySelectorAll('[data-panel]').forEach((b) => b.onclick = () => { panel = b.dataset.panel; render(); });
        container.querySelector('#col-live').onclick = () => { colLive = !colLive; render(); };
        container.querySelector('#col-aside').onclick = () => { colAside = !colAside; render(); };
        container.querySelector('#open-prompter').onclick = openPrompter;
        container.querySelector('#prev-seg').onclick = () => { index = Math.max(0, index - 1); elapsed = 0; render(); };
        container.querySelector('#next-seg').onclick = () => { index = Math.min(Math.max(0, list.length - 1), index + 1); elapsed = 0; render(); };
        container.querySelector('#reset-seg').onclick = () => { elapsed = 0; stop(); render(); };
        container.querySelector('#play-seg').onclick = toggle;
    }

    return { render };
}

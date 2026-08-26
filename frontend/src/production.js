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
// El plano con el tally puesto. Ya no lo maneja la escaleta: lo maneja quien
// ensaya, picándole a la cámara que quiere al aire. En un ensayo lo que se
// practica es el corte, no seguir un rundown minuto a minuto.
function liveSetSVG(cfg, air, preview) {
    if (!window.PTVSheets) return '<p class="set-live-note">El plano del set no está disponible.</p>';
    return window.PTVSheets.planoSvg(cfg, {
        display: true,
        air: air || null,
        preview: preview && preview !== air ? preview : null,
    });
}

export function createProductionView({ container, getProject, getInfografia, getDiagram, onGoHome, onEnsayo }) {
    // El ensayo es sobre DOS cosas: que no falte nada (checklist) y practicar
    // el corte en el set. La escaleta se retiró de aquí: para eso está la
    // etapa 2, y minuto a minuto no es lo que se ensaya.
    let air = null;      // qué cámara va AL AIRE (tally rojo)
    let preview = null;  // qué cámara está en PREVIO (tally verde)
    let ensayado = false;

    const rows = () => getInfografia()?.escaleta || [];

    // Teleprompter de pantalla completa: guion por segmento (las notas de la
    // escaleta), auto-scroll con velocidad regulable, tamaño de letra y modo
    // espejo para cristal de prompter. Atajos: espacio, ↑/↓, Esc.
    function openPrompter() {
        const cfg = getInfografia();
        const list = cfg?.escaleta || [];
        // Índice propio del prompter: el ensayo ya no arrastra una posición.
        let index = 0;
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

    function render() {
        const project = getProject();
        const cfg = getInfografia();
        if (!project || !cfg) {
            container.innerHTML = `
                <div class="production-empty">
                    <h1>Ensayo</h1>
                    <p>Crea o abre un proyecto para comenzar.</p>
                    <button id="go-home">Ir a Inicio</button>
                </div>`;
            container.querySelector('#go-home').onclick = onGoHome;
            return;
        }

        const cams = cfg.camaras || [];
        if (air && !cams.some((c) => c.id === air)) air = null;
        if (preview && !cams.some((c) => c.id === preview)) preview = null;

        const checks = validations(cfg, getDiagram());
        const errores = checks.filter((c) => c[0] === 'error');
        const avisos = checks.filter((c) => c[0] === 'warn');
        const listo = !errores.length;
        const camNombre = (id, i) => cams.find((c) => c.id === id)?.nombre || `CAM ${i + 1}`;

        container.innerHTML = `
            <div class="production-header">
                <div>
                    <span class="eyebrow">ENSAYO</span>
                    <h1>${esc(project.name)}</h1>
                </div>
                <div class="ensayo-acciones">
                    <span class="estado-aire ${listo ? 'listo' : 'no'}">
                        ${listo ? '● Listo para salir al aire' : `● ${errores.length} ${errores.length === 1 ? 'cosa falta' : 'cosas faltan'}`}
                    </span>
                    <button id="open-prompter" ${rows().length ? '' : 'disabled'}
                        title="Guion en pantalla completa con auto-scroll y modo espejo">Teleprompter</button>
                </div>
            </div>

            <div class="production-layout">
                <section class="checklist-card">
                    <div class="panel-cab"><h2>Antes de grabar</h2>
                        <span class="panel-cuenta">${errores.length} · ${avisos.length}</span></div>
                    <div class="checks-list">
                        ${checks.length
                            ? checks.map(([type, text]) =>
                                `<div class="check ${type}"><span>${type === 'error' ? '×' : type === 'warn' ? '!' : 'i'}</span>${text}</div>`).join('')
                            : '<div class="check ok"><span>✓</span>Todo listo. No falta nada por revisar.</div>'}
                    </div>
                </section>

                <section class="set-card">
                    <div class="panel-cab"><h2>Set en vivo</h2>
                        <span class="panel-pista">Pícale a una cámara para mandarla al aire</span></div>
                    <div class="bus">
                        ${cams.length
                            ? cams.map((c, i) => `
                                <button class="bus-cam${c.id === air ? ' aire' : ''}${c.id === preview ? ' previo' : ''}"
                                    data-cam="${c.id}" title="Mandar ${esc(camNombre(c.id, i))} al aire">
                                    <i style="background:${c.color}"></i>
                                    <b>${esc(camNombre(c.id, i))}</b>
                                    <small>${esc(c.plano || '')}</small>
                                </button>`).join('')
                            : '<p class="set-live-note">Este proyecto no tiene cámaras todavía. Agrégalas en Necesidades.</p>'}
                    </div>
                    <div class="set-live">${liveSetSVG(cfg, air, preview)}</div>
                    <p class="set-live-note">
                        <b class="tally-aire">●</b> al aire ·
                        <b class="tally-previo">●</b> previo ·
                        el set se acomoda en Planeación
                    </p>
                </section>
            </div>`;

        container.querySelector('#go-home')?.addEventListener('click', onGoHome);
        container.querySelector('#open-prompter').onclick = openPrompter;
        // Un "take" de verdad: la que entra pasa a AIRE y la que estaba se va
        // a PREVIO, que es como se comporta un switcher.
        container.querySelectorAll('[data-cam]').forEach((b) => {
            b.onclick = () => {
                const id = b.dataset.cam;
                if (id === air) return;
                preview = air;
                air = id;
                if (!ensayado) { ensayado = true; onEnsayo?.(); }
                render();
            };
        });
    }

    return { render };
}

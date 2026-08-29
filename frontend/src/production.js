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

/* ============================ EL PROGRAMA ==================================
La escaleta, aplanada en una LÍNEA DE TIEMPO de pasos consecutivos. Es lo que
convierte un rundown en algo que se puede seguir con un reloj: cada paso sabe
en qué segundo empieza, cuánto dura, qué fuente va al aire y cuál en previo.

Dos niveles, y el fino manda: si un segmento tiene cues (el rundown técnico de
la etapa 2), cada cue es un paso, porque ahí está el detalle que el director
canta —"entra CAM 2", "lanza el gráfico", "corte a comercial"—. Si no los
tiene, el paso es el segmento entero. Cuando los cues no llenan la duración del
segmento, el sobrante se queda como un paso del propio segmento en vez de
desaparecer: la escaleta manda en el total, los cues en el detalle. */
function construirPrograma(cfg) {
    const pasos = [];
    let t = 0;
    const empujar = (paso, dur) => { pasos.push({ ...paso, t0: t, dur }); t += dur; };

    (cfg?.escaleta || []).forEach((s, i) => {
        const cues = (s.tomas || []).filter((c) => (c.dur || 0) > 0);
        const dur = Math.max(0, s.dur || 0);
        const base = { seg: i, segNombre: s.segmento || `Segmento ${i + 1}`, nota: s.nota || '' };
        let usado = 0;
        cues.forEach((c) => {
            empujar({ ...base, cue: c, tipo: c.tipo || 'camara',
                      aire: c.alAire || s.fuente, previo: c.previo || '',
                      texto: c.texto || '', transicion: c.transicion || '',
                      grafico: c.grafico || '', audio: c.audio || '' }, Math.max(1, c.dur));
            usado += Math.max(1, c.dur);
        });
        if (dur - usado > 0.5 || !cues.length) {
            empujar({ ...base, cue: null, tipo: 'segmento', aire: s.fuente, previo: '',
                      texto: s.nota || '', transicion: '', grafico: '', audio: '' },
                    Math.max(0, cues.length ? dur - usado : dur));
        }
    });

    pasos.forEach((paso, i) => {
        paso.i = i;
        paso.t1 = paso.t0 + paso.dur;
        // El previo por omisión es LO QUE VIENE: es lo que cualquier director
        // deja preparado mientras el otro está al aire.
        if (!paso.previo) paso.previo = pasos[i + 1]?.aire || '';
    });
    return { pasos, total: t };
}

// En qué paso va el programa a los `t` segundos de haber arrancado.
function pasoEn(programa, t) {
    const { pasos } = programa;
    if (!pasos.length) return null;
    if (t >= programa.total) return pasos[pasos.length - 1];
    return pasos.find((p) => t >= p.t0 && t < p.t1) || pasos[0];
}

export function createProductionView({ container, getProject, getInfografia, getDiagram, onGoHome, onEnsayo }) {
    /* EL ENSAYO SIRVE PARA MIRAR SI LA EJECUCIÓN VA CON EL PROGRAMA (29-ago).
    Antes esta pantalla era un switcher suelto: picabas una cámara y el tally
    la seguía, sin más. Servía para practicar el corte, pero no para lo que de
    verdad necesitan el director, el productor o el floor manager el día de la
    grabación: saber, en cada segundo, QUÉ DEBERÍA estar pasando.

    Ahora la escaleta corre con un reloj. Con ▶ arranca el programa y la
    tarjeta dice a cada momento qué fuente va al aire, cuál va en previo y qué
    parte del guion toca ejecutar. El switcher manual sigue ahí: lo que piques
    es lo que DE VERDAD está al aire, y si no coincide con el programa la
    tarjeta lo canta. Esa comparación —programa contra realidad— es el trabajo
    de monitoreo que faltaba. */
    let air = null;        // lo que el operador mandó al aire A MANO
    let preview = null;    // lo que dejó en previo a mano
    let ensayado = false;

    let corriendo = false;
    let acumulado = 0;     // segundos ya corridos antes de la última pausa
    let arranque = 0;      // performance.now() del último ▶
    let reloj = 0;         // el setInterval del transporte
    let pasoActual = -1;   // para redibujar el plano solo cuando cambia
    let nodos = {};        // los trozos que se refrescan cada tic

    const rows = () => getInfografia()?.escaleta || [];
    const transcurrido = () => acumulado + (corriendo ? (performance.now() - arranque) / 1000 : 0);

    // El nombre y el color de una fuente, sea cámara o no: en un rundown al
    // aire entran también el VTR, los gráficos y el corte a comerciales.
    function fuente(cfg, id) {
        if (!id) return null;
        const cam = (cfg.camaras || []).find((c) => c.id === id);
        if (cam) return { ...cam, esCamara: true };
        const extra = (cfg.extras || []).find((x) => x.id === id);
        return extra ? { ...extra, plano: extra.esCorte ? 'Corte' : '', esCamara: false } : null;
    }

    // Teleprompter de pantalla completa: guion por segmento (las notas de la
    // escaleta), auto-scroll con velocidad regulable, tamaño de letra y modo
    // espejo para cristal de prompter. Atajos: espacio, ↑/↓, Esc.
    function openPrompter() {
        const cfg = getInfografia();
        const list = cfg?.escaleta || [];
        // El prompter abre DONDE VA EL PROGRAMA. Si la escaleta está corriendo,
        // empezar el guion desde arriba obliga a buscar, y buscar es justo lo
        // que no se puede hacer con la cámara al aire.
        let index = pasoEn(construirPrograma(cfg), transcurrido())?.seg || 0;
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

        const checks = validations(cfg, getDiagram());
        const errores = checks.filter((c) => c[0] === 'error');
        const avisos = checks.filter((c) => c[0] === 'warn');
        const listo = !errores.length;
        const cams = cfg.camaras || [];
        if (air && !cams.some((c) => c.id === air)) air = null;
        if (preview && !cams.some((c) => c.id === preview)) preview = null;

        const programa = construirPrograma(cfg);
        const hayPrograma = programa.pasos.length > 0;
        const nom = (id) => fuente(cfg, id)?.nombre || '—';

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

                <!-- UNA SOLA TARJETA: el transporte, lo que va al aire, lo que
                     toca ejecutar y el plano. Quien dirige no puede andar
                     barriendo la pantalla: todo lo que necesita mirar mientras
                     el programa corre tiene que caber de una ojeada. -->
                <section class="set-card vivo-card">
                    <div class="panel-cab"><h2>En vivo</h2>
                        <span class="panel-pista">La escaleta corriendo con reloj</span></div>

                    <div class="vivo-transporte">
                        <button id="vivo-play" class="vivo-play" ${hayPrograma ? '' : 'disabled'}
                            title="${hayPrograma ? 'Arrancar el programa (barra espaciadora)' : 'Esta escaleta todavía no tiene segmentos'}">
                            <b id="vivo-play-t">▶ Arrancar</b>
                        </button>
                        <button id="vivo-reset" class="vivo-reset" ${hayPrograma ? '' : 'disabled'}
                            title="Volver al principio">↺</button>
                        <div class="vivo-reloj">
                            <b id="vivo-t">00:00</b>
                            <span>de ${formatTime(programa.total)}</span>
                        </div>
                        <div class="vivo-barra"><i id="vivo-avance"></i></div>
                    </div>

                    ${hayPrograma ? `
                    <div class="vivo-buses">
                        <div class="vivo-bus aire">
                            <span class="vivo-rot">Al aire</span>
                            <b id="vivo-aire">—</b>
                            <small id="vivo-aire-sub"></small>
                        </div>
                        <div class="vivo-bus previo">
                            <span class="vivo-rot">En previo</span>
                            <b id="vivo-previo">—</b>
                            <small id="vivo-previo-sub"></small>
                        </div>
                    </div>

                    <p class="vivo-desvio" id="vivo-desvio" hidden></p>

                    <div class="vivo-monitor">
                        <div class="vivo-ahora">
                            <span class="vivo-rot">Ahora <em id="vivo-pos"></em></span>
                            <h3 id="vivo-seg">—</h3>
                            <p id="vivo-texto"></p>
                            <div class="vivo-etiquetas" id="vivo-etiquetas"></div>
                        </div>
                        <div class="vivo-sigue">
                            <span class="vivo-rot">Sigue</span>
                            <h4 id="vivo-sig">—</h4>
                            <small id="vivo-sig-sub"></small>
                            <span class="vivo-resta" id="vivo-resta"></span>
                        </div>
                    </div>` : `
                    <p class="set-live-note">Esta escaleta todavía no tiene segmentos. Ármala en la etapa <b>Guion</b> y aquí podrás correrla con reloj.</p>`}

                    <div class="bus">
                        ${cams.length
                            ? cams.map((c, i) => `
                                <button class="bus-cam" data-cam="${c.id}"
                                    title="Mandar ${esc(c.nombre || `CAM ${i + 1}`)} al aire de verdad">
                                    <i style="background:${c.color}"></i>
                                    <b>${esc(c.nombre || `CAM ${i + 1}`)}</b>
                                    <small>${esc(c.plano || '')}</small>
                                </button>`).join('')
                            : '<p class="set-live-note">Este proyecto no tiene cámaras todavía. Agrégalas en Necesidades.</p>'}
                    </div>
                    <div class="set-live" id="vivo-plano"></div>
                    <p class="set-live-note">
                        <b class="tally-aire">●</b> al aire ·
                        <b class="tally-previo">●</b> previo ·
                        pícale a una cámara para registrar lo que de verdad tomaste
                    </p>
                </section>
            </div>`;

        nodos = {
            play: container.querySelector('#vivo-play'),
            playT: container.querySelector('#vivo-play-t'),
            t: container.querySelector('#vivo-t'),
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
            programa, cfg, nom,
        };

        container.querySelector('#go-home')?.addEventListener('click', onGoHome);
        container.querySelector('#open-prompter').onclick = openPrompter;
        nodos.play?.addEventListener('click', alternar);
        container.querySelector('#vivo-reset')?.addEventListener('click', reiniciar);
        // Un "take" de verdad: la que entra pasa a AIRE y la que estaba se va
        // a PREVIO, que es como se comporta un switcher. Con el programa
        // corriendo esto es lo que DE VERDAD tomaste, y si no es lo que pedía
        // la escaleta, la tarjeta lo dice.
        nodos.cams.forEach((b) => {
            b.onclick = () => {
                const id = b.dataset.cam;
                if (id === air) return;
                preview = air;
                air = id;
                marcarEnsayado();
                refrescar();
            };
        });

        pasoActual = -1;   // fuerza a repintar el plano en el primer refresco
        refrescar();
    }

    function marcarEnsayado() {
        if (ensayado) return;
        ensayado = true;
        onEnsayo?.();
    }

    /* ---- EL TRANSPORTE ---------------------------------------------------
    El reloj no se para al cambiar de pestaña ni al mirar otra etapa: un
    programa al aire no se detiene porque el director mire otra cosa. Por eso
    el estado vive en el cierre y no en el DOM, y `render()` lo reencuentra
    tal como estaba. */
    function alternar() {
        if (!nodos.programa?.pasos.length) return;
        if (corriendo) {
            acumulado = transcurrido();
            corriendo = false;
            clearInterval(reloj);
        } else {
            arranque = performance.now();
            corriendo = true;
            marcarEnsayado();
            clearInterval(reloj);
            reloj = setInterval(refrescar, 200);
        }
        refrescar();
    }

    function reiniciar() {
        acumulado = 0;
        arranque = performance.now();
        air = null;
        preview = null;
        pasoActual = -1;
        refrescar();
    }

    /* ---- EL REFRESCO -----------------------------------------------------
    Cinco veces por segundo, y toca SOLO el texto que cambia. Volver a dibujar
    la tarjeta entera cada tic sería tirar el plano del set (un SVG grande) y
    los botones a la basura cinco veces por segundo; el plano se redibuja nada
    más cuando de verdad cambia el tally. */
    function refrescar() {
        if (!nodos.t) return;
        const { programa, cfg, nom } = nodos;
        const t = Math.min(transcurrido(), programa.total);
        const paso = pasoEn(programa, t);
        const fin = t >= programa.total && programa.total > 0;

        nodos.t.textContent = formatTime(t);
        nodos.t.classList.toggle('corriendo', corriendo);
        nodos.avance.style.width = `${programa.total ? Math.min(100, (t / programa.total) * 100) : 0}%`;
        if (nodos.playT) nodos.playT.textContent = fin ? '■ Terminó' : corriendo ? 'Ⅱ Pausa' : acumulado ? '▶ Seguir' : '▶ Arrancar';
        nodos.play?.classList.toggle('on', corriendo);

        if (!paso) return;

        // Al cambiar de paso, el programa manda otra vez: lo que el operador
        // hubiera tomado a mano pertenecía a la instrucción anterior.
        if (paso.i !== pasoActual) {
            if (corriendo) { air = null; preview = null; }
            pasoActual = paso.i;
        }

        const aireReal = air || paso.aire;
        const previoReal = preview || paso.previo;
        const fAire = fuente(cfg, aireReal);
        const fPrevio = fuente(cfg, previoReal);

        nodos.aire.textContent = nom(paso.aire);
        nodos.aireSub.textContent = fuente(cfg, paso.aire)?.plano || '';
        nodos.previo.textContent = nom(paso.previo);
        nodos.previoSub.textContent = fuente(cfg, paso.previo)?.plano || '';

        // LA COMPARACIÓN: programa contra lo que de verdad está al aire.
        const desviado = air && paso.aire && air !== paso.aire;
        nodos.desvio.hidden = !desviado;
        if (desviado) nodos.desvio.textContent = `Al aire tienes ${nom(air)}, y el programa pide ${nom(paso.aire)}.`;

        const total = programa.pasos.length;
        nodos.pos.textContent = `${paso.i + 1} de ${total}`;
        nodos.seg.textContent = paso.segNombre;
        nodos.texto.textContent = paso.texto || paso.nota || '(Sin instrucción escrita para este paso)';
        nodos.texto.classList.toggle('vacio', !(paso.texto || paso.nota));

        const etiquetas = [];
        if (paso.transicion) etiquetas.push(paso.transicion);
        if (paso.grafico) etiquetas.push(`GFX · ${paso.grafico}`);
        if (paso.audio) etiquetas.push(`AUDIO · ${paso.audio}`);
        if (paso.cue) etiquetas.push(paso.tipo);
        nodos.etiquetas.innerHTML = etiquetas.map((e) => `<span>${esc(e)}</span>`).join('');

        // "Sigue" tiene que decir algo NUEVO. Cuando el paso que viene es otro
        // cue del mismo segmento, repetir el nombre del segmento no informa de
        // nada: ahí lo que importa es la instrucción que toca cantar.
        const sigue = programa.pasos[paso.i + 1];
        const mismoSeg = sigue && sigue.seg === paso.seg;
        nodos.sig.textContent = fin ? 'Fin del programa'
            : !sigue ? 'Último paso'
            : (mismoSeg && sigue.texto) ? sigue.texto : sigue.segNombre;
        // Y tampoco se repite a sí mismo: hay segmentos que se llaman igual que
        // su fuente ("Comerciales" sale de COMERCIALES) y decirlo dos veces
        // gasta una línea sin añadir nada.
        const sigTitulo = nodos.sig.textContent;
        const sigFuente = nom(sigue?.aire);
        nodos.sigSub.textContent = sigue
            ? [sigFuente.toLowerCase() === sigTitulo.toLowerCase() ? '' : sigFuente,
               !mismoSeg && sigue.texto ? sigue.texto : ''].filter(Boolean).join(' · ')
            : '';
        nodos.resta.textContent = fin ? '' : `en ${formatTime(Math.max(0, paso.t1 - t))}`;

        // El plano solo se redibuja cuando cambia lo que ilumina.
        const firma = `${aireReal}|${previoReal}`;
        if (nodos.firma !== firma) {
            nodos.firma = firma;
            nodos.plano.innerHTML = liveSetSVG(cfg,
                fAire?.esCamara ? aireReal : null,
                fPrevio?.esCamara ? previoReal : null);
        }
        nodos.cams.forEach((b) => {
            b.classList.toggle('aire', b.dataset.cam === aireReal);
            b.classList.toggle('previo', b.dataset.cam === previoReal && b.dataset.cam !== aireReal);
            b.classList.toggle('pide', !!paso.aire && b.dataset.cam === paso.aire && b.dataset.cam !== aireReal);
        });
    }

    return { render };
}

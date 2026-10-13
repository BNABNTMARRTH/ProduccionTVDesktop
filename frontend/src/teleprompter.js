/* EL TELEPROMPTER de la Sala de Control: un overlay a pantalla completa que
 * rueda el guion de la escaleta (la nota de cada segmento). Vive aparte de
 * production.js porque no depende del reloj ni del switcher: solo necesita la
 * escaleta y en qué segmento va el programa para arrancar ahí. */
import { esc } from './constants.js';
import { formatTime } from './formato_tiempo.js';

export function abrirTeleprompter({ escaleta, index = 0 }) {
    const list = escaleta || [];
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

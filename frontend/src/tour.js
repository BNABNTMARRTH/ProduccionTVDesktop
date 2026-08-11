// Recorrido guiado de primera vez: una serie de "coach marks" que iluminan cada
// pestaña del proyecto y explican, en orden pedagógico (mensaje → historia →
// ángulos/movimiento/sonido → set e iluminación → señal → aire → exportar), cómo
// armar la primera producción audiovisual. Se ancla SOLO a elementos del shell
// (pestañas del header, ruta), nunca al interior del iframe, para ser robusto sin
// importar qué herramienta esté cargando detrás.

const PASOS = [
  { view: 'infografias', target: null,
    titulo: '👋 Bienvenido a tu primera producción',
    cuerpo: 'Este recorrido te muestra, paso a paso, cómo usar cada sección para pasar de una idea a una producción audiovisual terminada. Puedes saltarlo cuando quieras y repetirlo después.' },
  { view: 'infografias', target: '#ruta',
    titulo: 'Tu ruta de producción',
    cuerpo: 'Estos son los <b>6 pasos</b> de toda producción. Cada uno se marca <b>✓</b> solo cuando lo completas, así siempre sabes qué sigue. Vamos en orden.' },
  { view: 'infografias', target: '.rail',
    titulo: 'Cómo navegar',
    cuerpo: 'Cada icono es una herramienta (o usa <b>⌘1–⌘7</b>). El icono encendido es donde estás. El nombre del proyecto, arriba a la izquierda, te regresa a Inicio.' },
  { view: 'escaleta', target: '[data-view="escaleta"]',
    titulo: '1 · El mensaje y la historia',
    cuerpo: 'Toda producción empieza por el <b>porqué</b>. En <b>≡ Escaleta</b>, el <b>✦ Asistente narrativo</b> te lleva de la idea a la escaleta: define tu mensaje y tu premisa, crea tus personajes, elige una estructura y genera las escenas por ti.' },
  { view: 'escaleta', target: '[data-view="escaleta"]',
    titulo: '2 · Ángulos y planos',
    cuerpo: 'En el <b>Guion técnico</b> decides, toma por toma, el plano y el ángulo de cámara. El asistente los recomienda según tu intención: <b>primer plano</b> para la emoción, <b>gran plano general</b> para el contexto, <b>contrapicado</b> para dar poder…' },
  { view: 'escaleta', target: '[data-view="escaleta"]',
    titulo: '3 · Movimiento de cámara y sonido',
    cuerpo: 'Cada toma define también su <b>movimiento</b> (fija, paneo, travelling…) y su <b>sonido</b>: voz, música y ambiente. El sonido no es un adorno — el asistente te sugiere el tratamiento sonoro escena por escena.' },
  { view: 'set', target: '[data-view="set"]',
    titulo: '4 · Set e iluminación',
    cuerpo: 'En <b>▦ Set</b> montas el espacio físico: mobiliario, cámaras y, sobre todo, la <b>iluminación</b> (esquema de tres puntos y más). Arrastra los elementos en la planta para colocarlos donde van.' },
  { view: 'diagrama', target: '[data-view="diagrama"]',
    titulo: '5 · La señal',
    cuerpo: 'En <b>⌁ Diagrama</b> conectas cámaras, micrófonos y switcher: la ruta de video y audio. <b>⚡ Autoconectar</b> arma la cadena estándar y te avisa qué falta antes de salir al aire.' },
  { view: 'production', target: '[data-view="production"]',
    titulo: '6 · ¡Al aire!',
    cuerpo: 'En <b>● Producción</b> corres tu escaleta en vivo: cronómetro, <b>tally</b> de cámaras y teleprompter. Es tu cabina el día del rodaje.' },
  { view: 'exportar', target: '[data-view="exportar"]',
    titulo: 'Comparte tu trabajo',
    cuerpo: 'En <b>⇩ Exportar</b> armas el paquete final: PDF para imprimir, PNG o el proyecto <b>.ptv</b> para compartir con tu equipo o entregarlo.' },
  { view: 'infografias', target: null,
    titulo: '🎬 ¡A grabar!',
    cuerpo: 'Al crear un proyecto, el <b>asistente</b> (narrativo o de programa en vivo, según el modo) se abre solo para ayudarte a empezar; también puedes reabrirlo con su botón verde. ¿Quieres repetir este recorrido? Usa el botón <b>❔</b> del encabezado.',
    fin: '¡Entendido!' },
];

export function createTour({ selectView }) {
  let overlay = null;

  function start() {
    if (overlay) return;
    let i = 0;
    overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    const hole = document.createElement('div');
    hole.className = 'tour-hole';
    const card = document.createElement('div');
    card.className = 'tour-card';
    overlay.append(hole, card);
    document.body.appendChild(overlay);

    function finish() {
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKey, true);
      overlay?.remove();
      overlay = null;
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(i - 1); }
    }

    function go(n) {
      if (n < 0) return;
      if (n >= PASOS.length) { finish(); return; }
      i = n;
      if (PASOS[i].view) selectView(PASOS[i].view);
      render();
      // Reposiciona tras el reflujo del cambio de vista (dos frames por si el
      // header cambia de altura al mostrar la ruta).
      requestAnimationFrame(() => requestAnimationFrame(place));
    }

    function render() {
      const paso = PASOS[i];
      const last = i === PASOS.length - 1;
      card.innerHTML = `
        <span class="tour-count">Paso ${i + 1} de ${PASOS.length}</span>
        <h3>${paso.titulo}</h3>
        <p>${paso.cuerpo}</p>
        <div class="tour-nav">
          <button class="tour-skip" type="button">Saltar</button>
          <div>
            ${i > 0 ? '<button class="tour-back" type="button">← Atrás</button>' : ''}
            <button class="tour-next" type="button">${last ? (paso.fin || 'Terminar') : 'Siguiente →'}</button>
          </div>
        </div>`;
      card.querySelector('.tour-skip').onclick = finish;
      const back = card.querySelector('.tour-back');
      if (back) back.onclick = () => go(i - 1);
      card.querySelector('.tour-next').onclick = () => go(i + 1);
    }

    function place() {
      if (!overlay) return;
      const paso = PASOS[i];
      const target = paso.target ? document.querySelector(paso.target) : null;
      if (target && target.offsetParent !== null) {
        const r = target.getBoundingClientRect();
        const pad = 6;
        hole.style.display = 'block';
        hole.style.left = `${r.left - pad}px`;
        hole.style.top = `${r.top - pad}px`;
        hole.style.width = `${r.width + pad * 2}px`;
        hole.style.height = `${r.height + pad * 2}px`;
        overlay.classList.remove('dim');
        // Tarjeta debajo del objetivo, centrada bajo él y sujeta al viewport.
        const cw = card.offsetWidth || 360;
        const ch = card.offsetHeight || 200;
        let left = r.left + r.width / 2 - cw / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - cw - 12));
        let top = r.bottom + 12;
        if (top + ch > window.innerHeight - 12) top = Math.max(12, r.top - ch - 12);
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.style.transform = 'none';
      } else {
        hole.style.display = 'none';
        overlay.classList.add('dim');
        card.style.left = '50%';
        card.style.top = '50%';
        card.style.transform = 'translate(-50%, -50%)';
      }
    }

    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    go(0);
  }

  return { start };
}

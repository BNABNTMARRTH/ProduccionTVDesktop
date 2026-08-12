// Caja de NUEVO PROYECTO: nombre y modo, nada más.
//
// Sustituye al wizard de 9 pantallas (2026-08-11). La razón del cambio: aquel
// wizard preguntaba todo por adelantado y luego generaba una escaleta CERRADA
// —el número de escenas era el número de beats de la estructura elegida, sin
// poder agregar ni quitar—. El modelo nuevo es al revés: se entra al proyecto
// en segundos y todo se arma dentro, editable, con sugerencias que el usuario
// pide cuando quiere.
//
// Aquí no se decide nada irreversible: el modo se puede cambiar después y el
// resto (cámaras, talentos, escaleta) se edita en el proyecto.

const MODOS = [
    {
        id: 'live', icono: '●', titulo: 'En vivo',
        desc: 'Reloj continuo: bloques, señales al aire y rundown técnico.',
        ejemplo: 'Noticiero, entrevista, podcast, evento.',
    },
    {
        id: 'narrative', icono: '◆', titulo: 'Narrativo',
        desc: 'Por escenas y planos; se graba fuera de orden y se monta después.',
        ejemplo: 'Ficción, videoclip, documental, publicidad.',
    },
];

export function createNuevoProyecto({ onCreate }) {
    let abierto = false;
    let modo = 'live';
    const capa = document.createElement('div');
    capa.className = 'np-overlay';
    capa.hidden = true;
    document.body.appendChild(capa);

    const pinta = () => {
        capa.innerHTML = `
          <div class="np-card" role="dialog" aria-modal="true" aria-labelledby="np-titulo">
            <button class="np-cerrar" aria-label="Cerrar">✕</button>
            <h1 id="np-titulo">Nuevo proyecto</h1>
            <p class="np-hint">Solo esto para empezar. Lo demás lo armas dentro y puedes cambiarlo cuando quieras.</p>
            <label class="np-label" for="np-nombre">¿Cómo se llama?</label>
            <input id="np-nombre" class="np-input" type="text" placeholder="Noticiero de la FCC" autocomplete="off">
            <label class="np-label">¿Cómo se produce?</label>
            <div class="np-modos">
              ${MODOS.map((m) => `
                <button class="np-modo ${m.id === modo ? 'selected' : ''}" data-modo="${m.id}" aria-pressed="${m.id === modo}">
                  <span class="np-modo-ico">${m.icono}</span>
                  <strong>${m.titulo}</strong>
                  <small>${m.desc}</small>
                  <em>${m.ejemplo}</em>
                </button>`).join('')}
            </div>
            <button class="np-crear">Crear y empezar</button>
          </div>`;

        const nombre = capa.querySelector('#np-nombre');
        capa.querySelector('.np-cerrar').onclick = cerrar;
        capa.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => {
            modo = b.dataset.modo;
            const foco = nombre.value;
            pinta();
            capa.querySelector('#np-nombre').value = foco;
            capa.querySelector('#np-nombre').focus();
        });
        capa.querySelector('.np-crear').onclick = crear;
        nombre.onkeydown = (e) => { if (e.key === 'Enter') crear(); };
        setTimeout(() => nombre.focus(), 20);
    };

    function crear() {
        const nombre = (capa.querySelector('#np-nombre')?.value || '').trim();
        cerrar();
        onCreate({
            name: nombre || `Proyecto ${new Date().toLocaleDateString('es-MX')}`,
            modo,
            // Base mínima y editable: un par de cámaras en vivo, una en narrativo,
            // un talento y la escaleta VACÍA. Nada de segmentos impuestos.
            template: 'vacio',
            cams: modo === 'narrative' ? 1 : 2,
        });
    }

    function abrir() {
        if (abierto) return;
        abierto = true;
        capa.hidden = false;
        modo = 'live';
        pinta();
    }

    function cerrar() {
        abierto = false;
        capa.hidden = true;
        capa.innerHTML = '';
    }

    capa.onclick = (e) => { if (e.target === capa) cerrar(); };

    return { open: abrir, close: cerrar, isOpen: () => abierto };
}

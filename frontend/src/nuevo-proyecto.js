// Caja de NUEVO PROYECTO: nombre, modo y —si se quiere— el perfil.
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
//
// 2026-08-25: se agregó el PERFIL (mensaje, intención, receptor, medios y
// presupuesto), pero PLEGADO y opcional. "Crear y empezar" sigue funcionando
// solo con el nombre: quien quiera arrancar en tres segundos, arranca; quien
// ya tiene claro el brief, lo deja capturado desde el minuto cero. Lo mismo se
// edita después en la etapa 1.

// Escapa lo que el usuario escribe antes de volver a inyectarlo en el HTML.
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chip = (valor, activos) =>
    `<button type="button" class="np-chip${activos.includes(valor) ? ' on' : ''}" data-valor="${esc(valor)}" aria-pressed="${activos.includes(valor)}">${esc(valor)}</button>`;

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

import { INTENCIONES, MEDIOS, perfilVacio } from './templates.js';

export function createNuevoProyecto({ onCreate }) {
    let abierto = false;
    let modo = 'live';
    let verPerfil = false;          // el bloque del perfil arranca plegado
    let perfil = perfilVacio();
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
            <button class="np-mas" aria-expanded="${verPerfil}">
              <span class="np-mas-ico">${verPerfil ? '▾' : '▸'}</span>
              El perfil del proyecto <em>· opcional, se puede llenar después</em>
            </button>
            ${verPerfil ? `
            <div class="np-extra">
              <label class="np-label" for="np-mensaje">Mensaje — la idea en una frase</label>
              <input id="np-mensaje" class="np-input" type="text" data-campo="mensaje"
                placeholder="Si tu proyecto solo pudiera decir una cosa, ¿cuál sería?" value="${esc(perfil.mensaje)}">
              <label class="np-label">Intención — qué quieres que pase en quien lo vea</label>
              <div class="np-chips" data-lista="intencion">
                ${INTENCIONES.map((o) => chip(o, perfil.intencion)).join('')}
              </div>
              <div class="np-dos">
                <div>
                  <label class="np-label" for="np-receptor">Receptor — a quién le hablas</label>
                  <input id="np-receptor" class="np-input" type="text" data-campo="receptor"
                    placeholder="Estudiantes de la facultad" value="${esc(perfil.receptor)}">
                </div>
                <div>
                  <label class="np-label" for="np-edad">Edad</label>
                  <input id="np-edad" class="np-input" type="text" data-campo="edad"
                    placeholder="18 a 25 años" value="${esc(perfil.edad)}">
                </div>
              </div>
              <label class="np-label">Medios que usa tu receptor</label>
              <div class="np-chips" data-lista="medios">
                ${MEDIOS.map((o) => chip(o, perfil.medios)).join('')}
              </div>
              <div class="np-dos">
                <div>
                  <label class="np-label" for="np-emisor">Emisor — quién produce</label>
                  <input id="np-emisor" class="np-input" type="text" data-campo="emisor"
                    placeholder="FCC-UASLP" value="${esc(perfil.emisor)}">
                </div>
                <div>
                  <label class="np-label" for="np-presupuesto">Presupuesto (MXN)</label>
                  <input id="np-presupuesto" class="np-input" type="text" inputmode="numeric" data-campo="presupuesto"
                    placeholder="0" value="${esc(perfil.presupuesto)}">
                </div>
              </div>
            </div>` : ''}
            <button class="np-crear">Crear y empezar</button>
          </div>`;

        const nombre = capa.querySelector('#np-nombre');
        capa.querySelector('.np-cerrar').onclick = cerrar;
        capa.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => {
            leerCampos();
            modo = b.dataset.modo;
            const foco = nombre.value;
            pinta();
            capa.querySelector('#np-nombre').value = foco;
            capa.querySelector('#np-nombre').focus();
        });
        capa.querySelector('.np-mas').onclick = () => { leerCampos(); verPerfil = !verPerfil; pinta(); };
        capa.querySelectorAll('.np-chip').forEach((b) => b.onclick = () => {
            leerCampos();
            const lista = b.closest('[data-lista]').dataset.lista;
            const valor = b.dataset.valor;
            perfil[lista] = perfil[lista].includes(valor)
                ? perfil[lista].filter((v) => v !== valor)
                : [...perfil[lista], valor];
            const foco = capa.querySelector('#np-nombre').value;
            pinta();
            capa.querySelector('#np-nombre').value = foco;
        });
        capa.querySelector('.np-crear').onclick = crear;
        nombre.onkeydown = (e) => { if (e.key === 'Enter') crear(); };
        setTimeout(() => nombre.focus(), 20);
    };

    // Guarda lo escrito antes de volver a dibujar la caja (se redibuja al
    // cambiar de modo, al plegar el perfil y al encender un chip).
    function leerCampos() {
        capa.querySelectorAll('[data-campo]').forEach((i) => {
            perfil[i.dataset.campo] = i.dataset.campo === 'presupuesto'
                ? i.value.replace(/[^\d.]/g, '')
                : i.value;
        });
    }

    // ¿El perfil trae algo? Si está vacío no se manda, para no ensuciar el cfg.
    const perfilConDatos = () => Object.values(perfil).some((v) => (Array.isArray(v) ? v.length : String(v).trim()));

    function crear() {
        leerCampos();
        const nombre = (capa.querySelector('#np-nombre')?.value || '').trim();
        const conPerfil = perfilConDatos() ? { perfil } : {};
        cerrar();
        onCreate({
            ...conPerfil,
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
        verPerfil = false;
        perfil = perfilVacio();
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

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
import { cfgDePlantilla } from './plantillas.js';
// Escapa lo que el usuario escribe antes de volver a inyectarlo en el HTML.
// Es la MISMA de constants.js: había dos copias idénticas del mismo escape.
import { esc } from './constants.js';

export function createNuevoProyecto({ onCreate }) {
    let abierto = false;
    let modo = 'live';
    let verPerfil = false;          // el bloque del perfil arranca plegado
    let perfil = perfilVacio();
    // Plantilla de set elegida en la galería de Inicio, si vino de ahí. Con
    // plantilla ya no hay nada que decidir sobre el modo (todas son en vivo):
    // la caja solo pregunta el nombre.
    let plantilla = null;
    // El NOMBRE ESCRITO se guarda aparte. La caja se vuelve a dibujar entera
    // al cambiar de modo, al desplegar el perfil y al encender un chip; antes
    // cada manejador se acordaba por su cuenta de rescatarlo, y el del perfil
    // NO lo hacía: quien escribía el nombre y luego abría el brief lo perdía.
    let nombreEscrito = '';
    const capa = document.createElement('div');
    capa.className = 'np-overlay';
    capa.hidden = true;
    document.body.appendChild(capa);

    const pinta = () => {
        capa.innerHTML = `
          <div class="np-card" role="dialog" aria-modal="true" aria-labelledby="np-titulo">
            <button class="np-cerrar" aria-label="Cerrar">✕</button>
            <h1 id="np-titulo">${plantilla ? 'Proyecto desde plantilla' : 'Nuevo proyecto'}</h1>
            <p class="np-hint">${plantilla
                ? `Se arma un set de <b>${esc(plantilla.nombre)}</b> ya puesto: ${esc(plantilla.resumen.toLowerCase())}. Todo se puede mover y cambiar dentro.`
                : 'Solo esto para empezar. Lo demás lo armas dentro y puedes cambiarlo cuando quieras.'}</p>
            <label class="np-label" for="np-nombre">¿Cómo se llama?</label>
            <input id="np-nombre" class="np-input" type="text" placeholder="${plantilla ? esc(plantilla.nombre) : 'Noticiero de la FCC'}" autocomplete="off">
            ${plantilla ? '' : `
            <label class="np-label">¿Cómo se produce?</label>
            <div class="np-modos">
              ${MODOS.map((m) => `
                <button class="np-modo ${m.id === modo ? 'selected' : ''}" data-modo="${m.id}" aria-pressed="${m.id === modo}">
                  <span class="np-modo-ico">${m.icono}</span>
                  <strong>${m.titulo}</strong>
                  <small>${m.desc}</small>
                  <em>${m.ejemplo}</em>
                </button>`).join('')}
            </div>`}
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
            <button class="np-crear">${plantilla ? 'Crear con esta plantilla' : 'Crear y empezar'}</button>
          </div>`;

        const nombre = capa.querySelector('#np-nombre');
        nombre.value = nombreEscrito;
        capa.querySelector('.np-cerrar').onclick = cerrar;
        /* ELEGIR EL MODO NO REDIBUJA LA CAJA. Antes sí: se volvía a pintar el
           HTML entero y, como eso se lleva por delante el cursor, había que
           devolvérselo al campo del nombre a mano. En un iPad eso era una
           lata — devolver el foco DENTRO del gesto del dedo es justo lo que
           hace subir el teclado, así que tocar "En vivo" o "Narrativo" abría
           el teclado encima del diálogo sin que nadie lo pidiera.
           El modo solo cambia qué botón va marcado, así que se marca y ya: sin
           redibujar no se pierde el cursor y no hay que ir a buscarlo.
           El preventDefault del mousedown es para que el botón tampoco le robe
           el foco al nombre: en el Mac sigues escribiendo donde ibas. */
        capa.querySelectorAll('[data-modo]').forEach((b) => {
            b.onmousedown = (e) => e.preventDefault();
            b.onclick = () => {
                modo = b.dataset.modo;
                capa.querySelectorAll('[data-modo]').forEach((otro) => {
                    const puesto = otro.dataset.modo === modo;
                    otro.classList.toggle('selected', puesto);
                    otro.setAttribute('aria-pressed', puesto ? 'true' : 'false');
                });
            };
        });
        capa.querySelector('.np-mas').onclick = () => { leerCampos(); verPerfil = !verPerfil; pinta(); };
        capa.querySelectorAll('.np-chip').forEach((b) => b.onclick = () => {
            leerCampos();
            const lista = b.closest('[data-lista]').dataset.lista;
            const valor = b.dataset.valor;
            perfil[lista] = perfil[lista].includes(valor)
                ? perfil[lista].filter((v) => v !== valor)
                : [...perfil[lista], valor];
            pinta();
        });
        capa.querySelector('.np-crear').onclick = crear;
        nombre.onkeydown = (e) => { if (e.key === 'Enter') crear(); };
        setTimeout(() => nombre.focus(), 20);
    };

    // Guarda lo escrito antes de volver a dibujar la caja (se redibuja al
    // cambiar de modo, al plegar el perfil y al encender un chip).
    function leerCampos() {
        nombreEscrito = capa.querySelector('#np-nombre')?.value ?? nombreEscrito;
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
        const nombre = nombreEscrito.trim();
        const conPerfil = perfilConDatos() ? { perfil } : {};
        // Con plantilla el proyecto viene armado de antemano, así que el perfil
        // hay que METERLO ahí: si no, quien llenara el brief y además eligiera
        // una plantilla perdería lo escrito (createProject usa el cfg tal cual).
        const cfg = plantilla ? cfgDePlantilla(plantilla, nombre) : null;
        if (cfg && conPerfil.perfil) cfg.perfil = { ...cfg.perfil, ...perfil };
        cerrar();
        onCreate({
            ...conPerfil,
            name: nombre || plantilla?.nombre || `Proyecto ${new Date().toLocaleDateString('es-MX')}`,
            modo: plantilla ? 'live' : modo,
            // Sin plantilla el proyecto nace VACÍO: sin cámaras, sin talentos,
            // sin equipo y sin escaleta (2026-08-28, a petición del usuario).
            // Todo se agrega dentro, que es donde se ve lo que se está armando.
            // Con plantilla de set, en cambio, el proyecto nace ya armado.
            template: plantilla?.kind || 'vacio',
            ...(cfg ? { cfg } : {}),
        });
    }

    function abrir(opciones = {}) {
        if (abierto) return;
        abierto = true;
        capa.hidden = false;
        modo = 'live';
        verPerfil = false;
        perfil = perfilVacio();
        nombreEscrito = '';
        plantilla = opciones.plantilla || null;
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

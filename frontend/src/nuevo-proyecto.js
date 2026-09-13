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

const MODOS = [
    {
        id: 'live',
        titulo: 'En vivo',
        desc: 'Reloj continuo: bloques, señales al aire y rundown técnico.',
        ejemplo: 'Noticiero, entrevista, podcast, evento.',
        icono: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3.2"/>
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
        </svg>`,
    },
    {
        id: 'narrative',
        titulo: 'Narrativo',
        desc: 'Por escenas y planos; se graba fuera de orden y se monta después.',
        ejemplo: 'Ficción, videoclip, documental, publicidad.',
        icono: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4.5" width="18" height="15" rx="3"/>
            <path d="M3 9h18M8 4.5l2 4.5M14 4.5l2 4.5"/>
        </svg>`,
    },
];

import { INTENCIONES, MEDIOS, perfilVacio } from './templates.js';
import { cfgDePlantilla } from './plantillas.js';
import { esc } from './constants.js';
import { UIComponentFactory } from './ui_component_factory.js';

export function createNuevoProyecto({ onCreate }) {
    let abierto = false;
    let modo = 'live';
    let verPerfil = false;          // el bloque del perfil arranca plegado
    let perfil = perfilVacio();
    // Plantilla de set elegida en la galería de Inicio, si vino de ahí. Con
    // plantilla ya no hay nada que decidir sobre el modo (todas son en vivo):
    // la caja solo pregunta el nombre.
    let plantilla = null;
    let nombreEscrito = '';
    const capa = document.createElement('div');
    capa.className = 'np-overlay';
    capa.hidden = true;
    document.body.appendChild(capa);

    const pinta = () => {
        const titleText = plantilla ? 'Proyecto desde plantilla' : 'Nuevo proyecto';
        const subtitleText = plantilla
            ? `Se arma un set de ${esc(plantilla.nombre)} ya puesto: ${esc(plantilla.resumen.toLowerCase())}. Todo se puede mover y cambiar dentro.`
            : 'Solo esto para empezar. Lo demás lo armas dentro y puedes cambiarlo cuando quieras.';

        const prevScrollTop = capa.querySelector('.np-body')?.scrollTop ?? 0;

        const headerHtml = UIComponentFactory.createSheetHeader({
            title: titleText,
            subtitle: subtitleText,
        });

        const modeCardsHtml = plantilla ? '' : `
            <label class="np-label">¿Cómo se produce?</label>
            <div class="np-modos" role="radiogroup" aria-label="Modalidad de producción">
              ${MODOS.map((m) => UIComponentFactory.createModeCard({
                  modeId: m.id,
                  isSelected: m.id === modo,
                  title: m.titulo,
                  desc: m.desc,
                  example: m.ejemplo,
                  iconSvg: m.icono,
              })).join('')}
            </div>`;

        const disclosureHtml = UIComponentFactory.createDisclosureButton({
            isExpanded: verPerfil,
            title: 'El perfil del proyecto',
            hint: '· opcional, se puede llenar después',
        });

        const intencionesChipsHtml = UIComponentFactory.createChipGroup({
            groupName: 'intencion',
            items: INTENCIONES,
            selectedValues: perfil.intencion || [],
        });

        const mediosChipsHtml = UIComponentFactory.createChipGroup({
            groupName: 'medios',
            items: MEDIOS,
            selectedValues: perfil.medios || [],
        });

        const footerHtml = UIComponentFactory.createSheetFooter({
            cancelLabel: 'Cancelar',
            confirmLabel: plantilla ? 'Crear con esta plantilla' : 'Crear y empezar',
            shortcutHint: '⌘↵',
        });

        capa.innerHTML = `
          <div class="np-card" role="dialog" aria-modal="true" aria-labelledby="np-titulo">
            ${headerHtml}
            <div class="np-body">
              <label class="np-label" for="np-nombre">¿Cómo se llama?</label>
              <input id="np-nombre" class="np-input" type="text" placeholder="${plantilla ? esc(plantilla.nombre) : 'Noticiero de la FCC'}" autocomplete="off">
              ${modeCardsHtml}
              ${disclosureHtml}
              ${verPerfil ? `
              <div class="np-extra">
                <label class="np-label" for="np-mensaje">Mensaje — la idea en una frase</label>
                <input id="np-mensaje" class="np-input" type="text" data-campo="mensaje"
                  placeholder="Si tu proyecto solo pudiera decir una cosa, ¿cuál sería?" value="${esc(perfil.mensaje)}">
                <label class="np-label">Intención — qué quieres que pase en quien lo vea</label>
                ${intencionesChipsHtml}
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
                ${mediosChipsHtml}
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
            </div>
            ${footerHtml}
          </div>`;

        const bodyEl = capa.querySelector('.np-body');
        if (bodyEl && prevScrollTop) {
            bodyEl.scrollTop = prevScrollTop;
        }

        const nombre = capa.querySelector('#np-nombre');
        if (nombre) {
            nombre.value = nombreEscrito;
            nombre.onkeydown = (e) => {
                if (e.key === 'Enter') crear();
                if (e.key === 'Escape') cerrar();
            };
        }

        capa.querySelectorAll('[data-modo]').forEach((b) => {
            b.onmousedown = (e) => e.preventDefault();
            b.onclick = () => {
                modo = b.dataset.modo;
                capa.querySelectorAll('[data-modo]').forEach((otro) => {
                    const puesto = otro.dataset.modo === modo;
                    otro.classList.toggle('selected', puesto);
                    otro.setAttribute('aria-checked', puesto ? 'true' : 'false');
                });
            };
        });

        capa.querySelector('.np-mas')?.addEventListener('click', () => {
            leerCampos();
            verPerfil = !verPerfil;
            pinta();
        });

        capa.querySelectorAll('.np-chip').forEach((b) => {
            b.onclick = (e) => {
                e.preventDefault();
                const lista = b.dataset.lista || b.closest('[data-lista]')?.dataset.lista;
                if (!lista || !Array.isArray(perfil[lista])) return;
                const valor = b.dataset.valor;
                const idx = perfil[lista].indexOf(valor);
                const isActive = idx === -1;
                if (isActive) {
                    perfil[lista].push(valor);
                } else {
                    perfil[lista].splice(idx, 1);
                }
                b.classList.toggle('on', isActive);
                b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                b.blur();
            };
        });

        capa.querySelector('.np-cancel-btn')?.addEventListener('click', cerrar);
        capa.querySelector('.np-crear')?.addEventListener('click', crear);
        if (!verPerfil) {
            setTimeout(() => nombre?.focus(), 20);
        }
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

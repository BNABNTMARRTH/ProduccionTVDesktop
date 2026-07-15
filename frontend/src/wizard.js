// Wizard ÚNICO de Inicio: reúne en un solo flujo el selector de modo y los
// pasos del asistente correspondiente (narrativo o de programa en vivo), con
// los datos (nombre, cámaras, locación) integrados como pasos. Al terminar,
// genera el proyecto COMPLETO con la MISMA lógica pura que usan los asistentes
// del generador (construirProyectoNarrativo / construirEscaletaEnVivo), y lo
// abre en la escaleta/rundown. No hay un segundo asistente aparte.
import { narrativeCatalog, CREW_CATALOG, DEFAULT_CREW, makeTemplate } from './templates.js';
import { esc } from './constants.js';
import { EMOCIONES, ESTRUCTURAS, loglineDe, construirProyectoNarrativo } from '../../web-sources/generador-tv/src/narrativa.js';
import { TIPOS_PROGRAMA, construirEscaletaEnVivo } from '../../web-sources/generador-tv/src/envivo.js';

// Plantilla técnica base para cada tipo de programa en vivo (cámaras y fuentes
// como VTR/gráficos/comercial ya vienen incluidas).
const LIVE_BASE = { noticiero: 'noticiero', entrevista: 'entrevista', podcast: 'podcast', revista: 'noticiero', evento: 'multicamara' };

const STEP_TITLES = {
    modo: '¿Cómo se realizará tu producción?',
    programa: 'Tu programa en vivo',
    tipo: '¿Qué tipo de historia?',
    identidad: '¿Cómo se llama tu producción?',
    tecnica: 'Cámaras y locación',
    intencion: 'Mensaje e intención',
    premisa: 'La premisa de tu historia',
    personajes: 'Tus personajes',
    estructura: 'Estructura y duración',
    escenas: 'Tus escenas',
    generar: 'Todo listo — genera tu proyecto',
};
const STEP_HINTS = {
    modo: '¿Reloj continuo (bloques y señales al aire) o por escenas y planos? Podrás afinar todo después.',
    programa: 'Elige el formato; el asistente arma la escaleta editorial por bloques.',
    tipo: 'El tipo define cómo se cuenta y qué recomienda el asistente.',
    identidad: 'Estos datos aparecen en la infografía y en los exportados.',
    tecnica: 'Cuántas cámaras y dónde graban. Quienes salen a cuadro se definen como personajes.',
    intencion: 'Antes del cómo, el porqué: qué quieres decir y qué debe sentir el público.',
    premisa: 'Una frase arma el conflicto central; de aquí sale tu logline.',
    personajes: 'Cada personaje se vuelve talento del proyecto (micrófono y personal automáticos).',
    estructura: 'La estructura reparte tu historia en beats; la duración define el ritmo.',
    escenas: 'Ajusta el título, el lugar y qué cambia en cada escena. Lo técnico (planos, sonido) se afina después.',
    generar: 'Revisa el resumen; todo es editable después.',
};

const freshAnswers = () => ({
    modo: '',
    // identidad
    name: '', company: '', color: '#16365F', logoDataUrl: '',
    // técnica
    cams: 2, location: 'int', crew: [...DEFAULT_CREW], includeCamOps: true,
    // programa en vivo
    tipoPrograma: '', enVivo: true,
    // narrativo
    narrativeTipo: '', mensaje: '', emocion: '', audiencia: '', tono: '',
    premisa: { quien: '', quiere: '', obstaculo: '', accion: '', limite: '' },
    personajes: [{ nombre: '', quiere: '', cambio: '' }],
    estructura: 'tresactos', escenas: null,
    durMin: 30,
});

// Secuencia de pasos según el modo elegido.
const stepsFor = (modo) => {
    if (modo === 'live') return ['modo', 'programa', 'tecnica', 'generar'];
    if (modo === 'narrative') return ['modo', 'tipo', 'identidad', 'tecnica', 'intencion', 'premisa', 'personajes', 'estructura', 'escenas', 'generar'];
    return ['modo'];
};

// Objeto narrativo `n` a partir de las respuestas (para logline y generación).
const narrativaDe = (a) => ({
    tipo: a.narrativeTipo, mensaje: a.mensaje, emocion: a.emocion, audiencia: a.audiencia, tono: a.tono,
    premisa: a.premisa, personajes: a.personajes.filter((p) => (p.nombre || '').trim()),
    estructura: a.estructura, durMin: a.durMin, escenas: a.escenas,
});

export function createWizard({ onCreate }) {
    let answers = freshAnswers();
    let step = 0;
    let overlay = null;
    const STEPS = () => stepsFor(answers.modo);

    const close = () => { overlay?.remove(); overlay = null; };

    const open = () => {
        if (overlay) return;
        answers = freshAnswers();
        step = 0;
        overlay = document.createElement('div');
        overlay.className = 'wizard-overlay';
        overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
        overlay.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.target.tagName === 'BUTTON' || event.target.tagName === 'TEXTAREA') return;
            event.preventDefault();
            (overlay.querySelector('#wz-next:not([disabled])') || overlay.querySelector('#wz-create'))?.click();
        });
        document.body.appendChild(overlay);
        render();
    };

    // Base técnica (cfg) desde makeTemplate con las respuestas del wizard.
    function profileTecnica() {
        return {
            modo: answers.modo, narrativeTipo: answers.narrativeTipo,
            cams: answers.cams, location: answers.location, crew: answers.crew, includeCamOps: answers.includeCamOps,
            projectName: answers.name, company: answers.company, color: answers.color, logoDataUrl: answers.logoDataUrl,
        };
    }
    // Proyecto COMPLETO (misma lógica pura que los asistentes del generador).
    function construirCfg() {
        if (answers.modo === 'live') {
            const base = makeTemplate(LIVE_BASE[answers.tipoPrograma] || 'streaming', profileTecnica());
            return construirEscaletaEnVivo(base, { tipoPrograma: answers.tipoPrograma, durMin: answers.durMin, enVivo: answers.enVivo, nombre: answers.name });
        }
        const base = makeTemplate('vacio', profileTecnica());
        return construirProyectoNarrativo(base, narrativaDe(answers));
    }

    /* ------------------------- Render por paso ------------------------- */

    const lbl = (t, inner) => `<label>${t}${inner}</label>`;
    const input = (id, val, ph = '', type = 'text') => `<input id="${id}" type="${type}" value="${esc(val)}" placeholder="${esc(ph)}">`;

    const stepBody = {
        modo: () => `
            <div class="wizard-mode-grid">
              <button class="wizard-mode ${answers.modo === 'live' ? 'selected' : ''}" data-modo="live">
                <span class="wizard-mode-ico">🔴</span>
                <strong>Programa en vivo / grabado como en vivo</strong>
                <small>Reloj continuo, controlado por bloques, segmentos, cámaras, micrófonos, gráficos, fuentes y señales al aire.</small>
                <em>Noticiero · Podcast multicámara · Talk show · Mesa · Entrevista de estudio · Evento · Streaming · Sesión musical</em>
              </button>
              <button class="wizard-mode ${answers.modo === 'narrative' ? 'selected' : ''}" data-modo="narrative">
                <span class="wizard-mode-ico">🎬</span>
                <strong>Producción narrativa</strong>
                <small>Se construye por secuencias, escenas y planos; normalmente se graba fuera de orden y se organiza después en el montaje.</small>
                <em>Película · Cortometraje · Videoclip · Documental · Publicidad · Stop motion · Institucional · Experimental</em>
              </button>
            </div>`,
        programa: () => `
            <div class="wizard-form">
              <label>Tipo de programa</label>
              <div class="wizard-type-grid">
                ${TIPOS_PROGRAMA.map((t) => `
                  <button class="wizard-type ${answers.tipoPrograma === t.id ? 'selected' : ''}" data-prog="${t.id}">
                    <span>${t.icono}</span><strong>${t.nombre}</strong><small>${t.detalle}</small>
                  </button>`).join('')}
              </div>
              ${lbl('Nombre del programa', input('wz-name', answers.name, 'Noticiero universitario'))}
              <div class="wizard-form-row">
                ${lbl('Duración objetivo (min)', input('wz-dur', answers.durMin, '', 'number'))}
                <label>Modalidad
                  <div class="wizard-segment">
                    <button data-envivo="1" class="${answers.enVivo ? 'selected' : ''}"><strong>EN VIVO</strong><small>Reloj continuo</small></button>
                    <button data-envivo="0" class="${!answers.enVivo ? 'selected' : ''}"><strong>GRABADO</strong><small>Como en vivo</small></button>
                  </div>
                </label>
              </div>
            </div>`,
        tipo: () => `
            <div class="wizard-type-grid">
              ${narrativeCatalog.map((t) => `
                <button class="wizard-type ${answers.narrativeTipo === t.id ? 'selected' : ''}" data-type="${t.id}">
                  <span>${t.icon}</span><strong>${t.name}</strong><small>${t.detail}</small>
                </button>`).join('')}
            </div>`,
        identidad: () => `
            <div class="wizard-form">
              ${lbl('Nombre de la producción', input('wz-name', answers.name, 'Ej. Cortometraje La carta'))}
              ${lbl('Productora / organización', input('wz-company', answers.company, 'ATJ Producciones'))}
              <div class="wizard-form-row">
                <label>Color principal<input id="wz-color" type="color" value="${esc(answers.color)}"></label>
                <label class="logo-input">Logotipo (opcional)<input id="wz-logo" type="file" accept="image/*">${answers.logoDataUrl ? '<small class="wizard-ok">✓ Logotipo cargado</small>' : ''}</label>
              </div>
            </div>`,
        tecnica: () => `
            <div class="wizard-form">
              <label>¿Cuántas cámaras necesitas?</label>
              <div class="wizard-stepper">
                <button data-cams="-1" ${answers.cams <= 0 ? 'disabled' : ''}>−</button>
                <strong>${answers.cams}</strong>
                <button data-cams="1" ${answers.cams >= 8 ? 'disabled' : ''}>＋</button>
                <small>${answers.cams === 0 ? 'Sin cámaras' : answers.cams === 1 ? 'A una cámara' : 'Multicámara'}</small>
              </div>
              <label>Locación</label>
              <div class="wizard-segment">
                <button data-loc="int" class="${answers.location === 'int' ? 'selected' : ''}"><strong>INT</strong><small>Estudio / interior</small></button>
                <button data-loc="ext" class="${answers.location === 'ext' ? 'selected' : ''}"><strong>EXT</strong><small>Exterior · mics inalámbricos</small></button>
                <button data-loc="mixta" class="${answers.location === 'mixta' ? 'selected' : ''}"><strong>MIXTA</strong><small>Interior y exterior</small></button>
              </div>
              <label>Personal de operación</label>
              <div class="wizard-crew">
                ${CREW_CATALOG.map((r) => `<button class="wizard-chip ${answers.crew.includes(r.id) ? 'selected' : ''}" data-crew="${r.id}">${r.rol}</button>`).join('')}
              </div>
              <label class="wizard-toggle"><input type="checkbox" id="wz-camops" ${answers.includeCamOps ? 'checked' : ''}> Incluir un(a) operador(a) por cámara</label>
            </div>`,
        intencion: () => `
            <div class="wizard-form">
              ${lbl('¿Cuál es el mensaje o la idea central?', input('wz-mensaje', answers.mensaje, 'Qué quieres que el público piense o sienta'))}
              <div class="wizard-form-row">
                <label>Emoción principal
                  <select id="wz-emocion"><option value="">—</option>${EMOCIONES.map((e) => `<option value="${e}" ${answers.emocion === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
                </label>
                ${lbl('Tono', input('wz-tono', answers.tono, 'Íntimo, épico, irónico…'))}
              </div>
              ${lbl('¿Para quién es? (audiencia)', input('wz-audiencia', answers.audiencia, 'A quién le hablas'))}
            </div>`,
        premisa: () => `
            <div class="wizard-form">
              ${lbl('¿Quién es el protagonista?', input('wz-p-quien', answers.premisa.quien, 'Ej. Ana'))}
              ${lbl('¿Qué quiere?', input('wz-p-quiere', answers.premisa.quiere, 'Su objetivo'))}
              ${lbl('¿Qué se lo impide?', input('wz-p-obstaculo', answers.premisa.obstaculo, 'El obstáculo / conflicto'))}
              <div class="wizard-form-row">
                ${lbl('¿Qué hace? (acción)', input('wz-p-accion', answers.premisa.accion, 'La decisión que toma'))}
                ${lbl('¿Antes de qué? (límite)', input('wz-p-limite', answers.premisa.limite, 'El reloj de la historia'))}
              </div>
              <p class="wizard-logline">${esc(loglineDe(narrativaDe(answers)) || 'Completa la premisa y aquí aparece tu logline.')}</p>
            </div>`,
        personajes: () => `
            <div class="wizard-form">
              ${answers.personajes.map((p, i) => `
                <div class="wizard-person">
                  ${input(`wz-pn-${i}`, p.nombre, `Personaje ${i + 1}`)}
                  ${input(`wz-pq-${i}`, p.quiere, 'Qué quiere')}
                  ${input(`wz-pc-${i}`, p.cambio, 'Cómo cambia')}
                  ${answers.personajes.length > 1 ? `<button class="wizard-delp" data-delp="${i}" title="Quitar">×</button>` : '<span></span>'}
                </div>`).join('')}
              <button id="wz-addp" class="wizard-add">＋ Agregar personaje</button>
            </div>`,
        estructura: () => `
            <div class="wizard-form">
              ${lbl('Duración objetivo (min)', input('wz-dur', answers.durMin, '', 'number'))}
              <label>Estructura narrativa</label>
              <div class="wizard-type-grid">
                ${Object.entries(ESTRUCTURAS).map(([id, e]) => `
                  <button class="wizard-type ${answers.estructura === id ? 'selected' : ''}" data-estr="${id}">
                    <strong>${e.nombre}</strong><small>${e.detalle}</small>
                  </button>`).join('')}
              </div>
            </div>`,
        escenas: () => `
            <div class="wizard-form wizard-scenes">
              ${(answers.escenas || []).map((e, i) => `
                <div class="wizard-scene">
                  <span class="wizard-scene-n">${i + 1}</span>
                  ${input(`wz-st-${i}`, e.titulo || '', 'Título de la escena')}
                  ${input(`wz-sl-${i}`, e.lugar || '', 'INT/EXT · lugar · día/noche')}
                  ${input(`wz-sc-${i}`, e.cambio || '', '¿Qué cambia?')}
                </div>`).join('')}
            </div>`,
        generar: () => {
            const cfg = construirCfg();
            const row = (label, value) => `<div class="wizard-summary-row"><span>${label}</span><strong>${value}</strong></div>`;
            const tipoNombre = answers.modo === 'live'
                ? (TIPOS_PROGRAMA.find((t) => t.id === answers.tipoPrograma)?.nombre || 'Programa')
                : (narrativeCatalog.find((t) => t.id === answers.narrativeTipo)?.name || 'Producción narrativa');
            const escaleta = cfg.escaleta || [];
            const totalSeg = escaleta.reduce((n, s) => n + (s.dur || 0), 0);
            const mmss = `${Math.floor(totalSeg / 60)}:${String(Math.round(totalSeg % 60)).padStart(2, '0')}`;
            return `
            <div class="wizard-summary">
              ${row('Modo', answers.modo === 'live' ? '🔴 Programa en vivo' : '🎬 Producción narrativa')}
              ${row('Formato', esc(tipoNombre))}
              ${row('Nombre', esc((answers.name || '').trim()) || '<em>Se asignará automáticamente</em>')}
              ${row('Cámaras', `${answers.cams}`)}
              ${row(answers.modo === 'live' ? 'Segmentos' : 'Escenas', `${escaleta.length} · ${mmss}`)}
            </div>
            ${cfg.narrativa?.logline ? `<p class="wizard-logline">${esc(cfg.narrativa.logline)}</p>` : ''}
            <div class="wizard-preview">
              ${escaleta.slice(0, 12).map((s, i) => `<div class="wizard-preview-row"><b>${i + 1}</b> <span>${esc(s.segmento || '')}</span></div>`).join('')}
              ${escaleta.length > 12 ? `<div class="wizard-preview-row"><em>…y ${escaleta.length - 12} más</em></div>` : ''}
            </div>`;
        },
    };

    function nextBloqueado(key) {
        if (key === 'modo') return !answers.modo;
        if (key === 'programa') return !answers.tipoPrograma;
        if (key === 'tipo') return !answers.narrativeTipo;
        return false;
    }

    function render() {
        const steps = STEPS();
        const key = steps[step];
        const last = step === steps.length - 1;
        overlay.innerHTML = `
          <div class="wizard-card" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
            <button class="wizard-skip" id="wz-skip">Ir a mis proyectos ✕</button>
            <span class="eyebrow">ASISTENTE DE PRODUCCIÓN · PASO ${step + 1} DE ${steps.length}</span>
            <div class="wizard-progress">${steps.map((s, i) => `<i class="${i <= step ? 'done' : ''}"></i>`).join('')}</div>
            <h1 id="wizard-title">${STEP_TITLES[key]}</h1>
            <p class="wizard-hint">${STEP_HINTS[key]}</p>
            <div class="wizard-body">${stepBody[key]()}</div>
            <div class="wizard-nav">
              ${step > 0 ? '<button id="wz-back">← Atrás</button>' : '<span></span>'}
              ${last
                ? '<button id="wz-create" class="wizard-primary">Crear proyecto ✦</button>'
                : `<button id="wz-next" class="wizard-primary" ${nextBloqueado(key) ? 'disabled' : ''}>Siguiente →</button>`}
            </div>
          </div>`;
        bind(key, last);
        overlay.querySelector('.wizard-body input:not([type=file]):not([type=color]), .wizard-body select')?.focus();
    }

    /* ------------------------- Recolectar inputs ------------------------- */

    function val(id) { return overlay.querySelector(`#${id}`)?.value; }
    function collectInputs(key) {
        const set = (id, target, field) => { const v = val(id); if (v != null) target[field] = v; };
        if (key === 'programa') { set('wz-name', answers, 'name'); const d = Number(val('wz-dur')); if (Number.isFinite(d)) answers.durMin = Math.max(1, d); }
        if (key === 'identidad') { set('wz-name', answers, 'name'); set('wz-company', answers, 'company'); set('wz-color', answers, 'color'); }
        if (key === 'intencion') { set('wz-mensaje', answers, 'mensaje'); set('wz-emocion', answers, 'emocion'); set('wz-tono', answers, 'tono'); set('wz-audiencia', answers, 'audiencia'); }
        if (key === 'premisa') {
            set('wz-p-quien', answers.premisa, 'quien'); set('wz-p-quiere', answers.premisa, 'quiere');
            set('wz-p-obstaculo', answers.premisa, 'obstaculo'); set('wz-p-accion', answers.premisa, 'accion'); set('wz-p-limite', answers.premisa, 'limite');
        }
        if (key === 'personajes') answers.personajes.forEach((p, i) => { set(`wz-pn-${i}`, p, 'nombre'); set(`wz-pq-${i}`, p, 'quiere'); set(`wz-pc-${i}`, p, 'cambio'); });
        if (key === 'estructura') { const d = Number(val('wz-dur')); if (Number.isFinite(d)) answers.durMin = Math.max(1, d); }
        if (key === 'escenas') (answers.escenas || []).forEach((e, i) => { set(`wz-st-${i}`, e, 'titulo'); set(`wz-sl-${i}`, e, 'lugar'); set(`wz-sc-${i}`, e, 'cambio'); });
    }

    // Al pasar de Estructura a Escenas, siembra una ficha por beat (conserva lo escrito).
    function sembrarEscenas() {
        const beats = (ESTRUCTURAS[answers.estructura] || ESTRUCTURAS.tresactos).beats;
        answers.escenas = beats.map((b, i) => ({ ...(answers.escenas?.[i] || {}), titulo: answers.escenas?.[i]?.titulo || b[0] }));
    }

    /* ------------------------- Eventos por paso ------------------------- */

    function bind(key, last) {
        overlay.querySelector('#wz-skip').onclick = close;
        const back = overlay.querySelector('#wz-back');
        if (back) back.onclick = () => { collectInputs(key); step -= 1; render(); };
        const next = overlay.querySelector('#wz-next');
        if (next) next.onclick = () => {
            collectInputs(key);
            if (key === 'estructura') sembrarEscenas();
            step += 1; render();
        };
        if (last) {
            overlay.querySelector('#wz-create').onclick = () => {
                collectInputs(key);
                const cfg = { ...construirCfg(), abrirEnEscaleta: true };
                const template = answers.modo === 'live' ? (LIVE_BASE[answers.tipoPrograma] || 'streaming') : 'vacio';
                close();
                onCreate({ name: answers.name.trim(), company: answers.company.trim(), template, modo: answers.modo, cfg });
            };
        }

        if (key === 'modo') {
            overlay.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => {
                answers.modo = b.dataset.modo;
                answers.durMin = answers.modo === 'live' ? 30 : 5;
                if (answers.modo === 'live') { answers.cams = Math.max(1, answers.cams); }
                step = 1; render();
            });
        }
        if (key === 'programa') {
            overlay.querySelectorAll('[data-prog]').forEach((b) => b.onclick = () => { collectInputs(key); answers.tipoPrograma = b.dataset.prog; if (!answers.name) answers.name = ''; render(); });
            overlay.querySelectorAll('[data-envivo]').forEach((b) => b.onclick = () => { collectInputs(key); answers.enVivo = b.dataset.envivo === '1'; render(); });
        }
        if (key === 'tipo') {
            overlay.querySelectorAll('[data-type]').forEach((b) => b.onclick = () => { answers.narrativeTipo = b.dataset.type; step += 1; render(); });
        }
        if (key === 'identidad') {
            const logo = overlay.querySelector('#wz-logo');
            logo.onchange = () => {
                const file = logo.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => { answers.logoDataUrl = String(reader.result || ''); collectInputs(key); render(); };
                reader.readAsDataURL(file);
            };
        }
        if (key === 'tecnica') {
            overlay.querySelectorAll('[data-cams]').forEach((b) => b.onclick = () => { answers.cams = Math.max(0, Math.min(8, answers.cams + Number(b.dataset.cams))); render(); });
            overlay.querySelectorAll('[data-loc]').forEach((b) => b.onclick = () => { answers.location = b.dataset.loc; render(); });
            overlay.querySelectorAll('[data-crew]').forEach((b) => b.onclick = () => {
                const id = b.dataset.crew;
                answers.crew = answers.crew.includes(id) ? answers.crew.filter((c) => c !== id) : [...answers.crew, id];
                render();
            });
            overlay.querySelector('#wz-camops').onchange = (e) => { answers.includeCamOps = e.target.checked; };
        }
        if (key === 'intencion') {
            overlay.querySelector('#wz-emocion').onchange = (e) => { answers.emocion = e.target.value; };
        }
        if (key === 'personajes') {
            overlay.querySelector('#wz-addp').onclick = () => { collectInputs(key); answers.personajes.push({ nombre: '', quiere: '', cambio: '' }); render(); };
            overlay.querySelectorAll('[data-delp]').forEach((b) => b.onclick = () => { collectInputs(key); answers.personajes.splice(Number(b.dataset.delp), 1); render(); });
        }
        if (key === 'estructura') {
            overlay.querySelectorAll('[data-estr]').forEach((b) => b.onclick = () => { collectInputs(key); answers.estructura = b.dataset.estr; render(); });
        }
    }

    return { open, close, isOpen: () => !!overlay };
}

// Asistente "¿Qué quieres producir hoy?": una serie de preguntas que arman
// el perfil del proyecto (plantilla, identidad, cámaras, locación y crew) y
// se lo entregan al shell. Quienes salen a cuadro se capturan una sola vez,
// como personajes del Asistente narrativo (que los vuelve talentos).
import { templateCatalog, narrativeCatalog, templateDefaults, CREW_CATALOG, DEFAULT_CREW } from './templates.js';
import { esc } from './constants.js';

const STEPS = ['modo', 'tipo', 'identidad', 'tecnica', 'resumen'];
const STEP_TITLES = {
    modo: '¿Cómo se realizará tu producción?',
    tipo: '¿Qué quieres producir hoy?',
    identidad: '¿Cómo se llama tu producción?',
    tecnica: 'Configuración técnica y crew',
    resumen: 'Tu plantilla está lista',
};
const STEP_HINTS = {
    modo: '¿Tu producción se realizará siguiendo un reloj continuo, o se grabará por escenas y planos? Podrás afinar todo después.',
    tipo: 'Elige el formato y el asistente preparará una base técnica a tu medida.',
    identidad: 'Estos datos aparecen en la infografía y en los exportados.',
    tecnica: 'Cámaras, locación y roles de operación. Quienes salen a cuadro se definen después, en el Asistente narrativo.',
    resumen: 'Revisa el resumen; todo se puede personalizar después.',
};

const freshAnswers = () => ({
    modo: '',
    narrativeTipo: '',
    template: '',
    name: '',
    company: '',
    color: '#16365F',
    logoDataUrl: '',
    cams: 2,
    location: 'int',
    talents: [],
    crew: [...DEFAULT_CREW],
    includeCamOps: true,
    narrativa: true,
});

export function createWizard({ onCreate }) {
    let answers = freshAnswers();
    let step = 0;
    let overlay = null;

    const close = () => { overlay?.remove(); overlay = null; };

    const open = (presetTemplate = null) => {
        if (overlay) return;
        answers = freshAnswers();
        step = 0;
        if (presetTemplate) {
            // Las plantillas de la pantalla de Inicio son de programa en vivo:
            // fijan el modo y saltan directo a la identidad.
            answers.modo = 'live';
            applyTemplate(presetTemplate);
            step = STEPS.indexOf('identidad');
        }
        overlay = document.createElement('div');
        overlay.className = 'wizard-overlay';
        overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
        // Enter avanza al siguiente paso (o crea el proyecto en el resumen),
        // salvo cuando el foco está en un botón (ahí Enter ya es "clic").
        overlay.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || event.target.tagName === 'BUTTON') return;
            event.preventDefault();
            (overlay.querySelector('#wz-next:not([disabled])') || overlay.querySelector('#wz-create'))?.click();
        });
        document.body.appendChild(overlay);
        render();
    };

    function applyTemplate(id) {
        const changed = answers.template !== id;
        answers.template = id;
        answers.cams = templateDefaults(id).cams;
        if (!changed) return;
        // Al cambiar de formato se parte de la base (sin acumular sugerencias
        // del formato anterior) y se aplican las del nuevo.
        answers.crew = [...DEFAULT_CREW];
        if (id === 'noticiero') answers.crew = [...DEFAULT_CREW, 'graficos'];
        if (id === 'streaming') answers.crew = [...DEFAULT_CREW, 'playback'];
        if (id === 'multicamara') answers.crew = [...DEFAULT_CREW, 'floor', 'productor'];
    }

    /* ------------------------- Render por paso ------------------------- */

    const stepBody = {
        modo: () => `
            <div class="wizard-mode-grid">
              <button class="wizard-mode ${answers.modo === 'live' ? 'selected' : ''}" data-modo="live">
                <span class="wizard-mode-ico">🔴</span>
                <strong>Programa en vivo / grabado como en vivo</strong>
                <small>Reloj continuo, controlado por bloques, segmentos, cámaras, micrófonos, gráficos, fuentes y señales al aire.</small>
                <em>Noticiero · Podcast multicámara · Talk show · Mesa de análisis · Entrevista de estudio · Evento · Streaming · Sesión musical</em>
              </button>
              <button class="wizard-mode ${answers.modo === 'narrative' ? 'selected' : ''}" data-modo="narrative">
                <span class="wizard-mode-ico">🎬</span>
                <strong>Producción narrativa</strong>
                <small>Se construye por secuencias, escenas y planos; normalmente se graba fuera de orden y se organiza después en el montaje.</small>
                <em>Película · Cortometraje · Videoclip · Documental · Publicidad · Stop motion · Institucional · Experimental</em>
              </button>
            </div>`,
        tipo: () => {
            const cat = answers.modo === 'narrative' ? narrativeCatalog : templateCatalog;
            const sel = answers.modo === 'narrative' ? answers.narrativeTipo : answers.template;
            return `
            <div class="wizard-type-grid">
              ${cat.map((t) => `
                <button class="wizard-type ${sel === t.id ? 'selected' : ''}" data-type="${t.id}">
                  <span>${t.icon}</span><strong>${t.name}</strong><small>${t.detail}</small>
                </button>`).join('')}
            </div>`;
        },
        identidad: () => `
            <div class="wizard-form">
              <label>Nombre de la producción<input id="wz-name" placeholder="Ej. Noticiero universitario" value="${esc(answers.name)}"></label>
              <label>Productora / organización<input id="wz-company" placeholder="ATJ Producciones" value="${esc(answers.company)}"></label>
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
                <small>${answers.cams === 0 ? 'Sin cámaras (solo fuentes)' : answers.cams === 1 ? 'Producción a una cámara' : `Multicámara con switcher`}</small>
              </div>
              <label>Locación</label>
              <div class="wizard-segment">
                <button data-loc="int" class="${answers.location === 'int' ? 'selected' : ''}"><strong>INT</strong><small>Estudio / interior</small></button>
                <button data-loc="ext" class="${answers.location === 'ext' ? 'selected' : ''}"><strong>EXT</strong><small>Exterior · mics inalámbricos</small></button>
                <button data-loc="mixta" class="${answers.location === 'mixta' ? 'selected' : ''}"><strong>MIXTA</strong><small>Interior y exterior</small></button>
              </div>
              <label>Personal de operación</label>
              <div class="wizard-crew">
                ${CREW_CATALOG.map((r) => `
                  <button class="wizard-chip ${answers.crew.includes(r.id) ? 'selected' : ''}" data-crew="${r.id}">${r.rol}</button>`).join('')}
              </div>
              <label class="wizard-toggle">
                <input type="checkbox" id="wz-camops" ${answers.includeCamOps ? 'checked' : ''}>
                Incluir un(a) operador(a) por cámara en el personal
              </label>
            </div>`,
        resumen: () => {
            const esNarr = answers.modo === 'narrative';
            const template = templateCatalog.find((t) => t.id === answers.template);
            const tipoNarr = narrativeCatalog.find((t) => t.id === answers.narrativeTipo);
            const formato = esNarr
                ? `${tipoNarr?.icon || '🎬'} ${esc(tipoNarr?.name || 'Producción narrativa')}`
                : `${template?.icon || '◆'} ${esc(template?.name || 'Proyecto')}`;
            const crew = answers.crew.map((id) => CREW_CATALOG.find((r) => r.id === id)?.rol).filter(Boolean);
            const locationLabel = { int: 'Interior (estudio)', ext: 'Exterior', mixta: 'Mixta' }[answers.location];
            const row = (label, value) => `<div class="wizard-summary-row"><span>${label}</span><strong>${value}</strong></div>`;
            return `
            <div class="wizard-summary">
              ${row('Modo', esNarr ? '🎬 Producción narrativa' : '🔴 Programa en vivo')}
              ${row('Formato', formato)}
              ${row('Nombre', esc(answers.name.trim()) || '<em>Se asignará automáticamente</em>')}
              ${row('Productora', esc(answers.company.trim()) || 'ATJ Producciones')}
              ${row('Cámaras', `${answers.cams}${answers.includeCamOps && answers.cams ? ' · con operadores' : ''}`)}
              ${row('Locación', locationLabel)}
              ${row('Talentos', '<em>Se definen como personajes en el Asistente narrativo</em>')}
              ${row('Crew', crew.join(' · ') || 'Básico')}
            </div>
            <label class="wizard-toggle">
              <input type="checkbox" id="wz-narrativa" ${answers.narrativa ? 'checked' : ''}>
              <span>Al crear, desarrollar la historia con el <strong>✦ Asistente narrativo</strong> (intención, premisa, escenas, imagen y sonido)</span>
            </label>`;
        },
    };

    function render() {
        const key = STEPS[step];
        const last = step === STEPS.length - 1;
        overlay.innerHTML = `
          <div class="wizard-card" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
            <button class="wizard-skip" id="wz-skip">Ir a mis proyectos ✕</button>
            <span class="eyebrow">ASISTENTE DE PRODUCCIÓN · PASO ${step + 1} DE ${STEPS.length}</span>
            <div class="wizard-progress">${STEPS.map((s, i) => `<i class="${i <= step ? 'done' : ''}"></i>`).join('')}</div>
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
        overlay.querySelector('.wizard-body input:not([type=file]):not([type=color])')?.focus();
    }

    // Un paso de elección obligatoria bloquea "Siguiente" hasta elegir.
    function nextBloqueado(key) {
        if (key === 'modo') return !answers.modo;
        if (key === 'tipo') return answers.modo === 'narrative' ? !answers.narrativeTipo : !answers.template;
        return false;
    }

    /* ------------------------- Eventos por paso ------------------------- */

    function collectInputs(key) {
        if (key === 'identidad') {
            answers.name = overlay.querySelector('#wz-name')?.value ?? answers.name;
            answers.company = overlay.querySelector('#wz-company')?.value ?? answers.company;
            answers.color = overlay.querySelector('#wz-color')?.value ?? answers.color;
        }
    }

    function bind(key, last) {
        overlay.querySelector('#wz-skip').onclick = close;
        const back = overlay.querySelector('#wz-back');
        if (back) back.onclick = () => { collectInputs(key); step -= 1; render(); };
        const next = overlay.querySelector('#wz-next');
        if (next) next.onclick = () => { collectInputs(key); step += 1; render(); };
        if (last) {
            overlay.querySelector('#wz-create').onclick = () => {
                const profile = {
                    modo: answers.modo || 'live',
                    narrativeTipo: answers.narrativeTipo,
                    template: answers.template || 'vacio',
                    name: answers.name.trim(),
                    company: answers.company.trim(),
                    color: answers.color,
                    logoDataUrl: answers.logoDataUrl,
                    cams: answers.cams,
                    location: answers.location,
                    talents: answers.talents.filter((t) => t.name.trim()),
                    crew: [...answers.crew],
                    includeCamOps: answers.includeCamOps,
                    abrirAsistente: answers.narrativa,
                };
                close();
                onCreate(profile);
            };
            const narr = overlay.querySelector('#wz-narrativa');
            if (narr) narr.onchange = (event) => { answers.narrativa = event.target.checked; };
        }

        if (key === 'modo') {
            overlay.querySelectorAll('[data-modo]').forEach((button) => button.onclick = () => {
                answers.modo = button.dataset.modo;
                // La narrativa se graba por escenas: al menos una cámara y el
                // Asistente narrativo activado por defecto.
                if (answers.modo === 'narrative') { answers.cams = Math.max(1, answers.cams); answers.narrativa = true; }
                step = STEPS.indexOf('tipo');
                render();
            });
        }
        if (key === 'tipo') {
            overlay.querySelectorAll('[data-type]').forEach((button) => button.onclick = () => {
                if (answers.modo === 'narrative') {
                    answers.narrativeTipo = button.dataset.type;
                    answers.template = 'vacio'; // base técnica mínima; la historia la arma el asistente
                } else {
                    applyTemplate(button.dataset.type);
                }
                step = STEPS.indexOf('identidad');
                render();
            });
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
            overlay.querySelectorAll('[data-cams]').forEach((button) => button.onclick = () => {
                answers.cams = Math.max(0, Math.min(8, answers.cams + Number(button.dataset.cams)));
                render();
            });
            overlay.querySelectorAll('[data-loc]').forEach((button) => button.onclick = () => {
                answers.location = button.dataset.loc;
                render();
            });
            overlay.querySelectorAll('[data-crew]').forEach((button) => button.onclick = () => {
                const id = button.dataset.crew;
                answers.crew = answers.crew.includes(id) ? answers.crew.filter((c) => c !== id) : [...answers.crew, id];
                render();
            });
            overlay.querySelector('#wz-camops').onchange = (event) => { answers.includeCamOps = event.target.checked; };
        }
    }

    return { open, close, isOpen: () => !!overlay };
}

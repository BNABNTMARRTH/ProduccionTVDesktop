// Asistente "¿Qué quieres producir hoy?": una serie de preguntas que arman
// el perfil del proyecto (plantilla, identidad, cámaras, locación, talentos,
// crew) y se lo entregan al shell para crear la plantilla base personalizable.
import { templateCatalog, templateDefaults, CREW_CATALOG, DEFAULT_CREW } from './templates.js';

const STEPS = ['tipo', 'identidad', 'tecnica', 'talentos', 'crew', 'resumen'];
const STEP_TITLES = {
    tipo: '¿Qué quieres producir hoy?',
    identidad: '¿Cómo se llama tu producción?',
    tecnica: 'Configuración técnica',
    talentos: '¿Quiénes salen a cuadro?',
    crew: 'Personal de operación',
    resumen: 'Tu plantilla está lista',
};
const STEP_HINTS = {
    tipo: 'Elige el formato y el asistente preparará una base técnica a tu medida.',
    identidad: 'Estos datos aparecen en la infografía y en los exportados.',
    tecnica: 'Cámaras y locación definen planos, conexiones y validaciones.',
    talentos: 'Cada talento recibe su micrófono y su lugar en el personal.',
    crew: 'Marca los roles que tendrás disponibles en esta producción.',
    resumen: 'Revisa el resumen; todo se puede personalizar después.',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const freshAnswers = () => ({
    template: '',
    name: '',
    company: '',
    color: '#16365F',
    logoDataUrl: '',
    cams: 2,
    location: 'int',
    talents: [{ name: '', tipo: 'conductor' }],
    crew: [...DEFAULT_CREW],
    includeCamOps: true,
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
            applyTemplate(presetTemplate);
            step = 1;
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
        answers.talents = [{ name: '', tipo: 'conductor' }];
        if (id === 'podcast' || id === 'entrevista') answers.talents = [{ name: '', tipo: 'conductor' }, { name: '', tipo: 'invitado' }];
        if (id === 'noticiero') answers.crew = [...DEFAULT_CREW, 'graficos'];
        if (id === 'streaming') answers.crew = [...DEFAULT_CREW, 'playback'];
        if (id === 'multicamara') answers.crew = [...DEFAULT_CREW, 'floor', 'productor'];
    }

    /* ------------------------- Render por paso ------------------------- */

    const stepBody = {
        tipo: () => `
            <div class="wizard-type-grid">
              ${templateCatalog.map((t) => `
                <button class="wizard-type ${answers.template === t.id ? 'selected' : ''}" data-type="${t.id}">
                  <span>${t.icon}</span><strong>${t.name}</strong><small>${t.detail}</small>
                </button>`).join('')}
            </div>`,
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
            </div>`,
        talentos: () => `
            <div class="wizard-talents">
              ${answers.talents.map((t, i) => `
                <div class="wizard-talent-row">
                  <input data-talent-name="${i}" placeholder="Nombre del talento" value="${esc(t.name)}">
                  <select data-talent-tipo="${i}">
                    <option value="conductor" ${t.tipo === 'conductor' ? 'selected' : ''}>Conductor(a)</option>
                    <option value="invitado" ${t.tipo === 'invitado' ? 'selected' : ''}>Invitado(a)</option>
                  </select>
                  <button data-talent-remove="${i}" title="Quitar">×</button>
                </div>`).join('')}
              <button class="wizard-add" id="wz-add-talent">＋ Agregar talento</button>
              <p class="wizard-note">Cada talento con nombre recibe su micrófono. Si lo dejas vacío, se usan los micrófonos de la plantilla.</p>
            </div>`,
        crew: () => `
            <div class="wizard-crew">
              ${CREW_CATALOG.map((r) => `
                <button class="wizard-chip ${answers.crew.includes(r.id) ? 'selected' : ''}" data-crew="${r.id}">${r.rol}</button>`).join('')}
            </div>
            <label class="wizard-toggle">
              <input type="checkbox" id="wz-camops" ${answers.includeCamOps ? 'checked' : ''}>
              Incluir un(a) operador(a) por cámara en el personal
            </label>`,
        resumen: () => {
            const template = templateCatalog.find((t) => t.id === answers.template);
            const talents = answers.talents.filter((t) => t.name.trim());
            const crew = answers.crew.map((id) => CREW_CATALOG.find((r) => r.id === id)?.rol).filter(Boolean);
            const locationLabel = { int: 'Interior (estudio)', ext: 'Exterior', mixta: 'Mixta' }[answers.location];
            const row = (label, value) => `<div class="wizard-summary-row"><span>${label}</span><strong>${value}</strong></div>`;
            return `
            <div class="wizard-summary">
              ${row('Formato', `${template?.icon || '◆'} ${esc(template?.name || 'Proyecto')}`)}
              ${row('Nombre', esc(answers.name.trim()) || '<em>Se asignará automáticamente</em>')}
              ${row('Productora', esc(answers.company.trim()) || 'ATJ Producciones')}
              ${row('Cámaras', `${answers.cams}${answers.includeCamOps && answers.cams ? ' · con operadores' : ''}`)}
              ${row('Locación', locationLabel)}
              ${row('Talentos', talents.length ? talents.map((t) => esc(t.name)).join(', ') : 'Micrófonos genéricos')}
              ${row('Crew', crew.join(' · ') || 'Básico')}
            </div>`;
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
                : `<button id="wz-next" class="wizard-primary" ${key === 'tipo' && !answers.template ? 'disabled' : ''}>Siguiente →</button>`}
            </div>
          </div>`;
        bind(key, last);
        overlay.querySelector('.wizard-body input:not([type=file]):not([type=color])')?.focus();
    }

    /* ------------------------- Eventos por paso ------------------------- */

    function collectInputs(key) {
        if (key === 'identidad') {
            answers.name = overlay.querySelector('#wz-name')?.value ?? answers.name;
            answers.company = overlay.querySelector('#wz-company')?.value ?? answers.company;
            answers.color = overlay.querySelector('#wz-color')?.value ?? answers.color;
        }
        if (key === 'talentos') {
            overlay.querySelectorAll('[data-talent-name]').forEach((input) => {
                answers.talents[Number(input.dataset.talentName)].name = input.value;
            });
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
                };
                close();
                onCreate(profile);
            };
        }

        if (key === 'tipo') {
            overlay.querySelectorAll('[data-type]').forEach((button) => button.onclick = () => {
                applyTemplate(button.dataset.type);
                step = 1;
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
        }
        if (key === 'talentos') {
            overlay.querySelector('#wz-add-talent').onclick = () => {
                collectInputs(key);
                answers.talents.push({ name: '', tipo: answers.talents.length ? 'invitado' : 'conductor' });
                render();
            };
            overlay.querySelectorAll('[data-talent-tipo]').forEach((select) => select.onchange = () => {
                answers.talents[Number(select.dataset.talentTipo)].tipo = select.value;
            });
            overlay.querySelectorAll('[data-talent-remove]').forEach((button) => button.onclick = () => {
                collectInputs(key);
                answers.talents.splice(Number(button.dataset.talentRemove), 1);
                render();
            });
        }
        if (key === 'crew') {
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

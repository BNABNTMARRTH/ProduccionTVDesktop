/**
 * TemplateViewStrategy implementa el patrón STRATEGY (GoF).
 * Permite intercambiar de forma transparente entre la vista Mosaico (cuadrícula visual)
 * y la vista Lista (catálogo técnico tipo Finder) para la galería de plantillas de set.
 */

import { esc } from './constants.js';

export class TemplateViewStrategy {
    /**
     * Renderiza la lista de plantillas con la estrategia correspondiente
     * @param {Array<Object>} templates
     * @param {Object} options
     * @param {TemplateCardBuilder} options.builder
     * @param {Function} options.cfgFn
     * @param {Function} options.thumbFn
     * @param {boolean} options.isDark
     * @returns {string} HTML generado
     */
    render(templates, options = {}) {
        throw new Error('El método render() debe ser implementado por la subclase de TemplateViewStrategy');
    }
}

/**
 * Estrategia de Cuadrícula Visual (Mosaico)
 * Prioriza el plano cenital técnico en gran formato con tarjetas Liquid Glass
 */
export class TemplateGridViewStrategy extends TemplateViewStrategy {
    render(templates, { builder, cfgFn, thumbFn, isDark = false } = {}) {
        if (!templates || templates.length === 0) {
            return `
            <div class="tpl-empty">
              <p>No se encontraron plantillas que coincidan con la búsqueda o categoría seleccionada.</p>
            </div>`;
        }

        const cards = templates.map((p) => {
            const cfg = cfgFn(p);
            const thumbSvg = thumbFn(cfg, p);
            return builder.buildCardDirect({ template: p, cfg, thumbSvg, isDark });
        }).join('');

        return `<div class="tpl-grid" id="tpl-grid">${cards}</div>`;
    }
}

/**
 * Estrategia de Lista Técnica (Catálogo tipo Finder)
 * Permite comparar especificaciones de set, cámaras, micrófonos e iluminación
 */
export class TemplateListViewStrategy extends TemplateViewStrategy {
    render(templates, { builder, cfgFn, thumbFn, isDark = false } = {}) {
        if (!templates || templates.length === 0) {
            return `
            <div class="tpl-empty">
              <p>No se encontraron plantillas que coincidan con la búsqueda o categoría seleccionada.</p>
            </div>`;
        }

        const rows = templates.map((p) => {
            const cfg = cfgFn(p);
            const thumbSvg = thumbFn(cfg, p);
            return builder.buildRowDirect({ template: p, cfg, thumbSvg, isDark });
        }).join('');

        return `
        <div class="tpl-table-wrap">
          <table class="tpl-table" role="table" aria-label="Catálogo técnico de plantillas">
            <thead>
              <tr>
                <th class="th-preview">Plano</th>
                <th class="th-name">Plantilla</th>
                <th class="th-cat">Categoría</th>
                <th class="th-desc">Descripción de Set</th>
                <th class="th-hardware">Equipamiento</th>
                <th class="th-loc">Locación</th>
                <th class="th-act">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>`;
    }
}

/**
 * Contexto que gestiona y delega en la estrategia activa de visualización de plantillas
 */
export class TemplateViewContext {
    constructor(strategy = new TemplateGridViewStrategy()) {
        this.strategy = strategy;
        this.currentMode = 'grid';
    }

    setStrategy(strategy, mode = 'grid') {
        this.strategy = strategy;
        this.currentMode = mode;
    }

    getMode() {
        return this.currentMode;
    }

    render(templates, options = {}) {
        return this.strategy.render(templates, options);
    }
}

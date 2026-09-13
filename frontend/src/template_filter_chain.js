/**
 * TemplateFilterChain implementa el patrón CHAIN OF RESPONSIBILITY (GoF).
 * Permite filtrar y clasificar plantillas de set por categoría, modo y búsqueda textual
 * de manera desacoplada y extensible.
 */

export class TemplateFilterHandler {
    constructor() {
        this.nextHandler = null;
    }

    setNext(handler) {
        this.nextHandler = handler;
        return handler;
    }

    handle(templates, criteria) {
        let filtered = this.process(templates, criteria);
        if (this.nextHandler) {
            return this.nextHandler.handle(filtered, criteria);
        }
        return filtered;
    }

    process(templates, _criteria) {
        return templates;
    }
}

/**
 * Filtro por categoría:
 * 'all'       -> todas las plantillas
 * 'multicam'  -> noticiero, evento, panel
 * 'dialogue'  -> podcast, entrevista, streaming
 * 'special'   -> croma, exterior
 */
export class TemplateCategoryFilterHandler extends TemplateFilterHandler {
    process(templates, criteria) {
        const category = criteria?.category || 'all';
        if (category === 'all') return templates;

        return templates.filter((t) => {
            const cat = t.category || this.inferCategory(t);
            return cat === category;
        });
    }

    inferCategory(t) {
        const id = t.id || '';
        if (['noticiero', 'evento', 'panel'].includes(id)) return 'multicam';
        if (['podcast', 'entrevista', 'streaming'].includes(id)) return 'dialogue';
        if (['croma', 'exterior'].includes(id)) return 'special';
        return 'all';
    }
}

/**
 * Filtro textual por nombre, resumen y descripción
 */
export class TemplateSearchFilterHandler extends TemplateFilterHandler {
    process(templates, criteria) {
        const query = (criteria?.query || '').trim().toLowerCase();
        if (!query) return templates;

        return templates.filter((t) => {
            const nom = (t.nombre || '').toLowerCase();
            const res = (t.resumen || '').toLowerCase();
            const det = (t.detalle || '').toLowerCase();
            return nom.includes(query) || res.includes(query) || det.includes(query);
        });
    }
}

/**
 * Cadena de filtrado por defecto (Chain of Responsibility)
 */
export function createTemplateFilterChain() {
    const categoryFilter = new TemplateCategoryFilterHandler();
    const searchFilter = new TemplateSearchFilterHandler();
    categoryFilter.setNext(searchFilter);
    return categoryFilter;
}

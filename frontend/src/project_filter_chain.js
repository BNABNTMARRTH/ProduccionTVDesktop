// Chain of Responsibility Pattern (GoF) para el filtrado, búsqueda y ordenamiento de proyectos.
// Permite encadenar criterios de búsqueda (texto, modo de producción, fechas)
// desacoplados de la lógica de presentación.

export class FilterHandler {
    constructor() {
        this.next = null;
    }

    setNext(handler) {
        this.next = handler;
        return handler;
    }

    handle(projects, context = {}) {
        const resultado = this.process(projects, context);
        if (this.next) {
            return this.next.handle(resultado, context);
        }
        return resultado;
    }

    process(projects) {
        return projects;
    }
}

export class TextSearchHandler extends FilterHandler {
    process(projects, context = {}) {
        const query = (context.query || '').trim().toLowerCase();
        if (!query) return projects;
        return projects.filter((p) => {
            const nombre = (p.name || '').toLowerCase();
            const titulo = (p.cfg?.titulo || '').toLowerCase();
            const mensaje = (p.cfg?.perfil?.mensaje || '').toLowerCase();
            return nombre.includes(query) || titulo.includes(query) || mensaje.includes(query);
        });
    }
}

export class ModeFilterHandler extends FilterHandler {
    process(projects, context = {}) {
        const mode = context.mode;
        if (!mode || mode === 'all') return projects;
        return projects.filter((p) => (p.cfg?.modo || 'live') === mode);
    }
}

export class ChronologicalSortHandler extends FilterHandler {
    process(projects) {
        return [...projects].sort((a, b) => {
            const fechaA = a.updatedAt || a.createdAt || '';
            const fechaB = b.updatedAt || b.createdAt || '';
            return fechaB.localeCompare(fechaA);
        });
    }
}

export class ProjectFilterChain {
    constructor() {
        this.head = new TextSearchHandler();
        this.head
            .setNext(new ModeFilterHandler())
            .setNext(new ChronologicalSortHandler());
    }

    execute(projects, context = {}) {
        if (!Array.isArray(projects)) return [];
        return this.head.handle(projects, context);
    }
}

export const defaultProjectFilter = new ProjectFilterChain();

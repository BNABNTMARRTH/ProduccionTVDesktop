// Mediator Pattern (GoF) mediante un Bus de Eventos global desacoplado.
// Permite coordinar componentes visuales, ventanas y herramientas sin acoplamiento directo.

export const SHELL_EVENTS = Object.freeze({
    PROJECT_LOADED: 'project:loaded',
    PROJECT_SAVED: 'project:saved',
    PROJECT_DELETED: 'project:deleted',
    VIEW_CHANGED: 'view:changed',
    STAGE_CHANGED: 'stage:changed',
    TAB_ACTIVATED: 'tab:activated',
    TAB_UNPINNED: 'tab:unpinned',
    TAB_REPINNED: 'tab:repinned',
    OVERFLOW_UPDATED: 'overflow:updated',
});

export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, handler) {
        if (!event || typeof handler !== 'function') return () => {};
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (!event || !this.listeners.has(event)) return;
        const set = this.listeners.get(event);
        set.delete(handler);
        if (set.size === 0) {
            this.listeners.delete(event);
        }
    }

    once(event, handler) {
        if (!event || typeof handler !== 'function') return () => {};
        const wrapper = (payload) => {
            this.off(event, wrapper);
            handler(payload);
        };
        return this.on(event, wrapper);
    }

    emit(event, payload) {
        if (!event || !this.listeners.has(event)) return;
        const set = this.listeners.get(event);
        for (const handler of Array.from(set)) {
            try {
                handler(payload);
            } catch (err) {
                console.error(`[EventBus] Error en listener para evento '${event}':`, err);
            }
        }
    }

    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

export const shellBus = new EventBus();

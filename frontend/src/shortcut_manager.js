// Command + Strategy Pattern (GoF) para el manejo declarativo de atajos de teclado.
// Procesa teclas tanto de la ventana anfitriona como reenviadas desde iframes.

export class ShortcutManager {
    constructor({ getContext = () => ({}) } = {}) {
        this.getContext = getContext;
        this.handlers = [];
        this._initDefaultHandlers();
    }

    _initDefaultHandlers() {
        // Esc: Salida contextual / descarte de capas
        this.register({
            id: 'escape',
            matches: (t) => t.key === 'Escape',
            execute: (t, ctx) => {
                if (ctx.isWelcomeOpen && ctx.closeWelcome) { ctx.closeWelcome(); return true; }
                if (ctx.isAjustesOpen && ctx.closeAjustes) { ctx.closeAjustes(); return true; }
                if (ctx.isNuevoProyectoOpen && ctx.closeNuevoProyecto) { ctx.closeNuevoProyecto(); return true; }
                if (ctx.desplegarRail) { ctx.desplegarRail(); }
                return false;
            },
        });

        // Ctrl+Tab / Ctrl+Shift+Tab: Rotación de pestañas
        this.register({
            id: 'rotate-tabs',
            matches: (t) => t.key === 'Tab' && t.ctrlKey,
            execute: (t, ctx) => {
                if (!ctx.pestanas || !ctx.pestanas.abiertas || !ctx.pestanas.abiertas.length) return false;
                const orden = [ctx.PRINCIPAL || 'principal', ...ctx.pestanas.abiertas];
                const i = orden.indexOf(ctx.pestanas.activa);
                const siguiente = orden[(i + (t.shiftKey ? -1 : 1) + orden.length) % orden.length];
                if (ctx.activarPestana) {
                    ctx.activarPestana(siguiente);
                    return true;
                }
                return false;
            },
        });

        // Cmd+S / Ctrl+S: Guardado inmediato
        this.register({
            id: 'save',
            matches: (t) => (t.metaKey || t.ctrlKey) && (t.key || '').toLowerCase() === 's',
            execute: (t, ctx) => {
                if (ctx.flushSaveNow) { ctx.flushSaveNow(); return true; }
                return false;
            },
        });

        // Cmd+D: Desanclar módulo en pestaña
        this.register({
            id: 'unpin',
            matches: (t) => (t.metaKey || t.ctrlKey) && (t.key || '').toLowerCase() === 'd',
            execute: (t, ctx) => {
                if (ctx.isProjectWindow && !ctx.isToolWindow && ctx.desanclar && ctx.vistaVisible) {
                    ctx.desanclar(ctx.vistaVisible());
                    return true;
                }
                return false;
            },
        });

        // Cmd+W: Cerrar pestaña o volver al proyecto desde ventana de módulo
        this.register({
            id: 'close-tab',
            matches: (t) => (t.metaKey || t.ctrlKey) && (t.key || '').toLowerCase() === 'w',
            execute: (t, ctx) => {
                if (ctx.isToolWindow && ctx.volverAlProyecto) {
                    ctx.volverAlProyecto();
                    return true;
                }
                if (ctx.pestanas && ctx.pestanas.activa !== (ctx.PRINCIPAL || 'principal') && ctx.reanclar) {
                    ctx.reanclar(ctx.pestanas.activa);
                    return true;
                }
                return false;
            },
        });

        // Cmd+Shift+H / Ctrl+Shift+H: Ir a Inicio
        this.register({
            id: 'goto-home',
            matches: (t) => (t.metaKey || t.ctrlKey) && t.shiftKey && (t.key || '').toLowerCase() === 'h',
            execute: (t, ctx) => {
                if (ctx.irAInicio) {
                    ctx.irAInicio();
                    return true;
                }
                return false;
            },
        });

        // Cmd+1 .. Cmd+6: Cambio de etapas
        this.register({
            id: 'goto-stage',
            matches: (t) => (t.metaKey || t.ctrlKey) && t.key >= '1' && t.key <= '6',
            execute: (t, ctx) => {
                if (ctx.isToolWindow) return false;
                const etapaIdx = Number(t.key) - 1;
                const etapa = ctx.etapas ? ctx.etapas[etapaIdx] : null;
                if (!etapa || !ctx.selectView) return false;
                const vista = (ctx.ultimaSeccion && ctx.ultimaSeccion[etapa.id]) || (ctx.primeraVista ? ctx.primeraVista(etapa) : null);
                if (vista) {
                    ctx.selectView(vista);
                    return true;
                }
                return false;
            },
        });
    }

    register(handler) {
        if (!handler || typeof handler.matches !== 'function' || typeof handler.execute !== 'function') return;
        this.handlers.push(handler);
    }

    dispatch(tecla) {
        if (!tecla || typeof tecla !== 'object') return false;
        const ctx = this.getContext() || {};
        for (const handler of this.handlers) {
            try {
                if (handler.matches(tecla)) {
                    const consumed = handler.execute(tecla, ctx);
                    if (consumed) return true;
                }
            } catch (err) {
                console.error(`[ShortcutManager] Error ejecutando atajo ${handler.id}:`, err);
            }
        }
        return false;
    }
}

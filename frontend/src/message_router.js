/**
 * MessageRouter implementa el patrón de diseño COMMAND / CHAIN OF RESPONSIBILITY
 * para desacoplar el procesamiento de los eventos postMessage provenientes
 * de las distintas herramientas que corren dentro de los iframes.
 */

export class MessageRouter {
    constructor() {
        this.handlers = new Map();
    }

    /**
     * Registra un manejador/comando para un tipo específico de mensaje.
     * @param {string} type Tipo de mensaje ('producciontv:save-file', etc.)
     * @param {Function} handler Función ejecutora (data, panel, context, event)
     */
    register(type, handler) {
        this.handlers.set(type, handler);
        return this;
    }

    /**
     * Despacha el mensaje entrante al manejador registrado correspondiente.
     * @param {MessageEvent} event
     * @param {Object} context Contexto con dependencias del shell
     * @returns {Promise<boolean>}
     */
    async dispatch(event, context) {
        const data = event.data;
        if (!data?.type) return false;

        const panel = context.panelDeVentana?.(event.source);
        if (!panel) return false;

        const handler = this.handlers.get(data.type);
        if (!handler) return false;

        await handler(data, panel, context, event);
        return true;
    }
}

/**
 * Crea e inicializa el router con todos los comandos estándar del shell.
 * @param {Object} bridge Métodos nativos de Wails / Go
 * @returns {MessageRouter}
 */
export function createShellMessageRouter(bridge) {
    const router = new MessageRouter();
    const { SaveTextFile, SaveBase64File, ListContacts, SaveContact, DeleteContact, ListReferences, SaveReference, LoadReferenceImage, DeleteReference } = bridge;

    // Atajos de teclado reenviados
    router.register('producciontv:atajo', (data, panel, ctx) => {
        ctx.atajoDelCaparazon?.(data.tecla || {});
    });

    // Impresión de documento multipágina
    router.register('producciontv:print-document', async (data, panel, ctx) => {
        if (panel.vista === 'exportar') ctx.marcaHito?.('exportado');
        await ctx.printDocumentHTML?.(data.html, data.css);
    });

    // Exportación de hojas a PNGs individuales
    router.register('producciontv:export-pngs', async (data, panel, ctx) => {
        try {
            if (panel.vista === 'exportar') ctx.marcaHito?.('exportado');
            const pages = [...(panel.el.contentDocument?.querySelectorAll('.export-page') || [])];
            if (!pages.length) throw new Error('No hay páginas para exportar.');
            let saved = 0;
            for (const page of pages) {
                const canvas = await ctx.captureElementPNG?.(page);
                const path = await SaveBase64File?.(`${page.dataset.name || 'seccion'}.png`, canvas.toDataURL('image/png'));
                if (!path) break;
                saved += 1;
            }
            ctx.showToast?.(saved ? `${saved} de ${pages.length} PNG exportados` : 'Exportación cancelada', !saved);
        } catch (error) {
            ctx.showToast?.(error?.message || 'No se pudieron exportar los PNG', true);
        }
    });

    // Solicitud de guardado inmediato
    router.register('producciontv:request-save', (data, panel, ctx) => {
        ctx.flushSaveNow?.();
    });

    // Guardado de archivo de texto con diálogo nativo
    router.register('producciontv:save-file', async (data, panel, ctx) => {
        try {
            if (panel.vista === 'exportar') ctx.marcaHito?.('exportado');
            if (await SaveTextFile?.(data.filename || 'archivo.txt', data.content || '')) {
                ctx.showToast?.('Archivo guardado');
            }
        } catch (error) {
            ctx.showToast?.(error?.message || 'No se pudo guardar el archivo', true);
        }
    });

    // Operaciones de Agenda (Contactos)
    router.register('producciontv:agenda', async (data, panel, ctx, event) => {
        const responder = (extra) => event.source?.postMessage(
            { type: 'producciontv:agenda-respuesta', folio: data.folio, ...extra }, '*');
        try {
            let datos = null;
            if (data.op === 'list') datos = await ListContacts?.();
            else if (data.op === 'save') await SaveContact?.(data.id || '', data.ficha || '');
            else if (data.op === 'delete') await DeleteContact?.(data.id || '');
            else throw new Error(`operación desconocida en la agenda: ${data.op}`);
            responder({ ok: true, datos });
        } catch (error) {
            responder({ ok: false, error: error?.message || 'No se pudo llegar a la agenda' });
        }
    });

    // Operaciones de Mesa de Luz (Fototeca de Referencias)
    router.register('producciontv:ref', async (data, panel, ctx, event) => {
        const responder = (extra) => event.source?.postMessage(
            { type: 'producciontv:ref-respuesta', folio: data.folio, ...extra }, '*');
        try {
            let datos = null;
            if (data.op === 'list') datos = await ListReferences?.();
            else if (data.op === 'save') await SaveReference?.(data.id || '', data.ficha || '', data.imagen || '');
            else if (data.op === 'image') datos = await LoadReferenceImage?.(data.id || '');
            else if (data.op === 'delete') await DeleteReference?.(data.id || '');
            else if (data.op === 'analizar') {
                const ojo = globalThis.go?.main?.App?.AnalizarImagen;
                datos = ojo ? await ojo(data.imagen || '') : null;
            } else {
                throw new Error(`operación desconocida en la mesa de luz: ${data.op}`);
            }
            responder({ ok: true, datos });
        } catch (error) {
            responder({ ok: false, error: error?.message || 'No se pudo llegar a la mesa de luz' });
        }
    });

    // Estado UI de la herramienta (Undo/Redo/Guía)
    router.register('producciontv:tool-ui', (data, panel, ctx) => {
        panel.ui = { canUndo: !!data.canUndo, canRedo: !!data.canRedo, guia: !!data.guia };
        if (panel === ctx.panelAlFrente?.()) ctx.pintarAccionesHerramienta?.();
    });

    // Sincronización de estado de Infografía
    router.register('producciontv:infografia-state', (data, panel, ctx) => {
        if (!panel.escucha) return;
        if (panel !== ctx.panelAlFrente?.()) return;

        const entrante = ctx.conHitos?.(data.cfg);
        const texto = JSON.stringify(entrante);
        if (texto === JSON.stringify(ctx.getLatestInfografia?.())) {
            panel.sello = ctx.getSelloEstado?.();
            return;
        }

        ctx.setLatestInfografia?.(entrante);
        localStorage.setItem(ctx.AUTOSAVE_KEY, texto);
        ctx.marcarCambio?.();
        panel.sello = ctx.getSelloEstado?.();

        ctx.getPaneles?.().forEach((otro, v) => {
            if (v === 'diagrama' && otro !== panel) {
                otro.el.contentWindow?.postMessage({ type: 'producciontv:sync-infografia', cfg: entrante }, '*');
            }
        });
        if (panel.vista === 'diagrama') {
            panel.el.contentWindow?.postMessage({ type: 'producciontv:sync-infografia', cfg: entrante }, '*');
        }
        ctx.scheduleSave?.();
    });

    // Sincronización de estado de Diagrama
    router.register('producciontv:diagram-state', (data, panel, ctx) => {
        if (!panel.escucha) return;
        const currentInfografia = ctx.getLatestInfografia?.();
        const syncedInfografia = ctx.infografiaFromDiagram?.(data.state, currentInfografia);
        const didSync = syncedInfografia !== currentInfografia;

        if (!didSync && JSON.stringify(data.state) === JSON.stringify(ctx.getLatestDiagram?.())) {
            panel.sello = ctx.getSelloEstado?.();
            return;
        }

        ctx.setLatestDiagram?.(data.state);
        ctx.setLatestInfografia?.(syncedInfografia);
        localStorage.setItem(ctx.DIAGRAM_KEY, JSON.stringify(data.state));
        if (didSync) {
            localStorage.setItem(ctx.AUTOSAVE_KEY, JSON.stringify(syncedInfografia));
            ctx.showToast?.('Infografías actualizadas desde el diagrama');
        }
        ctx.marcarCambio?.();
        panel.sello = ctx.getSelloEstado?.();
        ctx.scheduleSave?.();
    });

    return router;
}

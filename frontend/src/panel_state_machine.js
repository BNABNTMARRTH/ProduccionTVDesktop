/**
 * PATRÓN STATE (GoF - Gang of Four, Design Patterns 1994)
 * Gestión formal del ciclo de vida de los paneles y herramientas en iframe.
 * 
 * Resuelve de raíz cualquier flasheo o visualización de contenido previo (stale content),
 * garantizando que el iframe permanezca 100% oculto tras un escudo opaco sincronizado
 * con el tema activo hasta que el renderizado de la nueva vista esté completamente listo.
 */

const rAF = (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(cb, 0));

export class PanelState {
    /**
     * @param {PanelLifecycleManager} manager
     */
    constructor(manager) {
        this.mgr = manager;
    }

    nombre() {
        return this.constructor.name;
    }

    entrar() {}
    salir() {}
    alIniciarCarga(_src) {}
    alIniciarTransicion() {}
    alCargarIframe() {}
    alCompletarHidratacion() {}
    alDormir() {}
}

/**
 * Estado IDLE: Ninguna herramienta activa (p. ej. en Inicio / Lanzador de proyectos).
 * El iframe se mantiene en 'cargando' y se le envía señal de reposo para resetear cualquier
 * vista previa y dejarlo en un lienzo limpio.
 */
export class IdleState extends PanelState {
    entrar() {
        if (this.mgr.panelEl) {
            this.mgr.panelEl.classList.add('cargando');
            try {
                this.mgr.panelEl.contentWindow?.postMessage({ type: 'producciontv:dormir' }, '*');
            } catch {}
        }
        if (this.mgr.loadingEl) {
            this.mgr.loadingEl.classList.add('hidden');
        }
    }

    alIniciarCarga(src) {
        this.mgr.transicionarA(new LoadingState(this.mgr, src));
    }

    alIniciarTransicion() {
        this.mgr.transicionarA(new TransitioningState(this.mgr));
    }

    alCompletarHidratacion() {
        this.mgr.transicionarA(new ReadyState(this.mgr));
    }
}

/**
 * Estado TRANSITIONING: Cambio de vista o de proyecto dentro de un iframe ya cargado.
 * Activa de inmediato el escudo protector opaco y oculta el iframe antes de que
 * se descubra el contenedor, impidiendo que el usuario vea la vista anterior (p. ej. Set CAD).
 */
export class TransitioningState extends PanelState {
    entrar() {
        if (this.mgr.panelEl) {
            this.mgr.panelEl.classList.add('cargando');
        }
        if (this.mgr.loadingEl) {
            this.mgr.loadingEl.classList.remove('hidden');
        }
        this.timerSeguridad = setTimeout(() => {
            this.alCompletarHidratacion();
        }, 240);
    }

    salir() {
        clearTimeout(this.timerSeguridad);
    }

    alIniciarCarga(src) {
        clearTimeout(this.timerSeguridad);
        this.mgr.transicionarA(new LoadingState(this.mgr, src));
    }

    alCompletarHidratacion() {
        clearTimeout(this.timerSeguridad);
        // Doble rAF para esperar que React y WebKit pinten el nuevo DOM en GPU
        rAF(() => {
            rAF(() => {
                this.mgr.transicionarA(new ReadyState(this.mgr));
            });
        });
    }

    alDormir() {
        clearTimeout(this.timerSeguridad);
        this.mgr.transicionarA(new IdleState(this.mgr));
    }
}

/**
 * Estado LOADING: El iframe está navegando o cargando un nuevo documento HTML desde disco.
 * El escudo protector opaco (con el color de fondo exacto del tema activo) cubre 
 * completamente el área para evitar cualquier parpadeo o render de canvas vacío en WebKit.
 */
export class LoadingState extends PanelState {
    constructor(manager, src) {
        super(manager);
        this.src = src;
    }

    entrar() {
        if (this.mgr.panelEl) {
            this.mgr.panelEl.classList.add('cargando');
        }
        if (this.mgr.loadingEl) {
            this.mgr.loadingEl.classList.remove('hidden');
        }
        if (this.src && this.mgr.panelEl && this.mgr.panelEl.src !== this.src) {
            this.mgr.panelEl.src = this.src;
        }
    }

    alCargarIframe() {
        this.mgr.transicionarA(new HydratingState(this.mgr));
    }

    alDormir() {
        this.mgr.transicionarA(new IdleState(this.mgr));
    }
}

/**
 * Estado HYDRATING: El documento HTML del iframe ha disparado el evento `load`,
 * pero los datos del proyecto, tema y primer render aún se están sincronizando.
 * El escudo protector permanece opaco para ocultar el estado intermedio de React/DOM.
 */
export class HydratingState extends PanelState {
    entrar() {
        if (typeof this.mgr.alHidratar === 'function') {
            this.mgr.alHidratar();
        }

        this.timerSeguridad = setTimeout(() => {
            this.alCompletarHidratacion();
        }, 300);
    }

    salir() {
        clearTimeout(this.timerSeguridad);
    }

    alCompletarHidratacion() {
        clearTimeout(this.timerSeguridad);
        rAF(() => {
            rAF(() => {
                this.mgr.transicionarA(new ReadyState(this.mgr));
            });
        });
    }

    alDormir() {
        clearTimeout(this.timerSeguridad);
        this.mgr.transicionarA(new IdleState(this.mgr));
    }
}

/**
 * Estado READY: El documento está completamente hidratado y renderizado con el tema correcto.
 * Se desvanece suavemente el escudo de carga y el panel queda 100% interactivo.
 */
export class ReadyState extends PanelState {
    entrar() {
        rAF(() => {
            if (this.mgr.panelEl) {
                this.mgr.panelEl.classList.remove('cargando');
            }
            if (this.mgr.loadingEl) {
                this.mgr.loadingEl.classList.add('hidden');
            }
        });
    }

    alIniciarCarga(src) {
        this.mgr.transicionarA(new LoadingState(this.mgr, src));
    }

    alIniciarTransicion() {
        this.mgr.transicionarA(new TransitioningState(this.mgr));
    }

    alDormir() {
        this.mgr.transicionarA(new IdleState(this.mgr));
    }
}

/**
 * Contexto del Patrón State (GoF): Coordina las transiciones de estado del panel.
 */
export class PanelLifecycleManager {
    constructor({ panelEl, loadingEl, alHidratar }) {
        this.panelEl = panelEl;
        this.loadingEl = loadingEl;
        this.alHidratar = alHidratar;
        this.estadoActual = new IdleState(this);
        this.estadoActual.entrar();
    }

    transicionarA(nuevoEstado) {
        if (this.estadoActual) {
            this.estadoActual.salir();
        }
        this.estadoActual = nuevoEstado;
        this.estadoActual.entrar();
    }

    iniciarTransicion() {
        this.estadoActual.alIniciarTransicion();
    }

    despertar() {
        this.iniciarTransicion();
    }

    cargar(src) {
        this.estadoActual.alIniciarCarga(src);
    }

    notificarCargado() {
        this.estadoActual.alCargarIframe();
    }

    notificarListo() {
        this.estadoActual.alCompletarHidratacion();
    }

    dormir() {
        this.estadoActual.alDormir();
    }

    obtenerEstado() {
        return this.estadoActual.nombre();
    }
}

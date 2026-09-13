// Proxy Pattern (GoF) para la gestión e hidratación perezosa (Lazy Load) de herramientas en iframe.
// Encapsula el ciclo de vida del iframe, reduce la carga inicial y sincroniza
// los estados mediante sellos de versión para evitar sobreescrituras en caliente.

export class PanelProxy {
    constructor({
        id,
        src,
        className = 'panel',
        title = '',
        onLoad = null,
    } = {}) {
        this.id = id;
        this.src = src;
        this.className = className;
        this.title = title;
        this.onLoad = onLoad;
        this.el = null;
        this.sello = 0;
        this.esVista = false;
        this.isLoaded = false;
        this.ui = {};
    }

    ensureCreated(container) {
        if (this.el) return this.el;
        const iframe = document.createElement('iframe');
        iframe.className = this.className;
        iframe.src = this.src;
        if (this.title) iframe.title = this.title;
        iframe.dataset.panel = this.id;
        iframe.onload = () => {
            this.isLoaded = true;
            if (typeof this.onLoad === 'function') this.onLoad(this);
        };
        this.el = iframe;
        if (container) {
            container.appendChild(iframe);
        }
        return iframe;
    }

    show(container) {
        this.ensureCreated(container);
        if (this.el) {
            this.el.hidden = false;
        }
    }

    hide() {
        if (this.el) {
            this.el.hidden = true;
        }
    }

    needsUpdate(currentStamp) {
        return this.sello < currentStamp;
    }

    markUpdated(currentStamp) {
        this.sello = currentStamp;
    }

    postMessage(message, targetOrigin = '*') {
        if (this.el && this.el.contentWindow && this.isLoaded) {
            try {
                this.el.contentWindow.postMessage(message, targetOrigin);
                return true;
            } catch (err) {
                console.error(`[PanelProxy] Error enviando mensaje a ${this.id}:`, err);
            }
        }
        return false;
    }

    destroy() {
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
        this.isLoaded = false;
        this.ui = {};
    }
}

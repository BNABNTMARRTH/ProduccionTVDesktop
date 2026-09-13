// Observer Pattern (GoF) para el sistema de Notificaciones (Toast) y Diálogos.
// Centraliza las alertas, colas de mensajes y accesibilidad accesible (ARIA).

export class NotificationService {
    constructor({ container = null, defaultDuration = 2800 } = {}) {
        this.container = container;
        this.defaultDuration = defaultDuration;
        this.observers = new Set();
        this.timer = null;
        this.current = null;
    }

    subscribe(observer) {
        if (typeof observer === 'function') {
            this.observers.add(observer);
            return () => this.observers.delete(observer);
        }
        return () => {};
    }

    notify(data) {
        this.observers.forEach((observer) => {
            try { observer(data); } catch (e) { console.error('[NotificationService]', e); }
        });
    }

    show(message, { error = false, duration = this.defaultDuration } = {}) {
        if (!message) return;
        this.current = { message, error, timestamp: Date.now() };

        if (this.container) {
            this.container.textContent = message;
            this.container.classList.toggle('error', !!error);
            this.container.classList.add('show');
            this.container.setAttribute('role', error ? 'alert' : 'status');
            this.container.setAttribute('aria-live', error ? 'assertive' : 'polite');

            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.dismiss();
            }, duration);
        }

        this.notify({ type: 'toast', message, error, duration });
    }

    dismiss() {
        if (this.container) {
            this.container.classList.remove('show');
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.current = null;
        this.notify({ type: 'dismiss' });
    }
}

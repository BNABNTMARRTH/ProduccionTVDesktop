/**
 * @file theme_manager.js
 * @description GoF Strategy & Observer Patterns para la gestión y sincronización
 * del tema de la aplicación (Sistema, Modo Claro, Modo Oscuro).
 */

/**
 * Interfaz base para las estrategias de resolución de tema (GoF Strategy).
 */
export class ThemeStrategy {
    /**
     * @returns {'claro' | 'oscuro'}
     */
    resolveTheme() {
        throw new Error('resolveTheme() debe ser implementado por la subclase');
    }

    /**
     * @returns {'' | 'claro' | 'oscuro'}
     */
    getId() {
        throw new Error('getId() debe ser implementado por la subclase');
    }
}

/**
 * Estrategia Concreta: El del Sistema (sigue la preferencia del OS / macOS).
 */
export class SystemThemeStrategy extends ThemeStrategy {
    resolveTheme() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
        }
        return 'claro';
    }

    getId() {
        return '';
    }
}

/**
 * Estrategia Concreta: Modo Claro forzado.
 */
export class LightThemeStrategy extends ThemeStrategy {
    resolveTheme() {
        return 'claro';
    }

    getId() {
        return 'claro';
    }
}

/**
 * Estrategia Concreta: Modo Oscuro forzado.
 */
export class DarkThemeStrategy extends ThemeStrategy {
    resolveTheme() {
        return 'oscuro';
    }

    getId() {
        return 'oscuro';
    }
}

/**
 * Contexto & Subject (GoF Strategy Context + Observer Subject).
 * Centraliza la selección, resolución y notificación del tema a través de la app.
 */
export class ThemeManager {
    constructor() {
        this.strategies = {
            '': new SystemThemeStrategy(),
            claro: new LightThemeStrategy(),
            oscuro: new DarkThemeStrategy(),
        };
        this.activeStrategy = this.strategies[''];
        this.observers = new Set();
        this._setupSystemListener();
    }

    /**
     * Configura el listener del sistema operativo para cuando esté activa la estrategia System.
     */
    _setupSystemListener() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener?.('change', () => {
                if (this.activeStrategy.getId() === '') {
                    this.notifyObservers(this.getEffectiveTheme());
                }
            });
        }
    }

    /**
     * Establece la estrategia a partir del identificador ('', 'claro', 'oscuro').
     * @param {string} mode
     */
    setThemeMode(mode) {
        const normalized = mode === 'claro' || mode === 'oscuro' ? mode : '';
        this.activeStrategy = this.strategies[normalized] || this.strategies[''];
        const effective = this.getEffectiveTheme();
        this.notifyObservers(effective);
        return effective;
    }

    /**
     * Retorna el modo configurado ('', 'claro' u 'oscuro').
     * @returns {string}
     */
    getMode() {
        return this.activeStrategy.getId();
    }

    /**
     * Retorna el tema efectivo resuelto ('claro' u 'oscuro').
     * @returns {'claro' | 'oscuro'}
     */
    getEffectiveTheme() {
        return this.activeStrategy.resolveTheme();
    }

    /**
     * Aplica el contrato de clases y dataset a un elemento raíz (document.documentElement).
     * @param {HTMLElement} rootEl
     */
    applyToElement(rootEl) {
        if (!rootEl) return;
        const effective = this.getEffectiveTheme();
        const mode = this.getMode();

        if (mode) {
            rootEl.dataset.tema = mode;
        } else {
            delete rootEl.dataset.tema;
        }

        rootEl.style.colorScheme = effective === 'oscuro' ? 'dark' : 'light';
        rootEl.classList.toggle('dark', effective === 'oscuro');
    }

    /**
     * Despacha el tema resuelto a una ventana iframe por postMessage.
     * @param {Window} win
     */
    dispatchToIframe(win) {
        if (!win) return;
        const effective = this.getEffectiveTheme();
        try {
            win.postMessage({ type: 'producciontv:tema', tema: effective }, '*');
        } catch (_) {}
    }

    /**
     * Suscribe un observador (GoF Observer).
     * @param {Function} observer Callback que recibe (effectiveTheme, mode)
     * @returns {Function} Función para cancelar la suscripción
     */
    subscribe(observer) {
        if (typeof observer !== 'function') return () => {};
        this.observers.add(observer);
        return () => this.observers.delete(observer);
    }

    /**
     * Notifica a todos los observadores registrados.
     * @param {'claro' | 'oscuro'} effective
     */
    notifyObservers(effective) {
        for (const obs of this.observers) {
            try {
                obs(effective, this.getMode());
            } catch (err) {
                console.error('[ThemeManager] Error notificando observador:', err);
            }
        }
    }
}

// Instancia singleton para toda la aplicación
export const globalThemeManager = new ThemeManager();

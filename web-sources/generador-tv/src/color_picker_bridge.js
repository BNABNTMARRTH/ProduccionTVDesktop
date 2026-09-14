/**
 * ColorPickerBridge (GoF Bridge Pattern + Command Pattern + Observer Pattern)
 * Desacopla la interfaz de selección de color de la implementación concreta
 * de la plataforma (Native macOS NSColorPanel vs Web Fallback).
 */

// 1. Interfaz Implementor (Bridge Pattern)
export class ColorPickerImplementor {
    open(command) { throw new Error('open() no implementado'); }
    close() { throw new Error('close() no implementado'); }
}

// Implementación Concreta: macOS Nativo (Wails / Cocoa)
export class NativeMacColorPickerImplementor extends ColorPickerImplementor {
    constructor() {
        super();
        this._listeners = new Map();
        this._initListener();
    }

    _initListener() {
        if (typeof window === 'undefined') return;
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'producciontv:color-changed') {
                const { color, tag } = event.data;
                if (tag && this._listeners.has(tag)) {
                    this._listeners.get(tag)(color);
                } else {
                    this._listeners.forEach((cb) => cb(color));
                }
            }
        });
        if (window.runtime?.EventsOn) {
            window.runtime.EventsOn('ptv:color-changed', (color) => {
                this._listeners.forEach((cb) => cb(color));
            });
        }
    }

    open(command) {
        const { elemLeft, elemBottom, initialHex, tag, onChange } = command;
        if (tag && onChange) {
            this._listeners.set(tag, onChange);
        }
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'producciontv:open-color-picker',
                elemLeft,
                elemBottom,
                initialHex,
                tag,
            }, '*');
        } else if (typeof window !== 'undefined' && window.go?.main?.App?.OpenNativeColorPicker) {
            window.go.main.App.OpenNativeColorPicker(elemLeft, elemBottom, initialHex);
        }
    }

    close() {
        if (typeof window !== 'undefined' && window.go?.main?.App?.CloseNativeColorPicker) {
            window.go.main.App.CloseNativeColorPicker();
        }
    }
}

// Implementación Concreta: Web / Fallback (HTML5 input[type=color])
export class WebColorPickerImplementor extends ColorPickerImplementor {
    open(command) {
        const { triggerEl, initialHex, onChange } = command;
        let input = triggerEl?.querySelector('input[type="color"]');
        if (!input && typeof document !== 'undefined') {
            input = document.createElement('input');
            input.type = 'color';
            input.style.position = 'absolute';
            input.style.opacity = '0';
            input.style.pointerEvents = 'none';
            document.body.appendChild(input);
        }
        if (input) {
            input.value = initialHex || '#1D6FD1';
            input.oninput = (e) => onChange?.(e.target.value);
            input.onchange = (e) => onChange?.(e.target.value);
            input.click();
        }
    }

    close() {}
}

// 2. Abstracción del Bridge (GoF Bridge)
export class ColorPickerBridge {
    constructor(implementor) {
        this.implementor = implementor || this._resolveDefaultImplementor();
    }

    _resolveDefaultImplementor() {
        const isWails = typeof window !== 'undefined' && (!!window.go?.main?.App || window.parent !== window);
        return isWails ? new NativeMacColorPickerImplementor() : new WebColorPickerImplementor();
    }

    open(command) {
        this.implementor.open(command);
    }

    close() {
        this.implementor.close();
    }
}

// 3. Command Pattern (GoF Command)
export class OpenColorPickerCommand {
    constructor({ triggerEl = null, initialHex = '#1D6FD1', tag = 'default', onChange = null } = {}) {
        this.triggerEl = triggerEl;
        this.initialHex = initialHex;
        this.tag = tag;
        this.onChange = onChange;
    }

    execute(bridge = defaultColorPickerBridge) {
        let elemLeft = 0;
        let elemBottom = 0;
        if (this.triggerEl && typeof this.triggerEl.getBoundingClientRect === 'function') {
            const rect = this.triggerEl.getBoundingClientRect();
            elemLeft = rect.left;
            elemBottom = rect.bottom;
        }
        bridge.open({
            elemLeft,
            elemBottom,
            initialHex: this.initialHex,
            tag: this.tag,
            onChange: this.onChange,
            triggerEl: this.triggerEl,
        });
    }
}

// Instancia singleton compartida
export const defaultColorPickerBridge = new ColorPickerBridge();

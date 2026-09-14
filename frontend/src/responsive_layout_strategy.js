/**
 * @file responsive_layout_strategy.js
 * @description Implementación de los patrones de diseño GoF Strategy y Observer
 * con Inversión de Control (IoC / Principio de Hollywood) para el diseño
 * First Responsive (Mobile-First / Split View de macOS / iPad / Monitores de Estudio).
 *
 * En esta arquitectura, los componentes NO calculan dimensiones manualmente;
 * los patrones GoF evalúan el entorno y LLAMAN al código de la interfaz registrada.
 */

/**
 * Interfaz / Clase base abstracta para la Estrategia de Disposición (GoF Strategy).
 */
export class LayoutStrategy {
  /**
   * @param {string} name Identificador de la estrategia ('compact', 'tablet', 'expanded')
   * @param {number} minWidth Ancho mínimo en píxeles
   * @param {number} maxWidth Ancho máximo en píxeles
   */
  constructor(name, minWidth, maxWidth) {
    if (new.target === LayoutStrategy) {
      throw new TypeError('LayoutStrategy es una clase abstracta y no puede ser instanciada directamente.');
    }
    this.name = name;
    this.minWidth = minWidth;
    this.maxWidth = maxWidth;
  }

  /**
   * Determina si esta estrategia aplica para el ancho dado.
   * @param {number} width
   * @returns {boolean}
   */
  matches(width) {
    return width >= this.minWidth && width <= this.maxWidth;
  }

  /**
   * Aplica la estrategia al elemento contenedor (LLAMADA DEL GOF AL DOM).
   * @param {HTMLElement} rootEl
   * @param {Object} viewportInfo
   */
  apply(rootEl, viewportInfo) {
    if (!rootEl || !rootEl.setAttribute) return;
    rootEl.setAttribute('data-layout', this.name);
    if (rootEl.classList) {
      rootEl.classList.toggle('layout-compact', this.name === 'compact');
      rootEl.classList.toggle('layout-tablet', this.name === 'tablet');
      rootEl.classList.toggle('layout-expanded', this.name === 'expanded');
    }
  }
}

/**
 * Estrategia para pantallas compactas: Mobile, iPhone, iPad vertical o
 * modo pantalla dividida (Split View de macOS < 768px).
 */
export class CompactLayoutStrategy extends LayoutStrategy {
  constructor() {
    super('compact', 0, 767);
  }

  apply(rootEl, viewportInfo) {
    super.apply(rootEl, viewportInfo);
    // Configuración específica de modo compacto (1 columna, barra lateral compacta 58px)
    if (rootEl && rootEl.style && rootEl.style.setProperty) {
      rootEl.style.setProperty('--responsive-columns', '1');
      rootEl.style.setProperty('--responsive-rail-width', '58px');
    }
  }
}

/**
 * Estrategia para pantallas medianas: iPad horizontal, ventana mediana de Mac (768px - 1099px).
 */
export class TabletLayoutStrategy extends LayoutStrategy {
  constructor() {
    super('tablet', 768, 1099);
  }

  apply(rootEl, viewportInfo) {
    super.apply(rootEl, viewportInfo);
    // Configuración específica de modo tablet (sidebar compacta 60px, 2 columnas)
    if (rootEl && rootEl.style && rootEl.style.setProperty) {
      rootEl.style.setProperty('--responsive-columns', '2');
      rootEl.style.setProperty('--responsive-rail-width', '60px');
    }
  }
}

/**
 * Estrategia para monitores de escritorio completos, iMac y pantallas broadcast (>= 1100px).
 */
export class ExpandedLayoutStrategy extends LayoutStrategy {
  constructor() {
    super('expanded', 1100, Infinity);
  }

  apply(rootEl, viewportInfo) {
    super.apply(rootEl, viewportInfo);
    // Configuración de pantalla de estudio completa (sidebar de iconos 92px, 3+ columnas)
    if (rootEl && rootEl.style && rootEl.style.setProperty) {
      rootEl.style.setProperty('--responsive-columns', '3');
      rootEl.style.setProperty('--responsive-rail-width', '92px');
    }
  }
}

/**
 * Gestor Central de Layout Responsivo (GoF Strategy Context + Observer).
 *
 * Implementa el Principio de Hollywood (Inversión de Control):
 * Monitorea el viewport y es el GOF quien LLAMA a los componentes registrados
 * cuando el factor de forma cambia.
 */
export class ResponsiveLayoutManager {
  /**
   * @param {Object} [options]
   * @param {HTMLElement} [options.rootElement] Elemento raíz (default: document.documentElement)
   * @param {Window} [options.win] Objeto window (default: globalThis.window)
   */
  constructor(options = {}) {
    this.rootElement = options.rootElement || (typeof document !== 'undefined' ? document.documentElement : null);
    this.window = options.win || (typeof window !== 'undefined' ? window : null);
    
    // Lista de estrategias GoF registradas (ordenadas por especificidad)
    this.strategies = [
      new CompactLayoutStrategy(),
      new TabletLayoutStrategy(),
      new ExpandedLayoutStrategy()
    ];

    this.currentStrategy = null;
    this.observers = new Set();
    this.components = new Set();
    this.resizeObserver = null;
    this._boundOnResize = this.evaluate.bind(this);
  }

  /**
   * Registra un observador reactivo (GoF Observer).
   * @param {Function} callback Función que el GoF llamará al cambiar el layout
   * @returns {Function} Función para cancelar la suscripción
   */
  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.observers.add(callback);
    // Notificar inmediatamente el estado actual al nuevo suscriptor
    if (this.currentStrategy) {
      try {
        callback({
          name: this.currentStrategy.name,
          strategy: this.currentStrategy,
          width: this.getViewportWidth(),
          height: this.getViewportHeight(),
          isCompact: this.currentStrategy.name === 'compact',
          isTablet: this.currentStrategy.name === 'tablet',
          isExpanded: this.currentStrategy.name === 'expanded'
        });
      } catch (err) {
        console.error('[ResponsiveLayoutManager] Error al notificar suscriptor inicial:', err);
      }
    }
    return () => this.observers.delete(callback);
  }

  /**
   * Registra un componente de interfaz formal (Inversión de Control).
   * El componente debe exponer el método `onLayoutChange(layoutState)`.
   * @param {Object} component
   * @returns {Function} Función para desregistrar
   */
  registerComponent(component) {
    if (!component) return () => {};
    this.components.add(component);
    if (this.currentStrategy && typeof component.onLayoutChange === 'function') {
      try {
        component.onLayoutChange({
          name: this.currentStrategy.name,
          strategy: this.currentStrategy,
          width: this.getViewportWidth(),
          height: this.getViewportHeight(),
          isCompact: this.currentStrategy.name === 'compact',
          isTablet: this.currentStrategy.name === 'tablet',
          isExpanded: this.currentStrategy.name === 'expanded'
        });
      } catch (err) {
        console.error('[ResponsiveLayoutManager] Error en onLayoutChange del componente:', err);
      }
    }
    return () => this.components.delete(component);
  }

  /**
   * Obtiene el ancho actual del viewport.
   * @returns {number}
   */
  getViewportWidth() {
    if (this.window && typeof this.window.innerWidth === 'number') {
      return this.window.innerWidth;
    }
    if (this.rootElement && this.rootElement.clientWidth) {
      return this.rootElement.clientWidth;
    }
    return 1200; // Valor por defecto seguro para entornos de prueba
  }

  /**
   * Obtiene el alto actual del viewport.
   * @returns {number}
   */
  getViewportHeight() {
    if (this.rootElement && this.rootElement.clientHeight) {
      return this.rootElement.clientHeight;
    }
    if (this.window && this.window.innerHeight) {
      return this.window.innerHeight;
    }
    return 800;
  }

  /**
   * Evalúa las dimensiones del viewport y selecciona la estrategia adecuada.
   * Si la estrategia cambia, el GoF ejecuta la mutación y LLAMA a todos los componentes.
   * @param {number} [overrideWidth] Ancho explícito opcional (útil en pruebas)
   * @returns {Object} Estado del layout
   */
  evaluate(overrideWidth) {
    const width = typeof overrideWidth === 'number' ? overrideWidth : this.getViewportWidth();
    const height = this.getViewportHeight();

    const matchedStrategy = this.strategies.find(s => s.matches(width)) || this.strategies[0];

    const hasChanged = !this.currentStrategy || this.currentStrategy.name !== matchedStrategy.name;
    this.currentStrategy = matchedStrategy;

    // Aplicar al DOM
    if (this.rootElement) {
      matchedStrategy.apply(this.rootElement, { width, height });
    }

    const layoutState = {
      name: matchedStrategy.name,
      strategy: matchedStrategy,
      width,
      height,
      isCompact: matchedStrategy.name === 'compact',
      isTablet: matchedStrategy.name === 'tablet',
      isExpanded: matchedStrategy.name === 'expanded'
    };

    // EL GOF LLAMA AL CÓDIGO REGISTRADO (Inversión de Control)
    if (hasChanged) {
      // 1. Notificar observadores
      this.observers.forEach(callback => {
        try {
          callback(layoutState);
        } catch (err) {
          console.error('[ResponsiveLayoutManager] Error al ejecutar callback observador:', err);
        }
      });

      // 2. Invocar método onLayoutChange en componentes registrados
      this.components.forEach(comp => {
        if (typeof comp.onLayoutChange === 'function') {
          try {
            comp.onLayoutChange(layoutState);
          } catch (err) {
            console.error('[ResponsiveLayoutManager] Error al ejecutar comp.onLayoutChange:', err);
          }
        }
      });
    }

    return layoutState;
  }

  /**
   * Inicia la monitorización automática del viewport con ResizeObserver y listener de resize.
   */
  startWatching() {
    if (this.window && this.window.addEventListener) {
      this.window.addEventListener('resize', this._boundOnResize);
    }
    if (typeof ResizeObserver !== 'undefined' && this.rootElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.evaluate();
      });
      try {
        this.resizeObserver.observe(this.rootElement);
      } catch (e) {
        // Ignorar si el elemento raíz no es observable
      }
    }
    // Evaluación inicial inmediata
    return this.evaluate();
  }

  /**
   * Detiene la monitorización y limpia listeners (previene fugas de memoria).
   */
  stopWatching() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.window && this.window.removeEventListener) {
      this.window.removeEventListener('resize', this._boundOnResize);
    }
  }
}

// Instancia singleton compartida para el caparazón de la aplicación
export const globalResponsiveManager = new ResponsiveLayoutManager();

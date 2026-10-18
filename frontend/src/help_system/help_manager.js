/**
 * @file help_manager.js
 * @description Contexto y despachador del sistema de ayuda contextual (GoF Strategy Context).
 * Orquesta la resolución de la estrategia correcta según la vista activa,
 * la construcción del modal estilo Apple Liquid Glass y la accesibilidad.
 */

import {
    HomeHelpStrategy,
    ProfileHelpStrategy,
    ScriptHelpStrategy,
    NeedsHelpStrategy,
    PlanningHelpStrategy,
    DocumentsHelpStrategy,
    LiveProductionHelpStrategy,
    DefaultHelpStrategy
} from './help_strategy.js';
import { icono } from '../iconos.js';

export class HelpManager {
    constructor() {
        this.strategies = new Map();
        this.viewMapping = new Map();
        this.defaultStrategy = new DefaultHelpStrategy();
        this.modalElement = null;
        this.activeKeydownHandler = null;

        this._registerDefaultStrategies();
    }

    /**
     * Registra las estrategias estándar del sistema.
     * @private
     */
    _registerDefaultStrategies() {
        const home = new HomeHelpStrategy();
        const perfil = new ProfileHelpStrategy();
        const guion = new ScriptHelpStrategy();
        const necesidades = new NeedsHelpStrategy();
        const planeacion = new PlanningHelpStrategy();
        const salida = new DocumentsHelpStrategy();
        const ensayo = new LiveProductionHelpStrategy();

        // Estrategias registradas
        this.registerStrategy('home', home);
        this.registerStrategy('perfil', perfil);
        this.registerStrategy('guion', guion);
        this.registerStrategy('necesidades', necesidades);
        this.registerStrategy('planeacion', planeacion);
        this.registerStrategy('salida', salida);
        this.registerStrategy('ensayo', ensayo);

        // Mapeo canónico de vistas concretas a estrategias
        this.mapViewToStrategy('home', 'home');
        this.mapViewToStrategy('plantillas', 'home');

        this.mapViewToStrategy('perfil', 'perfil');
        this.mapViewToStrategy('referencias', 'perfil');

        this.mapViewToStrategy('guionLiterario', 'guion');
        this.mapViewToStrategy('escaleta', 'guion');
        this.mapViewToStrategy('tiempos', 'guion');

        this.mapViewToStrategy('necesidades', 'necesidades');
        this.mapViewToStrategy('agenda', 'necesidades');
        this.mapViewToStrategy('diagrama', 'necesidades');

        this.mapViewToStrategy('set', 'planeacion');
        this.mapViewToStrategy('infografias', 'planeacion');

        this.mapViewToStrategy('exportar', 'salida');

        this.mapViewToStrategy('production', 'ensayo');
    }

    /**
     * Registra una estrategia concreta extensible (Open/Closed).
     * @param {string} id - Clave de la estrategia
     * @param {HelpStrategy} strategy
     */
    registerStrategy(id, strategy) {
        this.strategies.set(id, strategy);
    }

    /**
     * Mapea un identificador de vista/sección a una estrategia.
     * @param {string} viewId
     * @param {string} strategyId
     */
    mapViewToStrategy(viewId, strategyId) {
        this.viewMapping.set(viewId, strategyId);
    }

    /**
     * Resuelve la estrategia adecuada según la vista y contexto actual.
     * @param {string} viewId - Identificador de la vista (ej. 'production', 'set', 'home')
     * @param {Object} [context={}]
     * @returns {HelpStrategy}
     */
    resolveStrategy(viewId, context = {}) {
        // 1. Búsqueda por mapeo directo de vista
        const mappedId = this.viewMapping.get(viewId);
        if (mappedId && this.strategies.has(mappedId)) {
            return this.strategies.get(mappedId);
        }

        // 2. Búsqueda directa por id de estrategia (ej. si pasaron 'planeacion' o 'perfil')
        if (this.strategies.has(viewId)) {
            return this.strategies.get(viewId);
        }

        // 3. Búsqueda por etapa en el contexto
        if (context.etapa?.id && this.strategies.has(context.etapa.id)) {
            return this.strategies.get(context.etapa.id);
        }

        // 4. Fallback seguro
        return this.defaultStrategy;
    }

    /**
     * Abre el modal de ayuda contextual para la sección activa.
     * @param {string} viewId - Vista activa
     * @param {Object} [context={}] - Contexto adicional { activeProject, activeView, etapa, startTour }
     */
    openHelp(viewId, context = {}) {
        this.closeHelp();

        const strategy = this.resolveStrategy(viewId, context);
        const tips = strategy.getTips(context);
        const shortcuts = strategy.getShortcuts(context);
        const title = strategy.getTitle(context);

        const overlay = document.createElement('div');
        overlay.className = 'help-sheet-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'help-sheet-title');

        overlay.innerHTML = `
            <div class="help-sheet-card lg-container" tabindex="-1">
                <header class="help-sheet-header">
                    <div class="help-sheet-title-group">
                        <span class="help-stage-badge">${strategy.stageBadge}</span>
                        <h2 class="help-sheet-title" id="help-sheet-title">${title}</h2>
                    </div>
                    <button class="help-sheet-close-btn" type="button" aria-label="Cerrar ayuda (Esc)" title="Cerrar (Esc)">
                        ${icono('cerrar', 14)}
                    </button>
                </header>

                <p class="help-sheet-summary">${strategy.summary}</p>

                <div class="help-sheet-body">
                    ${tips.length > 0 ? `
                        <section class="help-section">
                            <h3 class="help-section-title">
                                <span class="help-section-icon">${icono('guia', 14)}</span>
                                <span>Flujo de trabajo y consejos</span>
                            </h3>
                            <ul class="help-tips-list">
                                ${tips.map(t => `
                                    <li class="help-tip-item">
                                        <strong class="help-tip-title">${t.titulo}</strong>
                                        <span class="help-tip-desc">${t.descripcion}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </section>
                    ` : ''}

                    ${shortcuts.length > 0 ? `
                        <section class="help-section">
                            <h3 class="help-section-title">
                                <span class="help-section-icon">${icono('teclado', 14)}</span>
                                <span>Atajos de teclado clave</span>
                            </h3>
                            <div class="help-shortcuts-grid">
                                ${shortcuts.map(s => `
                                    <div class="help-shortcut-row">
                                        <div class="help-shortcut-keys">
                                            ${s.teclas.map(k => `<kbd class="help-kbd">${k}</kbd>`).join('')}
                                        </div>
                                        <span class="help-shortcut-desc">${s.accion}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    ` : ''}
                </div>

                <footer class="help-sheet-footer">
                    <div class="help-tour-callout">
                        <span class="help-tour-text">¿Primera vez usando la app o quieres repasar paso a paso?</span>
                        <button class="help-tour-btn apple-secondary-btn" type="button" id="help-launch-tour">
                            ${icono('ayuda', 14)}
                            <span>Iniciar recorrido guiado</span>
                        </button>
                    </div>
                </footer>
            </div>
        `;

        document.body.appendChild(overlay);
        this.modalElement = overlay;

        // Foco inicial accesible
        const card = overlay.querySelector('.help-sheet-card');
        card?.focus();

        // Manejadores de cierre
        const closeBtn = overlay.querySelector('.help-sheet-close-btn');
        closeBtn?.addEventListener('click', () => this.closeHelp());

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeHelp();
        });

        // Lanzar recorrido guiado
        const tourBtn = overlay.querySelector('#help-launch-tour');
        tourBtn?.addEventListener('click', () => {
            this.closeHelp();
            if (typeof context.startTour === 'function') {
                context.startTour();
            }
        });

        // Listener de tecla Escape
        this.activeKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                this.closeHelp();
            }
        };
        window.addEventListener('keydown', this.activeKeydownHandler, true);
    }

    /**
     * Cierra el modal de ayuda si está abierto.
     */
    closeHelp() {
        if (this.activeKeydownHandler) {
            window.removeEventListener('keydown', this.activeKeydownHandler, true);
            this.activeKeydownHandler = null;
        }

        if (this.modalElement) {
            this.modalElement.classList.add('closing');
            const el = this.modalElement;
            this.modalElement = null;
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 180);
        }
    }
}

// Singleton exportado para uso general en el frontend
export const helpManager = new HelpManager();

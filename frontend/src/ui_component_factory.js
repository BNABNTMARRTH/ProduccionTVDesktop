/**
 * UIComponentFactory implementa el patrón ABSTRACT FACTORY (GoF).
 * Centraliza la creación y el ensamblado de controles visuales Apple HIG (Liquid Glass macOS),
 * asegurando consistencia visual, accesibilidad semántica ARIA y comportamiento uniforme
 * en todas las vistas y herramientas de la aplicación.
 */

import { esc } from './constants.js';

export class UIComponentFactory {
    /**
     * Construye un control segmentado estilo Apple HIG (pestañas o filtros integrados)
     * @param {Object} options
     * @param {string} options.id - Atributo id del contenedor
     * @param {Array<{id: string, label: string, dataAttr?: string, dataVal?: string}>} options.items
     * @param {string} options.activeValue - Valor actualmente seleccionado
     * @param {string} [options.ariaLabel] - Etiqueta accesible ARIA
     * @param {string} [options.dataKey] - Clave del atributo data (ej. 'filter-mode' o 'tpl-cat')
     */
    static createSegmented({ id = '', items = [], activeValue = '', ariaLabel = '', dataKey = 'filter' } = {}) {
        const buttons = items.map((item) => {
            const val = item.dataVal !== undefined ? item.dataVal : item.id;
            const isActive = val === activeValue;
            const dataAttr = item.dataAttr || `data-${dataKey}="${esc(val)}"`;
            return `<button class="seg-btn ${isActive ? 'active' : ''}" ${dataAttr} role="tab" aria-selected="${isActive ? 'true' : 'false'}">${esc(item.label)}</button>`;
        }).join('');

        return `<div class="apple-segmented" ${id ? `id="${esc(id)}"` : ''} role="tablist" ${ariaLabel ? `aria-label="${esc(ariaLabel)}"` : ''}>${buttons}</div>`;
    }

    /**
     * Construye una barra de búsqueda con lupa integrada y soporte Liquid Glass
     */
    static createSearchInput({ id = '', placeholder = 'Buscar…', ariaLabel = 'Buscar', searchIcon = '', value = '' } = {}) {
        return `
        <div class="apple-search-wrap">
          <span class="search-ic">${searchIcon}</span>
          <input ${id ? `id="${esc(id)}"` : ''} class="project-search" type="search" placeholder="${esc(placeholder)}" aria-label="${esc(ariaLabel)}" value="${esc(value)}">
        </div>`;
    }

    /**
     * Construye un alternador de vista Mosaico / Lista tipo macOS Finder
     */
    static createViewSwitcher({ gridId = 'view-grid-btn', listId = 'view-list-btn', activeMode = 'grid', gridIcon = '', listIcon = '' } = {}) {
        const isGrid = activeMode === 'grid';
        return `
        <div class="view-switcher" role="group" aria-label="Modo de vista">
          <button class="view-btn ${isGrid ? 'active' : ''}" id="${esc(gridId)}" title="Vista en mosaico" aria-label="Vista en mosaico">${gridIcon}</button>
          <button class="view-btn ${!isGrid ? 'active' : ''}" id="${esc(listId)}" title="Vista en lista tipo Finder" aria-label="Vista en lista">${listIcon}</button>
        </div>`;
    }

    /**
     * Construye un botón estilo Apple HIG (Primario azul o Secundario de cristal)
     */
    static createButton({ id = '', label = '', icon = '', variant = 'secondary', title = '', className = '', extraAttrs = '' } = {}) {
        const baseClass = variant === 'primary' ? 'apple-primary-btn' : 'apple-secondary-btn';
        const classes = [baseClass, className].filter(Boolean).join(' ');
        const idAttr = id ? `id="${esc(id)}"` : '';
        const titleAttr = title ? `title="${esc(title)}"` : '';

        return `<button ${idAttr} class="${classes}" ${titleAttr} ${extraAttrs}>${icon ? icon + ' ' : ''}<span>${esc(label)}</span></button>`;
    }

    /**
     * Construye un encabezado de barra superior fija / inmóvil (Apple Fixed Toolbar Header)
     * @param {Object} options
     * @param {string} [options.id] - ID opcional del header
     * @param {string} [options.caption] - Rótulo superior en mayúsculas pequeñas (ej. 'PRODUCCIÓN AUDIOVISUAL')
     * @param {string} options.title - Título principal H1 (ej. 'Plantillas de set' o 'Proyectos')
     * @param {string} [options.subtitle] - Descripción o contador
     * @param {string} [options.toolsHtml] - HTML con los controles de herramientas (filtros, buscador, botones)
     */
    static createStickyHeader({ id = '', caption = '', title = '', subtitle = '', toolsHtml = '' } = {}) {
        const idAttr = id ? `id="${esc(id)}"` : '';
        return `
        <header class="home-top" ${idAttr} role="banner">
          <div class="home-top-inner">
            <div class="home-title-group">
              ${caption ? `<span class="home-caption">${esc(caption)}</span>` : ''}
              <h1 class="home-heading">${esc(title)}</h1>
              ${subtitle ? `<p class="home-sub">${subtitle}</p>` : ''}
            </div>
            <div class="home-tools">
              ${toolsHtml}
            </div>
          </div>
        </header>`;
    }

    /**
     * Construye un micro-chip de hardware con icono y etiqueta técnica
     */
    static createHardwareChip({ count = 0, label = '', icon = '', title = '' } = {}) {
        const chipTitle = title || `${count} ${label}`;
        return `<span class="tpl-chip" title="${esc(chipTitle)}">${icon ? `<span class="chip-ic">${icon}</span>` : ''}${count} ${esc(label)}</span>`;
    }

    /**
     * Construye un badge flotante de vidrio Liquid Glass
     */
    static createBadge({ label = '', variant = 'info', icon = '', className = '' } = {}) {
        const classes = ['apple-badge', `badge-${variant}`, className].filter(Boolean).join(' ');
        return `<span class="${classes}">${icon ? `${icon} ` : ''}${esc(label)}</span>`;
    }

    /**
     * Construye un estado vacío elegante para listas o cuadrículas
     */
    static createEmptyState({ message = 'No se encontraron elementos', submessage = '', icon = '' } = {}) {
        return `
        <div class="apple-empty-state">
          ${icon ? `<div class="empty-icon">${icon}</div>` : ''}
          <p class="empty-msg">${esc(message)}</p>
          ${submessage ? `<small class="empty-sub">${esc(submessage)}</small>` : ''}
        </div>`;
    }

    /**
     * Construye una cabecera de diálogo modal estilo Apple Sheet (sin botón X redundante)
     */
    static createSheetHeader({ title = '', subtitle = '' } = {}) {
        return `
        <div class="np-header">
          <h1 id="np-titulo" class="np-title">${esc(title)}</h1>
          ${subtitle ? `<p class="np-hint">${esc(subtitle)}</p>` : ''}
        </div>`;
    }

    /**
     * Construye una tarjeta interactiva de selección de modalidad Liquid Glass (macOS Studio)
     */
    static createModeCard({ modeId = '', isSelected = false, title = '', desc = '', example = '', iconSvg = '' } = {}) {
        return `
        <button type="button" class="np-modo ${isSelected ? 'selected' : ''}" data-modo="${esc(modeId)}" role="radio" aria-checked="${isSelected ? 'true' : 'false'}">
          <div class="mode-card-header">
            <span class="np-modo-ico">${iconSvg}</span>
            <span class="mode-radio-indicator"><span class="mode-radio-inner"></span></span>
          </div>
          <div class="mode-card-body">
            <strong class="mode-card-title">${esc(title)}</strong>
            <p class="mode-card-desc">${esc(desc)}</p>
            <span class="mode-card-example">${esc(example)}</span>
          </div>
        </button>`;
    }

    /**
     * Construye un botón de despliegue estilo Apple Disclosure Group
     */
    static createDisclosureButton({ id = '', isExpanded = false, title = '', hint = '' } = {}) {
        return `
        <button type="button" class="np-mas ${isExpanded ? 'open' : ''}" ${id ? `id="${esc(id)}"` : ''} aria-expanded="${isExpanded ? 'true' : 'false'}">
          <span class="np-mas-chevron">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.5 2.5L8 6L4.5 9.5"/>
            </svg>
          </span>
          <span class="np-mas-label">${esc(title)}</span>
          ${hint ? `<em class="np-mas-hint">${esc(hint)}</em>` : ''}
        </button>`;
    }

    /**
     * Construye una cápsula de selección interactiva estilo Apple HIG Glass Chip
     * @param {Object} options
     * @param {string} options.value - Valor del chip
     * @param {string} [options.label] - Texto a mostrar (por defecto el valor)
     * @param {boolean} [options.isSelected=false] - Si está activo o no
     * @param {string} [options.groupName] - Nombre del grupo o lista a la que pertenece
     * @param {string} [options.icon] - Icono opcional
     */
    static createFilterChip({ value = '', label = '', isSelected = false, groupName = '', icon = '' } = {}) {
        const text = label || value;
        const activeClass = isSelected ? ' on' : '';
        const groupAttr = groupName ? ` data-lista="${esc(groupName)}"` : '';
        return `<button type="button" class="np-chip${activeClass}" data-valor="${esc(value)}"${groupAttr} aria-pressed="${isSelected ? 'true' : 'false'}" role="button">${icon ? `<span class="np-chip-icon">${icon}</span>` : ''}<span class="np-chip-text">${esc(text)}</span></button>`;
    }

    /**
     * Construye un grupo de cápsulas estilo Apple HIG con contenedor semántico
     */
    static createChipGroup({ groupName = '', items = [], selectedValues = [] } = {}) {
        const chipsHtml = items.map((item) => {
            const val = typeof item === 'string' ? item : item.value;
            const lbl = typeof item === 'string' ? item : (item.label || item.value);
            const isSelected = selectedValues.includes(val);
            return UIComponentFactory.createFilterChip({
                value: val,
                label: lbl,
                isSelected,
                groupName,
            });
        }).join('');
        return `<div class="np-chips" data-lista="${esc(groupName)}" role="group" aria-label="${esc(groupName)}">${chipsHtml}</div>`;
    }

    /**
     * Construye una barra de acciones en pie de diálogo estilo macOS Sheet
     */
    static createSheetFooter({ cancelLabel = 'Cancelar', confirmLabel = 'Crear y empezar', shortcutHint = '⌘↵' } = {}) {
        return `
        <div class="np-footer">
          <button type="button" class="np-cancel-btn apple-secondary-btn">${esc(cancelLabel)}</button>
          <button type="button" class="np-crear apple-primary-btn">
            <span>${esc(confirmLabel)}</span>
            ${shortcutHint ? `<kbd class="np-shortcut-kbd">${esc(shortcutHint)}</kbd>` : ''}
          </button>
        </div>`;
    }

    /**
     * Construye un botón ergonómico para la barra lateral flotante (Liquid Glass Sidebar)
     */
    static createSidebarButton({
        id = '',
        accion = '',
        etapaId = '',
        label = '',
        iconSvg = '',
        badgeNum = null,
        isActive = false,
        title = '',
        className = '',
        extraAttrs = '',
    } = {}) {
        const idAttr = id ? `id="${esc(id)}"` : '';
        const accionAttr = accion ? `data-accion="${esc(accion)}"` : '';
        const etapaAttr = etapaId ? `data-etapa="${esc(etapaId)}"` : '';
        const titleAttr = title ? `title="${esc(title)}"` : '';
        const activeClass = isActive ? 'active' : '';
        const classes = [activeClass, className].filter(Boolean).join(' ');
        const classAttr = classes ? `class="${classes}"` : '';

        const badgeHtml = badgeNum !== null && badgeNum !== undefined
            ? `<b class="rail-num">${esc(String(badgeNum))}</b>`
            : '';

        return `<button ${idAttr} ${accionAttr} ${etapaAttr} ${classAttr} ${titleAttr} ${extraAttrs}>
          <span class="ic">${iconSvg}${badgeHtml}</span><em>${esc(label)}</em>
        </button>`.trim();
    }

    /**
     * Construye un separador de luz para la barra lateral
     */
    static createSidebarDivider() {
        return `<div class="rail-sep" aria-hidden="true"></div>`;
    }

    /**
     * Construye un grupo estructurado de elementos de navegación lateral
     */
    static createSidebarGroup({ id = '', itemsHtml = '', hidden = false } = {}) {
        const idAttr = id ? `id="${esc(id)}"` : '';
        const hiddenAttr = hidden ? 'hidden' : '';
        return `<div class="rail-group" ${idAttr} ${hiddenAttr}>${itemsHtml}</div>`;
    }
}


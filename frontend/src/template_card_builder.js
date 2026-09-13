/**
 * TemplateCardBuilder implementa el patrón de diseño BUILDER (GoF).
 * Desacopla la lógica de ensamblado HTML/DOM de las tarjetas de plantillas de set,
 * formateando los datos con micro-badges de hardware Apple HIG y tipografía SF Pro en Title Case,
 * tanto para vista Mosaico (tarjeta) como para vista Lista (fila de catálogo).
 */

import { esc } from './constants.js';

export class TemplateCardBuilder {
    constructor() {
        this.reset();
    }

    reset() {
        this.template = null;
        this.cfg = null;
        this.thumbSvg = '';
        this.isDark = false;
        this.categoryLabel = '';
        return this;
    }

    setTemplate(template) {
        this.template = template;
        return this;
    }

    withConfig(cfg) {
        this.cfg = cfg;
        return this;
    }

    withThumbnailSvg(svg) {
        this.thumbSvg = svg || '';
        return this;
    }

    withDark(isDark) {
        this.isDark = Boolean(isDark);
        return this;
    }

    withCategoryLabel(label) {
        this.categoryLabel = label || '';
        return this;
    }

    /**
     * Extrae métricas clave de hardware (cámaras, micrófonos, luces)
     */
    getHardwareMetrics() {
        const cfg = this.cfg || {};
        const set = cfg.sets?.[0] || {};
        return {
            cams: (cfg.camaras || []).length || this.template?.cams || 0,
            mics: (cfg.microfonos || []).length || 0,
            luces: (set.iluminacion?.luces || []).length || 0,
        };
    }

    /**
     * Construye los chips de hardware Apple HIG para el pie de la tarjeta
     */
    renderHardwareChips() {
        const { cams, mics, luces } = this.getHardwareMetrics();
        const chips = [];

        if (cams > 0) chips.push(`<span class="tpl-chip" title="${cams} cámaras configuradas"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>${cams} cams</span>`);
        if (mics > 0) chips.push(`<span class="tpl-chip" title="${mics} micrófonos"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>${mics} mics</span>`);
        if (luces > 0) chips.push(`<span class="tpl-chip" title="${luces} fuentes de iluminación"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>${luces} luces</span>`);

        return chips.join('');
    }

    /**
     * Construye una tarjeta visual de plantilla (Apple HIG Liquid Glass Mosaico)
     */
    buildCard() {
        const t = this.template;
        if (!t) return '';

        const catLabels = {
            multicam: 'Multicámara',
            dialogue: 'Diálogo',
            special: 'Especial'
        };
        const catLabel = this.categoryLabel || catLabels[t.category] || '';

        return `
        <article class="tpl-card" data-plantilla="${esc(t.id)}" role="button" tabindex="0" title="Crear proyecto con set de ${esc(t.nombre)}">
          <div class="tpl-thumb ${this.isDark ? 'blueprint' : ''}" data-plantilla-action="${esc(t.id)}">
            ${this.thumbSvg}
            ${catLabel ? `<span class="tpl-cat-badge ${esc(t.category || '')}">${esc(catLabel)}</span>` : ''}
            ${t.locacion === 'ext' ? '<span class="tpl-loc-tag" title="Locación exterior a cielo abierto">☀️ Exterior</span>' : ''}
          </div>
          <div class="tpl-body">
            <strong class="tpl-title" title="${esc(t.nombre)}">${esc(t.nombre)}</strong>
            <span class="tpl-resumen">${esc(t.resumen || '')}</span>
            <p class="tpl-desc">${esc(t.detalle || '')}</p>
          </div>
          <div class="tpl-foot">
            <div class="tpl-hardware-cluster">
              ${this.renderHardwareChips()}
            </div>
            <button class="tpl-action-btn" data-plantilla-btn="${esc(t.id)}" aria-label="Usar plantilla ${esc(t.nombre)}">
              <span>Elegir</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </article>`;
    }

    /**
     * Construye una fila tabular para la vista Lista (tipo Finder / catálogo técnico)
     */
    buildRow() {
        const t = this.template;
        if (!t) return '';

        const catLabels = {
            multicam: 'Multicámara',
            dialogue: 'Diálogo',
            special: 'Especial'
        };
        const catLabel = this.categoryLabel || catLabels[t.category] || '';

        return `
        <tr class="tpl-row" data-plantilla="${esc(t.id)}" role="row" tabindex="0">
          <td class="td-preview" data-plantilla-action="${esc(t.id)}">
            <div class="row-thumb ${this.isDark ? 'blueprint' : ''}">
              ${this.thumbSvg}
            </div>
          </td>
          <td class="td-name">
            <strong class="row-title">${esc(t.nombre)}</strong>
            <span class="row-sub">${esc(t.resumen || '')}</span>
          </td>
          <td class="td-cat">
            <span class="tpl-cat-badge inline ${esc(t.category || '')}">${esc(catLabel)}</span>
          </td>
          <td class="td-desc">
            <span class="row-desc">${esc(t.detalle || '')}</span>
          </td>
          <td class="td-hardware">
            <div class="tpl-hardware-cluster">
              ${this.renderHardwareChips()}
            </div>
          </td>
          <td class="td-loc">
            <span class="row-loc">${t.locacion === 'ext' ? '☀️ Exterior' : '🏢 Estudio'}</span>
          </td>
          <td class="td-act">
            <button class="tpl-action-btn compact" data-plantilla-btn="${esc(t.id)}">
              <span>Elegir</span>
            </button>
          </td>
        </tr>`;
    }

    /**
     * Método conveniente para construir la tarjeta de una plantilla en una sola llamada
     */
    build(template, cfg, thumbSvg = '', isDark = false) {
        const catLabels = {
            multicam: 'Multicámara',
            dialogue: 'Diálogo',
            special: 'Especial'
        };
        return this.reset()
            .setTemplate(template)
            .withConfig(cfg)
            .withThumbnailSvg(thumbSvg)
            .withDark(isDark)
            .withCategoryLabel(catLabels[template?.category] || '')
            .buildCard();
    }

    buildCardDirect({ template, cfg, thumbSvg = '', isDark = false } = {}) {
        return this.build(template, cfg, thumbSvg, isDark);
    }

    buildRowDirect({ template, cfg, thumbSvg = '', isDark = false } = {}) {
        const catLabels = {
            multicam: 'Multicámara',
            dialogue: 'Diálogo',
            special: 'Especial'
        };
        return this.reset()
            .setTemplate(template)
            .withConfig(cfg)
            .withThumbnailSvg(thumbSvg)
            .withDark(isDark)
            .withCategoryLabel(catLabels[template?.category] || '')
            .buildRow();
    }
}

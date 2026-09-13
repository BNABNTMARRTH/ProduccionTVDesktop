/**
 * ProjectCardBuilder implementa el patrón de diseño BUILDER (GoF).
 * Desacopla la lógica de ensamblado HTML/DOM de las tarjetas de proyecto,
 * filas de lista estilo Finder y la tarjeta destacada Hero, calculando
 * el avance de las 5 etapas (Perfil, Guion, Necesidades, Planeación, Salida).
 */

import { esc } from './constants.js';

export class ProjectCardBuilder {
    constructor() {
        this.reset();
    }

    reset() {
        this.project = null;
        this.isOpen = false;
        this.isPendingDelete = false;
        this.isDark = false;
        this.thumbSvg = '';
        this.chipsHtml = '';
        this.summaryText = '';
        this.dateText = '';
        this.duplicateIcon = '';
        this.trashIcon = '';
        return this;
    }

    setProject(project) {
        this.project = project;
        return this;
    }

    withOpenState(isOpen) {
        this.isOpen = Boolean(isOpen);
        return this;
    }

    withDeleteState(isPendingDelete) {
        this.isPendingDelete = Boolean(isPendingDelete);
        return this;
    }

    withDark(isDark) {
        this.isDark = Boolean(isDark);
        return this;
    }

    withThumbnailSvg(svg) {
        this.thumbSvg = svg || '';
        return this;
    }

    withChips(chipsHtml) {
        this.chipsHtml = chipsHtml || '';
        return this;
    }

    withSummary(summaryText) {
        this.summaryText = summaryText || '';
        return this;
    }

    withDate(dateText) {
        this.dateText = dateText || '';
        return this;
    }

    withIcons({ duplicate = '', trash = '' } = {}) {
        this.duplicateIcon = duplicate;
        this.trashIcon = trash;
        return this;
    }

    /**
     * Calcula el estado de avance de las 5 etapas del proyecto audiovisual:
     * 1. Perfil (Datos y mensaje)
     * 2. Guion (Literario o Escaleta)
     * 3. Necesidades (Crew, cámaras, microfonía)
     * 4. Planeación (Set, iluminación o infografía)
     * 5. Salida (Documentos / Exportación)
     */
    calculateStages() {
        const cfg = this.project?.cfg || {};
        const p1 = Boolean(cfg.titulo || cfg.perfil?.objetivo || cfg.perfil?.idea);
        const p2 = Boolean((cfg.escaleta || []).length > 0 || (cfg.narrativa?.secuencias || []).length > 0);
        const p3 = Boolean((cfg.camaras || []).length > 0 || (cfg.personal || []).length > 0 || (cfg.microfonos || []).length > 0);
        const p4 = Boolean((cfg.sets || []).length > 0);
        const p5 = p1 && p2 && p3 && p4;

        return [
            { id: 'perfil', label: '1. Perfil', done: p1 },
            { id: 'guion', label: '2. Guion', done: p2 },
            { id: 'necesidades', label: '3. Necesidades', done: p3 },
            { id: 'planeacion', label: '4. Planeación', done: p4 },
            { id: 'salida', label: '5. Salida', done: p5 },
        ];
    }

    renderStageProgress() {
        const stages = this.calculateStages();
        const completed = stages.filter((s) => s.done).length;
        return `
        <div class="stage-progress-bar" role="progressbar" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="5" title="Avance: ${completed} de 5 etapas (${stages.map((s) => `${s.label}: ${s.done ? '✓' : '—'}`).join(' · ')})">
          ${stages.map((s) => `<span class="sp-step ${s.done ? 'done' : ''}" data-step="${s.id}"></span>`).join('')}
        </div>`;
    }

    renderActions() {
        const p = this.project;
        if (!p) return '';
        return `
        <button data-duplicate="${p.id}" class="action-btn" title="Duplicar proyecto">${this.duplicateIcon}</button>
        ${this.isPendingDelete
            ? `<button data-delete="${p.id}" class="confirm-delete">¿Eliminar?</button>`
            : `<button data-delete="${p.id}" class="action-btn" title="Eliminar proyecto">${this.trashIcon}</button>`}`;
    }

    /**
     * Construye una tarjeta visual (Vista Cuadrícula)
     */
    buildCard() {
        const p = this.project;
        if (!p) return '';
        const isTutorial = p.id === 'tutorial_fcc' || p.id === 'demo_iniciacion';

        return `
        <article class="proj-card" data-project-id="${p.id}">
          <div class="proj-thumb ${this.isDark ? 'blueprint' : ''}" data-open="${p.id}" role="button" tabindex="0" title="${this.isOpen ? `Ir a la ventana de ${esc(p.name)}` : `Abrir ${esc(p.name)}`}">
            ${this.thumbSvg}
            ${isTutorial ? '<span class="proj-tag">Tutorial</span>' : ''}
            ${this.isOpen ? '<span class="proj-abierto">Abierto</span>' : ''}
          </div>
          <div class="proj-meta">
            <strong title="${esc(p.name)}">${esc(p.name)}</strong>
            <small>${esc(this.dateText)}${this.summaryText ? ` · ${esc(this.summaryText)}` : ''}</small>
            ${this.renderStageProgress()}
          </div>
          <div class="proj-foot">
            ${this.chipsHtml}
            <span class="proj-acts">${this.renderActions()}</span>
          </div>
        </article>`;
    }

    /**
     * Construye una fila tabular estilo Apple Finder (Vista Lista)
     */
    buildRow() {
        const p = this.project;
        if (!p) return '';
        const stages = this.calculateStages();
        const completed = stages.filter((s) => s.done).length;

        return `
        <tr class="proj-row ${this.isOpen ? 'is-open' : ''}" data-project-id="${p.id}">
          <td class="cell-name" data-open="${p.id}" role="button" tabindex="0">
            <div class="name-wrap">
              <span class="row-indicator ${this.isOpen ? 'open' : ''}"></span>
              <strong title="${esc(p.name)}">${esc(p.name)}</strong>
            </div>
          </td>
          <td class="cell-mode">${this.chipsHtml}</td>
          <td class="cell-progress">
            <div class="progress-pill" title="${completed} de 5 etapas completadas">
              ${this.renderStageProgress()}
              <span class="progress-num">${completed}/5</span>
            </div>
          </td>
          <td class="cell-date"><small>${esc(this.dateText)}</small></td>
          <td class="cell-summary"><small>${esc(this.summaryText)}</small></td>
          <td class="cell-actions">
            <div class="row-acts">
              ${this.renderActions()}
              <button class="open-direct-btn" data-open="${p.id}">${this.isOpen ? 'Activo' : 'Abrir'}</button>
            </div>
          </td>
        </tr>`;
    }

    /**
     * Construye la tarjeta destacada Hero (Seguir donde te quedaste)
     */
    buildHero() {
        const p = this.project;
        if (!p) return '';
        const stages = this.calculateStages();
        const completed = stages.filter((s) => s.done).length;

        return `
        <article class="continue-card" data-project-id="${p.id}">
          <div class="proj-thumb ${this.isDark ? 'blueprint' : ''}" data-open="${p.id}">
            ${this.thumbSvg}
            ${this.isOpen ? '<span class="proj-abierto">Abierto</span>' : ''}
          </div>
          <div class="continue-body">
            <div class="continue-top-meta">
              <span class="continue-eyebrow">Seguir donde te quedaste</span>
              <div class="hero-stage-badge" title="${completed} de 5 etapas completadas">
                ${this.renderStageProgress()}
                <span class="hero-stage-text">${completed}/5 etapas</span>
              </div>
            </div>
            <h2>${esc(p.name)}</h2>
            <div class="continue-info">
              ${this.chipsHtml}
              ${this.summaryText ? `<span class="continue-sub">${esc(this.summaryText)}</span>` : ''}
            </div>
            <div class="continue-foot">
              <small class="continue-date">${esc(this.dateText)}</small>
              <div class="hero-actions-cluster">
                <span class="proj-acts hero-acts">${this.renderActions()}</span>
                <button class="continue-go" data-open="${p.id}">
                  ${this.isOpen ? 'Ir a su ventana' : 'Continuar'}
                </button>
              </div>
            </div>
          </div>
        </article>`;
    }
}

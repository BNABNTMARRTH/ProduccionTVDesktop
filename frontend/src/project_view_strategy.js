/**
 * ProjectViewStrategy implementa el patrón de diseño STRATEGY (GoF).
 * Permite intercambiar dinámicamente entre la vista de Mosaico (Cuadrícula)
 * y la vista de Lista compacta estilo Finder de macOS.
 */

export class ViewStrategy {
    render(projects, builder, container) {
        throw new Error('El método render debe ser implementado por la estrategia concreta.');
    }
}

export class GridViewStrategy extends ViewStrategy {
    render(projects, builder, container, { isOpenFn, isPendingDeleteFn, isDark, thumbFn, chipsFn, summaryFn, dateFn, icons }) {
        if (!projects.length) {
            container.innerHTML = '';
            return;
        }
        container.className = 'proj-grid';
        container.innerHTML = projects.map((p) => {
            builder.reset()
                .setProject(p)
                .withOpenState(isOpenFn(p.id))
                .withDeleteState(isPendingDeleteFn(p.id))
                .withDark(isDark)
                .withThumbnailSvg(thumbFn(p.cfg))
                .withChips(chipsFn(p, { corto: true }))
                .withSummary(summaryFn(p))
                .withDate(dateFn(p.updatedAt))
                .withIcons(icons);
            return builder.buildCard();
        }).join('');
    }
}

export class ListViewStrategy extends ViewStrategy {
    render(projects, builder, container, { isOpenFn, isPendingDeleteFn, isDark, thumbFn, chipsFn, summaryFn, dateFn, icons }) {
        if (!projects.length) {
            container.innerHTML = '';
            return;
        }
        container.className = 'proj-list-wrap';
        const rowsHtml = projects.map((p) => {
            builder.reset()
                .setProject(p)
                .withOpenState(isOpenFn(p.id))
                .withDeleteState(isPendingDeleteFn(p.id))
                .withDark(isDark)
                .withThumbnailSvg(thumbFn(p.cfg))
                .withChips(chipsFn(p, { corto: true }))
                .withSummary(summaryFn(p))
                .withDate(dateFn(p.updatedAt))
                .withIcons(icons);
            return builder.buildRow();
        }).join('');

        container.innerHTML = `
        <table class="proj-list-table">
          <thead>
            <tr>
              <th class="th-name">Nombre</th>
              <th class="th-mode">Modo</th>
              <th class="th-progress">Avance</th>
              <th class="th-date">Modificación</th>
              <th class="th-summary">Detalle</th>
              <th class="th-acts">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>`;
    }
}

export class ProjectViewContext {
    constructor(strategy = new GridViewStrategy()) {
        this.strategy = strategy;
        this.mode = 'grid'; // 'grid' | 'list'
    }

    setStrategy(strategy, mode = 'grid') {
        this.strategy = strategy;
        this.mode = mode;
    }

    getMode() {
        return this.mode;
    }

    render(projects, builder, container, helpers) {
        return this.strategy.render(projects, builder, container, helpers);
    }
}

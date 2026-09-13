import test from 'node:test';
import assert from 'node:assert/strict';
import { UIComponentFactory } from '../frontend/src/ui_component_factory.js';
import { TemplateGridViewStrategy, TemplateListViewStrategy, TemplateViewContext } from '../frontend/src/template_view_strategy.js';
import { TemplateCardBuilder } from '../frontend/src/template_card_builder.js';
import { PLANTILLAS_SET } from '../frontend/src/plantillas.js';

test('GoF Abstract Factory: UIComponentFactory genera controles consistentes Apple HIG', () => {
    // Segmented control
    const seg = UIComponentFactory.createSegmented({
        id: 'test-seg',
        items: [{ id: 'all', label: 'Todas' }, { id: 'live', label: 'En vivo' }],
        activeValue: 'all',
        dataKey: 'mode',
    });
    assert.ok(seg.includes('id="test-seg"'));
    assert.ok(seg.includes('class="seg-btn active"'));
    assert.ok(seg.includes('data-mode="all"'));
    assert.ok(seg.includes('role="tablist"'));

    // Buscador
    const search = UIComponentFactory.createSearchInput({
        id: 'test-search',
        placeholder: 'Buscar set…',
        searchIcon: '<svg></svg>',
    });
    assert.ok(search.includes('id="test-search"'));
    assert.ok(search.includes('class="apple-search-wrap"'));
    assert.ok(search.includes('placeholder="Buscar set…"'));

    // Botones primario y secundario
    const btnPrim = UIComponentFactory.createButton({ label: 'Crear', variant: 'primary' });
    assert.ok(btnPrim.includes('class="apple-primary-btn"'));
    assert.ok(btnPrim.includes('Crear'));

    const btnSec = UIComponentFactory.createButton({ label: 'En blanco', variant: 'secondary' });
    assert.ok(btnSec.includes('class="apple-secondary-btn"'));
    assert.ok(btnSec.includes('En blanco'));
});

test('GoF Strategy: TemplateViewStrategy intercambia fluidamente entre Mosaico y Lista', () => {
    const builder = new TemplateCardBuilder();
    const fakeCfg = () => ({ camaras: [{ id: 'c1' }], microfonos: [{ id: 'm1' }], sets: [{}] });
    const fakeThumb = () => '<svg></svg>';

    const context = new TemplateViewContext(new TemplateGridViewStrategy());
    assert.equal(context.getMode(), 'grid');

    // Renderizado en Cuadrícula
    const gridHtml = context.render(PLANTILLAS_SET.slice(0, 2), {
        builder,
        cfgFn: fakeCfg,
        thumbFn: fakeThumb,
        isDark: true,
    });
    assert.ok(gridHtml.includes('class="tpl-grid"'));
    assert.ok(gridHtml.includes('class="tpl-card"'));
    assert.ok(gridHtml.includes('tpl-cat-badge'));

    // Cambiar a Lista (tipo Finder)
    context.setStrategy(new TemplateListViewStrategy(), 'list');
    assert.equal(context.getMode(), 'list');

    const listHtml = context.render(PLANTILLAS_SET.slice(0, 2), {
        builder,
        cfgFn: fakeCfg,
        thumbFn: fakeThumb,
        isDark: true,
    });
    assert.ok(listHtml.includes('class="tpl-table"'));
    assert.ok(listHtml.includes('class="tpl-row"'));
    assert.ok(listHtml.includes('Catálogo técnico de plantillas'));
});

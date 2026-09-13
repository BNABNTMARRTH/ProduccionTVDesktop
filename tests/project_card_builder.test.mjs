import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCardBuilder } from '../frontend/src/project_card_builder.js';
import { GridViewStrategy, ListViewStrategy, ProjectViewContext } from '../frontend/src/project_view_strategy.js';

test('ProjectCardBuilder: calcula correctamente el avance de las 5 etapas', () => {
    const builder = new ProjectCardBuilder();

    // Proyecto completo
    const pCompleto = {
        id: 'p1',
        name: 'Noticiero Completo',
        cfg: {
            titulo: 'Noticiero 24H',
            escaleta: [{ id: 's1', dur: 120 }],
            camaras: [{ id: 'c1' }],
            sets: [{ id: 'set1' }],
        },
    };

    builder.setProject(pCompleto);
    const etapas = builder.calculateStages();
    assert.equal(etapas.length, 5);
    assert.equal(etapas.every((e) => e.done), true);

    const progressHtml = builder.renderStageProgress();
    assert.ok(progressHtml.includes('aria-valuenow="5"'));
    assert.ok(progressHtml.includes('data-step="salida"'));

    // Proyecto inicial (solo perfil)
    const pInicial = {
        id: 'p2',
        name: 'Idea en borrador',
        cfg: {
            titulo: 'Mi nuevo podcast',
        },
    };

    builder.setProject(pInicial);
    const etapasInicial = builder.calculateStages();
    assert.equal(etapasInicial.find((e) => e.id === 'perfil').done, true);
    assert.equal(etapasInicial.find((e) => e.id === 'guion').done, false);
    assert.equal(etapasInicial.find((e) => e.id === 'salida').done, false);
});

test('ProjectCardBuilder: construye Card, Row y Hero con soporte Blueprint y estados', () => {
    const builder = new ProjectCardBuilder();
    const project = {
        id: 'p-test',
        name: 'Producción Central',
        cfg: { titulo: 'Central' },
    };

    builder.reset()
        .setProject(project)
        .withOpenState(true)
        .withDark(true)
        .withThumbnailSvg('<svg>mock</svg>')
        .withChips('<span class="chip">EN VIVO</span>')
        .withSummary('3 cámaras · 15:00')
        .withDate('Hoy, 01:00 p.m.');

    const cardHtml = builder.buildCard();
    assert.ok(cardHtml.includes('class="proj-card"'));
    assert.ok(cardHtml.includes('class="proj-thumb blueprint"'));
    assert.ok(cardHtml.includes('class="proj-abierto"'));
    assert.ok(cardHtml.includes('Producción Central'));

    const rowHtml = builder.buildRow();
    assert.ok(rowHtml.includes('<tr class="proj-row is-open"'));
    assert.ok(rowHtml.includes('class="open-direct-btn"'));
    assert.ok(rowHtml.includes('3 cámaras · 15:00'));

    const heroHtml = builder.buildHero();
    assert.ok(heroHtml.includes('class="continue-card"'));
    assert.ok(heroHtml.includes('Seguir donde te quedaste'));
    assert.ok(heroHtml.includes('Ir a su ventana'));
});

test('ProjectViewStrategy: intercambia dinámicamente entre vista de cuadrícula y lista', () => {
    const builder = new ProjectCardBuilder();
    const context = new ProjectViewContext(new GridViewStrategy());
    assert.equal(context.getMode(), 'grid');

    const proyectos = [
        { id: '1', name: 'Show A', cfg: {} },
        { id: '2', name: 'Show B', cfg: {} },
    ];

    const fakeContainer = { innerHTML: '', className: '' };
    const helpers = {
        isOpenFn: () => false,
        isPendingDeleteFn: () => false,
        isDark: false,
        thumbFn: () => '<svg></svg>',
        chipsFn: () => '<span>Live</span>',
        summaryFn: () => 'Resumen',
        dateFn: () => 'Hoy',
        icons: { duplicate: '', trash: '' },
    };

    // Render Cuadrícula
    context.render(proyectos, builder, fakeContainer, helpers);
    assert.equal(fakeContainer.className, 'proj-grid');
    assert.ok(fakeContainer.innerHTML.includes('class="proj-card"'));

    // Cambiar a Lista (tipo Finder)
    context.setStrategy(new ListViewStrategy(), 'list');
    assert.equal(context.getMode(), 'list');

    context.render(proyectos, builder, fakeContainer, helpers);
    assert.equal(fakeContainer.className, 'proj-list-wrap');
    assert.ok(fakeContainer.innerHTML.includes('class="proj-list-table"'));
    assert.ok(fakeContainer.innerHTML.includes('<tr class="proj-row'));
});

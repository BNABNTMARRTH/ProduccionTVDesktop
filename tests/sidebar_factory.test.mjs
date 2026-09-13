import test from 'node:test';
import assert from 'node:assert/strict';
import { UIComponentFactory } from '../frontend/src/ui_component_factory.js';

test('GoF Abstract Factory: UIComponentFactory genera botones de barra lateral con accesibilidad y estados', () => {
    const btn = UIComponentFactory.createSidebarButton({
        id: 'test-btn',
        accion: 'proyectos',
        label: 'Proyectos',
        iconSvg: '<svg class="test-icon"></svg>',
        isActive: true,
        title: 'Todos tus proyectos',
    });

    assert.ok(btn.includes('id="test-btn"'));
    assert.ok(btn.includes('data-accion="proyectos"'));
    assert.ok(btn.includes('class="active"'));
    assert.ok(btn.includes('title="Todos tus proyectos"'));
    assert.ok(btn.includes('<em>Proyectos</em>'));
    assert.ok(btn.includes('<span class="ic"><svg class="test-icon"></svg></span>'));
});

test('GoF Abstract Factory: UIComponentFactory genera botones de etapa con número insignia', () => {
    const btnEtapa = UIComponentFactory.createSidebarButton({
        etapaId: 'guion',
        label: 'Guion',
        iconSvg: '<svg></svg>',
        badgeNum: 2,
        isActive: false,
        title: 'Fase 2 de producción',
    });

    assert.ok(btnEtapa.includes('data-etapa="guion"'));
    assert.ok(btnEtapa.includes('<b class="rail-num">2</b>'));
    assert.ok(btnEtapa.includes('<em>Guion</em>'));
    assert.ok(!btnEtapa.includes('active'));
});

test('GoF Abstract Factory: UIComponentFactory genera separadores y grupos de barra lateral', () => {
    const sep = UIComponentFactory.createSidebarDivider();
    assert.ok(sep.includes('class="rail-sep"'));
    assert.ok(sep.includes('aria-hidden="true"'));

    const grp = UIComponentFactory.createSidebarGroup({
        id: 'rail-home',
        itemsHtml: '<button>Item 1</button>',
        hidden: true,
    });
    assert.ok(grp.includes('id="rail-home"'));
    assert.ok(grp.includes('hidden'));
    assert.ok(grp.includes('<button>Item 1</button>'));
});

test('GoF Abstract Factory: UIComponentFactory genera encabezado fijo superior accesible', () => {
    const header = UIComponentFactory.createStickyHeader({
        id: 'top-header-test',
        caption: 'PRODUCCIÓN AUDIOVISUAL',
        title: 'Plantillas de set',
        subtitle: 'Subtítulo explicativo',
        toolsHtml: '<div class="tools-test">Tools</div>',
    });

    assert.ok(header.includes('id="top-header-test"'));
    assert.ok(header.includes('class="home-top"'));
    assert.ok(header.includes('class="home-top-inner"'));
    assert.ok(header.includes('PRODUCCIÓN AUDIOVISUAL'));
    assert.ok(header.includes('<h1 class="home-heading">Plantillas de set</h1>'));
    assert.ok(header.includes('Subtítulo explicativo'));
    assert.ok(header.includes('<div class="tools-test">Tools</div>'));
    assert.ok(header.includes('role="banner"'));
});

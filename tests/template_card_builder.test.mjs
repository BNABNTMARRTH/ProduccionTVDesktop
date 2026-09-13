import test from 'node:test';
import assert from 'node:assert/strict';
import { TemplateCardBuilder } from '../frontend/src/template_card_builder.js';
import { createTemplateFilterChain, TemplateCategoryFilterHandler, TemplateSearchFilterHandler } from '../frontend/src/template_filter_chain.js';
import { PLANTILLAS_SET, cloneTemplate } from '../frontend/src/plantillas.js';

test('GoF Builder: TemplateCardBuilder construye tarjeta con chips de hardware y badges Apple HIG', () => {
    const builder = new TemplateCardBuilder();
    const tpl = {
        id: 'noticiero',
        nombre: 'Noticiero central',
        category: 'multicam',
        resumen: 'Set de 3 cámaras para informativo',
        detalle: 'Mesa de conducción con dos tiros frontales y paneo',
    };
    const cfg = {
        camaras: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
        microfonos: [{ id: 'm1' }, { id: 'm2' }],
        sets: [{ iluminacion: { luces: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }] } }],
    };

    const html = builder.build(tpl, cfg, '<svg id="mini-cenital"></svg>', false);

    assert.ok(html.includes('data-plantilla="noticiero"'), 'Debe contener el atributo data-plantilla');
    assert.ok(html.includes('Noticiero central'), 'Debe incluir el título de la plantilla');
    assert.ok(html.includes('Multic\u00e1mara'), 'Debe incluir el badge de la categoría');
    assert.ok(html.includes('3 cams'), 'Debe calcular y renderizar el chip de 3 cámaras');
    assert.ok(html.includes('2 mics'), 'Debe calcular y renderizar el chip de 2 micrófonos');
    assert.ok(html.includes('4 luces'), 'Debe calcular y renderizar el chip de 4 luces');
    assert.ok(html.includes('id="mini-cenital"'), 'Debe incrustar el SVG del plano cenital');
});

test('GoF Prototype: cloneTemplate clona limpiamente una plantilla evitando mutaciones colaterales', () => {
    const base = PLANTILLAS_SET[0];
    const clon = cloneTemplate(base.id);

    assert.equal(clon.id, base.id);
    assert.equal(clon.nombre, base.nombre);
    assert.notEqual(clon, base, 'El objeto clonado debe ser una referencia diferente');

    // Mutamos una propiedad profunda del clon
    clon.talentos.push({ name: 'Nuevo panelista', tipo: 'invitado' });
    clon.plano.mesa.x = 999;
    assert.notEqual(clon.talentos.length, base.talentos.length, 'La base no debe mutar al alterar talentos del clon');
    assert.notEqual(clon.plano.mesa.x, base.plano.mesa.x, 'El objeto plano no debe mutar en la base');
});

test('GoF Chain of Responsibility: TemplateFilterChain filtra por categoría y texto', () => {
    const chain = createTemplateFilterChain();

    // Filtrar categoría dialogue
    const dialogo = chain.handle(PLANTILLAS_SET, { category: 'dialogue' });
    assert.ok(dialogo.length > 0);
    assert.ok(dialogo.every((p) => p.category === 'dialogue'));

    // Filtrar categoría multicam
    const multi = chain.handle(PLANTILLAS_SET, { category: 'multicam' });
    assert.ok(multi.length > 0);
    assert.ok(multi.every((p) => p.category === 'multicam'));

    // Filtrar categoría special
    const esp = chain.handle(PLANTILLAS_SET, { category: 'special' });
    assert.ok(esp.length > 0);
    assert.ok(esp.every((p) => p.category === 'special'));

    // Filtrar por texto
    const busqueda = chain.handle(PLANTILLAS_SET, { query: 'croma' });
    assert.equal(busqueda.length, 1);
    assert.equal(busqueda[0].id, 'croma');

    // Categoría 'all' devuelve todas las plantillas
    const todas = chain.handle(PLANTILLAS_SET, { category: 'all' });
    assert.equal(todas.length, PLANTILLAS_SET.length);
});

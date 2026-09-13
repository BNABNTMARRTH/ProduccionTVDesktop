import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelProxy } from '../frontend/src/panel_proxy.js';

test('PanelProxy: sincronización y control de versiones por sello', () => {
    const proxy = new PanelProxy({
        id: 'guion',
        src: './tools/infografias/index.html?herramienta=guion',
        title: 'Guion Técnico',
    });

    assert.equal(proxy.sello, 0);
    assert.equal(proxy.needsUpdate(1), true);

    proxy.markUpdated(1);
    assert.equal(proxy.sello, 1);
    assert.equal(proxy.needsUpdate(1), false);
    assert.equal(proxy.needsUpdate(2), true);
});

test('PanelProxy: inicialización diferida y carga', () => {
    // Mock ligero de document y container
    const appended = [];
    const container = {
        appendChild: (child) => appended.push(child),
    };

    globalThis.document = {
        createElement: (tag) => ({
            tagName: tag.toUpperCase(),
            dataset: {},
            onload: null,
            remove: function() { this.removed = true; },
        }),
    };

    const proxy = new PanelProxy({
        id: 'escaleta',
        src: './tools/infografias/index.html?herramienta=escaleta',
    });

    assert.equal(proxy.el, null);
    proxy.show(container);
    assert.ok(proxy.el);
    assert.equal(proxy.el.dataset.panel, 'escaleta');
    assert.equal(appended.length, 1);

    proxy.destroy();
    assert.equal(proxy.el, null);
});

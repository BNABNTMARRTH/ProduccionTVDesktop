import test from 'node:test';
import assert from 'node:assert/strict';
import { crearPestanas, PRINCIPAL } from '../frontend/src/pestanas.js';

test('crearPestanas: renderiza inmediatamente la pestaña Proyecto y el botón + al crearse', () => {
    let htmlContent = '';
    const mockBarra = {
        hidden: true,
        get innerHTML() { return htmlContent; },
        set innerHTML(val) { htmlContent = val; },
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {},
        setAttribute: () => {},
    };

    const pestanas = crearPestanas({
        barra: mockBarra,
        alActivar: () => {},
        alCerrar: () => {},
        alSacar: () => {},
        alPedirModulo: () => {},
        etiquetaDe: (id) => id,
        iconoDe: () => '',
    });

    // Debe mostrar la barra y dibujar el HTML inicial con la pestaña Proyecto y el botón +
    assert.equal(mockBarra.hidden, false);
    assert.ok(htmlContent.includes(`data-pestana="${PRINCIPAL}"`));
    assert.ok(htmlContent.includes('id="pestana-mas"'));
    assert.equal(pestanas.activa, PRINCIPAL);
    assert.deepEqual(pestanas.abiertas, []);
});

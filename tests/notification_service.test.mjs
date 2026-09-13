import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../frontend/src/notification_service.js';

test('NotificationService: suscribe y notifica observadores', () => {
    const service = new NotificationService();
    const eventos = [];

    const unsubscribe = service.subscribe((data) => {
        eventos.push(data);
    });

    service.show('Proyecto guardado exitosamente');
    service.show('Error al exportar', { error: true });

    assert.equal(eventos.length, 2);
    assert.equal(eventos[0].message, 'Proyecto guardado exitosamente');
    assert.equal(eventos[0].error, false);
    assert.equal(eventos[1].error, true);

    unsubscribe();
    service.show('Otro mensaje');
    assert.equal(eventos.length, 2);
});

test('NotificationService: manipula atributos ARIA y clases en contenedor', () => {
    const clases = new Set();
    const atributos = {};
    const mockContainer = {
        textContent: '',
        classList: {
            add: (c) => clases.add(c),
            remove: (c) => clases.delete(c),
            toggle: (c, cond) => (cond ? clases.add(c) : clases.delete(c)),
        },
        setAttribute: (k, v) => { atributos[k] = v; },
    };

    const service = new NotificationService({ container: mockContainer });
    service.show('Fallo crítico', { error: true });

    assert.equal(mockContainer.textContent, 'Fallo crítico');
    assert.ok(clases.has('show'));
    assert.ok(clases.has('error'));
    assert.equal(atributos['role'], 'alert');
    assert.equal(atributos['aria-live'], 'assertive');

    service.dismiss();
    assert.equal(clases.has('show'), false);
});

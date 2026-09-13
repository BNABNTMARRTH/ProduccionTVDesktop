import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, SHELL_EVENTS } from '../frontend/src/event_bus.js';

test('EventBus: suscripción y emisión de eventos desacoplados', () => {
    const bus = new EventBus();
    const capturados = [];

    const unsubscribe = bus.on(SHELL_EVENTS.PROJECT_SAVED, (data) => {
        capturados.push(data);
    });

    bus.emit(SHELL_EVENTS.PROJECT_SAVED, { id: 'p-1', name: 'Show en Vivo' });
    assert.equal(capturados.length, 1);
    assert.equal(capturados[0].id, 'p-1');

    unsubscribe();
    bus.emit(SHELL_EVENTS.PROJECT_SAVED, { id: 'p-2' });
    assert.equal(capturados.length, 1);
});

test('EventBus: listeners con once() se ejecutan una sola vez', () => {
    const bus = new EventBus();
    let llamadas = 0;

    bus.once(SHELL_EVENTS.VIEW_CHANGED, () => {
        llamadas += 1;
    });

    bus.emit(SHELL_EVENTS.VIEW_CHANGED, { view: 'guion' });
    bus.emit(SHELL_EVENTS.VIEW_CHANGED, { view: 'escaleta' });

    assert.equal(llamadas, 1);
});

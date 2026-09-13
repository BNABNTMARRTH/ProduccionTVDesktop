import test from 'node:test';
import assert from 'node:assert/strict';
import { ShortcutManager } from '../frontend/src/shortcut_manager.js';

test('ShortcutManager: atajo Escape cierra capas abiertas en orden de precedencia', () => {
    let welcomeCerrado = false;
    let ajustesCerrado = false;
    let railDesplegado = false;

    const manager = new ShortcutManager({
        getContext: () => ({
            isWelcomeOpen: true,
            closeWelcome: () => { welcomeCerrado = true; },
            isAjustesOpen: true,
            closeAjustes: () => { ajustesCerrado = true; },
            desplegarRail: () => { railDesplegado = true; },
        }),
    });

    const consumido = manager.dispatch({ key: 'Escape' });
    assert.equal(consumido, true);
    assert.equal(welcomeCerrado, true);
    assert.equal(ajustesCerrado, false);
    assert.equal(railDesplegado, false);
});

test('ShortcutManager: Cmd+S dispara flushSaveNow', () => {
    let guardado = false;
    const manager = new ShortcutManager({
        getContext: () => ({
            flushSaveNow: () => { guardado = true; },
        }),
    });

    const consumido = manager.dispatch({ key: 's', metaKey: true });
    assert.equal(consumido, true);
    assert.equal(guardado, true);
});

test('ShortcutManager: Ctrl+Tab rota entre pestañas', () => {
    let pestanaActiva = 'principal';
    const manager = new ShortcutManager({
        getContext: () => ({
            PRINCIPAL: 'principal',
            pestanas: {
                activa: pestanaActiva,
                abiertas: ['guion', 'escaleta'],
            },
            activarPestana: (id) => { pestanaActiva = id; },
        }),
    });

    const consumido = manager.dispatch({ key: 'Tab', ctrlKey: true, shiftKey: false });
    assert.equal(consumido, true);
    assert.equal(pestanaActiva, 'guion');
});

test('ShortcutManager: Cmd+1..Cmd+6 navega a etapas', () => {
    let vistaSeleccionada = null;
    const manager = new ShortcutManager({
        getContext: () => ({
            etapas: [
                { id: 'etapa1', titulo: 'Concepción' },
                { id: 'etapa2', titulo: 'Guion' },
            ],
            primeraVista: (e) => (e.id === 'etapa1' ? 'perfil' : 'guion'),
            selectView: (v) => { vistaSeleccionada = v; },
        }),
    });

    const consumido = manager.dispatch({ key: '1', metaKey: true });
    assert.equal(consumido, true);
    assert.equal(vistaSeleccionada, 'perfil');
});

test('ShortcutManager: Cmd+Shift+H navega a Inicio', () => {
    let fueAInicio = false;
    const manager = new ShortcutManager({
        getContext: () => ({
            irAInicio: () => { fueAInicio = true; },
        }),
    });

    const consumido = manager.dispatch({ key: 'h', metaKey: true, shiftKey: true });
    assert.equal(consumido, true);
    assert.equal(fueAInicio, true);
});


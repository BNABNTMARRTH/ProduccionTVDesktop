import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectMemento, ProjectHistoryManager } from '../frontend/src/project_memento.js';

test('ProjectMemento: crea snapshots inmutables y los restaura', () => {
    const original = {
        id: 'p-1',
        name: 'Noticiero 1',
        template: 'noticiero',
        cfg: { titulo: 'Noticiero 1', camaras: [{ id: 'cam1' }] },
        diagram: { nodos: ['nodo1'] },
    };

    const memento = new ProjectMemento(original);

    // Mutar el objeto original no debe afectar al memento
    original.cfg.camaras.push({ id: 'cam2' });
    original.name = 'Mutado';

    const restaurado = memento.restore();
    assert.equal(restaurado.name, 'Noticiero 1');
    assert.equal(restaurado.cfg.camaras.length, 1);
});

test('ProjectHistoryManager: deshacer y rehacer con límite de profundidad', () => {
    const history = new ProjectHistoryManager({ maxDepth: 5 });

    const p1 = { id: 'p-1', name: 'Versión 1', cfg: { modo: 'live' } };
    const p2 = { id: 'p-1', name: 'Versión 2', cfg: { modo: 'live' } };
    const p3 = { id: 'p-1', name: 'Versión 3', cfg: { modo: 'live' } };

    history.saveSnapshot(p1);
    assert.equal(history.canUndo(), false);

    history.saveSnapshot(p2);
    assert.equal(history.canUndo(), true);

    history.saveSnapshot(p3);
    assert.equal(history.canUndo(), true);
    assert.equal(history.canRedo(), false);

    // Undo a p2
    const undo1 = history.undo(p3);
    assert.equal(undo1.name, 'Versión 2');
    assert.equal(history.canRedo(), true);

    // Undo a p1
    const undo2 = history.undo(undo1);
    assert.equal(undo2.name, 'Versión 1');

    // Redo a p2
    const redo1 = history.redo(undo2);
    assert.equal(redo1.name, 'Versión 2');
});

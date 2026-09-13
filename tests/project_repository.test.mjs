import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectRepository, bundleDeProyecto, proyectoDesdeBundle } from '../frontend/src/project_repository.js';

class MockStorage {
    constructor() {
        this.store = new Map();
    }
    getItem(key) {
        return this.store.get(key) || null;
    }
    setItem(key, val) {
        this.store.set(key, String(val));
    }
    removeItem(key) {
        this.store.delete(key);
    }
}

test('ProjectRepository: serializa y deserializa bundles .ptv correctamente', () => {
    const proyecto = {
        id: 'p-123',
        name: 'Noticiero Estelar',
        template: 'noticiero',
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T01:00:00.000Z',
        cfg: { titulo: 'Noticiero Estelar', modo: 'live', camaras: [{ id: 'cam1' }] },
        diagram: { nodos: [] },
    };

    const bundleStr = bundleDeProyecto(proyecto);
    const parsed = JSON.parse(bundleStr);
    assert.equal(parsed.project.name, 'Noticiero Estelar');
    assert.equal(parsed.infographic.modo, 'live');

    const recuperado = proyectoDesdeBundle(parsed, { conservarId: true });
    assert.equal(recuperado.id, 'p-123');
    assert.equal(recuperado.name, 'Noticiero Estelar');
    assert.equal(recuperado.cfg.modo, 'live');
});

test('ProjectRepository: operaciones CRUD con caché y persistencia', () => {
    const storage = new MockStorage();
    let discoGuardado = null;
    let discoBorrado = null;

    const repo = new ProjectRepository({
        storage,
        saveProjectFile: async (id, bundle) => { discoGuardado = { id, bundle }; },
        deleteProjectFile: async (id) => { discoBorrado = id; },
    });

    assert.deepEqual(repo.getAll(), []);

    // Guardar nuevo proyecto
    const nuevo = {
        id: 'p-1',
        name: 'Magacín Matutino',
        cfg: { camaras: [] },
    };
    repo.save(nuevo);

    assert.equal(repo.getAll().length, 1);
    assert.equal(repo.getById('p-1').name, 'Magacín Matutino');
    assert.ok(discoGuardado);
    assert.equal(discoGuardado.id, 'p-1');

    // Manejar proyecto activo
    repo.setActiveId('p-1');
    assert.equal(repo.getActiveId(), 'p-1');

    // Eliminar proyecto
    repo.delete('p-1');
    assert.equal(repo.getAll().length, 0);
    assert.equal(repo.getActiveId(), '');
    assert.equal(discoBorrado, 'p-1');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetFlyweightCache } from '../frontend/src/asset_cache.js';

test('AssetFlyweightCache: almacena y recupera activos compartidos', () => {
    const cache = new AssetFlyweightCache({ maxEntries: 3 });

    cache.set('diag-1', { svg: '<svg>Plano 1</svg>' });
    cache.set('diag-2', { svg: '<svg>Plano 2</svg>' });

    assert.equal(cache.has('diag-1'), true);
    assert.equal(cache.get('diag-1').svg, '<svg>Plano 1</svg>');
    assert.equal(cache.size, 2);
});

test('AssetFlyweightCache: desaloja elementos más antiguos al exceder capacidad (LRU)', () => {
    const cache = new AssetFlyweightCache({ maxEntries: 2 });

    cache.set('a', 1);
    cache.set('b', 2);
    // Acceder a 'a' para que 'b' sea el menos recientemente usado
    cache.get('a');

    // Añadir 'c' debe desalojar 'b'
    cache.set('c', 3);

    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('c'), true);
    assert.equal(cache.size, 2);
});

test('AssetFlyweightCache: diferencia llaves de tema claro y oscuro para evitar inconsistencias visuales', () => {
    const cache = new AssetFlyweightCache();
    const projId = 'proj-101';

    const keyDark = `${projId}:dark`;
    const keyLight = `${projId}:light`;

    cache.set(keyDark, '<svg class="dark">Blueprint Dark</svg>');
    cache.set(keyLight, '<svg class="light">Blueprint Light</svg>');

    assert.equal(cache.get(keyDark), '<svg class="dark">Blueprint Dark</svg>');
    assert.equal(cache.get(keyLight), '<svg class="light">Blueprint Light</svg>');
    assert.notEqual(cache.get(keyDark), cache.get(keyLight));

    // Invalidation upon save/delete
    cache.delete(keyDark);
    cache.delete(keyLight);
    assert.equal(cache.has(keyDark), false);
    assert.equal(cache.has(keyLight), false);
});


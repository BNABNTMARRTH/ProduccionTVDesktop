import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectFilterChain, TextSearchHandler, ModeFilterHandler, ChronologicalSortHandler } from '../frontend/src/project_filter_chain.js';

test('ProjectFilterChain: busca por texto en nombre, título y mensaje', () => {
    const handler = new TextSearchHandler();
    const proyectos = [
        { name: 'Noticiero 24H', cfg: { titulo: 'Noticiero 24H' } },
        { name: 'Documental Selva', cfg: { titulo: 'La Selva', perfil: { mensaje: 'Biodiversidad' } } },
        { name: 'Podcast Tech', cfg: { titulo: 'Episodio 1' } },
    ];

    const filtrados1 = handler.handle(proyectos, { query: 'selva' });
    assert.equal(filtrados1.length, 1);
    assert.equal(filtrados1[0].name, 'Documental Selva');

    const filtrados2 = handler.handle(proyectos, { query: 'bio' });
    assert.equal(filtrados2.length, 1);
    assert.equal(filtrados2[0].name, 'Documental Selva');
});

test('ProjectFilterChain: filtra por modo y ordena cronológicamente', () => {
    const chain = new ProjectFilterChain();
    const proyectos = [
        { id: '1', name: 'Show A', cfg: { modo: 'live' }, updatedAt: '2026-09-10T10:00:00Z' },
        { id: '2', name: 'Show B', cfg: { modo: 'narrative' }, updatedAt: '2026-09-12T10:00:00Z' },
        { id: '3', name: 'Show C', cfg: { modo: 'live' }, updatedAt: '2026-09-11T10:00:00Z' },
    ];

    // Filtrar solo live
    const liveOrdenados = chain.execute(proyectos, { mode: 'live' });
    assert.equal(liveOrdenados.length, 2);
    assert.equal(liveOrdenados[0].id, '3'); // Más reciente primero
    assert.equal(liveOrdenados[1].id, '1');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    HelpStrategy,
    HomeHelpStrategy,
    ProfileHelpStrategy,
    ScriptHelpStrategy,
    NeedsHelpStrategy,
    PlanningHelpStrategy,
    DocumentsHelpStrategy,
    LiveProductionHelpStrategy,
    DefaultHelpStrategy
} from '../frontend/src/help_system/help_strategy.js';
import { HelpManager } from '../frontend/src/help_system/help_manager.js';

test('GoF Strategy: Cada estrategia concreta implementa el contrato HelpStrategy', () => {
    const strategies = [
        new HomeHelpStrategy(),
        new ProfileHelpStrategy(),
        new ScriptHelpStrategy(),
        new NeedsHelpStrategy(),
        new PlanningHelpStrategy(),
        new DocumentsHelpStrategy(),
        new LiveProductionHelpStrategy(),
        new DefaultHelpStrategy()
    ];

    for (const s of strategies) {
        assert.ok(s instanceof HelpStrategy, `${s.id} debe heredar de HelpStrategy`);
        assert.ok(typeof s.id === 'string' && s.id.length > 0);
        assert.ok(typeof s.title === 'string' && s.title.length > 0);
        assert.ok(typeof s.stageBadge === 'string');
        assert.ok(typeof s.summary === 'string');
        assert.ok(Array.isArray(s.getTips()), `${s.id} getTips() debe devolver array`);
        assert.ok(Array.isArray(s.getShortcuts()), `${s.id} getShortcuts() debe devolver array`);
    }
});

test('HelpManager: Resuelve la estrategia contextual correcta según la sección activa', () => {
    const manager = new HelpManager();

    // Inicio / Plantillas
    assert.equal(manager.resolveStrategy('home').id, 'home');
    assert.equal(manager.resolveStrategy('plantillas').id, 'home');

    // Etapa 1: Perfil y Mesa de luz
    assert.equal(manager.resolveStrategy('perfil').id, 'perfil');
    assert.equal(manager.resolveStrategy('referencias').id, 'perfil');

    // Etapa 2: Guion literario, escaleta, tiempos
    assert.equal(manager.resolveStrategy('guionLiterario').id, 'guion');
    assert.equal(manager.resolveStrategy('escaleta').id, 'guion');
    assert.equal(manager.resolveStrategy('tiempos').id, 'guion');

    // Etapa 3: Necesidades, agenda, diagrama
    assert.equal(manager.resolveStrategy('necesidades').id, 'necesidades');
    assert.equal(manager.resolveStrategy('agenda').id, 'necesidades');
    assert.equal(manager.resolveStrategy('diagrama').id, 'necesidades');

    // Etapa 4: Set y Visor 3D, infografías
    const planningStrategy = manager.resolveStrategy('set');
    assert.equal(planningStrategy.id, 'planeacion');
    assert.ok(planningStrategy.getTips().some(t => t.titulo.includes('Visor 3D')));
    assert.equal(manager.resolveStrategy('infografias').id, 'planeacion');

    // Salida: Exportar
    const exportStrategy = manager.resolveStrategy('exportar');
    assert.equal(exportStrategy.id, 'salida');
    assert.ok(exportStrategy.getTips().some(t => t.titulo.includes('EDL')));

    // Ensayo: Producción / Sala de control con OBS
    const liveStrategy = manager.resolveStrategy('production');
    assert.equal(liveStrategy.id, 'ensayo');
    assert.ok(liveStrategy.getTips().some(t => t.titulo.includes('OBS')));
});

test('HelpManager: Resuelve fallback seguro ante vistas no mapeadas', () => {
    const manager = new HelpManager();

    const fallback = manager.resolveStrategy('seccion_inexistente_xyz');
    assert.equal(fallback.id, 'default');
    assert.ok(fallback.title.includes('Producción TV'));
});

test('GoF Open/Closed: HelpManager permite registrar dinámicamente nuevas estrategias y mapeos', () => {
    const manager = new HelpManager();

    class TeleprompterHelpStrategy extends HelpStrategy {
        constructor() {
            super({
                id: 'teleprompter_custom',
                title: 'Ayuda Especial Teleprompter',
                stageBadge: 'Prompter',
                summary: 'Control de espejo y velocidad de scroll.',
                tips: [{ titulo: 'Velocidad', descripcion: 'Flechas arriba/abajo regulan la velocidad.' }]
            });
        }
    }

    manager.registerStrategy('teleprompter_custom', new TeleprompterHelpStrategy());
    manager.mapViewToStrategy('prompter_view', 'teleprompter_custom');

    const resuelta = manager.resolveStrategy('prompter_view');
    assert.equal(resuelta.id, 'teleprompter_custom');
    assert.equal(resuelta.title, 'Ayuda Especial Teleprompter');
    assert.equal(resuelta.getTips()[0].titulo, 'Velocidad');
});

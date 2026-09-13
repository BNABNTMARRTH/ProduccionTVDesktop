import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductionFSM } from '../frontend/src/production_fsm.js';
import { PreflightChecklistComposite, buildPreflightChecklist, ProductionCommandManager } from '../frontend/src/production.js';

test('GoF State Pattern: ProductionFSM cicla correctamente entre estados y avanza el tiempo en vivo', async () => {
    let tickCount = 0;
    let ensayoMarcado = false;
    const programaMock = {
        total: 120,
        pasos: [
            { i: 0, t0: 0, t1: 30, dur: 30, aire: 'cam1', segNombre: 'Intro' },
            { i: 1, t0: 30, t1: 75, dur: 45, aire: 'cam2', segNombre: 'Noticia' },
            { i: 2, t0: 75, t1: 120, dur: 45, aire: 'cam3', segNombre: 'Cierre' },
        ],
    };

    const fsm = new ProductionFSM({
        onTick: () => { tickCount++; },
        onEnsayo: () => { ensayoMarcado = true; },
        getPrograma: () => programaMock,
    });

    // 1. Estado inicial detenido
    assert.equal(fsm.isRunning, false);
    assert.equal(fsm.isStopped, true);
    assert.equal(fsm.isPaused, false);
    assert.equal(fsm.playLabel, '▶ Arrancar');
    assert.equal(fsm.transcurrido(), 0);

    // 2. Transición a Running (Arrancar)
    fsm.toggle();
    assert.equal(fsm.isRunning, true);
    assert.equal(fsm.isStopped, false);
    assert.equal(fsm.isPaused, false);
    assert.equal(fsm.playLabel, 'Ⅱ Pausa');
    assert.equal(ensayoMarcado, true);

    // Esperar 50ms para verificar que el tiempo transcurrido avanza (no se congela)
    await new Promise((r) => setTimeout(r, 60));
    const tTranscurrido = fsm.transcurrido();
    assert.ok(tTranscurrido > 0.04, `El tiempo debe avanzar mientras está corriendo, actual: ${tTranscurrido}`);

    // 3. Transición a Paused (Pausa)
    fsm.toggle();
    assert.equal(fsm.isRunning, false);
    assert.equal(fsm.isPaused, true);
    assert.equal(fsm.playLabel, '▶ Seguir');
    const tEnPausa = fsm.transcurrido();
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(fsm.transcurrido(), tEnPausa, 'En pausa el tiempo acumulado debe mantenerse congelado');

    // 4. Seek en la línea de tiempo (GoF Command / FSM Seek)
    fsm.seek(45);
    assert.equal(fsm.transcurrido(), 45);

    // 5. Next Step y Prev Step deterministas basados en tiempo real
    fsm.seek(20);
    assert.equal(fsm.transcurrido(), 20);

    // En t = 20 (dentro del paso 0: 0-30s), nextStep salta al paso 1 (t0 = 30)
    fsm.nextStep();
    assert.equal(fsm.transcurrido(), 30, 'NextStep debe avanzar al siguiente paso hacia adelante');

    // En t = 30, nextStep salta al paso 2 (t0 = 75)
    fsm.nextStep();
    assert.equal(fsm.transcurrido(), 75, 'NextStep debe avanzar secuencialmente sin estancarse');

    // En t = 75 (inicio del paso 2), prevStep retrocede al inicio del paso 1 (t0 = 30)
    fsm.prevStep();
    assert.equal(fsm.transcurrido(), 30, 'PrevStep debe retroceder al paso anterior');

    // Si avanzamos a t = 45 (dentro del paso 1: 30-75s), prevStep debe volver al inicio del paso 1 (t0 = 30)
    fsm.seek(45);
    fsm.prevStep();
    assert.equal(fsm.transcurrido(), 30, 'PrevStep en medio de un paso vuelve al inicio de dicho paso');

    // Segundo clic en prevStep estando al inicio del paso 1 salta al paso 0 (t0 = 0)
    fsm.prevStep();
    assert.equal(fsm.transcurrido(), 0, 'PrevStep en el inicio de un paso retrocede al paso anterior');

    // 6. Conmutación de cámaras y tally (Take Camera)
    fsm.takeCamera('cam2');
    assert.equal(fsm.air, 'cam2');
    fsm.takeCamera('cam3');
    assert.equal(fsm.preview, 'cam2');
    assert.equal(fsm.air, 'cam3');

    // 7. Reset a 00:00
    fsm.reset();
    assert.equal(fsm.isRunning, false);
    assert.equal(fsm.isStopped, true);
    assert.equal(fsm.transcurrido(), 0);
    assert.equal(fsm.air, null);
    assert.equal(fsm.preview, null);

    fsm.unmount();
});

test('GoF Command Pattern: ProductionCommandManager despacha órdenes discretas hacia el FSM', () => {
    let ordenes = [];
    const fakeFsm = {
        toggle: () => ordenes.push('toggle'),
        reset: () => ordenes.push('reset'),
        nextStep: () => ordenes.push('next'),
        prevStep: () => ordenes.push('prev'),
        seek: (s) => ordenes.push(`seek:${s}`),
        takeCamera: (id) => ordenes.push(`cam:${id}`),
    };

    const cmd = new ProductionCommandManager(fakeFsm);
    cmd.toggleTransport();
    cmd.seek(50);
    cmd.nextStep();
    cmd.prevStep();
    cmd.takeCamera('cam-1');
    cmd.resetTransport();

    assert.deepEqual(ordenes, ['toggle', 'seek:50', 'next', 'prev', 'cam:cam-1', 'reset']);
});

test('GoF Composite Pattern: PreflightChecklistComposite pondera y categoriza validaciones técnicas', () => {
    const composite = new PreflightChecklistComposite();
    composite.addItem('error', 'Falta cámara principal', 'video');
    composite.addItem('warn', 'Micrófono sin conectar', 'audio');
    composite.addItem('info', 'Encoder en standby', 'diagram');

    assert.equal(composite.errors.length, 1);
    assert.equal(composite.warnings.length, 1);
    assert.equal(composite.isReady, false);
    assert.equal(composite.byCategory('video').length, 1);
    assert.equal(composite.byCategory('audio').length, 1);
    assert.equal(composite.byCategory('diagram').length, 1);
    assert.equal(composite.byCategory('all').length, 3);

    // Penalización: 1 error (20%) + 1 advertencia (8%) = 100 - 28 = 72%
    assert.equal(composite.readinessPercentage, 72);
    assert.equal(composite.statusLabel, '1 Críticos');

    // Composite vacío = 100% aprobado
    const compositeOk = new PreflightChecklistComposite();
    assert.equal(compositeOk.isReady, true);
    assert.equal(compositeOk.readinessPercentage, 100);
    assert.equal(compositeOk.statusLabel, 'Aprobado');
});

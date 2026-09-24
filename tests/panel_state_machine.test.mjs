import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    PanelLifecycleManager,
    IdleState,
    LoadingState,
    TransitioningState,
    HydratingState,
    ReadyState,
} from '../frontend/src/panel_state_machine.js';

/* ESPERAR LA CONDICIÓN, NUNCA EL RELOJ.
   Las dos pruebas de abajo dormían 10 ms a ciegas y fallaban ~1 de cada 10
   corridas con la máquina ocupada. No era un fallo del código: la limpieza de
   clases sucede tras TRES vueltas al bucle de eventos —`alCompletarHidratacion`
   encadena dos rAF y `ReadyState.entrar()` agrega otro—, y en Node no hay
   requestAnimationFrame, así que cada rAF cae en un setTimeout(0). Tres turnos
   entran de sobra en 10 ms cuando la CPU está libre; cuando no, no.
   Un número más grande solo haría el susto más raro, no imposible, y de paso
   volvería lenta toda la suite. Preguntar por la condición termina EN CUANTO
   pasa —casi siempre en el primer turno— y solo se rinde si de verdad no
   ocurrió. El techo es un seguro contra cuelgues, no una espera. */
async function hasta(condicion, queEsperabamos, limiteMs = 2000) {
    const fin = Date.now() + limiteMs;
    while (!condicion()) {
        if (Date.now() > fin) {
            throw new Error(`Se agotaron ${limiteMs} ms esperando: ${queEsperabamos}`);
        }
        await new Promise((seguir) => { setTimeout(seguir, 1); });
    }
}

describe('GoF State Pattern: PanelLifecycleManager', () => {
    function crearMock() {
        const classList = new Set();
        const panelEl = {
            classList: {
                add: (c) => classList.add(c),
                remove: (c) => classList.delete(c),
                contains: (c) => classList.has(c),
            },
            src: '',
        };
        const loadingClassList = new Set(['hidden']);
        const loadingEl = {
            classList: {
                add: (c) => loadingClassList.add(c),
                remove: (c) => loadingClassList.delete(c),
                contains: (c) => loadingClassList.has(c),
            },
        };
        let hidratado = false;
        const manager = new PanelLifecycleManager({
            panelEl,
            loadingEl,
            alHidratar: () => { hidratado = true; },
        });

        return { manager, panelEl, loadingEl, estaHidratado: () => hidratado };
    }

    it('inicia en estado IdleState y mantiene panel oculto por seguridad', () => {
        const { manager, panelEl } = crearMock();
        assert.equal(manager.obtenerEstado(), 'IdleState');
        assert.equal(panelEl.classList.contains('cargando'), true);
    });

    it('transiciona a LoadingState al cargar una nueva herramienta', () => {
        const { manager, panelEl, loadingEl } = crearMock();
        manager.cargar('./tools/infografias/index.html');
        assert.equal(manager.obtenerEstado(), 'LoadingState');
        assert.equal(panelEl.classList.contains('cargando'), true);
        assert.equal(loadingEl.classList.contains('hidden'), false);
        assert.equal(panelEl.src, './tools/infografias/index.html');
    });

    it('transiciona a TransitioningState al iniciar cambio de vista en caliente', () => {
        const { manager, panelEl, loadingEl } = crearMock();
        manager.iniciarTransicion();
        assert.equal(manager.obtenerEstado(), 'TransitioningState');
        assert.equal(panelEl.classList.contains('cargando'), true);
        assert.equal(loadingEl.classList.contains('hidden'), false);
    });

    it('transiciona a HydratingState y ejecuta hidratación cuando el iframe dispara load', () => {
        const { manager, estaHidratado } = crearMock();
        manager.cargar('./tools/infografias/index.html');
        manager.notificarCargado();
        assert.equal(manager.obtenerEstado(), 'HydratingState');
        assert.equal(estaHidratado(), true);
    });

    it('transiciona a ReadyState y remueve clases de carga al completar', async () => {
        const { manager, panelEl, loadingEl } = crearMock();
        manager.cargar('./tools/infografias/index.html');
        manager.notificarCargado();
        manager.notificarListo();

        // Quitar 'cargando' es lo ÚLTIMO que ocurre, después de entrar a
        // ReadyState: esperar por eso es esperar por toda la cadena.
        await hasta(() => !panelEl.classList.contains('cargando'),
            "que el panel suelte la clase 'cargando'");

        assert.equal(manager.obtenerEstado(), 'ReadyState');
        assert.equal(panelEl.classList.contains('cargando'), false);
        assert.equal(loadingEl.classList.contains('hidden'), true);
    });

    it('vuelve a IdleState al llamar dormir()', () => {
        const { manager, panelEl } = crearMock();
        manager.iniciarTransicion();
        manager.dormir();
        assert.equal(manager.obtenerEstado(), 'IdleState');
        assert.equal(panelEl.classList.contains('cargando'), true);
    });

    it('despierta de IdleState a TransitioningState con despertar()', () => {
        const { manager, panelEl, loadingEl } = crearMock();
        assert.equal(manager.obtenerEstado(), 'IdleState');
        manager.despertar();
        assert.equal(manager.obtenerEstado(), 'TransitioningState');
        assert.equal(panelEl.classList.contains('cargando'), true);
        assert.equal(loadingEl.classList.contains('hidden'), false);
    });

    it('transiciona directamente de IdleState a ReadyState si recibe notificarListo()', async () => {
        const { manager, panelEl } = crearMock();
        assert.equal(manager.obtenerEstado(), 'IdleState');
        manager.notificarListo();
        assert.equal(manager.obtenerEstado(), 'ReadyState');

        await hasta(() => !panelEl.classList.contains('cargando'),
            "que el panel suelte la clase 'cargando'");

        assert.equal(panelEl.classList.contains('cargando'), false);
    });
});

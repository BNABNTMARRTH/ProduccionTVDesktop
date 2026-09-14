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

    it('transiciona a ReadyState y remueve clases de carga al completar', (t, done) => {
        const { manager, panelEl, loadingEl } = crearMock();
        manager.cargar('./tools/infografias/index.html');
        manager.notificarCargado();
        manager.notificarListo();

        setTimeout(() => {
            assert.equal(manager.obtenerEstado(), 'ReadyState');
            assert.equal(panelEl.classList.contains('cargando'), false);
            assert.equal(loadingEl.classList.contains('hidden'), true);
            done();
        }, 10);
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

    it('transiciona directamente de IdleState a ReadyState si recibe notificarListo()', (t, done) => {
        const { manager, panelEl } = crearMock();
        assert.equal(manager.obtenerEstado(), 'IdleState');
        manager.notificarListo();
        assert.equal(manager.obtenerEstado(), 'ReadyState');
        setTimeout(() => {
            assert.equal(panelEl.classList.contains('cargando'), false);
            done();
        }, 10);
    });
});

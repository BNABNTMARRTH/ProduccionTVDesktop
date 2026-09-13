/**
 * ProductionFSM implementa el patrón de diseño STATE (Máquina de Estados Finita).
 * Modela con precisión el transporte de producción en vivo (Detenido, Corriendo,
 * Pausado, Terminado) y gestiona el ciclo de vida (mount/unmount) para evitar
 * fugas de memoria por listeners y temporizadores acumulados.
 */

class ProductionState {
    constructor(fsm) {
        this.fsm = fsm;
    }
    toggle() {}
    get label() { return ''; }
    get isRunning() { return false; }
}

class StoppedState extends ProductionState {
    get label() { return '▶ Arrancar'; }
    get isRunning() { return false; }
    toggle() {
        this.fsm.startRunning();
    }
}

class RunningState extends ProductionState {
    get label() { return 'Ⅱ Pausa'; }
    get isRunning() { return true; }
    toggle() {
        this.fsm.pause();
    }
}

class PausedState extends ProductionState {
    get label() { return '▶ Seguir'; }
    get isRunning() { return false; }
    toggle() {
        this.fsm.resume();
    }
}

class FinishedState extends ProductionState {
    get label() { return '▶ Otra vez'; }
    get isRunning() { return false; }
    toggle() {
        this.fsm.restart();
    }
}

export class ProductionFSM {
    constructor({ onTick, onEnsayo, getPrograma }) {
        this.onTick = onTick;
        this.onEnsayo = onEnsayo;
        this.getPrograma = getPrograma;

        this.states = {
            stopped: new StoppedState(this),
            running: new RunningState(this),
            paused: new PausedState(this),
            finished: new FinishedState(this),
        };

        this.state = this.states.stopped;
        this.acumulado = 0;
        this.arranque = 0;
        this.reloj = null;
        this.air = null;
        this.preview = null;
        this.pasoActual = -1;
        this.ensayado = false;
        this.keyListener = null;
    }

    get isRunning() {
        return this.state?.isRunning ?? false;
    }

    get isPaused() {
        return this.state === this.states.paused;
    }

    get isStopped() {
        return this.state === this.states.stopped;
    }

    get playLabel() {
        return this.state.label;
    }

    transcurrido() {
        if (!this.isRunning) return this.acumulado;
        return this.acumulado + (performance.now() - this.arranque) / 1000;
    }

    marcarEnsayado() {
        if (this.ensayado) return;
        this.ensayado = true;
        this.onEnsayo?.();
    }

    startRunning() {
        this.arranque = performance.now();
        this.state = this.states.running;
        this.marcarEnsayado();
        this.startTimer();
        this.onTick?.();
    }

    pause() {
        if (!this.isRunning) return;
        this.acumulado = this.transcurrido();
        this.state = this.states.paused;
        this.stopTimer();
        this.onTick?.();
    }

    resume() {
        if (!this.isPaused) return;
        this.arranque = performance.now();
        this.state = this.states.running;
        this.marcarEnsayado();
        this.startTimer();
        this.onTick?.();
    }

    finish() {
        const programa = this.getPrograma?.();
        this.acumulado = programa?.total || 0;
        this.state = this.states.finished;
        this.stopTimer();
        this.onTick?.();
    }

    restart() {
        this.reset({ pintar: false });
        this.startRunning();
    }

    reset({ pintar = true } = {}) {
        this.stopTimer();
        this.acumulado = 0;
        this.arranque = performance.now();
        this.air = null;
        this.preview = null;
        this.pasoActual = -1;
        this.state = this.states.stopped;
        if (pintar) this.onTick?.();
    }

    seek(seconds) {
        const programa = this.getPrograma?.();
        const total = programa?.total || 0;
        const target = Math.max(0, Math.min(seconds || 0, total));
        this.acumulado = target;
        this.arranque = performance.now();
        if (target >= total && total > 0) {
            this.finish();
        } else {
            if (this.state === this.states.finished) {
                this.state = this.states.paused;
            }
            this.onTick?.();
        }
    }

    nextStep() {
        const programa = this.getPrograma?.();
        if (!programa?.pasos?.length) return;
        const t = this.transcurrido();
        // Buscar el primer paso cuyo inicio sea estrictamente mayor que el tiempo actual
        const next = programa.pasos.find((p) => p.t0 > t + 0.05);
        if (next) {
            this.seek(next.t0);
        } else {
            this.seek(programa.total);
        }
    }

    prevStep() {
        const programa = this.getPrograma?.();
        if (!programa?.pasos?.length) return;
        const t = this.transcurrido();
        // Encontrar el paso activo para el tiempo t
        const index = programa.pasos.findIndex((p) => t >= p.t0 && t < p.t1);
        const actualIdx = index !== -1 ? index : (t >= programa.total ? programa.pasos.length - 1 : 0);
        const currentPaso = programa.pasos[actualIdx];

        // Si ya pasaron más de 1.0 segundos dentro de este paso, volver al inicio del paso actual
        if (currentPaso && (t - currentPaso.t0) > 1.0) {
            this.seek(currentPaso.t0);
        } else if (actualIdx > 0) {
            // Si está en el primer segundo del paso, saltar al inicio del paso inmediatamente anterior
            this.seek(programa.pasos[actualIdx - 1].t0);
        } else {
            // Si ya está en el primer paso, reiniciar a 00:00
            this.seek(0);
        }
    }

    toggle() {
        const programa = this.getPrograma?.();
        if (!programa?.pasos?.length) return;
        this.state.toggle();
    }

    takeCamera(id) {
        if (id === this.air) return;
        this.preview = this.air;
        this.air = id;
        this.marcarEnsayado();
        this.onTick?.();
    }

    startTimer() {
        this.stopTimer();
        this.reloj = setInterval(() => this.onTick?.(), 100);
    }

    stopTimer() {
        if (this.reloj) {
            clearInterval(this.reloj);
            this.reloj = null;
        }
    }

    mount(container) {
        if (this.keyListener) {
            document.removeEventListener('keydown', this.keyListener, true);
            this.keyListener = null;
        }

        const esCampoTexto = (el) => !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
        this.keyListener = (e) => {
            if (e.key !== ' ' || e.metaKey || e.ctrlKey || e.altKey) return;
            if (container.hidden || !container.isConnected) return;
            if (document.querySelector('.prompter-overlay')) return;
            if (esCampoTexto(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.target && e.target.tagName === 'BUTTON') {
                e.target.blur();
            }
            this.toggle();
        };
        document.addEventListener('keydown', this.keyListener, true);

        // Si la producción ya estaba corriendo, garantizar que el timer siga latiendo
        if (this.isRunning && !this.reloj) {
            this.startTimer();
        }
    }

    unmount() {
        if (this.keyListener) {
            document.removeEventListener('keydown', this.keyListener, true);
            this.keyListener = null;
        }
        this.stopTimer();
    }
}

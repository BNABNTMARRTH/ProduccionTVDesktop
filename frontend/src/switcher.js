// Puente de la Sala de Control con OBS Studio y Blackmagic ATEM.
// No importa bindings generados: tanto Wails como el puente Swift publican el
// mismo `window.go.main.App`; en un navegador común el módulo queda inactivo.

export const SWITCHER_PUERTOS = Object.freeze({ obs: 4455, atem: 9910 });

export function normalizarNombreSwitcher(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function mapaSwitcherPorDefecto(camaras = [], escenasOBS = [], mapaAnterior = {}) {
    const escenas = (escenasOBS || []).map((nombre) => ({ nombre: String(nombre), normal: normalizarNombreSwitcher(nombre) }));
    const mapa = {};
    (camaras || []).forEach((camara, indice) => {
        const anterior = mapaAnterior?.[camara.id] || {};
        const nombre = normalizarNombreSwitcher(camara.nombre);
        const camN = normalizarNombreSwitcher(`CAM ${indice + 1}`);
        const coincidencia = escenas.find((escena) => escena.normal === nombre)
            || escenas.find((escena) => escena.normal === camN);
        mapa[camara.id] = {
            obs: String(anterior.obs || coincidencia?.nombre || ''),
            atem: Number.isInteger(Number(anterior.atem)) && Number(anterior.atem) > 0
                ? Number(anterior.atem)
                : indice + 1,
        };
    });
    return mapa;
}

export function camIdPorEntradaSwitcher(camaras = [], mapa = {}, kind, input) {
    const buscada = String(input ?? '').trim();
    if (!buscada) return null;
    return (camaras || []).find((camara) => String(mapa?.[camara.id]?.[kind] ?? '').trim() === buscada)?.id || null;
}

export function entradaSwitcherPorCamId(mapa = {}, kind, camId) {
    if (!camId) return '';
    return String(mapa?.[camId]?.[kind] ?? '').trim();
}

export function esEntornoTactilNativo() {
    try {
        return globalThis.__ptvSinVentanas === true
            || globalThis.document?.documentElement?.hasAttribute?.('data-tactil') === true;
    } catch { return false; }
}

export function normalizarConexionSwitcher(value = {}, { tactil = esEntornoTactilNativo() } = {}) {
    const kind = value.kind === 'atem' ? 'atem' : 'obs';
    const port = Number(value.port);
    const hostInicial = Object.prototype.hasOwnProperty.call(value, 'host') ? value.host : (tactil ? '' : '127.0.0.1');
    return {
        kind,
        host: String(hostInicial ?? '').trim(),
        port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : SWITCHER_PUERTOS[kind],
        password: String(value.password || ''),
        reconectar: value.reconectar === true,
    };
}

export function normalizarResultadosOBS(resultados = []) {
    const vistos = new Set();
    return (Array.isArray(resultados) ? resultados : []).flatMap((item) => {
        const host = String(item?.host || '').trim();
        const port = Number(item?.port);
        if (!host || vistos.has(host)) return [];
        vistos.add(host);
        return [{
            host,
            nombre: String(item?.nombre || host).trim() || host,
            port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : SWITCHER_PUERTOS.obs,
        }];
    });
}

// Sólo los fallos de transporte justifican buscar otra IP. Pedir o rechazar
// una contraseña demuestra que OBS sí contestó y debe conservar la dirección.
export function errorOBSRequiereBusqueda(error) {
    const texto = mensajeError(error).toLocaleLowerCase('es');
    // «Red local» aparece también como consejo en el aviso de tiempo agotado;
    // solo el bloqueo explícito de iOS descarta la búsqueda.
    if (/contrase|password|authentic|saludo válido|saludo valido|bloqueando la red local|local network prohibited/.test(texto)) return false;
    return /no contest|nadie contest|rechazó la conexión|rechazo la conexion|connection refused|cannot connect|timed out|tiempo de espera|network is unreachable|host is down/.test(texto);
}

// Para el autorrelleno se exige un único OBS total. Para rescatar una conexión
// caída se exige un único OBS cuya dirección sea distinta de la guardada.
export function elegirResultadoOBS(resultados = [], hostActual = '', { soloOtraDireccion = false } = {}) {
    const actual = String(hostActual || '').trim().toLowerCase();
    const candidatos = normalizarResultadosOBS(resultados)
        .filter((item) => !soloOtraDireccion || item.host.toLowerCase() !== actual);
    return candidatos.length === 1 ? candidatos[0] : null;
}

function backend() {
    try { return globalThis.window?.go?.main?.App || null; } catch { return null; }
}

const mensajeError = (error) => String(error?.message || error || 'No se pudo completar la operación');

export class ControlSwitcher {
    constructor({ getConfig, onConfigChange, loadSettings, saveSettings, onState, onExternal, onInputs, onDiscovery, onNotice } = {}) {
        this.getConfig = getConfig || (() => null);
        this.onConfigChange = onConfigChange;
        this.loadSettings = loadSettings || (() => ({}));
        this.saveSettings = saveSettings;
        this.onState = onState;
        this.onExternal = onExternal;
        this.onInputs = onInputs;
        this.onDiscovery = onDiscovery;
        this.onNotice = onNotice;
        this.active = false;
        this.eventBound = false;
        this.reconnectTimer = 0;
        this.connecting = false;
        this.discoveryPromise = null;
        this.lastDiscoveryAt = 0;
        this.discovery = { buscando: false, resultados: [], error: '' };
        this.inputs = [];
        this.options = normalizarConexionSwitcher();
        this.status = {
            kind: '', estado: backend() ? 'desconectado' : 'no-disponible', conectado: false,
            programa: '', preview: '', error: backend() ? '' : 'Disponible solo en la app de escritorio',
        };
        this.lastExternalSignature = '';
    }

    get available() { return !!backend(); }

    get followRundown() { return this.getConfig()?.switcher?.seguirEscaleta === true; }

    viewModel() {
        return {
            available: this.available,
            status: { ...this.status },
            options: { ...this.options },
            inputs: [...this.inputs],
            mapa: this.getConfig()?.switcher?.mapa || {},
            followRundown: this.followRundown,
            tactil: esEntornoTactilNativo(),
        };
    }

    async call(name, ...args) {
        const api = backend();
        if (!api || typeof api[name] !== 'function') throw new Error('El switcher solo está disponible en la app de escritorio');
        return api[name](...args);
    }

    loadMachineSettings() {
        let settings = {};
        try { settings = this.loadSettings?.() || {}; } catch { settings = {}; }
        this.options = normalizarConexionSwitcher(settings.switcher || {});
        return settings;
    }

    persistOptions(options) {
        this.options = normalizarConexionSwitcher(options);
        try { this.saveSettings?.({ switcher: { ...this.options } }); } catch { /* el ensayo sigue local */ }
    }

    publishDiscovery(next) {
        this.discovery = {
            buscando: next?.buscando === true,
            resultados: normalizarResultadosOBS(next?.resultados),
            error: String(next?.error || ''),
        };
        this.onDiscovery?.({ ...this.discovery, resultados: [...this.discovery.resultados] });
    }

    async buscarOBS(port = this.options.port, { hostActual = this.options.host } = {}) {
        if (!this.available) return [];
        if (this.discoveryPromise) return this.discoveryPromise;
        const ahora = Date.now();
        if (ahora - this.lastDiscoveryAt < 15000) return [...this.discovery.resultados];
        const puerto = Number.isInteger(Number(port)) ? Number(port) : SWITCHER_PUERTOS.obs;
        this.lastDiscoveryAt = ahora;
        this.publishDiscovery({ buscando: true, resultados: [], error: '' });
        this.discoveryPromise = (async () => {
            try {
                const encontrados = normalizarResultadosOBS(await this.call('SwitcherBuscarOBS', puerto));
                const unico = elegirResultadoOBS(encontrados, hostActual);
                if (unico && !String(hostActual || '').trim()) {
                    this.persistOptions({ ...this.options, kind: 'obs', host: unico.host, port: unico.port });
                }
                this.publishDiscovery({ buscando: false, resultados: encontrados, error: '' });
                return encontrados;
            } catch (error) {
                this.publishDiscovery({ buscando: false, resultados: [], error: mensajeError(error) });
                return [];
            } finally {
                this.discoveryPromise = null;
            }
        })();
        return this.discoveryPromise;
    }

    ensureMapping(escenas = this.inputs) {
        const cfg = this.getConfig();
        if (!cfg) return {};
        const previo = cfg.switcher?.mapa || {};
        const mapa = mapaSwitcherPorDefecto(cfg.camaras || [], escenas, previo);
        if (JSON.stringify(mapa) !== JSON.stringify(previo) || !cfg.switcher) {
            this.onConfigChange?.({
                ...cfg,
                switcher: { ...cfg.switcher, seguirEscaleta: cfg.switcher?.seguirEscaleta === true, mapa },
            });
        }
        return mapa;
    }

    setFollowRundown(value) {
        const cfg = this.getConfig();
        if (!cfg) return;
        this.onConfigChange?.({
            ...cfg,
            switcher: { ...cfg.switcher, mapa: this.ensureMapping(), seguirEscaleta: value === true },
        });
    }

    setMapping(camId, kind, value) {
        const cfg = this.getConfig();
        if (!cfg || !camId || !['obs', 'atem'].includes(kind)) return;
        const mapa = this.ensureMapping();
        const actual = mapa[camId] || { obs: '', atem: 1 };
        mapa[camId] = { ...actual, [kind]: kind === 'atem' ? Number(value) : String(value || '') };
        this.onConfigChange?.({ ...cfg, switcher: { ...cfg.switcher, mapa } });
        // El programa físico puede no haber cambiado, pero su traducción a
        // cámara sí. Reaplicar el estado hace que el tally se ponga al día.
        this.lastExternalSignature = '';
        this.handleStatus(this.status, { schedule: false });
    }

    async activate() {
        if (this.active) return;
        this.active = true;
        this.loadMachineSettings();
        this.ensureMapping();
        const runtime = globalThis.window?.runtime;
        if (runtime?.EventsOn && !this.eventBound) {
            runtime.EventsOn('ptv:switcher-estado', (status) => this.handleStatus(status));
            this.eventBound = true;
        }
        if (!this.available) {
            this.onState?.(this.status);
            return;
        }
        try {
            const current = await this.call('SwitcherStatus');
            if (current) this.handleStatus(current);
        } catch { /* un backend viejo se presenta como no disponible */ }
        if (this.options.reconectar) this.connect(this.options, { manual: false });
    }

    async deactivate() {
        if (!this.active) return;
        this.active = false;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = 0;
        if (this.eventBound && globalThis.window?.runtime?.EventsOff) {
            globalThis.window.runtime.EventsOff('ptv:switcher-estado');
            this.eventBound = false;
        }
        if (this.available) {
            try { await this.call('SwitcherDisconnect'); } catch { /* cierre silencioso */ }
        }
        this.handleStatus({ kind: this.options.kind, estado: 'desconectado', conectado: false, programa: '', preview: '', error: '' }, { schedule: false });
    }

    async connect(options = this.options, { manual = true } = {}) {
        if (!this.active || !this.available || this.connecting) return false;
        this.connecting = true;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = 0;
        let next = normalizarConexionSwitcher({ ...options, reconectar: true });
        let fallo = false;
        this.persistOptions(next);
        this.handleStatus({ kind: next.kind, estado: 'conectando', conectado: false, programa: '', preview: '', error: '' }, { schedule: false });
        try {
            await this.call('SwitcherConnect', next.kind, next.host, next.port, next.password);
            const status = await this.call('SwitcherStatus');
            this.handleStatus(status, { schedule: false });
            await this.refreshInputs();
            return true;
        } catch (error) {
            let errorFinal = error;
            if (next.kind === 'obs' && errorOBSRequiereBusqueda(error)) {
                const encontrados = await this.buscarOBS(next.port, { hostActual: next.host });
                const cambiado = elegirResultadoOBS(encontrados, next.host, { soloOtraDireccion: true });
                if (cambiado) {
                    next = normalizarConexionSwitcher({ ...next, host: cambiado.host, port: cambiado.port, reconectar: true });
                    this.persistOptions(next);
                    this.handleStatus({ kind: 'obs', estado: 'conectando', conectado: false, programa: '', preview: '', error: '' }, { schedule: false });
                    try {
                        await this.call('SwitcherConnect', next.kind, next.host, next.port, next.password);
                        const status = await this.call('SwitcherStatus');
                        this.handleStatus(status, { schedule: false });
                        await this.refreshInputs();
                        this.onNotice?.(`OBS cambió de dirección: ahora es ${next.host}`);
                        return true;
                    } catch (retryError) {
                        errorFinal = retryError;
                    }
                }
            }
            fallo = true;
            this.handleStatus({
                kind: next.kind, estado: 'error', conectado: false, programa: '', preview: '', error: mensajeError(errorFinal),
            }, { schedule: false });
            return false;
        } finally {
            this.connecting = false;
            if (fallo) this.scheduleReconnect();
            if (manual) this.onState?.(this.status);
        }
    }

    async disconnect() {
        clearTimeout(this.reconnectTimer);
        this.persistOptions({ ...this.options, reconectar: false });
        try { await this.call('SwitcherDisconnect'); } catch { /* puede ser navegador */ }
        this.inputs = this.options.kind === 'atem' ? Array.from({ length: 8 }, (_, i) => String(i + 1)) : [];
        this.handleStatus({ kind: this.options.kind, estado: 'desconectado', conectado: false, programa: '', preview: '', error: '' }, { schedule: false });
        this.onInputs?.(this.inputs);
    }

    scheduleReconnect() {
        if (!this.active || !this.options.reconectar || this.reconnectTimer || this.connecting) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = 0;
            if (this.active && !this.status.conectado) this.connect(this.options, { manual: false });
        }, 2500);
    }

    handleStatus(raw = {}, { schedule = true } = {}) {
        this.status = {
            kind: String(raw.kind || this.options.kind || ''),
            estado: String(raw.estado || (raw.conectado ? 'conectado' : 'desconectado')),
            conectado: raw.conectado === true,
            programa: String(raw.programa || ''),
            preview: String(raw.preview || ''),
            error: String(raw.error || ''),
        };
        this.onState?.(this.status);
        if (this.status.conectado) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = 0;
            const cfg = this.getConfig();
            const mapa = cfg?.switcher?.mapa || this.ensureMapping();
            const cameras = cfg?.camaras || [];
            const air = camIdPorEntradaSwitcher(cameras, mapa, this.status.kind, this.status.programa);
            const preview = camIdPorEntradaSwitcher(cameras, mapa, this.status.kind, this.status.preview);
            const signature = `${this.status.kind}|${this.status.programa}|${this.status.preview}`;
            if (signature !== this.lastExternalSignature) {
                this.lastExternalSignature = signature;
                this.onExternal?.({ air: air || undefined, preview: preview || undefined });
            }
        } else {
            // Una reconexión debe volver a imponer la realidad del switcher,
            // aunque programa y preview conserven los mismos nombres/números.
            this.lastExternalSignature = '';
            if (schedule && ['error', 'desconectado'].includes(this.status.estado)) this.scheduleReconnect();
        }
    }

    async refreshInputs() {
        if (!this.status.conectado) return this.inputs;
        try {
            const result = await this.call('SwitcherListInputs');
            this.inputs = Array.isArray(result) ? result.map(String) : [];
            this.ensureMapping(this.status.kind === 'obs' ? this.inputs : []);
            this.onInputs?.(this.inputs);
            // En OBS el estado inicial llega junto con GetSceneList, antes de
            // poder construir el mapa automático por nombre. Traducirlo otra
            // vez ahora evita esperar al próximo cambio de escena.
            this.lastExternalSignature = '';
            this.handleStatus(this.status, { schedule: false });
        } catch (error) {
            this.status = { ...this.status, error: mensajeError(error) };
            this.onState?.(this.status);
        }
        return this.inputs;
    }

    async setProgram(camId) {
        if (!this.active || !this.status.conectado) return;
        const input = entradaSwitcherPorCamId(this.getConfig()?.switcher?.mapa, this.status.kind, camId);
        if (!input) return;
        try {
            await this.call('SwitcherSetProgram', input);
            if (this.status.error) this.handleStatus({ ...this.status, error: '' }, { schedule: false });
        } catch (error) {
            // Una escena inexistente o el modo Estudio apagado es un rechazo de
            // la orden, no necesariamente una caída de red.
            this.handleStatus({ ...this.status, error: mensajeError(error) }, { schedule: false });
        }
    }

    async setPreview(camId) {
        if (!this.active || !this.status.conectado || !camId) return;
        const input = entradaSwitcherPorCamId(this.getConfig()?.switcher?.mapa, this.status.kind, camId);
        if (!input) return;
        try {
            await this.call('SwitcherSetPreview', input);
            if (this.status.error) this.handleStatus({ ...this.status, error: '' }, { schedule: false });
        } catch (error) {
            this.handleStatus({ ...this.status, error: mensajeError(error) }, { schedule: false });
        }
    }
}

export function crearControlSwitcher(options) { return new ControlSwitcher(options); }

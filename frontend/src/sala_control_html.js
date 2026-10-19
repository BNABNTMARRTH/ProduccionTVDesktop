/* EL HTML de la Sala de Control (Producción). Solo arma texto: no busca
 * nodos ni conecta eventos —eso sigue en production.js—. Separarlo deja la
 * lógica del transporte legible sin 200 líneas de marcado en medio, y deja
 * probar el marcado sin un navegador. */
import { esc } from './constants.js';
import { formatTime } from './formato_tiempo.js';

export function htmlSalaVacia() {
    return `
    <div class="production-empty lg-container">
        <h1>Sala de Control</h1>
        <p>Abre un proyecto para iniciar la suite broadcast.</p>
        <button id="go-home" class="apple-studio-btn">Ir a Inicio</button>
    </div>`;
}

/** Lista del alistamiento (ya filtrada por categoría). */
export function htmlChecklist(items) {
    if (!items.length) {
        return `
            <div class="studio-check ok">
                <span class="studio-check-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div class="studio-check-text">Todos los elementos de esta categoría están verificados.</div>
            </div>`;
    }
    return items.map((item) => {
        const isErr = item.type === 'error';
        const isWarn = item.type === 'warn';
        const iconSvg = isErr
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
            : isWarn
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        return `
            <div class="studio-check ${item.type}">
                <span class="studio-check-icon">${iconSvg}</span>
                <div class="studio-check-text">${item.text}</div>
            </div>`;
    }).join('');
}

export const etiquetaEstadoSwitcher = (status = {}) => {
    if (status.estado === 'no-disponible') return 'Switcher: solo en Mac';
    if (!status.kind || status.estado === 'desconectado') return 'Conectar switcher';
    const nombre = status.kind.toUpperCase();
    if (status.estado === 'conectando') return `${nombre} · conectando…`;
    if (status.conectado) return `${nombre} conectado`;
    return `${nombre} sin conexión`;
};

export function htmlMapeoSwitcher(cams = [], mapa = {}, kind = 'obs', inputs = []) {
    const disponibles = kind === 'atem' ? Array.from({ length: 8 }, (_, i) => String(i + 1)) : inputs.map(String);
    return cams.map((camara, indice) => {
        const actual = String(mapa?.[camara.id]?.[kind] ?? '');
        const opciones = [...new Set([actual, ...disponibles].filter(Boolean))];
        return `<tr>
            <th scope="row">${esc(camara.nombre || `CAM ${indice + 1}`)}</th>
            <td><select data-switcher-map="${esc(camara.id)}" aria-label="Entrada para ${esc(camara.nombre || `CAM ${indice + 1}`)}">
                <option value="">Sin asignar</option>
                ${opciones.map((input) => `<option value="${esc(input)}" ${input === actual ? 'selected' : ''}>${esc(kind === 'atem' ? `Entrada ${input}` : input)}</option>`).join('')}
            </select></td>
        </tr>`;
    }).join('');
}

export function htmlPanelSwitcher({ cams = [], status = {}, options = {}, mapa = {}, inputs = [], tactil = false } = {}) {
    const kind = options.kind === 'atem' ? 'atem' : 'obs';
    const host = options.host ?? (tactil ? '' : '127.0.0.1');
    const placeholderHost = tactil ? 'IP de la Mac, p. ej. 192.168.1.20' : '127.0.0.1';
    const ayudaOBS = tactil
        ? '<strong>¿Dónde están la IP y la contraseña?</strong> Salen de OBS en la Mac: <em>Herramientas → Ajustes del servidor WebSocket → Mostrar información de conexión</em>.'
        : '<strong>¿Dónde está la contraseña?</strong> En OBS: <em>Herramientas → Ajustes del servidor WebSocket → Mostrar información de conexión</em>. Si OBS corre en esta misma Mac, puedes dejarla vacía: la app la toma sola.';
    return `
        <div class="switcher-sheet-backdrop" id="switcher-sheet" hidden>
            <section class="switcher-sheet lg-container" role="dialog" aria-modal="true" aria-labelledby="switcher-sheet-title">
                <header>
                    <div><span class="studio-eyebrow">CONTROL POR RED</span><h2 id="switcher-sheet-title">Switcher externo</h2></div>
                    <button type="button" class="switcher-sheet-close" aria-label="Cerrar">✕</button>
                </header>
                <p class="switcher-sheet-help">Conecta OBS Studio o un ATEM en la misma red. Si la conexión falla, el ensayo sigue funcionando aquí.</p>
                <div class="switcher-form-grid">
                    <label>Tipo<select id="switcher-kind"><option value="obs" ${kind === 'obs' ? 'selected' : ''}>OBS Studio</option><option value="atem" ${kind === 'atem' ? 'selected' : ''}>Blackmagic ATEM</option></select></label>
                    <div class="switcher-address-field"><label for="switcher-host">Dirección</label><div class="switcher-address-control"><input id="switcher-host" value="${esc(host)}" placeholder="${esc(placeholderHost)}" autocomplete="off"><button type="button" id="switcher-search" class="apple-studio-btn" ${kind === 'atem' ? 'hidden' : ''}>Buscar OBS en la red</button></div></div>
                    <label>Puerto<input id="switcher-port" type="number" min="1" max="65535" value="${esc(options.port || (kind === 'atem' ? 9910 : 4455))}"></label>
                    <label id="switcher-password-row" ${kind === 'atem' ? 'hidden' : ''}>Contraseña<input id="switcher-password" type="password" value="${esc(options.password || '')}" autocomplete="current-password" placeholder="La de OBS"></label>
                </div>
                <div id="switcher-search-box" class="switcher-search-box" ${kind === 'atem' ? 'hidden' : ''}>
                    <p id="switcher-search-status" class="switcher-sheet-help" role="status" aria-live="polite"></p>
                    <div id="switcher-search-results" class="switcher-search-results"></div>
                </div>
                <p class="switcher-sheet-help" id="switcher-password-help" ${kind === 'atem' ? 'hidden' : ''}>${ayudaOBS}</p>
                <div class="switcher-sheet-actions">
                    <button type="button" id="switcher-connect" class="apple-studio-btn">Conectar</button>
                    <button type="button" id="switcher-disconnect" class="apple-studio-btn" ${status.conectado || status.estado === 'conectando' ? '' : 'disabled'}>Desconectar</button>
                    <span id="switcher-panel-state">${esc(etiquetaEstadoSwitcher(status))}</span>
                </div>
                <p id="switcher-panel-notice" class="switcher-panel-notice" hidden role="status" aria-live="polite"></p>
                <p id="switcher-panel-error" class="switcher-panel-error" ${status.error ? '' : 'hidden'}>${esc(status.error || '')}</p>
                <div class="switcher-mapping-head"><div><h3>Mapa de cámaras</h3><p>Cada cámara de este proyecto controla una entrada.</p></div></div>
                <div class="switcher-mapping-scroll"><table><thead><tr><th>Cámara</th><th id="switcher-input-heading">${kind === 'obs' ? 'Escena de OBS' : 'Entrada ATEM'}</th></tr></thead>
                    <tbody id="switcher-map-body">${htmlMapeoSwitcher(cams, mapa, kind, inputs)}</tbody>
                </table></div>
            </section>
        </div>`;
}

/**
 * La sala completa. `datos` trae lo que la plantilla original tomaba del
 * cierre de createProductionView.
 */
export function htmlSalaDeControl({ project, programa, hayPrograma, hayEscaleta, cams, checklist, listo,
    alistamientoPct, totalItems, diagCount, runCount, inspectorVisible, filtroActivo, switcher = {} }) {
    const switcherVM = switcher || {};
    const switcherStatus = switcherVM.status || {};
    return `
        <div class="studio-workspace ${inspectorVisible ? 'with-inspector' : 'inspector-collapsed'}">
            <!-- CABECERA PRINCIPAL APPLE STUDIO: TÍTULO Y ACCIONES DE SISTEMA -->
            <header class="studio-header">
                <div class="studio-header-identity">
                    <span class="studio-eyebrow">SALA DE CONTROL · MASTER CONTROL ROOM</span>
                    <h1 class="studio-title">${esc(project.name)}</h1>
                </div>

                <!-- ACCIONES SUPERIORES APPLE: SWITCHER, TELEPROMPTER E INSPECTOR -->
                <div class="studio-header-actions">
                    <button id="switcher-status-btn" class="apple-studio-btn lg-interactive switcher-status ${esc(switcherStatus.estado || 'desconectado')}" type="button" title="Conectar la app con OBS o con un ATEM">
                        <span class="switcher-status-dot" aria-hidden="true"></span><span id="switcher-status-label">${esc(etiquetaEstadoSwitcher(switcherStatus))}</span>
                    </button>
                    <button id="switcher-follow" class="apple-studio-btn toggle-btn lg-interactive ${switcherVM.followRundown ? 'active' : ''}" role="switch" aria-checked="${switcherVM.followRundown ? 'true' : 'false'}"
                        title="Al entrar un paso nuevo, poner automáticamente su cámara al aire">
                        <span>Seguir la escaleta</span>
                    </button>
                    <button id="open-prompter" class="apple-studio-btn lg-interactive" ${hayEscaleta ? '' : 'disabled'}
                        title="Guion en teleprompter con auto-scroll y modo espejo">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        <span>Teleprompter</span>
                    </button>
                    <button id="toggle-inspector" class="apple-studio-btn toggle-btn lg-interactive ${inspectorVisible ? 'active' : ''}"
                        title="Mostrar u ocultar inspector de alistamiento técnico (I)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                        <span>Alistamiento</span>
                        <span class="inspector-badge ${listo ? 'ok' : 'pending'}">${listo ? '✓' : totalItems}</span>
                    </button>
                </div>
            </header>

            <!-- CUERPO DE CABINA: CABINA REPRODUCTOR + INSPECTOR LATERAL -->
            <div class="studio-body">
                <!-- CABINA PRINCIPAL BROADCAST: VIDEO PLAYER HERO STAGE -->
                <main class="studio-main-stage studio-player-stage">
                    <!-- ÁREA DEL LIENZO HERÓICO (VIEWPORT CON HUDS FLOTANTES LIQUID GLASS) -->
                    <div class="player-canvas-area" id="vivo-canvas-viewport">
                        <!-- EL PROTAGONISTA: LIENZO CENITAL BLUEPRINT EXPANDIDO -->
                        <div class="set-live" id="vivo-plano"></div>

                        <!-- HUD FLOTANTE SUPERIOR IZQUIERDO: MICRO-CÁPSULAS PGM Y PVW (APPLE GLASS) -->
                        <div class="player-hud-top-left" aria-label="Monitores de emisión">
                            <div class="hud-monitor pgm">
                                <span class="tally-tag pgm"><span class="tally-led"></span> PGM</span>
                                <span id="vivo-aire" class="hud-mon-source">—</span>
                                <span id="vivo-aire-sub" class="hud-mon-sub">—</span>
                            </div>
                            <div class="hud-monitor pvw">
                                <span class="tally-tag pvw"><span class="tally-led"></span> PVW</span>
                                <span id="vivo-previo" class="hud-mon-source">—</span>
                                <span id="vivo-previo-sub" class="hud-mon-sub">—</span>
                            </div>
                        </div>

                        <!-- HUD FLOTANTE SUPERIOR DERECHO: MICRO-CÁPSULA DE RUNDOWN (APPLE GLASS) -->
                        <div class="player-hud-top-right" aria-label="Escaleta en tiempo real">
                            <div class="hud-rundown-step now">
                                <span class="rundown-badge-now">AHORA</span>
                                <span id="vivo-pos" class="rundown-step-counter">1 de ${programa.pasos.length || 1}</span>
                                <span id="vivo-seg" class="hud-step-title">—</span>
                                <span id="vivo-texto" class="hud-step-text"></span>
                                <div id="vivo-etiquetas" class="hud-step-tags" hidden></div>
                            </div>
                            <span class="hud-rundown-divider" aria-hidden="true"></span>
                            <div class="hud-rundown-step next">
                                <span class="rundown-badge-next">SIGUE</span>
                                <span id="vivo-resta" class="rundown-countdown"></span>
                                <span id="vivo-sig" class="hud-step-title next">—</span>
                                <small id="vivo-sig-sub" class="hud-step-sub next" hidden></small>
                            </div>
                        </div>

                        <!-- OVERLAY INFERIOR DE LEYENDAS Y HINTS -->
                        <div class="player-hud-bottom-overlay">
                            <div class="legend-pills-wrap">
                                <span class="studio-pill pgm"><span class="led-dot"></span> PGM Al aire</span>
                                <span class="studio-pill pvw"><span class="led-dot"></span> PVW En previo</span>
                            </div>
                            <span class="blueprint-hint">Teclas 1..${cams.length || 1} conmutan · Enter: CUT</span>
                        </div>

                        <p class="vivo-desvio" id="vivo-desvio" hidden></p>
                    </div>

                    <!-- CONSOLA INFERIOR DEL REPRODUCTOR (MASTER DOCK: SCRUBBER + TRANSPORTE + SWITCHER) -->
                    <footer class="player-bottom-console lg-container" aria-label="Consola maestra de reproducción y conmutación">
                        <!-- LÍNEA DE TIEMPO INTERACTIVA (SCRUBBER PROFESIONAL) -->
                        <div class="player-scrubber-bar">
                            <div class="studio-scrubber-track" id="vivo-scrubber" title="Hacer clic o arrastrar para saltar en la línea de tiempo">
                                <i id="vivo-avance" class="studio-scrubber-fill"></i>
                                <span class="studio-scrubber-thumb"></span>
                            </div>
                        </div>

                        <!-- BARRA DE CONTROLES: TRANSPORTE + TIMECODE + SWITCHER BUS -->
                        <div class="player-controls-row">
                            <!-- CLÚSTER DE TRANSPORTE Y TIMECODE -->
                            <div class="player-transport-cluster">
                                <button id="vivo-prev-step" class="transport-step-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                    title="Paso anterior (J)">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                                </button>
                                <button id="vivo-play" class="transport-btn play-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                    title="${hayPrograma ? 'Arrancar o pausar la emisión (Espacio)' : 'Sin segmentos'}">
                                    <span class="play-btn-icon-wrap" id="vivo-play-icon">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                                    </span>
                                    <b id="vivo-play-t">Arrancar</b>
                                </button>
                                <button id="vivo-next-step" class="transport-step-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                    title="Paso siguiente (L)">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                                </button>
                                <button id="vivo-reset" class="transport-btn reset-btn lg-interactive" ${hayPrograma ? '' : 'disabled'}
                                    title="Reiniciar tiempo a 00:00 (R)">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                </button>

                                <div class="player-timecode-cluster">
                                    <div class="timecode-primary">
                                        <span id="vivo-t" class="timecode-digits">00:00</span>
                                        <span class="timecode-badge standby">STANDBY</span>
                                    </div>
                                    <div class="timecode-secondary">
                                        <span id="vivo-resta-total">Restante: -${formatTime(programa.total)}</span>
                                        <span class="timecode-sep">·</span>
                                        <span>Total: ${formatTime(programa.total)}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="player-dock-divider"></div>

                            <!-- CLÚSTER SWITCHER DE CÁMARAS (APPLE GLASS PAD) -->
                            <div class="player-switcher-cluster" aria-label="Switcher de cámaras">
                                <div class="player-cams-strip">
                                    ${cams.length
                                        ? cams.map((c, i) => `
                                            <button class="switcher-cam-btn switcher-cam-pad lg-interactive" data-cam="${c.id}" data-idx="${i + 1}"
                                                title="Conmutar ${esc(c.nombre || `CAM ${i + 1}`)} al aire (Tecla ${i + 1})">
                                                <div class="cam-pad-header">
                                                    <span class="cam-btn-num">${i + 1}</span>
                                                    <span class="cam-pad-tally-bar"></span>
                                                    <span class="cam-pad-status-tag"></span>
                                                </div>
                                                <div class="cam-pad-body">
                                                    <b class="cam-btn-name">${esc(c.nombre || `CAM ${i + 1}`)}</b>
                                                    <span class="cam-btn-plano">${esc(c.plano || 'Plano')}</span>
                                                </div>
                                            </button>`).join('')
                                        : '<span class="cams-empty-msg">Sin cámaras configuradas</span>'}
                                </div>
                                <div class="player-trans-cluster">
                                    <button id="vivo-cut-btn" class="switcher-action-btn cut-action-btn lg-interactive" title="Conmutar previo al aire inmediatamente (Enter)">
                                        <span class="trans-btn-label">CUT</span>
                                    </button>
                                    <button id="vivo-auto-btn" class="switcher-action-btn auto-action-btn lg-interactive" title="Conmutación automática de señal">
                                        <span class="trans-btn-label">AUTO</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </footer>
                </main>

                <!-- INSPECTOR LATERAL DE ALISTAMIENTO TÉCNICO (FLIGHT READINESS) -->
                <aside class="studio-readiness-inspector lg-container ${inspectorVisible ? '' : 'hidden'}" aria-label="Alistamiento del foro">
                    <div class="inspector-cab">
                        <div class="inspector-title-wrap">
                            <span class="inspector-eyebrow">PRE-FLIGHT CHECKLIST</span>
                            <h2>Alistamiento</h2>
                        </div>
                        <span class="inspector-status-pill ${listo ? 'ok' : 'pending'}">${checklist.statusLabel}</span>
                    </div>

                    <!-- GAUGE DE PREPARACIÓN -->
                    <div class="inspector-gauge-card">
                        <div class="gauge-meta">
                            <span>Preparación técnica</span>
                            <b class="gauge-pct">${alistamientoPct}%</b>
                        </div>
                        <div class="gauge-track">
                            <div class="gauge-bar ${listo ? 'ok' : ''}" style="width:${alistamientoPct}%"></div>
                        </div>
                    </div>

                    <!-- FILTROS RÁPIDOS POR SUBSISTEMA -->
                    <div class="inspector-filter-chips">
                        <button class="filter-chip ${filtroActivo === 'all' ? 'active' : ''}" data-filter="all">Todos (${totalItems})</button>
                        <button class="filter-chip ${filtroActivo === 'diagram' ? 'active' : ''}" data-filter="diagram">Diagrama (${diagCount})</button>
                        <button class="filter-chip ${filtroActivo === 'rundown' ? 'active' : ''}" data-filter="rundown">Guion (${runCount})</button>
                    </div>

                    <!-- LISTA DE VERIFICACIONES CON MICRO-TARJETAS -->
                    <div class="inspector-items-scroll" id="inspector-items-box">
                        ${htmlChecklist(checklist.byCategory(filtroActivo))}
                    </div>
                </aside>
            </div>
            ${htmlPanelSwitcher({ cams, status: switcherStatus, options: switcherVM.options, mapa: switcherVM.mapa, inputs: switcherVM.inputs, tactil: switcherVM.tactil === true })}
        </div>`;
}

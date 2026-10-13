import React, { useMemo, useState, useRef, useEffect } from "react";
import { ScanLine, Trash2 } from "lucide-react";
import { MUEBLES_CATALOGO } from "./catalogos.js";
import { computeFuentes } from "./escaleta.js";
import { MuebleIcon } from "./glifos.jsx";
import { EstudioCenital } from "./EstudioCenital.jsx";
import { PanelIluminacion } from "./PanelIluminacion.jsx";
import { PersonalGrid } from "./PersonalGrid.jsx";
import { SetCommandManager, AddFurnitureCommand, RemoveFurnitureCommand, ToggleTalentSeatCommand } from "./setCommands.js";
import { SET_LAYOUT_STRATEGIES, applyLayoutStrategy } from "./layoutStrategies.js";
import {
  aplicarMedidasForo,
  clavesActivasDelSet,
  FORO_COMO_ESTABA,
  medidasForo,
  posicionesFueraDelForo,
  traerElementosAdentro,
} from "./setGeometria.js";
import { conOrientacionDeCamara, posMuebleDefault, setActivoDe, setNuevo, upSetPor } from "./sets.js";
import { conCapturaEnStoryboard } from "./tomas.js";
import { TarjetaAyuda } from "./ui.jsx";
import { trunc, uid } from "./util.js";
import {
  describirEscaneoForo,
  escanearForo,
  intercambiarEscaneoForo,
  normalizarEscaneoForo,
  puedeEscanearForo,
} from "./escaneoForo.js";

// El visor y Three.js se descargan del paquete sólo cuando se abre la vista 3D.
const VisorSet3D = React.lazy(() => import("./VisorSet3D.jsx"));

const PRESETS_FORO = [
  { nombre: "Aula", medidas: { ancho: 8, fondo: 6, alto: 3 } },
  { nombre: "Foro chico", medidas: { ancho: 10, fondo: 8, alto: 4 } },
  { nombre: "Foro grande", medidas: { ancho: 18, fondo: 11, alto: 6 } },
  { nombre: "Como estaba", medidas: FORO_COMO_ESTABA },
];

const paraCampo = (valor) => String(Math.round(valor * 10) / 10);

function MedidasDelForo({ set, editable, onAplicar }) {
  const medidas = medidasForo(set);
  const [escaneoDisponible, setEscaneoDisponible] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [escaneo, setEscaneo] = useState(null);
  const [avisoEscaneo, setAvisoEscaneo] = useState("");
  const [borrador, setBorrador] = useState(() => ({
    ancho: paraCampo(medidas.ancho),
    fondo: paraCampo(medidas.fondo),
    alto: paraCampo(medidas.alto),
  }));

  useEffect(() => {
    setBorrador({
      ancho: paraCampo(medidas.ancho),
      fondo: paraCampo(medidas.fondo),
      alto: paraCampo(medidas.alto),
    });
    setEscaneo(null);
    setAvisoEscaneo("");
  }, [set.id, medidas.ancho, medidas.fondo, medidas.alto]);

  useEffect(() => {
    let montado = true;
    puedeEscanearForo().then((disponible) => {
      if (montado) setEscaneoDisponible(disponible);
    });
    return () => { montado = false; };
  }, []);

  const confirmar = (campo) => {
    const numero = Number(borrador[campo]);
    const sinCambioVisual = borrador[campo] === paraCampo(medidas[campo]);
    const siguientes = {
      ...medidas,
      [campo]: sinCambioVisual || !Number.isFinite(numero) ? medidas[campo] : numero,
    };
    const normalizadas = medidasForo(aplicarMedidasForo(set, siguientes));
    setBorrador((actual) => ({ ...actual, [campo]: paraCampo(normalizadas[campo]) }));
    onAplicar(normalizadas);
  };

  const aplicarPreset = (preset) => {
    setBorrador({
      ancho: paraCampo(preset.ancho),
      fondo: paraCampo(preset.fondo),
      alto: paraCampo(preset.alto),
    });
    onAplicar(preset);
  };

  const iniciarEscaneo = async () => {
    setEscaneando(true);
    setEscaneo(null);
    setAvisoEscaneo("");
    try {
      const resultado = await escanearForo();
      if (resultado?.cancelado) return;
      if (resultado?.error) throw new Error(resultado.error);
      const valido = normalizarEscaneoForo(resultado);
      if (!valido) throw new Error("El escaneo no produjo medidas completas del foro.");
      setEscaneo(valido);
    } catch (error) {
      setAvisoEscaneo(error?.message || "No se pudo medir el foro.");
    } finally {
      setEscaneando(false);
    }
  };

  const usarEscaneo = () => {
    if (!escaneo) return;
    const siguientes = { ancho: escaneo.ancho, fondo: escaneo.fondo, alto: escaneo.alto };
    setBorrador({
      ancho: paraCampo(siguientes.ancho),
      fondo: paraCampo(siguientes.fondo),
      alto: paraCampo(siguientes.alto),
    });
    onAplicar(siguientes);
    setEscaneo(null);
  };

  return (
    <section className="medidas-foro flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Medidas del foro</span>
        <strong className="text-[11px] tabular-nums text-blue-200">
          {(medidas.ancho * medidas.fondo).toFixed(1)} m²
        </strong>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: "ancho", etiqueta: "Ancho", min: 2, max: 40 },
          { id: "fondo", etiqueta: "Fondo", min: 2, max: 40 },
          { id: "alto", etiqueta: "Alto", min: 2.2, max: 12 },
        ].map((campo) => (
          <label key={campo.id} className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold text-white/60">
            <span>{campo.etiqueta} (m)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={campo.min}
              max={campo.max}
              value={borrador[campo.id]}
              disabled={!editable}
              data-tactil="true"
              onChange={(e) => setBorrador((actual) => ({ ...actual, [campo.id]: e.target.value }))}
              onBlur={() => confirmar(campo.id)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="min-w-0 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs font-bold tabular-nums text-white focus:border-blue-500 focus:outline-none"
              aria-label={`${campo.etiqueta} del foro en metros`}
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS_FORO.map((preset) => (
          <button
            key={preset.nombre}
            type="button"
            disabled={!editable}
            data-tactil="true"
            onClick={() => aplicarPreset(preset.medidas)}
            className="min-h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-[10.5px] font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            {preset.nombre}
          </button>
        ))}
      </div>
      {escaneoDisponible && editable && (
        <button
          type="button"
          disabled={escaneando}
          data-tactil="true"
          onClick={iniciarEscaneo}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-65"
          aria-label="Escanear las medidas del foro con LiDAR"
        >
          <ScanLine size={18} aria-hidden="true" />
          {escaneando ? "Abriendo escáner…" : "Escanear foro"}
        </button>
      )}
      {escaneo && (
        <div className="flex flex-col gap-2 rounded-xl border border-blue-400/30 bg-blue-400/10 p-2.5" role="status">
          <p className="text-xs font-semibold leading-relaxed text-blue-50">
            {describirEscaneoForo(escaneo)}
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              data-tactil="true"
              onClick={usarEscaneo}
              className="min-h-[44px] rounded-lg bg-blue-500 px-3 text-[11px] font-bold text-white hover:bg-blue-400"
            >
              Usar estas medidas
            </button>
            <button
              type="button"
              data-tactil="true"
              onClick={() => setEscaneo((actual) => intercambiarEscaneoForo(actual))}
              className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-3 text-[11px] font-bold text-white/85 hover:bg-white/10"
            >
              Intercambiar ancho y fondo
            </button>
            <button
              type="button"
              data-tactil="true"
              onClick={() => setEscaneo(null)}
              className="min-h-[44px] rounded-lg px-3 text-[11px] font-bold text-white/65 hover:bg-white/5 hover:text-white"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
      {avisoEscaneo && (
        <p className="text-[11px] leading-relaxed text-amber-200" role="alert">{avisoEscaneo}</p>
      )}
    </section>
  );
}

/**
 * VistaSet:
 * Estación de trabajo profesional CAD/Estudio para televisión (macOS Studio Layout).
 * Doble panel: Canvas 2D interactivo central + Inspector lateral derecho colapsable.
 * Integra patrones GoF: Abstract Factory, Command Pattern, State Pattern, Strategy Pattern.
 */
export function VistaSet({ cfg, setCfg }) {
  const fuentes = useMemo(() => computeFuentes(cfg), [cfg]);
  const cams = useMemo(() => fuentes.filter((f) => f.tipo === "cam"), [fuentes]);
  const editable = typeof setCfg === "function";
  const sets = cfg.sets || [];
  const activo = setActivoDe(cfg);

  // Inspector lateral y pestaña activa
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState("set"); // 'set' | 'luces' | 'muebles' | 'personal'
  const [selectedEntityKey, setSelectedEntityKey] = useState(null);

  // Toggles visuales del Canvas
  const [showLabels, setShowLabels] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [confirmaDel, setConfirmaDel] = useState(false);
  const [strategyMenuOpen, setStrategyMenuOpen] = useState(false);
  const [visor3DOpen, setVisor3DOpen] = useState(false);

  // Gestor de Comandos GoF con soporte Undo/Redo. Existe siempre que el
  // proyecto es editable, y las acciones de mobiliario salen antes si no lo
  // es: por eso usan cmdMgr directo, sin una segunda copia "por si acaso" de
  // la misma lógica (había una, nunca corría y se iba quedando vieja).
  const commandManagerRef = useRef(null);
  if (!commandManagerRef.current && editable) {
    commandManagerRef.current = new SetCommandManager(setCfg);
  }
  const cmdMgr = commandManagerRef.current;
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    if (!cmdMgr) return;
    return cmdMgr.subscribe(setHistoryState);
  }, [cmdMgr]);

  // Selección de entidad en el Canvas -> activa automáticamente la pestaña correspondiente en el Inspector
  const handleSelectEntity = (key, type) => {
    setSelectedEntityKey(key);
    if (!key) return;
    if (type === "light") setInspectorTab("luces");
    else if (type === "furniture") setInspectorTab("muebles");
    else if (type === "talent" || type === "camera") setInspectorTab("personal");
    else if (type === "focus") setInspectorTab("set");
  };

  // Acciones de mobiliario con Command Pattern
  const agregarMueble = (tipo) => {
    if (!editable) return;
    const id = uid();
    const n = (activo.muebles || []).length;
    const item = { id, tipo, ocupantes: [] };
    const pos = posMuebleDefault(n, activo, tipo);

    cmdMgr.execute(new AddFurnitureCommand(activo.id, item, pos));
  };

  const quitarMueble = (id) => {
    if (!editable) return;
    const mueble = (activo.muebles || []).find((m) => m.id === id);
    if (!mueble) return;
    const curPos = activo.setLayout?.pos?.[`mue:${id}`];
    const curRot = activo.setLayout?.rot?.[`mue:${id}`];

    cmdMgr.execute(new RemoveFurnitureCommand(activo.id, mueble, curPos, curRot));
  };

  const toggleAsiento = (muebleId, talId) => {
    if (!editable) return;
    const mueble = (activo.muebles || []).find((m) => m.id === muebleId);
    if (!mueble) return;
    const dentro = (mueble.ocupantes || []).includes(talId);
    const cap = MUEBLES_CATALOGO[mueble.tipo]?.cap ?? 1;
    if (!dentro && (mueble.ocupantes || []).length >= cap) return;

    cmdMgr.execute(new ToggleTalentSeatCommand(activo.id, muebleId, talId, dentro));
  };

  // Gestión de sets
  const elegirSet = (id) => {
    setConfirmaDel(false);
    setSelectedEntityKey(null);
    setCfg((c) => ({ ...c, setActivo: id }), { commit: true });
  };

  const agregarSet = () => setCfg((c) => {
    const nuevo = setNuevo((c.sets || []).length + 1);
    return { ...c, sets: [...(c.sets || []), nuevo], setActivo: nuevo.id };
  }, { commit: true });

  const upActivo = (patch, opts) => setCfg((c) => upSetPor(c, activo.id, (s) => ({ ...s, ...patch })), opts);

  const eliminarSet = () => {
    if (!confirmaDel) { setConfirmaDel(true); return; }
    setConfirmaDel(false);
    setCfg((c) => {
      const rest = (c.sets || []).filter((s) => s.id !== activo.id);
      return rest.length ? { ...c, sets: rest, setActivo: rest[0].id } : c;
    }, { commit: true });
  };

  const aplicarEstrategia = (stratId) => {
    setStrategyMenuOpen(false);
    setCfg((c) => ({
      ...c,
      sets: (c.sets || []).map((s) => s.id === activo.id ? applyLayoutStrategy(stratId, c, s) : s),
    }), { commit: true });
  };

  const clavesActivas = clavesActivasDelSet(cfg, activo, cams);
  const posicionesFuera = posicionesFueraDelForo(activo, clavesActivas);
  const guardarMedidasForo = (medidas) => setCfg((c) => upSetPor(
    c,
    activo.id,
    (s) => aplicarMedidasForo(s, medidas)
  ), { commit: true });

  const traerAdentro = () => setCfg((c) => upSetPor(
    c,
    activo.id,
    (s) => traerElementosAdentro(s, clavesActivasDelSet(c, s, cams))
  ), { commit: true });

  const orientarCamara = (camaraId, orientacion) => {
    if (!editable) return;
    setCfg((c) => upSetPor(c, activo.id, (s) => conOrientacionDeCamara(s, camaraId, orientacion)), { commit: true });
  };

  const guardarCapturaStoryboard = (destino) => {
    if (!editable) return;
    setCfg((c) => conCapturaEnStoryboard(c, destino), { commit: true });
  };

  return (
    <div className="vista-set relative flex h-[calc(100vh-50px)] w-full flex-col overflow-hidden bg-[#0a0f18] text-white select-none">
      {/* 1. BARRA SUPERIOR UNIFICADA DE ESTUDIO (macOS Studio Toolbar) */}
      <div className="set-toolbar no-print z-20 flex h-12 w-full flex-shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-4 backdrop-blur-xl">
        {/* Lado Izquierdo: Selector de Sets estilo Segmented Control */}
        <div className="set-toolbar-left flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center rounded-xl bg-white/[0.06] p-1 border border-white/10">
            {sets.map((s) => {
              const esActivo = s.id === activo.id;
              return (
                <button
                  key={s.id}
                  onClick={() => elegirSet(s.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    esActivo
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{s.nombre}</span>
                  <span className="text-[10px] font-normal opacity-70">
                    {s.locacion === "ext" ? "EXT" : "INT"}
                  </span>
                </button>
              );
            })}
            {editable && (
              <button
                onClick={agregarSet}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                title="Crear un nuevo set de rodaje"
              >
                + Nuevo
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setVisor3DOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-blue-400/50 bg-blue-500/15 px-3 py-1.5 text-xs font-bold text-blue-200 shadow-sm transition-colors hover:bg-blue-500/25 hover:text-white"
            title="Abrir una vista tridimensional de consulta"
          >
            Ver en 3D
          </button>
        </div>

        {/* Centro: Herramientas del Canvas y Reacomodo Inteligente */}
        <div className="set-toolbar-center flex items-center gap-2">
          {/* Toggles de Guías y Etiquetas */}
          <div className="flex items-center rounded-xl bg-white/[0.06] p-1 border border-white/10">
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                showLabels ? "bg-white/20 text-white font-bold" : "text-white/60 hover:text-white"
              }`}
              title="Mostrar u ocultar nombres en el plano"
            >
              Etiquetas
            </button>
            <button
              onClick={() => setShowGuides(!showGuides)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                showGuides ? "bg-white/20 text-white font-bold" : "text-white/60 hover:text-white"
              }`}
              title="Mostrar u ocultar conos de visión y proyección de luz"
            >
              Guías
            </button>
          </div>

          {/* Menú de Reacomodo Inteligente (Strategy Pattern) */}
          {editable && (
            <div className="relative">
              <button
                onClick={() => setStrategyMenuOpen(!strategyMenuOpen)}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors shadow-sm"
              >
                <span>Reacomodar set</span>
                <span className="text-[10px] opacity-70">▾</span>
              </button>

              {strategyMenuOpen && (
                <div className="absolute top-10 left-0 z-30 w-64 rounded-2xl border border-white/15 bg-[#141b27] p-1.5 shadow-2xl backdrop-blur-2xl">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50 border-b border-white/10 mb-1">
                    Presets de distribución
                  </div>
                  {SET_LAYOUT_STRATEGIES.map((strat) => (
                    <button
                      key={strat.id}
                      onClick={() => aplicarEstrategia(strat.id)}
                      className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <div className="font-bold">{strat.label}</div>
                      <div className="text-[10px] opacity-70 line-clamp-1">{strat.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deshacer / Rehacer local del Set */}
          {editable && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => cmdMgr?.undo()}
                disabled={!historyState.canUndo}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white/80 hover:bg-white/15 disabled:opacity-30 transition-colors"
                title="Deshacer en set (⌘Z)"
              >
                ⟲
              </button>
              <button
                onClick={() => cmdMgr?.redo()}
                disabled={!historyState.canRedo}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white/80 hover:bg-white/15 disabled:opacity-30 transition-colors"
                title="Rehacer en set (⇧⌘Z)"
              >
                ⟳
              </button>
            </div>
          )}
        </div>

        {/* Lado Derecho: Ayuda e Inspector Toggle */}
        <div className="set-toolbar-right flex items-center gap-2">
          <TarjetaAyuda
            id="set"
            titulo="Cómo montar tu set de rodaje"
            pasos={[
              "<b>Elige o crea un set</b> desde la barra superior; cada set guarda su propia planta física.",
              "<b>Agrega mobiliario</b> desde el Inspector lateral y arrástralo en el plano para ubicarlo.",
              "Gira las cámaras con su manija para el ángulo aproximado y afina <b>pan y tilt en Vista 3D</b>.",
              "<b>Doble clic en una etiqueta</b> la oculta individualmente; el toggle superior las controla todas.",
              "Usa <b>Reacomodar set</b> para aplicar fórmulas probadas de la industria (Noticiero, Talk Show, Debate).",
            ]}
          />

          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
              inspectorOpen
                ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
            }`}
            title="Mostrar u ocultar el panel de propiedades"
          >
            <span>Inspector</span>
          </button>
        </div>
      </div>

      {/* 2. ÁREA DE TRABAJO PRINCIPAL (Canvas 2D + Inspector Lateral) */}
      <div className="set-workspace flex flex-1 overflow-hidden">
        {/* Canvas Central */}
        <div className="set-canvas flex flex-1 flex-col items-center justify-center p-4 overflow-hidden bg-[#0d121c]">
          <div className="w-full max-w-5xl">
            {posicionesFuera.length > 0 && (
              <div className="no-print mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-100" role="status">
                <span className="flex-1">
                  {posicionesFuera.length === 1
                    ? "Hay 1 elemento fuera de las nuevas medidas."
                    : `Hay ${posicionesFuera.length} elementos fuera de las nuevas medidas.`}
                </span>
                {editable && (
                  <button
                    type="button"
                    data-tactil="true"
                    onClick={traerAdentro}
                    className="min-h-8 rounded-lg border border-red-300/40 bg-red-400/15 px-3 font-bold text-red-50 hover:bg-red-400/25"
                  >
                    Traer adentro
                  </button>
                )}
              </div>
            )}
            <EstudioCenital
              key={activo.id}
              cfg={cfg}
              set={activo}
              cams={cams}
              editable={editable}
              setCfg={setCfg}
              showLabels={showLabels}
              showGuides={showGuides}
              selectedKey={selectedEntityKey}
              onSelectEntity={handleSelectEntity}
              commandManager={cmdMgr}
            />
          </div>
        </div>

        {/* Inspector Lateral Derecho (Apple Studio Inspector) */}
        {inspectorOpen && (
          <aside className="set-inspector no-print flex w-[350px] flex-shrink-0 flex-col border-l border-white/10 bg-[#111824]/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
            {/* Pestañas del Inspector */}
            <div className="flex border-b border-white/10 bg-black/20 p-1">
              {[
                { id: "set", label: "Espacio" },
                { id: "luces", label: "Iluminación" },
                { id: "muebles", label: "Mobiliario" },
                { id: "personal", label: "Equipo" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id)}
                  className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all ${
                    inspectorTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenido scrolleable del Inspector */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
              {/* TAB 1: SET & ESPACIO */}
              {inspectorTab === "set" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Nombre del set</label>
                    <input
                      value={activo.nombre}
                      onChange={(e) => upActivo({ nombre: e.target.value })}
                      disabled={!editable}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Nombre del set…"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Tipo de locación</label>
                    <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
                      <button
                        onClick={() => upActivo({ locacion: "int" }, { commit: true })}
                        disabled={!editable}
                        className={`flex-1 rounded-lg py-1 text-xs font-bold transition-all ${
                          activo.locacion !== "ext" ? "bg-blue-600 text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        Estudio interior
                      </button>
                      <button
                        onClick={() => upActivo({ locacion: "ext" }, { commit: true })}
                        disabled={!editable}
                        className={`flex-1 rounded-lg py-1 text-xs font-bold transition-all ${
                          activo.locacion === "ext" ? "bg-blue-600 text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        Locación exterior
                      </button>
                    </div>
                  </div>

                  <MedidasDelForo
                    set={activo}
                    editable={editable}
                    onAplicar={guardarMedidasForo}
                  />

                  {editable && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Rótulo de Pantalla</label>
                      <input
                        value={cfg.pantalla || ""}
                        onChange={(e) => setCfg((c) => ({ ...c, pantalla: e.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Texto de la pantalla de fondo…"
                      />
                    </div>
                  )}

                  {editable && activo.mesaVisible !== false && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Rótulo de Mesa</label>
                      <input
                        value={cfg.mesa || ""}
                        onChange={(e) => setCfg((c) => ({ ...c, mesa: e.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Texto al frente de la mesa…"
                      />
                    </div>
                  )}

                  {/* Eliminar set si hay más de 1 */}
                  {editable && sets.length > 1 && (
                    <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                      <button
                        onClick={eliminarSet}
                        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 py-1.5 font-bold transition-colors"
                      >
                        {confirmaDel ? "¿Confirmar eliminación del set?" : "Eliminar este set"}
                      </button>
                      {confirmaDel && (
                        <button
                          onClick={() => setConfirmaDel(false)}
                          className="w-full rounded-xl border border-white/10 text-white/60 hover:bg-white/5 py-1 text-xs transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ILUMINACIÓN */}
              {inspectorTab === "luces" && (
                <PanelIluminacion key={activo.id} cfg={cfg} set={activo} setCfg={setCfg} />
              )}

              {/* TAB 3: MOBILIARIO */}
              {inspectorTab === "muebles" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Catálogo de mobiliario</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(MUEBLES_CATALOGO).map(([id, d]) => (
                        <button
                          key={id}
                          onClick={() => agregarMueble(id)}
                          disabled={!editable}
                          className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 hover:border-white/20 transition-all text-center"
                        >
                          <MuebleIcon tipo={id} width={42} height={20} />
                          <span className="mt-1 font-bold text-[11px] text-white/90">{d.es}</span>
                          <span className="text-[9px] text-white/50">{d.cap === 0 ? "Sin plazas" : d.cap > 1 ? `${d.cap} plazas` : "1 plaza"}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lista de muebles en el set */}
                  {(activo.muebles || []).length > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                        En el set ({(activo.muebles || []).length})
                      </label>
                      {(activo.muebles || []).map((m) => {
                        const def = MUEBLES_CATALOGO[m.tipo] || { es: m.tipo, cap: 1 };
                        const ocupantes = m.ocupantes || [];
                        return (
                          <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MuebleIcon tipo={m.tipo} width={36} height={18} />
                                <span className="font-bold text-white/90">{def.es}</span>
                              </div>
                              {editable && (
                                <button
                                  onClick={() => quitarMueble(m.id)}
                                  className="text-white/40 hover:text-red-400 transition-colors p-1"
                                  title="Quitar mueble del plano"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>

                            {/* Talentos para sentar */}
                            {def.cap > 0 && <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-white/5">
                              <span className="text-[10px] text-white/50">Sentar:</span>
                              {(cfg.talentos || []).map((t) => {
                                const dentro = ocupantes.includes(t.id);
                                const lleno = !dentro && ocupantes.length >= def.cap;
                                return (
                                  <button
                                    key={t.id}
                                    onClick={() => toggleAsiento(m.id, t.id)}
                                    disabled={lleno || !editable}
                                    className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition-all ${
                                      dentro
                                        ? "bg-purple-600 border-purple-500 text-white"
                                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
                                    }`}
                                  >
                                    {dentro ? "✓ " : "+ "}{trunc(t.nombre, 12)}
                                  </button>
                                );
                              })}
                            </div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PERSONAL */}
              {inspectorTab === "personal" && (
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Personal de Operación</label>
                  <PersonalGrid cfg={cfg} cams={cams} />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {visor3DOpen && (
        <React.Suspense
          fallback={(
            <div className="fixed inset-0 z-[60] grid place-items-center bg-[#ecedef] text-sm font-semibold text-slate-800">
              Preparando vista 3D…
            </div>
          )}
        >
          <VisorSet3D
            cfg={cfg}
            set={activo}
            cams={cams}
            editable={editable}
            onGuardarCaptura={guardarCapturaStoryboard}
            onOrientarCamara={orientarCamara}
            onClose={() => setVisor3DOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
}

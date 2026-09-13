import React, { useLayoutEffect, useRef, useMemo } from "react";
import { ChevronDown, ChevronRight, ChevronUp, GripVertical } from "lucide-react";
import { SECCIONES_DEPRECADAS, SECCIONES_INFO } from "./catalogos.js";
import { computeBloques, computeFuentes, computeRows } from "./escaleta.js";
import { Escaleta, Timeline } from "./EscaletaVistas.jsx";
import { EstudioCenital } from "./EstudioCenital.jsx";
import { PersonalGrid } from "./PersonalGrid.jsx";
import { useReorder } from "./hooks.js";
import { normSecciones } from "./proyecto.js";
import { reacomodoDe, upSetPor } from "./sets.js";
import { AIR_COLOR, NAVY } from "./theme.js";
import { fmt, reorder } from "./util.js";

/**
 * Estudio: Muestra la planta física de los sets en la infografía general.
 */
function Estudio({ cfg, fuentes, setCfg }) {
  const cams = fuentes.filter((f) => f.tipo === "cam");
  const editable = typeof setCfg === "function";
  const sets = cfg.sets || [];
  const reacomodar = (setId) => setCfg((c) => upSetPor(c, setId, reacomodoDe), { commit: true });

  return (
    <div className="flex flex-col gap-3">
      {sets.map((s) => {
        const tieneCustom = Object.keys(s.setLayout?.pos || {}).length > 0 || Object.keys(s.setLayout?.rot || {}).length > 0;
        return (
          <div key={s.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                  {s.nombre}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                  {s.locacion === "ext" ? "EXTERIOR" : "ESTUDIO"}
                </span>
              </div>
              {editable && tieneCustom && (
                <button
                  onClick={() => reacomodar(s.id)}
                  className="no-print rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Reacomodar set
                </button>
              )}
            </div>
            <EstudioCenital key={s.id} cfg={cfg} set={s} cams={cams} editable={editable} setCfg={setCfg} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * SeccionPanel: Panel de sección de la infografía estilo Apple Studio.
 */
function SeccionPanel({ titulo, abierto, controls, onToggle, onUp, onDown, canUp, canDown, source, target, dragging, over, children }) {
  return (
    <div
      {...(controls ? target : {})}
      className={`overflow-hidden rounded-2xl border transition-all ${abierto ? "border-white/15 bg-white/[0.03] shadow-lg" : "border-white/10 bg-white/[0.02] seccion-cerrada"}`}
      style={{
        opacity: dragging ? 0.35 : 1,
        outline: over && !dragging ? `2px dashed ${AIR_COLOR}` : "none",
        outlineOffset: 2,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 transition-colors"
        style={{
          background: abierto ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.04)",
          borderBottom: abierto ? "1px solid rgba(255, 255, 255, 0.08)" : "none",
        }}
      >
        {controls && (
          <span
            {...source}
            title="Arrastra para reordenar esta sección"
            className="no-print flex items-center cursor-grab active:cursor-grabbing text-white/40 hover:text-white transition-colors"
            style={{ touchAction: "none" }}
          >
            <GripVertical size={16} />
          </span>
        )}
        <button
          onClick={controls ? onToggle : undefined}
          className="flex-1 flex items-center gap-2 text-left bg-transparent border-0 text-white cursor-pointer p-0"
        >
          {controls && (
            <span className="no-print text-white/60">
              {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span className="cond uppercase font-bold text-base tracking-wider text-white/95">{titulo}</span>
        </button>
        {controls && (
          <div className="no-print flex items-center gap-1 text-white/60">
            <button
              onClick={onUp}
              disabled={!canUp}
              aria-label="Subir sección"
              className="p-1 hover:text-white disabled:opacity-20 transition-colors"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onDown}
              disabled={!canDown}
              aria-label="Bajar sección"
              className="p-1 hover:text-white disabled:opacity-20 transition-colors"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        )}
      </div>
      {abierto && <div className="p-4">{children}</div>}
    </div>
  );
}

const ANCHO_HOJA = 1240;

export function Infografia({ cfg, setCfg }) {
  const hueco = useRef(null);
  const puesto = useRef("");

  useLayoutEffect(() => {
    const el = hueco.current;
    if (!el) return;
    const ajustar = () => {
      const hay = el.clientWidth;
      if (!hay) return;
      const factor = Math.min(1, hay / ANCHO_HOJA).toFixed(3);
      if (factor === puesto.current) return;
      puesto.current = factor;
      el.style.setProperty("--encaje", factor);
    };
    ajustar();
    const ojo = new ResizeObserver(ajustar);
    ojo.observe(el);
    return () => ojo.disconnect();
  }, []);

  const brandColor = cfg.branding?.primaryColor || NAVY;
  const fuentes = useMemo(() => computeFuentes(cfg), [cfg]);
  const byId = useMemo(() => Object.fromEntries(fuentes.map((f) => [f.id, f])), [fuentes]);
  const rows = useMemo(() => computeRows(cfg), [cfg]);
  const total = rows.length ? rows[rows.length - 1].tout : 0;
  const bloques = useMemo(() => computeBloques(rows, byId), [rows, byId]);
  const cams = fuentes.filter((f) => f.tipo === "cam");

  const orden = useMemo(
    () => normSecciones(cfg.secciones).filter((s) => !SECCIONES_DEPRECADAS.includes(s.id)),
    [cfg.secciones]
  );
  const editable = typeof setCfg === "function";
  const setSecciones = (next) => {
    if (editable) setCfg((c) => ({ ...c, secciones: next }));
  };
  const moveSec = (from, to) => {
    if (from < 0 || to < 0 || from >= orden.length || to >= orden.length) return;
    setSecciones(reorder(orden, from, to));
  };
  const toggleSec = (id) =>
    setSecciones(orden.map((s) => (s.id === id ? { ...s, abierto: !s.abierto } : s)));
  const { dragIdx, overIdx, source, target } = useReorder(moveSec);

  const contenido = {
    estudio: <Estudio cfg={cfg} fuentes={fuentes} setCfg={setCfg} />,
    escaleta: <Escaleta rows={rows} byId={byId} total={total} />,
    personal: <PersonalGrid cfg={cfg} cams={cams} />,
    timeline: <Timeline rows={rows} byId={byId} total={total} bloques={bloques} />,
  };

  const labelDe = (id) => {
    const base = SECCIONES_INFO.find((s) => s.id === id)?.label || id;
    if (id === "escaleta") return `Escaleta / Rundown — ${fmt(total)}`;
    if (id === "timeline") return `Línea de tiempo — ${fmt(total)}`;
    if (id === "personal") return `Personal de operación (${cfg.personal.length}${cfg.includeCamOps ? ` + ${cams.length} cám.` : ""})`;
    return base;
  };

  return (
    <div ref={hueco} className="infografia-hueco">
      <div
        className="infografia-sheet hoja-tema lienzo-tema shadow-2xl mx-auto rounded-2xl border border-white/10 p-6"
        style={{
          width: ANCHO_HOJA,
          background: "var(--hoja, #0e1522)",
          color: "var(--hoja-tinta, #e2e8f0)",
          "--hoja-sello": brandColor,
        }}
      >
        {/* Encabezado Editorial Apple */}
        <div className="flex items-stretch gap-4 mb-4 pb-4 border-b border-white/10">
          <div className="cond flex items-center justify-center text-center rounded-xl border border-white/15 bg-white/[0.04] font-bold uppercase w-44 p-2">
            {cfg.branding?.logoDataUrl ? (
              <img src={cfg.branding.logoDataUrl} alt={cfg.organizacion} style={{ maxWidth: "100%", maxHeight: 58, objectFit: "contain" }} />
            ) : (
              <span className="text-base tracking-wider text-white/90">{cfg.organizacion}</span>
            )}
          </div>
          <div className="flex-1 text-center flex flex-col justify-center">
            <h1 className="cond font-bold uppercase text-3xl tracking-wider text-white m-0">
              {cfg.titulo}
            </h1>
            <p className="font-medium text-sm text-white/60 mt-1 m-0">
              {cfg.subtitulo}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] w-44 p-2">
            <span className="cond uppercase font-bold text-xs text-white/50 tracking-wider">Duración</span>
            <span className="cond font-bold text-2xl text-white leading-none mt-1">{fmt(total)}</span>
            <span className="text-[10px] text-white/40 mt-1">{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {editable && (
          <p className="no-print flex items-center gap-1.5 text-xs text-white/50 mb-3">
            <GripVertical size={13} /> Arrastra el asa para reordenar las secciones o haz clic en el título para contraerlas.
          </p>
        )}

        <div className="flex flex-col gap-3.5">
          {orden.map((s, i) => (
            <SeccionPanel
              key={s.id}
              titulo={labelDe(s.id)}
              abierto={s.abierto}
              controls={editable}
              onToggle={() => toggleSec(s.id)}
              onUp={() => moveSec(i, i - 1)}
              onDown={() => moveSec(i, i + 1)}
              canUp={i > 0}
              canDown={i < orden.length - 1}
              source={source(i)}
              target={target(i)}
              dragging={dragIdx === i}
              over={overIdx === i}
            >
              {contenido[s.id]}
            </SeccionPanel>
          ))}
        </div>
      </div>
    </div>
  );
}

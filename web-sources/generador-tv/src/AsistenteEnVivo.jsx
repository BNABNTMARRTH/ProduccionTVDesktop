import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { TIPOS_PROGRAMA, escaletaEnVivoDe, construirEscaletaEnVivo } from "./envivo.js";
import { NAVY, INK } from "./theme.js";
import { inp, inpStyle, btn } from "./ui.jsx";
import { fmt } from "./util.js";

// Asistente de programa en vivo (modo live): arma una ESCALETA EDITORIAL por
// bloques — qué contenido ocurre y su función dentro del programa. Las señales
// al aire y los comandos técnicos se detallan después en el rundown técnico.
export function AsistenteEnVivo({ cfg, setCfg, onClose, onGenerado }) {
  const [paso, setPaso] = useState(0);
  const [confirma, setConfirma] = useState(false);
  const [p, setP] = useState(() => ({ tipoPrograma: "", durMin: 30, enVivo: true, nombre: "", ...(cfg.programa || {}) }));
  const up = (patch) => setP((x) => ({ ...x, ...patch }));
  const PASOS = ["Tipo", "Programa", "Generar"];
  const actual = PASOS[paso];
  const preview = useMemo(
    () => escaletaEnVivoDe(p.tipoPrograma || "noticiero", { durTotalSeg: Math.max(1, p.durMin || 30) * 60 }),
    [p.tipoPrograma, p.durMin],
  );
  const total = preview.reduce((n, s) => n + s.dur, 0);

  const generar = () => {
    if ((cfg.escaleta || []).length && !confirma) { setConfirma(true); return; }
    setCfg((c) => construirEscaletaEnVivo(c, p));
    onGenerado();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(9,20,35,.6)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ background: NAVY }}>
          <span className="text-lg">▤</span>
          <b className="text-white">Asistente de programa en vivo</b>
          <span className="flex-1" />
          {PASOS.map((s, i) => (
            <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={i === paso ? { background: "#FFD23F", color: "#15233D" } : { color: i < paso ? "#9DC1EC" : "#5B79A6" }}>{s}</span>
          ))}
          <button onClick={onClose} className="ml-1 text-white/70 hover:text-white" aria-label="Cerrar asistente"><X size={17} /></button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5" style={{ color: INK }}>
          {actual === "Tipo" && (<>
            <p className="m-0 text-sm font-bold">¿Qué tipo de programa vas a producir?</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {TIPOS_PROGRAMA.map((t) => (
                <button key={t.id} onClick={() => up({ tipoPrograma: t.id })} className="flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left"
                  style={p.tipoPrograma === t.id ? { borderColor: NAVY, background: "#EDF3FB", boxShadow: `0 0 0 1px ${NAVY}` } : { borderColor: "#C8D2DE" }}>
                  <span className="text-xl">{t.icono}</span>
                  <b className="text-sm">{t.nombre}</b>
                  <small className="text-slate-500">{t.detalle}</small>
                </button>
              ))}
            </div>
          </>)}

          {actual === "Programa" && (<>
            <p className="m-0 text-sm font-bold">Configuración del programa</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-bold uppercase" style={{ color: "#5F7189" }}>Nombre del programa
                <input className={inp} style={inpStyle} value={p.nombre || ""} placeholder="Noticiero universitario" onChange={(e) => up({ nombre: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold uppercase" style={{ color: "#5F7189" }}>Duración objetivo (min)
                <input type="number" min="1" max="180" className={inp} style={inpStyle} value={p.durMin} onChange={(e) => up({ durMin: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
            </div>
            <div className="flex gap-2">
              {[["En vivo", true], ["Grabado como en vivo", false]].map(([lab, val]) => (
                <button key={lab} onClick={() => up({ enVivo: val })} className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={p.enVivo === val ? { background: NAVY, color: "#fff", borderColor: NAVY } : { borderColor: "#C8D2DE", color: INK }}>{lab}</button>
              ))}
            </div>
            <p className="m-0 text-xs text-slate-500">Vista previa: {preview.length} segmentos en {new Set(preview.map((s) => s.bloque)).size} bloques · {fmt(total)}.</p>
          </>)}

          {actual === "Generar" && (<>
            <p className="m-0 text-sm font-bold">Así quedará tu escaleta editorial: contenido, orden y duración por bloques. La señal al aire y los comandos técnicos van después en el rundown.</p>
            <div className="flex flex-col gap-1.5">
              {preview.map((s, i) => (
                <div key={i} className="grid items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ gridTemplateColumns: "auto auto 1fr auto", borderColor: "#C8D2DE" }}>
                  <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: s.esCorte ? "#F07F13" : NAVY }}>B{s.bloque}</span>
                  <span className="text-xs font-bold text-slate-500">{i + 1}</span>
                  <span><b>{s.segmento}</b> <small className="text-slate-500">— {s.objetivo}</small></span>
                  <small className="text-slate-500">{fmt(s.dur)}</small>
                </div>
              ))}
            </div>
            {confirma && (
              <p className="m-0 rounded-lg border px-3 py-2 text-sm font-bold" style={{ borderColor: "#E8B4B4", background: "#FDF2F2", color: "#B4232A" }}>
                Ya existe una escaleta con {(cfg.escaleta || []).length} segmentos: se reemplazará por estos {preview.length}. ¿Continuar?
              </p>
            )}
          </>)}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "#E2E8F0" }}>
          <button onClick={() => { setConfirma(false); setPaso((x) => Math.max(0, x - 1)); }} disabled={paso === 0}
            className={`${btn} border disabled:opacity-40`} style={{ borderColor: "#C8D2DE", color: INK }}>← Atrás</button>
          <span className="flex-1" />
          {actual !== "Generar"
            ? <button onClick={() => setPaso((x) => Math.min(PASOS.length - 1, x + 1))} disabled={actual === "Tipo" && !p.tipoPrograma} className={`${btn} text-white disabled:opacity-40`} style={{ background: NAVY }}>Siguiente →</button>
            : <button onClick={generar} className={`${btn} text-white`} style={{ background: confirma ? "#B4232A" : "#1FA14E" }}>
                {confirma ? "Sí, reemplazar y generar" : "▤ Generar escaleta editorial"}
              </button>}
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { AlertTriangle, Check, Info } from "lucide-react";
import { analizarEscaleta } from "./escaleta.js";
import { INK, NAVY } from "./theme.js";
import { fmt } from "./util.js";

function Metric({ label, value }) {
  return (
    <div className="rounded-lg" style={{ background: "#EEF2F7", padding: "8px 10px" }}>
      <div className="text-xs font-semibold uppercase" style={{ color: "#64748B" }}>{label}</div>
      <div className="cond font-bold" style={{ fontSize: 22, color: NAVY }}>{value}</div>
    </div>
  );
}

export function AnalisisTiempos({ cfg }) {
  const a = analizarEscaleta(cfg);
  const estilo = (t) =>
    t === "error" ? { bg: "#FDECEC", fg: "#A12A2A", bd: "#F3C0C0", Ic: AlertTriangle }
    : t === "warn" ? { bg: "#FEF6E6", fg: "#8A5A00", bd: "#F3DCA6", Ic: AlertTriangle }
    : { bg: "#EAF2FB", fg: "#1C4E86", bd: "#C5DBF3", Ic: Info };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Duración total" value={fmt(a.total)} />
        <Metric label="Contenido neto" value={fmt(a.durContenido)} />
        <Metric label={`Cortes (${a.nCortes})`} value={fmt(a.durCortes)} />
        <Metric label="Segmentos" value={String(a.segCount)} />
      </div>
      <p className="text-sm" style={{ color: INK }}>
        Esta escaleta suma <b>{fmt(a.total)}</b>
        {a.nCortes > 0
          ? <>, con {a.nCortes} corte{a.nCortes > 1 ? "s" : ""} ({fmt(a.durCortes)}). Programa neto de contenido: <b>{fmt(a.durContenido)}</b>.</>
          : "."}
      </p>
      {a.avisos.length === 0 ? (
        <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#1A7A4A" }}>
          <Check size={16} /> Sin avisos: los tiempos se ven equilibrados.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {a.avisos.map((av, i) => {
            const e = estilo(av.tipo);
            return (
              <div key={i} className="flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-sm"
                style={{ background: e.bg, color: e.fg, borderColor: e.bd }}>
                <e.Ic size={15} style={{ marginTop: 1, flexShrink: 0 }} /> <span>{av.msg}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

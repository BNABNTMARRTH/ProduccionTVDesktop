import React from "react";
import { fmt } from "./util.js";
import { NAVY } from "./theme.js";
import { objetivoDe } from "./proyecto.js";

// DURACIÓN OBJETIVO del proyecto: cuánto DEBE durar, contra lo que llevas.
//
// En vivo la duración no se negocia (la señal entra y sale a una hora fija) y en
// narrativo casi siempre hay un tope: la canción del videoclip, el minutaje de
// la tarea, el corte del festival. Sin este dato el asistente no puede avisar
// que te estás pasando, que era justo la sugerencia más útil.
//
// Se guarda en minutos, en `cfg.duracionObjetivoMin`. Vacío = sin objetivo.

export function MetaDuracion({ cfg, setCfg, total, editable }) {
  const objetivoMin = objetivoDe(cfg);
  const objetivo = objetivoMin * 60;
  const dif = total - objetivo;
  const cerca = Math.abs(dif) < 30;

  const estado = !objetivo
    ? { texto: "Sin objetivo definido", color: "#8A97A8", fondo: "#F1F5F9" }
    : cerca
      ? { texto: "En tiempo", color: "#1B7A44", fondo: "#E2F3E8" }
      : dif > 0
        ? { texto: `Te pasas ${fmt(dif)}`, color: "#B03030", fondo: "#FDE8E8" }
        : { texto: `Faltan ${fmt(-dif)}`, color: "#8A5A00", fondo: "#FEF6E6" };

  const avance = objetivo ? Math.min(1, total / objetivo) : 0;

  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
      style={{ borderColor: "#DDE4EC", background: "#F8FAFC" }}>
      <span className="text-xs font-bold uppercase" style={{ color: "#8A97A8", letterSpacing: 1 }}>
        Duración objetivo
      </span>

      {editable ? (
        <span className="flex items-center gap-1.5">
          <input
            type="number" min="0" step="1" value={objetivoMin || ""} placeholder="—"
            onChange={(e) => {
              const n = Math.max(0, Math.round(Number(e.target.value) || 0));
              setCfg((c) => ({ ...c, duracionObjetivoMin: n }), { commit: true });
            }}
            className="rounded-md border text-sm font-bold"
            style={{ width: 68, padding: "5px 8px", borderColor: "#C8D2DE", color: NAVY, textAlign: "right" }}
            title="Cuánto debe durar el proyecto terminado. Déjalo vacío si todavía no lo sabes." />
          <span className="text-xs font-bold" style={{ color: "#5B6B82" }}>min</span>
        </span>
      ) : (
        <span className="text-sm font-bold" style={{ color: NAVY }}>{objetivoMin ? `${objetivoMin} min` : "—"}</span>
      )}

      <span className="text-xs" style={{ color: "#5B6B82" }}>
        Llevas <b style={{ color: NAVY }}>{fmt(total)}</b>
        {objetivo ? <> de <b style={{ color: NAVY }}>{fmt(objetivo)}</b></> : null}
      </span>

      {objetivo > 0 && (
        <span className="rounded-full" style={{ flex: "1 1 120px", minWidth: 90, height: 6, background: "#E2E8F0", overflow: "hidden" }}>
          <span style={{
            display: "block", height: "100%", width: `${avance * 100}%`,
            background: estado.color, transition: "width .2s ease",
          }} />
        </span>
      )}

      <span className="rounded-full px-2 py-0.5 text-xs font-bold"
        style={{ background: estado.fondo, color: estado.color }}>
        {estado.texto}
      </span>
    </div>
  );
}

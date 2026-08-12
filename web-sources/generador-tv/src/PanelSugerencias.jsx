import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { revisar } from "./sugerencias.js";
import { INK, NAVY } from "./theme.js";

// Panel flotante de SUGERENCIAS. Aparece solo cuando el usuario pulsa el botón
// (decisión de 2026-08-11: nada de avisos saltando solos mientras escribe) y
// nunca toca el proyecto: observa y explica el porqué, la decisión es del autor.
export function PanelSugerencias({ cfg, onClose }) {
  const avisos = useMemo(() => revisar(cfg), [cfg]);
  const [abierto, setAbierto] = useState(null); // id del "¿por qué?" desplegado

  return (
    <div className="no-print fixed z-40 flex flex-col rounded-2xl border shadow-2xl"
      style={{
        right: 18, bottom: 18, width: "min(380px, calc(100vw - 36px))", maxHeight: "min(70vh, 560px)",
        borderColor: "#2F5C91", background: "linear-gradient(150deg,#15304F,#0C1D31)", color: "#E8EEF8",
      }}>
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <span className="grid place-items-center rounded-lg" style={{ width: 26, height: 26, background: "rgba(88,168,255,.18)", fontSize: 14 }}>💡</span>
        <b className="text-sm">Sugerencias</b>
        <span className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: avisos.length ? "rgba(224,49,47,.18)" : "rgba(31,161,78,.18)", color: avisos.length ? "#FF9E9C" : "#8DF0B4" }}>
          {avisos.length}
        </span>
        <button onClick={onClose} title="Cerrar" className="ml-auto rounded-md p-1"
          style={{ color: "#9FB6D4", background: "transparent", border: "none", cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5 overflow-y-auto px-4 pb-3">
        {avisos.length === 0 ? (
          <p className="m-0 text-xs" style={{ color: "#A9BCD5", lineHeight: 1.6 }}>
            No veo nada que señalar por ahora. Reviso el <b>ritmo de tus planos</b>: que un plano cerrado
            no dure más que uno abierto. Escribe los planos y sus duraciones y vuelve a preguntarme.
          </p>
        ) : avisos.map((a) => (
          <div key={a.id} className="rounded-xl border p-3" style={{ borderColor: "#2A415F", background: "rgba(10,21,36,.55)" }}>
            <b className="text-xs" style={{ color: "#FFD9A8" }}>{a.titulo}</b>
            <p className="mb-2 mt-1.5 text-xs" style={{ color: "#C3D2E6", lineHeight: 1.55 }}>{a.mensaje}</p>
            <button onClick={() => setAbierto(abierto === a.id ? null : a.id)}
              className="rounded-md px-2 py-1 text-xs font-bold"
              style={{ border: "1px solid #31547B", background: "transparent", color: "#8FC2FF", cursor: "pointer" }}>
              {abierto === a.id ? "Ocultar el porqué" : "¿Por qué?"}
            </button>
            {abierto === a.id && (
              <p className="m-0 mt-2 rounded-lg p-2.5 text-xs"
                style={{ background: "rgba(88,168,255,.10)", color: "#A9BCD5", lineHeight: 1.6 }}>
                {a.porque}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="m-0 px-4 pb-3.5 pt-1 text-xs" style={{ color: "#7D93B3", borderTop: "1px solid #22364F", paddingTop: 10 }}>
        Nada de esto cambia tu proyecto. Tú decides qué aplicar.
      </p>
    </div>
  );
}

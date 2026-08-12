import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { revisar, NIVELES } from "./sugerencias.js";

// Panel flotante de SUGERENCIAS. Aparece solo cuando el usuario pulsa el botón
// 💡 y nunca toca el proyecto: dice qué problema ve, por qué y qué hacer. La
// decisión es del autor — recomendar sin bloquear.
const COLOR = {
  error: { fondo: "rgba(224,49,47,.16)", texto: "#FF9E9C", borde: "rgba(224,49,47,.45)" },
  precaucion: { fondo: "rgba(226,163,58,.16)", texto: "#F0C86B", borde: "rgba(226,163,58,.42)" },
  recomendacion: { fondo: "rgba(88,168,255,.14)", texto: "#8FC2FF", borde: "rgba(88,168,255,.40)" },
};

export function PanelSugerencias({ cfg, setCfg, onClose }) {
  const todos = useMemo(() => revisar(cfg), [cfg]);
  const [ignorados, setIgnorados] = useState(() => new Set());
  const [abierto, setAbierto] = useState(null);
  const [hecho, setHecho] = useState(null); // último arreglo aplicado
  const editable = typeof setCfg === "function";

  // Corregir es MECÁNICO y deshacible: el arreglo entra al historial del
  // generador, así que ⌘Z lo revierte como cualquier otra edición.
  const corregir = (a) => {
    setCfg(a.arreglo.aplicar, { commit: true });
    setHecho(a.arreglo.etiqueta);
    setTimeout(() => setHecho(null), 4000);
  };
  const avisos = todos.filter((a) => !ignorados.has(a.id));

  const cuenta = ["error", "precaucion", "recomendacion"]
    .map((n) => ({ n, total: avisos.filter((a) => a.nivel === n).length }))
    .filter((c) => c.total);

  return (
    <div className="no-print fixed z-40 flex flex-col rounded-2xl border shadow-2xl"
      style={{
        right: 18, bottom: 18, width: "min(400px, calc(100vw - 36px))", maxHeight: "min(72vh, 620px)",
        borderColor: "#2F5C91", background: "linear-gradient(150deg,#15304F,#0C1D31)", color: "#E8EEF8",
      }}>
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <span className="grid place-items-center rounded-lg" style={{ width: 26, height: 26, background: "rgba(88,168,255,.18)", fontSize: 14 }}>💡</span>
        <b className="text-sm">Sugerencias</b>
        <button onClick={onClose} title="Cerrar" className="ml-auto rounded-md p-1"
          style={{ color: "#9FB6D4", background: "transparent", border: "none", cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      {cuenta.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2.5">
          {cuenta.map(({ n, total }) => (
            <span key={n} className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: COLOR[n].fondo, color: COLOR[n].texto }}>
              {total} {NIVELES[n].etiqueta.toLowerCase()}{total === 1 ? "" : n === "error" ? "es" : "s"}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5 overflow-y-auto px-4 pb-3">
        {avisos.length === 0 ? (
          <p className="m-0 text-xs" style={{ color: "#A9BCD5", lineHeight: 1.65 }}>
            {todos.length
              ? "Ignoraste todo lo que había. Cierra y vuelve a abrir el panel para verlo de nuevo."
              : <>No veo nada que señalar en lo que llevas. Reviso el <b>ritmo y variedad de tus planos</b>, el <b>audio</b>, la <b>duración contra el objetivo</b>, el <b>equipo</b> y los <b>retornos de video</b>. Sigue escribiendo y vuelve a preguntarme.</>}
          </p>
        ) : avisos.map((a) => (
          <div key={a.id} className="rounded-xl border p-3"
            style={{ borderColor: COLOR[a.nivel].borde, background: "rgba(10,21,36,.55)" }}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5" style={{ background: COLOR[a.nivel].fondo, color: COLOR[a.nivel].texto, fontSize: 9.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase" }}>
                {NIVELES[a.nivel].etiqueta}
              </span>
              <b className="text-xs" style={{ color: "#FFFFFF" }}>{a.problema}</b>
            </div>
            <p className="m-0 text-xs" style={{ color: "#A9BCD5", lineHeight: 1.55 }}>{a.motivo}</p>
            <p className="mb-2 mt-2 rounded-lg px-2.5 py-2 text-xs" style={{ background: "rgba(31,161,78,.12)", color: "#C7E8D3", lineHeight: 1.55 }}>
              <b style={{ color: "#8DF0B4" }}>Qué hacer: </b>{a.accion}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {a.arreglo && editable && (
                <button onClick={() => corregir(a)}
                  className="rounded-md px-2 py-1 text-xs font-bold"
                  title="Hace el cambio por ti. Puedes deshacerlo con ⌘Z."
                  style={{ border: "none", background: "#1FA14E", color: "#fff", cursor: "pointer" }}>
                  ✓ {a.arreglo.etiqueta}
                </button>
              )}
              <button onClick={() => setAbierto(abierto === a.id ? null : a.id)}
                className="rounded-md px-2 py-1 text-xs font-bold"
                style={{ border: "1px solid #31547B", background: "transparent", color: "#8FC2FF", cursor: "pointer" }}>
                {abierto === a.id ? "Ocultar" : "Explícame por qué"}
              </button>
              <button onClick={() => setIgnorados((s) => new Set([...s, a.id]))}
                className="rounded-md px-2 py-1 text-xs font-bold"
                style={{ border: "1px solid #2A415F", background: "transparent", color: "#7D93B3", cursor: "pointer" }}>
                Ignorar por ahora
              </button>
            </div>
            {abierto === a.id && (
              <p className="m-0 mt-2 rounded-lg p-2.5 text-xs"
                style={{ background: "rgba(88,168,255,.10)", color: "#A9BCD5", lineHeight: 1.6 }}>
                {a.porque}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="m-0 px-4 pb-3.5 text-xs" style={{ color: "#7D93B3", borderTop: "1px solid #22364F", paddingTop: 10 }}>
        {hecho
          ? <span style={{ color: "#8DF0B4", fontWeight: 700 }}>Listo: {hecho.toLowerCase()}. Si no era lo que querías, deshaz con ⌘Z.</span>
          : "Son ayudas, no reglas. Si rompes una a propósito, la app te deja."}
      </p>
    </div>
  );
}

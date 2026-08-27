// LA GUÍA — una sola puerta a las dos preguntas que un alumno se hace mirando
// su proyecto: "¿cómo se hace esto?" y "¿qué me falta?".
//
// Antes eran dos botones: 📖 Cómo se hace y 💡 Sugerencias. Es la misma
// pregunta partida en dos, y obligaba a adivinar cuál de los dos abrir. Ahora
// es un botón, un panel y dos pestañas: la receta del tipo de pieza que estás
// haciendo, y la revisión de la tuya.
import React, { useEffect } from "react";
import { X } from "lucide-react";
import { PanelFicha } from "./PanelFicha.jsx";
import { PanelSugerencias } from "./PanelSugerencias.jsx";
import { revisar } from "./sugerencias.js";

export function PanelGuia({ cfg, setCfg, pestana, setPestana, onClose }) {
  // Cuántas cosas encontró la revisión: va en la pestaña, para que se vea que
  // hay algo que atender sin tener que entrar a mirar.
  let pendientes = 0;
  try { pendientes = (revisar(cfg) || []).length; } catch { pendientes = 0; }

  const tab = (id, texto, cuenta) => (
    <button type="button" onClick={() => setPestana(id)} aria-pressed={pestana === id}
      className="b b-chip" style={{ flex: 1, justifyContent: "center" }}>
      {texto}{cuenta ? ` · ${cuenta}` : ""}
    </button>
  );

  // Esc cierra. Es lo que espera cualquiera que abre una ventana encima.
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  // AL CENTRO, no en la esquina. Estaba anclada abajo a la derecha y quedaba
  // lejos de donde se está mirando. El velo es tenue a propósito: la guía se
  // consulta MIENTRAS trabajas, no te secuestra la pantalla; se ve lo que hay
  // detrás y un clic afuera la cierra.
  return (
    <div className="no-print fixed inset-0 z-40 grid place-items-center guia-velo"
      onClick={onClose} role="dialog" aria-modal="false" aria-label="Guía">
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col vidrio"
      style={{ width: "min(560px, calc(100vw - 48px))", maxHeight: "min(76vh, 680px)" }}>
      <div className="flex items-center gap-2" style={{ padding: "14px 16px 10px" }}>
        <b className="cond" style={{ fontSize: 19, letterSpacing: ".06em", textTransform: "uppercase" }}>Guía</b>
        <button onClick={onClose} title="Cerrar" aria-label="Cerrar la guía"
          className="b b-3 b-ic" style={{ marginLeft: "auto" }}><X size={16} /></button>
      </div>
      <div className="flex gap-1.5" style={{ padding: "0 16px 12px" }}>
        {tab("ficha", "Cómo se hace")}
        {tab("sugerencias", "Qué te falta", pendientes)}
      </div>
      <div className="flex flex-col min-h-0 flex-1" style={{ borderTop: "1px solid var(--linea)" }}>
        {pestana === "ficha"
          ? <PanelFicha cfg={cfg} setCfg={setCfg} onClose={onClose} embebido />
          : <PanelSugerencias cfg={cfg} setCfg={setCfg} onClose={onClose} embebido />}
      </div>
    </div>
    </div>
  );
}

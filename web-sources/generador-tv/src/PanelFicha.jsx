import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { fichasDe } from "./fichas.js";

// Panel CÓMO SE HACE. Hermano del de Sugerencias, pero al revés: aquel mira
// TUS datos y señala problemas; este trae el saber general de cómo se hace el
// tipo de pieza que estás haciendo (guion, videoclip, spot, TikTok…).
//
// No hay buscador ni catálogo: la ficha se elige sola a partir de lo que el
// proyecto ya declara — su tipo y los medios del perfil. Si hay más de una
// (por ejemplo un spot que se publica en TikTok), aparecen como pestañas.
//
// Lo único que escribe en el proyecto es el checklist: las casillas que marcas
// se guardan en cfg.revisado, para que al volver sepas por dónde ibas.

const AZUL = "var(--e1-t)";

export function PanelFicha({ cfg, setCfg, onClose, embebido = false }) {
  const fichas = useMemo(() => fichasDe(cfg), [cfg]);
  const [activa, setActiva] = useState(0);
  const f = fichas[Math.min(activa, fichas.length - 1)];
  const editable = typeof setCfg === "function";
  const marcados = cfg?.revisado || {};

  if (!f) return null;

  const alternar = (i) => {
    if (!editable) return;
    const clave = `${f.id}:${i}`;
    setCfg((c) => ({ ...c, revisado: { ...(c.revisado || {}), [clave]: !(c.revisado || {})[clave] } }),
      { commit: true });
  };

  const Bloque = ({ titulo, children }) => (
    <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--vidrio-a)", border: "1px solid var(--linea)" }}>
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: AZUL }}>{titulo}</div>
      {children}
    </div>
  );

  const listaNumerada = (items) => (
    <ol className="m-0 list-decimal pl-4 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta)" }}>
      {items.map((t, i) => <li key={i} className="my-1">{t}</li>)}
    </ol>
  );

  return (
    <div className={embebido ? "flex flex-col min-h-0 flex-1" : "no-print fixed z-40 flex flex-col rounded-2xl border shadow-2xl"}
      style={embebido ? undefined : {
        right: 18, bottom: 18, width: "min(400px, calc(100vw - 36px))", maxHeight: "min(72vh, 620px)",
        borderColor: "#2F5C91", background: "linear-gradient(150deg,#15304F,#0C1D31)", color: "var(--tinta)",
      }}>
      {!embebido && (
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <span className="grid place-items-center rounded-lg" style={{ width: 26, height: 26, background: "color-mix(in srgb, var(--e1) 16%, var(--yeso))", fontSize: 14 }}>📖</span>
        <b className="text-sm">Cómo se hace</b>
        <button onClick={onClose} title="Cerrar" className="ml-auto rounded-md p-1"
          style={{ color: "var(--tinta-baja)", background: "transparent", border: "none", cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>
      )}

      {fichas.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {fichas.map((x, i) => (
            <button key={x.id} onClick={() => setActiva(i)}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={i === activa
                ? { background: "var(--e1-f)", color: "#fff", border: "1px solid var(--e1-f)" }
                : { background: "transparent", color: "var(--tinta-baja)", border: "1px solid var(--linea)", cursor: "pointer" }}>
              {x.titulo}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "thin" }}>
        <Bloque titulo="Por dónde empezar">
          <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta)" }}>{f.empezar}</p>
        </Bloque>

        <Bloque titulo="Paso a paso">{listaNumerada(f.pasos)}</Bloque>
        <Bloque titulo="Cómo se arma">{listaNumerada(f.estructura)}</Bloque>

        <Bloque titulo="Cuánto dura">
          <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta)" }}>{f.duracion}</p>
        </Bloque>

        <Bloque titulo="Errores que se repiten">
          <ul className="m-0 list-disc pl-4 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta)" }}>
            {f.errores.map((t, i) => <li key={i} className="my-1">{t}</li>)}
          </ul>
        </Bloque>

        <Bloque titulo="Revisa tu borrador">
          <div className="flex flex-col gap-1.5">
            {f.revisa.map((t, i) => {
              const listo = !!marcados[`${f.id}:${i}`];
              return (
                <label key={i} className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-relaxed"
                  style={{ color: listo ? "var(--e2-t)" : "var(--tinta)", cursor: editable ? "pointer" : "default" }}>
                  <input type="checkbox" checked={listo} onChange={() => alternar(i)} disabled={!editable}
                    style={{ marginTop: 3, accentColor: "#1FA14E", width: 13, height: 13 }} />
                  <span style={{ textDecoration: listo ? "line-through" : "none", opacity: listo ? 0.75 : 1 }}>{t}</span>
                </label>
              );
            })}
          </div>
        </Bloque>

        <p className="m-0 pt-0.5 text-[10.5px] leading-relaxed" style={{ color: "var(--tinta-baja)" }}>
          De la investigación reunida en el cuaderno «{f.fuente}».
        </p>
      </div>
    </div>
  );
}

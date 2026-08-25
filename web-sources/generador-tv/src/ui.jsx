// Piezas de interfaz compartidas por varias pantallas: los estilos base (caja
// de texto, botón), los títulos de sección, la caja con encabezado y la tarjeta
// de ayuda "?". Viven aparte para que los componentes separados a otros
// archivos usen las mismas piezas sin duplicarlas.
import React, { useState } from "react";
import { INK, NAVY, PALETTE } from "./theme.js";

export const inp = "w-full rounded-md border px-2 py-1.5 text-sm";
export const inpStyle = { borderColor: "#C8D2DE", color: INK };
export const btn = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold";

// Título de sección dentro de los paneles (pestaña Set y similares).
export const SecTitle = ({ children }) => (
  <div className="text-xs font-bold uppercase" style={{ color: "#8A97A8", letterSpacing: 1 }}>{children}</div>
);

export function Box({ title, children, style }) {
  return (
    <div className="rounded-xl border-2 bg-white" style={{ borderColor: NAVY, ...style }}>
      <div className="cond text-center text-white font-bold uppercase"
        style={{ background: NAVY, borderRadius: "10px 10px 0 0", padding: "4px 10px", fontSize: 16, letterSpacing: 1 }}>
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Ayuda contextual: botón "?" con una tarjeta que se auto-muestra la primera
// vez (recordada en localStorage por id) y se puede reabrir. Mismo patrón que
// el "Cómo armar tu ruta de señal" del diagrama. Los pasos son HTML estático
// propio (admite <b>), no entrada del usuario.
export function TarjetaAyuda({ id, titulo, pasos }) {
  const key = `ptv:ayuda-${id}`;
  const [abierta, setAbierta] = useState(() => {
    try { return !localStorage.getItem(key); } catch { return false; }
  });
  const cerrar = () => { setAbierta(false); try { localStorage.setItem(key, "1"); } catch {} };
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} title="¿Cómo funciona esta pestaña?"
        className="no-print grid h-7 w-7 place-items-center rounded-full border text-sm font-bold"
        style={{ borderColor: "#C8D2DE", color: NAVY, background: "#fff" }}>?</button>
      {abierta && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center" style={{ background: "rgba(6,14,28,.45)" }} onClick={cerrar}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl text-white shadow-2xl"
            style={{ width: "min(92vw,460px)", background: "#0E1D33", border: "1px solid #2c4a78", padding: "20px 22px" }}>
            <h3 className="cond m-0 mb-3 text-xl font-bold uppercase" style={{ letterSpacing: 0.5 }}>{titulo}</h3>
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-sm" style={{ color: "#c8d6ea", lineHeight: 1.5 }}>
              {pasos.map((p, i) => <li key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
            </ol>
            <button type="button" onClick={cerrar} className="mt-4 w-full rounded-lg font-bold text-white" style={{ background: "#1D6FD1", padding: 10 }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}

// Tarjeta plegable con encabezado (paneles del editor).
export function Card({ title, children, open = true, className = "" }) {
  return (
    <details open={open} className={`rounded-xl border bg-white overflow-hidden h-fit ${className}`} style={{ borderColor: "#C8D2DE" }}>
      <summary className="cond cursor-pointer select-none font-bold uppercase text-white"
        style={{ background: NAVY, padding: "7px 12px", fontSize: 15, letterSpacing: 1, listStyle: "none" }}>{title}</summary>
      <div className="p-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}


// Paleta de colores en botoncitos redondos (color de cámara/fuente).
export function Swatches({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PALETTE.map((c) => (
        <button key={c} onClick={() => onChange(c)} aria-label={c}
          className="rounded-full" style={{
            width: 18, height: 18, background: c,
            outline: value === c ? `2px solid ${INK}` : "1px solid rgba(0,0,0,.15)", outlineOffset: 2,
          }} />
      ))}
    </div>
  );
}

// Grupo de opciones que se encienden y apagan (varias a la vez). Se usa en el
// perfil del proyecto: intención y medios del receptor. Es más rápido y menos
// intimidante que escribir, y deja los datos comparables entre proyectos.
export function Chips({ titulo, ayuda, opciones, valor = [], onChange }) {
  const activo = (o) => valor.includes(o);
  const alternar = (o) => onChange(activo(o) ? valor.filter((v) => v !== o) : [...valor, o]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-bold uppercase text-slate-500">{titulo}</div>
      {ayuda && <p className="m-0 text-xs text-slate-500" style={{ marginTop: -4 }}>{ayuda}</p>}
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button key={o} type="button" onClick={() => alternar(o)} aria-pressed={activo(o)}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={activo(o)
              ? { background: NAVY, color: "#fff", border: "1px solid " + NAVY }
              : { background: "#fff", color: INK, border: "1px solid #C8D2DE" }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

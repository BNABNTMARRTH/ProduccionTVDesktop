// Piezas de interfaz compartidas por varias pantallas. Aquí viven el botón, el
// campo, la tarjeta y la sección: los cuatro ladrillos con los que está hecho
// todo lo demás. Están en un solo sitio para que un cambio de acabado llegue a
// las 91 pantallas de golpe y no haya que perseguirlo caja por caja.
//
// El acabado (colores, estados, escala fluida) NO vive aquí sino en index.css,
// como CSS de verdad. Es a propósito: un `:hover` o un `:active` no se pueden
// escribir con `style={{…}}` en línea, y eso era justo lo que le faltaba a la
// app — 91 botones sin un solo estado de "presionado".
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { INK, NAVY, PALETTE } from "./theme.js";

// ── Compatibilidad ────────────────────────────────────────────────────────
// Las pantallas viejas piden `btn`, `inp` e `inpStyle`. Se conservan, pero
// ahora apuntan a las clases nuevas: así heredan los estados sin tocar los
// cientos de sitios donde se usan.
export const inp = "campo-caja";
export const inpStyle = {};
export const btn = "b b-2";

// ── Botón ─────────────────────────────────────────────────────────────────
// `rango` dice qué tan fuerte se ve, y por lo tanto qué tan importante es:
//   1 = la acción principal (una sola por tarjeta)
//   2 = lo habitual
//   3 = accesorio, apenas un texto con zona de clic
//   x = borra algo (se pone rojo al acercarse, no antes)
// Un botón de solo icono SIEMPRE lleva `titulo`: es su nombre para quien no
// reconoce el dibujo y para los lectores de pantalla.
export function Btn({ rango = 2, icono: Icono, titulo, hijos, children, className = "", ...resto }) {
  const soloIcono = !children && !hijos;
  const clases = ["b", `b-${rango}`, soloIcono ? "b-ic" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={clases} title={titulo}
      aria-label={soloIcono ? titulo : undefined} {...resto}>
      {Icono && <Icono size={soloIcono ? 17 : 15} aria-hidden="true" />}
      {children || hijos}
    </button>
  );
}

// ── Campo ─────────────────────────────────────────────────────────────────
// `ancho` es la medida NATURAL de lo que se escribe adentro: 'corto' para una
// edad, 'largo' para un nombre, 'texto' para un párrafo. Antes todos los
// campos eran `w-full` y una caja para "18 a 25 años" llegaba a medir 1073 px
// — de ahí venía buena parte de la sensación de pantalla vacía.
export function Campo({ etiqueta, ancho = "largo", pista, area, rows = 3, className = "", ...resto }) {
  const Caja = area ? "textarea" : "input";
  return (
    <label className={`campo ${className}`}>
      {etiqueta && <span className="campo-et">{etiqueta}</span>}
      <Caja className={`campo-caja a-${ancho}`} rows={area ? rows : undefined} {...resto} />
      {pista && <p className="campo-pista">{pista}</p>}
    </label>
  );
}

// Fila de campos que se reacomoda sola. El reacomodo ocurre AQUÍ, entre
// campos, y no entre tarjetas: con muchas columnas pequeñas, pasar de 6 a 7
// mueve el ancho un 14% en vez del 44% que movía antes.
export const Campos = ({ children, className = "" }) => (
  <div className={`rejilla-campos ${className}`}>{children}</div>
);

// ── Tarjeta y secciones ───────────────────────────────────────────────────
// Título de sección dentro de los paneles (pestaña Set y similares).
export const SecTitle = ({ children }) => <div className="seccion-tit">{children}</div>;

// Una división DENTRO de una tarjeta. Es lo que sustituye a "otra cajita":
// misma separación visual, sin gastar otro marco ni otra barra azul.
export function Seccion({ titulo, pista, children }) {
  return (
    <section className="seccion">
      {(titulo || pista) && (
        <div className="seccion-cab">
          {titulo && <h3 className="seccion-tit m-0">{titulo}</h3>}
          {pista && <p className="seccion-pista">{pista}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Box({ title, children, style }) {
  return (
    <div className="tarjeta" style={style}>
      <div className="tarjeta-cab cond" style={{ cursor: "default", justifyContent: "center" }}>{title}</div>
      <div className="tarjeta-cuerpo">{children}</div>
    </div>
  );
}

// Tarjeta plegable con encabezado. `ancho` la hace ocupar la fila completa:
// las tarjetas grandes ya no compiten por columnas, y así el reacomodo deja de
// dar el salto que partía la pantalla a la mitad.
export function Card({ title, children, open = true, className = "", ancho = false }) {
  return (
    <details open={open} className={`tarjeta ${ancho ? "ancho-total" : ""} ${className}`}>
      <summary className="tarjeta-cab cond">
        {title}
        <ChevronDown className="tarjeta-flecha" size={18} aria-hidden="true" />
      </summary>
      <div className="tarjeta-cuerpo">{children}</div>
    </details>
  );
}

// ── Ayuda contextual ──────────────────────────────────────────────────────
// Botón "?" con una tarjeta que se auto-muestra la primera vez (recordada en
// localStorage por id) y se puede reabrir. Los pasos son HTML estático propio
// (admite <b>), no entrada del usuario.
export function TarjetaAyuda({ id, titulo, pasos }) {
  const key = `ptv:ayuda-${id}`;
  const [abierta, setAbierta] = useState(() => {
    try { return !localStorage.getItem(key); } catch { return false; }
  });
  const cerrar = () => { setAbierta(false); try { localStorage.setItem(key, "1"); } catch {} };
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} title="¿Cómo funciona esta pestaña?"
        aria-label="¿Cómo funciona esta pestaña?"
        className="b b-2 b-ic no-print" style={{ borderRadius: "50%", color: NAVY, fontWeight: 800 }}>?</button>
      {abierta && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center" style={{ background: "rgba(6,14,28,.45)" }} onClick={cerrar}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl text-white shadow-2xl"
            style={{ width: "min(92vw,460px)", background: "#0E1D33", border: "1px solid #2c4a78", padding: "20px 22px" }}>
            <h3 className="cond m-0 mb-3 text-xl font-bold uppercase" style={{ letterSpacing: 0.5 }}>{titulo}</h3>
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-sm" style={{ color: "#c8d6ea", lineHeight: 1.5 }}>
              {pasos.map((p, i) => <li key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
            </ol>
            <button type="button" onClick={cerrar} className="b b-1 mt-4 w-full">Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Paleta de colores en botoncitos redondos (color de cámara/fuente) ─────
export function Swatches({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Color ${c}`}
          aria-pressed={value === c} title={`Color ${c}`}
          className="rounded-full" style={{
            width: 20, height: 20, background: c, cursor: "pointer",
            outline: value === c ? `2px solid ${INK}` : "1px solid rgba(0,0,0,.15)", outlineOffset: 2,
          }} />
      ))}
    </div>
  );
}

// ── Chips ─────────────────────────────────────────────────────────────────
// Grupo de opciones que se encienden y apagan (varias a la vez). Es más rápido
// y menos intimidante que escribir, y deja los datos comparables entre
// proyectos. `aria-pressed` no es solo para lectores de pantalla: es de donde
// el CSS saca si el chip va encendido o apagado.
export function Chips({ titulo, ayuda, opciones, valor = [], onChange }) {
  const activo = (o) => valor.includes(o);
  const alternar = (o) => onChange(activo(o) ? valor.filter((v) => v !== o) : [...valor, o]);
  return (
    <div className="campo">
      {titulo && <span className="campo-et">{titulo}</span>}
      {ayuda && <p className="campo-pista">{ayuda}</p>}
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button key={o} type="button" onClick={() => alternar(o)} aria-pressed={activo(o)}
            className="b b-chip">{o}</button>
        ))}
      </div>
    </div>
  );
}

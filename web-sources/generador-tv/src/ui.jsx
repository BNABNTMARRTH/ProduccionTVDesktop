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
import { INK, PALETTE } from "./theme.js";
import { FORMATOS, repartoCalculado } from "./proyecto.js";
import { OpenColorPickerCommand } from "./color_picker_bridge.js";

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
// `crece` marca la seccion que se queda con el alto sobrante cuando la ventana
// es mas alta que el contenido. Se pone en la que tiene campos de escribir: el
// espacio de mas ahi sirve para algo, repartido en margenes solo deja una caja
// blanca a medio llenar, que se ve peor que el fondo.
export function Seccion({ titulo, pista, crece = false, children }) {
  return (
    <section className={`seccion${crece ? " crece" : ""}`}>
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
// `gel` es el color de la gelatina clipeada al filo (rosa = acción y dónde
// estás, ámbar = revísalo, azul = dato técnico). `ancho` la hace ocupar la
// fila completa de la rejilla.
// Tarjeta plegable con encabezado Liquid Glass y animación fluida (Patrón Composite + State).
// Utiliza CSS Grid (grid-template-rows: 0fr -> 1fr) para colapsar suavemente a 60fps sin saltos.
// Si se provee `resumen` y la tarjeta está contraída, proyecta una píldora con datos clave.
export function Card({
  title,
  children,
  open: defaultOpen = true,
  className = "",
  ancho = false,
  gel = "rosa",
  resumen = null,
  id = null,
}) {
  const [abierta, setAbierta] = React.useState(defaultOpen);

  const toggle = (e) => {
    e.preventDefault();
    setAbierta((prev) => !prev);
  };

  return (
    <section
      id={id}
      className={`tarjeta gel-${gel} ${ancho ? "ancho-total" : ""} ${abierta ? "esta-abierta" : "esta-colapsada"} ${className}`}
      aria-expanded={abierta}
    >
      <header
        className="tarjeta-cab"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(e);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`${abierta ? "Contraer" : "Expandir"} sección ${title}`}
      >
        <span className="tarjeta-titulo">{title}</span>
        {!abierta && resumen && (
          <span className="tarjeta-resumen-pill animate-fade-in" title={typeof resumen === "string" ? resumen : undefined}>
            {resumen}
          </span>
        )}
        <ChevronDown className={`tarjeta-flecha ${abierta ? "rotada" : ""}`} size={16} aria-hidden="true" />
      </header>
      <div className={`tarjeta-colapsable-wrap ${abierta ? "abierto" : "cerrado"}`}>
        <div className="tarjeta-colapsable-inner">
          <div className="tarjeta-cuerpo">{children}</div>
        </div>
      </div>
    </section>
  );
}

// ── Selector de color estilo Apple Liquid Glass con posicionamiento nativo macOS ──
export function ColorPickerField({ etiqueta = "Color de marca", value, onChange }) {
  const btnRef = React.useRef(null);
  const colorActual = value || "#1D6FD1";

  const handleOpenColor = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cmd = new OpenColorPickerCommand({
      triggerEl: btnRef.current,
      initialHex: colorActual,
      tag: "color-de-marca",
      onChange: (nuevoColor) => {
        onChange?.({ target: { value: nuevoColor } });
      },
    });
    cmd.execute();
  };

  return (
    <div className="campo">
      {etiqueta && <span className="campo-et">{etiqueta}</span>}
      <button
        ref={btnRef}
        type="button"
        className="color-swatch-btn"
        onClick={handleOpenColor}
        title="Seleccionar color de marca (Abre panel de colores de macOS)"
        aria-label={`Color de marca actual: ${colorActual}`}
      >
        <span className="color-swatch-dot" style={{ backgroundColor: colorActual }} />
        <span className="color-swatch-hex mono">{String(colorActual).toUpperCase()}</span>
      </button>
    </div>
  );
}

// ── GoF Abstract Factory: Fábrica de Componentes de Interfaz ──────────────
export const EditorUIFactory = {
  createCard: (props) => <Card {...props} />,
  createField: (props) => <Campo {...props} />,
  createFieldsGroup: (props) => <Campos {...props} />,
  createChips: (props) => <Chips {...props} />,
  createFormatPicker: (props) => <Formatos {...props} />,
  createColorPicker: (props) => <ColorPickerField {...props} />,
  createButton: (props) => <Btn {...props} />,
};

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
        className="b b-2 b-ic no-print" style={{ borderRadius: "50%", fontWeight: 800 }}>?</button>
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

// ── Chips (Segmented / Multi or Single Select) ────────────────────────────
// Grupo de opciones que se encienden y apagan. Si `multi` es false, funciona como
// un Segmented Control exclusivo de macOS (un valor a la vez, pulsar de nuevo lo apaga).
export function Chips({ titulo, ayuda, opciones, valor, onChange, multi = true, className = "" }) {
  const esMulti = multi && Array.isArray(valor);
  const activo = (o) => (esMulti ? valor.includes(o) : valor === o);
  const alternar = (o) => {
    if (esMulti) {
      onChange(activo(o) ? valor.filter((v) => v !== o) : [...valor, o]);
    } else {
      onChange(activo(o) ? "" : o);
    }
  };

  return (
    <div className={`campo ${className}`}>
      {titulo && <span className="campo-et">{titulo}</span>}
      {ayuda && <p className="campo-pista">{ayuda}</p>}
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => alternar(o)}
            aria-pressed={activo(o)}
            className="b b-chip"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}


// ── Formato: la forma del cuadro ──────────────────────────────────────────
// Se elige VIENDO la proporción, no leyendo "9:16". El rectángulo se dibuja a
// escala real, así que la decisión se toma con el ojo, que es como se toma en
// un rodaje. Sale de por dónde lo va a ver el receptor.
export function Formatos({ valor, onChange, sugerido }) {
  // El rectángulo se dibuja a escala: cabe en 56×34 y conserva su proporción.
  const CAJA_W = 56, CAJA_H = 34;
  const medida = (f) => {
    const r = f.w / f.h;
    const w = Math.min(CAJA_W, CAJA_H * r);
    return { width: Math.round(w), height: Math.round(w / r) };
  };
  return (
    <div className="campo">
      <span className="campo-et">Formato — la forma del cuadro</span>
      <div className="formatos">
        {FORMATOS.map((f) => {
          return (
            <button key={f.id} type="button" className="fmt" aria-pressed={valor === f.id}
              title={f.para} onClick={() => onChange(f.id)}>
              <span className="caja" style={medida(f)} />
              <span className="nom">{f.nombre}</span>
            </button>
          );
        })}
      </div>
      {sugerido && (
        <p className="campo-pista">
          {FORMATOS.find((f) => f.id === valor)?.para}
          {valor === sugerido ? "" : ` · para lo que elegiste, lo normal sería ${sugerido}`}
        </p>
      )}
    </div>
  );
}

// ── Lectura: una cifra grande, como un medidor ────────────────────────────
export const Lectura = ({ cifra, pie }) => (
  <div className="lectura"><span className="cifra">{cifra}</span><span className="pie">{pie}</span></div>
);

export const Aviso = ({ children }) => <span className="aviso">{children}</span>;

// ── Tabulador de presupuesto ──────────────────────────────────────────────
// Los rangos son los de la industria (Above the Line / Below the Line), no
// inventados. Si un bloque se sale, su casilla se pone ámbar: la gelatina
// ámbar haciendo su trabajo, que es decir "revisa esto".
export function Tabulador({ perfil, onChange }) {
  const { filas, suma, total } = repartoCalculado(perfil);
  const mxn = (n) => "$" + n.toLocaleString("es-MX");
  return (
    <div className="campo">
      <div className="seccion-cab">
        <span className="seccion-tit">A qué se va</span>
        <p className="seccion-pista">Los rangos son los que usa la industria. Si te sales, la casilla se pone ámbar.</p>
      </div>
      <div className="reparto" aria-hidden="true">
        {filas.map((f) => <span key={f.id} style={{ flex: Math.max(f.pct, 1), background: f.color }} />)}
      </div>
      <div className="tab">
        {filas.map((f) => (
          <div key={f.id} className={`tab-fila${f.fuera ? " fuera" : ""}`}>
            <span className="tab-nom">
              <i style={{ background: f.color }} />
              <span><b>{f.nombre}</b><em className="tab-rango">{f.detalle} · {f.min}-{f.max}%</em></span>
            </span>
            <input className="tab-pct" inputMode="numeric" value={f.pct}
              aria-label={`Porcentaje de ${f.nombre}`}
              onChange={(e) => onChange({ ...perfil.reparto, [f.id]: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })} />
            <span className="tab-mxn">{total ? mxn(f.mxn) : "—"}</span>
          </div>
        ))}
        <div className="tab-tot">
          <span className="tab-nom"><span><b>Total repartido</b></span></span>
          <span className="tab-mxn" style={{ color: suma === 100 ? undefined : "var(--cto-t)" }}>{suma}%</span>
          <span className="tab-mxn">{total ? mxn(total) : "—"}</span>
        </div>
      </div>
      {suma !== 100 && (
        <Aviso>{suma > 100 ? `Estás repartiendo ${suma}%: sobra ${suma - 100}%` : `Falta repartir ${100 - suma}%`}</Aviso>
      )}
    </div>
  );
}

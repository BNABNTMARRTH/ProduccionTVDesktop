import React, { useLayoutEffect, useRef, useMemo } from "react";
import { ChevronDown, ChevronRight, ChevronUp, GripVertical } from "lucide-react";
import { SECCIONES_DEPRECADAS, SECCIONES_INFO } from "./catalogos.js";
import { computeBloques, computeFuentes, computeRows } from "./escaleta.js";
import { Escaleta, Timeline } from "./EscaletaVistas.jsx";
import { EstudioCenital } from "./EstudioCenital.jsx";
import { PersonalGrid } from "./PersonalGrid.jsx";
import { useReorder } from "./hooks.js";
import { normSecciones } from "./proyecto.js";
import { reacomodoDe, upSetPor } from "./sets.js";
import { AIR_COLOR, NAVY } from "./theme.js";
import { fmt, reorder } from "./util.js";

// LA INFOGRAFÍA: la hoja grande que resume el proyecto (estudio, escaleta,
// personal y línea de tiempo). Cada bloque es una "sección" que se puede abrir,
// cerrar y reordenar arrastrando; el orden se guarda en el proyecto.
// Set/Estudio: planta física cenital interactiva de TODOS los sets del
// proyecto, apilados con su nombre y locación. Posiciones y ángulos persisten
// por set en cfg.sets[].setLayout, así que viajan con el proyecto.
function Estudio({ cfg, fuentes, setCfg }) {
  const cams = fuentes.filter((f) => f.tipo === "cam");
  const editable = typeof setCfg === "function";
  const sets = cfg.sets || [];
  const reacomodar = (setId) => setCfg((c) => upSetPor(c, setId, reacomodoDe), { commit: true });
  return (
    <div className="flex flex-col gap-2">
      <div className="no-print flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: "var(--hoja-tinta-baja)" }}>
          {editable
            ? "Arrastra los elementos; lo direccional gira con su manija (doble clic en la manija: volver al automático). Los sets se administran en la pestaña Set."
            : "Distribución física del set."}
        </span>
      </div>
      {sets.map((s) => {
        const tieneCustom = Object.keys(s.setLayout?.pos || {}).length > 0 || Object.keys(s.setLayout?.rot || {}).length > 0;
        return (
          <div key={s.id}>
            <div className="flex flex-wrap items-center gap-2" style={{ margin: "2px 0 4px" }}>
              <span className="rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: NAVY, color: "#fff" }}>{s.nombre}</span>
              <span className="rounded px-1.5 py-0.5 text-xs font-bold"
                style={{ background: s.locacion === "ext" ? "#DCEFDD" : "#E3ECF7", color: s.locacion === "ext" ? "#2F6B38" : "#1C4E86" }}>
                {s.locacion === "ext" ? "EXTERIOR" : "ESTUDIO"}
              </span>
              {editable && tieneCustom && (
                <button onClick={() => reacomodar(s.id)} className="no-print rounded-lg border px-2 py-0.5 text-xs font-bold"
                  style={{ borderColor: "var(--hoja-linea)", color: "var(--hoja-tinta)", background: "var(--hoja-alza)" }}>
                  Reacomodar automáticamente
                </button>
              )}
            </div>
            <EstudioCenital key={s.id} cfg={cfg} set={s} cams={cams} editable={editable} setCfg={setCfg} />
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------- Secciones de la infografía ----------------------------- */

// Panel de sección: cabecera con asa para arrastrar, botones subir/bajar y abrir/cerrar.
function SeccionPanel({ titulo, abierto, controls, onToggle, onUp, onDown, canUp, canDown, source, target, dragging, over, children }) {
  return (
    <div
      {...(controls ? target : {})}
      className={`rounded-xl border-2 ${abierto ? "" : "seccion-cerrada"}`}
      style={{
        /* El fondo VA EN ESTE MISMO objeto. Estuvo un rato en un segundo
           atributo `style` de la misma etiqueta y JSX se queda con el último:
           el panel se quedaba sin fondo y se veía la hoja a través. */
        background: "var(--hoja-alza)",
        borderColor: "var(--ui-sello)",
        opacity: dragging ? 0.4 : 1,
        outline: over && !dragging ? `2px dashed ${AIR_COLOR}` : "none",
        outlineOffset: 2,
      }}
    >
      <div className="flex items-center gap-2"
        style={{ background: "var(--ui-sello)", color: "var(--hoja)", borderRadius: abierto ? "10px 10px 0 0" : 10, padding: "4px 8px" }}>
        {controls && (
          <span {...source} title="Arrastra para reordenar"
            className="no-print flex items-center cursor-grab active:cursor-grabbing" style={{ touchAction: "none", opacity: .7 }}>
            <GripVertical size={16} />
          </span>
        )}
        <button onClick={controls ? onToggle : undefined}
          className="flex-1 flex items-center gap-1.5 text-left"
          style={{ background: "transparent", border: 0, color: "inherit", cursor: controls ? "pointer" : "default", padding: 0 }}>
          {controls && (
            <span className="no-print flex items-center">
              {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </span>
          )}
          <span className="cond uppercase font-bold" style={{ fontSize: 16, letterSpacing: 1 }}>{titulo}</span>
        </button>
        {controls && (
          <span className="no-print flex items-center gap-0.5">
            <button onClick={onUp} disabled={!canUp} aria-label="Subir sección"
              style={{ background: "transparent", border: 0, padding: 0, cursor: canUp ? "pointer" : "default", opacity: canUp ? .85 : .35 }}>
              <ChevronUp size={16} />
            </button>
            <button onClick={onDown} disabled={!canDown} aria-label="Bajar sección"
              style={{ background: "transparent", border: 0, padding: 0, cursor: canDown ? "pointer" : "default", opacity: canDown ? .85 : .35 }}>
              <ChevronDown size={16} />
            </button>
          </span>
        )}
      </div>
      {abierto && <div className="p-3">{children}</div>}
    </div>
  );
}

/* LA HOJA ENCAJA EN SU HUECO. Estaba clavada en 1240 px de ancho, y esa es la
   causa de que la infografía se "disociara" de lo que la rodea: en una ventana
   de 922 px se salía 318, y al subir el tamaño de la app la ventana se hace más
   angosta todavía, así que se salía más. El resto de la app no se salía, y por
   eso parecía que la hoja flotaba aparte de su marco.

   La solución es la misma que ya hacía bien el plano del set: ese dibujo es un
   SVG con `viewBox` y ancho 100 %, así que se acomoda solo a cualquier hueco.
   Una hoja de HTML no puede tener viewBox, pero sí puede hacer lo mismo a mano:
   se mide el hueco y se le pone al conjunto el factor que haga falta. Se usa
   `zoom` y no `transform:scale` a propósito — `zoom` SÍ encoge la caja, así que
   debajo no queda el hueco fantasma que deja `scale`.

   Nunca crece por encima de 1: la hoja tiene su tamaño de diseño y estirarla en
   una pantalla ancha solo la haría borrosa. */
const ANCHO_HOJA = 1240;

export function Infografia({ cfg, setCfg }) {
  const hueco = useRef(null);
  const puesto = useRef('');
  useLayoutEffect(() => {
    const el = hueco.current;
    if (!el) return;
    const ajustar = () => {
      /* clientWidth y no getBoundingClientRect: aquí dentro del iframe no hay
         zoom propio —el de la app vive en la raíz del caparazón y lo que llega
         es una ventana más angosta—, así que esta medida ya viene en píxeles
         CSS de verdad y no hay que dividirla por nada. */
      const hay = el.clientWidth;
      if (!hay) return;
      /* Solo se escribe si cambió. Cambiar el factor cambia el alto de la hoja,
         eso puede hacer aparecer la barra de desplazamiento, eso cambia el
         ancho, y el observador se vuelve a disparar: sin este corte la vista
         entra en un ciclo que no para. */
      const factor = Math.min(1, hay / ANCHO_HOJA).toFixed(3);
      if (factor === puesto.current) return;
      puesto.current = factor;
      el.style.setProperty("--encaje", factor);
    };
    ajustar();
    const ojo = new ResizeObserver(ajustar);
    ojo.observe(el);
    return () => ojo.disconnect();
  }, []);

  const brandColor = cfg.branding?.primaryColor || NAVY;
  const fuentes = useMemo(() => computeFuentes(cfg), [cfg]);
  const byId = useMemo(() => Object.fromEntries(fuentes.map((f) => [f.id, f])), [fuentes]);
  const rows = useMemo(() => computeRows(cfg), [cfg]);
  const total = rows.length ? rows[rows.length - 1].tout : 0;
  const bloques = useMemo(() => computeBloques(rows, byId), [rows, byId]);
  const cams = fuentes.filter((f) => f.tipo === "cam");

  // Orden y estado abierto/cerrado de cada sección (configurable y persistente).
  // Las secciones deprecadas se conservan en los datos pero ya no se muestran aquí.
  const orden = useMemo(
    () => normSecciones(cfg.secciones).filter((s) => !SECCIONES_DEPRECADAS.includes(s.id)),
    [cfg.secciones],
  );
  const editable = typeof setCfg === "function";
  const setSecciones = (next) => { if (editable) setCfg((c) => ({ ...c, secciones: next })); };
  const moveSec = (from, to) => {
    if (from < 0 || to < 0 || from >= orden.length || to >= orden.length) return;
    setSecciones(reorder(orden, from, to));
  };
  const toggleSec = (id) => setSecciones(orden.map((s) => (s.id === id ? { ...s, abierto: !s.abierto } : s)));
  const { dragIdx, overIdx, source, target } = useReorder(moveSec);

  const contenido = {
    estudio: <Estudio cfg={cfg} fuentes={fuentes} setCfg={setCfg} />,
    escaleta: <Escaleta rows={rows} byId={byId} total={total} />,
    personal: <PersonalGrid cfg={cfg} cams={cams} />,
    timeline: <Timeline rows={rows} byId={byId} total={total} bloques={bloques} />,
  };
  const labelDe = (id) => {
    const base = SECCIONES_INFO.find((s) => s.id === id)?.label || id;
    if (id === "escaleta") return `Escaleta / Rundown — ${fmt(total)}`;
    if (id === "timeline") return `Línea de tiempo — ${fmt(total)}`;
    if (id === "personal") return `Personal de operación (${cfg.personal.length}${cfg.includeCamOps ? ` + ${cams.length} cám.` : ""})`;
    return base;
  };

  return (
    <div ref={hueco} className="infografia-hueco">
    <div className="infografia-sheet hoja-tema lienzo-tema shadow-lg mx-auto"
      style={{ width: ANCHO_HOJA, padding: 16, borderRadius: 8, background: "var(--hoja)", color: "var(--hoja-tinta)", "--hoja-sello": brandColor }}>
      {/* Encabezado */}
      <div className="flex items-stretch gap-3" style={{ marginBottom: 12 }}>
        <div className="cond flex items-center justify-center text-center rounded-lg border-2 font-bold uppercase"
          style={{ borderColor: "var(--ui-sello)", color: "var(--ui-sello)", width: 170, fontSize: 17, letterSpacing: 1, padding: 6, lineHeight: 1.1 }}>
          {cfg.branding?.logoDataUrl
            ? <img src={cfg.branding.logoDataUrl} alt={cfg.organizacion} style={{ maxWidth: "100%", maxHeight: 58, objectFit: "contain" }} />
            : cfg.organizacion}
        </div>
        <div className="flex-1 text-center">
          <h1 className="cond font-bold uppercase" style={{ color: "var(--ui-sello)", fontSize: 34, lineHeight: 1.05, letterSpacing: 1 }}>{cfg.titulo}</h1>
          <p className="font-semibold" style={{ color: "var(--hoja-tinta-baja)", fontSize: 14, marginTop: 2 }}>{cfg.subtitulo}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border-2" style={{ borderColor: "var(--ui-sello)", width: 170, padding: 6 }}>
          <span className="cond uppercase font-bold" style={{ fontSize: 12, color: "var(--hoja-tinta-baja)", letterSpacing: 1 }}>Duración</span>
          <span className="cond font-bold" style={{ fontSize: 26, color: "var(--hoja-tinta)", lineHeight: 1 }}>{fmt(total)}</span>
          <span style={{ fontSize: 10, color: "var(--hoja-tinta-baja)", marginTop: 2 }}>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {editable && (
        <p className="no-print flex items-center gap-1.5 text-xs" style={{ marginBottom: 8, color: "var(--hoja-tinta-baja)" }}>
          <GripVertical size={13} /> Arrastra el asa para reordenar las secciones, o toca el título para abrir/cerrar. Lo que dejes cerrado no aparece al imprimir.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {orden.map((s, i) => (
          <SeccionPanel
            key={s.id}
            titulo={labelDe(s.id)}
            abierto={s.abierto}
            controls={editable}
            onToggle={() => toggleSec(s.id)}
            onUp={() => moveSec(i, i - 1)}
            onDown={() => moveSec(i, i + 1)}
            canUp={i > 0}
            canDown={i < orden.length - 1}
            source={source(i)}
            target={target(i)}
            dragging={dragIdx === i}
            over={overIdx === i}
          >
            {contenido[s.id]}
          </SeccionPanel>
        ))}
      </div>
    </div>
    </div>
  );
}

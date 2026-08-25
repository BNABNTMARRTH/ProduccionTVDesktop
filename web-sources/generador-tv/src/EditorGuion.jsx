// Pestaña "Guion literario": el guion en su forma tradicional, la de toda la
// vida (estilo Final Draft), sobre las MISMAS escenas de la escaleta.
//
// Por qué así y no un documento aparte: el encabezado, la duración y los
// personajes de cada escena ya viven en la escaleta. Si el guion fuera otro
// archivo habría dos verdades y siempre una estaría vieja. Aquí se escribe en
// forma de guion y la escaleta se actualiza sola, porque son lo mismo visto de
// dos maneras.
//
// El teclado es lo que hace rápido escribir un guion:
//   Enter        pasa al bloque que toca (tras PERSONAJE viene su DIÁLOGO)
//   Tab          cambia el tipo del bloque actual
//   Retroceso    en un bloque vacío, lo borra y sube al anterior
//   ⌘/Ctrl+Enter abre una escena nueva
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  TIPOS, ORDEN_TIPOS, TIPO_SIGUIENTE, siguienteEnRotacion, bloqueNuevo, guionDe,
  medidasDe, normalizarEncabezado, personajesDe,
} from "./guion.js";
import { objetivoDe } from "./proyecto.js";
import { TarjetaAyuda } from "./ui.jsx";
import { INK, NAVY } from "./theme.js";
import { fmt, uid } from "./util.js";

const PAPEL = { background: "#fff", color: "#12212f", fontFamily: '"Courier New", Courier, monospace' };

export function EditorGuion({ cfg, setCfg }) {
  const editable = typeof setCfg === "function";
  const escenas = cfg.escaleta || [];
  const personajes = useMemo(() => personajesDe(cfg), [cfg]);
  const medidas = useMemo(() => medidasDe(escenas), [escenas]);
  const objetivoMin = objetivoDe(cfg);
  const [foco, setFoco] = useState(null);          // id del bloque a enfocar
  const [sugiere, setSugiere] = useState(null);    // {bloqueId, opciones}
  const areas = useRef({});

  // Enfoca el bloque recién creado y coloca el cursor al final.
  useEffect(() => {
    if (!foco) return;
    const el = areas.current[foco];
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    setFoco(null);
  }, [foco]);

  const upEscena = (id, parche) => setCfg((c) => ({
    ...c, escaleta: (c.escaleta || []).map((e) => (e.id === id ? { ...e, ...parche } : e)),
  }));

  const upGuion = (escId, cambia) => setCfg((c) => ({
    ...c,
    escaleta: (c.escaleta || []).map((e) => (e.id === escId ? { ...e, guion: cambia(guionDe(e)) } : e)),
  }));

  const upBloque = (escId, bId, parche) =>
    upGuion(escId, (g) => g.map((b) => (b.id === bId ? { ...b, ...parche } : b)));

  const insertarTras = (escId, bId, tipo) => {
    const nuevo = bloqueNuevo(tipo);
    upGuion(escId, (g) => {
      const i = g.findIndex((b) => b.id === bId);
      return [...g.slice(0, i + 1), nuevo, ...g.slice(i + 1)];
    });
    setFoco(nuevo.id);
  };

  const borrarBloque = (escId, bId) => {
    const esc = escenas.find((e) => e.id === escId);
    const g = guionDe(esc);
    if (g.length <= 1) return;                       // toda escena conserva un bloque
    const i = g.findIndex((b) => b.id === bId);
    upGuion(escId, (gg) => gg.filter((b) => b.id !== bId));
    setFoco(g[Math.max(0, i - 1)].id);
  };

  const agregarEscena = (despuesDe) => {
    const nueva = {
      id: uid(), segmento: `Escena ${escenas.length + 1}`, dur: 60,
      encabezado: "", accion: "", funcion: "", personajes: "", cambio: "", nota: "",
      tomas: [], guion: [bloqueNuevo()],
    };
    setCfg((c) => {
      const lista = [...(c.escaleta || [])];
      const i = lista.findIndex((e) => e.id === despuesDe);
      lista.splice(i < 0 ? lista.length : i + 1, 0, nueva);
      return { ...c, escaleta: lista };
    });
    setFoco(nueva.guion[0].id);
  };

  const borrarEscena = (escId) => setCfg((c) => ({ ...c, escaleta: (c.escaleta || []).filter((e) => e.id !== escId) }));

  // Ajusta el alto del área de texto a su contenido (nunca barras de scroll
  // dentro de una página de guion).
  const acomoda = (el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };

  const teclas = (ev, esc, bloque) => {
    if (!editable) return;
    if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); agregarEscena(esc.id); return; }
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      setSugiere(null);
      insertarTras(esc.id, bloque.id, TIPO_SIGUIENTE[bloque.tipo] || "accion");
      return;
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      const i = ORDEN_TIPOS.indexOf(bloque.tipo);
      const tipo = ev.shiftKey ? ORDEN_TIPOS[(i - 1 + ORDEN_TIPOS.length) % ORDEN_TIPOS.length] : siguienteEnRotacion(bloque.tipo);
      upBloque(esc.id, bloque.id, { tipo });
      return;
    }
    if (ev.key === "Backspace" && !bloque.texto) { ev.preventDefault(); borrarBloque(esc.id, bloque.id); }
  };

  const escribe = (esc, bloque, valor) => {
    upBloque(esc.id, bloque.id, { texto: valor });
    // Autocompletado de personajes: solo mientras se escribe el nombre.
    if (bloque.tipo === "personaje" && valor.trim()) {
      const busca = valor.trim().toUpperCase();
      const opciones = personajes.filter((p) => p.startsWith(busca) && p !== busca).slice(0, 4);
      setSugiere(opciones.length ? { bloqueId: bloque.id, opciones } : null);
    } else setSugiere(null);
  };

  const totalMin = medidas.segundos / 60;
  const desfase = objetivoMin ? totalMin - objetivoMin : 0;

  const irA = (id) => {
    const el = document.getElementById(`esc-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="scrollwrap overflow-auto px-2 py-4" style={{ background: "#E9EDF3" }}>
      <div className="mx-auto grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]" style={{ maxWidth: 1180 }}>
      {/* Índice de escenas: solo aparece cuando hay ancho para él. Antes ese
          espacio se quedaba vacío a los lados de la página. */}
      <aside className="no-print hidden xl:block">
        <div className="sticky top-2 rounded-xl p-3" style={{ background: "#fff", border: "1px solid #C8D2DE" }}>
          <div className="mb-2 text-xs font-bold uppercase" style={{ color: "#8A97A8", letterSpacing: 1 }}>
            Escenas ({escenas.length})
          </div>
          <div className="flex flex-col gap-1">
            {escenas.map((e, i) => (
              <button key={e.id} type="button" onClick={() => irA(e.id)}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs"
                style={{ color: INK, background: "transparent" }}>
                <b style={{ color: "#93a1b3", minWidth: 14 }}>{i + 1}</b>
                <span className="flex-1" style={{ lineHeight: 1.35 }}>
                  {e.encabezado || <em style={{ color: "#93a1b3" }}>Sin encabezado</em>}
                </span>
                <span style={{ color: "#93a1b3" }}>{fmt(e.dur || 0)}</span>
              </button>
            ))}
            {!escenas.length && <p className="m-0 text-xs" style={{ color: "#93a1b3" }}>Todavía no hay escenas.</p>}
          </div>
          {editable && (
            <button type="button" onClick={() => agregarEscena(escenas[escenas.length - 1]?.id)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold"
              style={{ background: "#EEF3F9", color: NAVY }}>
              <Plus size={13} /> Escena al final
            </button>
          )}
        </div>
      </aside>
      <div>
      {/* Barra de estado: páginas, minutos y comparación con la duración objetivo */}
      <div className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5"
        style={{ background: "#fff", border: "1px solid #C8D2DE" }}>
        <b className="cond text-sm font-bold uppercase" style={{ color: NAVY, letterSpacing: 1 }}>Guion literario</b>
        <span className="text-xs" style={{ color: "#5b6b82" }}>
          {medidas.paginas.toFixed(1)} páginas · ≈ {fmt(medidas.segundos)} en pantalla
          {objetivoMin ? ` · objetivo ${objetivoMin} min` : ""}
        </span>
        {objetivoMin > 0 && Math.abs(desfase) >= 0.5 && (
          <span className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={desfase > 0 ? { background: "#FDECEC", color: "#B4232A" } : { background: "#FFF6E0", color: "#8A6100" }}>
            {desfase > 0 ? `${Math.abs(desfase).toFixed(1)} min de más` : `${Math.abs(desfase).toFixed(1)} min de menos`}
          </span>
        )}
        <span className="flex-1" />
        <TarjetaAyuda id="guion-literario" titulo="Cómo se escribe aquí" pasos={[
          "Escribe y da <b>Enter</b>: la app pasa sola al bloque que toca. Después de un <b>PERSONAJE</b> siempre viene su <b>diálogo</b>.",
          "¿Necesitas otro tipo de bloque? <b>Tab</b> lo cambia: acción → personaje → paréntesis → diálogo → transición.",
          "<b>⌘+Enter</b> abre una escena nueva. Su encabezado se escribe arriba: <b>INT. LUGAR – DÍA</b>.",
          "Cada escena que abres aquí <b>aparece también en la escaleta</b>, con su duración. Son el mismo proyecto visto de dos formas.",
          "La regla del oficio: <b>una página ≈ un minuto</b> de pantalla. Arriba te digo cuánto llevas.",
        ]} />
      </div>

      {/* La página */}
      <div className="rounded-xl px-10 py-8 shadow-sm" style={{ ...PAPEL, border: "1px solid #C8D2DE" }}>
        {!escenas.length && (
          <p className="m-0 text-center text-sm" style={{ color: "#7c8a9c" }}>
            Todavía no hay escenas. Empieza la primera aquí abajo.
          </p>
        )}

        {escenas.map((esc, i) => (
          <section key={esc.id} id={`esc-${esc.id}`} className="mb-7" style={{ scrollMarginTop: 12 }}>
            {/* Encabezado de escena */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: "#93a1b3", minWidth: 22 }}>{i + 1}</span>
              <input
                value={esc.encabezado || ""}
                disabled={!editable}
                onChange={(e) => upEscena(esc.id, { encabezado: e.target.value.toUpperCase() })}
                onBlur={(e) => upEscena(esc.id, { encabezado: normalizarEncabezado(e.target.value) })}
                placeholder="INT. LUGAR – DÍA"
                className="w-full border-0 bg-transparent py-1 text-sm font-bold outline-none"
                style={{ fontFamily: PAPEL.fontFamily, letterSpacing: 0.5, color: INK }}
              />
              <span className="no-print text-xs" style={{ color: "#93a1b3", whiteSpace: "nowrap" }}>{fmt(esc.dur || 0)}</span>
              {editable && escenas.length > 1 && (
                <button type="button" onClick={() => borrarEscena(esc.id)} title="Borrar esta escena"
                  className="no-print grid h-6 w-6 place-items-center rounded" style={{ color: "#b45", background: "#fff" }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div style={{ height: 1, background: "#E2E8F0", margin: "2px 0 10px" }} />

            {/* Cuerpo del guion */}
            {guionDe(esc).map((b) => {
              const t = TIPOS[b.tipo] || TIPOS.accion;
              return (
                <div key={b.id} style={{ position: "relative", marginLeft: `${t.sangria}%`, width: `${t.ancho}%` }}>
                  <textarea
                    ref={(el) => { areas.current[b.id] = el; acomoda(el); }}
                    rows={1}
                    value={b.texto}
                    disabled={!editable}
                    placeholder={t.nombre}
                    onChange={(e) => { acomoda(e.target); escribe(esc, b, t.mayus ? e.target.value.toUpperCase() : e.target.value); }}
                    onKeyDown={(e) => teclas(e, esc, b)}
                    onFocus={(e) => acomoda(e.target)}
                    className="w-full resize-none border-0 bg-transparent outline-none"
                    style={{
                      fontFamily: PAPEL.fontFamily, fontSize: 14.5, lineHeight: 1.5,
                      textAlign: t.align, textTransform: t.mayus ? "uppercase" : "none",
                      color: b.tipo === "transicion" ? "#5b6b82" : INK,
                      padding: b.tipo === "dialogo" || b.tipo === "parentesis" ? "0" : "6px 0 0",
                      fontStyle: b.tipo === "parentesis" ? "italic" : "normal",
                      overflow: "hidden",
                    }}
                  />
                  {/* Etiqueta del tipo, solo en el bloque enfocado */}
                  <span className="no-print" style={{
                    position: "absolute", left: -68, top: 8, fontSize: 9, fontWeight: 700,
                    letterSpacing: 0.6, textTransform: "uppercase", color: "#b6c0cd",
                    fontFamily: "system-ui, sans-serif", pointerEvents: "none",
                  }}>{t.nombre}</span>

                  {sugiere?.bloqueId === b.id && (
                    <div className="no-print" style={{
                      position: "absolute", zIndex: 5, left: 0, top: "100%",
                      background: "#fff", border: "1px solid #C8D2DE", borderRadius: 8,
                      boxShadow: "0 8px 20px rgba(12,28,48,.14)", overflow: "hidden",
                    }}>
                      {sugiere.opciones.map((op) => (
                        <button key={op} type="button"
                          onMouseDown={(e) => { e.preventDefault(); upBloque(esc.id, b.id, { texto: op }); setSugiere(null); }}
                          className="block w-full px-3 py-1.5 text-left text-xs font-bold"
                          style={{ fontFamily: "system-ui, sans-serif", color: INK }}>
                          {op}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {editable && (
              <button type="button" onClick={() => agregarEscena(esc.id)}
                className="no-print mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold"
                style={{ background: "#EEF3F9", color: NAVY, fontFamily: "system-ui, sans-serif" }}>
                <Plus size={13} /> Escena nueva aquí
              </button>
            )}
          </section>
        ))}

        {editable && !escenas.length && (
          <button type="button" onClick={() => agregarEscena(null)}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold text-white"
            style={{ background: NAVY, fontFamily: "system-ui, sans-serif" }}>
            <Plus size={15} /> Empezar la primera escena
          </button>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}

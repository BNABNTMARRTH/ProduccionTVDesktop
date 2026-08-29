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
import { Download, Plus, Printer, Trash2 } from "lucide-react";
import {
  TIPOS, ORDEN_TIPOS, TIPO_SIGUIENTE, siguienteEnRotacion, bloqueNuevo, guionDe,
  medidasDe, normalizarEncabezado, personajesDe,
  MARCADORES, aplicarMarca, quitarMarca, trozosMarcados, moverMarcas, guionATexto,
} from "./guion.js";
import { objetivoSegDe, toleranciaDe } from "./proyecto.js";
import { Btn, TarjetaAyuda } from "./ui.jsx";
import { descargarArchivo, EMBEDDED } from "./puente.js";

import { fmt, parseDur, uid } from "./util.js";

const PAPEL = { background: "var(--hoja)", color: "var(--hoja-tinta)", fontFamily: '"Courier New", Courier, monospace' };

/* LA HOJA TIENE SU PROPIO TEMA (2026-08-28). Antes era blanca siempre, con el
   argumento de que es lo que se imprime, y por eso todo lo que iba encima
   llevaba tintas de papel FIJAS. El argumento valía para la impresora y no
   para los ojos: una hoja blanca a pantalla completa dentro de una app oscura
   deslumbra, y un guion se mira mucho más de lo que se imprime.

   Ahora la hoja se apaga con el tema —papel cálido, tinta clara— y al imprimir
   vuelve a ser blanca. Las tintas viven en index.css, bajo `.hoja-tema`, junto
   a los colores de las etiquetas de tipo y de los marcatextos, que son los que
   se rompen al cambiar el fondo. Aquí solo se nombran. */
const TINTA_PAPEL = "var(--hoja-tinta)";
const TINTA_PAPEL_BAJA = "var(--hoja-tinta-baja)";
const LINEA_PAPEL = "var(--hoja-linea)";

// Los estilos que DEBEN ser idénticos en el área de escritura y en la capa del
// marcatextos: si uno solo cambia, el resaltado se desalinea de las letras.
const tipografia = (bloque, t) => ({
  fontFamily: PAPEL.fontFamily,
  fontSize: 14.5,
  lineHeight: 1.5,
  letterSpacing: 0,
  textAlign: t.align,
  textTransform: t.mayus ? "uppercase" : "none",
  fontStyle: bloque.tipo === "parentesis" ? "italic" : "normal",
  color: bloque.tipo === "transicion" ? TINTA_PAPEL_BAJA : TINTA_PAPEL,
  padding: bloque.tipo === "dialogo" || bloque.tipo === "parentesis" ? "0" : "6px 0 0",
  border: 0,
  margin: 0,
  display: "block",
});

export function EditorGuion({ cfg, setCfg }) {
  const editable = typeof setCfg === "function";
  const escenas = cfg.escaleta || [];
  const personajes = useMemo(() => personajesDe(cfg), [cfg]);
  const medidas = useMemo(() => medidasDe(escenas), [escenas]);

  const nombreArchivo = (ext) =>
    `${(cfg.titulo || "guion").replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, "").trim().slice(0, 60) || "guion"}.${ext}`;

  // El .txt sale con las sangrías del oficio: se abre en cualquier lado y
  // sigue leyéndose como un guion.
  const descargarGuion = () => descargarArchivo(nombreArchivo("txt"), guionATexto(escenas), "text/plain");

  // Imprimir: se arma la MISMA hoja que sale en Guías y se manda al marco,
  // que es quien tiene el diálogo de impresión del sistema. Imprimir el
  // iframe directo solo saca lo que se ve en pantalla.
  const imprimirGuion = async () => {
    const hoja = window.PTVSheets?.guion?.(cfg, cfg.titulo || "Guion");
    if (!hoja) return;
    // El marco es quien tiene el diálogo del sistema, y necesita el CSS: un
    // iframe impreso solo aporta lo que se ve en pantalla, no las páginas.
    let css = "";
    try { css = await (await fetch("../shared/sheets.css")).text(); } catch {}
    window.parent.postMessage({ type: "producciontv:print-document",
      html: `<section class="sheet">${hoja}</section>`, css }, "*");
  };
  const objetivoSeg = objetivoSegDe(cfg);
  const [foco, setFoco] = useState(null);          // id del bloque a enfocar
  const [sugiere, setSugiere] = useState(null);    // {bloqueId, opciones}
  const [activa, setActiva] = useState(null);      // escena donde está el cursor
  const [enfocado, setEnfocado] = useState(null);  // {escenaId, bloqueId} donde está el cursor
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

  // Marcatextos: pinta lo seleccionado; si no hay selección, el bloque entero.
  const marcar = (color) => {
    if (!enfocado || !editable) return;
    const el = areas.current[enfocado.bloqueId];
    if (!el) return;
    const escena = escenas.find((e) => e.id === enfocado.escenaId);
    const bloque = guionDe(escena).find((b) => b.id === enfocado.bloqueId);
    if (!bloque) return;
    const haySeleccion = el.selectionEnd > el.selectionStart;
    const ini = haySeleccion ? el.selectionStart : 0;
    const fin = haySeleccion ? el.selectionEnd : bloque.texto.length;
    const marcas = color
      ? aplicarMarca(bloque.marcas || [], ini, fin, color)
      : quitarMarca(bloque.marcas || [], ini, fin);
    upBloque(escena.id, bloque.id, { marcas });
    el.focus();
    el.setSelectionRange(ini, fin);
  };

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
    // Las marcas viven en posiciones del texto: si se escribe o borra antes de
    // una, hay que recorrerla o el resaltado se despega de la palabra.
    const viejo = bloque.texto || "";
    let corte = 0;
    while (corte < viejo.length && corte < valor.length && viejo[corte] === valor[corte]) corte++;
    const marcas = moverMarcas(bloque.marcas || [], corte, valor.length - viejo.length);
    upBloque(esc.id, bloque.id, { texto: valor, marcas });
    // Autocompletado de personajes: solo mientras se escribe el nombre.
    if (bloque.tipo === "personaje" && valor.trim()) {
      const busca = valor.trim().toUpperCase();
      const opciones = personajes.filter((p) => p.startsWith(busca) && p !== busca).slice(0, 4);
      setSugiere(opciones.length ? { bloqueId: bloque.id, opciones } : null);
    } else setSugiere(null);
  };

  // Desfase contra el objetivo, en SEGUNDOS (ver toleranciaDe en proyecto.js).
  const desfase = objetivoSeg ? medidas.segundos - objetivoSeg : 0;
  const tolerancia = toleranciaDe(objetivoSeg);

  const irA = (id) => {
    const el = document.getElementById(`esc-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="scrollwrap hoja-tema overflow-auto px-2 py-4" style={{ background: "var(--vidrio-b)" }}>
      <div className="mx-auto grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[250px_minmax(0,900px)_minmax(340px,1fr)]"
        style={{ maxWidth: "100%" }}>
      {/* Índice de escenas: solo aparece cuando hay ancho para él. Antes ese
          espacio se quedaba vacío a los lados de la página. */}
      <aside className="no-print hidden xl:block">
        <div className="sticky top-2 rounded-xl p-3" style={{ background: "var(--vidrio-a)", border: "1px solid var(--vidrio-borde)" }}>
          <div className="mb-2 text-xs font-bold uppercase" style={{ color: "var(--tinta-media)", letterSpacing: 1 }}>
            Escenas ({escenas.length})
          </div>
          <div className="flex flex-col gap-1">
            {escenas.map((e, i) => (
              <button key={e.id} type="button" onClick={() => irA(e.id)}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs"
                style={{ color: "var(--tinta)", background: "transparent" }}>
                <b style={{ color: "var(--tinta-media)", minWidth: 14 }}>{i + 1}</b>
                <span className="flex-1" style={{ lineHeight: 1.35 }}>
                  {e.encabezado || <em style={{ color: "var(--tinta-media)" }}>Sin encabezado</em>}
                </span>
                <span style={{ color: "var(--tinta-media)" }}>{fmt(e.dur || 0)}</span>
              </button>
            ))}
            {!escenas.length && <p className="m-0 text-xs" style={{ color: "var(--tinta-media)" }}>Todavía no hay escenas.</p>}
          </div>
          {editable && (
            <button type="button" onClick={() => agregarEscena(escenas[escenas.length - 1]?.id)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold"
              style={{ background: "var(--vidrio-b)", color: "var(--tinta)" }}>
              <Plus size={13} /> Escena al final
            </button>
          )}
        </div>
      </aside>
      <div>
      {/* Barra de estado: páginas, minutos y comparación con la duración objetivo */}
      <div className="no-print vidrio mb-3 flex flex-wrap items-center gap-4 px-4 py-3">
        {/* LA CUENTA. Una página ≈ un minuto: es la regla con la que se
            cronometra un guion, así que el número va grande, como la lectura
            de un instrumento. Antes era texto gris de paso junto al título y
            el usuario ni lo veía. */}
        <div className="flex items-baseline gap-2">
          <span className="mono" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1,
            letterSpacing: "-.03em", color: "var(--gel-t)" }}>{medidas.paginas.toFixed(1)}</span>
          <span className="cond" style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".14em",
            textTransform: "uppercase", color: "var(--tinta-baja)" }}>páginas</span>
        </div>
        <span style={{ width: 1, height: 26, background: "var(--linea)" }} />
        <div className="flex items-baseline gap-2">
          <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: "var(--tinta)" }}>{fmt(medidas.segundos)}</span>
          <span style={{ fontSize: 11.5, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--tinta-baja)" }}>en pantalla</span>
        </div>
        {objetivoSeg ? (
          <span style={{ fontSize: 11.5, color: "var(--tinta-baja)" }}>objetivo {fmt(objetivoSeg)}</span>
        ) : null}
        {objetivoSeg > 0 && Math.abs(desfase) >= tolerancia && (
          <span className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={desfase > 0 ? { background: "color-mix(in srgb, var(--e5) 14%, var(--yeso))", color: "var(--e5-t)" } : { background: "color-mix(in srgb, var(--e3) 15%, var(--yeso))", color: "var(--e3-t)" }}>
            {`${fmt(Math.abs(desfase))} de ${desfase > 0 ? "más" : "menos"}`}
          </span>
        )}
        <span className="flex-1" />
        {/* Sacar el guion de la app. Estaba solo en Exportar, tres pantallas
            más allá: si no está donde se escribe, no existe. */}
        <div className="flex items-center gap-1.5">
          <Btn rango={2} icono={Printer} titulo="Imprimir el guion o guardarlo como PDF"
            onClick={imprimirGuion} disabled={!medidas.renglones}>Imprimir</Btn>
          <Btn rango={2} icono={Download} titulo="Guardar el guion como texto, para abrirlo en cualquier lado"
            onClick={descargarGuion} disabled={!medidas.renglones}>.txt</Btn>
        </div>
        {editable && (
          <div className="flex items-center gap-1.5" title="Selecciona texto y elige un color. Sin selección, marca el bloque completo.">
            <span className="text-xs font-bold uppercase" style={{ color: "var(--tinta-baja)", letterSpacing: .6 }}>Marcar</span>
            {Object.entries(MARCADORES).map(([id, m]) => (
              <button key={id} type="button" title={m.nombre}
                onMouseDown={(e) => e.preventDefault()} onClick={() => marcar(id)}
                className="h-6 w-6 rounded-md"
                style={{ background: m.color, border: "1px solid rgba(0,0,0,.18)" }} />
            ))}
            <button type="button" title="Quitar el marcador"
              onMouseDown={(e) => e.preventDefault()} onClick={() => marcar(null)}
              className="h-6 rounded-md px-2 text-xs font-bold"
              style={{ background: "var(--vidrio-b)", color: "var(--tinta-media)", border: "1px solid var(--linea)" }}>
              Quitar
            </button>
          </div>
        )}
        <TarjetaAyuda id="guion-literario" titulo="Cómo se escribe aquí" pasos={[
          "Escribe y da <b>Enter</b>: la app pasa sola al bloque que toca. Después de un <b>PERSONAJE</b> siempre viene su <b>diálogo</b>.",
          "¿Necesitas otro tipo de bloque? <b>Tab</b> lo cambia: acción → personaje → paréntesis → diálogo → transición.",
          "<b>⌘+Enter</b> abre una escena nueva. Su encabezado se escribe arriba: <b>INT. LUGAR – DÍA</b>.",
          "Cada escena que abres aquí <b>aparece también en la escaleta</b>, con su duración. Son el mismo proyecto visto de dos formas.",
          "La regla del oficio: <b>una página ≈ un minuto</b> de pantalla. Arriba te digo cuánto llevas.",
        ]} />
      </div>

      {/* La página */}
      {/* La página. El margen IZQUIERDO es más ancho: es el de encuadernación
          del formato (1.5" a la izquierda, 1" a la derecha, ahí van las
          perforaciones) y es también el que le da lugar a las etiquetas de
          tipo. Con el margen angosto de antes, ACCIÓN y TRANSICIÓN se salían
          de la hoja y caían sobre la pared: en modo oscuro, tinta oscura
          sobre negro. Ahora las cinco etiquetas caen sobre el papel. */}
      <div className="rounded-xl py-8 shadow-sm"
        style={{ ...PAPEL, border: `1px solid ${LINEA_PAPEL}`,
          paddingLeft: "clamp(84px, 11%, 118px)", paddingRight: "clamp(28px, 7%, 76px)" }}>
        {!escenas.length && (
          <p className="m-0 text-center text-sm" style={{ color: TINTA_PAPEL_BAJA }}>
            Todavía no hay escenas. Empieza la primera aquí abajo.
          </p>
        )}

        {escenas.map((esc, i) => (
          <section key={esc.id} id={`esc-${esc.id}`} className="mb-7" style={{ scrollMarginTop: 12 }}>
            {/* Encabezado de escena */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: TINTA_PAPEL_BAJA, minWidth: 22 }}>{i + 1}</span>
              <input
                value={esc.encabezado || ""}
                disabled={!editable}
                onFocus={() => setActiva(esc.id)}
                onChange={(e) => upEscena(esc.id, { encabezado: e.target.value.toUpperCase() })}
                onBlur={(e) => upEscena(esc.id, { encabezado: normalizarEncabezado(e.target.value) })}
                placeholder="INT. LUGAR – DÍA"
                className="w-full border-0 bg-transparent py-1 text-sm font-bold outline-none"
                style={{ fontFamily: PAPEL.fontFamily, letterSpacing: 0.5, color: TINTA_PAPEL }}
              />
              <span className="no-print text-xs" style={{ color: TINTA_PAPEL_BAJA, whiteSpace: "nowrap" }}>{fmt(esc.dur || 0)}</span>
              {editable && escenas.length > 1 && (
                <button type="button" onClick={() => borrarEscena(esc.id)} title="Borrar esta escena"
                  className="no-print grid h-6 w-6 place-items-center rounded" style={{ color: "var(--hoja-borrar)", background: "var(--hoja)" }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <div style={{ height: 1, background: LINEA_PAPEL, margin: "2px 0 10px" }} />

            {/* Cuerpo del guion */}
            {guionDe(esc).map((b) => {
              const t = TIPOS[b.tipo] || TIPOS.accion;
              return (
                <div key={b.id} style={{ position: "relative", marginLeft: `${t.sangria}%`, width: `${t.ancho}%` }}>
                  {/* Capa del marcatextos: una copia EXACTA del texto, con el
                      color de fondo en los trozos marcados. Va detrás del área
                      de escritura, que es transparente, así que el resaltado
                      queda justo debajo de las mismas letras. */}
                  {(b.marcas || []).length > 0 && (
                    <div aria-hidden="true" style={{ ...tipografia(b, t), position: "absolute", inset: 0, color: "transparent", pointerEvents: "none", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                      {trozosMarcados(b.texto, b.marcas).map((tr, i) => (
                        <span key={i} style={tr.color ? { background: `var(--marca-${tr.color})`, borderRadius: 2 } : undefined}>{tr.texto}</span>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={(el) => { areas.current[b.id] = el; acomoda(el); }}
                    rows={1}
                    value={b.texto}
                    disabled={!editable}
                    placeholder={t.nombre}
                    onChange={(e) => { acomoda(e.target); escribe(esc, b, t.mayus ? e.target.value.toUpperCase() : e.target.value); }}
                    onKeyDown={(e) => teclas(e, esc, b)}
                    onFocus={(e) => { acomoda(e.target); setActiva(esc.id); setEnfocado({ escenaId: esc.id, bloqueId: b.id }); }}
                    className="w-full resize-none border-0 bg-transparent outline-none"
                    style={{ ...tipografia(b, t), position: "relative", background: "transparent", overflow: "hidden" }}
                  />
                  {/* Etiqueta del tipo, solo en el bloque enfocado */}
                  {/* Etiqueta del tipo: cada uno con su color, porque en gris
                      claro se perdían y no se distinguía acción de diálogo. */}
                  <span className="no-print" style={{
                    position: "absolute", left: -74, top: 8, fontSize: 9.5, fontWeight: 800,
                    letterSpacing: 0.7, textTransform: "uppercase", color: `var(--tipo-${b.tipo}, ${t.color})`,
                    fontFamily: "system-ui, sans-serif", pointerEvents: "none",
                  }}>{t.nombre}</span>

                  {sugiere?.bloqueId === b.id && (
                    <div className="no-print" style={{
                      position: "absolute", zIndex: 5, left: 0, top: "100%",
                      background: "var(--hoja-alza)", border: `1px solid ${LINEA_PAPEL}`, borderRadius: 8,
                      boxShadow: "0 8px 20px rgba(12,28,48,.14)", overflow: "hidden",
                    }}>
                      {sugiere.opciones.map((op) => (
                        <button key={op} type="button"
                          onMouseDown={(e) => { e.preventDefault(); upBloque(esc.id, b.id, { texto: op }); setSugiere(null); }}
                          className="block w-full px-3 py-1.5 text-left text-xs font-bold"
                          style={{ fontFamily: "system-ui, sans-serif", color: TINTA_PAPEL }}>
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
                style={{ background: "var(--hoja-hueco)", color: TINTA_PAPEL, fontFamily: "system-ui, sans-serif" }}>
                <Plus size={13} /> Escena nueva aquí
              </button>
            )}
          </section>
        ))}

        {editable && !escenas.length && (
          <button type="button" onClick={() => agregarEscena(null)}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold text-white"
            style={{ background: "var(--gel-f)", fontFamily: "system-ui, sans-serif" }}>
            <Plus size={15} /> Empezar la primera escena
          </button>
        )}
      </div>
      </div>

      {/* Datos de la escena donde está el cursor. Son los mismos campos de la
          escaleta: aquí se llenan sin salir del guion, y llenan el espacio que
          antes se quedaba vacío en pantallas grandes. */}
      <aside className="no-print hidden 2xl:block">
        {(() => {
          const esc = escenas.find((e) => e.id === activa) || escenas[0];
          if (!esc) return null;
          const i = escenas.indexOf(esc);
          const campo = (etiqueta, valor, alPoner, placeholder) => (
            <label className="block text-xs font-bold uppercase" style={{ color: "var(--tinta-media)", letterSpacing: 0.6 }}>
              {etiqueta}
              <input value={valor || ""} disabled={!editable} placeholder={placeholder}
                onChange={(e) => alPoner(e.target.value)}
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm font-normal normal-case"
                style={{ borderColor: "var(--vidrio-borde)", background: "var(--hueco-fondo)", color: "var(--tinta)", fontFamily: "system-ui, sans-serif" }} />
            </label>
          );
          return (
            <div className="sticky top-2 flex flex-col gap-3 rounded-xl p-3" style={{ background: "var(--vidrio-a)", border: "1px solid var(--vidrio-borde)" }}>
              <div className="text-xs font-bold uppercase" style={{ color: "var(--tinta)", letterSpacing: 1 }}>
                Escena {i + 1}
              </div>
              {campo("Nombre del bloque", esc.segmento, (v) => upEscena(esc.id, { segmento: v }), "1. Presente")}
              {campo("Duración", fmt(esc.dur || 0), (v) => upEscena(esc.id, { dur: parseDur(v) }), "01:00")}
              {campo("Función en la historia", esc.funcion, (v) => upEscena(esc.id, { funcion: v }), "Presenta el mundo")}
              {campo("¿Qué cambia aquí?", esc.cambio, (v) => upEscena(esc.id, { cambio: v }), "Lo que ya no vuelve a ser igual")}
              {campo("Personajes", esc.personajes, (v) => upEscena(esc.id, { personajes: v }), "Doña Rosa, Marco")}
              <p className="m-0 text-xs" style={{ color: "var(--tinta-media)", lineHeight: 1.45 }}>
                Son los mismos campos de la escaleta: lo que escribas aquí aparece allá.
              </p>
            </div>
          );
        })()}
      </aside>
      </div>
    </div>
  );
}

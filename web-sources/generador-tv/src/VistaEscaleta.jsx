import React, { useMemo, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { MOVIMIENTOS, PLANOS } from "./catalogos.js";
import { computeBloques, computeFuentes, computeRows } from "./escaleta.js";
import { EscaletaEditor } from "./EscaletaEditor.jsx";
import { MetaDuracion } from "./MetaDuracion.jsx";
import { Escaleta, Timeline } from "./EscaletaVistas.jsx";
import { RundownCues } from "./RundownCues.jsx";
import { esNarrativo } from "./proyecto.js";
import { INK, NAVY } from "./theme.js";
import { Box, TarjetaAyuda, btn, inp, inpStyle } from "./ui.jsx";
import { fmt, trunc, uid } from "./util.js";
import { SelectorDeReferencia, useFichasDelTablero } from "./MesaDeLuz.jsx";

// Reduce una imagen a un cuadro de storyboard ligero (JPEG de 480px de ancho):
// las imágenes viven en base64 dentro del proyecto y sin esta reducción
// inflarían localStorage y los .ptv.
const leerImagenStoryboard = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const w = 480;
    const h = Math.max(1, Math.round((img.height / img.width) * w) || 270);
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    resolve(cv.toDataURL("image/jpeg", 0.8));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
  img.src = url;
});

// Pestaña "Escaleta / Rundown": ¿qué pasa primero, qué pasa después y cuánto dura?

export function VistaEscaleta({ cfg, setCfg }) {
  const editable = typeof setCfg === "function";
  const narr = esNarrativo(cfg);
  const fuentes = useMemo(() => computeFuentes(cfg), [cfg]);
  const byId = useMemo(() => Object.fromEntries(fuentes.map((f) => [f.id, f])), [fuentes]);
  const rows = useMemo(() => computeRows(cfg), [cfg]);
  const total = rows.length ? rows[rows.length - 1].tout : 0;
  const bloques = useMemo(() => computeBloques(rows, byId), [rows, byId]);
  const [sub, setSub] = useState(esNarrativo(cfg) ? "guion" : "escaleta");
  /* El tablero de la mesa de luz: las imágenes que definen el look de ESTE
     proyecto. Si está vacío, el storyboard se ve exactamente como antes —la
     columna de referencia no aparece— para no cobrarle una casilla vacía a
     quien todavía no usa la mesa. */
  const delTablero = useFichasDelTablero(cfg);
  const refPorId = useMemo(() => Object.fromEntries(delTablero.map((f) => [f.id, f])), [delTablero]);
  const [eligiendo, setEligiendo] = useState(null); // {segId, tomaId, valor}
  // El asistente (narrativo o en vivo) ya no vive aquí: se movió al nivel raíz
  // del generador y se abre desde la barra o al crear el proyecto.

  const upSeg = (segId, patch) => setCfg((c) => ({ ...c, escaleta: c.escaleta.map((s) => (s.id === segId ? { ...s, ...patch } : s)) }));
  const upToma = (segId, tomaId, patch) => setCfg((c) => ({
    ...c,
    escaleta: c.escaleta.map((s) => (s.id === segId ? { ...s, tomas: (s.tomas || []).map((t) => (t.id === tomaId ? { ...t, ...patch } : t)) } : s)),
  }));
  const addToma = (segId) => setCfg((c) => ({
    ...c,
    escaleta: c.escaleta.map((s) => (s.id === segId
      ? { ...s, tomas: [...(s.tomas || []), { id: uid(), camId: c.camaras[0]?.id || "", plano: "Plano Medio", mov: "Fija", audio: "", texto: "", imagen: "" }] }
      : s)),
  }));
  const delToma = (segId, tomaId) => setCfg((c) => ({
    ...c,
    escaleta: c.escaleta.map((s) => (s.id === segId ? { ...s, tomas: (s.tomas || []).filter((t) => t.id !== tomaId) } : s)),
  }));

  const camDe = (id) => cfg.camaras.find((x) => x.id === id) || null;
  const totalTomas = rows.reduce((n, s) => n + (s.tomas || []).length, 0);

  /* EL STORYBOARD DIBUJA PLANOS, NO CUES. En narrativo cada toma ES un plano y
     no hay nada que filtrar. En vivo, el desglose técnico de un segmento son
     cues de todo tipo —gráfico, comercial, audio, instrucción del director— y
     solo los de CÁMARA son algo que se pueda dibujar. Sin este filtro el
     storyboard salía lleno de cuadros vacíos de cosas que no se ven, y por eso
     no servía para nada en vivo.
     El número se conserva del rundown (la posición entre TODOS los cues) para
     que 3.2 aquí sea el mismo 3.2 de allá. */
  const cuadrosDe = (s) => (s.tomas || [])
    .map((t, i) => ({ t, n: i + 1 }))
    .filter(({ t }) => narr || (t.tipo || "camara") === "camara");
  const totalCuadros = rows.reduce((n, s) => n + cuadrosDe(s).length, 0);
  const subTab = (id, label) => (
    <button key={id} onClick={() => setSub(id)} className="rounded-md px-3 py-1.5 text-sm font-bold"
      /* Mesa de trabajo, no papel: sigue al tema entero. En claro se ve igual que
            antes; en oscuro dejaba una pastilla blanca encima de la app apagada. */
        style={sub === id
          ? { background: "var(--vidrio-a)", color: "var(--tinta)", boxShadow: "0 1px 3px rgba(0,0,0,.15)" }
          : { color: "var(--tinta-media)" }}>
      {label}
    </button>
  );

  // Fila del guion técnico: qué toma, con qué cámara, qué plano y movimiento,
  // qué se escucha y qué se dice — el desglose clásico por columnas.
  const gtCols = "34px 140px minmax(150px,1fr) 150px minmax(120px,1fr) minmax(170px,1.4fr) 30px";

  return (
    <div className="scrollwrap overflow-auto px-2 py-4">
      <div className="vista-foco mx-auto flex flex-col gap-3" style={{ width: "100%", padding: 16 }}>
        {/* Las sugerencias de plano y movimiento: las usan el guion técnico y el
            storyboard, así que viven aquí arriba y no dentro de una pestaña. */}
        <datalist id="gt-planos">{PLANOS.map((p) => <option key={p} value={p} />)}</datalist>
        <datalist id="gt-movs">{MOVIMIENTOS.map((m) => <option key={m} value={m} />)}</datalist>
        <div className="no-print mx-auto flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--ui-franja)" }}>
          {!narr && subTab("escaleta", "≡ Escaleta editorial")}
          {subTab("guion", narr ? "✎ Guion técnico" : "✎ Rundown técnico")}
          {subTab("storyboard", "▦ Storyboard")}
          {editable && (
            <span className="ml-2">
              {narr ? (
                <TarjetaAyuda id="escaleta-narr" titulo="Cómo escribir tu escaleta narrativa"
                  pasos={[
                    "Las escenas se escriben en <b>Guion literario</b> (la sección anterior): ahí van encabezado, acción y diálogos. Aquí se desglosan.",
                    "<b>Guion técnico</b>: cada escena se parte en planos — tamaño, ángulo, movimiento y sonido.",
                    "<b>Storyboard</b>: la vista visual de cada plano con su imagen y notas.",
                    "La duración de cada escena se ajusta en el guion literario o en la barra de arriba.",
                  ]} />
              ) : (
                <TarjetaAyuda id="escaleta-live" titulo="Cómo escribir tu escaleta editorial"
                  pasos={[
                    "Empieza por los bloques: agrega uno con <b>＋ Agregar segmento</b> y escribe qué contenido va ahí. Puedes agregar, borrar y reordenar cuando quieras.",
                    "<b>Escaleta editorial</b>: qué contenido ocurre en cada bloque y su función (objetivo, participantes, recursos). La señal al aire NO va aquí.",
                    "<b>Rundown técnico</b>: la parte técnica — cada segmento se desglosa en cues (cámara al aire, audio, gráficos, instrucción).",
                    "La duración total, IN y OUT se recalculan solos mientras editas.",
                  ]} />
              )}
            </span>
          )}
        </div>
        <MetaDuracion cfg={cfg} setCfg={setCfg} total={total} editable={editable} />

        {cfg.narrativa?.logline && (
          <p className="m-0 text-center text-sm italic text-slate-500">{cfg.narrativa.logline}</p>
        )}

        {sub === "escaleta" && !narr && (<>
          <Box title={narr ? `Escaleta narrativa — ${rows.length} escena${rows.length === 1 ? "" : "s"} · ${fmt(total)}` : `Escaleta editorial — ${fmt(total)}`}>
            {editable
              ? <EscaletaEditor cfg={cfg} setCfg={setCfg} rows={rows} editable={editable} fuentes={fuentes} />
              : <Escaleta rows={rows} byId={byId} total={total} />}
          </Box>
          {!narr && (
            <Box title={`Línea de tiempo — ${fmt(total)}`}>
              <Timeline rows={rows} byId={byId} total={total} bloques={bloques} />
            </Box>
          )}
        </>)}

        {sub === "guion" && (
          <Box title={narr
            ? `Guion técnico — ${totalTomas} plano${totalTomas === 1 ? "" : "s"} en ${rows.length} escena${rows.length === 1 ? "" : "s"}`
            : `Rundown técnico — ${totalTomas} cue${totalTomas === 1 ? "" : "s"} en ${rows.length} segmento${rows.length === 1 ? "" : "s"}`}>
            {!narr && <RundownCues cfg={cfg} setCfg={setCfg} rows={rows} fuentes={fuentes} editable={editable} onOpenEscaleta={() => setSub("escaleta")} />}
            {narr && rows.map((s) => {
              const fuente = byId[s.fuente];
              return (
                <div key={s.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "#C8D2DE" }}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ background: "var(--vidrio-b)" }}>
                    <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: NAVY }}>{s.idx}</span>
                    <b className="text-sm" style={{ color: INK }}>{s.segmento}</b>
                    <span className="text-xs text-slate-500">{fmt(s.tin)} → {fmt(s.tout)} · {fmt(s.dur)}</span>
                    {fuente && <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: fuente.color }}>{fuente.nombre}</span>}
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    <textarea className={inp} style={inpStyle} rows={2} disabled={!editable}
                      placeholder="Guion / narración del segmento (este texto es el que corre en el teleprompter)"
                      value={s.nota || ""} onChange={(e) => upSeg(s.id, { nota: e.target.value })} />
                    {(s.tomas || []).length > 0 && (
                      <div className="grid gap-1 text-xs font-bold uppercase text-slate-500" style={{ gridTemplateColumns: gtCols }}>
                        <span>#</span><span>{narr ? "Cámara" : "Al aire"}</span><span>{narr ? "Plano" : "Encuadre"}</span><span>Movimiento</span><span>Audio</span><span>{narr ? "Texto / diálogo" : "Instrucción"}</span><span />
                      </div>
                    )}
                    {(s.tomas || []).map((t, i) => (
                      <div key={t.id} className="grid items-center gap-1" style={{ gridTemplateColumns: gtCols }}>
                        <span className="text-sm font-bold text-slate-500">{s.idx}.{i + 1}</span>
                        <select className={inp} style={inpStyle} disabled={!editable} value={t.camId || ""}
                          onChange={(e) => upToma(s.id, t.id, { camId: e.target.value })}>
                          <option value="">— sin cámara —</option>
                          {cfg.camaras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <input className={inp} style={inpStyle} disabled={!editable} list="gt-planos" placeholder="Plano"
                          value={t.plano || ""} onChange={(e) => upToma(s.id, t.id, { plano: e.target.value })} />
                        <input className={inp} style={inpStyle} disabled={!editable} list="gt-movs" placeholder="Movimiento"
                          value={t.mov || ""} onChange={(e) => upToma(s.id, t.id, { mov: e.target.value })} />
                        <input className={inp} style={inpStyle} disabled={!editable} placeholder="Mic, música, VTR…"
                          value={t.audio || ""} onChange={(e) => upToma(s.id, t.id, { audio: e.target.value })} />
                        <input className={inp} style={inpStyle} disabled={!editable} placeholder="Qué se dice o se ve en pantalla"
                          value={t.texto || ""} onChange={(e) => upToma(s.id, t.id, { texto: e.target.value })} />
                        {editable
                          ? <button onClick={() => delToma(s.id, t.id)} title="Quitar toma" className="justify-self-center text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
                          : <span />}
                      </div>
                    ))}
                    {editable && (
                      <button onClick={() => addToma(s.id)} className={`${btn} self-start border`} style={{ borderColor: "#C8D2DE", color: NAVY }}>
                        <Plus size={15} /> {narr ? "Agregar plano" : "Agregar cue"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {narr && !rows.length && <p className="text-sm text-slate-500">Todavía no hay escenas: escríbelas en <b>Guion literario</b> y aquí las desglosas en planos.</p>}
          </Box>
        )}

        {sub === "storyboard" && (
          <Box title={`Storyboard — ${totalCuadros} cuadro${totalCuadros === 1 ? "" : "s"}`}>
            {totalCuadros === 0 && (narr ? (
              <p className="text-sm text-slate-500">
                Todavía no hay planos: créalos en la sub-pestaña <b>Guion técnico</b> con <b>Agregar plano</b>, y cada uno tendrá aquí su cuadro.
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Todavía no hay planos: en <b>Rundown técnico</b> agrega cues de tipo <b>Cámara</b> — cada uno es un plano y tendrá aquí su cuadro.
                Los cues de gráfico, audio o comercial no se dibujan, por eso no aparecen.
              </p>
            ))}
            {rows.filter((s) => cuadrosDe(s).length).map((s) => (
              <div key={s.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: NAVY }}>{s.idx}</span>
                  <b className="text-sm" style={{ color: INK }}>{s.segmento}</b>
                </div>
                {/* Con referencia y cuadro lado a lado cada celda lleva dos
                    imágenes: a 215 px cada mitad quedaría en 105 y un plano no
                    se lee a ese tamaño. */}
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${delTablero.length ? 300 : 215}px, 1fr))` }}>
                  {cuadrosDe(s).map(({ t, n }) => {
                    // En vivo la cámara del cue vive en `alAire`, no en `camId`.
                    const cam = camDe(t.camId || t.alAire);
                    return (
                      <figure key={t.id} className="m-0 rounded-lg border overflow-hidden" style={{ background: "var(--vidrio-a)", borderColor: "var(--vidrio-borde)" }}>
                        {/* LA REFERENCIA Y EL CUADRO, UNO JUNTO AL OTRO. Solo
                            aparece si el proyecto tiene tablero o si este plano
                            ya tiene su referencia puesta. */}
                        {(delTablero.length > 0 || t.referencia) && (() => {
                          const ref = refPorId[t.referencia];
                          return (
                            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #C8D2DE" }}>
                              <button type="button" disabled={!editable}
                                onClick={() => editable && setEligiendo({ segId: s.id, tomaId: t.id, valor: t.referencia || "" })}
                                title={editable ? "Elegir a qué se tiene que parecer este plano" : undefined}
                                className="relative block border-0 p-0"
                                style={{ aspectRatio: "16/9", background: "#EEF2F7", cursor: editable ? "pointer" : "default" }}>
                                {ref?.min
                                  ? <img src={ref.min} alt="Referencia" className="h-full w-full object-cover" />
                                  : <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-bold text-slate-400">
                                      {t.referencia ? "referencia fuera del tablero" : (editable ? "elegir referencia" : "—")}
                                    </span>}
                                <span className="absolute left-0 top-0 px-1 text-[9px] font-bold uppercase tracking-wide"
                                  style={{ background: "rgba(15,15,20,.6)", color: "#fff" }}>referencia</span>
                              </button>
                              <label className="relative block" title={editable ? "Clic para subir tu cuadro" : undefined}
                                style={{ aspectRatio: "16/9", background: "#EEF2F7", borderLeft: "1px solid #C8D2DE", cursor: editable ? "pointer" : "default" }}>
                                {t.imagen
                                  ? <img src={t.imagen} alt={`Toma ${s.idx}.${n}`} className="h-full w-full object-cover" />
                                  : <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-bold text-slate-400">
                                      {editable ? "subir tu cuadro" : "—"}
                                    </span>}
                                <span className="absolute left-0 top-0 px-1 text-[9px] font-bold uppercase tracking-wide"
                                  style={{ background: "rgba(15,15,20,.6)", color: "#fff" }}>tu cuadro</span>
                                {editable && (
                                  <input type="file" accept="image/*" hidden
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!f) return;
                                      try { upToma(s.id, t.id, { imagen: await leerImagenStoryboard(f) }); } catch {}
                                    }} />
                                )}
                              </label>
                            </div>
                          );
                        })()}
                        {!(delTablero.length > 0 || t.referencia) && (
                        <label className="relative block" title={editable ? "Clic para subir el cuadro (foto del boceto, referencia o captura)" : undefined}
                          style={{ aspectRatio: "16/9", background: "#EEF2F7", cursor: editable ? "pointer" : "default" }}>
                          {t.imagen ? (
                            <img src={t.imagen} alt={`Toma ${s.idx}.${n}`} className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                              <Camera size={22} />
                              <span className="px-2 text-center text-xs font-bold">{t.plano || "Sin plano"}</span>
                              {editable && <span className="text-[10px]">Clic para subir imagen</span>}
                            </span>
                          )}
                          {editable && (
                            <input type="file" accept="image/*" hidden
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (!f) return;
                                try { upToma(s.id, t.id, { imagen: await leerImagenStoryboard(f) }); } catch {}
                              }} />
                          )}
                        </label>
                        )}
                        <figcaption className="px-2 py-1.5 text-xs" style={{ color: INK }}>
                          {/* EL PLANO SE ESCRIBE AQUÍ MISMO. Antes solo se leía, y en vivo
                              no había ningún sitio a mano donde ponerlo: estaba escondido
                              dentro del editor lateral del cue. Con el cuadro delante es
                              donde de verdad se decide "esto es un primer plano". */}
                          <div className="flex items-center gap-1.5">
                            <b>{s.idx}.{n}</b>
                            {editable ? (
                              <input className={inp} style={{ ...inpStyle, padding: "1px 6px" }} list="gt-planos"
                                placeholder={narr ? "Plano" : "Encuadre"} value={t.plano || ""}
                                onChange={(ev) => upToma(s.id, t.id, { plano: ev.target.value })} />
                            ) : <span>{t.plano || "—"}</span>}
                          </div>
                          <div className="mt-0.5">{cam ? cam.nombre : "sin cámara"}{t.mov ? ` · ${t.mov}` : ""}</div>
                          {t.texto && <div className="mt-0.5 text-slate-500">“{trunc(t.texto, 80)}”</div>}
                          {editable && t.imagen && (
                            <button onClick={() => upToma(s.id, t.id, { imagen: "" })} className="mt-1 text-[10px] font-bold text-slate-400 hover:text-red-600">
                              Quitar imagen
                            </button>
                          )}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </div>
            ))}
          </Box>
        )}
      </div>
      {eligiendo && (
        <SelectorDeReferencia fichas={delTablero} valor={eligiendo.valor}
          onElegir={(id) => upToma(eligiendo.segId, eligiendo.tomaId, { referencia: id })}
          onCerrar={() => setEligiendo(null)} />
      )}
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { MOVIMIENTOS, PLANOS } from "./catalogos.js";
import { computeBloques, computeFuentes, computeRows } from "./escaleta.js";
import { EscaletaEditor } from "./EscaletaEditor.jsx";
import { MetaDuracion } from "./MetaDuracion.jsx";
import { Escaleta, Timeline } from "./EscaletaVistas.jsx";
import { RundownCues } from "./RundownCues.jsx";
import { leerImagenStoryboard } from "./imagenesStoryboard.js";
import { esNarrativo } from "./proyecto.js";
import { crearPlanoNuevoPorModo } from "./tomas.js";
import { Box, btn, inp, inpStyle } from "./ui.jsx";
import { fmt, trunc } from "./util.js";
import { SelectorDeReferencia, useFichasDelTablero } from "./MesaDeLuz.jsx";

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
      ? { ...s, tomas: [...(s.tomas || []), crearPlanoNuevoPorModo(c, c.camaras[0]?.id)] }
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
    <button key={id} onClick={() => setSub(id)}
      className={`escaleta-subtab rounded-md px-3 py-1.5 text-sm font-bold${sub === id ? " active" : ""}`}>
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
        <div className="escaleta-subtabs no-print mx-auto flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--ui-franja)" }}>
          {!narr && subTab("escaleta", "≡ Escaleta editorial")}
          {subTab("guion", narr ? "✎ Guion técnico" : "✎ Rundown técnico")}
          {subTab("storyboard", "▦ Storyboard")}
        </div>
        <MetaDuracion cfg={cfg} setCfg={setCfg} total={total} editable={editable} />

        {cfg.narrativa?.logline && (
          <p className="gt-meta m-0 text-center text-sm italic">{cfg.narrativa.logline}</p>
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
                <div key={s.id} className="gt-escena rounded-lg border overflow-hidden">
                  <div className="gt-escena-cab flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="gt-indice rounded-md px-2 py-0.5 text-xs font-bold">{s.idx}</span>
                    <b className="gt-titulo text-sm">{s.segmento}</b>
                    <span className="gt-meta text-xs">{fmt(s.tin)} → {fmt(s.tout)} · {fmt(s.dur)}</span>
                    {fuente && <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: fuente.color }}>{fuente.nombre}</span>}
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    <textarea className={inp} style={inpStyle} rows={2} disabled={!editable}
                      placeholder="Guion / narración del segmento (este texto es el que corre en el teleprompter)"
                      value={s.nota || ""} onChange={(e) => upSeg(s.id, { nota: e.target.value })} />
                    {(s.tomas || []).length > 0 && (
                      <div className="gt-columnas grid gap-1 text-xs font-bold uppercase" style={{ gridTemplateColumns: gtCols }}>
                        <span>#</span><span>{narr ? "Cámara" : "Al aire"}</span><span>{narr ? "Plano" : "Encuadre"}</span><span>Movimiento</span><span>Audio</span><span>{narr ? "Texto / diálogo" : "Instrucción"}</span><span />
                      </div>
                    )}
                    {(s.tomas || []).map((t, i) => (
                      <div key={t.id} className="grid items-center gap-1" style={{ gridTemplateColumns: gtCols }}>
                        <span className="gt-meta text-sm font-bold">{s.idx}.{i + 1}</span>
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
                          ? <button onClick={() => delToma(s.id, t.id)} title="Quitar toma" className="gt-icon justify-self-center"><Trash2 size={15} /></button>
                          : <span />}
                      </div>
                    ))}
                    {editable && (
                      <button onClick={() => addToma(s.id)} className={`${btn} gt-agregar self-start border`}>
                        <Plus size={15} /> {narr ? "Agregar plano" : "Agregar cue"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {narr && !rows.length && <p className="gt-meta text-sm">Todavía no hay escenas: escríbelas en <b>Guion literario</b> y aquí las desglosas en planos.</p>}
          </Box>
        )}

        {sub === "storyboard" && (
          <Box title={`Storyboard — ${totalCuadros} cuadro${totalCuadros === 1 ? "" : "s"}`}>
            {totalCuadros === 0 && (narr ? (
              <p className="gt-meta text-sm">
                Todavía no hay planos: créalos en la sub-pestaña <b>Guion técnico</b> con <b>Agregar plano</b>, y cada uno tendrá aquí su cuadro.
              </p>
            ) : (
              <p className="gt-meta text-sm">
                Todavía no hay planos: en <b>Rundown técnico</b> agrega cues de tipo <b>Cámara</b> — cada uno es un plano y tendrá aquí su cuadro.
                Los cues de gráfico, audio o comercial no se dibujan, por eso no aparecen.
              </p>
            ))}
            {rows.filter((s) => cuadrosDe(s).length).map((s) => (
              <div key={s.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="gt-indice rounded-md px-2 py-0.5 text-xs font-bold">{s.idx}</span>
                  <b className="gt-titulo text-sm">{s.segmento}</b>
                </div>
                {/* Con referencia y cuadro lado a lado cada celda lleva dos
                    imágenes: a 215 px cada mitad quedaría en 105 y un plano no
                    se lee a ese tamaño. */}
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${delTablero.length ? 300 : 215}px, 1fr))` }}>
                  {cuadrosDe(s).map(({ t, n }) => {
                    // En vivo la cámara del cue vive en `alAire`, no en `camId`.
                    const cam = camDe(narr ? t.camId : t.alAire);
                    return (
                      <figure key={t.id} className="m-0 rounded-lg border overflow-hidden" style={{ background: "var(--vidrio-a)", borderColor: "var(--vidrio-borde)" }}>
                        {/* LA REFERENCIA Y EL CUADRO, UNO JUNTO AL OTRO. Solo
                            aparece si el proyecto tiene tablero o si este plano
                            ya tiene su referencia puesta. */}
                        {(delTablero.length > 0 || t.referencia) && (() => {
                          const ref = refPorId[t.referencia];
                          return (
                            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--ui-linea)" }}>
                              <button type="button" disabled={!editable}
                                onClick={() => editable && setEligiendo({ segId: s.id, tomaId: t.id, valor: t.referencia || "" })}
                                title={editable ? "Elegir a qué se tiene que parecer este plano" : undefined}
                                className="story-media relative block border-0 p-0"
                                style={{ aspectRatio: "16/9", cursor: editable ? "pointer" : "default" }}>
                                {ref?.min
                                  ? <img src={ref.min} alt="Referencia" className="h-full w-full object-cover" />
                                  : <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-bold text-slate-400">
                                      {t.referencia ? "referencia fuera del tablero" : (editable ? "elegir referencia" : "—")}
                                    </span>}
                                <span className="absolute left-0 top-0 px-1 text-[9px] font-bold uppercase tracking-wide"
                                  style={{ background: "rgba(15,15,20,.6)", color: "#fff" }}>referencia</span>
                              </button>
                              <label className="story-media relative block" title={editable ? "Clic para subir tu cuadro" : undefined}
                                style={{ aspectRatio: "16/9", borderLeft: "1px solid var(--ui-linea)", cursor: editable ? "pointer" : "default" }}>
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
                        <label className="story-media relative block" title={editable ? "Clic para subir el cuadro (foto del boceto, referencia o captura)" : undefined}
                          style={{ aspectRatio: "16/9", cursor: editable ? "pointer" : "default" }}>
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
                        <figcaption className="story-caption px-2 py-1.5 text-xs">
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
                          {t.texto && <div className="gt-meta mt-0.5">“{trunc(t.texto, 80)}”</div>}
                          {editable && t.imagen && (
                            <button onClick={() => upToma(s.id, t.id, { imagen: "" })} className="gt-icon mt-1 text-[10px] font-bold">
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

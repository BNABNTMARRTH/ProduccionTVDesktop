import React, { useMemo, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { MOVIMIENTOS, PLANOS } from "./catalogos.js";
import { computeBloques, computeFuentes, computeRows } from "./escaleta.js";
import { EscaletaEditor } from "./EscaletaEditor.jsx";
import { Escaleta, Timeline } from "./EscaletaVistas.jsx";
import { RundownCues } from "./RundownCues.jsx";
import { esNarrativo } from "./proyecto.js";
import { INK, NAVY } from "./theme.js";
import { Box, TarjetaAyuda, btn, inp, inpStyle } from "./ui.jsx";
import { fmt, trunc, uid } from "./util.js";

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
  const [sub, setSub] = useState("escaleta");
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
  const subTab = (id, label) => (
    <button key={id} onClick={() => setSub(id)} className="rounded-md px-3 py-1.5 text-sm font-bold"
      style={sub === id ? { background: "#fff", color: NAVY, boxShadow: "0 1px 3px rgba(0,0,0,.15)" } : { color: "#475569" }}>
      {label}
    </button>
  );

  // Fila del guion técnico: qué toma, con qué cámara, qué plano y movimiento,
  // qué se escucha y qué se dice — el desglose clásico por columnas.
  const gtCols = "34px 140px minmax(150px,1fr) 150px minmax(120px,1fr) minmax(170px,1.4fr) 30px";

  return (
    <div className="scrollwrap overflow-auto px-2 py-4">
      <div className="vista-foco mx-auto flex flex-col gap-3 bg-white shadow-lg" style={{ width: 1240, maxWidth: "100%", padding: 16, borderRadius: 8 }}>
        <div className="no-print mx-auto flex items-center gap-1 rounded-lg p-1" style={{ background: "#E2E8F0" }}>
          {subTab("escaleta", narr ? "≡ Escaleta" : "≡ Escaleta editorial")}
          {subTab("guion", narr ? "✎ Guion técnico" : "✎ Rundown técnico")}
          {subTab("storyboard", "▦ Storyboard")}
          {editable && (
            <span className="ml-2">
              {narr ? (
                <TarjetaAyuda id="escaleta-narr" titulo="Cómo escribir tu escaleta narrativa"
                  pasos={[
                    "Empieza por lo que pasa: agrega una escena con <b>＋ Agregar escena</b> y descríbela. Puedes agregar, borrar y reordenar cuando quieras.",
                    "<b>Escaleta</b>: qué ocurre en cada escena y cómo avanza la historia (encabezado, acción, función, cambio). Sin cámaras ni lentes: eso va en el guion técnico.",
                    "<b>Guion técnico</b>: desglosa cada escena en planos (tamaño, ángulo, movimiento, sonido).",
                    "<b>Storyboard</b>: la vista visual de cada plano con su imagen y notas.",
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
        {cfg.narrativa?.logline && (
          <p className="m-0 text-center text-sm italic text-slate-500">{cfg.narrativa.logline}</p>
        )}

        {sub === "escaleta" && (<>
          <Box title={narr ? `Escaleta narrativa — ${rows.length} escena${rows.length === 1 ? "" : "s"} · ${fmt(total)}` : `Escaleta editorial — ${fmt(total)}`}>
            {editable
              ? <EscaletaEditor cfg={cfg} setCfg={setCfg} rows={rows} editable={editable} />
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
            {narr && <datalist id="gt-planos">{PLANOS.map((p) => <option key={p} value={p} />)}</datalist>}
            {narr && <datalist id="gt-movs">{MOVIMIENTOS.map((m) => <option key={m} value={m} />)}</datalist>}
            {narr && rows.map((s) => {
              const fuente = byId[s.fuente];
              return (
                <div key={s.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "#C8D2DE" }}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ background: "#F1F5F9" }}>
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
            {narr && !rows.length && <p className="text-sm text-slate-500">La escaleta está vacía: agrega escenas en la pestaña Escaleta.</p>}
          </Box>
        )}

        {sub === "storyboard" && (
          <Box title={`Storyboard — ${totalTomas} cuadro${totalTomas === 1 ? "" : "s"}`}>
            {totalTomas === 0 && (
              <p className="text-sm text-slate-500">
                Todavía no hay tomas: créalas en la sub-pestaña <b>Guion técnico</b> y cada una tendrá aquí su cuadro de storyboard.
              </p>
            )}
            {rows.filter((s) => (s.tomas || []).length).map((s) => (
              <div key={s.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: NAVY }}>{s.idx}</span>
                  <b className="text-sm" style={{ color: INK }}>{s.segmento}</b>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))" }}>
                  {(s.tomas || []).map((t, i) => {
                    const cam = camDe(t.camId);
                    return (
                      <figure key={t.id} className="m-0 rounded-lg border overflow-hidden bg-white" style={{ borderColor: "#C8D2DE" }}>
                        <label className="relative block" title={editable ? "Clic para subir el cuadro (foto del boceto, referencia o captura)" : undefined}
                          style={{ aspectRatio: "16/9", background: "#EEF2F7", cursor: editable ? "pointer" : "default" }}>
                          {t.imagen ? (
                            <img src={t.imagen} alt={`Toma ${s.idx}.${i + 1}`} className="h-full w-full object-cover" />
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
                        <figcaption className="px-2 py-1.5 text-xs" style={{ color: INK }}>
                          <b>{s.idx}.{i + 1}</b> · {t.plano || "—"} · {cam ? cam.nombre : "sin cámara"}{t.mov ? ` · ${t.mov}` : ""}
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
    </div>
  );
}

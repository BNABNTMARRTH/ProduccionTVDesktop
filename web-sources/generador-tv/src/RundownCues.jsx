import React, { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2, X } from "lucide-react";
import { CUE_ESTADO, CUE_ESTADOS, CUE_TIPO, CUE_TIPOS, TRANSICIONES } from "./catalogos.js";
import { INK, NAVY } from "./theme.js";
import { btn } from "./ui.jsx";
import { fmt, uid } from "./util.js";

/* ------------------------------- Rundown técnico (cues) -------------------------------
El rundown descompone cada segmento editorial en cues técnicos: una acción
concreta (cámara al aire, cambio de audio, gráfico, VTR, comercial…) con su
duración, estado y color por tipo. Es la capa técnica del modo en vivo. */

const parseMMSS = (txt) => {
  const m = String(txt).match(/^(\d+):(\d{1,2})$/);
  const s = m ? Number(m[1]) * 60 + Number(m[2]) : Number(txt);
  return Number.isFinite(s) && s >= 0 ? Math.round(s) : null;
};
const nuevoCue = (c, tipo = "camara") => {
  const cams = c.camaras || [];
  const corte = (c.extras || []).find((x) => x.esCorte);
  const base = { id: uid(), tipo, dur: 8, alAire: cams[0]?.id || "", previo: cams[1]?.id || "", transicion: "Corte", audio: "", grafico: "", texto: "", plano: "", estado: "borrador" };
  if (tipo === "grafico") return { ...base, grafico: "Lower third", texto: "Lanzar gráfico" };
  if (tipo === "comercial") return { ...base, alAire: corte?.id || base.alAire, dur: 30, texto: "Corte a comercial" };
  if (tipo === "cortinilla") return { ...base, dur: 10, texto: "Cortinilla" };
  if (tipo === "audio") return { ...base, texto: "Abrir micrófono" };
  if (tipo === "vtr") return { ...base, dur: 30, texto: "Lanzar VTR" };
  if (tipo === "instruccion") return { ...base, texto: "Instrucción del director" };
  return base;
};

export function RundownCues({ cfg, setCfg, rows, fuentes, editable, onOpenEscaleta }) {
  const [sel, setSel] = useState(null); // { segId, tomaId } → editor lateral
  const upToma = (segId, tomaId, patch) => setCfg((c) => ({
    ...c, escaleta: c.escaleta.map((s) => (s.id === segId ? { ...s, tomas: (s.tomas || []).map((t) => (t.id === tomaId ? { ...t, ...patch } : t)) } : s)),
  }));
  const addCue = (segId, tipo) => setCfg((c) => ({
    ...c, escaleta: c.escaleta.map((s) => (s.id === segId ? { ...s, tomas: [...(s.tomas || []), nuevoCue(c, tipo)] } : s)),
  }), { commit: true });
  const dupCue = (segId, tomaId) => setCfg((c) => ({
    ...c, escaleta: c.escaleta.map((s) => {
      if (s.id !== segId) return s;
      const i = (s.tomas || []).findIndex((t) => t.id === tomaId);
      if (i < 0) return s;
      const tomas = [...s.tomas]; tomas.splice(i + 1, 0, { ...tomas[i], id: uid() });
      return { ...s, tomas };
    }),
  }), { commit: true });
  const delCue = (segId, tomaId) => setCfg((c) => ({
    ...c, escaleta: c.escaleta.map((s) => (s.id === segId ? { ...s, tomas: (s.tomas || []).filter((t) => t.id !== tomaId) } : s)),
  }), { commit: true });
  const moveCue = (segId, i, dir) => setCfg((c) => ({
    ...c, escaleta: c.escaleta.map((s) => {
      if (s.id !== segId) return s;
      const t = [...(s.tomas || [])]; const j = i + dir;
      if (j < 0 || j >= t.length) return s;
      [t[i], t[j]] = [t[j], t[i]]; return { ...s, tomas: t };
    }),
  }), { commit: true });
  const setDur = (segId, tomaId, txt) => { const s = parseMMSS(txt); if (s != null) upToma(segId, tomaId, { dur: s }); };

  const cols = "48px minmax(100px,1fr) minmax(100px,1fr) minmax(90px,0.9fr) minmax(100px,1fr) minmax(130px,1.3fr) 54px 88px 64px";
  const heads = ["CUE", "AL AIRE", "PREVIO", "AUDIO", "GRÁFICO", "INSTRUCCIÓN", "DUR", "ESTADO", ""];
  const ei = "w-full rounded border px-1.5 py-1 text-xs";
  const eiS = { borderColor: "#D5DDE7", color: INK };
  const src = (val, onCh) => (
    <select className={ei} style={eiS} disabled={!editable} value={val || ""} onChange={(e) => onCh(e.target.value)}>
      <option value="">—</option>
      {fuentes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
    </select>
  );
  const estadoChip = (t, segId) => {
    const e = CUE_ESTADO[t.estado || "borrador"] || CUE_ESTADO.borrador;
    const avanzar = () => { const i = CUE_ESTADOS.findIndex((x) => x.id === (t.estado || "borrador")); upToma(segId, t.id, { estado: CUE_ESTADOS[(i + 1) % CUE_ESTADOS.length].id }); };
    return <button disabled={!editable} onClick={avanzar} title="Clic para cambiar el estado" className="w-full rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${e.color}22`, color: e.color, border: `1px solid ${e.color}` }}>{e.icon} {e.label}</button>;
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.map((s) => {
        const tomas = s.tomas || [];
        const sumCue = tomas.reduce((n, t) => n + (t.dur || 0), 0);
        const excede = sumCue > (s.dur || 0) + 0.5;
        let acc = 0;
        return (
          <div key={s.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "#C8D2DE" }}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ background: "#F1F5F9" }}>
              <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: NAVY }}>{s.idx}</span>
              <b className="text-sm" style={{ color: INK }}>{s.segmento}</b>
              <span className="text-xs text-slate-500">{fmt(s.tin)} → {fmt(s.tout)} · {fmt(s.dur)}</span>
              <span className="text-xs font-bold" style={{ color: excede ? "#DC2626" : "#64748B" }}>{tomas.length} cue{tomas.length === 1 ? "" : "s"} · Σ {fmt(sumCue)}{excede ? " ⚠ excede el segmento" : ""}</span>
              {editable && <button onClick={onOpenEscaleta} className="ml-auto text-xs font-bold" style={{ color: NAVY }}>Abrir escaleta editorial ↗</button>}
            </div>
            {(s.objetivo || s.participantes || s.recursos) && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 px-3 py-1.5 text-[11px] text-slate-500" style={{ borderBottom: "1px solid #EEF2F7" }}>
                {s.objetivo && <span><b>Objetivo:</b> {s.objetivo}</span>}
                {s.participantes && <span><b>Participantes:</b> {s.participantes}</span>}
                {s.recursos && <span><b>Recursos:</b> {s.recursos}</span>}
              </div>
            )}
            <div className="flex flex-col gap-1.5 p-3">
              {tomas.length > 0 && (
                <div className="grid gap-1 text-[10px] font-bold uppercase text-slate-500" style={{ gridTemplateColumns: cols }}>
                  {heads.map((h, i) => <span key={i} className={i >= 6 ? "text-center" : ""}>{h}</span>)}
                </div>
              )}
              {tomas.map((t, i) => {
                const tipo = CUE_TIPO[t.tipo || "camara"] || CUE_TIPO.camara;
                const rel = acc; acc += t.dur || 0;
                return (
                  <div key={t.id} className="grid items-center gap-1" style={{ gridTemplateColumns: cols, borderLeft: `4px solid ${tipo.color}`, paddingLeft: 6 }}>
                    <span className="text-xs font-bold text-slate-500" title={`${tipo.label} · empieza en ${fmt(rel)}`}>{s.idx}.{i + 1}</span>
                    {src(t.alAire ?? t.camId, (v) => upToma(s.id, t.id, { alAire: v }))}
                    {src(t.previo, (v) => upToma(s.id, t.id, { previo: v }))}
                    <input className={ei} style={eiS} disabled={!editable} placeholder="Mic, música…" value={t.audio || ""} onChange={(e) => upToma(s.id, t.id, { audio: e.target.value })} />
                    <input className={ei} style={eiS} disabled={!editable} placeholder="Lower third…" value={t.grafico || ""} onChange={(e) => upToma(s.id, t.id, { grafico: e.target.value })} />
                    <input className={ei} style={eiS} disabled={!editable} placeholder="Instrucción del director" value={t.texto || ""} onChange={(e) => upToma(s.id, t.id, { texto: e.target.value })} />
                    <input className={`${ei} text-center`} style={eiS} disabled={!editable} defaultValue={fmt(t.dur || 0)} key={`d-${t.id}-${t.dur}`}
                      onBlur={(e) => setDur(s.id, t.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                    <div className="flex justify-center">{estadoChip(t, s.id)}</div>
                    {editable ? (
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => moveCue(s.id, i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Subir"><ChevronUp size={13} /></button>
                        <button onClick={() => moveCue(s.id, i, 1)} disabled={i === tomas.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Bajar"><ChevronDown size={13} /></button>
                        <button onClick={() => setSel({ segId: s.id, tomaId: t.id })} className="text-slate-400 hover:text-slate-700" title="Editar cue"><Pencil size={13} /></button>
                      </div>
                    ) : <span />}
                  </div>
                );
              })}
              {editable && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] font-bold uppercase text-slate-400">+ Cue:</span>
                  {CUE_TIPOS.map((ct) => (
                    <button key={ct.id} onClick={() => addCue(s.id, ct.id)} className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: ct.color, color: ct.color }}>{ct.label}</button>
                  ))}
                </div>
              )}
              {!tomas.length && <p className="text-xs text-slate-400">Sin cues todavía. Agrega uno con los botones de arriba.</p>}
            </div>
          </div>
        );
      })}
      {!rows.length && <p className="text-sm text-slate-500">La escaleta está vacía: usa el <b>▤ Asistente de programa en vivo</b> o agrega segmentos en la escaleta editorial.</p>}
      {sel && (() => {
        const seg = (cfg.escaleta || []).find((x) => x.id === sel.segId);
        const cue = seg?.tomas?.find((t) => t.id === sel.tomaId);
        if (!cue) return null;
        return (
          <CueEditorDrawer cue={cue} fuentes={fuentes} editable={editable}
            onChange={(patch) => upToma(sel.segId, sel.tomaId, patch)}
            onClose={() => setSel(null)}
            onDuplicate={() => { dupCue(sel.segId, sel.tomaId); setSel(null); }}
            onDelete={() => { delCue(sel.segId, sel.tomaId); setSel(null); }} />
        );
      })()}
    </div>
  );
}

// Editor lateral de un cue (spec §6): agrupa video, audio, gráficos y operación.
function CueEditorDrawer({ cue, fuentes, editable, onChange, onClose, onDuplicate, onDelete }) {
  const ei = "w-full rounded-md border px-2 py-1.5 text-sm";
  const eiS = { borderColor: "#C8D2DE", color: INK };
  const lab = "flex flex-col gap-1 text-xs font-bold uppercase";
  const labS = { color: "#5F7189" };
  const tipo = CUE_TIPO[cue.tipo || "camara"] || CUE_TIPO.camara;
  const src = (val, onCh) => (
    <select className={ei} style={eiS} disabled={!editable} value={val || ""} onChange={(e) => onCh(e.target.value)}>
      <option value="">—</option>
      {fuentes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
    </select>
  );
  const grupo = (t) => <p className="m-0 mt-1 text-[11px] font-bold uppercase" style={{ color: tipo.color }}>{t}</p>;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(9,20,35,.4)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl" style={{ borderLeft: `5px solid ${tipo.color}` }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: NAVY }}>
          <b className="text-white">Editar cue</b><span className="flex-1" />
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-2.5 p-4" style={{ color: INK }}>
          <div className="grid grid-cols-2 gap-2">
            <label className={lab} style={labS}>Tipo
              <select className={ei} style={eiS} disabled={!editable} value={cue.tipo || "camara"} onChange={(e) => onChange({ tipo: e.target.value })}>
                {CUE_TIPOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className={lab} style={labS}>Duración (m:ss)
              <input className={ei} style={eiS} disabled={!editable} defaultValue={fmt(cue.dur || 0)} key={`dd-${cue.id}-${cue.dur}`}
                onBlur={(e) => { const s = parseMMSS(e.target.value); if (s != null) onChange({ dur: s }); }} />
            </label>
          </div>
          {grupo("Video")}
          <label className={lab} style={labS}>Al aire{src(cue.alAire ?? cue.camId, (v) => onChange({ alAire: v }))}</label>
          <label className={lab} style={labS}>Previo{src(cue.previo, (v) => onChange({ previo: v }))}</label>
          <label className={lab} style={labS}>Transición
            <select className={ei} style={eiS} disabled={!editable} value={cue.transicion || "Corte"} onChange={(e) => onChange({ transicion: e.target.value })}>
              {TRANSICIONES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className={lab} style={labS}>Encuadre
            <input className={ei} style={eiS} disabled={!editable} placeholder="Primer plano, plano de dos…" value={cue.plano || ""} onChange={(e) => onChange({ plano: e.target.value })} />
          </label>
          {grupo("Audio")}
          <label className={lab} style={labS}>Micrófono / audio
            <input className={ei} style={eiS} disabled={!editable} placeholder="MIC 3 – Invitada, música…" value={cue.audio || ""} onChange={(e) => onChange({ audio: e.target.value })} />
          </label>
          {grupo("Gráficos")}
          <label className={lab} style={labS}>Recurso / gráfico
            <input className={ei} style={eiS} disabled={!editable} placeholder="Lower third, título, QR…" value={cue.grafico || ""} onChange={(e) => onChange({ grafico: e.target.value })} />
          </label>
          {grupo("Operación")}
          <label className={lab} style={labS}>Instrucción del director
            <textarea className={ei} style={eiS} rows={2} disabled={!editable} placeholder="CAM 2 al aire. Lanzar nombre y cargo tras la primera frase." value={cue.texto || ""} onChange={(e) => onChange({ texto: e.target.value })} />
          </label>
          <label className={lab} style={labS}>Estado
            <select className={ei} style={eiS} disabled={!editable} value={cue.estado || "borrador"} onChange={(e) => onChange({ estado: e.target.value })}>
              {CUE_ESTADOS.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.label}</option>)}
            </select>
          </label>
        </div>
        {editable && (
          <div className="mt-auto flex items-center gap-2 border-t px-4 py-3" style={{ borderColor: "#E2E8F0" }}>
            <button onClick={onDuplicate} className={`${btn} border`} style={{ borderColor: "#C8D2DE", color: INK }}>Duplicar</button>
            <span className="flex-1" />
            <button onClick={onDelete} className={`${btn} text-white`} style={{ background: "#DC2626" }}><Trash2 size={15} /> Eliminar</button>
          </div>
        )}
      </div>
    </div>
  );
}

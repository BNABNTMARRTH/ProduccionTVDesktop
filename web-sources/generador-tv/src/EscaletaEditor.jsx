import React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { esNarrativo } from "./proyecto.js";
import { INK, NAVY } from "./theme.js";
import { btn } from "./ui.jsx";
import { fmt, uid } from "./util.js";



// Escaleta EDITABLE y consciente del modo. En vivo: columnas EDITORIALES
// (bloque, objetivo, participantes, recursos). En narrativo: columnas de ESCENA
// (encabezado, acción, función, personajes, cambio). La fuente al aire y los
// comandos técnicos NO viven aquí: van en el rundown / guion técnico.
export function EscaletaEditor({ cfg, setCfg, rows, editable }) {
  const narr = esNarrativo(cfg);
  const up = (id, patch) => setCfg((c) => ({ ...c, escaleta: c.escaleta.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const del = (id) => setCfg((c) => ({ ...c, escaleta: c.escaleta.filter((s) => s.id !== id) }), { commit: true });
  const move = (i, dir) => setCfg((c) => {
    const j = i + dir; if (j < 0 || j >= c.escaleta.length) return c;
    const e = [...c.escaleta]; [e[i], e[j]] = [e[j], e[i]]; return { ...c, escaleta: e };
  }, { commit: true });
  const add = () => setCfg((c) => {
    const nuevo = narr
      ? { id: uid(), segmento: `Escena ${c.escaleta.length + 1}`, dur: 60, encabezado: "", accion: "", funcion: "", personajes: "", cambio: "", nota: "", tomas: [] }
      : { id: uid(), segmento: "Nuevo segmento", dur: 60, bloque: c.escaleta[c.escaleta.length - 1]?.bloque || 1, objetivo: "", participantes: "", recursos: "", fuente: c.camaras?.[0]?.id || c.extras?.[0]?.id || "", nota: "", tomas: [] };
    return { ...c, escaleta: [...c.escaleta, nuevo] };
  }, { commit: true });
  const setDur = (id, txt) => {
    const m = String(txt).match(/^(\d+):(\d{1,2})$/);
    const s = m ? Number(m[1]) * 60 + Number(m[2]) : Number(txt);
    if (Number.isFinite(s) && s >= 0) up(id, { dur: Math.round(s) });
  };

  const cols = narr
    ? "44px 34px minmax(130px,1.1fr) minmax(150px,1.5fr) minmax(120px,1fr) minmax(110px,1fr) minmax(130px,1.2fr) 58px 66px"
    : "30px 46px minmax(120px,1.1fr) minmax(150px,1.4fr) minmax(110px,1fr) minmax(120px,1fr) 50px 50px 58px 66px";
  const heads = narr
    ? ["SEC", "ESC", "ENCABEZADO", "ACCIÓN PRINCIPAL", "FUNCIÓN NARRATIVA", "PERSONAJES", "CAMBIO", "DUR", ""]
    : ["#", "BLOQUE", "SEGMENTO", "OBJETIVO", "PARTICIPANTES", "RECURSOS", "IN", "OUT", "DUR", ""];
  const ei = "w-full rounded border px-1.5 py-1 text-xs";
  const eiS = { borderColor: "#D5DDE7", color: INK };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-1 text-[10px] font-bold uppercase text-slate-500" style={{ gridTemplateColumns: cols }}>
        {heads.map((h, i) => <span key={i} className={i >= heads.length - 2 ? "text-center" : ""}>{h}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className="grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
          {narr ? (<>
            <input className={ei} style={eiS} disabled={!editable} value={r.secuencia ?? ""} placeholder="1" onChange={(e) => up(r.id, { secuencia: e.target.value })} />
            <span className="text-center text-xs font-bold text-slate-500">{r.idx}</span>
            <input className={ei} style={eiS} disabled={!editable} value={r.encabezado ?? ""} placeholder="INT. LUGAR – DÍA" onChange={(e) => up(r.id, { encabezado: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.accion ?? ""} placeholder="¿Qué ocurre?" onChange={(e) => up(r.id, { accion: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.funcion ?? ""} placeholder="Función en la historia" onChange={(e) => up(r.id, { funcion: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.personajes ?? ""} placeholder="Personajes" onChange={(e) => up(r.id, { personajes: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.cambio ?? ""} placeholder="¿Qué cambia?" onChange={(e) => up(r.id, { cambio: e.target.value })} />
          </>) : (<>
            <span className="text-center text-xs font-bold text-slate-500">{r.idx}</span>
            <input className={ei} style={eiS} disabled={!editable} value={r.bloque ?? ""} placeholder="1" onChange={(e) => up(r.id, { bloque: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.segmento ?? ""} placeholder="Segmento" onChange={(e) => up(r.id, { segmento: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.objetivo ?? ""} placeholder="Objetivo editorial" onChange={(e) => up(r.id, { objetivo: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.participantes ?? ""} placeholder="Participantes" onChange={(e) => up(r.id, { participantes: e.target.value })} />
            <input className={ei} style={eiS} disabled={!editable} value={r.recursos ?? ""} placeholder="Recursos previstos" onChange={(e) => up(r.id, { recursos: e.target.value })} />
            <span className="text-center text-[11px] text-slate-500">{fmt(r.tin)}</span>
            <span className="text-center text-[11px] text-slate-500">{fmt(r.tout)}</span>
          </>)}
          <input className={`${ei} text-center`} style={eiS} disabled={!editable} defaultValue={fmt(r.dur)} key={`dur-${r.id}-${r.dur}`}
            onBlur={(e) => setDur(r.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          {editable ? (
            <div className="flex items-center justify-end gap-0.5">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Subir"><ChevronUp size={14} /></button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Bajar"><ChevronDown size={14} /></button>
              <button onClick={() => del(r.id)} className="text-slate-400 hover:text-red-600" title="Eliminar"><Trash2 size={14} /></button>
            </div>
          ) : <span />}
        </div>
      ))}
      {!rows.length && <p className="text-sm text-slate-500">La escaleta está vacía.{editable ? " Agrega un segmento o usa el asistente." : ""}</p>}
      {editable && (
        <button onClick={add} className={`${btn} self-start border`} style={{ borderColor: "#C8D2DE", color: NAVY }}>
          <Plus size={15} /> {narr ? "Agregar escena" : "Agregar segmento"}
        </button>
      )}
    </div>
  );
}

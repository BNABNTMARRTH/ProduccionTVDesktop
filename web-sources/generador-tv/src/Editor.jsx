import React, { useState } from "react";
import {
  ChevronDown, ChevronUp, Download, FilePlus, FolderOpen, GripVertical,
  Mic, Plus, Save, Search, StickyNote, Trash2, User, X,
} from "lucide-react";
import { AnalisisTiempos } from "./AnalisisTiempos.jsx";
import { CATALOGO_FUENTES, CATALOGO_ROLES, MIC_TIPOS, MIC_TIPO_CORTO, PLANOS } from "./catalogos.js";
import { computeFuentes, computeRows, generarCSV, generarEDL } from "./escaleta.js";
import { useReorder } from "./hooks.js";
import { ICONS } from "./iconos.jsx";
import { IMPACTOS, TIPOS_PROYECTO } from "./narrativa.js";
import { BLANCO, DEMO, MEDIOS, normalizeCfg, perfilVacio } from "./proyecto.js";
import { EMBEDDED, descargarArchivo } from "./puente.js";
import { AIR_COLOR, INK, NAVY, PALETTE } from "./theme.js";
import { btn, Card, Chips, inp, inpStyle, Swatches } from "./ui.jsx";
import { fmt, parseDur, reorder, slug, textOn, trunc, uid } from "./util.js";

// Panel de EDICIÓN del proyecto (columna izquierda): identidad y marca, fuentes
// (cámaras y extras), talentos y micrófonos, equipo humano, escaleta y
// exportaciones. Cada bloque es una tarjeta plegable.
// `grupo` es la ETAPA que se está viendo (reorganización 2026-08-24): el mismo
// editor muestra solo las tarjetas de esa etapa. 'todo' las muestra todas, que
// es como funcionaba antes y como sigue funcionando la versión web.
export function Editor({ cfg, setCfg, proyectos, guardar, cargar, eliminar, grupo = "todo" }) {
  const ver = (g) => grupo === "todo" || grupo === g;
  const perfil = cfg.perfil || perfilVacio();
  const upPerfil = (parche) => setCfg((c) => ({ ...c, perfil: { ...(c.perfil || perfilVacio()), ...parche } }));
  const [nombreProy, setNombreProy] = useState("");
  const [rolCustom, setRolCustom] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const fuentes = computeFuentes(cfg);
  const rows = computeRows(cfg);
  const total = rows.length ? rows[rows.length - 1].tout : 0;

  const q = busqueda.trim().toLowerCase();
  const segFiltrados = cfg.escaleta
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      if (!q) return true;
      const f = fuentes.find((x) => x.id === s.fuente);
      return (s.segmento || "").toLowerCase().includes(q)
        || (f ? f.nombre.toLowerCase().includes(q) : false)
        || fmt(s.dur).includes(q)
        || (s.nota || "").toLowerCase().includes(q);
    });

  const up = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const upCam = (id, patch) => setCfg((c) => ({ ...c, camaras: c.camaras.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
  const upMic = (id, patch) => setCfg((c) => ({ ...c, microfonos: (c.microfonos || []).map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const upExtra = (id, patch) => setCfg((c) => ({ ...c, extras: c.extras.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
  const upSeg = (id, patch) => setCfg((c) => ({ ...c, escaleta: c.escaleta.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addCam = () => setCfg((c) => {
    if (c.camaras.length >= 8) return c;
    const n = c.camaras.length + 1;
    return { ...c, camaras: [...c.camaras, { id: uid(), nombre: `CAM ${n}`, plano: "Plano Medio", color: PALETTE[(n - 1) % 8] }] };
  });
  const delCam = (id) => setCfg((c) => {
    if (c.camaras.length <= 1) return c;
    const rest = c.camaras.filter((k) => k.id !== id);
    const fallback = rest[0].id;
    return { ...c, camaras: rest, escaleta: c.escaleta.map((s) => (s.fuente === id ? { ...s, fuente: fallback } : s)) };
  });
  const addMic = () => setCfg((c) => ({ ...c, microfonos: [...(c.microfonos || []), { id: uid(), nombre: `Mic ${(c.microfonos || []).length + 1}`, conexion: "XLR", micTipo: "dinamico", asignadoA: "" }] }));
  const delMic = (id) => setCfg((c) => ({ ...c, microfonos: (c.microfonos || []).filter((m) => m.id !== id) }));
  const upTal = (id, patch) => setCfg((c) => ({ ...c, talentos: (c.talentos || []).map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const addTal = () => setCfg((c) => ({ ...c, talentos: [...(c.talentos || []), { id: uid(), nombre: `Talento ${(c.talentos || []).length + 1}`, tipo: "invitado" }] }));
  // Al eliminar un talento, sus micrófonos quedan sin asignar (no se borran)
  // y se levanta de cualquier mueble que ocupara.
  const delTal = (id) => setCfg((c) => ({
    ...c,
    talentos: (c.talentos || []).filter((t) => t.id !== id),
    microfonos: (c.microfonos || []).map((m) => (m.asignadoA === `tal:${id}` ? { ...m, asignadoA: "" } : m)),
    sets: (c.sets || []).map((s) => ({
      ...s,
      muebles: (s.muebles || []).map((m) => ({ ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== id) })),
    })),
  }));
  const importLogo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCfg((c) => ({ ...c, branding: { ...(c.branding || {}), logoDataUrl: String(reader.result || "") } }));
    reader.readAsDataURL(file);
  };
  const addExtra = () => setCfg((c) => ({ ...c, extras: [...c.extras, { id: uid(), nombre: "VTR", color: "#64748B", esCorte: false }] }));
  const delExtra = (id) => setCfg((c) => {
    const fallback = c.camaras[0]?.id;
    return { ...c, extras: c.extras.filter((x) => x.id !== id), escaleta: c.escaleta.map((s) => (s.fuente === id && fallback ? { ...s, fuente: fallback } : s)) };
  });
  const addSeg = () => setCfg((c) => ({ ...c, escaleta: [...c.escaleta, { id: uid(), segmento: "Nuevo segmento", dur: 60, fuente: c.camaras[0]?.id || c.extras[0]?.id, nota: "" }] }));
  const delSeg = (id) => setCfg((c) => ({ ...c, escaleta: c.escaleta.filter((s) => s.id !== id) }));
  const move = (i, d) => setCfg((c) => {
    const e = [...c.escaleta]; const j = i + d;
    if (j < 0 || j >= e.length) return c;
    [e[i], e[j]] = [e[j], e[i]];
    return { ...c, escaleta: e };
  });
  const moveSegTo = (from, to) => setCfg((c) => ({ ...c, escaleta: reorder(c.escaleta, from, to) }));
  const moveCam = (i, d) => setCfg((c) => {
    const j = i + d;
    if (j < 0 || j >= c.camaras.length) return c;
    return { ...c, camaras: reorder(c.camaras, i, j) };
  });
  const moveCamTo = (from, to) => setCfg((c) => ({ ...c, camaras: reorder(c.camaras, from, to) }));
  const addFuente = (preset) => setCfg((c) => ({
    ...c,
    extras: [...c.extras, { id: uid(), nombre: preset.nombre, color: preset.color, esCorte: !!preset.esCorte }],
  }));
  const dndSeg = useReorder(moveSegTo);
  const dndCam = useReorder(moveCamTo);
  const addRol = (rol, icon) => setCfg((c) =>
    c.personal.some((p) => p.rol.toLowerCase() === rol.toLowerCase()) ? c : { ...c, personal: [...c.personal, { id: uid(), rol, icon }] });
  const delRol = (id) => setCfg((c) => ({ ...c, personal: c.personal.filter((p) => p.id !== id) }));

  return (
    <div className="grid items-start gap-3 px-3 py-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))" }}>
      {/* Proyectos (solo versión web: en la app de escritorio los proyectos los maneja el shell) */}
      {ver('perfil') && !EMBEDDED && (
      <Card title="Proyectos" open={false}>
        <div className="flex flex-wrap gap-2">
          <button className={btn} style={{ background: "#E9EDF3", color: INK }} onClick={() => setCfg(normalizeCfg(BLANCO()))}><FilePlus size={15} /> Nuevo (en blanco)</button>
          <button className={btn} style={{ background: "#E9EDF3", color: INK }} onClick={() => setCfg(normalizeCfg(DEMO()))}><FolderOpen size={15} /> Cargar ejemplo UASLP</button>
        </div>
        <div className="flex gap-2">
          <input className={inp} style={inpStyle} placeholder="Nombre del proyecto…" value={nombreProy} onChange={(e) => setNombreProy(e.target.value)} />
          <button className={`${btn} shrink-0 text-white`} style={{ background: NAVY }}
            onClick={() => { if (nombreProy.trim()) { guardar(nombreProy.trim()); setNombreProy(""); } }}>
            <Save size={15} /> Guardar
          </button>
        </div>
        {proyectos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {proyectos.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5" style={{ borderColor: "#C8D2DE" }}>
                <span className="flex-1 text-sm font-semibold truncate" style={{ color: INK }}>{p.nombre}</span>
                <span className="text-xs text-slate-400">{new Date(p.fecha).toLocaleDateString()}</span>
                <button className={btn} style={{ background: "#E9EDF3", color: INK, padding: "3px 8px" }} onClick={() => cargar(p)}>Abrir</button>
                <button className="text-slate-400" onClick={() => eliminar(p)} aria-label="Eliminar"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">Los proyectos se guardan en este navegador y tu trabajo actual se autoguarda automáticamente.</p>
      </Card>)}

      {/* Datos generales */}
      {ver('perfil') && (
      <Card title="Narrativa / Brief" open={!!cfg.narrativa}>
        {cfg.narrativa ? (<>
          <p className="m-0 text-xs text-slate-500">
            {TIPOS_PROYECTO.find((t) => t.id === cfg.narrativa.tipo)?.nombre || cfg.narrativa.tipo}
            {cfg.narrativa.impacto ? ` · ${cfg.narrativa.impacto}` : ""}{cfg.narrativa.emocion ? ` · ${cfg.narrativa.emocion}` : ""}
          </p>
          <label className="text-xs font-bold uppercase text-slate-500">Logline
            <textarea className={inp} style={inpStyle} rows={2} value={cfg.narrativa.logline || ""}
              onChange={(e) => up({ narrativa: { ...cfg.narrativa, logline: e.target.value } })} />
          </label>
          <p className="m-0 text-xs text-slate-500">
            El mensaje y a quién va dirigido se llenan arriba, en <b>Perfil del proyecto</b>.
          </p>
          <label className="text-xs font-bold uppercase text-slate-500">Llamada a la acción
            <input className={inp} style={inpStyle} value={cfg.narrativa.cta || ""}
              onChange={(e) => up({ narrativa: { ...cfg.narrativa, cta: e.target.value } })} />
          </label>
        </>) : (
          <p className="m-0 text-sm text-slate-500">
            Todavía no hay brief. Aquí vivirán la premisa, el tono y los personajes de tu proyecto.
          </p>
        )}
      </Card>)}
      {ver('perfil') && (
      <Card title="Datos generales">
        <label className="text-xs font-bold uppercase text-slate-500">Título principal
          <input className={inp} style={inpStyle} value={cfg.titulo} onChange={(e) => up({ titulo: e.target.value })} />
        </label>
        <label className="text-xs font-bold uppercase text-slate-500">Subtítulo
          <input className={inp} style={inpStyle} value={cfg.subtitulo} onChange={(e) => up({ subtitulo: e.target.value })} />
        </label>
        <div className="grid grid-cols-1 gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Organización / logo
            <input className={inp} style={inpStyle} value={cfg.organizacion} onChange={(e) => up({ organizacion: e.target.value })} />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold uppercase text-slate-500">Logotipo de la productora
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="block mt-1 text-xs" onChange={(e) => importLogo(e.target.files?.[0])} />
          </label>
          <label className="text-xs font-bold uppercase text-slate-500">Color principal
            <input type="color" className="block mt-1" value={cfg.branding?.primaryColor || NAVY}
              onChange={(e) => setCfg((c) => ({ ...c, branding: { ...(c.branding || {}), primaryColor: e.target.value } }))} />
          </label>
          {cfg.branding?.logoDataUrl && <button className={btn} style={{ background: "#E9EDF3", color: INK }} onClick={() => setCfg((c) => ({ ...c, branding: { ...(c.branding || {}), logoDataUrl: "" } }))}>Quitar logotipo</button>}
        </div>
      </Card>)}

      {/* Perfil: el brief que toda producción necesita antes de grabar */}
      {ver('perfil') && (
      <Card title="Perfil del proyecto">
        <p className="m-0 text-xs text-slate-500" style={{ marginTop: -6 }}>
          Quién habla, qué dice, para qué, a quién y con cuánto. Es lo primero que se decide
          y lo que después justifica cada plano, cada luz y cada gasto.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Emisor — quién produce
            <input className={inp} style={inpStyle} placeholder="FCC-UASLP, taller de documental"
              value={perfil.emisor} onChange={(e) => upPerfil({ emisor: e.target.value })} />
          </label>
          <label className="text-xs font-bold uppercase text-slate-500">Receptor — a quién le hablas
            <input className={inp} style={inpStyle} placeholder="Estudiantes de la facultad"
              value={perfil.receptor} onChange={(e) => upPerfil({ receptor: e.target.value })} />
          </label>
        </div>
        <label className="text-xs font-bold uppercase text-slate-500">Mensaje — la idea en una frase
          <textarea className={inp} style={inpStyle} rows={2} placeholder="Si tu proyecto solo pudiera decir una cosa, ¿cuál sería?"
            value={perfil.mensaje} onChange={(e) => upPerfil({ mensaje: e.target.value })} />
        </label>
        <Chips titulo="Intención — qué quieres que pase en quien lo vea"
          opciones={IMPACTOS} valor={perfil.intencion}
          onChange={(v) => upPerfil({ intencion: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Edad del receptor
            <input className={inp} style={inpStyle} placeholder="18 a 25 años"
              value={perfil.edad} onChange={(e) => upPerfil({ edad: e.target.value })} />
          </label>
          <label className="text-xs font-bold uppercase text-slate-500">Presupuesto estimado (MXN)
            <input className={inp} style={inpStyle} inputMode="numeric" placeholder="0"
              value={perfil.presupuesto} onChange={(e) => upPerfil({ presupuesto: e.target.value.replace(/[^\d.]/g, "") })} />
          </label>
        </div>
        <Chips titulo="Medios que usa tu receptor"
          ayuda="Dónde va a ver tu proyecto. Define formato, duración y hasta el encuadre."
          opciones={MEDIOS} valor={perfil.medios}
          onChange={(v) => upPerfil({ medios: v })} />
        <label className="text-xs font-bold uppercase text-slate-500">¿De dónde sale el dinero?
          <input className={inp} style={inpStyle} placeholder="Beca, recursos propios, patrocinio…"
            value={perfil.presupuestoNota} onChange={(e) => upPerfil({ presupuestoNota: e.target.value })} />
        </label>
      </Card>)}

      {/* Cámaras */}
      {ver('necesidades') && (
      <Card title={`Cámaras y planos (${cfg.camaras.length})`} className="xl:col-span-2">
        <datalist id="planos">{PLANOS.map((p) => <option key={p} value={p} />)}</datalist>
        {cfg.camaras.map((c, i) => (
          <div key={c.id} {...dndCam.target(i)}
            className="rounded-lg border p-2 flex flex-col gap-2"
            style={{
              borderColor: dndCam.overIdx === i && dndCam.dragIdx !== i ? AIR_COLOR : "#DDE4EC",
              opacity: dndCam.dragIdx === i ? 0.4 : 1,
            }}>
            <div className="flex flex-wrap items-center gap-2">
              <span {...dndCam.source(i)} title="Arrastra para reordenar"
                className="cursor-grab active:cursor-grabbing text-slate-400 shrink-0" style={{ touchAction: "none" }}>
                <GripVertical size={16} />
              </span>
              <span className="flex items-center justify-center rounded-full font-bold shrink-0"
                style={{ width: 24, height: 24, background: c.color, color: textOn(c.color), fontSize: 12 }}>{i + 1}</span>
              <input className={inp} style={{ ...inpStyle, width: 110, flex: "0 0 auto" }} value={c.nombre} onChange={(e) => upCam(c.id, { nombre: e.target.value })} />
              <input className={inp} style={{ ...inpStyle, flex: "1 1 160px" }} list="planos" placeholder="Tipo de plano…" value={c.plano} onChange={(e) => upCam(c.id, { plano: e.target.value })} />
              <span className="flex gap-0.5 shrink-0">
                <button className="text-slate-400" onClick={() => moveCam(i, -1)} disabled={i === 0} aria-label="Subir cámara"><ChevronUp size={16} /></button>
                <button className="text-slate-400" onClick={() => moveCam(i, 1)} disabled={i === cfg.camaras.length - 1} aria-label="Bajar cámara"><ChevronDown size={16} /></button>
                <button className="text-slate-400" onClick={() => delCam(c.id)} disabled={cfg.camaras.length <= 1} aria-label="Eliminar cámara"><Trash2 size={16} /></button>
              </span>
            </div>
            <Swatches value={c.color} onChange={(col) => upCam(c.id, { color: col })} />
          </div>
        ))}
        <button className={`${btn} text-white self-start`} style={{ background: NAVY }} onClick={addCam} disabled={cfg.camaras.length >= 8}>
          <Plus size={15} /> Agregar cámara {cfg.camaras.length >= 8 ? "(máx. 8)" : ""}
        </button>
      </Card>)}

      {/* Talentos: conductores e invitados, entes propios en el plano del set */}
      {ver('necesidades') && (
      <Card title={`Talentos — conductores e invitados (${(cfg.talentos || []).length})`}>
        {(cfg.talentos || []).map((t) => {
          const micsT = (cfg.microfonos || []).filter((m) => m.asignadoA === `tal:${t.id}`);
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "#DDE4EC" }}>
              <User size={16} color={t.tipo === "invitado" ? "#0E9F9E" : NAVY} />
              <input className={inp} style={{ ...inpStyle, flex: "1 1 180px" }} value={t.nombre} onChange={(e) => upTal(t.id, { nombre: e.target.value })} />
              <select className={inp} style={{ ...inpStyle, width: 140 }} value={t.tipo} onChange={(e) => upTal(t.id, { tipo: e.target.value })}>
                <option value="conductor">Conductor(a)</option>
                <option value="invitado">Invitado(a)</option>
              </select>
              <span className="text-xs text-slate-500 shrink-0">
                {micsT.length ? micsT.map((m) => MIC_TIPO_CORTO[m.micTipo] || "mic").join(" + ") : "sin micrófono"}
              </span>
              <button className="text-slate-400" onClick={() => delTal(t.id)} aria-label="Eliminar talento"><Trash2 size={16} /></button>
            </div>
          );
        })}
        <button className={`${btn} text-white self-start`} style={{ background: NAVY }} onClick={addTal}><Plus size={15} /> Agregar talento</button>
        <p className="text-xs text-slate-500">El micrófono se les asigna en la sección Micrófonos (solapa, dinámico…). Sus posiciones se arrastran en la pestaña Set.</p>
      </Card>)}

      {ver('necesidades') && (
      <Card title={`Micrófonos (${(cfg.microfonos || []).length})`} open={false} className="xl:col-span-2">
        {(cfg.microfonos || []).map((m) => {
          const micTipo = m.micTipo || "dinamico";
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "#DDE4EC" }}>
              <Mic size={16} color="#1FA14E" />
              <input className={inp} style={{ ...inpStyle, flex: "1 1 150px" }} value={m.nombre} onChange={(e) => upMic(m.id, { nombre: e.target.value })} />
              <select className={inp} style={{ ...inpStyle, width: 165 }} value={micTipo} title="Tipo de micrófono"
                onChange={(e) => upMic(m.id, { micTipo: e.target.value, asignadoA: e.target.value === "boom" ? "set" : "" })}>
                {MIC_TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {micTipo !== "boom" && (
                <select className={inp} style={{ ...inpStyle, width: 160 }} value={m.asignadoA || ""} title={micTipo === "shotgun" ? "Cámara donde va montado" : "Talento que lo porta"}
                  onChange={(e) => upMic(m.id, { asignadoA: e.target.value })}>
                  <option value="">Sin asignar (suelto)</option>
                  {micTipo === "shotgun"
                    ? cfg.camaras.map((c2, i2) => <option key={c2.id} value={`cam:${c2.id}`}>{c2.nombre || `CAM ${i2 + 1}`}</option>)
                    : (cfg.talentos || []).map((t) => <option key={t.id} value={`tal:${t.id}`}>{t.nombre}</option>)}
                </select>
              )}
              <select className={inp} style={{ ...inpStyle, width: 120 }} value={m.conexion} title="Conexión"
                onChange={(e) => upMic(m.id, { conexion: e.target.value })}>
                <option>XLR</option><option>Inalámbrico</option><option>USB</option><option>3.5 mm</option>
              </select>
              <button className="text-slate-400" onClick={() => delMic(m.id)} aria-label="Eliminar micrófono"><Trash2 size={16} /></button>
            </div>
          );
        })}
        <button className={`${btn} text-white self-start`} style={{ background: "#1FA14E" }} onClick={addMic}><Plus size={15} /> Agregar micrófono</button>
        <p className="text-xs text-slate-500">Boom = perchado con posición propia en el set · Shotgun = montado en una cámara · Solapa y dinámico = los porta un talento.</p>
      </Card>)}

      {/* Otras fuentes */}
      {ver('necesidades') && (
      <Card title="Otras fuentes (comerciales, VTR, gráficos…)" open={false}>
        {cfg.extras.map((x) => (
          <div key={x.id} className="rounded-lg border p-2 flex flex-col gap-2" style={{ borderColor: "#DDE4EC" }}>
            <div className="flex flex-wrap items-center gap-2">
              <input className={inp} style={{ ...inpStyle, flex: "1 1 140px" }} value={x.nombre} onChange={(e) => upExtra(x.id, { nombre: e.target.value })} />
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0">
                <input type="checkbox" checked={!!x.esCorte} onChange={(e) => upExtra(x.id, { esCorte: e.target.checked })} />
                Es corte comercial
              </label>
              <button className="text-slate-400 shrink-0" onClick={() => delExtra(x.id)} aria-label="Eliminar fuente"><Trash2 size={16} /></button>
            </div>
            <Swatches value={x.color} onChange={(col) => upExtra(x.id, { color: col })} />
          </div>
        ))}
        <div>
          <p className="text-xs font-bold uppercase text-slate-500 mb-1">Agregar fuente común</p>
          <div className="flex flex-wrap gap-1.5">
            {CATALOGO_FUENTES.map((f) => (
              <button key={f.nombre} onClick={() => addFuente(f)}
                className="rounded-full border px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1.5"
                style={{ borderColor: "#C8D2DE", color: "#475569", background: "#F4F7FA" }}>
                <span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: f.color }} /> + {f.nombre}
              </button>
            ))}
          </div>
        </div>
        <button className={`${btn} self-start`} style={{ background: "#E9EDF3", color: INK }} onClick={addExtra}><Plus size={15} /> Agregar fuente en blanco</button>
      </Card>)}

      {/* Escaleta */}
      {ver('tiempos') && (
      <Card title={`Escaleta / Rundown — total ${fmt(total)}`} className="xl:col-span-2">
        <p className="text-xs text-slate-500" style={{ marginTop: -6 }}>Duración en MM:SS (ej. 01:10). IN/OUT y la línea de tiempo se calculan solos.</p>

        <div className="relative">
          <Search size={15} className="absolute text-slate-400" style={{ left: 9, top: 10 }} />
          <input className={inp} style={{ ...inpStyle, paddingLeft: 30 }} placeholder="Buscar por nombre, fuente, duración o nota…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          {busqueda && (
            <button className="absolute text-slate-400" style={{ right: 9, top: 10 }} onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda"><X size={15} /></button>
          )}
        </div>
        {busqueda && (
          <p className="text-xs text-slate-500" style={{ marginTop: -4 }}>
            {segFiltrados.length} de {cfg.escaleta.length} segmentos. El reordenamiento se desactiva mientras buscas.
          </p>
        )}

        {segFiltrados.map(({ s, i }) => (
          <div key={s.id} {...(busqueda ? {} : dndSeg.target(i))}
            className="flex flex-col gap-1 rounded-lg border p-1.5"
            style={{
              borderColor: !busqueda && dndSeg.overIdx === i && dndSeg.dragIdx !== i ? AIR_COLOR : "#DDE4EC",
              opacity: !busqueda && dndSeg.dragIdx === i ? 0.4 : 1,
            }}>
            <div className="flex flex-wrap items-center gap-1.5">
              {!busqueda && (
                <span {...dndSeg.source(i)} title="Arrastra para reordenar"
                  className="cursor-grab active:cursor-grabbing text-slate-400 shrink-0" style={{ touchAction: "none" }}>
                  <GripVertical size={15} />
                </span>
              )}
              <span className="text-xs font-bold text-slate-400 text-center shrink-0" style={{ width: 20 }}>{i + 1}</span>
              <input className={inp} style={{ ...inpStyle, flex: "1 1 170px" }} value={s.segmento} onChange={(e) => upSeg(s.id, { segmento: e.target.value })} />
              <input key={`${s.id}:${s.dur}`} className={inp} style={{ ...inpStyle, width: 70, flex: "0 0 auto", textAlign: "center" }}
                defaultValue={fmt(s.dur)}
                onBlur={(e) => { const v = parseDur(e.target.value); if (v == null || v < 0) { e.target.value = fmt(s.dur); } else upSeg(s.id, { dur: v }); }} />
              <select className={inp} style={{ ...inpStyle, width: 150, flex: "0 0 auto" }} value={s.fuente} onChange={(e) => upSeg(s.id, { fuente: e.target.value })}>
                {fuentes.map((f) => <option key={f.id} value={f.id}>{f.tipo === "cam" ? `${f.nombre} — ${trunc(f.plano, 18)}` : f.nombre}</option>)}
              </select>
              <span className="flex gap-0.5 shrink-0">
                {!busqueda && <button className="text-slate-400" onClick={() => move(i, -1)} aria-label="Subir"><ChevronUp size={16} /></button>}
                {!busqueda && <button className="text-slate-400" onClick={() => move(i, 1)} aria-label="Bajar"><ChevronDown size={16} /></button>}
                <button className="text-slate-400" onClick={() => delSeg(s.id)} aria-label="Eliminar segmento"><Trash2 size={16} /></button>
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <StickyNote size={13} className="text-slate-300 shrink-0" style={{ marginTop: 6, marginLeft: 2 }} />
              <textarea className={inp} rows={s.nota ? 2 : 1}
                style={{ ...inpStyle, fontSize: 12, resize: "vertical", minHeight: 30, lineHeight: 1.4 }}
                placeholder="Notas del segmento: guion del conductor, cue de audio, aviso de efectos…"
                value={s.nota || ""} onChange={(e) => upSeg(s.id, { nota: e.target.value })} />
            </div>
          </div>
        ))}
        {segFiltrados.length === 0 && busqueda && (
          <p className="text-sm text-slate-400 text-center" style={{ padding: 8 }}>Ningún segmento coincide con “{busqueda}”.</p>
        )}
        <button className={`${btn} text-white self-start`} style={{ background: NAVY }} onClick={addSeg}><Plus size={15} /> Agregar segmento</button>
      </Card>)}

      {/* Análisis de tiempos */}
      {ver('tiempos') && (
      <Card title="Análisis de tiempos" className="xl:col-span-2">
        <AnalisisTiempos cfg={cfg} />
      </Card>)}

      {/* Exportar */}
      {ver('tiempos') && (
      <Card title="Exportar para edición de video" open={false}>
        <p className="text-xs text-slate-500" style={{ marginTop: -6 }}>
          Lleva la escaleta a tu editor. El <b>EDL</b> crea cortes en la línea de tiempo (DaVinci Resolve / Premiere / Avid).
          El <b>CSV</b> abre en Excel/Sheets y sirve como lista de marcadores. Los nombres y notas viajan como comentarios.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={`${btn} text-white`} style={{ background: NAVY }}
            onClick={() => descargarArchivo(`${slug(cfg.titulo)}.edl`, generarEDL(cfg))}>
            <Download size={15} /> Descargar EDL
          </button>
          <button className={btn} style={{ background: "#E9EDF3", color: INK }}
            onClick={() => descargarArchivo(`${slug(cfg.titulo)}.csv`, generarCSV(cfg), "text/csv")}>
            <Download size={15} /> Descargar CSV
          </button>
        </div>
      </Card>)}

      {/* Flujo */}
      {ver('necesidades') && (
      <Card title="Flujo de producción" open={false}>
        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
          <input type="checkbox" checked={(cfg.flujo || {}).preview !== false} onChange={(e) => up({ flujo: { ...(cfg.flujo || {}), preview: e.target.checked } })} />
          Incluir monitor PREVIEW
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
          <input type="checkbox" checked={(cfg.flujo || {}).playback !== false} onChange={(e) => up({ flujo: { ...(cfg.flujo || {}), playback: e.target.checked } })} />
          Incluir playback de comerciales / cortinillas
        </label>
        <p className="text-xs text-slate-500">Las cámaras del flujo y los monitores de cabina se generan automáticamente desde la sección de cámaras.</p>
      </Card>)}

      {/* Personal */}
      {ver('necesidades') && (
      <Card title={`Personal de operación (${cfg.personal.length}${cfg.includeCamOps ? ` + ${cfg.camaras.length} cam.` : ""})`} className="xl:col-span-2">
        <div className="flex flex-wrap gap-1.5">
          {cfg.personal.map((p) => {
            const Ic = ICONS[p.icon] || User;
            return (
              <span key={p.id} className="flex items-center gap-1.5 rounded-full border pl-2 pr-1 py-1 text-xs font-semibold"
                style={{ borderColor: "#C8D2DE", color: INK }}>
                <Ic size={13} /> {p.rol}
                <button className="text-slate-400" onClick={() => delRol(p.id)} aria-label={`Quitar ${p.rol}`}><X size={13} /></button>
              </span>
            );
          })}
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-slate-500 mb-1">Agregar rol común</p>
          <div className="flex flex-wrap gap-1.5">
            {CATALOGO_ROLES.filter((r) => !cfg.personal.some((p) => p.rol === r.rol)).map((r) => (
              <button key={r.rol} className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{ borderColor: "#C8D2DE", color: "#475569", background: "#F4F7FA" }}
                onClick={() => addRol(r.rol, r.icon)}>+ {r.rol}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <input className={inp} style={inpStyle} placeholder="Rol personalizado…" value={rolCustom} onChange={(e) => setRolCustom(e.target.value)} />
          <button className={`${btn} shrink-0`} style={{ background: "#E9EDF3", color: INK }}
            onClick={() => { if (rolCustom.trim()) { addRol(rolCustom.trim(), "custom"); setRolCustom(""); } }}>
            <Plus size={15} /> Agregar
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
          <input type="checkbox" checked={cfg.includeCamOps} onChange={(e) => up({ includeCamOps: e.target.checked })} />
          Incluir operadores de cámara automáticamente (uno por cámara)
        </label>
      </Card>)}
    </div>
  );
}

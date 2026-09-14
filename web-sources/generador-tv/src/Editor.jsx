import React, { useRef, useState } from "react";
import {
  ChevronDown, ChevronUp, Download, FilePlus, FolderOpen, GripVertical,
  Mic, Plus, Save, Trash2, Upload, User, X,
} from "lucide-react";
import { AnalisisTiempos } from "./AnalisisTiempos.jsx";
import { CATALOGO_FUENTES, CATALOGO_ROLES, MIC_TIPOS, MIC_TIPO_CORTO, PLANOS } from "./catalogos.js";
import { computeFuentes, computeRows, generarCSV, generarEDL } from "./escaleta.js";
import { useReorder } from "./hooks.js";
import { ICONS } from "./iconos.jsx";
import { IMPACTOS, TIPOS_PROYECTO } from "./narrativa.js";
import { ALCANCES, BLANCO, CONOCIMIENTOS, DEMO, MEDIOS, formatoSugerido, normalizeCfg,
         objetivoSegDe, perfilVacio, porSegundo } from "./proyecto.js";
import { EMBEDDED, descargarArchivo } from "./puente.js";
import { AIR_COLOR, NAVY, PALETTE } from "./theme.js";
import { Aviso, Btn, btn, Campo, Campos, Card, Chips, ColorPickerField, Formatos, inp, inpStyle,
         Lectura, Seccion, Swatches, Tabulador } from "./ui.jsx";
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
  const logoRef = useRef(null);
  // El logline y la llamada a la acción viven en `narrativa`, que puede no
  // existir todavía (proyectos creados antes del brief). Se crea al escribir
  // en vez de esconder los campos: si el usuario tiene la idea en la cabeza,
  // el sitio para ponerla tiene que estar ahí.
  const upNarr = (parche) => setCfg((c) => ({ ...c, narrativa: { ...(c.narrativa || {}), ...parche } }));
  const [nombreProy, setNombreProy] = useState("");
  const [rolCustom, setRolCustom] = useState("");
  const fuentes = computeFuentes(cfg);
  const rows = computeRows(cfg);
  const colsResumen = "28px minmax(140px,1.6fr) minmax(110px,1fr) 54px 54px 54px";
  const total = rows.length ? rows[rows.length - 1].tout : 0;
  // Lo que de verdad pone el presupuesto en perspectiva: cuánto cuesta cada
  // segundo que sobrevive al corte final. Se divide entre la DURACIÓN OBJETIVO
  // —lo que la pieza debe durar terminada— y, si no hay objetivo, entre lo que
  // suma la escaleta. Nunca entre la duración del guion: el guion es un
  // borrador de esa duración, no la duración de entrega.
  const segundos = objetivoSegDe(cfg) || rows.reduce((a, r) => a + (r.dur || 0), 0);
  const costoSegundo = porSegundo(cfg.perfil?.presupuesto, segundos);


  const up = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const upCam = (id, patch) => setCfg((c) => ({ ...c, camaras: c.camaras.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
  const upMic = (id, patch) => setCfg((c) => ({ ...c, microfonos: (c.microfonos || []).map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const upExtra = (id, patch) => setCfg((c) => ({ ...c, extras: c.extras.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));

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
  const dndCam = useReorder(moveCamTo);
  const addRol = (rol, icon) => setCfg((c) =>
    c.personal.some((p) => p.rol.toLowerCase() === rol.toLowerCase()) ? c : { ...c, personal: [...c.personal, { id: uid(), rol, icon }] });
  const delRol = (id) => setCfg((c) => ({ ...c, personal: c.personal.filter((p) => p.id !== id) }));

  return (
    <div className={grupo === "perfil" ? "mesa" : "rejilla-tarjetas"}>
      {/* Proyectos (solo versión web: en la app de escritorio los proyectos los maneja el shell) */}
      {ver('perfil') && !EMBEDDED && (
      <Card title="Proyectos" open={false}>
        <div className="flex flex-wrap gap-2">
          <Btn rango={2} onClick={() => setCfg(normalizeCfg(BLANCO()))}><FilePlus size={15} /> Nuevo (en blanco)</Btn>
          <Btn rango={2} onClick={() => setCfg(normalizeCfg(DEMO()))}><FolderOpen size={15} /> Cargar ejemplo UASLP</Btn>
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
                <span className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--tinta)" }}>{p.nombre}</span>
                <span className="text-xs text-slate-400">{new Date(p.fecha).toLocaleDateString()}</span>
                <Btn rango={2} onClick={() => cargar(p)}>Abrir</Btn>
                <button className="b-min b-min-x" onClick={() => eliminar(p)} aria-label="Eliminar"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">Los proyectos se guardan en este navegador y tu trabajo actual se autoguarda automáticamente.</p>
      </Card>)}

      {/* LA MESA DE INSTRUMENTOS — etapa 1
          Antes: una sola losa larga con filas de campos. Antes de eso, TRES
          cajas de 39, 296 y 527 px de alto una junto a otra.
          Ahora cuatro BAHÍAS de distinto tamaño, cada una con su gelatina, en
          el orden en que de verdad se piensa un proyecto: quién es → para
          quién → qué dice → con cuánto. */}
      {ver('perfil') && (<>

      <Card
        title="Identidad"
        gel="rosa"
        className="b7"
        resumen={[cfg.titulo || "Sin título", perfil.formato, perfil.genero].filter(Boolean).join(" • ")}
      >
        <Campos>
          <Campo etiqueta="Título principal" value={cfg.titulo}
            onChange={(e) => up({ titulo: e.target.value })} className="col-2" />
          <Campo etiqueta="Subtítulo" value={cfg.subtitulo}
            onChange={(e) => up({ subtitulo: e.target.value })} className="col-2" />
          <Campo etiqueta="Organización" value={cfg.organizacion}
            onChange={(e) => up({ organizacion: e.target.value })} />
          <Campo etiqueta="Género" list="generos" placeholder="Comercial, documental…"
            value={perfil.genero} onChange={(e) => upPerfil({ genero: e.target.value })} />
          <datalist id="generos">
            {["Ficción", "Documental", "Comercial de producto", "Videoclip",
              "Reportaje", "Institucional", "Programa en vivo"].map((g) => <option key={g} value={g} />)}
          </datalist>
          <Campo etiqueta="Fecha de entrega" type="date" ancho="medio"
            value={perfil.entrega} onChange={(e) => upPerfil({ entrega: e.target.value })} />
          <ColorPickerField
            etiqueta="Color de marca"
            value={cfg.branding?.primaryColor || "#1D6FD1"}
            onChange={(e) => setCfg((c) => ({ ...c, branding: { ...(c.branding || {}), primaryColor: e.target.value } }))}
          />
          <div className="campo">
            <span className="campo-et">Logotipo</span>
            <div className="flex items-center gap-2.5 flex-wrap">
              {cfg.branding?.logoDataUrl && (
                <div className="logo-preview-box">
                  <img src={cfg.branding.logoDataUrl} alt="Logotipo actual" className="logo-preview-img" />
                </div>
              )}
              <Btn rango={2} icono={Upload} onClick={() => logoRef.current?.click()} className="btn-upload-logo">
                {cfg.branding?.logoDataUrl ? "Cambiar logo" : "Subir logotipo"}
              </Btn>
              {cfg.branding?.logoDataUrl && (
                <Btn rango="x" icono={X} titulo="Quitar el logotipo"
                  onClick={() => setCfg((c) => ({ ...c, branding: { ...(c.branding || {}), logoDataUrl: "" } }))} />
              )}
              <input ref={logoRef} type="file" hidden
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => importLogo(e.target.files?.[0])} />
            </div>
          </div>
        </Campos>
        <Formatos valor={perfil.formato} sugerido={formatoSugerido(perfil.medios)}
          onChange={(f) => upPerfil({ formato: f })} />
      </Card>

      <Card
        title="El encargo"
        gel="azul"
        className="b5"
        resumen={[perfil.receptor || perfil.emisor, perfil.edad ? `${perfil.edad} años` : null, perfil.alcance].filter(Boolean).join(" • ") || "Público y alcance"}
      >
        <Campos>
          <Campo etiqueta="Emisor — quién produce" placeholder="FCC-UASLP, taller de documental"
            value={perfil.emisor} onChange={(e) => upPerfil({ emisor: e.target.value })} className="col-2" />
          <Campo etiqueta="Receptor — a quién le hablas" placeholder="Estudiantes de la facultad"
            value={perfil.receptor} onChange={(e) => upPerfil({ receptor: e.target.value })} className="col-2" />
          <Campo etiqueta="Edad" ancho="corto" placeholder="18 a 25"
            value={perfil.edad} onChange={(e) => upPerfil({ edad: e.target.value })} />
          <label className="campo">
            <span className="campo-et">Alcance</span>
            <select className="campo-caja" value={perfil.alcance}
              onChange={(e) => upPerfil({ alcance: e.target.value })}>
              <option value="">Sin definir</option>
              {ALCANCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="campo col-2">
            <span className="campo-et">Qué tanto sabe ya del tema</span>
            <select className="campo-caja" value={perfil.conocimiento}
              onChange={(e) => upPerfil({ conocimiento: e.target.value })}>
              <option value="">Sin definir</option>
              {CONOCIMIENTOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </Campos>
        <Chips titulo="Dónde lo va a ver"
          ayuda="Define formato, duración y hasta el encuadre."
          opciones={MEDIOS} valor={perfil.medios} onChange={(v) => upPerfil({ medios: v })} />
      </Card>

      <Card
        title="La idea"
        gel="rosa"
        className="b8"
        resumen={perfil.mensaje ? `"${perfil.mensaje.slice(0, 45)}${perfil.mensaje.length > 45 ? '…' : ''}"` : (perfil.tono || "Mensaje y narrativa")}
      >
        <div className="seccion crece">
          <Campos>
            <Campo etiqueta="Mensaje — la idea en una frase" area rows={2}
              placeholder="Lo que quieres que se lleve quien lo vea"
              value={perfil.mensaje} onChange={(e) => upPerfil({ mensaje: e.target.value })} className="col-2" />
            <Campo etiqueta="Logline — la historia en una frase" area rows={2}
              placeholder="Un protagonista quiere algo, pero algo se lo impide"
              value={cfg.narrativa?.logline || ""} onChange={(e) => upNarr({ logline: e.target.value })} className="col-2" />
          </Campos>
        </div>
        <Campos>
          <Campo etiqueta="Llamada a la acción" placeholder="Qué quieres que haga al terminar de verlo"
            value={cfg.narrativa?.cta || ""} onChange={(e) => upNarr({ cta: e.target.value })} className="col-2" />
          <Campo etiqueta="Tono" placeholder="Cómico, solemne, íntimo…"
            value={perfil.tono} onChange={(e) => upPerfil({ tono: e.target.value })} />
          <Campo etiqueta="Referencias — a qué se debe parecer"
            placeholder="Una película, un spot, un video que ya existe"
            value={perfil.referencias} onChange={(e) => upPerfil({ referencias: e.target.value })} />
        </Campos>
        <Chips titulo="Intención — qué quieres que pase en quien lo vea"
          opciones={IMPACTOS} valor={perfil.intencion} onChange={(v) => upPerfil({ intencion: v })} />
      </Card>

      <Card
        title="Recursos"
        gel="ambar"
        className="b4"
        resumen={perfil.presupuesto ? `$${Number(perfil.presupuesto).toLocaleString("es-MX")} MXN` : "Presupuesto y costos"}
      >
        {segundos > 0 && costoSegundo != null && (
          <Lectura cifra={`$${costoSegundo.toLocaleString("es-MX")}`} pie="por segundo en pantalla" />
        )}
        <Campos>
          <Campo etiqueta="Presupuesto (MXN)" ancho="corto" inputMode="numeric" placeholder="0"
            className="mono" value={perfil.presupuesto}
            onChange={(e) => upPerfil({ presupuesto: e.target.value.replace(/[^\d.]/g, "") })} />
          <Campo etiqueta="¿De dónde sale el dinero?" placeholder="Beca, recursos propios, patrocinio…"
            value={perfil.presupuestoNota} onChange={(e) => upPerfil({ presupuestoNota: e.target.value })}
            className="col-2" />
        </Campos>
        <Tabulador perfil={perfil} onChange={(reparto) => upPerfil({ reparto })} />
      </Card>

      </>)}

      {/* Cámaras */}
      {ver('necesidades') && (
      <Card title="Fuentes de video" ancho>
        <Seccion titulo="Cámaras"
          pista="Cada cámara es una fuente del switcher y una silueta en el plano del set.">
          <datalist id="planos">{PLANOS.map((p) => <option key={p} value={p} />)}</datalist>
          <div className="rejilla-filas">
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
                <input className={inp} style={{ ...inpStyle, flex: "1 1 150px", maxWidth: 280 }} value={c.nombre} onChange={(e) => upCam(c.id, { nombre: e.target.value })} />
                <input className={inp} style={{ ...inpStyle, flex: "1 1 160px" }} list="planos" placeholder="Tipo de plano…" value={c.plano} onChange={(e) => upCam(c.id, { plano: e.target.value })} />
                <span className="flex gap-0.5 shrink-0">
                  <button className="b-min" onClick={() => moveCam(i, -1)} disabled={i === 0} aria-label="Subir cámara"><ChevronUp size={16} /></button>
                  <button className="b-min" onClick={() => moveCam(i, 1)} disabled={i === cfg.camaras.length - 1} aria-label="Bajar cámara"><ChevronDown size={16} /></button>
                  <button className="b-min b-min-x" onClick={() => delCam(c.id)} disabled={cfg.camaras.length <= 1} aria-label="Eliminar cámara"><Trash2 size={16} /></button>
                </span>
              </div>
              <Swatches value={c.color} onChange={(col) => upCam(c.id, { color: col })} />
            </div>
          ))}
          </div>
          <Btn rango={1} className="self-start" onClick={addCam} disabled={cfg.camaras.length >= 8}
            titulo={cfg.camaras.length >= 8 ? "Máximo 8 cámaras" : "Agregar una cámara al proyecto"}>
            <Plus size={15} /> Agregar cámara {cfg.camaras.length >= 8 ? "(máx. 8)" : ""}
          </Btn>
        </Seccion>

        <Seccion titulo="Otras fuentes"
          pista="Lo que entra al programa sin ser cámara: comerciales, VTR, gráficos.">
          <div className="rejilla-filas">
          {cfg.extras.map((x) => (
            <div key={x.id} className="rounded-lg border p-2 flex flex-col gap-2" style={{ borderColor: "#DDE4EC" }}>
              <div className="flex flex-wrap items-center gap-2">
                <input className={inp} style={{ ...inpStyle, flex: "1 1 140px" }} value={x.nombre} onChange={(e) => upExtra(x.id, { nombre: e.target.value })} />
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0">
                  <input type="checkbox" checked={!!x.esCorte} onChange={(e) => upExtra(x.id, { esCorte: e.target.checked })} />
                  Es corte comercial
                </label>
                <button className="b-min b-min-x" onClick={() => delExtra(x.id)} aria-label="Eliminar fuente"><Trash2 size={16} /></button>
              </div>
              <Swatches value={x.color} onChange={(col) => upExtra(x.id, { color: col })} />
            </div>
          ))}
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-1">Agregar fuente común</p>
            <div className="flex flex-wrap gap-1.5">
              {CATALOGO_FUENTES.map((f) => (
                <button key={f.nombre} onClick={() => addFuente(f)}
                  className="b-agregar" title={`Agregar ${f.nombre} como fuente`}>
                  <span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: f.color }} /> + {f.nombre}
                </button>
              ))}
            </div>
          </div>
          </div>
          <Btn rango={2} icono={Plus} className="self-start" onClick={addExtra}>Agregar fuente en blanco</Btn>
        </Seccion>
      </Card>)}

      {ver('necesidades') && (
      <Card title="Personas y sonido" ancho>
        <Seccion titulo="Talentos"
          pista="Quién aparece en cámara. Sus posiciones se arrastran en el plano del set.">
          <div className="rejilla-filas">
          {(cfg.talentos || []).map((t) => {
            const micsT = (cfg.microfonos || []).filter((m) => m.asignadoA === `tal:${t.id}`);
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "#DDE4EC" }}>
                <User size={16} color={t.tipo === "invitado" ? "#0E9F9E" : NAVY} />
                <input className={inp} style={{ ...inpStyle, flex: "1 1 200px" }} value={t.nombre} onChange={(e) => upTal(t.id, { nombre: e.target.value })} />
                <select className={inp} style={{ ...inpStyle, flex: "1 1 150px", minWidth: 130 }} value={t.tipo} onChange={(e) => upTal(t.id, { tipo: e.target.value })}>
                  <option value="conductor">Conductor(a)</option>
                  <option value="invitado">Invitado(a)</option>
                </select>
                <span className="text-xs text-slate-500 shrink-0">
                  {micsT.length ? micsT.map((m) => MIC_TIPO_CORTO[m.micTipo] || "mic").join(" + ") : "sin micrófono"}
                </span>
                <button className="b-min b-min-x" onClick={() => delTal(t.id)} aria-label="Eliminar talento"><Trash2 size={16} /></button>
              </div>
            );
          })}
          </div>
          <Btn rango={1} icono={Plus} className="self-start" onClick={addTal}>Agregar talento</Btn>
          <p className="text-xs text-slate-500">El micrófono se les asigna en la sección Micrófonos (solapa, dinámico…). Sus posiciones se arrastran en la pestaña Set.</p>
        </Seccion>

        <Seccion titulo="Micrófonos"
          pista="A cada talento se le asigna aquí su micrófono; el tipo decide cómo se dibuja en el plano.">
          <div className="rejilla-filas">
          {(cfg.microfonos || []).map((m) => {
            const micTipo = m.micTipo || "dinamico";
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "#DDE4EC" }}>
                <Mic size={16} color="#1FA14E" />
                <input className={inp} style={{ ...inpStyle, flex: "1 1 150px" }} value={m.nombre} onChange={(e) => upMic(m.id, { nombre: e.target.value })} />
                <select className={inp} style={{ ...inpStyle, flex: "1 1 170px", minWidth: 145 }} value={micTipo} title="Tipo de micrófono"
                  onChange={(e) => upMic(m.id, { micTipo: e.target.value, asignadoA: e.target.value === "boom" ? "set" : "" })}>
                  {MIC_TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {micTipo !== "boom" && (
                  <select className={inp} style={{ ...inpStyle, flex: "1 1 165px", minWidth: 140 }} value={m.asignadoA || ""} title={micTipo === "shotgun" ? "Cámara donde va montado" : "Talento que lo porta"}
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
                <button className="b-min b-min-x" onClick={() => delMic(m.id)} aria-label="Eliminar micrófono"><Trash2 size={16} /></button>
              </div>
            );
          })}
          </div>
          <Btn rango={1} icono={Plus} className="self-start" onClick={addMic}>Agregar micrófono</Btn>
          <p className="text-xs text-slate-500">Boom = perchado con posición propia en el set · Shotgun = montado en una cámara · Solapa y dinámico = los porta un talento.</p>
        </Seccion>
      </Card>)}

      {ver('necesidades') && (
      <Card title="Equipo y flujo" ancho>
        <Seccion titulo="Personal de operación"
          pista="Los puestos que hacen falta detrás de cámara.">
          <div className="flex flex-wrap gap-1.5">
            {cfg.personal.map((p) => {
              const Ic = ICONS[p.icon] || User;
              return (
                <span key={p.id} className="flex items-center gap-1.5 rounded-full border pl-2 pr-1 py-1 text-xs font-semibold"
                  style={{ borderColor: "var(--vidrio-borde)", color: "var(--tinta)" }}>
                  <Ic size={13} /> {p.rol}
                  <button className="b-min b-min-x" onClick={() => delRol(p.id)} aria-label={`Quitar ${p.rol}`}><X size={13} /></button>
                </span>
              );
            })}
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-1">Agregar rol común</p>
            <div className="flex flex-wrap gap-1.5">
              {CATALOGO_ROLES.filter((r) => !cfg.personal.some((p) => p.rol === r.rol)).map((r) => (
                <button key={r.rol} className="b-agregar" title={`Agregar ${r.rol} al equipo`}
                  onClick={() => addRol(r.rol, r.icon)}>+ {r.rol}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input className={`${inp} a-largo`} style={inpStyle} placeholder="Rol personalizado…" value={rolCustom} onChange={(e) => setRolCustom(e.target.value)} />
            <button className={`${btn} shrink-0`} style={{ background: "var(--vidrio-a)", color: "var(--tinta)" }}
              onClick={() => { if (rolCustom.trim()) { addRol(rolCustom.trim(), "custom"); setRolCustom(""); } }}>
              <Plus size={15} /> Agregar
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--tinta)" }}>
            <input type="checkbox" checked={cfg.includeCamOps} onChange={(e) => up({ includeCamOps: e.target.checked })} />
            Incluir operadores de cámara automáticamente (uno por cámara)
          </label>
        </Seccion>

        <Seccion titulo="Flujo de producción"
          pista="Cómo viaja la señal desde la cámara hasta quien lo ve.">
          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--tinta)" }}>
            <input type="checkbox" checked={(cfg.flujo || {}).preview !== false} onChange={(e) => up({ flujo: { ...(cfg.flujo || {}), preview: e.target.checked } })} />
            Incluir monitor PREVIEW
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--tinta)" }}>
            <input type="checkbox" checked={(cfg.flujo || {}).playback !== false} onChange={(e) => up({ flujo: { ...(cfg.flujo || {}), playback: e.target.checked } })} />
            Incluir playback de comerciales / cortinillas
          </label>
          <p className="text-xs text-slate-500">Las cámaras del flujo y los monitores de cabina se generan automáticamente desde la sección de cámaras.</p>
        </Seccion>
      </Card>)}

      {ver('tiempos') && (
      <Card title="Tiempos y salida a edición" ancho>
        {/* AQUÍ YA NO SE EDITA LA ESCALETA, Y ES A PROPÓSITO.
            Esta sección era una segunda lista de segmentos —nombre, duración,
            fuente, notas, reordenar, borrar— casi idéntica a la de "Escaleta
            editorial". Dos pantallas para lo mismo: se editaba en una, se
            volvía a la otra y no quedaba claro cuál mandaba.
            El reparto ahora: la escaleta se ARMA en su pestaña; aquí se MIRAN
            los tiempos ya calculados y se sacan al editor de video, que es lo
            que dice el nombre de la sección. Lo único que vivía solo aquí —la
            fuente al aire y la nota de cada segmento— se mudó a la escaleta
            editorial, así que no se perdió nada. */}
        <Seccion titulo={`Resumen de tiempos — total ${fmt(total)}`}
          pista="Los mismos segmentos de la escaleta, con sus tiempos ya calculados.">
          <p className="text-xs text-slate-500" style={{ marginTop: -6 }}>
            Esto no se edita aquí: el orden, los nombres y las duraciones se cambian en
            <b> Guion ▸ Escaleta y guion técnico ▸ Escaleta editorial</b>. IN, OUT y el total se recalculan solos.
          </p>
          <div className="grid gap-1 text-[10px] font-bold uppercase text-slate-500" style={{ gridTemplateColumns: colsResumen }}>
            <span>#</span><span>Segmento</span><span>Fuente</span>
            <span className="text-center">In</span><span className="text-center">Out</span><span className="text-center">Dur</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid items-center gap-1 text-xs" style={{ gridTemplateColumns: colsResumen, color: "var(--tinta)" }}>
              <span className="font-bold text-slate-400">{r.idx}</span>
              <span>{r.segmento || "—"}</span>
              <span className="text-slate-500">{fuentes.find((f) => f.id === r.fuente)?.nombre || "—"}</span>
              <span className="text-center text-slate-500">{fmt(r.tin)}</span>
              <span className="text-center text-slate-500">{fmt(r.tout)}</span>
              <span className="text-center font-bold">{fmt(r.dur)}</span>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-slate-400">La escaleta está vacía todavía.</p>}
        </Seccion>

        <Seccion titulo="Análisis de tiempos"
          pista="Si algo se pasa o falta, se ve aquí antes de grabar.">
          <AnalisisTiempos cfg={cfg} />
        </Seccion>

        <Seccion titulo="Exportar para edición"
          pista="Los mismos tiempos, en el formato que entiende tu editor de video.">
          <p className="text-xs text-slate-500" style={{ marginTop: -6 }}>
            Lleva la escaleta a tu editor. El <b>EDL</b> crea cortes en la línea de tiempo (DaVinci Resolve / Premiere / Avid).
            El <b>CSV</b> abre en Excel/Sheets y sirve como lista de marcadores. Los nombres y notas viajan como comentarios.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} text-white`} style={{ background: NAVY }}
              onClick={() => descargarArchivo(`${slug(cfg.titulo)}.edl`, generarEDL(cfg))}>
              <Download size={15} /> Descargar EDL
            </button>
            <button className={btn} style={{ background: "var(--vidrio-a)", color: "var(--tinta)" }}
              onClick={() => descargarArchivo(`${slug(cfg.titulo)}.csv`, generarCSV(cfg), "text/csv")}>
              <Download size={15} /> Descargar CSV
            </button>
          </div>
        </Seccion>
      </Card>)}
    </div>
  );
}

import React, { useState, useMemo } from "react";
import { X, Trash2, Plus } from "lucide-react";
import {
  TIPOS_PROYECTO, TIPOS_NO_NARRATIVOS, IMPACTOS, EMOCIONES, ESTRUCTURAS,
  ENCUADRES, PERCEPCIONES, MOVIMIENTOS_W, VOCES, MUSICAS,
  MODALIDADES_CLIP, RELACION_MUSICA, PRESENCIAS_ARTISTA,
  loglineDe, escenasDe, planoPorEncuadre, anguloPorPercepcion, alertasDe, construirProyectoNarrativo,
} from "./narrativa.js";
import { TIPO_DESDE_PLANTILLA, TONOS } from "./catalogos.js";
import { NAVY, INK } from "./theme.js";
import { inp, inpStyle, btn } from "./ui.js";
import { fmt } from "./util.js";

/* --------------------- Asistente narrativo (wizard global) ---------------------
Recorrido completo del MVP: tipo → (canción, si es videoclip) → intención →
premisa → personajes → estructura → escenas → imagen → sonido → recursos →
generación de escaleta y guion técnico. La unidad central es la escena: en su
ficha convergen narración, imagen, sonido y recursos. Se abre desde la
pestaña Escaleta o automáticamente al crear un proyecto desde Inicio. */

export function AsistenteNarrativo({ cfg, setCfg, onClose, onGenerado }) {
  // Si el tipo ya viene resuelto (plantilla de Inicio o narrativa previa),
  // el paso Tipo se salta para no preguntar dos veces (Atrás lo recupera).
  const [paso, setPaso] = useState(() => ((cfg.narrativa?.tipo || TIPO_DESDE_PLANTILLA[cfg.plantilla]) ? 1 : 0));
  const [confirma, setConfirma] = useState(false);
  const [n, setN] = useState(() => ({
    tipo: TIPO_DESDE_PLANTILLA[cfg.plantilla] || "", tema: "", mensaje: "", emocion: "", audiencia: "", impacto: "", cta: "", plataforma: "",
    tono: "", sinopsis: "",
    premisa: {}, personajes: [{ nombre: "", quiere: "", obstaculo: "", cambio: "", necesita: "", teme: "", defecto: "" }],
    estructura: "tresactos", durMin: 5, escenas: null, cancion: {}, produccion: {},
    ...(cfg.narrativa || {}),
  }));
  const up = (patch) => setN((x) => ({ ...x, ...patch }));
  const upPre = (k, v) => setN((x) => ({ ...x, premisa: { ...x.premisa, [k]: v } }));
  const upPersonaje = (i, k, v) => setN((x) => ({ ...x, personajes: x.personajes.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const upEscena = (i, k, v) => setN((x) => ({ ...x, escenas: (x.escenas || []).map((e, j) => (j === i ? { ...e, [k]: v } : e)) }));
  const upCancion = (k, v) => setN((x) => ({ ...x, cancion: { ...x.cancion, [k]: v } }));
  const upProd = (k, v) => setN((x) => ({ ...x, produccion: { ...x.produccion, [k]: v } }));
  const noNarr = TIPOS_NO_NARRATIVOS.includes(n.tipo);
  const logline = loglineDe(n);
  const PASOS = ["Tipo", ...(n.tipo === "videoclip" ? ["Canción"] : []), "Intención", "Premisa", "Personajes", "Estructura", "Escenas", "Imagen", "Sonido", "Recursos", "Generar"];
  const actual = PASOS[Math.min(paso, PASOS.length - 1)];
  const escenasPrev = useMemo(() => escenasDe(n, { durTotalSeg: Math.max(1, n.durMin || 5) * 60 }), [n]);
  const alertas = useMemo(() => alertasDe(n, { hayAudioCrew: (cfg.personal || []).some((p) => p.icon === "audio") }), [n, cfg.personal]);

  const siguiente = () => {
    // De premisa a personajes: el protagonista hereda la premisa.
    if (actual === "Premisa" && !noNarr && !n.personajes[0]?.nombre && n.premisa.quien) {
      setN((x) => ({ ...x, personajes: [{ ...x.personajes[0], nombre: x.premisa.quien, quiere: x.premisa.quiere || "", obstaculo: x.premisa.obstaculo || "" }, ...x.personajes.slice(1)] }));
    }
    // De estructura a escenas: sembrar una ficha por beat (conserva lo capturado).
    if (actual === "Estructura") {
      const beats = (ESTRUCTURAS[n.estructura] || ESTRUCTURAS.sencilla).beats;
      setN((x) => ({ ...x, escenas: beats.map((b, i) => ({ ...(x.escenas?.[i] || {}), titulo: x.escenas?.[i]?.titulo || b[0] })) }));
    }
    setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  };

  const generar = () => {
    if ((cfg.escaleta || []).length && !confirma) { setConfirma(true); return; }
    setCfg((c) => construirProyectoNarrativo(c, n));
    onGenerado();
  };

  const lbl = "flex flex-col gap-1 text-xs font-bold uppercase";
  const lblStyle = { color: "#5F7189" };
  const campo = (etiqueta, valor, onCh, placeholder, multi) => (
    <label className={lbl} style={lblStyle}>{etiqueta}
      {multi
        ? <textarea className={inp} style={inpStyle} rows={2} value={valor || ""} placeholder={placeholder || ""} onChange={(e) => onCh(e.target.value)} />
        : <input className={inp} style={inpStyle} value={valor || ""} placeholder={placeholder || ""} onChange={(e) => onCh(e.target.value)} />}
    </label>
  );
  const chips = (lista, valor, onCh) => (
    <div className="flex flex-wrap gap-1.5">
      {lista.map((x) => (
        <button key={x} onClick={() => onCh(valor === x ? "" : x)} className="rounded-full border px-3 py-1 text-xs font-bold"
          style={valor === x ? { background: NAVY, color: "#fff", borderColor: NAVY } : { borderColor: "#C8D2DE", color: INK }}>{x}</button>
      ))}
    </div>
  );
  const sel = (valor, onCh, opciones, vacio) => (
    <select className={inp} style={inpStyle} value={valor || ""} onChange={(e) => onCh(e.target.value)}>
      <option value="">{vacio || "—"}</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  const fichaEscena = (i) => {
    const beats = (ESTRUCTURAS[n.estructura] || ESTRUCTURAS.sencilla).beats;
    return beats[i % beats.length]?.[1] || "";
  };
  const cabeceraEscena = (e, i) => (
    <div className="flex items-center gap-2">
      <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: NAVY }}>{i + 1}</span>
      <b className="text-sm">{e.titulo || `Escena ${i + 1}`}</b>
      <small className="text-slate-400">{fichaEscena(i)}</small>
    </div>
  );
  const sugerida = n.durMin <= 2 ? "sencilla" : n.durMin <= 6 ? "tresactos" : "harmon";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(9,20,35,.6)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ background: NAVY }}>
          <span className="text-lg">✦</span>
          <b className="text-white">Asistente narrativo</b>
          <span className="flex-1" />
          {PASOS.map((p, i) => (
            <span key={p} className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={i === paso ? { background: "#FFD23F", color: "#15233D" } : { color: i < paso ? "#9DC1EC" : "#5B79A6" }}>{p}</span>
          ))}
          <button onClick={onClose} className="ml-1 text-white/70 hover:text-white" aria-label="Cerrar asistente"><X size={17} /></button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5" style={{ color: INK }}>
          {actual === "Tipo" && (<>
            <p className="m-0 text-sm font-bold">¿Qué clase de proyecto vas a producir?</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {TIPOS_PROYECTO.map((t) => (
                <button key={t.id} onClick={() => up({ tipo: t.id })} className="flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left"
                  style={n.tipo === t.id ? { borderColor: NAVY, background: "#EDF3FB", boxShadow: `0 0 0 1px ${NAVY}` } : { borderColor: "#C8D2DE" }}>
                  <span className="text-xl">{t.icono}</span>
                  <b className="text-sm">{t.nombre}</b>
                  <small className="text-slate-500">{t.detalle}</small>
                </button>
              ))}
            </div>
          </>)}

          {actual === "Canción" && (<>
            <p className="m-0 text-sm font-bold">La canción aporta la estructura temporal del videoclip.</p>
            <div className="grid grid-cols-2 gap-3">
              {campo("Canción o referencia musical", n.cancion.ref, (v) => upCancion("ref", v), "Artista — título")}
              <label className={lbl} style={lblStyle}>Duración (m:ss)
                <input className={inp} style={inpStyle} value={n.cancion.durTxt || ""} placeholder="3:40"
                  onChange={(e) => {
                    const v = e.target.value;
                    const m = v.match(/^(\d+):(\d{1,2})$/);
                    const durSeg = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
                    upCancion("durTxt", v);
                    if (durSeg) { upCancion("durSeg", durSeg); up({ durMin: Math.round((durSeg / 60) * 10) / 10 }); }
                  }} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {campo("BPM (opcional)", n.cancion.bpm, (v) => upCancion("bpm", v), "120")}
              {campo("Secciones (intro, verso, coro…)", n.cancion.secciones, (v) => upCancion("secciones", v), "intro · verso · coro · puente · cierre")}
            </div>
            {campo("Golpes musicales importantes (puntos de sincronización)", n.cancion.golpes, (v) => upCancion("golpes", v), "0:42 entra el coro · 2:10 corte seco…")}
            <label className={lbl} style={lblStyle}>Modalidad{chips(MODALIDADES_CLIP, n.cancion.modalidad, (v) => upCancion("modalidad", v))}</label>
            <label className={lbl} style={lblStyle}>Relación entre música e imagen{chips(RELACION_MUSICA, n.cancion.relacion, (v) => upCancion("relacion", v))}</label>
            <label className={lbl} style={lblStyle}>Presencia del artista{chips(PRESENCIAS_ARTISTA, n.cancion.presencia, (v) => upCancion("presencia", v))}</label>
          </>)}

          {actual === "Intención" && (<>
            <p className="m-0 text-sm font-bold">Intención comunicativa: ¿qué quieres provocar y en quién?</p>
            {campo("¿Cuál es el tema?", n.tema, (v) => up({ tema: v }), "De qué trata realmente el proyecto")}
            {campo("¿Qué debe comprender el espectador? (mensaje clave)", n.mensaje, (v) => up({ mensaje: v }), "", true)}
            <label className={lbl} style={lblStyle}>¿Qué quieres que sienta? (emoción principal){chips(EMOCIONES, n.emocion, (v) => up({ emocion: v }))}</label>
            <label className={lbl} style={lblStyle}>Impacto principal{chips(IMPACTOS, n.impacto, (v) => up({ impacto: v }))}</label>
            <div className="grid grid-cols-2 gap-3">
              {campo("¿A quién va dirigido?", n.audiencia, (v) => up({ audiencia: v }), "Audiencia")}
              {campo("¿Dónde será exhibido?", n.plataforma, (v) => up({ plataforma: v }), "YouTube, sala, redes, TV…")}
            </div>
            {campo("¿Qué debe hacer después de verlo? (llamada a la acción)", n.cta, (v) => up({ cta: v }))}
          </>)}

          {actual === "Premisa" && (<>
            <p className="m-0 text-sm font-bold">Premisa y concepto: completa la fórmula.</p>
            {noNarr ? (<>
              <p className="m-0 text-xs text-slate-500">Este proyecto explora <b>[tema]</b> desde <b>[punto de vista]</b> para demostrar, cuestionar o comunicar <b>[idea central]</b>.</p>
              {campo("Explora… (tema)", n.premisa.quien, (v) => upPre("quien", v))}
              {campo("Desde… (punto de vista)", n.premisa.quiere, (v) => upPre("quiere", v))}
              <label className={lbl} style={lblStyle}>Para…{chips(["demostrar", "cuestionar", "comunicar"], n.premisa.accion, (v) => upPre("accion", v))}</label>
              {campo("Idea central", n.premisa.obstaculo, (v) => upPre("obstaculo", v))}
            </>) : (<>
              <p className="m-0 text-xs text-slate-500">Esta es la historia de <b>[protagonista]</b>, que quiere <b>[objetivo]</b>, pero se enfrenta a <b>[obstáculo]</b>, por lo que debe <b>[acción]</b> antes de <b>[consecuencia o límite]</b>.</p>
              {campo("Protagonista o sujeto", n.premisa.quien, (v) => upPre("quien", v))}
              {campo("Quiere… (objetivo)", n.premisa.quiere, (v) => upPre("quiere", v))}
              {campo("Pero se enfrenta a… (obstáculo)", n.premisa.obstaculo, (v) => upPre("obstaculo", v))}
              {campo("Por lo que debe… (acción principal)", n.premisa.accion, (v) => upPre("accion", v))}
              {campo("Antes de… (consecuencia o límite)", n.premisa.limite, (v) => upPre("limite", v))}
            </>)}
            {logline && <p className="m-0 rounded-lg border p-3 text-sm italic" style={{ borderColor: "#C8D2DE", background: "#F8FAFC" }}>{logline}</p>}
            <label className={lbl} style={lblStyle}>Tono{chips(TONOS, n.tono, (v) => up({ tono: v }))}</label>
            {campo("Sinopsis corta (opcional)", n.sinopsis, (v) => up({ sinopsis: v }), "Resumen en 2 o 3 líneas", true)}
          </>)}

          {actual === "Personajes" && (<>
            <p className="m-0 text-sm font-bold">{noNarr ? "Sujetos principales: relación con el tema, punto de vista y acceso." : "Personajes: imperfectos y motivados generan identificación."} <span className="font-normal text-slate-500">Al generar, se vuelven los talentos del proyecto (micrófono y personal automáticos).</span></p>
            {n.personajes.map((p, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "#C8D2DE" }}>
                <div className="flex items-center justify-between">
                  <b className="text-xs uppercase text-slate-500">{noNarr ? `Sujeto ${i + 1}` : i === 0 ? "Protagonista" : `Personaje ${i + 1}`}</b>
                  {n.personajes.length > 1 && <button onClick={() => setN((x) => ({ ...x, personajes: x.personajes.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}
                </div>
                {campo("Nombre", p.nombre, (v) => upPersonaje(i, "nombre", v))}
                <div className="grid grid-cols-3 gap-2">
                  {campo(noNarr ? "Relación con el tema" : "¿Qué quiere?", p.quiere, (v) => upPersonaje(i, "quiere", v))}
                  {campo(noNarr ? "Punto de vista que representa" : "¿Qué se lo impide?", p.obstaculo, (v) => upPersonaje(i, "obstaculo", v))}
                  {campo(noNarr ? "Acceso y riesgo ético" : "¿Cómo cambia?", p.cambio, (v) => upPersonaje(i, "cambio", v))}
                </div>
                {!noNarr && (
                  <div className="grid grid-cols-3 gap-2">
                    {campo("¿Qué necesita sin saberlo?", p.necesita, (v) => upPersonaje(i, "necesita", v))}
                    {campo("¿Qué teme perder?", p.teme, (v) => upPersonaje(i, "teme", v))}
                    {campo("¿Qué defecto o contradicción tiene?", p.defecto, (v) => upPersonaje(i, "defecto", v))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setN((x) => ({ ...x, personajes: [...x.personajes, { nombre: "", quiere: "", obstaculo: "", cambio: "", necesita: "", teme: "", defecto: "" }] }))}
              className={`${btn} self-start border`} style={{ borderColor: "#C8D2DE", color: NAVY }}><Plus size={15} /> Agregar {noNarr ? "sujeto" : "personaje"}</button>
          </>)}

          {actual === "Estructura" && (<>
            <p className="m-0 text-sm font-bold">Estructura narrativa y duración objetivo.</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ESTRUCTURAS).map(([id, e]) => (
                <button key={id} onClick={() => up({ estructura: id })} className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left"
                  style={n.estructura === id ? { borderColor: NAVY, background: "#EDF3FB", boxShadow: `0 0 0 1px ${NAVY}` } : { borderColor: "#C8D2DE" }}>
                  <b className="text-sm">{e.nombre}{id === sugerida ? " · sugerida para tu duración" : ""}</b>
                  <small className="text-slate-500">{e.detalle}</small>
                  <small className="font-bold text-slate-400">{e.beats.length} escenas: {e.beats.map((b) => b[0]).join(" · ")}</small>
                </button>
              ))}
            </div>
            <label className={lbl} style={lblStyle}>Duración objetivo (minutos)
              <input type="number" min="1" max="120" step="0.5" className={inp} style={{ ...inpStyle, width: 110 }} value={n.durMin}
                onChange={(e) => up({ durMin: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
          </>)}

          {actual === "Escenas" && (<>
            <p className="m-0 text-sm font-bold">Constructor de escenas — la pregunta clave: <i>¿qué cambia como resultado de cada escena?</i></p>
            {(n.escenas || []).map((e, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "#C8D2DE" }}>
                {cabeceraEscena(e, i)}
                <div className="grid grid-cols-2 gap-2">
                  {campo("Título de la escena", e.titulo, (v) => upEscena(i, "titulo", v))}
                  {campo("Lugar y momento", e.lugar, (v) => upEscena(i, "lugar", v), "Foro 2, día / calle, noche…")}
                </div>
                <label className={lbl} style={{ color: e.cambio ? "#5F7189" : "#B45309" }}>¿Qué cambia como resultado de esta escena?{!e.cambio && " (sin esto puede ser prescindible)"}
                  <input className={inp} style={{ ...inpStyle, borderColor: e.cambio ? "#C8D2DE" : "#F0C36D" }} value={e.cambio || ""} onChange={(ev) => upEscena(i, "cambio", ev.target.value)} />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={lbl} style={lblStyle}>Emoción inicial{sel(e.emoIni, (v) => upEscena(i, "emoIni", v), EMOCIONES)}</label>
                  <label className={lbl} style={lblStyle}>Emoción final{sel(e.emoFin, (v) => upEscena(i, "emoFin", v), EMOCIONES)}</label>
                  <label className={lbl} style={lblStyle}>Duración (seg, opcional)
                    <input type="number" min="5" className={inp} style={inpStyle} value={e.dur || ""} placeholder={String(escenasPrev[i]?.dur || "")}
                      onChange={(ev) => upEscena(i, "dur", Number(ev.target.value) || 0)} />
                  </label>
                </div>
              </div>
            ))}
          </>)}

          {actual === "Imagen" && (<>
            <p className="m-0 text-sm font-bold">Diseño visual: elige la intención y la app recomienda la técnica.</p>
            {(n.escenas || []).map((e, i) => {
              const ang = e.percepcion ? anguloPorPercepcion(e.percepcion) : null;
              return (
                <div key={i} className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "#C8D2DE" }}>
                  {cabeceraEscena(e, i)}
                  <div className="grid grid-cols-3 gap-2">
                    <label className={lbl} style={lblStyle}>¿Qué debe mostrar el encuadre?
                      {sel(e.encuadre, (v) => upEscena(i, "encuadre", v), ENCUADRES.map((x) => x[0]))}
                      {e.encuadre && <small className="font-bold normal-case" style={{ color: NAVY }}>→ {planoPorEncuadre(e.encuadre)}</small>}
                    </label>
                    <label className={lbl} style={lblStyle}>¿Cómo percibimos al sujeto?
                      {sel(e.percepcion, (v) => upEscena(i, "percepcion", v), PERCEPCIONES.map((x) => x[0]))}
                      {ang && <small className="font-bold normal-case" style={{ color: NAVY }}>→ {ang[1]}: {ang[2]}</small>}
                    </label>
                    <label className={lbl} style={lblStyle} title="Pregunta de validación: ¿qué nueva información revela el movimiento?">Movimiento
                      {sel(e.mov, (v) => upEscena(i, "mov", v), MOVIMIENTOS_W)}
                    </label>
                  </div>
                </div>
              );
            })}
          </>)}

          {actual === "Sonido" && (<>
            <p className="m-0 text-sm font-bold">Diseño sonoro por escena — el sonido transforma lo que se ve (valor añadido).</p>
            {(n.escenas || []).map((e, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "#C8D2DE" }}>
                {cabeceraEscena(e, i)}
                <div className="grid grid-cols-2 gap-2">
                  <label className={lbl} style={lblStyle}>Voz y palabras{sel(e.voz, (v) => upEscena(i, "voz", v), VOCES)}</label>
                  <label className={lbl} style={lblStyle}>Música{sel(e.musica, (v) => upEscena(i, "musica", v), MUSICAS)}</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {campo("Sonidos (ambiente, acción, foley…)", e.sonidos, (v) => upEscena(i, "sonidos", v), "Tráfico lejano, pasos, lluvia en la ventana…")}
                  {campo("¿Qué escucha el espectador que aún no puede ver?", e.fueraCampo, (v) => upEscena(i, "fueraCampo", v), "Fuera de campo: anticipa, amplía el espacio")}
                </div>
              </div>
            ))}
          </>)}

          {actual === "Recursos" && (<>
            <p className="m-0 text-sm font-bold">Producción y viabilidad: ¿se puede grabar tal como lo diseñaste?</p>
            <div className="grid grid-cols-2 gap-3">
              {campo("Jornadas de grabación", n.produccion.jornadas, (v) => upProd("jornadas", v), "2 días")}
              {campo("Locaciones", n.produccion.locaciones, (v) => upProd("locaciones", v), "Foro 2 FCC, patio central…")}
              {campo("Equipo especial (soportes, estabilización, ópticas)", n.produccion.equipo, (v) => upProd("equipo", v), "Slider, gimbal, grúa…")}
              {campo("Formato de entrega", n.produccion.entrega, (v) => upProd("entrega", v), "MP4 1080p, DCP, vertical 9:16…")}
            </div>
            {campo("Permisos necesarios", n.produccion.permisos, (v) => upProd("permisos", v), "Locación, música, imagen de participantes…")}
            {campo("Riesgos a considerar", n.produccion.riesgos, (v) => upProd("riesgos", v), "Nocturno, vía pública, menores de edad…", true)}
            <div className="flex flex-col gap-1.5">
              <b className="text-xs uppercase text-slate-500">Alertas del proyecto</b>
              {alertas.length ? alertas.map((a, i) => (
                <p key={i} className="m-0 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#F0C36D", background: "#FEF7E6", color: "#8A5A00" }}>⚠ {a}</p>
              )) : <p className="m-0 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "#9BD8AE", background: "#F0FAF3", color: "#1F7A3D" }}>✓ Sin alertas: las decisiones creativas y los recursos coinciden.</p>}
            </div>
          </>)}

          {actual === "Generar" && (<>
            <p className="m-0 text-sm font-bold">Así quedará tu proyecto: escaleta, guion por escena y guion técnico con las decisiones de imagen y sonido.</p>
            {logline && <p className="m-0 rounded-lg border p-3 text-sm italic" style={{ borderColor: "#C8D2DE", background: "#F8FAFC" }}>{logline}</p>}
            <div className="flex flex-col gap-1.5">
              {escenasPrev.map((e, i) => (
                <div key={i} className="grid items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ gridTemplateColumns: "auto 1fr auto", borderColor: "#C8D2DE" }}>
                  <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: NAVY }}>{i + 1}</span>
                  <span><b>{e.segmento.replace(/^\d+\.\s*/, "")}</b> <small className="text-slate-500">— {e.tomas[0].plano}{e.tomas[0].mov !== "Fija" ? ` · ${e.tomas[0].mov}` : ""}</small></span>
                  <small className="text-slate-500">{fmt(e.dur)}</small>
                </div>
              ))}
            </div>
            {alertas.length > 0 && <p className="m-0 text-xs font-bold" style={{ color: "#8A5A00" }}>⚠ {alertas.length} alerta{alertas.length === 1 ? "" : "s"} de producción pendiente{alertas.length === 1 ? "" : "s"} (paso Recursos).</p>}
            {confirma && (
              <p className="m-0 rounded-lg border px-3 py-2 text-sm font-bold" style={{ borderColor: "#E8B4B4", background: "#FDF2F2", color: "#B4232A" }}>
                Ya existe una escaleta con {(cfg.escaleta || []).length} segmentos: se reemplazará por estas {escenasPrev.length} escenas. ¿Continuar?
              </p>
            )}
          </>)}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "#E2E8F0" }}>
          <button onClick={() => { setConfirma(false); setPaso((p) => Math.max(0, p - 1)); }} disabled={paso === 0}
            className={`${btn} border disabled:opacity-40`} style={{ borderColor: "#C8D2DE", color: INK }}>← Atrás</button>
          <span className="flex-1" />
          {actual !== "Generar"
            ? <button onClick={siguiente} disabled={actual === "Tipo" && !n.tipo} className={`${btn} text-white disabled:opacity-40`} style={{ background: NAVY }}>Siguiente →</button>
            : <button onClick={generar} className={`${btn} text-white`} style={{ background: confirma ? "#B4232A" : "#1FA14E" }}>
                {confirma ? "Sí, reemplazar y generar" : "✦ Generar escaleta y guion técnico"}
              </button>}
        </div>
      </div>
    </div>
  );
}

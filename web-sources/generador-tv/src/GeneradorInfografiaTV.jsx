import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Camera, Monitor, User, Mic, Clapperboard, Plus, Trash2,
  ChevronUp, ChevronDown, ChevronRight, Save, FolderOpen,
  FilePlus, Eye, Pencil, X, GripVertical, Search, StickyNote, Undo2, Redo2,
  ZoomIn, ZoomOut, Share2, Link2, Check, Download, AlertTriangle, Info
} from "lucide-react";
import LZString from "lz-string";
import { getSetup, instanciarSetup } from "./iluminacion.js";
import {
  TIPOS_PROYECTO, TIPOS_NO_NARRATIVOS, IMPACTOS, EMOCIONES, ESTRUCTURAS,
  ENCUADRES, PERCEPCIONES, MOVIMIENTOS_W, VOCES, MUSICAS,
  MODALIDADES_CLIP, RELACION_MUSICA, PRESENCIAS_ARTISTA,
  loglineDe, escenasDe, planoPorEncuadre, anguloPorPercepcion, alertasDe, sincronizarPersonajes, construirProyectoNarrativo,
} from "./narrativa.js";
import { TIPOS_PROGRAMA, escaletaEnVivoDe, construirEscaletaEnVivo } from "./envivo.js";
import {
  PLANOS, MOVIMIENTOS, MIC_TIPOS, MIC_TIPO_CORTO,
  CUE_TIPOS, CUE_TIPO, CUE_ESTADOS, CUE_ESTADO, TRANSICIONES,
  CATALOGO_FUENTES, SECCIONES_INFO, SECCIONES_DEPRECADAS, SECCIONES_IDS, seccionesDefault,
  CATALOGO_ROLES, MUEBLES_CATALOGO, MUEBLE_ASIENTOS, TIPO_DESDE_PLANTILLA, TONOS,
} from "./catalogos.js";
import {
  reorder, toTC, csvCell, uid, fmt, parseDur, textOn, trunc, slug,
} from "./util.js";
import {
  computeFuentes, computeRows, computeBloques,
  analizarEscaleta, generarCSV, generarEDL,
} from "./escaleta.js";
import { NAVY, INK, PREVIEW_COLOR, AIR_COLOR, PALETTE } from "./theme.js";
import { inp, inpStyle, btn, SecTitle, Box, TarjetaAyuda, Card, Swatches } from "./ui.jsx";
import { useReorder } from "./hooks.js";
import { EMBEDDED, descargarArchivo } from "./puente.js";
import { GlyphLuz, GlyphMueble, MuebleIcon } from "./glifos.jsx";
import { setNuevo, setActivoDe, upSetPor, posMuebleDefault, reacomodoDe } from "./sets.js";
import { ICONS } from "./iconos.jsx";
import { PersonalGrid } from "./PersonalGrid.jsx";
import { EstudioCenital } from "./EstudioCenital.jsx";
import { VistaSet } from "./VistaSet.jsx";
import { PanelIluminacion } from "./PanelIluminacion.jsx";
import { AsistenteNarrativo } from "./AsistenteNarrativo.jsx";
import { AsistenteEnVivo } from "./AsistenteEnVivo.jsx";

// Modo del proyecto: 'live' (programa en vivo) o 'narrative' (por escenas y
// planos). Los proyectos anteriores a los modos se leen como 'live'.
const esNarrativo = (cfg) => cfg?.modo === "narrative";

/* ----------------------------- Tokens / utilidades ----------------------------- */

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


// Normaliza el orden/estado de secciones: conserva el orden guardado, agrega las
// que falten al final y descarta ids desconocidos (compatibilidad con proyectos viejos).
const normSecciones = (arr) => {
  const valid = Array.isArray(arr) ? arr.filter((s) => SECCIONES_IDS.includes(s.id)) : [];
  const seen = new Set(valid.map((s) => s.id));
  const missing = SECCIONES_INFO.filter((s) => !seen.has(s.id)).map((s) => ({ id: s.id, abierto: true }));
  return [...valid.map((s) => ({ id: s.id, abierto: s.abierto !== false })), ...missing];
};



/* ----------------------------- Compartir por URL ----------------------------- */

// Comprime el proyecto y lo deja en el hash de la URL (sin servidor)
function crearEnlaceCompartir(cfg) {
  const json = JSON.stringify(cfg);
  const comp = LZString.compressToEncodedURIComponent(json);
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#s=${comp}`;
}

// Lee un proyecto compartido desde el hash, si existe
function leerProyectoCompartido() {
  try {
    const h = window.location.hash || "";
    const m = h.match(/[#&]s=([^&]+)/);
    if (!m) return null;
    const json = LZString.decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const cfg = JSON.parse(json);
    return cfg && cfg.camaras ? cfg : null;
  } catch { return null; }
}

/* ----------------------------- Historial (undo / redo) ----------------------------- */

// Hook de historial: agrupa cambios rápidos (escritura) y permite deshacer/rehacer.
function useHistory(inicial) {
  const [hist, setHist] = useState({ past: [], present: inicial, future: [] });
  const lastRef = useRef(0);

  const setCfg = useCallback((updater, opts = {}) => {
    setHist((h) => {
      const next = typeof updater === "function" ? updater(h.present) : updater;
      if (next === h.present) return h;
      const now = Date.now();
      const agrupar = !opts.commit && now - lastRef.current < 500;
      lastRef.current = now;
      if (agrupar) return { past: h.past, present: next, future: [] };
      return { past: [...h.past, h.present].slice(-100), present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => setHist((h) => {
    if (!h.past.length) return h;
    const prev = h.past[h.past.length - 1];
    lastRef.current = 0;
    return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
  }), []);

  const redo = useCallback(() => setHist((h) => {
    if (!h.future.length) return h;
    const nxt = h.future[0];
    lastRef.current = 0;
    return { past: [...h.past, h.present], present: nxt, future: h.future.slice(1) };
  }), []);

  const reset = useCallback((val) => { lastRef.current = 0; setHist({ past: [], present: val, future: [] }); }, []);

  return { cfg: hist.present, setCfg, undo, redo, reset, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 };
}



/* ----------------------------- Datos de ejemplo ----------------------------- */

const DEMO = () => ({
  titulo: "PRODUCCIÓN DE TV – UASLP INFORMA",
  subtitulo: "Presentación de la nueva Licenciatura en Producción Audiovisual FCC-UASLP",
  organizacion: "UASLP · FCC",
  pantalla: "NUEVA LICENCIATURA EN PRODUCCIÓN AUDIOVISUAL — FCC · UASLP",
  mesa: "UASLP INFORMA",
  camaras: [
    { id: "c1", nombre: "CAM 1", plano: "Plano General", color: PALETTE[0] },
    { id: "c2", nombre: "CAM 2", plano: "Plano Medio Izquierdo", color: PALETTE[1] },
    { id: "c3", nombre: "CAM 3", plano: "Plano Medio Derecho", color: PALETTE[2] },
  ],
  talentos: [
    { id: "t1", nombre: "Conductor(a)", tipo: "conductor" },
    { id: "t2", nombre: "Invitado(a) FCC", tipo: "invitado" },
  ],
  microfonos: [
    { id: "m1", nombre: "Mic conductor", conexion: "XLR", micTipo: "solapa", asignadoA: "tal:t1" },
    { id: "m2", nombre: "Mic invitado", conexion: "Inalámbrico", micTipo: "solapa", asignadoA: "tal:t2" },
  ],
  sets: [{ id: "set-demo", nombre: "Set principal", locacion: "int", mesaVisible: true, setLayout: { pos: {}, rot: {} }, iluminacion: null }],
  setActivo: "set-demo",
  branding: { primaryColor: NAVY, logoDataUrl: "" },
  extras: [{ id: "xcom", nombre: "COMERCIALES", color: "#F3C513", esCorte: true }],
  escaleta: [
    { id: "r1", segmento: "Open Show", dur: 20, fuente: "c1", nota: "Cortinilla de entrada + música. Director: contar 3-2-1 al conductor." },
    { id: "r2", segmento: "Bienvenida", dur: 60, fuente: "c2", nota: "Conductor saluda a cámara 2. Mencionar fecha y nombre del programa." },
    { id: "r3", segmento: "Titular del día", dur: 70, fuente: "c3" },
    { id: "r4", segmento: "¿Por qué Producción Audiovisual?", dur: 70, fuente: "c1" },
    { id: "r5", segmento: "Perfil de ingreso", dur: 70, fuente: "c2" },
    { id: "r6", segmento: "Plan de estudios", dur: 40, fuente: "c3", nota: "Apoyo gráfico: mapa curricular en pantalla." },
    { id: "r7", segmento: "Break 1 (Comerciales)", dur: 30, fuente: "xcom", nota: "Audio: bajar micrófonos. Playback de cortinilla." },
    { id: "r8", segmento: "Regreso del corte", dur: 70, fuente: "c1" },
    { id: "r9", segmento: "Laboratorios y foros", dur: 70, fuente: "c2" },
    { id: "r10", segmento: "Equipamiento tecnológico", dur: 70, fuente: "c3" },
    { id: "r11", segmento: "Áreas de especialización", dur: 70, fuente: "c1" },
    { id: "r12", segmento: "Teaser segundo bloque", dur: 20, fuente: "c2" },
    { id: "r13", segmento: "Break 2 (Comerciales)", dur: 30, fuente: "xcom" },
    { id: "r14", segmento: "Campo laboral", dur: 60, fuente: "c3" },
    { id: "r15", segmento: "Experiencia estudiantil", dur: 60, fuente: "c1" },
    { id: "r16", segmento: "Proceso de admisión", dur: 50, fuente: "c2" },
    { id: "r17", segmento: "Mensaje final FCC", dur: 30, fuente: "c3" },
    { id: "r18", segmento: "Créditos / Cierre", dur: 10, fuente: "c1" },
  ],
  flujo: { preview: true, playback: true },
  personal: [
    { id: "p1", rol: "Director de cámaras", icon: "director" },
    { id: "p2", rol: "Operador de switcher", icon: "switcher" },
    { id: "p3", rol: "Operador de audio", icon: "audio" },
    { id: "p4", rol: "Operador de gráficos", icon: "graficos" },
    { id: "p5", rol: "Operador de playback", icon: "playback" },
    { id: "p6", rol: "Conductor(a)", icon: "conductor" },
  ],
  includeCamOps: true,
  secciones: seccionesDefault(),
});

const BLANCO = () => ({
  titulo: "PRODUCCIÓN DE TV – TÍTULO DEL PROGRAMA",
  subtitulo: "Descripción breve del proyecto audiovisual",
  organizacion: "PRODUCTORA",
  pantalla: "TEXTO DE LA PANTALLA DEL SET",
  mesa: "NOMBRE DEL PROGRAMA",
  camaras: [
    { id: uid(), nombre: "CAM 1", plano: "Plano General", color: PALETTE[0] },
    { id: uid(), nombre: "CAM 2", plano: "Plano Medio", color: PALETTE[1] },
  ],
  talentos: [{ id: "tal-blanco-1", nombre: "Conductor(a)", tipo: "conductor" }],
  microfonos: [{ id: uid(), nombre: "Mic 1", conexion: "XLR", micTipo: "dinamico", asignadoA: "tal:tal-blanco-1" }],
  sets: [setNuevo(1)],
  branding: { primaryColor: NAVY, logoDataUrl: "" },
  extras: [{ id: uid(), nombre: "COMERCIALES", color: "#F3C513", esCorte: true }],
  escaleta: [],
  flujo: { preview: true, playback: true },
  personal: [
    { id: uid(), rol: "Director de cámaras", icon: "director" },
    { id: uid(), rol: "Operador de switcher", icon: "switcher" },
    { id: uid(), rol: "Operador de audio", icon: "audio" },
    { id: uid(), rol: "Conductor(a)", icon: "conductor" },
  ],
  includeCamOps: true,
  secciones: seccionesDefault(),
});


// Normaliza y MIGRA proyectos viejos al modelo actual:
// - cfg.talentos: antes los micrófonos hacían de talentos en el plano; ahora
//   conductor(a)s e invitad(o)as son entes propios y el micrófono se les asigna
//   (micTipo dinamico|solapa|shotgun|boom + asignadoA tal:<id>|cam:<id>|set|'').
// - cfg.sets/setActivo: antes había un solo layout en cfg.setLayout/iluminacion;
//   ahora cada set tiene nombre, locación (int/ext), mesa opcional y su propio
//   setLayout + iluminación. Lo legado se convierte en el primer set.
const normalizeCfg = (cfg) => {
  const c = {
    ...cfg,
    microfonos: Array.isArray(cfg?.microfonos) ? cfg.microfonos : [],
    branding: cfg?.branding || { primaryColor: NAVY, logoDataUrl: "" },
    secciones: normSecciones(cfg?.secciones),
  };
  let migroTalentos = false;
  if (!Array.isArray(c.talentos)) {
    migroTalentos = true;
    c.talentos = c.microfonos.map((m, i) => ({
      id: `tal-${m.id}`,
      nombre: String(m.nombre || `Talento ${i + 1}`).replace(/^Mic\s*\d*\s*·\s*/i, "").replace(/^Mic\s+/i, "Talento ").trim() || `Talento ${i + 1}`,
      tipo: i === 0 ? "conductor" : "invitado",
    }));
  }
  c.microfonos = c.microfonos.map((m, i) => ({
    micTipo: "dinamico",
    asignadoA: migroTalentos && c.talentos[i] ? `tal:${c.talentos[i].id}` : "",
    ...m,
  }));
  if (!Array.isArray(c.sets) || !c.sets.length) {
    c.sets = [{
      ...setNuevo(1),
      locacion: c.locacion === "ext" ? "ext" : "int",
      setLayout: c.setLayout || { pos: {}, rot: {} },
      iluminacion: c.iluminacion || null,
    }];
  }
  const talIds = new Set(c.talentos.map((t) => t.id));
  c.sets = c.sets.map((s) => {
    const layout = s.setLayout || { pos: {}, rot: {} };
    let pos = layout.pos || {};
    // Posiciones legadas de micrófonos (mic:<id>) pasan al talento derivado.
    if (migroTalentos && Object.keys(pos).some((k) => k.startsWith("mic:"))) {
      pos = Object.fromEntries(Object.entries(pos).map(([k, v]) => [k.startsWith("mic:") ? `tal:tal-${k.slice(4)}` : k, v]));
    }
    // Mobiliario: solo ocupantes que sigan existiendo como talentos.
    const muebles = (Array.isArray(s.muebles) ? s.muebles : [])
      .map((m) => ({ ...m, ocupantes: (m.ocupantes || []).filter((id) => talIds.has(id)) }));
    return { mesaVisible: true, locacion: "int", nombre: "Set", ...s, muebles, setLayout: { ...layout, pos, rot: layout.rot || {} } };
  });
  if (!c.sets.some((s) => s.id === c.setActivo)) c.setActivo = c.sets[0].id;
  // Sugerencias del asistente (iluminación/mobiliario por plantilla): se
  // aplican UNA vez al primer set y se borran las banderas.
  const s0 = c.sets[0];
  if (c.iluminacionSugerida && s0 && !s0.iluminacion) {
    const setup = getSetup(c.iluminacionSugerida);
    if (setup) {
      const { luces, pos } = instanciarSetup(setup, { x: 490, y: 240 });
      s0.iluminacion = { setup: setup.id, luces };
      s0.setLayout = { ...s0.setLayout, pos: { ...(s0.setLayout.pos || {}), ...pos } };
    }
  }
  if ((c.mueblesSugeridos || []).length && s0 && !(s0.muebles || []).length) {
    const pos = { ...(s0.setLayout.pos || {}) };
    s0.muebles = c.mueblesSugeridos.filter((tipo) => MUEBLES_CATALOGO[tipo]).map((tipo, i) => {
      const id = uid();
      pos[`mue:${id}`] = posMuebleDefault(i);
      // Un talento sentado por mueble, en orden (conductor primero).
      return { id, tipo, ocupantes: c.talentos[i] ? [c.talentos[i].id] : [] };
    });
    s0.setLayout = { ...s0.setLayout, pos };
  }
  delete c.iluminacionSugerida;
  delete c.mueblesSugeridos;
  // El layout/iluminación de raíz ya vive dentro de sets: se retira para
  // evitar dobles fuentes de verdad (sheets.js tiene su propio fallback).
  delete c.setLayout;
  delete c.iluminacion;
  c.schema = 3;
  return c;
};


/* ----------------------------- Piezas de la infografía ----------------------------- */

// Set/Estudio: planta física cenital interactiva de TODOS los sets del
// proyecto, apilados con su nombre y locación. Posiciones y ángulos persisten
// por set en cfg.sets[].setLayout, así que viajan con el proyecto.
function Estudio({ cfg, fuentes, setCfg }) {
  const cams = fuentes.filter((f) => f.tipo === "cam");
  const editable = typeof setCfg === "function";
  const sets = cfg.sets || [];
  const reacomodar = (setId) => setCfg((c) => upSetPor(c, setId, reacomodoDe), { commit: true });
  return (
    <div className="flex flex-col gap-2">
      <div className="no-print flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: "#5B6B82" }}>
          {editable
            ? "Arrastra los elementos; lo direccional gira con su manija (doble clic en la manija: volver al automático). Los sets se administran en la pestaña Set."
            : "Distribución física del set."}
        </span>
      </div>
      {sets.map((s) => {
        const tieneCustom = Object.keys(s.setLayout?.pos || {}).length > 0 || Object.keys(s.setLayout?.rot || {}).length > 0;
        return (
          <div key={s.id}>
            <div className="flex flex-wrap items-center gap-2" style={{ margin: "2px 0 4px" }}>
              <span className="rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: NAVY, color: "#fff" }}>{s.nombre}</span>
              <span className="rounded px-1.5 py-0.5 text-xs font-bold"
                style={{ background: s.locacion === "ext" ? "#DCEFDD" : "#E3ECF7", color: s.locacion === "ext" ? "#2F6B38" : "#1C4E86" }}>
                {s.locacion === "ext" ? "EXTERIOR" : "ESTUDIO"}
              </span>
              {editable && tieneCustom && (
                <button onClick={() => reacomodar(s.id)} className="no-print rounded-lg border px-2 py-0.5 text-xs font-bold"
                  style={{ borderColor: "#C8D2DE", color: "#33445F", background: "#fff" }}>
                  Reacomodar automáticamente
                </button>
              )}
            </div>
            <EstudioCenital key={s.id} cfg={cfg} set={s} cams={cams} editable={editable} setCfg={setCfg} />
          </div>
        );
      })}
    </div>
  );
}

function Nodo({ color, icon: Ic, t, s, badge }) {
  return (
    <div className="rounded-xl border-2 bg-white shrink-0" style={{ borderColor: color, width: 150 }}>
      <div className="cond text-center font-bold uppercase" style={{ color, fontSize: 15, letterSpacing: 0.5, padding: "3px 4px" }}>{t}</div>
      <div className="relative flex items-center justify-center" style={{ height: 56, background: "#0D1726", borderTop: `2px solid ${color}` }}>
        <Ic size={26} color="#CFE0F5" />
        {badge && (
          <span className="absolute font-bold text-white"
            style={{ bottom: 4, right: 6, background: AIR_COLOR, fontSize: 9, padding: "1px 6px", borderRadius: 4 }}>{badge}</span>
        )}
      </div>
      <div className="text-center text-slate-500" style={{ fontSize: 10, lineHeight: 1.2, padding: "4px 4px" }}>{s}</div>
    </div>
  );
}

function Escaleta({ rows, byId, total }) {
  return (
    <div>
      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#E9EDF3" }}>
            {["#", "IN", "OUT", "DUR.", "SEGMENTO", "AL AIRE"].map((h) => (
              <th key={h} className="cond uppercase" style={{
                border: "1px solid #C8D2DE", padding: "3px 5px", fontSize: 11.5,
                color: INK, letterSpacing: 0.5, textAlign: h === "SEGMENTO" ? "left" : "center",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const f = byId[r.fuente];
            return (
              <tr key={r.id} style={{ background: i % 2 ? "#F7F9FB" : "#fff" }}>
                <td style={tdC}>{r.idx}</td>
                <td style={tdC}>{fmt(r.tin)}</td>
                <td style={tdC}>{fmt(r.tout)}</td>
                <td style={tdC}>{fmt(r.dur)}</td>
                <td style={{ ...tdC, textAlign: "left", fontWeight: 600, textTransform: "uppercase", fontSize: 10 }}>
                  {r.segmento}
                  {r.nota && <div className="normal-case" style={{ fontWeight: 400, fontSize: 8.5, color: "#6B7C93", marginTop: 1, lineHeight: 1.25 }}>{r.nota}</div>}
                </td>
                <td style={{ ...tdC, padding: "2px 4px" }}>
                  {f ? (
                    <span className="font-bold uppercase" style={{
                      background: f.color, color: textOn(f.color), fontSize: 9.5,
                      padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap",
                    }}>{f.nombre}</span>
                  ) : <span style={{ color: "#94A3B8" }}>—</span>}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan="6" style={{ ...tdC, padding: 14, color: "#94A3B8" }}>Sin segmentos — agrégalos en el editor</td></tr>
          )}
        </tbody>
      </table>
      <div className="cond text-center font-bold uppercase" style={{
        marginTop: 6, background: "#E9EDF3", border: "1px solid #C8D2DE",
        borderRadius: 6, padding: "3px", fontSize: 13, color: INK, letterSpacing: 1,
      }}>Duración total: {fmt(total)} (min:seg)</div>
    </div>
  );
}
const tdC = { border: "1px solid #D5DDE7", padding: "2px 5px", fontSize: 10.5, textAlign: "center", color: "#26324A" };

function Timeline({ rows, byId, total, bloques }) {
  const [zoom, setZoom] = useState(1);
  const step = total <= 0 ? 60 : total <= 960 ? 60 : total <= 1980 ? 120 : total <= 3900 ? 300 : 600;
  const marks = [];
  for (let t = 0; t <= total; t += step) marks.push(t);
  if (total === 0) return <div className="text-center text-slate-400" style={{ fontSize: 12, padding: 12 }}>Agrega segmentos a la escaleta para generar la línea de tiempo</div>;

  // Límites de cada segmento (para marcadores de transición). El cambio de bloque (corte) se resalta.
  let acc = 0;
  const cortes = [];
  rows.forEach((r, i) => {
    acc += r.dur || 0;
    if (i < rows.length - 1) {
      const f = byId[r.fuente], fn = byId[rows[i + 1].fuente];
      const esCorte = !!(f && f.esCorte) !== !!(fn && fn.esCorte);
      cortes.push({ at: acc, esCorte });
    }
  });
  const zbtn = "flex items-center justify-center rounded border";

  return (
    <div>
      <div className="no-print flex items-center gap-2" style={{ marginBottom: 8 }}>
        <button className={zbtn} style={{ borderColor: "#C8D2DE", width: 26, height: 26, color: INK }}
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="Alejar"><ZoomOut size={15} /></button>
        <span className="font-bold text-center" style={{ fontSize: 11, color: INK, width: 42 }}>{Math.round(zoom * 100)}%</span>
        <button className={zbtn} style={{ borderColor: "#C8D2DE", width: 26, height: 26, color: INK }}
          onClick={() => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)))} aria-label="Acercar"><ZoomIn size={15} /></button>
        {zoom > 1 && <span className="text-slate-400" style={{ fontSize: 11 }}>Desliza horizontalmente →</span>}
      </div>

      <div className="overflow-x-auto" style={{ paddingBottom: 4 }}>
        <div style={{ width: `${Math.round(100 * zoom)}%`, minWidth: "100%" }}>
          <div className="relative w-full" style={{ height: 16 }}>
            {marks.map((t) => (
              <span key={t} className="absolute font-semibold" style={{
                left: `${(t / total) * 100}%`, transform: "translateX(-50%)", fontSize: 9, color: "#5B6B82",
              }}>{fmt(t)}</span>
            ))}
          </div>

          {/* Marcadores de transición */}
          <div className="relative w-full" style={{ height: 10 }}>
            {cortes.map((c, i) => (
              <span key={i} className="absolute" title={c.esCorte ? "Entra/sale de corte" : "Cambio de fuente"}
                style={{ left: `${(c.at / total) * 100}%`, transform: "translateX(-50%)", top: 0 }}>
                {c.esCorte
                  ? <span style={{ display: "block", width: 8, height: 8, background: "#E0A100", transform: "rotate(45deg)", borderRadius: 1 }} />
                  : <span style={{ display: "block", width: 2, height: 8, background: "#9AA7B5" }} />}
              </span>
            ))}
          </div>

          <div className="flex w-full overflow-hidden rounded-md border-2" style={{ height: 34, borderColor: "#22344E" }}>
            {rows.map((r) => {
              const f = byId[r.fuente];
              const w = (r.dur / total) * 100;
              return (
                <div key={r.id} title={`${r.segmento} · ${fmt(r.dur)}`} className="flex items-center justify-center"
                  style={{ width: `${w}%`, background: f ? f.color : "#9AA7B5", borderRight: "1px solid rgba(255,255,255,.55)" }}>
                  {w * zoom > 2.4 && (
                    <span className="font-bold" style={{ color: textOn(f ? f.color : "#9AA7B5"), fontSize: 11 }}>
                      {f ? (f.tipo === "cam" ? f.num : (f.nombre || "•").slice(0, 1)) : "?"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex w-full" style={{ height: 18, marginTop: 2 }}>
            {bloques.map((b, i) => (
              <div key={i} className="cond flex items-center justify-center font-bold uppercase truncate"
                style={{
                  width: `${(b.dur / total) * 100}%`, fontSize: 10, letterSpacing: 0.5,
                  color: b.corte ? "#8A6D00" : "#33445F", background: b.corte ? "#FBF3D2" : "transparent",
                  borderRight: "1px dashed #9AA7B5", borderRadius: 3,
                }}>
                {(b.dur / total) * 100 * zoom > 5 ? b.label : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Secciones de la infografía ----------------------------- */

// Panel de sección: cabecera con asa para arrastrar, botones subir/bajar y abrir/cerrar.
function SeccionPanel({ titulo, abierto, controls, onToggle, onUp, onDown, canUp, canDown, source, target, dragging, over, children }) {
  return (
    <div
      {...(controls ? target : {})}
      className={`rounded-xl border-2 bg-white ${abierto ? "" : "seccion-cerrada"}`}
      style={{
        borderColor: NAVY,
        opacity: dragging ? 0.4 : 1,
        outline: over && !dragging ? `2px dashed ${AIR_COLOR}` : "none",
        outlineOffset: 2,
      }}
    >
      <div className="flex items-center gap-2 text-white"
        style={{ background: NAVY, borderRadius: abierto ? "10px 10px 0 0" : 10, padding: "4px 8px" }}>
        {controls && (
          <span {...source} title="Arrastra para reordenar"
            className="no-print flex items-center cursor-grab active:cursor-grabbing" style={{ touchAction: "none" }}>
            <GripVertical size={16} color="#9DB4D4" />
          </span>
        )}
        <button onClick={controls ? onToggle : undefined}
          className="flex-1 flex items-center gap-1.5 text-left"
          style={{ background: "transparent", border: 0, color: "#fff", cursor: controls ? "pointer" : "default", padding: 0 }}>
          {controls && (
            <span className="no-print flex items-center">
              {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </span>
          )}
          <span className="cond uppercase font-bold" style={{ fontSize: 16, letterSpacing: 1 }}>{titulo}</span>
        </button>
        {controls && (
          <span className="no-print flex items-center gap-0.5">
            <button onClick={onUp} disabled={!canUp} aria-label="Subir sección"
              style={{ background: "transparent", border: 0, padding: 0, cursor: canUp ? "pointer" : "default", color: canUp ? "#C6D4E6" : "#46618A" }}>
              <ChevronUp size={16} />
            </button>
            <button onClick={onDown} disabled={!canDown} aria-label="Bajar sección"
              style={{ background: "transparent", border: 0, padding: 0, cursor: canDown ? "pointer" : "default", color: canDown ? "#C6D4E6" : "#46618A" }}>
              <ChevronDown size={16} />
            </button>
          </span>
        )}
      </div>
      {abierto && <div className="p-3">{children}</div>}
    </div>
  );
}

function Infografia({ cfg, setCfg }) {
  const brandColor = cfg.branding?.primaryColor || NAVY;
  const fuentes = useMemo(() => computeFuentes(cfg), [cfg]);
  const byId = useMemo(() => Object.fromEntries(fuentes.map((f) => [f.id, f])), [fuentes]);
  const rows = useMemo(() => computeRows(cfg), [cfg]);
  const total = rows.length ? rows[rows.length - 1].tout : 0;
  const bloques = useMemo(() => computeBloques(rows, byId), [rows, byId]);
  const cams = fuentes.filter((f) => f.tipo === "cam");

  // Orden y estado abierto/cerrado de cada sección (configurable y persistente).
  // Las secciones deprecadas se conservan en los datos pero ya no se muestran aquí.
  const orden = useMemo(
    () => normSecciones(cfg.secciones).filter((s) => !SECCIONES_DEPRECADAS.includes(s.id)),
    [cfg.secciones],
  );
  const editable = typeof setCfg === "function";
  const setSecciones = (next) => { if (editable) setCfg((c) => ({ ...c, secciones: next })); };
  const moveSec = (from, to) => {
    if (from < 0 || to < 0 || from >= orden.length || to >= orden.length) return;
    setSecciones(reorder(orden, from, to));
  };
  const toggleSec = (id) => setSecciones(orden.map((s) => (s.id === id ? { ...s, abierto: !s.abierto } : s)));
  const { dragIdx, overIdx, source, target } = useReorder(moveSec);

  const contenido = {
    estudio: <Estudio cfg={cfg} fuentes={fuentes} setCfg={setCfg} />,
    escaleta: <Escaleta rows={rows} byId={byId} total={total} />,
    personal: <PersonalGrid cfg={cfg} cams={cams} />,
    timeline: <Timeline rows={rows} byId={byId} total={total} bloques={bloques} />,
  };
  const labelDe = (id) => {
    const base = SECCIONES_INFO.find((s) => s.id === id)?.label || id;
    if (id === "escaleta") return `Escaleta / Rundown — ${fmt(total)}`;
    if (id === "timeline") return `Línea de tiempo — ${fmt(total)}`;
    if (id === "personal") return `Personal de operación (${cfg.personal.length}${cfg.includeCamOps ? ` + ${cams.length} cám.` : ""})`;
    return base;
  };

  return (
    <div className="infografia-sheet bg-white shadow-lg mx-auto" style={{ width: 1240, padding: 16, borderRadius: 8 }}>
      {/* Encabezado */}
      <div className="flex items-stretch gap-3" style={{ marginBottom: 12 }}>
        <div className="cond flex items-center justify-center text-center rounded-lg border-2 font-bold uppercase"
          style={{ borderColor: brandColor, color: brandColor, width: 170, fontSize: 17, letterSpacing: 1, padding: 6, lineHeight: 1.1 }}>
          {cfg.branding?.logoDataUrl
            ? <img src={cfg.branding.logoDataUrl} alt={cfg.organizacion} style={{ maxWidth: "100%", maxHeight: 58, objectFit: "contain" }} />
            : cfg.organizacion}
        </div>
        <div className="flex-1 text-center">
          <h1 className="cond font-bold uppercase" style={{ color: brandColor, fontSize: 34, lineHeight: 1.05, letterSpacing: 1 }}>{cfg.titulo}</h1>
          <p className="font-semibold" style={{ color: "#33445F", fontSize: 14, marginTop: 2 }}>{cfg.subtitulo}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border-2" style={{ borderColor: brandColor, width: 170, padding: 6 }}>
          <span className="cond uppercase font-bold" style={{ fontSize: 12, color: "#5B6B82", letterSpacing: 1 }}>Duración</span>
          <span className="cond font-bold" style={{ fontSize: 26, color: NAVY, lineHeight: 1 }}>{fmt(total)}</span>
          <span style={{ fontSize: 10, color: "#5B6B82", marginTop: 2 }}>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {editable && (
        <p className="no-print flex items-center gap-1.5 text-xs text-slate-500" style={{ marginBottom: 8 }}>
          <GripVertical size={13} /> Arrastra el asa para reordenar las secciones, o toca el título para abrir/cerrar. Lo que dejes cerrado no aparece al imprimir.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {orden.map((s, i) => (
          <SeccionPanel
            key={s.id}
            titulo={labelDe(s.id)}
            abierto={s.abierto}
            controls={editable}
            onToggle={() => toggleSec(s.id)}
            onUp={() => moveSec(i, i - 1)}
            onDown={() => moveSec(i, i + 1)}
            canUp={i > 0}
            canDown={i < orden.length - 1}
            source={source(i)}
            target={target(i)}
            dragging={dragIdx === i}
            over={overIdx === i}
          >
            {contenido[s.id]}
          </SeccionPanel>
        ))}
      </div>
    </div>
  );
}

/* --------------------- Pestañas enfocadas: Set y Escaleta --------------------- */

// Pestaña "Escaleta / Rundown": ¿qué pasa primero, qué pasa después y cuánto dura?
// Solo la escaleta y la línea de tiempo.


// Escaleta EDITABLE y consciente del modo. En vivo: columnas EDITORIALES
// (bloque, objetivo, participantes, recursos). En narrativo: columnas de ESCENA
// (encabezado, acción, función, personajes, cambio). La fuente al aire y los
// comandos técnicos NO viven aquí: van en el rundown / guion técnico.
function EscaletaEditor({ cfg, setCfg, rows, editable }) {
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

function RundownCues({ cfg, setCfg, rows, fuentes, editable, onOpenEscaleta }) {
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

function VistaEscaleta({ cfg, setCfg }) {
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
                    "<b>✦ Asistente narrativo</b> arma premisa, personajes, estructura y escenas por ti — el mejor punto de partida.",
                    "<b>Escaleta</b>: qué ocurre en cada escena y cómo avanza la historia (encabezado, acción, función, cambio). Sin cámaras ni lentes: eso va en el guion técnico.",
                    "<b>Guion técnico</b>: desglosa cada escena en planos (tamaño, ángulo, movimiento, sonido).",
                    "<b>Storyboard</b>: la vista visual de cada plano con su imagen y notas.",
                  ]} />
              ) : (
                <TarjetaAyuda id="escaleta-live" titulo="Cómo escribir tu escaleta editorial"
                  pasos={[
                    "<b>▤ Asistente de programa en vivo</b> arma la escaleta editorial por bloques según el tipo de programa y su duración.",
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

/* ----------------------------- Editor ----------------------------- */

function Editor({ cfg, setCfg, proyectos, guardar, cargar, eliminar }) {
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
    <div className="mx-auto flex flex-col gap-3 px-3 py-4" style={{ maxWidth: 880 }}>
      {/* Proyectos (solo versión web: en la app de escritorio los proyectos los maneja el shell) */}
      {!EMBEDDED && <Card title="Proyectos" open={false}>
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
      </Card>}

      {/* Datos generales */}
      <Card title="Narrativa / Brief" open={!!cfg.narrativa}>
        {cfg.narrativa ? (<>
          <p className="m-0 text-xs text-slate-500">
            Generado con el ✦ Asistente narrativo (pestaña Escaleta) — {TIPOS_PROYECTO.find((t) => t.id === cfg.narrativa.tipo)?.nombre || cfg.narrativa.tipo}
            {cfg.narrativa.impacto ? ` · ${cfg.narrativa.impacto}` : ""}{cfg.narrativa.emocion ? ` · ${cfg.narrativa.emocion}` : ""}
          </p>
          <label className="text-xs font-bold uppercase text-slate-500">Logline
            <textarea className={inp} style={inpStyle} rows={2} value={cfg.narrativa.logline || ""}
              onChange={(e) => up({ narrativa: { ...cfg.narrativa, logline: e.target.value } })} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Mensaje clave
              <input className={inp} style={inpStyle} value={cfg.narrativa.mensaje || ""}
                onChange={(e) => up({ narrativa: { ...cfg.narrativa, mensaje: e.target.value } })} />
            </label>
            <label className="text-xs font-bold uppercase text-slate-500">Audiencia
              <input className={inp} style={inpStyle} value={cfg.narrativa.audiencia || ""}
                onChange={(e) => up({ narrativa: { ...cfg.narrativa, audiencia: e.target.value } })} />
            </label>
          </div>
          <label className="text-xs font-bold uppercase text-slate-500">Llamada a la acción
            <input className={inp} style={inpStyle} value={cfg.narrativa.cta || ""}
              onChange={(e) => up({ narrativa: { ...cfg.narrativa, cta: e.target.value } })} />
          </label>
        </>) : (
          <p className="m-0 text-sm text-slate-500">
            Todavía no hay brief: ábrelo con el botón <b>✦ Asistente narrativo</b> de la pestaña Escaleta
            (tipo de proyecto → intención → premisa → personajes → estructura → escaleta y guion técnico generados).
          </p>
        )}
      </Card>
      <Card title="Datos generales">
        <label className="text-xs font-bold uppercase text-slate-500">Título principal
          <input className={inp} style={inpStyle} value={cfg.titulo} onChange={(e) => up({ titulo: e.target.value })} />
        </label>
        <label className="text-xs font-bold uppercase text-slate-500">Subtítulo
          <input className={inp} style={inpStyle} value={cfg.subtitulo} onChange={(e) => up({ subtitulo: e.target.value })} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Organización / logo
            <input className={inp} style={inpStyle} value={cfg.organizacion} onChange={(e) => up({ organizacion: e.target.value })} />
          </label>
          <label className="text-xs font-bold uppercase text-slate-500">Texto pantalla del set
            <input className={inp} style={inpStyle} value={cfg.pantalla} onChange={(e) => up({ pantalla: e.target.value })} />
          </label>
          <label className="text-xs font-bold uppercase text-slate-500">Texto de la mesa
            <input className={inp} style={inpStyle} value={cfg.mesa} onChange={(e) => up({ mesa: e.target.value })} />
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
      </Card>

      {/* Cámaras */}
      <Card title={`Cámaras y planos (${cfg.camaras.length})`}>
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
      </Card>

      {/* Talentos: conductores e invitados, entes propios en el plano del set */}
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
      </Card>

      <Card title={`Micrófonos (${(cfg.microfonos || []).length})`} open={false}>
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
      </Card>

      {/* Otras fuentes */}
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
      </Card>

      {/* Escaleta */}
      <Card title={`Escaleta / Rundown — total ${fmt(total)}`}>
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
      </Card>

      {/* Análisis de tiempos */}
      <Card title="Análisis de tiempos">
        <AnalisisTiempos cfg={cfg} />
      </Card>

      {/* Exportar */}
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
      </Card>

      {/* Flujo */}
      <Card title="Flujo de producción" open={false}>
        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
          <input type="checkbox" checked={cfg.flujo.preview} onChange={(e) => up({ flujo: { ...cfg.flujo, preview: e.target.checked } })} />
          Incluir monitor PREVIEW
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
          <input type="checkbox" checked={cfg.flujo.playback} onChange={(e) => up({ flujo: { ...cfg.flujo, playback: e.target.checked } })} />
          Incluir playback de comerciales / cortinillas
        </label>
        <p className="text-xs text-slate-500">Las cámaras del flujo y los monitores de cabina se generan automáticamente desde la sección de cámaras.</p>
      </Card>

      {/* Personal */}
      <Card title={`Personal de operación (${cfg.personal.length}${cfg.includeCamOps ? ` + ${cfg.camaras.length} cam.` : ""})`}>
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
      </Card>
    </div>
  );
}

/* ----------------------------- App ----------------------------- */

/* ----------------------------- Análisis (UI) ----------------------------- */

function Metric({ label, value }) {
  return (
    <div className="rounded-lg" style={{ background: "#EEF2F7", padding: "8px 10px" }}>
      <div className="text-xs font-semibold uppercase" style={{ color: "#64748B" }}>{label}</div>
      <div className="cond font-bold" style={{ fontSize: 22, color: NAVY }}>{value}</div>
    </div>
  );
}

function AnalisisTiempos({ cfg }) {
  const a = analizarEscaleta(cfg);
  const estilo = (t) =>
    t === "error" ? { bg: "#FDECEC", fg: "#A12A2A", bd: "#F3C0C0", Ic: AlertTriangle }
    : t === "warn" ? { bg: "#FEF6E6", fg: "#8A5A00", bd: "#F3DCA6", Ic: AlertTriangle }
    : { bg: "#EAF2FB", fg: "#1C4E86", bd: "#C5DBF3", Ic: Info };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Duración total" value={fmt(a.total)} />
        <Metric label="Contenido neto" value={fmt(a.durContenido)} />
        <Metric label={`Cortes (${a.nCortes})`} value={fmt(a.durCortes)} />
        <Metric label="Segmentos" value={String(a.segCount)} />
      </div>
      <p className="text-sm" style={{ color: INK }}>
        Esta escaleta suma <b>{fmt(a.total)}</b>
        {a.nCortes > 0
          ? <>, con {a.nCortes} corte{a.nCortes > 1 ? "s" : ""} ({fmt(a.durCortes)}). Programa neto de contenido: <b>{fmt(a.durContenido)}</b>.</>
          : "."}
      </p>
      {a.avisos.length === 0 ? (
        <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#1A7A4A" }}>
          <Check size={16} /> Sin avisos: los tiempos se ven equilibrados.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {a.avisos.map((av, i) => {
            const e = estilo(av.tipo);
            return (
              <div key={i} className="flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-sm"
                style={{ background: e.bg, color: e.fg, borderColor: e.bd }}>
                <e.Ic size={15} style={{ marginTop: 1, flexShrink: 0 }} /> <span>{av.msg}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GeneradorInfografiaTV() {
  const compartido = useMemo(() => leerProyectoCompartido(), []);
  const readonly = !!compartido;
  const { cfg, setCfg, undo, redo, reset, canUndo, canRedo } = useHistory(normalizeCfg(compartido || DEMO()));
  const [modo, setModo] = useState("vista");
  const [proyectos, setProyectos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // El asistente (narrativo o en vivo) vive en la raíz para montarse sobre
  // CUALQUIER vista, no dentro de la escaleta.
  const [asistente, setAsistente] = useState(false);

  // Zoom de impresión calculado por contenido: la infografía entra completa
  // en una página A4 horizontal mientras siga legible; si quedaría demasiado
  // chica, se ajusta solo al ancho y fluye a varias páginas. (Antes era un
  // 0.6 fijo: lo largo se cortaba y lo corto desperdiciaba página.)
  const printZoomRef = useRef(null);
  useLayoutEffect(() => {
    const el = printZoomRef.current;
    if (!el) return;
    const sheet = el.querySelector(".infografia-sheet");
    if (!sheet) return;
    const PRINT_W = 1077; // área útil A4 horizontal (297−2×6 mm) en px CSS
    const PRINT_H = 748; //  área útil A4 horizontal (210−2×6 mm) en px CSS
    const fitW = PRINT_W / Math.max(1, sheet.scrollWidth);
    const fitPage = Math.min(fitW, PRINT_H / Math.max(1, sheet.scrollHeight));
    const zoom = Math.min(1, fitPage >= 0.5 ? fitPage : fitW);
    el.style.setProperty("--print-zoom", zoom.toFixed(3));
  });

  // Adaptador de almacenamiento: usa localStorage del navegador.
  const st = typeof window !== "undefined" && window.localStorage
    ? {
        get: async (key) => { const value = window.localStorage.getItem(key); return value == null ? null : { value }; },
        set: async (key, value) => { window.localStorage.setItem(key, value); },
      }
    : null;
  const S_AUTO = "tvprod:autosave", S_PROJ = "tvprod:proyectos";

  // Carga autosave + proyectos (no aplica en vista compartida de solo lectura)
  useEffect(() => {
    (async () => {
      if (st && !readonly) {
        try { const r = await st.get(S_AUTO); if (r?.value) { const c = JSON.parse(r.value); if (c && c.camaras) reset(normalizeCfg(c)); } } catch {}
        try { const p = await st.get(S_PROJ); if (p?.value) setProyectos(JSON.parse(p.value)); } catch {}
      }
      setCargado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguardado
  useEffect(() => {
    if (!cargado || !st || readonly) return;
    const t = setTimeout(async () => { try { await st.set(S_AUTO, JSON.stringify(cfg)); } catch {} }, 800);
    return () => clearTimeout(t);
  }, [cfg, cargado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Atajos: Ctrl/Cmd+Z deshacer, Ctrl/Cmd+Shift+Z o Ctrl+Y rehacer
  useEffect(() => {
    if (readonly) return;
    const h = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = (e.key || "").toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
      // ⌘S dentro del generador: el shell fuerza el guardado a disco.
      else if (k === "s" && EMBEDDED) { e.preventDefault(); window.parent.postMessage({ type: "producciontv:request-save" }, "*"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [readonly, undo, redo]);

  // Puente con el contenedor de escritorio: estado, proyectos y modos de operación.
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "producciontv:request-project") {
        window.parent.postMessage({
          type: "producciontv:project-data",
          requestId: event.data.requestId,
          filename: `${slug(cfg.titulo)}.ptv`,
          content: JSON.stringify(cfg, null, 2),
        }, "*");
      }
      if (event.data?.type === "producciontv:load-infografia" && event.data.cfg) {
        reset(normalizeCfg(event.data.cfg));
        setModo(event.data.mode || "editar");
      }
      if (event.data?.type === "producciontv:set-mode" && ["editar", "vista", "set", "escaleta"].includes(event.data.mode)) {
        setModo(event.data.mode);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [cfg, reset]);

  useEffect(() => {
    window.parent.postMessage({ type: "producciontv:infografia-state", cfg }, "*");
  }, [cfg]);

  // Al crear el proyecto desde Inicio (bandera cfg.abrirAsistente) el asistente
  // se abre solo, sobre la vista actual. La bandera se consume una vez.
  useEffect(() => {
    if (cfg.abrirAsistente && !readonly) {
      setAsistente(true);
      setCfg((c) => { const { abrirAsistente, ...resto } = c; return resto; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.abrirAsistente]);

  const persistProyectos = async (list) => {
    setProyectos(list);
    if (st) { try { await st.set(S_PROJ, JSON.stringify(list)); } catch {} }
  };
  const guardar = (nombre) =>
    persistProyectos([...proyectos.filter((p) => p.nombre !== nombre), { id: uid(), nombre, fecha: new Date().toISOString(), cfg }]);
  const cargar = (p) => { reset(normalizeCfg(p.cfg)); setModo("vista"); };
  const eliminar = (p) => persistProyectos(proyectos.filter((x) => x.id !== p.id));

  const compartir = async () => {
    if (window.webkit?.messageHandlers?.share) {
      window.webkit.messageHandlers.share.postMessage({
        nombre: `${slug(cfg.titulo)}.json`,
        contenido: JSON.stringify(cfg, null, 2),
        mime: "application/json",
      });
      setCopiado(true); setTimeout(() => setCopiado(false), 2200);
      return;
    }
    const url = crearEnlaceCompartir(cfg);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true); setTimeout(() => setCopiado(false), 2200);
    } catch {
      window.prompt("Copia este enlace para compartir (solo lectura):", url);
    }
  };

  const tab = (m, Icono, label) => (
    <button onClick={() => setModo(m)}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold"
      style={modo === m ? { background: "#fff", color: NAVY } : { background: "transparent", color: "#C6D4E6" }}>
      <Icono size={15} /> {label}
    </button>
  );
  const iconBtn = (onClick, disabled, title, Icono) => (
    <button onClick={onClick} disabled={disabled} title={title}
      className="flex items-center justify-center rounded-md"
      style={{ width: 32, height: 32, background: "rgba(255,255,255,.12)", color: "#fff", opacity: disabled ? 0.35 : 1 }}>
      <Icono size={16} />
    </button>
  );
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";

  return (
    <div className="min-h-screen" style={{ background: "#E4E9F0", fontFamily: "'Barlow', system-ui, sans-serif" }}>
      <style>{`
        .cond { font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; }
        details > summary::-webkit-details-marker { display: none; }
        button, input, select, textarea { touch-action: manipulation; }
        @media (max-width: 700px) {
          .app-toolbar {
            flex-wrap: nowrap !important;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
          }
          .app-toolbar > * { flex: 0 0 auto; }
          .app-toolbar .app-title { display: none; }
          .app-toolbar > .flex-1 { display: none; }
          .mode-tabs button { min-height: 40px; padding-left: 10px; padding-right: 10px; }
          .infografia-sheet { width: calc(100vw - 16px) !important; padding: 10px !important; }
          .infografia-sheet > div:first-child { flex-wrap: wrap; }
          input, select, textarea { font-size: 16px !important; }
        }
        @media print {
          .no-print { display: none !important; }
          .seccion-cerrada { display: none !important; }
          .scrollwrap { overflow: visible !important; padding: 0 !important; }
          .print-zoom { zoom: var(--print-zoom, 0.6); }
          body { background: #fff; }
          @page { size: A4 landscape; margin: 6mm; }
        }
      `}</style>

      <div className="app-toolbar no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 shadow" style={{ background: NAVY }}>
        <Clapperboard size={18} color="#fff" />
        <span className="app-title cond font-bold uppercase text-white" style={{ fontSize: 16, letterSpacing: 1 }}>
          Generador de infografías de producción TV
        </span>
        <span className="flex-1" />
        {!readonly && (
          <div className="flex items-center gap-1">
            {iconBtn(undo, !canUndo, "Deshacer (Ctrl+Z)", Undo2)}
            {iconBtn(redo, !canRedo, "Rehacer (Ctrl+Shift+Z)", Redo2)}
          </div>
        )}
        <div className="mode-tabs flex gap-1 rounded-lg p-1" style={{ background: "rgba(255,255,255,.12)" }}>
          {/* En la app de escritorio Set y Escaleta tienen pestaña propia en la
              barra lateral; en la web (PWA) se muestran aquí. */}
          {!readonly && tab("editar", Pencil, "Editar")}
          {tab("vista", Eye, "Infografía")}
          {!EMBEDDED && tab("set", Monitor, "Set")}
          {!EMBEDDED && tab("escaleta", Clapperboard, "Escaleta")}
        </div>
        {!readonly && (
          <button onClick={() => setAsistente(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold text-white" style={{ background: "#1FA14E" }}
            title={esNarrativo(cfg)
              ? "Asistente narrativo: premisa, personajes, estructura y escenas → genera la escaleta"
              : "Asistente de programa en vivo: tipo de programa, bloques y duración → genera la escaleta editorial"}>
            {esNarrativo(cfg) ? "✦ Asistente narrativo" : "▤ Asistente en vivo"}
          </button>
        )}
        {!readonly && !EMBEDDED && (
          <button onClick={compartir} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold text-white"
            style={{ background: copiado ? "#16A34A" : "#2563EB" }}>
            {copiado ? <><Check size={15} /> ¡Enlace copiado!</> : <><Share2 size={15} /> Compartir</>}
          </button>
        )}
      </div>

      {readonly && (
        <div className="no-print flex flex-wrap items-center justify-center gap-2 px-3 py-2 text-sm"
          style={{ background: "#DCEAFE", color: "#1C4E86" }}>
          <Link2 size={15} /> Estás viendo una <b>infografía compartida</b> (solo lectura).
          <a href={base} className="font-bold underline" style={{ color: "#1448A0" }}>Crear mi propia versión</a>
        </div>
      )}

      {modo === "editar" && !readonly ? (
        <Editor cfg={cfg} setCfg={setCfg} proyectos={proyectos} guardar={guardar} cargar={cargar} eliminar={eliminar} />
      ) : modo === "set" ? (
        <VistaSet cfg={cfg} setCfg={readonly ? undefined : setCfg} />
      ) : modo === "escaleta" ? (
        <VistaEscaleta cfg={cfg} setCfg={readonly ? undefined : setCfg} />
      ) : (
        <div className="scrollwrap overflow-auto px-2 py-4">
          <div className="print-zoom" ref={printZoomRef}><Infografia cfg={cfg} setCfg={setCfg} /></div>
          <p className="no-print text-center text-xs text-slate-500 mt-3">
            En pantallas pequeñas desliza horizontalmente. En escritorio usa el menú Exportar para crear el proyecto, una imagen PNG o un PDF.
          </p>
        </div>
      )}

      {asistente && !readonly && (esNarrativo(cfg)
        ? <AsistenteNarrativo cfg={cfg} setCfg={setCfg} onClose={() => setAsistente(false)} onGenerado={() => setAsistente(false)} />
        : <AsistenteEnVivo cfg={cfg} setCfg={setCfg} onClose={() => setAsistente(false)} onGenerado={() => setAsistente(false)} />
      )}
    </div>
  );
}

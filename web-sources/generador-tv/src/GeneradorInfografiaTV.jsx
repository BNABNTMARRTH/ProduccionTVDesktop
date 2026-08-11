import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Camera, Monitor, Play, User, Users, Headphones, SlidersHorizontal, Volume2, Mic,
  Lightbulb, Clapperboard, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Save, FolderOpen,
  FilePlus, Eye, Pencil, X, GripVertical, Search, StickyNote, Undo2, Redo2,
  ZoomIn, ZoomOut, Share2, Link2, Check, Download, AlertTriangle, Info
} from "lucide-react";
import LZString from "lz-string";
import {
  LUZ_CATALOGO, LUZ_GRUPOS, SETUPS_ILUMINACION, SETUPS_EXTERIOR, RECOMENDADAS_POR_PLANTILLA, DIFICULTAD_ES,
  getSetup, instanciarElemento, instanciarSetup, posicionesParaLuces,
} from "./iluminacion.js";
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
import { inp, inpStyle, btn } from "./ui.js";
import { AsistenteNarrativo } from "./AsistenteNarrativo.jsx";

// Modo del proyecto: 'live' (programa en vivo) o 'narrative' (por escenas y
// planos). Los proyectos anteriores a los modos se leen como 'live'.
const esNarrativo = (cfg) => cfg?.modo === "narrative";

/* ----------------------------- Tokens / utilidades ----------------------------- */

const SET_CANVAS_DEFAULTS = {
  showLabels: false,
  showGuides: false,
};

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



// ¿Corre dentro de la app de escritorio (iframe del shell de Producción TV)?
const EMBEDDED = typeof window !== "undefined" && window.parent !== window;

// Descarga un archivo de texto generado en el navegador
function descargarArchivo(nombre, contenido, mime = "text/plain") {
  try {
    if (EMBEDDED) {
      // Las descargas blob no funcionan en el WebView: el shell guarda con diálogo nativo.
      window.parent.postMessage({ type: "producciontv:save-file", filename: nombre, content: contenido, mime }, "*");
      return;
    }
    if (window.webkit?.messageHandlers?.download) {
      window.webkit.messageHandlers.download.postMessage({ nombre, contenido, mime });
      return;
    }
    const blob = new Blob([contenido], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) { console.error("No se pudo descargar:", e); }
}


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

const ICONS = {
  director: Headphones, switcher: SlidersHorizontal, audio: Volume2, graficos: Monitor,
  playback: Play, conductor: Mic, floor: Clapperboard, luces: Lightbulb,
  productor: Users, script: Pencil, custom: User,
};



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


const setNuevo = (n = 1) => ({
  id: `set-${uid()}`, nombre: n === 1 ? "Set principal" : `Set ${n}`,
  locacion: "int", mesaVisible: true,
  setLayout: { pos: {}, rot: {} }, iluminacion: null, muebles: [],
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

// Set actualmente seleccionado (siempre existe tras normalizeCfg).
const setActivoDe = (cfg) => (cfg.sets || []).find((s) => s.id === cfg.setActivo) || (cfg.sets || [])[0] || setNuevo(1);

// Aplica un parche funcional a un set por id dentro de un updater de setCfg.
const upSetPor = (c, setId, fn) => ({ ...c, sets: (c.sets || []).map((s) => (s.id === setId ? fn(s) : s)) });

// Posición inicial (y de reacomodo) del mueble n en el lienzo.
const posMuebleDefault = (n) => ({ x: 335 + (n % 4) * 85, y: 330 + Math.floor(n / 4) * 75 });

// "Reacomodar automáticamente": regresa mesa/talentos/cámaras a sus posiciones
// derivadas y recoloca luces y muebles en sus posiciones típicas (las luces y
// muebles no tienen default en el lienzo: sin esto caerían al centro).
const reacomodoDe = (s) => {
  const pos = posicionesParaLuces(s.iluminacion?.luces);
  (s.muebles || []).forEach((m, i) => { pos[`mue:${m.id}`] = posMuebleDefault(i); });
  return { ...s, setLayout: { pos, rot: {} } };
};


/* ----------------------------- Piezas de la infografía ----------------------------- */

function Box({ title, children, style }) {
  return (
    <div className="rounded-xl border-2 bg-white" style={{ borderColor: NAVY, ...style }}>
      <div className="cond text-center text-white font-bold uppercase"
        style={{ background: NAVY, borderRadius: "10px 10px 0 0", padding: "4px 10px", fontSize: 16, letterSpacing: 1 }}>
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Ayuda contextual: botón "?" con una tarjeta que se auto-muestra la primera
// vez (recordada en localStorage por id) y se puede reabrir. Mismo patrón que
// el "Cómo armar tu ruta de señal" del diagrama. Los pasos son HTML estático
// propio (admite <b>), no entrada del usuario.
function TarjetaAyuda({ id, titulo, pasos }) {
  const key = `ptv:ayuda-${id}`;
  const [abierta, setAbierta] = useState(() => {
    try { return !localStorage.getItem(key); } catch { return false; }
  });
  const cerrar = () => { setAbierta(false); try { localStorage.setItem(key, "1"); } catch {} };
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} title="¿Cómo funciona esta pestaña?"
        className="no-print grid h-7 w-7 place-items-center rounded-full border text-sm font-bold"
        style={{ borderColor: "#C8D2DE", color: NAVY, background: "#fff" }}>?</button>
      {abierta && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center" style={{ background: "rgba(6,14,28,.45)" }} onClick={cerrar}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl text-white shadow-2xl"
            style={{ width: "min(92vw,460px)", background: "#0E1D33", border: "1px solid #2c4a78", padding: "20px 22px" }}>
            <h3 className="cond m-0 mb-3 text-xl font-bold uppercase" style={{ letterSpacing: 0.5 }}>{titulo}</h3>
            <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-sm" style={{ color: "#c8d6ea", lineHeight: 1.5 }}>
              {pasos.map((p, i) => <li key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
            </ol>
            <button type="button" onClick={cerrar} className="mt-4 w-full rounded-lg font-bold text-white" style={{ background: "#1D6FD1", padding: 10 }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}

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

// Glifos de los elementos de iluminación (mismo lenguaje visual que la copia
// vanilla en tools/shared/sheets.js). Se dibujan centrados en (0,0), ~24px.
function GlyphLuz({ forma, color }) {
  switch (forma) {
    case "softbox":
      return (<g><rect x="-10" y="-10" width="20" height="20" rx="3" fill={color} stroke="#fff" strokeWidth="1.5" /><path d="M-10 -10 L10 10 M10 -10 L-10 10" stroke="#fff" strokeWidth="1.2" opacity="0.85" /></g>);
    case "panel":
      return (<g><rect x="-11" y="-8" width="22" height="16" rx="2" fill={color} stroke="#fff" strokeWidth="1.5" /><path d="M-11 -2.5 H11 M-11 2.5 H11 M-5.5 -8 V8 M0 -8 V8 M5.5 -8 V8" stroke="#fff" strokeWidth="0.8" opacity="0.7" /></g>);
    case "wash":
      return (<g>{[0, 60, 120, 180, 240, 300].map((a) => (<line key={a} transform={`rotate(${a})`} x1="0" y1="-13" x2="0" y2="-9.5" stroke={color} strokeWidth="2" strokeLinecap="round" />))}<circle r="8" fill={color} stroke="#fff" strokeWidth="1.5" /></g>);
    case "tube":
      return (<rect x="-13" y="-4" width="26" height="8" rx="4" fill={color} stroke="#fff" strokeWidth="1.5" />);
    case "top":
      return (<g><circle r="9" fill="none" stroke={color} strokeWidth="2.5" /><circle r="3.5" fill={color} /></g>);
    case "practical":
      return (<g><path d="M-8 -2 L8 -2 L4 -11 L-4 -11 Z" fill={color} stroke="#fff" strokeWidth="1" /><line x1="0" y1="-2" x2="0" y2="8" stroke={color} strokeWidth="2.5" /><line x1="-5" y1="9" x2="5" y2="9" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></g>);
    case "flag":
      return (<rect x="-9" y="-7" width="18" height="14" rx="2" fill="#1F2937" stroke={color} strokeWidth="1.5" />);
    case "difusor":
      return (<g><rect x="-10" y="-8" width="20" height="16" fill="#fff" stroke={color} strokeWidth="1.8" /><path d="M-6 -8 V8 M-2 -8 V8 M2 -8 V8 M6 -8 V8" stroke={color} strokeWidth="0.9" opacity="0.7" /></g>);
    case "reflector":
      return (<g><circle r="9" fill="#fff" stroke={color} strokeWidth="2" /><path d="M0 -9 A9 9 0 0 1 0 9 Z" fill={color} opacity="0.85" /></g>);
    case "control":
      return (<g><rect x="-8" y="-8" width="16" height="16" rx="3" fill="#fff" stroke={color} strokeWidth="2" /><circle r="3.5" fill={color} /><line x1="0" y1="0" x2="2.6" y2="-2.6" stroke="#fff" strokeWidth="1.3" /></g>);
    case "fx":
      return (<path d="M-10 4 a4.5 4.5 0 0 1 0.5 -8.5 a6 6 0 0 1 11.5 -1.5 a4.5 4.5 0 0 1 6.5 4.5 a4 4 0 0 1 -1.5 7.5 h-14.5 a4 4 0 0 1 -2.5 -2" fill={color} opacity="0.85" stroke="#fff" strokeWidth="1" />);
    case "movil":
      return (<g><circle r="8" fill={color} stroke="#fff" strokeWidth="1.5" /><path d="M-1 -12.5 A12.5 12.5 0 0 1 11 -3.5" fill="none" stroke={color} strokeWidth="1.8" /><path d="M11 -3.5 L7.5 -4.5 M11 -3.5 L11.5 -7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></g>);
    case "fresnel":
    default:
      return (<g><circle r="9" fill={color} stroke="#fff" strokeWidth="1.5" /><circle r="4" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.9" /></g>);
  }
}

// Icono chico de una luz para chips y listas del panel de iluminación.
const LuzIcon = ({ forma, color, size = 15 }) => (
  <svg width={size} height={size} viewBox="-14 -14 28 28" style={{ flex: "0 0 auto", display: "block" }}>
    <GlyphLuz forma={forma} color={color} />
  </svg>
);

// Título de sección dentro de los paneles de la pestaña Set.
const SecTitle = ({ children }) => (
  <div className="text-xs font-bold uppercase" style={{ color: "#8A97A8", letterSpacing: 1 }}>{children}</div>
);

// Icono de un mueble para la galería y las tarjetas (escala compartida: un
// sofá se ve más ancho que una silla, como en el plano).
const MuebleIcon = ({ tipo, width = 58, height = 26 }) => (
  <svg width={width} height={height} viewBox="-56 -24 112 48" style={{ display: "block", flex: "0 0 auto" }}>
    <GlyphMueble tipo={tipo} />
  </svg>
);

// Glifos de mobiliario en planta (frente del mueble hacia abajo; giran con su
// manija). Mismo lenguaje visual que muebleGlyph en tools/shared/sheets.js.
function GlyphMueble({ tipo }) {
  const tela = "#93A5BC", asiento = "#C9D4E2", borde = "#5F7189";
  switch (tipo) {
    case "podio":
      return (<g><path d="M-17 -12 L17 -12 L12 12 L-12 12 Z" fill="#B4845C" stroke="#8A6543" strokeWidth="2" /><rect x="-13" y="-17" width="26" height="7" rx="2.5" fill="#8A6543" /></g>);
    case "sillon2":
      return (<g><rect x="-38" y="-16" width="76" height="10" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-38" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="29" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-29" y="-7" width="58" height="22" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /><line x1="0" y1="-7" x2="0" y2="15" stroke={borde} strokeWidth="1" opacity="0.6" /></g>);
    case "sillon3":
      return (<g><rect x="-52" y="-16" width="104" height="10" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-52" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="43" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-43" y="-7" width="86" height="22" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /><line x1="-17" y1="-7" x2="-17" y2="15" stroke={borde} strokeWidth="1" opacity="0.6" /><line x1="17" y1="-7" x2="17" y2="15" stroke={borde} strokeWidth="1" opacity="0.6" /></g>);
    case "silla":
      return (<g><rect x="-12" y="-14" width="24" height="5" rx="2" fill={tela} stroke={borde} strokeWidth="1.3" /><rect x="-11" y="-8" width="22" height="20" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /></g>);
    case "banco":
      return (<g><circle r="11" fill={asiento} stroke={borde} strokeWidth="1.8" /><circle r="6.5" fill="none" stroke={borde} strokeWidth="1" opacity="0.6" /></g>);
    case "sillon1":
    default:
      return (<g><rect x="-24" y="-16" width="48" height="10" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-24" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="15" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-15" y="-7" width="30" height="22" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /></g>);
  }
}

// Planta física de UN set vista desde arriba (interior o exterior). Talentos,
// mesa (o punto de foco), micrófonos, luces y cámaras se arrastran con el
// puntero. Lo direccional (cámaras, luces, booms) apunta a la mesa/foco por
// defecto; su manija fija un ángulo manual (set.setLayout.rot) y con doble
// clic vuelve al seguimiento automático.
function EstudioCenital({ cfg, set, cams, editable, setCfg, showLabels = true, showGuides = true }) {
  const W = 980, H = 600;
  const svgRef = useRef(null);
  const liveRef = useRef(null); // posiciones durante el arrastre (espejo del estado)
  const [live, setLive] = useState(null);
  const liveRotRef = useRef(null); // ángulos durante el giro (espejo del estado)
  const [liveRot, setLiveRot] = useState(null);
  const talentos = cfg.talentos || [];
  const mics = cfg.microfonos || [];
  const muebles = set.muebles || [];
  // Etiquetas ocultas una por una (doble clic sobre la etiqueta): se guardan
  // por set y también las respetan las hojas impresas (sheets.js).
  const labelsOff = set.setLayout?.labelsOff || {};
  const lab = (key) => showLabels && !labelsOff[key];
  const hideLabel = (key) => (e) => {
    if (!editable) return;
    e.stopPropagation();
    setCfg((c) => upSetPor(c, set.id, (s) => ({
      ...s,
      setLayout: { ...s.setLayout, labelsOff: { ...(s.setLayout.labelsOff || {}), [key]: true } },
    })));
  };
  const labProps = (key) => ({ onDoubleClick: hideLabel(key), style: editable ? { cursor: "pointer" } : undefined });
  // Talentos sentados en un mueble: se dibujan sobre él, no sueltos.
  const sentados = new Set(muebles.flatMap((m) => m.ocupantes || []));
  const N = cams.length;

  // Reparto de micrófonos: en talento (solapa/dinámico), boom con posición
  // propia, shotgun montado en su cámara, o suelto en el piso del set.
  const talIds = new Set(talentos.map((t) => t.id));
  const camIds = new Set(cams.map((c) => c.id));
  const micsDeTal = (tid) => mics.filter((m) => m.micTipo !== "boom" && m.asignadoA === `tal:${tid}`);
  const shotgunDe = (cid) => mics.filter((m) => m.micTipo === "shotgun" && m.asignadoA === `cam:${cid}`);
  const booms = mics.filter((m) => m.micTipo === "boom");
  const sueltos = mics.filter((m) => {
    if (m.micTipo === "boom") return false;
    const a = m.asignadoA || "";
    if (m.micTipo === "shotgun") return !(a.startsWith("cam:") && camIds.has(a.slice(4)));
    return !(a.startsWith("tal:") && talIds.has(a.slice(4)));
  });

  // Posiciones por defecto: mesa al centro, talentos tras ella, booms al lado,
  // mics sueltos al frente y cámaras en arco.
  const defaults = useMemo(() => {
    const d = { mesa: { x: 490, y: 240 } };
    talentos.forEach((t, i) => {
      const k = talentos.length === 1 ? 0 : -1 + (2 * i) / (talentos.length - 1);
      d[`tal:${t.id}`] = { x: 490 + k * Math.min(170, 50 + talentos.length * 26), y: 168 };
    });
    booms.forEach((m, i) => { d[`mic:${m.id}`] = { x: 645 + i * 58, y: 205 }; });
    sueltos.forEach((m, i) => { d[`mic:${m.id}`] = { x: 215 + i * 54, y: 305 }; });
    muebles.forEach((m, i) => { d[`mue:${m.id}`] = posMuebleDefault(i); });
    cams.forEach((c, i) => {
      const t = N === 1 ? 0 : -1 + (2 * i) / (N - 1);
      const a = (t * 70 * Math.PI) / 180;
      d[`cam:${c.id}`] = { x: 490 + Math.sin(a) * 330, y: 250 + Math.cos(a) * 240 };
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cams, talentos, mics, muebles, N]);

  const saved = set.setLayout?.pos || {};
  const savedRot = set.setLayout?.rot || {};
  const posDe = (key) => live?.[key] || saved[key] || defaults[key] || { x: 490, y: 320 };
  const setLiveBoth = (v) => { liveRef.current = v; setLive(v); };
  const setLiveRotBoth = (v) => { liveRotRef.current = v; setLiveRot(v); };

  const startDrag = (key) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    const toSvg = (ev) => {
      const r = svg.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    };
    const origin = toSvg(e);
    const base = posDe(key);
    const move = (ev) => {
      const p = toSvg(ev);
      setLiveBoth({
        ...(liveRef.current || {}),
        [key]: {
          x: Math.round(Math.max(48, Math.min(W - 48, base.x + p.x - origin.x))),
          y: Math.round(Math.max(100, Math.min(H - 44, base.y + p.y - origin.y))),
        },
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = liveRef.current;
      if (current) setCfg((c) => upSetPor(c, set.id, (s) => ({ ...s, setLayout: { ...(s.setLayout || {}), pos: { ...(s.setLayout?.pos || {}), ...current } } })), { commit: true });
      setLiveBoth(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Giro manual: arrastrar la manija fija el ángulo de la cámara hacia el puntero.
  const startRotate = (key) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    const toSvg = (ev) => {
      const r = svg.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    };
    const move = (ev) => {
      const p = toSvg(ev);
      const c = posDe(key);
      setLiveRotBoth({
        ...(liveRotRef.current || {}),
        [key]: Math.round((Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = liveRotRef.current;
      if (current) setCfg((c) => upSetPor(c, set.id, (s) => ({ ...s, setLayout: { ...(s.setLayout || {}), rot: { ...(s.setLayout?.rot || {}), ...current } } })), { commit: true });
      setLiveRotBoth(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Doble clic en la manija: borrar el ángulo manual y volver a seguir la mesa.
  const resetRotate = (key) => (e) => {
    if (!editable) return;
    e.stopPropagation();
    setCfg((c) => upSetPor(c, set.id, (s) => {
      const rot = { ...(s.setLayout?.rot || {}) };
      delete rot[key];
      return { ...s, setLayout: { ...(s.setLayout || {}), rot } };
    }), { commit: true });
  };

  const mesa = posDe("mesa");
  const grab = editable ? { cursor: "grab" } : undefined;
  const ext = set.locacion === "ext";
  // Paleta del piso: estudio (gris azulado) o exterior (verde pasto).
  const piso = ext
    ? { fill: "#EDF5EA", stroke: "#C4D9C6", grid: "#DFEBDD" }
    : { fill: "#F2F5F8", stroke: "#C8D2DE", grid: "#E2E8EF" };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", touchAction: "none" }}>
      {/* Piso con retícula (cada celda ≈ 1 m) */}
      <rect x="20" y="20" width="940" height={H - 40} rx="12" fill={piso.fill} stroke={piso.stroke} strokeWidth="2" />
      {Array.from({ length: 17 }, (_, i) => 20 + (i + 1) * 52).map((x) => (
        <line key={`v${x}`} x1={x} y1="48" x2={x} y2={H - 22} stroke={piso.grid} />
      ))}
      {Array.from({ length: 10 }, (_, i) => 48 + (i + 1) * 52).map((y) => (
        <line key={`h${y}`} x1="22" y1={y} x2="958" y2={y} stroke={piso.grid} />
      ))}

      {/* Interior: muro del set con la pantalla. Exterior: cielo abierto (sol). */}
      {!ext && (
        <>
          <rect x="20" y="20" width="940" height="28" rx="12" fill={NAVY} />
          <rect x="250" y="40" width="480" height="14" rx="4" fill="#0E2748" stroke="#3A6EA5" strokeWidth="2" />
          <text x="490" y="74" textAnchor="middle" fontSize="12" fontWeight="800" fill="#33445F" style={{ letterSpacing: 1 }}>
            PANTALLA · {trunc(cfg.pantalla, 42)}
          </text>
        </>
      )}
      {ext && (
        <g>
          <g transform="translate(903 68)">
            <circle r="14" fill="#FCD34D" stroke="#F59E0B" strokeWidth="2" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <line key={a} transform={`rotate(${a})`} x1="0" y1="-19" x2="0" y2="-25" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            ))}
          </g>
          <text x="40" y="74" fontSize="12" fontWeight="800" fill="#4C7C54" style={{ letterSpacing: 1 }}>LOCACIÓN EXTERIOR</text>
        </g>
      )}

      {/* Luces (arrastrables; las direccionales giran con su manija, doble
          clic en la manija = volver a la dirección automática). Van debajo
          de mesa/talentos/cámaras para que los haces no tapen nada. */}
      {(set.iluminacion?.luces || []).map((l) => {
        const key = `luz:${l.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const auto = l.dir === "mesa"
          ? (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI
          : l.dir === "muro" ? -90 : null;
        const rot = typeof manual === "number" ? manual : auto;
        return (
          <g key={l.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{l.nombre}</title>
            {rot !== null && (
              <g transform={`rotate(${rot})`}>
                {showGuides && <path d="M10 0 L64 -26 L64 26 Z" fill={l.color} opacity="0.12" />}
                {editable && (
                  <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                    <title>Arrastra para girar la luz · doble clic: dirección automática</title>
                    <line x1="16" y1="0" x2="62" y2="0" stroke={l.color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.6" />
                    <circle cx="70" cy="0" r="7" fill={typeof manual === "number" ? l.color : "#fff"} stroke={l.color} strokeWidth="2" />
                  </g>
                )}
              </g>
            )}
            {l.opcional && <circle r="14" fill="none" stroke={l.color} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8" />}
            <GlyphLuz forma={l.forma} color={l.color} />
            <g transform="translate(0 -18)">
              <rect x="-14" y="-11" width="28" height="12" rx="6" fill={l.color} />
              <text y="-2" textAnchor="middle" fontSize="8" fontWeight="800" fill={textOn(l.color)}>{l.abrev}</text>
            </g>
            {lab(`luz:${l.id}`) && <text {...labProps(`luz:${l.id}`)} y="27" textAnchor="middle" fontSize="9" fontWeight="700" fill="#33445F">{trunc(l.nombre, 20)}</text>}
          </g>
        );
      })}

      {/* Mesa (arrastrable). Si el set no tiene mesa, en su lugar hay un punto
          de foco arrastrable: el blanco al que apuntan cámaras y luces. */}
      {set.mesaVisible !== false ? (
        <g transform={`translate(${mesa.x} ${mesa.y})`} onPointerDown={startDrag("mesa")} style={grab}>
          <rect x="-110" y="-34" width="220" height="68" rx="14" fill="#fff" stroke="#9AA7B5" strokeWidth="2.5" />
          <rect x="-88" y="-12" width="176" height="24" rx="5" fill={NAVY} />
          <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" style={{ letterSpacing: 1 }}>{trunc(cfg.mesa, 24)}</text>
        </g>
      ) : (
        <g transform={`translate(${mesa.x} ${mesa.y})`} onPointerDown={startDrag("mesa")} style={grab}>
          <title>Punto de foco: cámaras y luces apuntan aquí</title>
          <circle r="16" fill="none" stroke="#8A97A8" strokeWidth="1.6" strokeDasharray="4 3" />
          <path d="M-23 0 H23 M0 -23 V23" stroke="#8A97A8" strokeWidth="1.4" />
          <circle r="3" fill="#8A97A8" />
          <text y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="#8A97A8">PUNTO DE FOCO</text>
        </g>
      )}

      {/* Mobiliario (arrastrable y giratorio) con sus ocupantes sentados */}
      {muebles.map((m) => {
        const def = MUEBLES_CATALOGO[m.tipo] || MUEBLES_CATALOGO.sillon1;
        const asientos = MUEBLE_ASIENTOS[m.tipo] || MUEBLE_ASIENTOS.sillon1;
        const key = `mue:${m.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const rot = typeof manual === "number" ? manual : 0;
        const ocupantes = (m.ocupantes || []).map((id) => talentos.find((t) => t.id === id)).filter(Boolean);
        return (
          <g key={m.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{def.es}{ocupantes.length ? ` · ${ocupantes.map((t) => t.nombre).join(", ")}` : ""}</title>
            <g transform={`rotate(${rot})`}>
              <GlyphMueble tipo={m.tipo} />
              {ocupantes.map((t, i) => {
                const a = asientos[i % asientos.length];
                const col = t.tipo === "invitado" ? "#0E9F9E" : NAVY;
                return (
                  <g key={t.id} transform={`translate(${a.x} ${a.y})`}>
                    <circle r="9" fill="#fff" stroke={col} strokeWidth="2" />
                    <circle r="3.2" cy="-1.5" fill={col} />
                    <path d="M-4.5 2.5 q4.5 5 9 0 l1 4.5 h-11 z" fill={col} />
                  </g>
                );
              })}
              {editable && (
                <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                  <title>Arrastra para girar el mueble · doble clic: orientación original</title>
                  <line x1={def.mitad + 2} y1="0" x2={def.mitad + 12} y2="0" stroke="#5F7189" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7" />
                  <circle cx={def.mitad + 18} cy="0" r="6.5" fill={typeof manual === "number" ? "#5F7189" : "#fff"} stroke="#5F7189" strokeWidth="2" />
                </g>
              )}
            </g>
            {lab(`mue:${m.id}`) && <text {...labProps(`mue:${m.id}`)} y="34" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5F7189">{def.es.toUpperCase()}</text>}
            {ocupantes.map((t, i) => {
              if (!lab(`tal:${t.id}`)) return null;
              const micsT = micsDeTal(t.id);
              const micTxt = micsT.length ? ` · ${micsT.map((x) => MIC_TIPO_CORTO[x.micTipo] || "mic").join(" + ")}` : "";
              return (
                <text key={t.id} {...labProps(`tal:${t.id}`)} y={45 + i * 11} textAnchor="middle" fontSize="9" fontWeight="700"
                  fill={t.tipo === "invitado" ? "#0E9F9E" : "#33445F"}>
                  {trunc(`${t.nombre}${micTxt}`, 30)}
                </text>
              );
            })}
          </g>
        );
      })}

      {/* Talentos (conductores/invitados, arrastrables) con sus micrófonos
          personales (solapa/dinámico) indicados bajo el nombre. Los sentados
          en un mueble se dibujan sobre él, no aquí. */}
      {talentos.filter((t) => !sentados.has(t.id)).map((t) => {
        const p = posDe(`tal:${t.id}`);
        const micsT = micsDeTal(t.id);
        const col = t.tipo === "invitado" ? "#0E9F9E" : NAVY;
        return (
          <g key={t.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(`tal:${t.id}`)} style={grab}>
            <title>{t.nombre}{micsT.length ? ` · ${micsT.map((m) => MIC_TIPO_CORTO[m.micTipo] || m.micTipo).join(" + ")}` : ""}</title>
            <circle r="17" fill="#fff" stroke={col} strokeWidth="2.5" />
            <circle r="6" cy="-4" fill={col} />
            <path d="M-8 4 q8 9 16 0 l2 9 h-20 z" fill={col} />
            <circle cx="13" cy="-13" r="7" fill={col} stroke="#fff" strokeWidth="1.5" />
            <text x="13" y="-10" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{t.tipo === "invitado" ? "I" : "C"}</text>
            {micsT.length > 0 && (
              <g transform="translate(-14 9)">
                <circle r="6.5" fill="#1FA14E" stroke="#fff" strokeWidth="1.5" />
                <rect x="-1.6" y="-4" width="3.2" height="5" rx="1.6" fill="#fff" />
                <path d="M-3.2 -0.5 a3.2 3.2 0 0 0 6.4 0 M0 2.7 V4.4" stroke="#fff" strokeWidth="1" fill="none" />
              </g>
            )}
            {lab(`tal:${t.id}`) && <text {...labProps(`tal:${t.id}`)} y="32" textAnchor="middle" fontSize="10" fontWeight="700" fill="#33445F">{trunc(t.nombre, 20)}</text>}
            {lab(`tal:${t.id}`) && micsT.length > 0 && (
              <text y="43" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#1FA14E">
                {trunc(micsT.map((m) => MIC_TIPO_CORTO[m.micTipo] || m.micTipo).join(" + "), 26)}
              </text>
            )}
          </g>
        );
      })}

      {/* Booms del set (arrastrables y giratorios: apuntan a la mesa/foco) */}
      {booms.map((m) => {
        const key = `mic:${m.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const rot = typeof manual === "number" ? manual : (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI;
        return (
          <g key={m.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{m.nombre} · boom</title>
            <g transform={`rotate(${rot})`}>
              {showGuides && <path d="M8 0 L46 -12 L46 12 Z" fill="#1FA14E" opacity="0.10" />}
              <line x1="-14" y1="0" x2="26" y2="0" stroke="#3C4654" strokeWidth="3" strokeLinecap="round" />
              <rect x="26" y="-4" width="14" height="8" rx="4" fill="#1FA14E" stroke="#fff" strokeWidth="1.2" />
              {editable && (
                <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                  <title>Arrastra para girar el boom · doble clic: apuntar a la mesa</title>
                  <circle cx="52" cy="0" r="6.5" fill={typeof manual === "number" ? "#1FA14E" : "#fff"} stroke="#1FA14E" strokeWidth="2" />
                </g>
              )}
            </g>
            <circle cx="-14" cy="0" r="6" fill="#3C4654" />
            {lab(`mic:${m.id}`) && <text {...labProps(`mic:${m.id}`)} y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1FA14E">{trunc(m.nombre, 18)} · boom</text>}
          </g>
        );
      })}

      {/* Micrófonos sin asignar (marcador suelto en el piso) */}
      {sueltos.map((m) => {
        const p = posDe(`mic:${m.id}`);
        return (
          <g key={m.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(`mic:${m.id}`)} style={grab}>
            <title>{m.nombre} · {MIC_TIPO_CORTO[m.micTipo] || "mic"}</title>
            <circle r="10" fill="#fff" stroke="#1FA14E" strokeWidth="2" />
            <rect x="-2.5" y="-6" width="5" height="8" rx="2.5" fill="#1FA14E" />
            <path d="M-5 -1 a5 5 0 0 0 10 0 M0 4 V7" stroke="#1FA14E" strokeWidth="1.4" fill="none" />
            {lab(`mic:${m.id}`) && <text {...labProps(`mic:${m.id}`)} y="24" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1FA14E">{trunc(m.nombre, 16)} · {MIC_TIPO_CORTO[m.micTipo] || "mic"}</text>}
          </g>
        );
      })}

      {/* Cámaras (arrastrables). Sin ángulo manual, el lente sigue a la mesa;
          la manija al frente del cono fija la dirección a mano. */}
      {cams.map((c) => {
        const key = `cam:${c.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const rot = typeof manual === "number" ? manual : (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI;
        const shots = shotgunDe(c.id);
        return (
          <g key={c.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{c.nombre}{c.plano ? ` · ${c.plano}` : ""}</title>
            <g transform={`rotate(${rot})`}>
              {showGuides && <path d="M14 0 L82 -26 L82 26 Z" fill={c.color} opacity="0.15" />}
              <rect x="-18" y="-11" width="30" height="22" rx="4" fill="#1B1F26" />
              <rect x="12" y="-6" width="8" height="12" fill="#2C333D" />
              <circle cx="-18" cy="0" r="5" fill="#0C0F14" stroke="#7D8794" strokeWidth="1.5" />
              {shots.length > 0 && (
                <g>
                  <title>{shots.map((m) => m.nombre).join(" · ")} (shotgun montado)</title>
                  <rect x="4" y="-18" width="24" height="5" rx="2.5" fill="#1FA14E" stroke="#fff" strokeWidth="1" />
                </g>
              )}
              {editable && (
                <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                  <title>Arrastra para girar la cámara · doble clic: volver a apuntar a la mesa</title>
                  <line x1="20" y1="0" x2="84" y2="0" stroke={c.color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
                  <circle cx="93" cy="0" r="9" fill={typeof manual === "number" ? c.color : "#fff"} stroke={c.color} strokeWidth="2.5" />
                  <text x="93" y="3.5" textAnchor="middle" fontSize="10" fontWeight="800"
                    fill={typeof manual === "number" ? textOn(c.color) : c.color} style={{ pointerEvents: "none" }}>⟳</text>
                </g>
              )}
            </g>
            <circle cx="0" cy="-27" r="10" fill={c.color} stroke="#fff" strokeWidth="2" />
            <text x="0" y="-23" textAnchor="middle" fontSize="11" fontWeight="800" fill={textOn(c.color)}>{c.num}</text>
            {lab(`cam:${c.id}`) && <g transform="translate(0 22)" {...labProps(`cam:${c.id}`)}>
              <rect x="-56" y="0" width="112" height="30" rx="6" fill="#fff" stroke={c.color} strokeWidth="2" />
              <text x="0" y="13" textAnchor="middle" fontSize="11" fontWeight="800" fill={c.color}>{trunc(c.nombre, 14)}</text>
              <text x="0" y="25" textAnchor="middle" fontSize="9" fill="#3C4654">{trunc(c.plano, 20)}</text>
            </g>}
          </g>
        );
      })}

      <text x="40" y={H - 32} fontSize="10" fill="#8A97A8" style={{ letterSpacing: 1 }}>
        PLANO CENITAL · {ext ? "EXTERIOR" : "ESTUDIO"} · CADA CELDA ≈ 1 m
      </text>
    </svg>
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

function PersonalGrid({ cfg, cams }) {
  return (
    <div className="flex flex-wrap gap-3">
      {cfg.personal.map((p) => {
        const Ic = ICONS[p.icon] || User;
        return (
          <div key={p.id} className="flex flex-col items-center text-center" style={{ width: 92 }}>
            <span className="flex items-center justify-center rounded-full" style={{ width: 42, height: 42, background: NAVY }}>
              <Ic size={20} color="#fff" />
            </span>
            <span className="font-bold uppercase" style={{ fontSize: 9.5, color: INK, marginTop: 4, lineHeight: 1.15 }}>{p.rol}</span>
          </div>
        );
      })}
      {cfg.includeCamOps && cams.map((c) => (
        <div key={c.id} className="flex flex-col items-center text-center" style={{ width: 92 }}>
          <span className="relative flex items-center justify-center rounded-full" style={{ width: 42, height: 42, background: "#22344E" }}>
            <Camera size={20} color="#fff" />
            <span className="absolute flex items-center justify-center rounded-full font-bold"
              style={{ top: -4, right: -4, width: 17, height: 17, background: c.color, color: textOn(c.color), fontSize: 10, border: "2px solid #fff" }}>{c.num}</span>
          </span>
          <span className="font-bold uppercase" style={{ fontSize: 9.5, color: INK, marginTop: 4, lineHeight: 1.15 }}>Cámara {c.num}</span>
          <span style={{ fontSize: 8.5, color: "#5B6B82", lineHeight: 1.1 }}>{trunc(c.plano, 24)}</span>
        </div>
      ))}
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

// Panel de iluminación: elegir una configuración del catálogo, aplicarla al
// plano (coloca las luces requeridas en posiciones típicas) y agregar o quitar
// elementos opcionales. Las acciones destructivas piden confirmación en dos
// pasos (no hay window.confirm en el WebView de Wails).
function PanelIluminacion({ cfg, set, setCfg }) {
  const editable = typeof setCfg === "function";
  const aplicada = set.iluminacion?.setup || null;
  const luces = set.iluminacion?.luces || [];
  const ext = set.locacion === "ext";
  const exteriores = ext ? SETUPS_EXTERIOR.filter((id) => getSetup(id)) : [];
  const recomendadas = (RECOMENDADAS_POR_PLANTILLA[cfg.plantilla] || []).filter((id) => getSetup(id));
  const [selId, setSelId] = useState(aplicada || exteriores[0] || recomendadas[0] || SETUPS_ILUMINACION[0].id);
  const [poolSel, setPoolSel] = useState(LUZ_GRUPOS[0].tipos[0]);
  const [confirma, setConfirma] = useState(null); // 'aplicar' | 'quitar'
  const setup = getSetup(selId) || SETUPS_ILUMINACION[0];
  const setupAplicado = getSetup(aplicada);
  const mesaPos = set.setLayout?.pos?.mesa || { x: 490, y: 240 };

  const chipStyle = (borde) => ({ borderColor: borde, color: "#33445F", background: "#fff" });

  if (!editable) {
    return luces.length ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {setupAplicado && <span className="text-xs font-bold" style={{ color: "#33445F" }}>{setupAplicado.name_es} ·</span>}
        {luces.map((l) => (
          <span key={l.id} className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-bold" style={chipStyle(l.color)}>
            <LuzIcon forma={l.forma} color={l.color} /> {l.nombre}
          </span>
        ))}
      </div>
    ) : <p className="text-xs" style={{ color: "#5B6B82", margin: 0 }}>Sin iluminación configurada.</p>;
  }

  // La confirmación de reemplazo/borrado vive en la UI (franjas con botones);
  // estas acciones ya ejecutan directo.
  const aplicar = () => {
    setConfirma(null);
    const { luces: nuevas, pos } = instanciarSetup(setup, mesaPos);
    setCfg((c) => upSetPor(c, set.id, (s) => {
      const p = { ...(s.setLayout?.pos || {}) };
      const r = { ...(s.setLayout?.rot || {}) };
      (s.iluminacion?.luces || []).forEach((l) => { delete p[`luz:${l.id}`]; delete r[`luz:${l.id}`]; });
      Object.assign(p, pos);
      return { ...s, iluminacion: { setup: setup.id, luces: nuevas }, setLayout: { ...(s.setLayout || {}), pos: p, rot: r } };
    }), { commit: true });
  };

  const quitarTodo = () => {
    setConfirma(null);
    setCfg((c) => upSetPor(c, set.id, (s) => {
      const p = { ...(s.setLayout?.pos || {}) };
      const r = { ...(s.setLayout?.rot || {}) };
      (s.iluminacion?.luces || []).forEach((l) => { delete p[`luz:${l.id}`]; delete r[`luz:${l.id}`]; });
      return { ...s, iluminacion: null, setLayout: { ...(s.setLayout || {}), pos: p, rot: r } };
    }), { commit: true });
  };

  const quitarLuz = (id) => setCfg((c) => upSetPor(c, set.id, (s) => {
    const p = { ...(s.setLayout?.pos || {}) };
    const r = { ...(s.setLayout?.rot || {}) };
    delete p[`luz:${id}`]; delete r[`luz:${id}`];
    const restantes = (s.iluminacion?.luces || []).filter((l) => l.id !== id);
    return {
      ...s,
      iluminacion: restantes.length ? { ...(s.iluminacion || {}), luces: restantes } : null,
      setLayout: { ...(s.setLayout || {}), pos: p, rot: r },
    };
  }), { commit: true });

  const agregarTipo = (tipo, opcional = true) => {
    const { luces: nuevas, pos } = instanciarElemento(tipo, mesaPos, { opcional });
    setCfg((c) => upSetPor(c, set.id, (s) => ({
      ...s,
      iluminacion: { ...(s.iluminacion || { setup: null }), luces: [...(s.iluminacion?.luces || []), ...nuevas] },
      setLayout: { ...(s.setLayout || {}), pos: { ...(s.setLayout?.pos || {}), ...pos } },
    })), { commit: true });
  };

  const toggleOpcional = (tipo) => {
    const activas = luces.filter((l) => l.tipo === tipo && l.opcional);
    if (activas.length) {
      setCfg((c) => upSetPor(c, set.id, (s) => {
        const p = { ...(s.setLayout?.pos || {}) };
        const r = { ...(s.setLayout?.rot || {}) };
        const restantes = (s.iluminacion?.luces || []).filter((l) => {
          const fuera = l.tipo === tipo && l.opcional;
          if (fuera) { delete p[`luz:${l.id}`]; delete r[`luz:${l.id}`]; }
          return !fuera;
        });
        return { ...s, iluminacion: { ...(s.iluminacion || {}), luces: restantes }, setLayout: { ...(s.setLayout || {}), pos: p, rot: r } };
      }), { commit: true });
    } else {
      agregarTipo(tipo, true);
    }
  };

  const btn = (activo) => ({
    background: activo ? NAVY : "#fff", borderColor: activo ? NAVY : "#C8D2DE", color: activo ? "#fff" : "#33445F",
  });

  return (
    <div className="flex flex-col gap-2.5">
      <SecTitle>Configuración base</SecTitle>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selId}
          onChange={(e) => { setSelId(e.target.value); setConfirma(null); }}
          className="rounded-lg border text-xs font-bold"
          style={{ borderColor: "#C8D2DE", color: "#33445F", background: "#fff", padding: "6px 8px", maxWidth: 320 }}>
          {exteriores.length > 0 && (
            <optgroup label="☀ Para locación exterior">
              {exteriores.map((id) => <option key={`ext-${id}`} value={id}>{getSetup(id).name_es}</option>)}
            </optgroup>
          )}
          {recomendadas.length > 0 && (
            <optgroup label="★ Recomendadas para tu producción">
              {recomendadas.map((id) => <option key={`rec-${id}`} value={id}>{getSetup(id).name_es}</option>)}
            </optgroup>
          )}
          <optgroup label={recomendadas.length || exteriores.length ? "Todas las configuraciones" : "Configuraciones"}>
            {SETUPS_ILUMINACION.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
          </optgroup>
        </select>
        <span className="rounded-lg border px-2 py-0.5 text-xs font-bold" style={chipStyle("#C8D2DE")}>
          Dificultad: {DIFICULTAD_ES[setup.difficulty] || setup.difficulty}
        </span>
        {exteriores.includes(setup.id) && (
          <span className="rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: "#DCEFDD", color: "#2F6B38" }}>☀ Exterior</span>
        )}
        {recomendadas.includes(setup.id) && (
          <span className="rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: "#FEF3C7", color: "#92400E" }}>★ Recomendada</span>
        )}
      </div>

      {/* Tarjeta de vista previa: qué coloca la configuración ANTES de aplicarla */}
      <div className="rounded-lg border p-2.5 flex flex-col gap-2" style={{ borderColor: "#DDE4EC", background: "#F8FAFC" }}>
        <p className="text-xs" style={{ color: "#5B6B82", margin: 0 }}>{setup.description}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold" style={{ color: "#33445F" }}>Coloca en el plano:</span>
          {(setup.required_elements || []).map((tipo) => {
            const def = LUZ_CATALOGO[tipo];
            return def ? (
              <span key={tipo} className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-bold" style={chipStyle(def.color)}>
                <LuzIcon forma={def.forma} color={def.color} /> {def.es}{(def.count || 1) > 1 ? " ×2" : ""}
              </span>
            ) : null;
          })}
        </div>
        {(setup.optional_elements || []).length > 0 && (
          <div className="text-xs" style={{ color: "#8A97A8" }}>
            Opcionales (se agregan después de aplicar): {setup.optional_elements.map((t) => LUZ_CATALOGO[t]?.es).filter(Boolean).join(" · ")}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {(setup.mood || []).map((m) => (
            <span key={m} className="rounded px-1.5 py-0.5" style={{ background: "#EEF2F7", color: "#5B6B82", fontSize: 10, fontWeight: 700 }}>
              {m.replace(/_/g, " ")}
            </span>
          ))}
        </div>
        <div>
          <button onClick={() => (luces.length ? setConfirma("aplicar") : aplicar())}
            className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={btn(true)}>
            {aplicada === setup.id && luces.length ? "↺ Volver a aplicar esta configuración" : "Aplicar esta configuración"}
          </button>
        </div>
        {confirma === "aplicar" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "#FEF3C7" }}>
            <span className="text-xs font-bold" style={{ color: "#92400E" }}>
              Se quitarán las {luces.length} luces actuales y se colocarán las de “{setup.name_es}”.
            </span>
            <button onClick={aplicar} className="rounded-lg px-2.5 py-1 text-xs font-bold"
              style={{ background: "#92400E", color: "#fff", border: "none" }}>Sí, reemplazar</button>
            <button onClick={() => setConfirma(null)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={btn(false)}>Cancelar</button>
          </div>
        )}
      </div>

      {luces.length > 0 && (
        <>
          <SecTitle>Luces en el plano ({luces.length}){setupAplicado ? ` · ${setupAplicado.name_es}` : ""}</SecTitle>
          <p className="text-xs" style={{ color: "#8A97A8", margin: 0 }}>
            Arrástralas en el plano de arriba y gíralas con su manija; la ✕ quita esa luz.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {luces.map((l) => (
              <span key={l.id} className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-bold" style={chipStyle(l.color)}>
                <LuzIcon forma={l.forma} color={l.color} /> {l.nombre}{l.opcional ? " · opc." : ""}
                <button onClick={() => quitarLuz(l.id)} title="Quitar esta luz del plano"
                  style={{ border: "none", background: "none", color: "#C0392B", cursor: "pointer", padding: "0 1px 0 3px", fontWeight: 800, fontSize: 13, lineHeight: 1 }}>✕</button>
              </span>
            ))}
          </div>
        </>
      )}

      {setupAplicado && (setupAplicado.optional_elements || []).length > 0 && (
        <>
          <SecTitle>Opcionales de {setupAplicado.name_es}</SecTitle>
          <p className="text-xs" style={{ color: "#8A97A8", margin: 0 }}>Un clic los pone en el plano, otro clic los quita.</p>
          <div className="flex flex-wrap gap-1.5">
            {setupAplicado.optional_elements.map((tipo) => {
              const def = LUZ_CATALOGO[tipo];
              if (!def) return null;
              const activa = luces.some((l) => l.tipo === tipo && l.opcional);
              return (
                <button key={tipo} onClick={() => toggleOpcional(tipo)}
                  className="flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold"
                  style={activa ? { background: def.color, borderColor: def.color, color: textOn(def.color) } : chipStyle("#C8D2DE")}>
                  <LuzIcon forma={def.forma} color={activa ? textOn(def.color) : def.color} /> {activa ? "✓" : "+"} {def.es}
                </button>
              );
            })}
          </div>
        </>
      )}

      <SecTitle>Catálogo completo</SecTitle>
      <p className="text-xs" style={{ color: "#8A97A8", margin: 0 }}>
        ¿Necesitas algo que el setup no trae? Agrega cualquier elemento suelto al plano.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {LUZ_CATALOGO[poolSel] && <LuzIcon forma={LUZ_CATALOGO[poolSel].forma} color={LUZ_CATALOGO[poolSel].color} size={18} />}
        <select value={poolSel} onChange={(e) => setPoolSel(e.target.value)}
          className="rounded-lg border text-xs font-bold"
          style={{ borderColor: "#C8D2DE", color: "#33445F", background: "#fff", padding: "6px 8px", maxWidth: 280 }}>
          {LUZ_GRUPOS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.tipos.map((t) => LUZ_CATALOGO[t] && (
                <option key={t} value={t}>{LUZ_CATALOGO[t].es}{(LUZ_CATALOGO[t].count || 1) > 1 ? " (×2)" : ""}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button onClick={() => agregarTipo(poolSel, true)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={btn(true)}>
          + Agregar al plano
        </button>
      </div>

      {luces.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div>
            <button onClick={() => setConfirma("quitar")} className="rounded-lg border px-2.5 py-1 text-xs font-bold"
              style={{ borderColor: "#C8D2DE", color: "#8A97A8", background: "#fff" }}>
              Quitar toda la iluminación
            </button>
          </div>
          {confirma === "quitar" && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "#FDE8E8" }}>
              <span className="text-xs font-bold" style={{ color: "#B03030" }}>Se quitarán las {luces.length} luces del plano de este set.</span>
              <button onClick={quitarTodo} className="rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ background: "#B03030", color: "#fff", border: "none" }}>Sí, quitar todo</button>
              <button onClick={() => setConfirma(null)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={btn(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Pestaña "Set": ¿qué hay en el espacio físico y quién lo opera?
// Solo el plano cenital interactivo y el personal de operación.
function VistaSet({ cfg, setCfg }) {
  const fuentes = useMemo(() => computeFuentes(cfg), [cfg]);
  const cams = fuentes.filter((f) => f.tipo === "cam");
  const editable = typeof setCfg === "function";
  const sets = cfg.sets || [];
  const activo = setActivoDe(cfg);
  const [confirmaDel, setConfirmaDel] = useState(false);
  const [showLabels, setShowLabels] = useState(SET_CANVAS_DEFAULTS.showLabels);
  const [showGuides, setShowGuides] = useState(SET_CANVAS_DEFAULTS.showGuides);
  const tieneCustom = Object.keys(activo.setLayout?.pos || {}).length > 0 || Object.keys(activo.setLayout?.rot || {}).length > 0;
  const etiquetasOcultas = Object.keys(activo.setLayout?.labelsOff || {}).length;

  const agregarMueble = (tipo) => setCfg((c) => upSetPor(c, activo.id, (s) => {
    const id = uid();
    const n = (s.muebles || []).length;
    return {
      ...s,
      muebles: [...(s.muebles || []), { id, tipo, ocupantes: [] }],
      setLayout: { ...(s.setLayout || {}), pos: { ...(s.setLayout?.pos || {}), [`mue:${id}`]: posMuebleDefault(n) } },
    };
  }), { commit: true });

  const quitarMueble = (id) => setCfg((c) => upSetPor(c, activo.id, (s) => {
    const pos = { ...(s.setLayout?.pos || {}) };
    const rot = { ...(s.setLayout?.rot || {}) };
    delete pos[`mue:${id}`]; delete rot[`mue:${id}`];
    return { ...s, muebles: (s.muebles || []).filter((m) => m.id !== id), setLayout: { ...(s.setLayout || {}), pos, rot } };
  }), { commit: true });

  // Sentar/levantar un talento. Un talento solo ocupa un mueble a la vez.
  const toggleAsiento = (muebleId, talId) => {
    const mueble = (activo.muebles || []).find((m) => m.id === muebleId);
    if (!mueble) return;
    const dentro = (mueble.ocupantes || []).includes(talId);
    const cap = MUEBLES_CATALOGO[mueble.tipo]?.cap || 1;
    if (!dentro && (mueble.ocupantes || []).length >= cap) return; // lleno
    setCfg((c) => upSetPor(c, activo.id, (s) => ({
      ...s,
      muebles: (s.muebles || []).map((m) => {
        if (m.id === muebleId) {
          return dentro
            ? { ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== talId) }
            : { ...m, ocupantes: [...(m.ocupantes || []), talId] };
        }
        // Al sentarse aquí, se levanta de cualquier otro mueble.
        return dentro ? m : { ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== talId) };
      }),
    })), { commit: true });
  };

  const elegirSet = (id) => { setConfirmaDel(false); setCfg((c) => ({ ...c, setActivo: id }), { commit: true }); };
  const agregarSet = () => setCfg((c) => {
    const nuevo = setNuevo((c.sets || []).length + 1);
    return { ...c, sets: [...(c.sets || []), nuevo], setActivo: nuevo.id };
  }, { commit: true });
  const upActivo = (patch, opts) => setCfg((c) => upSetPor(c, activo.id, (s) => ({ ...s, ...patch })), opts);
  const eliminarSet = () => {
    if (!confirmaDel) { setConfirmaDel(true); return; }
    setConfirmaDel(false);
    setCfg((c) => {
      const rest = (c.sets || []).filter((s) => s.id !== activo.id);
      return rest.length ? { ...c, sets: rest, setActivo: rest[0].id } : c;
    }, { commit: true });
  };
  const chip = { borderColor: "#C8D2DE", color: "#33445F", background: "#fff" };

  return (
    <div className="scrollwrap overflow-auto px-2 py-4">
      <div className="vista-foco mx-auto flex flex-col gap-3 bg-white shadow-lg" style={{ width: 1240, maxWidth: "100%", padding: 16, borderRadius: 8 }}>
        <Box title={`Set / Estudio — planta física${sets.length > 1 ? ` (${sets.length} sets)` : ""}`}>
          {editable && (
            <div className="no-print flex flex-wrap items-center gap-1.5" style={{ marginBottom: 8 }}>
              {sets.map((s) => (
                <button key={s.id} onClick={() => elegirSet(s.id)}
                  className="rounded-lg border px-2.5 py-1 text-xs font-bold"
                  style={s.id === activo.id ? { background: NAVY, borderColor: NAVY, color: "#fff" } : chip}>
                  {s.nombre} {s.locacion === "ext" ? "· EXT" : "· INT"}
                </button>
              ))}
              <button onClick={agregarSet} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}>
                + Nuevo set
              </button>
              <span className="ml-auto">
                <TarjetaAyuda id="set" titulo="Cómo montar tu set"
                  pasos={[
                    "<b>Elige o crea un set</b> con los botones de arriba; cada set guarda su propia planta física.",
                    "<b>Agrega mobiliario</b> desde la paleta y arrástralo en el plano para colocarlo donde va.",
                    "Lo direccional (cámaras, luces, boom) <b>gira con su manija</b>; doble clic en la manija vuelve al ángulo automático.",
                    "<b>Doble clic en una etiqueta</b> la oculta; las casillas <b>Mostrar etiquetas / guías</b> controlan todo de golpe.",
                    "Si el plano se enreda, <b>Reacomodar automáticamente</b> reparte todo de nuevo.",
                  ]} />
              </span>
            </div>
          )}
          {editable && (
            <div className="no-print flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
              <input value={activo.nombre}
                onChange={(e) => upActivo({ nombre: e.target.value })}
                className="rounded-lg border px-2 py-1 text-xs font-bold"
                style={{ ...chip, width: 170 }} placeholder="Nombre del set…" />
              <select value={activo.locacion === "ext" ? "ext" : "int"}
                onChange={(e) => upActivo({ locacion: e.target.value }, { commit: true })}
                className="rounded-lg border px-2 py-1 text-xs font-bold" style={chip}>
                <option value="int">Estudio (interior)</option>
                <option value="ext">Locación exterior</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#33445F" }}>
                <input type="checkbox" checked={activo.mesaVisible !== false}
                  onChange={(e) => upActivo({ mesaVisible: e.target.checked }, { commit: true })} />
                Mesa / escritorio en el set
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#33445F" }} title="Muestra u oculta todos los nombres. Doble clic sobre una etiqueta del plano la oculta individualmente. Mantén el puntero encima de un icono para ver su nombre.">
                <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                Mostrar etiquetas
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#33445F" }} title="Muestra u oculta los conos de cámara, luz y boom.">
                <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
                Mostrar guías
              </label>
              {etiquetasOcultas > 0 && (
                <button onClick={() => setCfg((c) => upSetPor(c, activo.id, (s) => ({ ...s, setLayout: { ...s.setLayout, labelsOff: {} } })), { commit: true })}
                  className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}
                  title="Vuelve a mostrar las etiquetas ocultadas con doble clic">
                  ⟲ Restaurar {etiquetasOcultas} etiqueta{etiquetasOcultas === 1 ? "" : "s"}
                </button>
              )}
              {tieneCustom && (
                <button onClick={() => setCfg((c) => upSetPor(c, activo.id, reacomodoDe), { commit: true })}
                  className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}>
                  Reacomodar automáticamente
                </button>
              )}
              {sets.length > 1 && (
                <button onClick={eliminarSet} className="rounded-lg border px-2.5 py-1 text-xs font-bold"
                  style={{ borderColor: confirmaDel ? "#E0312F" : "#C8D2DE", color: confirmaDel ? "#E0312F" : "#8A97A8", background: "#fff" }}>
                  {confirmaDel ? "¿Eliminar este set y sus luces?" : "Eliminar set"}
                </button>
              )}
              {confirmaDel && (
                <button onClick={() => setConfirmaDel(false)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}>Cancelar</button>
              )}
            </div>
          )}
          <div className="no-print" style={{ marginBottom: 8 }}>
            <span className="text-xs" style={{ color: "#5B6B82" }}>
              Arrastra talentos, mesa, micrófonos, luces y cámaras; lo direccional gira con su manija (doble clic en la manija: volver al automático).
              {activo.mesaVisible === false ? " Sin mesa, el punto de foco marca a dónde apuntan cámaras y luces." : ""}
            </span>
          </div>
          <EstudioCenital key={activo.id} cfg={cfg} set={activo} cams={cams} editable={editable} setCfg={setCfg}
            showLabels={showLabels} showGuides={showGuides} />
        </Box>
        <Box title={`Mobiliario de ${activo.nombre}${(activo.muebles || []).length ? ` (${activo.muebles.length})` : ""}`}>
          {editable ? (
            <div className="flex flex-col gap-2.5">
              <SecTitle>Agregar mueble — haz clic para ponerlo en el plano</SecTitle>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MUEBLES_CATALOGO).map(([id, d]) => (
                  <button key={id} onClick={() => agregarMueble(id)} title={`Agregar ${d.es} al set`}
                    className="flex flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5"
                    style={{ borderColor: "#C8D2DE", background: "#fff", minWidth: 96, cursor: "pointer" }}>
                    <MuebleIcon tipo={id} />
                    <span className="text-xs font-bold" style={{ color: "#33445F" }}>{d.es}</span>
                    <span style={{ fontSize: 9, color: "#8A97A8", fontWeight: 700 }}>
                      {d.cap > 1 ? `${d.cap} plazas` : "1 plaza"}
                    </span>
                  </button>
                ))}
              </div>
              {(activo.muebles || []).length > 0 && (
                <>
                  <SecTitle>En el set ({(activo.muebles || []).length}) — siéntales talentos</SecTitle>
                  <p className="text-xs" style={{ color: "#8A97A8", margin: 0 }}>
                    El talento sentado se dibuja sobre el mueble y deja de aparecer suelto en el plano; cada quien solo ocupa un lugar.
                  </p>
                </>
              )}
              {(activo.muebles || []).map((m) => {
                const def = MUEBLES_CATALOGO[m.tipo] || { es: m.tipo, cap: 1 };
                const ocupantes = m.ocupantes || [];
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "#DDE4EC" }}>
                    <MuebleIcon tipo={m.tipo} width={48} height={22} />
                    <div className="flex flex-col" style={{ minWidth: 118 }}>
                      <span className="text-xs font-bold" style={{ color: "#33445F" }}>{def.es}</span>
                      <span style={{ fontSize: 11, letterSpacing: 2, color: NAVY }} title={`${ocupantes.length} de ${def.cap} plazas ocupadas`}>
                        {"●".repeat(ocupantes.length)}<span style={{ color: "#C8D2DE" }}>{"○".repeat(Math.max(0, def.cap - ocupantes.length))}</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "#8A97A8" }}>Sentar:</span>
                    {(cfg.talentos || []).map((t) => {
                      const dentro = ocupantes.includes(t.id);
                      const lleno = !dentro && ocupantes.length >= def.cap;
                      const col = t.tipo === "invitado" ? "#0E9F9E" : NAVY;
                      return (
                        <button key={t.id} onClick={() => toggleAsiento(m.id, t.id)} disabled={lleno}
                          title={dentro ? `Levantar a ${t.nombre}` : lleno ? "Sin plazas libres" : `Sentar a ${t.nombre} aquí`}
                          className="rounded-lg border px-2 py-0.5 text-xs font-bold"
                          style={dentro
                            ? { background: col, borderColor: col, color: "#fff" }
                            : { background: "#fff", borderColor: "#C8D2DE", color: "#33445F", opacity: lleno ? 0.4 : 1 }}>
                          {dentro ? "✓" : "+"} {trunc(t.nombre, 16)}
                        </button>
                      );
                    })}
                    {!(cfg.talentos || []).length && (
                      <span className="text-xs" style={{ color: "#8A97A8" }}>No hay talentos: créalos en la pestaña Editar.</span>
                    )}
                    <span className="flex-1" />
                    <button onClick={() => quitarMueble(m.id)} title="Quitar este mueble del set"
                      className="flex items-center justify-center rounded-lg border"
                      style={{ width: 26, height: 26, borderColor: "#E5CACA", color: "#C0392B", background: "#fff", cursor: "pointer" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              {!(activo.muebles || []).length && (
                <p className="text-xs" style={{ color: "#5B6B82", margin: 0 }}>
                  Aún no hay muebles en este set: haz clic en uno de arriba y luego arrástralo en el plano.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "#5B6B82", margin: 0 }}>
              {(activo.muebles || []).map((m) => (MUEBLES_CATALOGO[m.tipo] || { es: m.tipo }).es).join(" · ") || "Sin mobiliario."}
            </p>
          )}
        </Box>
        <Box title={`Iluminación de ${activo.nombre}${(activo.iluminacion?.luces || []).length ? ` (${activo.iluminacion.luces.length} luces)` : ""}`}>
          <PanelIluminacion key={activo.id} cfg={cfg} set={activo} setCfg={setCfg} />
        </Box>
        <Box title={`Personal de operación (${(cfg.personal || []).length}${cfg.includeCamOps ? ` + ${cams.length} cám.` : ""})`}>
          <PersonalGrid cfg={cfg} cams={cams} />
        </Box>
      </div>
    </div>
  );
}

// Pestaña "Escaleta / Rundown": ¿qué pasa primero, qué pasa después y cuánto dura?
// Solo la escaleta y la línea de tiempo.

// Asistente de programa en vivo (modo live): arma una ESCALETA EDITORIAL por
// bloques — qué contenido ocurre y su función dentro del programa. Las señales
// al aire y los comandos técnicos se detallan después en el rundown técnico.
function AsistenteEnVivo({ cfg, setCfg, onClose, onGenerado }) {
  const [paso, setPaso] = useState(0);
  const [confirma, setConfirma] = useState(false);
  const [p, setP] = useState(() => ({ tipoPrograma: "", durMin: 30, enVivo: true, nombre: "", ...(cfg.programa || {}) }));
  const up = (patch) => setP((x) => ({ ...x, ...patch }));
  const PASOS = ["Tipo", "Programa", "Generar"];
  const actual = PASOS[paso];
  const preview = useMemo(
    () => escaletaEnVivoDe(p.tipoPrograma || "noticiero", { durTotalSeg: Math.max(1, p.durMin || 30) * 60 }),
    [p.tipoPrograma, p.durMin],
  );
  const total = preview.reduce((n, s) => n + s.dur, 0);

  const generar = () => {
    if ((cfg.escaleta || []).length && !confirma) { setConfirma(true); return; }
    setCfg((c) => construirEscaletaEnVivo(c, p));
    onGenerado();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(9,20,35,.6)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ background: NAVY }}>
          <span className="text-lg">▤</span>
          <b className="text-white">Asistente de programa en vivo</b>
          <span className="flex-1" />
          {PASOS.map((s, i) => (
            <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={i === paso ? { background: "#FFD23F", color: "#15233D" } : { color: i < paso ? "#9DC1EC" : "#5B79A6" }}>{s}</span>
          ))}
          <button onClick={onClose} className="ml-1 text-white/70 hover:text-white" aria-label="Cerrar asistente"><X size={17} /></button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5" style={{ color: INK }}>
          {actual === "Tipo" && (<>
            <p className="m-0 text-sm font-bold">¿Qué tipo de programa vas a producir?</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {TIPOS_PROGRAMA.map((t) => (
                <button key={t.id} onClick={() => up({ tipoPrograma: t.id })} className="flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left"
                  style={p.tipoPrograma === t.id ? { borderColor: NAVY, background: "#EDF3FB", boxShadow: `0 0 0 1px ${NAVY}` } : { borderColor: "#C8D2DE" }}>
                  <span className="text-xl">{t.icono}</span>
                  <b className="text-sm">{t.nombre}</b>
                  <small className="text-slate-500">{t.detalle}</small>
                </button>
              ))}
            </div>
          </>)}

          {actual === "Programa" && (<>
            <p className="m-0 text-sm font-bold">Configuración del programa</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-bold uppercase" style={{ color: "#5F7189" }}>Nombre del programa
                <input className={inp} style={inpStyle} value={p.nombre || ""} placeholder="Noticiero universitario" onChange={(e) => up({ nombre: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold uppercase" style={{ color: "#5F7189" }}>Duración objetivo (min)
                <input type="number" min="1" max="180" className={inp} style={inpStyle} value={p.durMin} onChange={(e) => up({ durMin: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
            </div>
            <div className="flex gap-2">
              {[["En vivo", true], ["Grabado como en vivo", false]].map(([lab, val]) => (
                <button key={lab} onClick={() => up({ enVivo: val })} className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={p.enVivo === val ? { background: NAVY, color: "#fff", borderColor: NAVY } : { borderColor: "#C8D2DE", color: INK }}>{lab}</button>
              ))}
            </div>
            <p className="m-0 text-xs text-slate-500">Vista previa: {preview.length} segmentos en {new Set(preview.map((s) => s.bloque)).size} bloques · {fmt(total)}.</p>
          </>)}

          {actual === "Generar" && (<>
            <p className="m-0 text-sm font-bold">Así quedará tu escaleta editorial: contenido, orden y duración por bloques. La señal al aire y los comandos técnicos van después en el rundown.</p>
            <div className="flex flex-col gap-1.5">
              {preview.map((s, i) => (
                <div key={i} className="grid items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ gridTemplateColumns: "auto auto 1fr auto", borderColor: "#C8D2DE" }}>
                  <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: s.esCorte ? "#F07F13" : NAVY }}>B{s.bloque}</span>
                  <span className="text-xs font-bold text-slate-500">{i + 1}</span>
                  <span><b>{s.segmento}</b> <small className="text-slate-500">— {s.objetivo}</small></span>
                  <small className="text-slate-500">{fmt(s.dur)}</small>
                </div>
              ))}
            </div>
            {confirma && (
              <p className="m-0 rounded-lg border px-3 py-2 text-sm font-bold" style={{ borderColor: "#E8B4B4", background: "#FDF2F2", color: "#B4232A" }}>
                Ya existe una escaleta con {(cfg.escaleta || []).length} segmentos: se reemplazará por estos {preview.length}. ¿Continuar?
              </p>
            )}
          </>)}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "#E2E8F0" }}>
          <button onClick={() => { setConfirma(false); setPaso((x) => Math.max(0, x - 1)); }} disabled={paso === 0}
            className={`${btn} border disabled:opacity-40`} style={{ borderColor: "#C8D2DE", color: INK }}>← Atrás</button>
          <span className="flex-1" />
          {actual !== "Generar"
            ? <button onClick={() => setPaso((x) => Math.min(PASOS.length - 1, x + 1))} disabled={actual === "Tipo" && !p.tipoPrograma} className={`${btn} text-white disabled:opacity-40`} style={{ background: NAVY }}>Siguiente →</button>
            : <button onClick={generar} className={`${btn} text-white`} style={{ background: confirma ? "#B4232A" : "#1FA14E" }}>
                {confirma ? "Sí, reemplazar y generar" : "▤ Generar escaleta editorial"}
              </button>}
        </div>
      </div>
    </div>
  );
}

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

function Card({ title, children, open = true }) {
  return (
    <details open={open} className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#C8D2DE" }}>
      <summary className="cond cursor-pointer select-none font-bold uppercase text-white"
        style={{ background: NAVY, padding: "7px 12px", fontSize: 15, letterSpacing: 1, listStyle: "none" }}>{title}</summary>
      <div className="p-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}


/* ----------------------------- Arrastrar y soltar ----------------------------- */

// Hook reutilizable para reordenar listas con arrastrar y soltar (HTML5 DnD).
// `source(i)` se aplica al "asa" que se arrastra; `target(i)` a la zona donde se suelta.
function useReorder(onReorder) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const source = (i) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragIdx(i);
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", String(i)); } catch {}
    },
    onDragEnd: () => { setDragIdx(null); setOverIdx(null); },
  });
  const target = (i) => ({
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overIdx !== i) setOverIdx(i); },
    onDrop: (e) => {
      e.preventDefault();
      if (dragIdx != null && dragIdx !== i) onReorder(dragIdx, i);
      setDragIdx(null); setOverIdx(null);
    },
  });
  return { dragIdx, overIdx, source, target };
}

function Swatches({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PALETTE.map((c) => (
        <button key={c} onClick={() => onChange(c)} aria-label={c}
          className="rounded-full" style={{
            width: 18, height: 18, background: c,
            outline: value === c ? `2px solid ${INK}` : "1px solid rgba(0,0,0,.15)", outlineOffset: 2,
          }} />
      ))}
    </div>
  );
}

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

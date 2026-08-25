import React, { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Monitor, Clapperboard, Eye, Pencil, Undo2, Redo2, Share2, Link2, Check,
} from "lucide-react";
import LZString from "lz-string";
import { uid, slug } from "./util.js";
import { INK, NAVY } from "./theme.js";
import { EMBEDDED } from "./puente.js";

import { VistaEscaleta } from "./VistaEscaleta.jsx";
import { Infografia } from "./Infografia.jsx";
import { Editor } from "./Editor.jsx";
import { EditorGuion } from "./EditorGuion.jsx";
import { PanelSugerencias } from "./PanelSugerencias.jsx";
import { DEMO, normalizeCfg, esNarrativo } from "./proyecto.js";
import { VistaSet } from "./VistaSet.jsx";

// Modos que entiende el puente con el escritorio. Los tres últimos son ETAPAS:
// el editor completo filtrado a las tarjetas de esa etapa.
const GRUPOS = ["perfil", "necesidades", "tiempos"];
const MODOS = ["editar", "vista", "set", "escaleta", "guion", ...GRUPOS];

/* ----------------------------- Tokens / utilidades ----------------------------- */




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


/* ----------------------------- App ----------------------------- */

export default function GeneradorInfografiaTV() {
  const compartido = useMemo(() => leerProyectoCompartido(), []);
  const readonly = !!compartido;
  const { cfg, setCfg, undo, redo, reset, canUndo, canRedo } = useHistory(normalizeCfg(compartido || DEMO()));
  const [modo, setModo] = useState("vista");
  const [proyectos, setProyectos] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // Las sugerencias solo aparecen cuando se piden con el botón 💡.
  const [sugerencias, setSugerencias] = useState(false);
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
  // Desde 2026-08-24 el escritorio pide ETAPAS ('perfil', 'necesidades',
  // 'tiempos'): el mismo editor mostrando solo las tarjetas de esa etapa.
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
      if (event.data?.type === "producciontv:set-mode" && MODOS.includes(event.data.mode)) {
        setModo(event.data.mode);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [cfg, reset]);

  useEffect(() => {
    window.parent.postMessage({ type: "producciontv:infografia-state", cfg }, "*");
  }, [cfg]);

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
        {/* Dentro del escritorio manda la barra de etapas; estas pestañas solo
            tienen sentido en la versión web, que no la tiene. */}
        {!EMBEDDED && <div className="mode-tabs flex gap-1 rounded-lg p-1" style={{ background: "rgba(255,255,255,.12)" }}>
          {/* En la app de escritorio Set y Escaleta tienen pestaña propia en la
              barra lateral; en la web (PWA) se muestran aquí. */}
          {!readonly && tab("editar", Pencil, "Editar")}
          {tab("vista", Eye, "Infografía")}
          {!EMBEDDED && tab("set", Monitor, "Set")}
          {!EMBEDDED && tab("escaleta", Clapperboard, "Escaleta")}
        </div>}
        <button onClick={() => setSugerencias((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold"
          title="Revisa tu proyecto y explica qué convendría ajustar. No cambia nada por su cuenta."
          style={sugerencias
            ? { background: "#1FA14E", color: "#fff" }
            : { background: "#fff", color: INK, border: "1px solid #C8D2DE" }}>
          💡 Sugerencias
        </button>
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

      {(modo === "editar" || GRUPOS.includes(modo)) && !readonly ? (
        <Editor cfg={cfg} setCfg={setCfg} proyectos={proyectos} guardar={guardar} cargar={cargar} eliminar={eliminar}
          grupo={modo === "editar" ? "todo" : modo} />
      ) : modo === "set" ? (
        <VistaSet cfg={cfg} setCfg={readonly ? undefined : setCfg} />
      ) : modo === "guion" ? (
        <EditorGuion cfg={cfg} setCfg={readonly ? undefined : setCfg} />
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
      {sugerencias && <PanelSugerencias cfg={cfg} setCfg={readonly ? undefined : setCfg} onClose={() => setSugerencias(false)} />}
    </div>
  );
}

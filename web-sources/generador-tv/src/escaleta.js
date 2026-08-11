// Cálculos de la escaleta/rundown y exportadores (CSV y EDL). Son funciones
// PURAS: reciben el proyecto (cfg) y devuelven datos; no dibujan ni tocan la
// interfaz. Toman prestadas fmt/csvCell/toTC de util.js.
import { fmt, csvCell, toTC } from "./util.js";

const SEG_CORTO = 15;   // segundos: por debajo se marca "muy corto"
const SEG_LARGO = 180;  // segundos: por encima se marca "muy largo"

// Fuentes al aire = cámaras + fuentes extra del proyecto.
export function computeFuentes(cfg) {
  const cams = cfg.camaras.map((c, i) => ({
    id: c.id, tipo: "cam", num: i + 1,
    nombre: c.nombre || `CAM ${i + 1}`, plano: c.plano || "", color: c.color, esCorte: false,
  }));
  const extras = cfg.extras.map((x) => ({
    id: x.id, tipo: "extra", nombre: x.nombre || "FUENTE", color: x.color, esCorte: !!x.esCorte,
  }));
  return [...cams, ...extras];
}

// Filas de la escaleta con tiempos de entrada/salida acumulados.
export function computeRows(cfg) {
  let t = 0;
  return cfg.escaleta.map((s, i) => {
    const tin = t; t += s.dur || 0;
    return { ...s, idx: i + 1, tin, tout: t };
  });
}

// Agrupa filas en bloques de contenido y cortes consecutivos.
export function computeBloques(rows, byId) {
  const g = [];
  rows.forEach((r) => {
    const f = byId[r.fuente];
    const corte = !!(f && f.esCorte);
    const last = g[g.length - 1];
    if (last && last.corte === corte) last.dur += r.dur || 0;
    else g.push({ corte, dur: r.dur || 0 });
  });
  let b = 0, c = 0;
  return g.map((x) => ({ ...x, label: x.corte ? `CORTE ${++c}` : `BLOQUE ${++b}` }));
}

// Analiza la escaleta: totales, conteos y avisos (segmentos muy cortos/largos,
// sin fuente, o en 00:00).
export function analizarEscaleta(cfg) {
  const fuentes = computeFuentes(cfg);
  const byId = Object.fromEntries(fuentes.map((f) => [f.id, f]));
  const rows = computeRows(cfg);
  const total = rows.length ? rows[rows.length - 1].tout : 0;

  let durCortes = 0, nCortes = 0, durContenido = 0;
  const avisos = [];
  rows.forEach((r) => {
    const f = byId[r.fuente];
    if (f && f.esCorte) { durCortes += r.dur || 0; nCortes += 1; }
    else durContenido += r.dur || 0;
    if (!f) avisos.push({ tipo: "error", msg: `“${r.segmento || "Sin nombre"}” no tiene una fuente válida asignada.` });
    else if ((r.dur || 0) > 0 && (r.dur || 0) < SEG_CORTO) avisos.push({ tipo: "warn", msg: `“${r.segmento}” dura ${fmt(r.dur)} (muy corto, < ${SEG_CORTO}s).` });
    else if ((r.dur || 0) > SEG_LARGO) avisos.push({ tipo: "info", msg: `“${r.segmento}” dura ${fmt(r.dur)} (largo, > ${Math.round(SEG_LARGO / 60)} min). Considera dividirlo.` });
    if ((r.dur || 0) === 0) avisos.push({ tipo: "warn", msg: `“${r.segmento || "Sin nombre"}” tiene duración 00:00.` });
  });
  if (rows.length === 0) avisos.push({ tipo: "info", msg: "La escaleta está vacía. Agrega segmentos para ver el análisis." });

  return {
    total, segCount: rows.length, nCortes, durCortes, durContenido,
    avisos,
  };
}

// Exporta la escaleta como CSV (Excel / Google Sheets).
export function generarCSV(cfg) {
  const fuentes = computeFuentes(cfg);
  const byId = Object.fromEntries(fuentes.map((f) => [f.id, f]));
  const rows = computeRows(cfg);
  const head = ["#", "IN", "OUT", "DUR", "SEGMENTO", "FUENTE", "NOTA"];
  const lines = [head.map(csvCell).join(",")];
  rows.forEach((r) => {
    const f = byId[r.fuente];
    lines.push([r.idx, fmt(r.tin), fmt(r.tout), fmt(r.dur), r.segmento, f ? f.nombre : "—", r.nota || ""].map(csvCell).join(","));
  });
  return lines.join("\r\n");
}

// EDL básico estilo CMX 3600 (importable en DaVinci Resolve / Premiere).
export function generarEDL(cfg) {
  const fuentes = computeFuentes(cfg);
  const byId = Object.fromEntries(fuentes.map((f) => [f.id, f]));
  const rows = computeRows(cfg);
  const titulo = (cfg.titulo || "RUNDOWN").replace(/[\r\n]+/g, " ");
  const out = [`TITLE: ${titulo}`, "FCM: NON-DROP FRAME", ""];
  rows.forEach((r, i) => {
    const f = byId[r.fuente];
    const ev = String(i + 1).padStart(3, "0");
    const reel = "AX";
    const recIn = toTC(r.tin), recOut = toTC(r.tout);
    out.push(`${ev}  ${reel}       V     C        ${recIn} ${recOut} ${recIn} ${recOut}`);
    out.push(`* FROM CLIP NAME: ${(f ? f.nombre : "FUENTE")} - ${r.segmento || ""}`.trim());
    if (r.nota) out.push(`* COMMENT: ${r.nota.replace(/[\r\n]+/g, " ")}`);
    out.push("");
  });
  return out.join("\n");
}

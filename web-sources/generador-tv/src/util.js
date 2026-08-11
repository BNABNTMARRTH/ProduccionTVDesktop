// Funciones de utilidad PURAS (sin estado, sin React): dan formato al tiempo,
// interpretan duraciones, eligen un color de texto legible, recortan textos, etc.
// Al no depender de la interfaz, se pueden probar y reutilizar por separado.

// Mueve un elemento de un índice a otro (para arrastrar y soltar).
export const reorder = (list, from, to) => {
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
};

// Convierte segundos a timecode HH:MM:SS:FF (frames a 0; fps solo informativo).
export const toTC = (s) => {
  s = Math.max(0, Math.round(s || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:00`;
};

// Escapa un valor para una celda CSV (comillas, comas o saltos de línea).
export const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Genera un identificador corto y aleatorio.
export const uid = () => Math.random().toString(36).slice(2, 9);

// Formatea segundos a MM:SS.
export const fmt = (s) => {
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

// Interpreta una duración escrita por el usuario ("90", "1:30", "1:02:00") a segundos.
export const parseDur = (t) => {
  if (t == null) return null;
  t = String(t).trim();
  if (!t) return null;
  if (t.includes(":")) {
    const p = t.split(":").map((n) => parseInt(n, 10));
    if (p.some(isNaN)) return null;
    return p.reduce((a, n) => a * 60 + n, 0);
  }
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
};

// Elige color de texto (oscuro o blanco) legible sobre un fondo hex dado.
export const textOn = (hex) => {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#1A2433" : "#FFFFFF";
  } catch { return "#FFFFFF"; }
};

// Recorta un texto a n caracteres agregando "…".
export const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

// Convierte un nombre en un "slug" apto para nombre de archivo.
export const slug = (s) => (s || "proyecto").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "proyecto";

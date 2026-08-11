// Catálogos de vocabulario audiovisual de la app.
// Son sólo DATOS (listas y etiquetas), sin lógica ni componentes: por eso viven
// en su propia cajita, separados del componente grande. Para agregar un tipo de
// plano, de micrófono o de cue, se edita AQUÍ y no hace falta tocar la interfaz.

// Tipos de encuadre para el guion técnico (datalist: se puede escribir otro).
export const PLANOS = [
  "Gran Plano General", "Plano General", "Plano Entero", "Plano Conjunto",
  "Plano Americano", "Plano Medio", "Plano Medio Corto",
  "Plano Medio Izquierdo", "Plano Medio Derecho",
  "Primer Plano", "Primerísimo Primer Plano", "Plano Detalle", "Insert",
  "Two Shot", "Over the Shoulder",
  "Plano Cenital", "Plano Nadir", "Plano Picado", "Plano Contrapicado", "Plano Holandés",
  "Plano Subjetivo (POV)", "Plano Recurso (B-Roll)", "Plano Secuencia",
];

// Movimientos de cámara para el guion técnico (datalist: se puede escribir otro).
export const MOVIMIENTOS = [
  "Fija", "Paneo izquierda", "Paneo derecha", "Tilt up", "Tilt down",
  "Zoom in", "Zoom out", "Dolly in", "Dolly out", "Travelling", "A mano", "Grúa",
];

// Tipos de micrófono y a quién/qué se asignan por defecto.
export const MIC_TIPOS = [
  { id: "dinamico", label: "Dinámico (de mano)", asigna: "talento" },
  { id: "solapa", label: "Solapa (lavalier)", asigna: "talento" },
  { id: "shotgun", label: "Shotgun (en cámara)", asigna: "camara" },
  { id: "boom", label: "Boom (perchado en el set)", asigna: "set" },
];
export const MIC_TIPO_CORTO = { dinamico: "dinámico", solapa: "solapa", shotgun: "shotgun", boom: "boom" };

// Tipos de cue del rundown (modo en vivo) con su color de identificación.
export const CUE_TIPOS = [
  { id: "camara", label: "Cámara", color: "#1D6FD1" },
  { id: "grafico", label: "Gráfico", color: "#EAB308" },
  { id: "audio", label: "Audio", color: "#1FA14E" },
  { id: "vtr", label: "VTR / Playback", color: "#8B5CF6" },
  { id: "comercial", label: "Comercial", color: "#F07F13" },
  { id: "cortinilla", label: "Cortinilla", color: "#DB2777" },
  { id: "instruccion", label: "Instrucción", color: "#64748B" },
];
export const CUE_TIPO = Object.fromEntries(CUE_TIPOS.map((t) => [t.id, t]));

// Estados por los que pasa un cue durante la preparación y la emisión.
export const CUE_ESTADOS = [
  { id: "borrador", label: "Borrador", icon: "○", color: "#94A3B8" },
  { id: "preparacion", label: "En preparación", icon: "◐", color: "#D97706" },
  { id: "listo", label: "Listo", icon: "✓", color: "#1FA14E" },
  { id: "ejecutado", label: "Ejecutado", icon: "●", color: "#2563EB" },
  { id: "revision", label: "Revisión", icon: "!", color: "#DC2626" },
  { id: "omitido", label: "Omitido", icon: "✕", color: "#9CA3AF" },
];
export const CUE_ESTADO = Object.fromEntries(CUE_ESTADOS.map((e) => [e.id, e]));

// Transiciones disponibles entre cues/tomas.
export const TRANSICIONES = ["Corte", "Disolvencia", "Fade in", "Fade out", "Wipe", "Stinger"];

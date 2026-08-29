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

// Fuentes comunes para alta rápida en la escaleta (color e indicador de si es un corte).
export const CATALOGO_FUENTES = [
  { nombre: "COMERCIALES", color: "#F3C513", esCorte: true },
  { nombre: "VTR / VIDEO", color: "#64748B", esCorte: false },
  { nombre: "GRÁFICOS / GFX", color: "#0E9F9E", esCorte: false },
  { nombre: "REMOTO / VIDEOLLAMADA", color: "#8B5CF6", esCorte: false },
  { nombre: "DRON", color: "#1D6FD1", esCorte: false },
  { nombre: "CÁMARA EXTERNA", color: "#1FA14E", esCorte: false },
  { nombre: "PLAYBACK / MÚSICA", color: "#D1268F", esCorte: false },
  { nombre: "PRESENTACIÓN / SLIDES", color: "#F07F13", esCorte: false },
];

// Secciones de la infografía (orden y abrir/cerrar son configurables por el usuario).
export const SECCIONES_INFO = [
  { id: "estudio", label: "Set / Estudio" },
  { id: "flujo", label: "Flujo de producción" },
  { id: "escaleta", label: "Escaleta / Rundown" },
  { id: "monitores", label: "Monitores en cabina" },
  { id: "personal", label: "Personal de operación" },
  { id: "timeline", label: "Línea de tiempo" },
  { id: "leyenda", label: "Leyenda" },
];
// "flujo", "monitores" y "leyenda" ahora viven fuera (Set y Escaleta tienen pestaña
// propia). Siguen siendo ids válidos en datos guardados para no romper proyectos
// viejos; solo dejan de renderizarse en la hoja.
export const SECCIONES_DEPRECADAS = ["flujo", "monitores", "leyenda"];
export const SECCIONES_IDS = SECCIONES_INFO.map((s) => s.id);
export const seccionesDefault = () => SECCIONES_INFO.map((s) => ({ id: s.id, abierto: true }));

// Roles del personal de operación y el nombre (texto) de su icono.
export const CATALOGO_ROLES = [
  { rol: "Director de cámaras", icon: "director" },
  { rol: "Operador de switcher", icon: "switcher" },
  { rol: "Operador de audio", icon: "audio" },
  { rol: "Operador de gráficos", icon: "graficos" },
  { rol: "Operador de playback", icon: "playback" },
  { rol: "Conductor(a)", icon: "conductor" },
  { rol: "Floor manager", icon: "floor" },
  { rol: "Iluminador", icon: "luces" },
  { rol: "Productor", icon: "productor" },
  { rol: "Continuista / Script", icon: "script" },
];

// Mobiliario del set. cap = plazas para talentos; "mitad" ayuda a dibujar la manija
// de giro. (Ojo: hoy también existe una copia en tools/shared/sheets.js; al unificar
// el dibujo del plano —Fase 1— esa hoja debería leer desde aquí.)
// LAS MESAS SON MOBILIARIO (2026-08-28). Antes el set traía una mesa FIJA de
// serie —la dibujaba el propio lienzo, salía en todos los proyectos aunque no
// hiciera falta y no se podía duplicar ni cambiar de forma—. Ahora la mesa se
// agrega como cualquier otro mueble: se mueve, se gira, se quita y se pueden
// poner varias. Y hay mesa redonda, que es la de los paneles y las tertulias.
// (Los proyectos viejos conservan su mesa fija; ver mesaVisible en proyecto.js.)
export const MUEBLES_CATALOGO = {
  mesa:        { es: "Mesa / escritorio", cap: 3, mitad: 62 },
  mesaRedonda: { es: "Mesa redonda",      cap: 6, mitad: 50 },
  podio:   { es: "Atril / podio",      cap: 1, mitad: 17 },
  sillon1: { es: "Sillón individual",  cap: 1, mitad: 24 },
  sillon2: { es: "Sofá de 2 plazas",   cap: 2, mitad: 38 },
  sillon3: { es: "Sofá de 3 plazas",   cap: 3, mitad: 52 },
  silla:   { es: "Silla",              cap: 1, mitad: 12 },
  banco:   { es: "Banco alto",         cap: 1, mitad: 11 },
};
// Dónde se sienta cada ocupante, relativo al centro del mueble (antes de
// girar). En las mesas la gente NO se sienta encima: se sienta alrededor —
// detrás del escritorio, y en corro en la redonda—, que es como se ve en un
// plano de planta de verdad. El primer asiento va al centro, para que una sola
// persona no quede descuadrada.
export const MUEBLE_ASIENTOS = {
  mesa: [{ x: 0, y: -34 }, { x: -42, y: -34 }, { x: 42, y: -34 }],
  mesaRedonda: [
    { x: 0, y: -46 }, { x: 40, y: -23 }, { x: 40, y: 23 },
    { x: 0, y: 46 }, { x: -40, y: 23 }, { x: -40, y: -23 },
  ],
  podio: [{ x: 0, y: -26 }],
  sillon1: [{ x: 0, y: 0 }],
  sillon2: [{ x: -19, y: 0 }, { x: 19, y: 0 }],
  sillon3: [{ x: -33, y: 0 }, { x: 0, y: 0 }, { x: 33, y: 0 }],
  silla: [{ x: 0, y: 0 }],
  banco: [{ x: 0, y: 0 }],
};

// Asistente narrativo: mapeo de plantilla → tipo, y tonos sugeridos.
export const TIPO_DESDE_PLANTILLA = { podcast: "podcast", noticiero: "estudio", entrevista: "entrevista", streaming: "estudio", multicamara: "estudio" };
export const TONOS = ["Ligero", "Serio", "Oscuro", "Poético", "Irónico", "Épico", "Íntimo", "Cálido"];

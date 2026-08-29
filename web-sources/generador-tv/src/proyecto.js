// El PROYECTO en sí: cómo nace y cómo se pone al día.
//   · DEMO()    → proyecto de ejemplo con el que arranca la app.
//   · BLANCO()  → proyecto vacío para empezar de cero.
//   · normalizeCfg() → MIGRA proyectos guardados con versiones anteriores al
//     modelo actual (talentos, sets, mobiliario, iluminación) sin perder datos.
// Son funciones puras: reciben y devuelven datos, no dibujan nada.
import { MUEBLES_CATALOGO, SECCIONES_IDS, SECCIONES_INFO, seccionesDefault } from "./catalogos.js";
import { getSetup, instanciarSetup } from "./iluminacion.js";
import { posMuebleDefault, setNuevo } from "./sets.js";
import { NAVY, PALETTE } from "./theme.js";
import { uid } from "./util.js";

// Normaliza el orden/estado de secciones: conserva el orden guardado, agrega las
// que falten al final y descarta ids desconocidos (compatibilidad con proyectos viejos).
// Modo del proyecto: 'live' (programa en vivo) o 'narrative' (por escenas y
// planos). Los proyectos anteriores a los modos se leen como 'live'.
// Duración OBJETIVO del proyecto, en minutos (0 = sin definir). Los proyectos
// hechos con el asistente en vivo (retirado) la guardaban en programa.durMin:
// se sigue leyendo para no perderla.
/* DURACIÓN OBJETIVO — cuánto DEBE durar el proyecto terminado.

   Se guarda en SEGUNDOS, en `duracionObjetivoSeg`. Antes se guardaba en
   minutos ENTEROS y eso dejaba fuera a media producción escolar: un spot de
   30", una cápsula de 50", un reel de 90". Lo más chico que se podía escribir
   era 1 minuto, así que esas piezas se quedaban sin objetivo — y sin objetivo
   no hay aviso de "te estás pasando" ni costo por segundo confiable.

   `duracionObjetivoMin` (minutos) es el campo viejo. Se sigue leyendo para no
   romper los proyectos ya guardados; solo se vuelve a escribir cuando el
   objetivo cae en minutos exactos. */
export const objetivoSegDe = (cfg) => {
  const seg = Number(cfg?.duracionObjetivoSeg);
  if (Number.isFinite(seg) && seg > 0) return Math.round(seg);
  const min = Number(cfg?.duracionObjetivoMin || cfg?.programa?.durMin || 0) || 0;
  return Math.round(min * 60);
};

/* CUÁNTO SE VALE DESVIARSE del objetivo antes de avisar. Va con el tamaño de
   la pieza: media hora aguanta medio minuto de sobra sin que nadie lo note,
   pero una cápsula de 30 segundos no — ahí 20 segundos son dos tercios de
   todo. Un décimo de la pieza, nunca menos de 5 s ni más de 30 s. */
export const toleranciaDe = (objetivoSeg) => Math.max(5, Math.min(30, (objetivoSeg || 0) * 0.1));

// El mismo dato en minutos. Puede salir fraccionario (50 s = 0.83 min), así
// que para MOSTRARLO usa siempre segundos con fmt(); esto es para comparar.
export const objetivoDe = (cfg) => objetivoSegDe(cfg) / 60;

export const esNarrativo = (cfg) => cfg?.modo === "narrative";

export const normSecciones = (arr) => {
  const valid = Array.isArray(arr) ? arr.filter((s) => SECCIONES_IDS.includes(s.id)) : [];
  const seen = new Set(valid.map((s) => s.id));
  const missing = SECCIONES_INFO.filter((s) => !seen.has(s.id)).map((s) => ({ id: s.id, abierto: true }));
  return [...valid.map((s) => ({ id: s.id, abierto: s.abierto !== false })), ...missing];
};

export const DEMO = () => ({
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
  perfil: perfilVacio(),
});

/* ------------------------------- PERFIL -------------------------------
El brief que toda producción necesita ANTES de grabar: quién habla (emisor),
qué dice (mensaje), para qué (intención), a quién (receptor y su edad), por
dónde lo va a ver (medios) y con cuánto dinero. Vive en cfg.perfil y aplica
igual a un programa en vivo que a un cortometraje. */

// Por dónde consume medios el público al que le hablas.
export const MEDIOS = [
  "TikTok", "Instagram / Reels", "YouTube", "Facebook", "WhatsApp",
  "TV abierta", "TV de paga", "Streaming", "Cine", "Radio", "Podcast",
  "Prensa impresa", "Pantallas en la calle", "Evento en vivo",
];

// La forma del cuadro. Se elige VIENDO la proporción, no leyendo "9:16", y
// sale de por dónde lo va a ver el receptor: vertical para TikTok y Reels,
// panorámico para cine. Decide encuadre, títulos y hasta dónde se para la gente.
export const FORMATOS = [
  { id: "9:16",   nombre: "9:16",   w: 9,    h: 16, para: "TikTok, Reels, Shorts" },
  { id: "4:5",    nombre: "4:5",    w: 4,    h: 5,  para: "Feed de Instagram" },
  { id: "1:1",    nombre: "1:1",    w: 1,    h: 1,  para: "Cuadrado, feed" },
  { id: "16:9",   nombre: "16:9",   w: 16,   h: 9,  para: "YouTube, TV, streaming" },
  { id: "2.39:1", nombre: "2.39:1", w: 2.39, h: 1,  para: "Cine panorámico" },
];

// Alcance: hasta dónde llega la pieza (sección 1.6 del flujo de producción).
export const ALCANCES = ["Local", "Estatal", "Nacional", "Internacional"];

// Cuánto sabe ya el receptor del tema. Cambia cuánto hay que explicar.
export const CONOCIMIENTOS = [
  "Nada, hay que explicarle desde cero",
  "Algo, reconoce el tema",
  "Mucho, ya lo conoce bien",
];

/* REPARTO DEL PRESUPUESTO
Los rangos NO son inventados: son los que usa la industria (Above the Line /
Below the Line). Dos datos que valen para un alumno y que el reparto enseña
solo: tramoya y eléctrico es el departamento más caro de todo el rodaje
(8-15% del total, no la cámara), y por debajo de 10% en posproducción te
quedas sin dinero antes de terminar la pieza.
Fuentes: saturation.io/blog/film-budget-breakdown-by-department ·
produccionaudiovisual.com (above the line / below the line). */
export const BLOQUES = [
  { id: "atl",    nombre: "Sobre la línea", detalle: "guion · dirección · producción · elenco", min: 25, max: 35, color: "#3C8FE0" },
  { id: "btl",    nombre: "Bajo la línea",  detalle: "rodaje · cámara · luces · locación · arte", min: 40, max: 50, color: "#E08A12" },
  { id: "pos",    nombre: "Posproducción",  detalle: "edición · sonido · música · color",        min: 10, max: 20, color: "#D9602B" },
  { id: "imprev", nombre: "Imprevistos",    detalle: "seguro · reserva · lo que siempre pasa",    min: 5,  max: 10, color: "#B4AEA2" },
];
export const repartoVacio = () => ({ atl: 30, btl: 45, pos: 15, imprev: 10 });

export const perfilVacio = () => ({
  emisor: "",           // quién produce y firma la pieza
  mensaje: "",          // la idea en una frase
  intencion: [],        // qué quieres que pase en quien lo vea
  receptor: "",         // a quién le hablas
  edad: "",             // rango de edad
  medios: [],           // dónde lo va a ver
  presupuesto: "",      // monto estimado en pesos
  presupuestoNota: "",  // de dónde sale el dinero
  // --- agregados 2026-08-26 ---
  genero: "",           // comercial, documental, videoclip…
  formato: "",          // la forma del cuadro (vacío = se sugiere sola)
  entrega: "",          // fecha comprometida (YYYY-MM-DD)
  alcance: "",          // hasta dónde llega
  conocimiento: "",     // cuánto sabe ya el receptor
  tono: "",             // cómico, solemne, íntimo…
  referencias: "",      // a qué se debe parecer
  reparto: repartoVacio(),
});

// Rellena el perfil y RESCATA lo que antes vivía suelto en el brief narrativo
// (mensaje clave, audiencia e impacto), para no perder lo ya capturado.
export const normPerfil = (perfil, narrativa) => {
  const p = { ...perfilVacio(), ...(perfil || {}) };
  if (!p.mensaje && narrativa?.mensaje) p.mensaje = narrativa.mensaje;
  if (!p.receptor && narrativa?.audiencia) p.receptor = narrativa.audiencia;
  if (!p.intencion.length && narrativa?.impacto) p.intencion = [narrativa.impacto];
  p.intencion = Array.isArray(p.intencion) ? p.intencion : [];
  p.medios = Array.isArray(p.medios) ? p.medios : [];
  // El reparto se repone entero: un proyecto viejo no lo trae y una sola
  // llave faltante rompería la suma.
  p.reparto = { ...repartoVacio(), ...(p.reparto || {}) };
  if (!FORMATOS.some((f) => f.id === p.formato)) p.formato = formatoSugerido(p.medios);
  return p;
};

// Qué forma de cuadro pide lo que el receptor usa. Si solo ve vertical, la
// pieza es vertical: grabar horizontal para TikTok es tirar la mitad del cuadro.
export function formatoSugerido(medios = []) {
  const m = new Set(medios);
  const soloVertical = ["TikTok", "Instagram / Reels"].some((x) => m.has(x))
    && !["Cine", "TV abierta", "TV de paga", "Streaming"].some((x) => m.has(x));
  if (soloVertical) return "9:16";
  if (m.has("Cine")) return "2.39:1";
  return "16:9";
}

// Cuánto cuesta cada segundo que queda en pantalla. Es el número que de verdad
// pone en perspectiva si el presupuesto alcanza para lo que se quiere grabar.
export function porSegundo(presupuesto, segundos) {
  const p = Number(String(presupuesto).replace(/[^\d.]/g, ""));
  if (!p || !segundos) return null;
  return Math.round(p / segundos);
}

// Reparto en pesos + qué bloques se salieron del rango de la industria.
export function repartoCalculado(perfil) {
  const total = Number(String(perfil?.presupuesto || "").replace(/[^\d.]/g, "")) || 0;
  const r = { ...repartoVacio(), ...(perfil?.reparto || {}) };
  const filas = BLOQUES.map((b) => {
    const pct = Number(r[b.id]) || 0;
    return { ...b, pct, mxn: Math.round(total * pct / 100), fuera: pct < b.min || pct > b.max };
  });
  return { total, filas, suma: filas.reduce((a, f) => a + f.pct, 0) };
}

export const BLANCO = () => ({
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
export const normalizeCfg = (cfg) => {
  const c = {
    ...cfg,
    microfonos: Array.isArray(cfg?.microfonos) ? cfg.microfonos : [],
    branding: cfg?.branding || { primaryColor: NAVY, logoDataUrl: "" },
    secciones: normSecciones(cfg?.secciones),
    perfil: normPerfil(cfg?.perfil, cfg?.narrativa),
    // Sin esto, un proyecto viejo sin `flujo` tumbaba la pantalla entera.
    flujo: { preview: true, playback: true, ...(cfg?.flujo || {}) },
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

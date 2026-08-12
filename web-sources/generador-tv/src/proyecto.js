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
export const objetivoDe = (cfg) => Number(cfg?.duracionObjetivoMin || cfg?.programa?.durMin || 0) || 0;

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
});

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

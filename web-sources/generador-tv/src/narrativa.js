// Catálogo narrativo del Asistente de producción audiovisual.
// Fundamentos: manual de storytelling (premisa, personajes imperfectos,
// estructuras: sencilla / tres actos / círculo de Dan Harmon / libre),
// manual de diseño audiovisual (el plano se elige por la información que
// debe mostrar; el establecimiento sitúa al espectador) y La audiovisión de
// Chion (el sonido se decide POR ESCENA, no como apartado final).
//
// Módulo puro (sin React) para poder probarlo con node --test y compartirlo
// con el generador.

export const TIPOS_PROYECTO = [
  { id: 'ficcion', nombre: 'Ficción', icono: '🎬', detalle: 'Cortometraje, escena dramática o comedia' },
  { id: 'documental', nombre: 'Documental', icono: '🎥', detalle: 'Sujetos reales, evidencia y punto de vista' },
  { id: 'videoclip', nombre: 'Videoclip', icono: '🎵', detalle: 'La canción da la estructura temporal' },
  { id: 'estudio', nombre: 'Programa de estudio', icono: '📺', detalle: 'Multicámara, bloques y operación técnica' },
  { id: 'entrevista', nombre: 'Entrevista', icono: '🎙', detalle: 'Conversación con propósito' },
  { id: 'podcast', nombre: 'Podcast audiovisual', icono: '🎧', detalle: 'Audio primero, cámaras de apoyo' },
  { id: 'publicidad', nombre: 'Publicidad', icono: '📢', detalle: 'Persuadir en poco tiempo' },
  { id: 'stopmotion', nombre: 'Stop motion', icono: '🧸', detalle: 'Animación cuadro por cuadro' },
  { id: 'experimental', nombre: 'Experimental', icono: '🌀', detalle: 'Pieza sensorial o no lineal' },
  { id: 'transmedia', nombre: 'Transmedia', icono: '🕸', detalle: 'La historia se expande entre plataformas' },
];

// Tipos donde la fórmula de premisa es de exploración (no-narrativa).
export const TIPOS_NO_NARRATIVOS = ['documental', 'experimental', 'transmedia', 'podcast', 'entrevista'];

export const IMPACTOS = ['Informar', 'Emocionar', 'Persuadir', 'Entretener', 'Denunciar', 'Enseñar', 'Generar reflexión', 'Promover una acción'];

export const EMOCIONES = ['Alegría', 'Tensión', 'Ternura', 'Miedo', 'Tristeza', 'Sorpresa', 'Indignación', 'Nostalgia', 'Esperanza', 'Curiosidad'];

// Estructuras narrativas. Cada beat: [título, función narrativa, plano
// recomendado para la primera toma, peso relativo de duración].
// El primer beat siempre establece (manual: el plano de establecimiento
// sitúa al espectador); los momentos de mayor carga emocional acercan la
// cámara (la emoción se registra en primer plano).
export const ESTRUCTURAS = {
  sencilla: {
    nombre: 'Estructura sencilla',
    detalle: 'Presente → cambio → futuro. Ideal para piezas cortas.',
    beats: [
      ['Presente', 'Muestra el mundo o la situación tal como es', 'Gran Plano General', 1],
      ['Cambio', 'Algo altera la situación y exige una reacción', 'Plano Medio', 1.4],
      ['Futuro', 'La nueva situación que resulta del cambio', 'Plano General', 1],
    ],
  },
  tresactos: {
    nombre: 'Tres actos',
    detalle: 'Planteamiento, confrontación y resolución, con detonante, crisis y clímax.',
    beats: [
      ['Planteamiento', 'Presenta al protagonista, su mundo y su deseo', 'Gran Plano General', 1],
      ['Detonante', 'El suceso que rompe el equilibrio', 'Plano Medio', 0.8],
      ['Confrontación', 'Obstáculos crecientes: el conflicto se agrava', 'Plano Americano', 1.6],
      ['Crisis', 'El punto más bajo o la decisión imposible', 'Primer Plano', 0.9],
      ['Clímax', 'El enfrentamiento decisivo', 'Primer Plano', 1],
      ['Resolución', 'La consecuencia y el nuevo equilibrio', 'Plano General', 0.8],
    ],
  },
  harmon: {
    nombre: 'Círculo de Dan Harmon',
    detalle: 'Ocho pasos: salir de la zona de confort, pagar un precio y volver cambiado.',
    beats: [
      ['Tú', 'El protagonista en su zona de confort', 'Plano General', 1],
      ['Necesidad', 'Algo no está bien: desea algo', 'Plano Medio', 0.8],
      ['Ir', 'Cruza el umbral hacia lo desconocido', 'Plano Entero', 0.8],
      ['Buscar', 'Se adapta, prueba y falla', 'Plano Americano', 1.4],
      ['Encontrar', 'Consigue lo que buscaba', 'Primer Plano', 0.9],
      ['Pagar', 'Paga un precio por conseguirlo', 'Primer Plano', 1],
      ['Regresar', 'Vuelve a su mundo habitual', 'Plano General', 0.7],
      ['Cambiar', 'Demuestra en acción que ha cambiado', 'Plano Medio', 0.9],
    ],
  },
  libre: {
    nombre: 'Estructura libre',
    detalle: 'Asociación, repetición, contraste, fragmentación o circularidad.',
    beats: [
      ['Apertura', 'Primera imagen o idea: establece el tono', 'Gran Plano General', 1],
      ['Desarrollo', 'Asociación, repetición o contraste de motivos', 'Plano Detalle', 1.3],
      ['Giro', 'Fragmentación, acumulación o paralelismo', 'Plano Medio', 1.1],
      ['Cierre', 'Circularidad: eco transformado de la apertura', 'Plano General', 0.9],
    ],
  },
};

// Logline a partir de la premisa asistida. Narrativa:
// "Esta es la historia de X, que quiere Y, pero se enfrenta a Z…"
// No narrativa: "Este proyecto explora X desde Y para Z."
export function loglineDe(narrativa) {
  const p = narrativa.premisa || {};
  if (TIPOS_NO_NARRATIVOS.includes(narrativa.tipo)) {
    if (!p.quien && !p.quiere) return '';
    return `Este proyecto explora ${p.quien || '[tema]'} desde ${p.quiere || '[punto de vista]'} para ${p.accion || 'comunicar'} ${p.obstaculo || '[idea central]'}.`;
  }
  if (!p.quien && !p.quiere) return '';
  let t = `Esta es la historia de ${p.quien || '[protagonista]'}, que quiere ${p.quiere || '[objetivo]'}, pero se enfrenta a ${p.obstaculo || '[obstáculo]'}`;
  if (p.accion) t += `, por lo que debe ${p.accion}`;
  if (p.limite) t += ` antes de ${p.limite}`;
  return t + '.';
}

// Genera los esqueletos de escena a partir de la estructura elegida.
// Devuelve escenas SIN ids ni fuentes (eso lo pone el generador): segmento,
// dur (reparto proporcional de la duración total), nota-guion con la función
// narrativa y los apuntes de imagen y sonido por escena (Chion), y una toma
// inicial con el plano recomendado por el beat.
export function escenasDe(narrativa, { durTotalSeg = 300 } = {}) {
  const est = ESTRUCTURAS[narrativa.estructura] || ESTRUCTURAS.sencilla;
  const protagonista = narrativa.personajes?.[0]?.nombre || '';
  const pesoTotal = est.beats.reduce((n, b) => n + b[3], 0);
  return est.beats.map(([titulo, funcion, plano, peso], i) => {
    const dur = Math.max(10, Math.round((durTotalSeg * peso) / pesoTotal / 5) * 5);
    const nota = [
      `[${funcion}]`,
      `Objetivo de la escena: … · Conflicto: … · ¿Qué cambia aquí?: …`,
      `Sonido — ambiente: … · música: empática / anempática / sin música · ¿qué se escucha que aún no se ve?: …`,
    ].join('\n');
    return {
      segmento: `${i + 1}. ${titulo}`,
      dur,
      nota,
      tomas: [{
        plano,
        mov: 'Fija',
        audio: i === 0 ? 'Ambiente del lugar (establece el espacio)' : 'Ambiente + diálogo',
        texto: protagonista && i === 0 ? `${funcion} — presentamos a ${protagonista}` : funcion,
        imagen: '',
      }],
    };
  });
}

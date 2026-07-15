// Lógica pura del Asistente de programa en vivo (modo live). Genera una
// ESCALETA EDITORIAL: qué contenido ocurre en cada bloque y su función dentro
// del programa (segmento, objetivo, participantes, recursos previstos). Las
// cámaras, cambios de señal y comandos técnicos NO van aquí — pertenecen al
// rundown técnico (las tomas/cues del guion técnico).

// Cada tipo trae una estructura de bloques con segmentos base. `dur` fija los
// segundos de un segmento de duración fija (cortinillas, cortes, salida); el
// resto reparten el tiempo objetivo por `peso`.
export const TIPOS_PROGRAMA = [
  {
    id: 'noticiero', nombre: 'Noticiero', icono: '📰',
    detalle: 'Bloques informativos, notas y cortes',
    bloques: [
      [
        { segmento: 'Cortinilla de entrada', objetivo: 'Identificar el programa e iniciar la emisión', participantes: '—', recursos: 'Cortinilla, música y logotipo', dur: 30 },
        { segmento: 'Bienvenida', objetivo: 'Saludar y presentar los temas principales', participantes: 'Conductores', recursos: 'Identificadores de conductores', peso: 3 },
        { segmento: 'Titulares', objetivo: 'Adelantar las noticias de la emisión', participantes: 'Conductores', recursos: 'Imágenes, cintillos y música', peso: 4 },
        { segmento: 'Nota principal', objetivo: 'Desarrollar la noticia más importante', participantes: 'Conductor y reportero', recursos: 'Nota pregrabada, fotografías y datos', peso: 8 },
        { segmento: 'Transición', objetivo: 'Cerrar el bloque y anunciar lo que sigue', participantes: 'Conductores', recursos: 'Cortinilla breve', dur: 60 },
      ],
      [
        { segmento: 'Entrevista', objetivo: 'Profundizar en un tema con un invitado', participantes: 'Conductores e invitado(a)', recursos: 'Nombre y cargo, preguntas guía', peso: 10 },
        { segmento: 'Agenda / cultura', objetivo: 'Presentar actividades de la semana', participantes: 'Conductor(a)', recursos: 'Fotografías, fechas y códigos QR', peso: 5 },
        { segmento: 'Corte', objetivo: 'Separar bloques y preparar la siguiente sección', participantes: '—', recursos: 'Cortinilla o comercial', dur: 30, esCorte: true },
      ],
      [
        { segmento: 'Deportes', objetivo: 'Informar resultados y próximos partidos', participantes: 'Conductor(a) deportivo', recursos: 'Tabla de resultados y fotografías', peso: 6 },
        { segmento: 'Recomendación', objetivo: 'Recomendar una película, libro o evento', participantes: 'Conductores', recursos: 'Portadas e imágenes', peso: 4 },
        { segmento: 'Despedida', objetivo: 'Recapitular y cerrar el programa', participantes: 'Conductores', recursos: 'Redes sociales y créditos', peso: 2 },
        { segmento: 'Salida', objetivo: 'Finalizar la emisión', participantes: '—', recursos: 'Créditos y música', dur: 30 },
      ],
    ],
  },
  {
    id: 'entrevista', nombre: 'Entrevista / Talk show', icono: '🎙',
    detalle: 'Conversación con invitados en estudio',
    bloques: [
      [
        { segmento: 'Cortinilla de entrada', objetivo: 'Identificar el programa', participantes: '—', recursos: 'Cortinilla y música', dur: 20 },
        { segmento: 'Bienvenida', objetivo: 'Presentar el tema y al invitado', participantes: 'Conductor(a)', recursos: 'Identificadores', peso: 3 },
        { segmento: 'Bloque de preguntas 1', objetivo: 'Explorar la primera línea de la conversación', participantes: 'Conductor(a) e invitado(a)', recursos: 'Nombre y cargo, preguntas guía', peso: 8 },
        { segmento: 'Corte', objetivo: 'Pausa y anuncio de lo que sigue', participantes: '—', recursos: 'Cortinilla o comercial', dur: 30, esCorte: true },
      ],
      [
        { segmento: 'Bloque de preguntas 2', objetivo: 'Profundizar y llevar la conversación al punto clave', participantes: 'Conductor(a) e invitado(a)', recursos: 'Gráficos de apoyo', peso: 9 },
        { segmento: 'Sección rápida', objetivo: 'Ronda ágil o preguntas del público', participantes: 'Conductor(a) e invitado(a)', recursos: 'Cintillos', peso: 4 },
        { segmento: 'Despedida', objetivo: 'Cerrar, agradecer y anunciar el próximo programa', participantes: 'Conductor(a)', recursos: 'Redes y créditos', dur: 40 },
      ],
    ],
  },
  {
    id: 'podcast', nombre: 'Podcast multicámara', icono: '🎧',
    detalle: 'Conversación continua con secciones',
    bloques: [
      [
        { segmento: 'Intro', objetivo: 'Presentar el episodio y a los participantes', participantes: 'Anfitriones', recursos: 'Música de intro, lower thirds', peso: 2 },
        { segmento: 'Tema del día', objetivo: 'Desarrollar la conversación principal', participantes: 'Anfitriones e invitado(a)', recursos: 'Notas, referencias en pantalla', peso: 10 },
        { segmento: 'Sección recurrente', objetivo: 'Dinámica fija del programa', participantes: 'Anfitriones', recursos: 'Gráficos de sección', peso: 5 },
        { segmento: 'Cierre y llamados', objetivo: 'Resumir y pedir suscripción/comentarios', participantes: 'Anfitriones', recursos: 'Redes, créditos', peso: 2 },
      ],
    ],
  },
  {
    id: 'revista', nombre: 'Revista / Magazine', icono: '📺',
    detalle: 'Varias secciones temáticas',
    bloques: [
      [
        { segmento: 'Cortinilla', objetivo: 'Abrir la emisión', participantes: '—', recursos: 'Cortinilla y música', dur: 20 },
        { segmento: 'Bienvenida y avances', objetivo: 'Presentar las secciones del programa', participantes: 'Conductores', recursos: 'Identificadores', peso: 3 },
        { segmento: 'Sección A', objetivo: 'Primer tema de la revista', participantes: 'Conductor(a) y colaborador(a)', recursos: 'VTR, fotografías', peso: 7 },
        { segmento: 'Corte', objetivo: 'Pausa comercial', participantes: '—', recursos: 'Comercial', dur: 30, esCorte: true },
      ],
      [
        { segmento: 'Sección B', objetivo: 'Segundo tema o entrevista', participantes: 'Conductor(a) e invitado(a)', recursos: 'Gráficos, VTR', peso: 7 },
        { segmento: 'Sección C', objetivo: 'Tema cultural o de servicio', participantes: 'Conductor(a)', recursos: 'Fotografías, datos', peso: 5 },
        { segmento: 'Despedida', objetivo: 'Cerrar y anunciar la próxima emisión', participantes: 'Conductores', recursos: 'Redes y créditos', dur: 40 },
      ],
    ],
  },
  {
    id: 'evento', nombre: 'Evento / Transmisión', icono: '🎪',
    detalle: 'Cobertura continua de un evento',
    bloques: [
      [
        { segmento: 'Pre-show', objetivo: 'Ambientar antes del inicio', participantes: 'Conductores', recursos: 'Música, pantallas', peso: 3 },
        { segmento: 'Apertura', objetivo: 'Dar inicio oficial al evento', participantes: 'Presentador(a)', recursos: 'Cortinilla, protocolo', peso: 2 },
        { segmento: 'Bloque principal', objetivo: 'Cubrir el desarrollo del evento', participantes: 'Talento del evento', recursos: 'Cámaras de cobertura, VTR', peso: 12 },
        { segmento: 'Intermedio', objetivo: 'Transición o número intermedio', participantes: 'Presentador(a)', recursos: 'Playback', peso: 3 },
        { segmento: 'Cierre', objetivo: 'Clausurar y agradecer', participantes: 'Presentador(a)', recursos: 'Créditos, música', peso: 2 },
      ],
    ],
  },
];

// Genera la escaleta editorial: reparte el tiempo objetivo (durTotalSeg) entre
// los segmentos según su peso; los de duración fija (cortinillas, cortes,
// salida) la conservan. Devuelve segmentos SIN ids ni fuentes (eso lo pone el
// generador), con bloque, objetivo, participantes y recursos.
export function escaletaEnVivoDe(tipoId, { durTotalSeg = 1800 } = {}) {
  const tipo = TIPOS_PROGRAMA.find((t) => t.id === tipoId) || TIPOS_PROGRAMA[0];
  const segs = [];
  tipo.bloques.forEach((bloque, bi) => bloque.forEach((s) => segs.push({ ...s, bloque: bi + 1 })));
  const fijo = segs.reduce((n, s) => n + (s.dur || 0), 0);
  const resto = Math.max(0, durTotalSeg - fijo);
  const pesoTotal = segs.reduce((n, s) => n + (s.dur ? 0 : (s.peso || 1)), 0) || 1;
  return segs.map((s) => ({
    segmento: s.segmento,
    bloque: s.bloque,
    objetivo: s.objetivo || '',
    participantes: s.participantes || '',
    recursos: s.recursos || '',
    dur: s.dur || Math.max(10, Math.round((resto * (s.peso || 1)) / pesoTotal / 5) * 5),
    esCorte: !!s.esCorte,
  }));
}

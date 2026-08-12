// Catálogo narrativo: el manual de diseño audiovisual convertido en datos.
// No dibuja nada; alimenta las sugerencias del editor.
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

/* ----------------------- Diseño visual por intención -----------------------
El manual pide elegir primero la intención y después la técnica: el usuario
dice QUÉ quiere mostrar y la app recomienda el plano; dice CÓMO debe
percibirse al sujeto y la app propone el ángulo explicando su efecto. */

export const ENCUADRES = [
  ['Mostrar contexto', 'Gran Plano General'],
  ['Mostrar acción', 'Plano General'],
  ['Mostrar relaciones entre personajes', 'Plano Conjunto'],
  ['Mostrar emoción', 'Primer Plano'],
  ['Mostrar un detalle importante', 'Plano Detalle'],
  ['Ocultar información', 'Over the Shoulder'],
  ['Crear desorientación', 'Plano Holandés'],
];

export const PERCEPCIONES = [
  ['Poderoso', 'Contrapicado', 'la cámara mira hacia arriba y el sujeto domina el cuadro'],
  ['Vulnerable', 'Picado', 'la cámara mira hacia abajo y el sujeto se empequeñece'],
  ['Neutral', 'A la altura de los ojos', 'sin carga: observamos de igual a igual'],
  ['Inestable', 'Ángulo holandés', 'el horizonte inclinado transmite desequilibrio'],
  ['Vigilado', 'Cenital / picado lejano', 'alguien observa desde arriba sin ser visto'],
  ['Dominante', 'Contrapicado cercano', 'invade el cuadro y se impone al espectador'],
  ['Aislado', 'Plano amplio con aire', 'el espacio vacío alrededor lo separa del mundo'],
];

export const MOVIMIENTOS_W = ['Cámara fija', 'Paneo', 'Tilt', 'Travelling', 'Seguimiento', 'Cámara en mano', 'Grúa', 'Dolly zoom', 'Plano secuencia'];

/* ------------------------ Diseño sonoro por escena ------------------------
Chion: el sonido se decide por escena. Voz, sonidos, música (empática o
anempática, dentro o fuera de la escena) y fuera de campo. */

export const VOCES = ['Diálogo', 'Voz en off', 'Narración', 'Entrevista', 'Texto leído', 'Voz interna', 'Sin voz'];

export const MUSICAS = [
  'Empática (acompaña la emoción)',
  'Anempática (contrasta o la ignora)',
  'Diegética (suena dentro de la escena)',
  'Extradiegética (acompaña desde fuera)',
  'Motivo de personaje',
  'Transición',
  'Sin música',
];

/* ----------------------------- Rama videoclip -----------------------------
La canción aporta la estructura temporal (análisis de Knives Out). */

export const MODALIDADES_CLIP = ['Performance', 'Narrativo', 'Conceptual', 'Coreográfico', 'Experimental', 'Híbrido'];
export const RELACION_MUSICA = ['Ilustrar la letra', 'Complementarla', 'Contradecirla', 'Historia independiente', 'Asociaciones visuales', 'Seguir ritmo y textura'];
export const PRESENCIAS_ARTISTA = ['Protagonista', 'Intérprete', 'Observador', 'Aparición parcial', 'Sin presencia', 'Alterna actuación e historia'];

export const planoPorEncuadre = (enc) => (ENCUADRES.find((e) => e[0] === enc) || [])[1] || 'Plano Medio';
export const anguloPorPercepcion = (p) => PERCEPCIONES.find((x) => x[0] === p) || null;

const fmtSeg = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// Validaciones inteligentes (spec §7 y §9): informan sin bloquear.
export function alertasDe(narrativa, ctx = {}) {
  const alertas = [];
  const escenas = narrativa.escenas || [];
  escenas.forEach((e, i) => {
    const num = `Escena ${i + 1}${e.titulo ? ` (${e.titulo})` : ''}`;
    if (!e.cambio) alertas.push(`${num}: no definiste qué cambia — puede ser descriptiva o prescindible.`);
    if (/noche|nocturn|madrugada/i.test(e.lugar || '')) alertas.push(`${num}: requiere grabación nocturna — planea iluminación y horario del llamado.`);
    if (['Travelling', 'Grúa', 'Dolly zoom', 'Seguimiento'].includes(e.mov)) alertas.push(`${num}: elegiste ${e.mov} — agrega soporte o estabilización a la lista de equipo.`);
    if (e.mov === 'Plano secuencia') alertas.push(`${num}: plano secuencia — considera ensayo, recorrido, foco y captura de sonido.`);
  });
  const hayVoz = escenas.some((e) => e.voz && e.voz !== 'Sin voz');
  if (hayVoz && ctx.hayAudioCrew === false) alertas.push('Hay diálogo o voz, pero no hay operador de audio en el personal de operación.');
  if (escenas.length && !escenas.some((e) => !e.encuadre || e.encuadre === 'Mostrar contexto')) {
    alertas.push('Ninguna escena establece el espacio: considera un plano de establecimiento al abrir.');
  }
  const durCancion = narrativa.cancion?.durSeg;
  if (narrativa.tipo === 'videoclip' && durCancion && narrativa.durMin) {
    const esc = narrativa.durMin * 60;
    if (Math.abs(esc - durCancion) > 15) alertas.push(`La canción dura ${fmtSeg(durCancion)}, pero la escaleta suma ${fmtSeg(esc)}.`);
  }
  return alertas;
}

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

// Genera los esqueletos de escena. Si narrativa.escenas trae fichas
// (constructor de escenas: lugar, cambio, emociones, diseño visual y
// sonoro), la escaleta y el guion técnico nacen de esas decisiones; si no,
// usa los beats de la estructura con sus recomendaciones por defecto.
// Devuelve escenas SIN ids ni fuentes (eso lo pone el generador).
export function escenasDe(narrativa, { durTotalSeg = 300 } = {}) {
  const est = ESTRUCTURAS[narrativa.estructura] || ESTRUCTURAS.sencilla;
  const beats = est.beats;
  const protagonista = narrativa.personajes?.[0]?.nombre || '';
  const fichas = narrativa.escenas?.length ? narrativa.escenas : beats.map(() => ({}));
  const pesoDe = (i) => (beats[i % beats.length] || [0, 0, 0, 1])[3] || 1;
  const pesoTotal = fichas.reduce((n, _, i) => n + pesoDe(i), 0);
  return fichas.map((f, i) => {
    const [beatTitulo, funcion, planoBeat] = beats[i % beats.length] || ['Escena', 'Desarrollo de la historia', 'Plano Medio'];
    const dur = f.dur || Math.max(10, Math.round((durTotalSeg * pesoDe(i)) / pesoTotal / 5) * 5);
    const plano = f.encuadre ? planoPorEncuadre(f.encuadre) : planoBeat;
    const ang = f.percepcion ? anguloPorPercepcion(f.percepcion) : null;
    const linea2 = [
      f.lugar && `Lugar: ${f.lugar}`,
      (f.emoIni || f.emoFin) && `Emoción: ${f.emoIni || '…'} → ${f.emoFin || '…'}`,
      `¿Qué cambia aquí?: ${f.cambio || '…'}`,
    ].filter(Boolean).join(' · ');
    const lineaImagen = `Imagen: ${f.encuadre ? `${f.encuadre} → ` : ''}${plano}${ang ? ` · ${f.percepcion} → ${ang[1]} (${ang[2]})` : ''}${f.mov ? ` · ${f.mov}` : ''}`;
    const lineaSonido = `Sonido — voz: ${f.voz || '…'} · sonidos: ${f.sonidos || '…'} · música: ${f.musica || 'empática / anempática / sin música'} · se escucha sin verse: ${f.fueraCampo || '…'}`;
    const personajes = (narrativa.personajes || []).map((p) => p.nombre).filter(Boolean).join(', ');
    return {
      segmento: `${i + 1}. ${f.titulo || beatTitulo}`,
      dur,
      // Campos propios de la escaleta NARRATIVA (columnas escena, no señal):
      // encabezado (INT/EXT · lugar · tiempo), acción, función, personajes,
      // cambio. Editables después; aquí se siembran desde las fichas.
      encabezado: f.lugar || '',
      accion: f.accion || '',
      funcion,
      personajes,
      cambio: f.cambio || '',
      nota: [`[${funcion}]`, linea2, lineaImagen, lineaSonido].join('\n'),
      tomas: [{
        plano: ang && ang[0] !== 'Neutral' ? `${plano} · ${ang[1]}` : plano,
        mov: f.mov && f.mov !== 'Cámara fija' ? f.mov : 'Fija',
        audio: [f.voz && f.voz !== 'Sin voz' ? f.voz : '', f.sonidos].filter(Boolean).join(' + ') || (i === 0 ? 'Ambiente del lugar (establece el espacio)' : 'Ambiente'),
        texto: protagonista && i === 0 ? `${funcion} — presentamos a ${protagonista}` : (f.cambio || funcion),
        imagen: '',
      }],
    };
  });
}

/* --------------------- Personajes = talentos del proyecto ---------------------
Quienes salen a cuadro se capturan UNA vez, como personajes del asistente.
Al generar, cada personaje con nombre se convierte en talento del proyecto
con micrófono de solapa asignado y entrada en el personal. El talento
genérico "Conductor(a)" de la plantilla se renombra con el primer personaje
en vez de duplicarse. Devuelve copias (no muta cfg). */
export function sincronizarPersonajes(cfg, personajes) {
  const gen = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const talentos = (cfg.talentos || []).map((t) => ({ ...t }));
  let microfonos = (cfg.microfonos || []).map((m) => ({ ...m }));
  let personal = (cfg.personal || []).map((r) => ({ ...r }));
  const usados = new Set(talentos.map((t) => (t.nombre || '').trim().toLowerCase()));

  (personajes || []).filter((p) => (p.nombre || '').trim()).forEach((p, i) => {
    const nombre = p.nombre.trim();
    if (usados.has(nombre.toLowerCase())) return;
    usados.add(nombre.toLowerCase());
    const tipo = i === 0 ? 'conductor' : 'invitado';
    const etiqueta = tipo === 'invitado' ? 'Invitado(a)' : 'Conductor(a)';

    const idx = talentos.findIndex((t) => (t.nombre || '').trim() === 'Conductor(a)');
    if (idx >= 0) {
      const t = talentos[idx];
      t.nombre = nombre;
      t.tipo = tipo;
      microfonos = microfonos.map((m) => (m.asignadoA === `tal:${t.id}` ? { ...m, nombre: `Mic · ${nombre}` } : m));
      let renombrado = false;
      personal = personal.map((r) => {
        if (!renombrado && r.rol === 'Conductor(a)') { renombrado = true; return { ...r, rol: `${nombre} · ${etiqueta}` }; }
        return r;
      });
      return;
    }

    const id = gen('tal');
    talentos.push({ id, nombre, tipo });
    microfonos.push({ id: gen('mic'), nombre: `Mic ${microfonos.length + 1} · ${nombre}`, conexion: 'Inalámbrico', micTipo: 'solapa', asignadoA: `tal:${id}` });
    personal.push({ id: gen('role'), rol: `${nombre} · ${etiqueta}`, icon: 'conductor' });
  });

  return { talentos, microfonos, personal };
}

// Construye el proyecto narrativo completo a partir de un cfg base (plantilla) y
// las respuestas del asistente `n`: escaleta con campos de escena + tomas,
// logline y personajes→talentos. Queda como materia prima para las sugerencias
// (el wizard y el asistente que lo usaban se retiraron en 2026-08-11).
export function construirProyectoNarrativo(cfg, n) {
  const gen = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const logline = loglineDe(n);
  const escenas = escenasDe(n, { durTotalSeg: Math.max(1, n.durMin || 5) * 60 });
  const cams = cfg.camaras || [];
  const escaleta = escenas.map((e, i) => ({
    id: gen('seg'), segmento: e.segmento, dur: e.dur, nota: e.nota,
    encabezado: e.encabezado, accion: e.accion, funcion: e.funcion, personajes: e.personajes, cambio: e.cambio,
    fuente: cams.length ? cams[i % cams.length].id : (cfg.extras?.[0]?.id || ''),
    tomas: e.tomas.map((t) => ({ id: gen('toma'), camId: cams[0]?.id || '', ...t })),
  }));
  const gente = sincronizarPersonajes(cfg, n.personajes);
  return { ...cfg, ...gente, narrativa: { ...n, logline }, escaleta };
}

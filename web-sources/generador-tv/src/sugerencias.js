// SUGERENCIAS: el asistente mira lo que estás preparando y te dice qué problema
// ve y cómo resolverlo. No son "tips del día": cada aviso nace de TUS datos.
//
// Reglas de la casa (spec del autor, 2026-08-11):
//   1. Se muestran solo cuando el usuario las pide (botón 💡). Nada de avisos
//      saltando solos mientras escribe.
//   2. Cada aviso tiene cuatro elementos: NIVEL, PROBLEMA, MOTIVO y ACCIÓN,
//      más un "explícame por qué" con el fundamento.
//   3. **Recomendar sin bloquear**: las guías de producción son ayudas, no
//      reglas absolutas. Si el usuario rompe una regla por intención creativa,
//      la app lo permite. Ninguna sugerencia modifica el proyecto por su cuenta.
//
// Son funciones PURAS: reciben el proyecto (cfg) y devuelven datos.

export const NIVELES = {
  error: { etiqueta: 'Error', orden: 0 },
  precaucion: { etiqueta: 'Precaución', orden: 1 },
  recomendacion: { etiqueta: 'Recomendación', orden: 2 },
};

/* --------------------- Lectura del proyecto --------------------- */

const sinAcentos = (t) => String(t || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const esNarrativo = (cfg) => cfg?.modo === 'narrative';
const segmentosDe = (cfg) => (cfg?.escaleta || []);
const fmtSeg = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} min` : `${Math.round(s)} s`);
const fmtMin = (s) => `${(s / 60).toFixed(s % 60 ? 1 : 0)} min`;

/* --------------------- Escala de lectura de los planos ---------------------
Cuánto tarda el ojo (y el cerebro) en registrar lo que hay dentro del cuadro.
1 = se lee de un vistazo (un detalle, un rostro) · 5 = necesita recorrerse
(un espacio entero con sus dimensiones y objetos). */
const ESCALA_LECTURA = [
  ['gran plano general', 5], ['plano general', 5],
  ['plano entero', 4], ['plano conjunto', 4], ['two shot', 4],
  ['plano americano', 3], ['over the shoulder', 3],
  ['plano medio izquierdo', 3], ['plano medio derecho', 3],
  ['plano medio corto', 2], ['plano medio', 3],
  ['primerísimo primer plano', 1], ['primerisimo primer plano', 1],
  ['primer plano', 2], ['plano detalle', 1], ['insert', 1],
];

// El campo "plano" es texto libre y suele traer el ángulo pegado
// ("Plano General · Picado"): se busca el nombre MÁS LARGO que aparezca, para
// que "plano medio corto" no se confunda con "plano medio".
export function escalaDePlano(texto) {
  const t = sinAcentos(texto);
  if (!t.trim()) return null;
  let mejor = null;
  for (const [nombre, escala] of ESCALA_LECTURA) {
    const n = sinAcentos(nombre);
    if (t.includes(n) && (!mejor || n.length > mejor.nombre.length)) mejor = { nombre: n, escala };
  }
  return mejor ? mejor.escala : null;
}

export const ES_ABIERTO = (escala) => escala >= 4;
export const ES_CERRADO = (escala) => escala <= 2;
export const ES_RECURSO = (escala) => escala === 1;

// Unidades con plano y duración: en vivo son los CUES; en narrativo, la escena
// con el plano de su primera toma (las tomas todavía no llevan duración propia).
export function unidadesConPlano(cfg) {
  const unidades = [];
  segmentosDe(cfg).forEach((seg, i) => {
    const cues = seg.cues || [];
    if (cues.length) {
      cues.forEach((c, j) => {
        if (!c.plano || !c.dur) return;
        unidades.push({
          ref: `${i + 1}.${j + 1}`, donde: 'cue', segmentoId: seg.id, id: c.id,
          titulo: c.texto || seg.segmento || `Cue ${i + 1}.${j + 1}`,
          plano: c.plano, dur: c.dur, escala: escalaDePlano(c.plano),
        });
      });
      return;
    }
    const toma = (seg.tomas || [])[0];
    if (!toma?.plano || !seg.dur) return;
    unidades.push({
      ref: String(i + 1), donde: 'escena', segmentoId: seg.id, id: seg.id,
      titulo: seg.segmento || `Escena ${i + 1}`,
      plano: toma.plano, dur: seg.dur, escala: escalaDePlano(toma.plano),
    });
  });
  return unidades.filter((u) => u.escala != null);
}

const aviso = (o) => ({ modulo: 'escaleta', ...o });

/* ============================ REGLAS DE IMAGEN ============================ */

// «Los primeros planos deben durar menos que un plano general: el ojo junto al
// cerebro tarda más en registrar las dimensiones y objetos del plano general.»
export function ritmoDePlanos(cfg) {
  const unidades = unidadesConPlano(cfg);
  const abiertos = unidades.filter((u) => ES_ABIERTO(u.escala));
  const cerrados = unidades.filter((u) => ES_CERRADO(u.escala));
  if (!abiertos.length || !cerrados.length) return [];
  const hallazgos = [];
  cerrados.forEach((c) => {
    const contra = abiertos.filter((a) => a.dur <= c.dur).sort((a, b) => a.dur - b.dur)[0];
    if (contra) hallazgos.push({ c, a: contra, exceso: c.dur - contra.dur });
  });
  return hallazgos.sort((x, y) => y.exceso - x.exceso).slice(0, 3).map(({ c, a }) => aviso({
    id: `ritmo-${c.id}`, regla: 'ritmo-planos', nivel: 'precaucion',
    problema: 'Un plano cerrado dura más que uno abierto',
    motivo: `${c.donde === 'cue' ? 'El cue' : 'La escena'} ${c.ref} («${c.titulo}») se resuelve en ${c.plano} y dura ${fmtSeg(c.dur)}, mientras que ${a.donde === 'cue' ? 'el cue' : 'la escena'} ${a.ref}, en ${a.plano}, dura ${fmtSeg(a.dur)}.`,
    accion: `Acorta ${c.ref} o alarga ${a.ref}, para que el plano abierto tenga más tiempo en pantalla.`,
    porque: 'El ojo, junto al cerebro, tarda más en registrar y percibir por completo las dimensiones y los objetos de un plano general que los de un primer plano. Por eso el plano cerrado debería durar menos que el abierto, no más.',
    refs: [c.ref, a.ref],
  }));
}

// «Tienes cinco planos cerrados consecutivos. Agrega un plano general para
// ubicar al espectador.»
export function planosCerradosSeguidos(cfg, minimo = 5) {
  const unidades = unidadesConPlano(cfg);
  const rachas = [];
  let racha = [];
  unidades.forEach((u) => {
    if (ES_CERRADO(u.escala)) racha.push(u);
    else { if (racha.length >= minimo) rachas.push(racha); racha = []; }
  });
  if (racha.length >= minimo) rachas.push(racha);
  return rachas.map((r) => aviso({
    id: `racha-${r[0].id}`, regla: 'planos-cerrados-seguidos', nivel: 'recomendacion',
    problema: `${r.length} planos cerrados seguidos`,
    motivo: `De ${r[0].ref} a ${r[r.length - 1].ref} todo se resuelve en planos cerrados, sin uno que muestre el espacio.`,
    accion: 'Agrega un plano general (o abre alguno de los que ya tienes) para volver a ubicar al espectador.',
    porque: 'Sin un plano abierto de referencia el espectador pierde dónde está cada quién y en qué lugar ocurre la acción; encadenar planos cerrados desorienta.',
    refs: [r[0].ref, r[r.length - 1].ref],
  }));
}

// «No aparece un plano de recurso. Graba manos, objetos, ambiente o reacciones
// para facilitar la edición.»
export function faltanPlanosRecurso(cfg) {
  const unidades = unidadesConPlano(cfg);
  if (unidades.length < 3 || unidades.some((u) => ES_RECURSO(u.escala))) return [];
  return [aviso({
    id: 'sin-recurso', regla: 'sin-planos-recurso', nivel: 'recomendacion',
    problema: 'No hay planos de recurso',
    motivo: `Ninguno de los ${unidades.length} planos escritos es un plano detalle o un insert.`,
    accion: 'Agrega planos de manos, objetos, ambiente o reacciones. Se graban rápido y salvan el montaje.',
    porque: 'Los planos de recurso permiten cortar sin saltos, tapar errores, comprimir el tiempo y dar respiro entre dos planos que no cortan bien. En edición se agradecen más que cualquier otra toma.',
  })];
}

/* ============================ REGLAS NARRATIVAS ============================ */

// «La escena no parece modificar la historia ni al personaje. Revisa cuál es su
// función narrativa.»
export function escenasSinCambio(cfg) {
  if (!esNarrativo(cfg)) return [];
  const sin = segmentosDe(cfg)
    .map((s, i) => ({ s, ref: i + 1 }))
    .filter(({ s }) => (s.segmento || s.accion) && !String(s.cambio || '').trim());
  return sin.slice(0, 3).map(({ s, ref }) => aviso({
    id: `sin-cambio-${s.id || ref}`, regla: 'escena-sin-cambio', nivel: 'precaucion',
    problema: 'La escena no dice qué cambia',
    motivo: `La escena ${ref} («${s.segmento || s.accion}») tiene vacío el campo "cambio".`,
    accion: 'Escribe qué es distinto al terminar la escena: qué sabe, quiere o pierde el personaje que no tenía antes.',
    porque: 'Si al final de una escena nada cambió para la historia o para el personaje, esa escena se puede cortar sin que se note. Definir el cambio es lo que le da función narrativa.',
    refs: [String(ref)],
  }));
}

// «Tu escena contiene diálogo, pero todavía no agregaste una fuente de audio.
// Considera usar micrófono de solapa o boom.»
export function dialogoSinAudio(cfg) {
  const conPersonajes = segmentosDe(cfg).filter((s) => String(s.personajes || '').trim());
  if (!conPersonajes.length || (cfg?.microfonos || []).length > 0) return [];
  return [aviso({
    id: 'dialogo-sin-audio', regla: 'dialogo-sin-audio', nivel: 'precaucion', modulo: 'set',
    problema: 'Hay diálogo pero no hay fuente de audio',
    motivo: `${conPersonajes.length} escena${conPersonajes.length === 1 ? '' : 's'} con personajes en cuadro y el proyecto no tiene ningún micrófono.`,
    accion: 'Agrega un micrófono de solapa por personaje, o un boom si se mueven (Editar → Talentos y micrófonos).',
    porque: 'El audio de la cámara casi nunca sirve para diálogo: capta el ambiente y la distancia arruina la inteligibilidad. La solapa resuelve al personaje fijo; el boom, al que se desplaza.',
  })];
}

// «Tu escena tiene música y diálogo. Planea cómo evitar que la música dificulte
// la comprensión de las voces.»
export function musicaSobreDialogo(cfg) {
  const choques = segmentosDe(cfg).map((s, i) => ({ s, ref: i + 1 })).filter(({ s }) => {
    const audio = sinAcentos((s.tomas || []).map((t) => t.audio).join(' '));
    const hayMusica = /musica|cancion|score|soundtrack/.test(audio);
    const hayVoz = /voz|dialogo|entrevista|locucion|narracion/.test(audio) || !!String(s.personajes || '').trim();
    return hayMusica && hayVoz;
  });
  if (!choques.length) return [];
  return [aviso({
    id: 'musica-dialogo', regla: 'musica-sobre-dialogo', nivel: 'recomendacion',
    problema: 'Música y voz al mismo tiempo',
    motivo: `${choques.length === 1 ? `La escena ${choques[0].ref} lleva` : `${choques.length} escenas (${choques.slice(0, 3).map((c) => c.ref).join(', ')}) llevan`} música y diálogo a la vez.`,
    accion: 'Decide desde ahora cómo se resuelve: bajar la música bajo la voz, elegir una pista sin letra, o dejarla sonar solo entre líneas.',
    porque: 'La música con letra o muy densa compite con la voz en el mismo rango de frecuencias; si no se planea el reparto, en edición se pierde la comprensión del diálogo.',
  })];
}

// «La escena cambia de interior a exterior. Considera tiempo adicional para
// traslado y adaptación de iluminación.»
export function saltosInteriorExterior(cfg) {
  if (!esNarrativo(cfg)) return [];
  const tipo = (s) => {
    const t = sinAcentos(s?.encabezado);
    if (/\bext\b|exterior/.test(t)) return 'ext';
    if (/\bint\b|interior/.test(t)) return 'int';
    return null;
  };
  const segs = segmentosDe(cfg);
  const saltos = [];
  for (let i = 1; i < segs.length; i += 1) {
    const a = tipo(segs[i - 1]); const b = tipo(segs[i]);
    if (a && b && a !== b) saltos.push({ ref: i + 1, de: a, titulo: segs[i].segmento });
  }
  if (!saltos.length) return [];
  return [aviso({
    id: 'int-ext', regla: 'salto-int-ext', nivel: 'recomendacion',
    problema: `${saltos.length} salto${saltos.length === 1 ? '' : 's'} entre interior y exterior`,
    motivo: `Entre escenas consecutivas se pasa de ${saltos[0].de === 'int' ? 'interior a exterior' : 'exterior a interior'} (escena ${saltos[0].ref}${saltos[0].titulo ? `, «${saltos[0].titulo}»` : ''}).`,
    accion: 'Agrupa por locación en el plan de rodaje y reserva tiempo de traslado y de reajuste de luz entre ambas.',
    porque: 'Cambiar de interior a exterior no es solo caminar: hay que mover equipo, y la temperatura de color y la exposición cambian por completo. Grabar en orden de guion multiplica esos cambios.',
  })];
}

/* ============================ REGLAS EN VIVO ============================ */

// «La escaleta tiene una duración de 30 minutos, pero los segmentos suman 33.
// Necesitas recortar tres minutos.»
export function duracionContraObjetivo(cfg) {
  const objetivoMin = cfg?.programa?.durMin;
  if (!objetivoMin) return [];
  const objetivo = objetivoMin * 60;
  const suma = segmentosDe(cfg).reduce((n, s) => n + (s.dur || 0), 0);
  if (!suma) return [];
  const dif = suma - objetivo;
  if (Math.abs(dif) < 30) return [];
  const sobra = dif > 0;
  return [aviso({
    id: 'duracion-objetivo', regla: 'duracion-objetivo', nivel: sobra ? 'error' : 'precaucion',
    problema: sobra ? `Te pasas ${fmtMin(dif)} de la duración del programa` : `Te faltan ${fmtMin(-dif)} para llenar el programa`,
    motivo: `El programa dura ${objetivoMin} min y los segmentos suman ${fmtMin(suma)}.`,
    accion: sobra
      ? `Recorta ${fmtMin(dif)} entre los bloques más largos, o marca uno como flexible para sacrificarlo al aire.`
      : `Agrega ${fmtMin(-dif)} de contenido o alarga los bloques que lo aguanten.`,
    porque: 'En vivo la duración no se negocia: la señal entra y sale a una hora fija. Lo que sobra se corta al aire, y lo que se corta improvisando siempre es lo peor resuelto.',
  })];
}

// «Las cámaras 1 y 2 tienen encuadres muy parecidos. Asigna funciones
// diferentes: general, medio o detalle.»
export function camarasConMismoEncuadre(cfg) {
  const cams = (cfg?.camaras || []).filter((c) => c.plano);
  if (cams.length < 2) return [];
  const porPlano = new Map();
  cams.forEach((c) => {
    const clave = sinAcentos(c.plano);
    porPlano.set(clave, [...(porPlano.get(clave) || []), c]);
  });
  return [...porPlano.values()].filter((g) => g.length > 1).map((g) => aviso({
    id: `camaras-${sinAcentos(g[0].plano).replace(/\s+/g, '-')}`, regla: 'camaras-mismo-encuadre',
    nivel: 'recomendacion', modulo: 'set',
    problema: `${g.length} cámaras con el mismo encuadre`,
    motivo: `${g.map((c) => c.nombre).join(' y ')} están asignadas al mismo plano (${g[0].plano}).`,
    accion: 'Dale a cada una una función distinta: una general que ubique, una media para el conductor y una de detalle o apoyo.',
    porque: 'Dos cámaras con el mismo encuadre no dan opciones al corte: al cambiar de una a otra el espectador ve un salto sin motivo. Repartir funciones es lo que hace útil el multicámara.',
  }));
}

// «No se ha definido quién autoriza los cambios de cámara. Asigna un realizador
// o responsable del switcher.»
export function sinResponsableDeCorte(cfg) {
  if (esNarrativo(cfg) || !(cfg?.camaras || []).length) return [];
  const roles = sinAcentos((cfg?.personal || []).map((p) => p.rol).join(' | '));
  if (/director de camaras|realizador|switcher/.test(roles)) return [];
  return [aviso({
    id: 'sin-realizador', regla: 'sin-responsable-corte', nivel: 'precaucion', modulo: 'personal',
    problema: 'Nadie autoriza los cambios de cámara',
    motivo: 'En el equipo no hay director de cámaras ni operador de switcher.',
    accion: 'Agrega el rol en Editar → Personal y define en la escaleta quién canta los cortes.',
    porque: 'En vivo alguien tiene que decidir y anunciar el corte en voz alta; si nadie tiene esa autoridad, las cámaras se pisan, el switcher duda y los cortes llegan tarde.',
  })];
}

// «Después de este video no hay una indicación clara para regresar al conductor.
// Agrega un cue de retorno.»
export function vtrSinRetorno(cfg) {
  const sueltos = [];
  segmentosDe(cfg).forEach((seg, i) => {
    const cues = seg.cues || [];
    cues.forEach((c, j) => {
      if (!['vtr', 'comercial'].includes(c.tipo)) return;
      const siguiente = cues[j + 1];
      if (!siguiente || !['camara', 'instruccion'].includes(siguiente.tipo)) {
        sueltos.push({ ref: `${i + 1}.${j + 1}`, texto: c.texto || (c.tipo === 'vtr' ? 'VTR' : 'Comercial') });
      }
    });
  });
  return sueltos.slice(0, 3).map((s) => aviso({
    id: `retorno-${s.ref}`, regla: 'vtr-sin-retorno', nivel: 'precaucion',
    problema: 'El video no tiene retorno',
    motivo: `Después del cue ${s.ref} («${s.texto}») no hay una cámara ni una instrucción que indique a dónde volver.`,
    accion: 'Agrega un cue de cámara justo después, con el conductor listo y la indicación de retorno.',
    porque: 'Al terminar un video la señal tiene que ir a algún lado. Sin retorno escrito, el switcher improvisa y se ve el hueco al aire.',
    refs: [s.ref],
  }));
}

/* ============================ Punto de entrada ============================ */

const REGLAS = [
  // Imagen (aplican en los dos modos)
  ritmoDePlanos, planosCerradosSeguidos, faltanPlanosRecurso, musicaSobreDialogo, dialogoSinAudio,
  // Narrativas
  escenasSinCambio, saltosInteriorExterior,
  // En vivo
  duracionContraObjetivo, camarasConMismoEncuadre, sinResponsableDeCorte, vtrSinRetorno,
];

export function revisar(cfg) {
  if (!cfg) return [];
  return REGLAS
    .flatMap((regla) => { try { return regla(cfg) || []; } catch (e) { return []; } })
    .sort((a, b) => NIVELES[a.nivel].orden - NIVELES[b.nivel].orden);
}

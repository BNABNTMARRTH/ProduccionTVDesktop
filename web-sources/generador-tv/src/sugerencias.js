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

import { objetivoSegDe, toleranciaDe } from './proyecto.js';
import { uid } from './util.js';

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
// Duraciones en palabras. Debajo del minuto se dicen en segundos: "0.8 min"
// no le dice nada a nadie, y desde que el objetivo admite piezas cortas ese
// caso es de todos los días.
const fmtMin = (s) => (s < 60 ? `${Math.round(s)} s` : `${(s / 60).toFixed(s % 60 ? 1 : 0)} min`);

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

/* --------------------- Correcciones automáticas ---------------------
Un aviso puede traer `arreglo`: una función PURA que recibe el proyecto y
devuelve el proyecto corregido. Solo se ofrece en lo MECÁNICO —agregar la pieza
que falta— nunca en lo creativo: qué recortar, cómo repartir los encuadres o
qué cambia en una escena lo decide el autor. Todo arreglo es deshacible con
⌘Z, porque pasa por el historial del generador. */
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
    arreglo: {
      etiqueta: 'Poner un micrófono de solapa a cada talento',
      aplicar: (cfg2) => {
        const talentos = cfg2.talentos || [];
        const nuevos = (talentos.length ? talentos : [{ id: '', nombre: 'Talento' }]).map((t, i) => ({
          id: uid(), nombre: `Mic ${i + 1}${t.nombre ? ` · ${t.nombre}` : ''}`,
          conexion: 'Inalámbrico', micTipo: 'solapa', asignadoA: t.id ? `tal:${t.id}` : '',
        }));
        return { ...cfg2, microfonos: [...(cfg2.microfonos || []), ...nuevos] };
      },
    },
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

/* ==================== REGLAS DE MEDIO Y PÚBLICO ====================
El mismo material no se corta igual para todos lados. Una pieza que va a un
feed vertical compite contra el pulgar de quien la ve: si no engancha, la
deslizan. Una que va a una sala tiene al público sentado y a oscuras, y ahí un
plano largo se sostiene. Estas reglas cruzan dos datos que el perfil ya pide
—DÓNDE se va a ver (medios) y A QUIÉN le hablas (receptor y edad)— y los
comparan con la duración objetivo y con el ritmo de la escaleta.

De dónde salen los números:
  · Los RANGOS DE DURACIÓN y el gancho de 3 segundos vienen de las fichas de
    fichas.js, que se generaron de los cuadernos del proyecto. Van citados en
    el "porque" de cada aviso.
  · Los UMBRALES que deciden cuándo vale la pena molestar al usuario son de la
    casa, no de ninguna fuente. Van marcados uno por uno.
Ninguna bloquea nada: si rompes la regla a propósito, la app te deja. */

const MEDIOS_RITMO = [
  // familia 'corto': se ve deslizando, en vertical, y compite contra el pulgar.
  { id: 'tiktok', re: /tiktok/i, nombre: 'TikTok', familia: 'corto',
    ideal: [15, 50], tope: 100, gancho: 3, ficha: 'la ficha de TikTok (cuaderno 4)' },
  { id: 'reel', re: /instagram|reels/i, nombre: 'Instagram / Reels', familia: 'corto',
    ideal: [15, 30], tope: 90, gancho: 3, ficha: 'la ficha de Reels (cuaderno 5)' },
  // familia 'largo': el público se sienta a verlo y aguanta que la pieza respire.
  { id: 'cine', re: /cine/i, nombre: 'Cine', familia: 'largo' },
  { id: 'tv', re: /tv abierta|tv de paga/i, nombre: 'TV', familia: 'largo' },
  { id: 'streaming', re: /streaming/i, nombre: 'Streaming', familia: 'largo' },
  { id: 'youtube', re: /youtube/i, nombre: 'YouTube', familia: 'largo' },
  { id: 'evento', re: /evento en vivo/i, nombre: 'Evento en vivo', familia: 'largo' },
];

const mediosDe = (cfg) => {
  const puestos = Array.isArray(cfg?.perfil?.medios) ? cfg.perfil.medios : [];
  return MEDIOS_RITMO.filter((m) => puestos.some((p) => m.re.test(String(p))));
};
const familia = (cfg, cual) => mediosDe(cfg).filter((m) => m.familia === cual);
const listar = (ms) => ms.map((m) => m.nombre).join(' y ');

/* A QUIÉN LE HABLAS. "edad" es texto libre ("18-25", "jóvenes", "de 40 en
   adelante"), así que se lee de dos formas: por los números que traiga y, si
   no trae, por las palabras. Se mira también "receptor", donde mucha gente
   escribe la edad sin darse cuenta. Si el rango cruza las dos orillas (18-60)
   o no se entiende nada, devuelve null y las reglas que dependen de esto se
   callan: más vale no opinar que opinar mal. */
const PALABRAS_JOVEN = /joven|jovenes|adolescen|teen|nin[oa]s?\b|infantil|universitari|preparatoria|secundaria|gen z|generacion z|estudiante|chav[oa]/;
const PALABRAS_MADURO = /adult[oa]|mayores|tercera edad|jubilad|profesionist|padres de familia|madres de familia|maduro|senior/;

export function publicoDe(cfg) {
  const texto = sinAcentos(`${cfg?.perfil?.edad || ''} ${cfg?.perfil?.receptor || ''}`);
  if (!texto.trim()) return null;
  const edades = (texto.match(/\d{1,3}/g) || []).map(Number).filter((n) => n >= 5 && n <= 99);
  if (edades.length) {
    if (Math.max(...edades) <= 30) return 'joven';
    if (Math.min(...edades) >= 35) return 'maduro';
    return null; // un rango que abarca a los dos: no hay nada que afinar
  }
  // "adulto joven" es joven, por eso se pregunta primero por joven.
  if (PALABRAS_JOVEN.test(texto)) return 'joven';
  if (PALABRAS_MADURO.test(texto)) return 'maduro';
  return null;
}

// «Tu objetivo son 3:00, pero esto va a TikTok: ahí la pieza vive entre 15 y
// 50 segundos y arriba de 1:40 la gente abandona antes de la mitad.»
export function duracionParaElMedio(cfg) {
  const objetivo = objetivoSegDe(cfg);
  const cortos = familia(cfg, 'corto');
  if (!objetivo || !cortos.length) return [];
  const publico = publicoDe(cfg);
  const avisos = [];
  cortos.forEach((m) => {
    // Con público joven se apunta a la mitad BAJA del rango documentado: es
    // quien más rápido desliza. (El corrimiento es de la casa; el rango no.)
    const techo = publico === 'joven' ? Math.round((m.ideal[0] + m.ideal[1]) / 2) : m.ideal[1];
    const aQuien = publico === 'joven' ? ', y más con público joven' : '';
    const rango = `entre ${m.ideal[0]} y ${m.ideal[1]} segundos`;
    if (objetivo > m.tope) {
      avisos.push(aviso({
        id: `dur-medio-${m.id}`, regla: 'duracion-medio', nivel: 'error', modulo: 'perfil',
        problema: `${fmtMin(objetivo)} es demasiado para ${m.nombre}`,
        motivo: `Pusiste ${fmtSeg(objetivo)} de duración objetivo y la pieza va a ${m.nombre}, donde arriba de ${m.tope} segundos el abandono empieza antes de la mitad del video.`,
        accion: `Baja el objetivo a ${rango}. Si el material no cabe, pártelo en dos piezas en vez de alargar una.`,
        porque: `Según ${m.ficha}, la brevedad es el factor que más pesa en que alguien llegue al final: los videos cortos se terminan de ver mucho más seguido. Pasar de ${m.tope} segundos es el error que la ficha señala por su nombre.`,
      }));
      return;
    }
    if (objetivo > techo) {
      avisos.push(aviso({
        id: `dur-medio-${m.id}`, regla: 'duracion-medio', nivel: 'precaucion', modulo: 'perfil',
        problema: `${fmtSeg(objetivo)} se pasa de lo que aguanta ${m.nombre}${aQuien}`,
        motivo: `En ${m.nombre} la pieza vive ${rango}${publico === 'joven' ? ', y con público joven conviene quedarse en la mitad baja' : ''}. Tu objetivo son ${fmtSeg(objetivo)}.`,
        accion: `Recorta hasta ${techo} segundos: quita lo que no mueva la historia y deja el remate donde está.`,
        porque: `El rango sale de ${m.ficha}. No es un capricho de la plataforma: es la duración a la que la gente termina de ver el video, que es lo que decide si se lo muestran a alguien más.`,
      }));
      return;
    }
    if (objetivo < m.ideal[0]) {
      avisos.push(aviso({
        id: `dur-medio-${m.id}`, regla: 'duracion-medio', nivel: 'recomendacion', modulo: 'perfil',
        problema: `${fmtSeg(objetivo)} se queda corto hasta para ${m.nombre}`,
        motivo: `En ${m.nombre} lo habitual es ${rango}, y tu objetivo son ${fmtSeg(objetivo)}.`,
        accion: `Date al menos ${m.ideal[0]} segundos: en menos no alcanza a haber un gancho, un desarrollo y un remate.`,
        porque: `El rango sale de ${m.ficha}. Debajo del piso la pieza se queda sin espacio para contar algo: se vuelve un destello, no un video.`,
      }));
    }
  });
  return avisos;
}

// «Tu primer segmento dura 12 s. En TikTok el gancho tiene que estar en los
// primeros 3, o deslizan.»
export function ganchoParaElMedio(cfg) {
  const cortos = familia(cfg, 'corto');
  if (!cortos.length) return [];
  const segs = segmentosDe(cfg).filter((s) => (s.dur || 0) > 0);
  if (!segs.length) return [];
  const primero = segs[0];
  const gancho = Math.min(...cortos.map((m) => m.gancho));
  // UMBRAL DE LA CASA: por debajo de 8 s el primer segmento todavía puede
  // traer el gancho adentro y no hay nada que reclamar.
  if (primero.dur < 8) return [];
  return [aviso({
    id: 'gancho-medio', regla: 'gancho-medio', nivel: 'precaucion', modulo: 'escaleta',
    problema: `El primer segmento dura ${fmtSeg(primero.dur)} y el gancho debe caber en ${gancho}`,
    motivo: `«${primero.segmento || 'El primer segmento'}» ocupa los primeros ${fmtSeg(primero.dur)} de una pieza para ${listar(cortos)}, donde la decisión de quedarse o deslizar se toma en los primeros ${gancho} segundos.`,
    accion: `Parte ese arranque: deja en los primeros ${gancho} segundos lo más fuerte que tengas —la imagen, la frase o el sonido que sorprende— y manda el resto a un segundo segmento.`,
    porque: `Las fichas de TikTok y de Reels coinciden en lo mismo: el gancho visual o auditivo va en los primeros 3 segundos, y desaprovechar el inicio es lo que hace que más de la mitad de la gente pase de largo.`,
    refs: [primero.segmento].filter(Boolean),
  })];
}

// «Vas a TikTok pero un solo segmento se lleva la mitad del video: ahí no hay
// montaje, hay una toma larga.»
export function cortesParaElMedio(cfg) {
  const cortos = familia(cfg, 'corto');
  if (!cortos.length) return [];
  const segs = segmentosDe(cfg).filter((s) => (s.dur || 0) > 0);
  const total = segs.reduce((a, s) => a + s.dur, 0);
  // Solo tiene sentido en piezas cortas: una escaleta de programa se mide en
  // bloques de minutos y esto no le aplica.
  if (!total || total > 180) return [];
  const publico = publicoDe(cfg);
  const avisos = [];

  // (a) Muy pocos cortes para el largo que lleva. UMBRAL DE LA CASA.
  if (total >= 20 && segs.length < 3) {
    avisos.push(aviso({
      id: 'cortes-pocos', regla: 'cortes-medio', nivel: 'recomendacion', modulo: 'escaleta',
      problema: `${fmtSeg(total)} en ${segs.length === 1 ? 'un solo segmento' : 'dos segmentos'} para ${listar(cortos)}`,
      motivo: `La pieza dura ${fmtSeg(total)} y solo cambia de imagen ${segs.length - 1 === 0 ? 'ninguna vez' : 'una vez'}. En ${listar(cortos)} eso se siente eterno.`,
      accion: 'Parte la escaleta en más segmentos cortos: cada corte es una razón para quedarse un segundo más.',
      porque: `La ficha de TikTok pide un montaje dinámico, de ritmo rápido, con transiciones sencillas y cortes limpios. No es estética: cada corte reinicia la atención de quien está deslizando.`,
    }));
  }

  // (b) Un segmento se come la pieza. UMBRAL DE LA CASA: 40% del total, y solo
  // con 3 o más segmentos (con dos, uno siempre pasa del 40% y no dice nada).
  if (segs.length >= 3) {
    const dominante = segs.find((s) => s.dur / total >= 0.4);
    if (dominante) {
      avisos.push(aviso({
        id: 'cortes-desbalance', regla: 'cortes-medio', nivel: 'precaucion', modulo: 'escaleta',
        problema: `Un segmento se lleva el ${Math.round(dominante.dur / total * 100)}% de la pieza`,
        motivo: `«${dominante.segmento || 'Un segmento'}» dura ${fmtSeg(dominante.dur)} de ${fmtSeg(total)} totales, en una pieza para ${listar(cortos)}${publico === 'joven' ? ' y con público joven' : ''}.`,
        accion: `Divide ese segmento en dos o tres, o recórtalo: en ${listar(cortos)} nadie se queda tanto tiempo viendo lo mismo.`,
        porque: `En un feed vertical el espectador puede irse en cualquier momento, y se va justo cuando la imagen deja de cambiar. Repartir el tiempo entre más segmentos no es adorno: es lo que sostiene la retención.`,
        refs: [dominante.segmento].filter(Boolean),
      }));
    }
  }
  return avisos;
}

// El otro lado de la moneda: cine, TV y streaming con público maduro aguantan
// —y piden— que la pieza respire.
export function respiroParaMedioLargo(cfg) {
  if (!esNarrativo(cfg)) return [];
  const largos = familia(cfg, 'largo');
  if (!largos.length || familia(cfg, 'corto').length) return [];
  if (publicoDe(cfg) !== 'maduro') return [];
  const segs = segmentosDe(cfg).filter((s) => (s.dur || 0) > 0);
  if (segs.length < 4) return [];
  const media = segs.reduce((a, s) => a + s.dur, 0) / segs.length;
  // UMBRAL DE LA CASA: por debajo de 5 s de promedio la pieza va a ritmo de
  // videoclip, que no es el ritmo de una sala ni de una pantalla de casa.
  if (media >= 5) return [];
  return [aviso({
    id: 'respiro-medio-largo', regla: 'ritmo-medio-largo', nivel: 'recomendacion', modulo: 'escaleta',
    problema: `Tus escenas promedian ${fmtSeg(media)} y esto va a ${listar(largos)}`,
    motivo: `Las ${segs.length} escenas duran ${fmtSeg(media)} en promedio. Con público maduro y en ${listar(largos)}, el espectador está sentado y dispuesto a mirar: ese ritmo lo apura sin necesidad.`,
    accion: 'Deja respirar las escenas que cargan la historia y guarda los cortes rápidos para los momentos de tensión, donde sí trabajan.',
    porque: 'Un plano abierto necesita más tiempo en pantalla que uno cerrado: el ojo tarda en recorrer un espacio entero con sus objetos. En un feed no hay ese tiempo, pero en una sala o una pantalla de casa sí, y desperdiciarlo es tirar la parte del trabajo que se ve.',
  })];
}

// «Estás mandando la misma pieza a TikTok y a cine con una sola duración.»
export function mediosQueNoCasan(cfg) {
  const cortos = familia(cfg, 'corto');
  const largos = familia(cfg, 'largo');
  if (!cortos.length || !largos.length) return [];
  const objetivo = objetivoSegDe(cfg);
  return [aviso({
    id: 'medios-no-casan', regla: 'medios-no-casan', nivel: 'recomendacion', modulo: 'perfil',
    problema: `${listar(cortos)} y ${listar(largos)} no piden la misma pieza`,
    motivo: `Marcaste ${listar(cortos)} —donde se ve deslizando, en vertical y por segundos— junto a ${listar(largos)}, donde el público se sienta a verlo${objetivo ? `. Y hay una sola duración objetivo: ${fmtSeg(objetivo)}` : ''}.`,
    accion: `Decide cuál manda y haz ese corte primero; del largo sale el corto, nunca al revés. Después arma la versión ${cortos[0].nombre} recortando, no alargando.`,
    porque: 'La duración y el ritmo no son un ajuste al final: cambian qué se filma y cómo. Una pieza pensada para las dos a la vez acaba siendo larga para el feed y apurada para la pantalla grande.',
  })];
}

/* ============================ REGLAS EN VIVO ============================ */

// «La escaleta tiene una duración de 30 minutos, pero los segmentos suman 33.
// Necesitas recortar tres minutos.»
export function duracionContraObjetivo(cfg) {
  const objetivo = objetivoSegDe(cfg);
  if (!objetivo) return [];
  const suma = segmentosDe(cfg).reduce((n, s) => n + (s.dur || 0), 0);
  if (!suma) return [];
  const dif = suma - objetivo;
  if (Math.abs(dif) < toleranciaDe(objetivo)) return [];
  const sobra = dif > 0;
  return [aviso({
    id: 'duracion-objetivo', regla: 'duracion-objetivo', nivel: sobra ? 'error' : 'precaucion',
    problema: sobra ? `Te pasas ${fmtMin(dif)} de la duración del programa` : `Te faltan ${fmtMin(-dif)} para llenar el programa`,
    motivo: `El programa dura ${fmtMin(objetivo)} y los segmentos suman ${fmtMin(suma)}.`,
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
    arreglo: {
      etiqueta: 'Agregar “Director de cámaras” al equipo',
      aplicar: (cfg2) => ({
        ...cfg2,
        personal: [...(cfg2.personal || []), { id: uid(), rol: 'Director de cámaras', icon: 'director' }],
      }),
    },
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
        sueltos.push({ ref: `${i + 1}.${j + 1}`, texto: c.texto || (c.tipo === 'vtr' ? 'VTR' : 'Comercial'), segId: seg.id, pos: j });
      }
    });
  });
  return sueltos.slice(0, 3).map((s) => aviso({
    id: `retorno-${s.ref}`, regla: 'vtr-sin-retorno', nivel: 'precaucion',
    arreglo: {
      etiqueta: 'Agregar el cue de retorno',
      aplicar: (cfg2) => ({
        ...cfg2,
        escaleta: (cfg2.escaleta || []).map((seg) => (seg.id !== s.segId ? seg : {
          ...seg,
          cues: [
            ...(seg.cues || []).slice(0, s.pos + 1),
            {
              id: uid(), tipo: 'camara', dur: 10, transicion: 'Corte',
              alAire: (cfg2.camaras || [])[0]?.id || '', previo: (cfg2.camaras || [])[1]?.id || '',
              audio: '', grafico: '', plano: '', estado: 'borrador',
              texto: 'Retorno a conductor',
            },
            ...(seg.cues || []).slice(s.pos + 1),
          ],
        })),
      }),
    },
    problema: 'El video no tiene retorno',
    motivo: `Después del cue ${s.ref} («${s.texto}») no hay una cámara ni una instrucción que indique a dónde volver.`,
    accion: 'Agrega un cue de cámara justo después, con el conductor listo y la indicación de retorno.',
    porque: 'Al terminar un video la señal tiene que ir a algún lado. Sin retorno escrito, el switcher improvisa y se ve el hueco al aire.',
    refs: [s.ref],
  }));
}

/* ============================ REGLAS DE RITMO ============================
Estas tres miran la DURACIÓN de los segmentos como serie, no uno por uno. El
fundamento viene del cuaderno «2. Guion y narrativa» (NotebookLM, ago-2026), en
particular del análisis cuantitativo de guiones de Murtagh, Ganz y McKie («The
structure of narrative: the case of film scripts», arXiv:0805.3799), que mide el
tempo con la variación de la longitud de las escenas. */

// Palabras que se leen por segundo en locución natural (unas 150 por minuto).
const PALABRAS_POR_SEGUNDO = 2.5;

const palabrasDe = (t) => String(t || '').trim().split(/\s+/)
  .filter((p) => /[\p{L}\p{N}]/u.test(p)).length;

// Desviación estándar relativa: cuánto varían las duraciones entre sí,
// independientemente de si el programa es corto o largo. 0 = todas iguales.
function dispersionDeDuraciones(durs) {
  const n = durs.filter((d) => d > 0);
  if (n.length < 2) return 0;
  const media = n.reduce((a, b) => a + b, 0) / n.length;
  if (!media) return 0;
  return Math.sqrt(n.reduce((a, b) => a + (b - media) ** 2, 0) / n.length) / media;
}

// «Todas tus escenas duran casi lo mismo: el ritmo queda plano.»
export function ritmoPlano(cfg) {
  const durs = segmentosDe(cfg).map((s) => s.dur || 0).filter((d) => d > 0);
  if (durs.length < 4) return [];
  const disp = dispersionDeDuraciones(durs);
  if (disp >= 0.25) return [];
  return [aviso({
    id: 'ritmo-plano', regla: 'ritmo-plano', nivel: 'recomendacion',
    problema: 'Todas las escenas duran casi lo mismo',
    motivo: `Los ${durs.length} segmentos rondan los ${fmtSeg(durs.reduce((a, b) => a + b, 0) / durs.length)} cada uno, con muy poca diferencia entre ellos.`,
    accion: 'Alterna duraciones: deja respirar las escenas que lo necesitan y recorta las de trámite.',
    porque: 'El ritmo se percibe por contraste, no por velocidad. Cuando todas las escenas miden igual el espectador deja de notar dónde está lo importante, y la pieza se siente monótona aunque cada escena por separado esté bien.',
  })];
}

// «El final va más lento que el principio.»
export function finalSinAcelerar(cfg) {
  const durs = segmentosDe(cfg).map((s) => s.dur || 0).filter((d) => d > 0);
  if (durs.length < 6) return [];
  const corte = Math.floor(durs.length / 3);
  const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const inicio = media(durs.slice(0, corte));
  const final = media(durs.slice(-corte));
  if (!inicio || final / inicio <= 1.5) return [];
  return [aviso({
    id: 'final-lento', regla: 'final-sin-acelerar', nivel: 'recomendacion',
    problema: 'El final va más lento que el principio',
    motivo: `Las últimas escenas promedian ${fmtSeg(final)} y las primeras ${fmtSeg(inicio)}.`,
    accion: 'Acorta las escenas del tramo final, o mueve al principio lo que solo explica.',
    porque: 'Al acercarse el cierre las escenas suelen acortarse: los cortes más seguidos acumulan tensión. Si el final es la parte más lenta, el remate llega desinflado.',
  })];
}

// «El texto que escribiste no cabe en el tiempo que le diste al segmento.»
export function textoNoCabeEnTiempo(cfg) {
  const largos = segmentosDe(cfg)
    .map((s, i) => ({ s, ref: i + 1, pal: palabrasDe(s.nota), dur: s.dur || 0 }))
    .filter(({ pal, dur }) => dur > 0 && pal > 0 && pal > dur * PALABRAS_POR_SEGUNDO * 1.15);
  return largos.slice(0, 3).map(({ s, ref, pal, dur }) => aviso({
    id: `texto-largo-${s.id || ref}`, regla: 'texto-no-cabe', nivel: 'precaucion',
    problema: 'El texto no cabe en el tiempo del segmento',
    motivo: `El segmento ${ref} («${s.segmento || 'sin título'}») dura ${fmtSeg(dur)}, pero sus ${pal} palabras necesitan cerca de ${fmtSeg(Math.ceil(pal / PALABRAS_POR_SEGUNDO))} para leerse a ritmo normal.`,
    accion: `Recorta el texto o dale al segmento unos ${fmtSeg(Math.ceil(pal / PALABRAS_POR_SEGUNDO) - dur)} más.`,
    porque: 'A ritmo natural se leen unas 150 palabras por minuto. Si el texto excede el tiempo, en grabación se resuelve acelerando la locución, y eso se nota: el presentador suena atropellado y el público deja de entender.',
    refs: [String(ref)],
  }));
}

/* ============================ Punto de entrada ============================ */

const REGLAS = [
  // Imagen (aplican en los dos modos)
  ritmoDePlanos, planosCerradosSeguidos, faltanPlanosRecurso, musicaSobreDialogo, dialogoSinAudio,
  // Narrativas
  escenasSinCambio, saltosInteriorExterior,
  // Ritmo de la escaleta (duración como serie)
  ritmoPlano, finalSinAcelerar, textoNoCabeEnTiempo,
  // En vivo
  duracionContraObjetivo, camarasConMismoEncuadre, sinResponsableDeCorte, vtrSinRetorno,
  // Medio y público: dónde se va a ver y a quién le hablas
  duracionParaElMedio, ganchoParaElMedio, cortesParaElMedio, respiroParaMedioLargo, mediosQueNoCasan,
];

export function revisar(cfg) {
  if (!cfg) return [];
  return REGLAS
    .flatMap((regla) => { try { return regla(cfg) || []; } catch (e) { return []; } })
    .sort((a, b) => NIVELES[a.nivel].orden - NIVELES[b.nivel].orden);
}

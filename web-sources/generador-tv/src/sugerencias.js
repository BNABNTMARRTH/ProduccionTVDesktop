// SUGERENCIAS: revisan el proyecto y devuelven observaciones, nunca cambios.
//
// Reglas de la casa (2026-08-11):
//   1. Solo se muestran cuando el usuario las pide (botón). Nada de avisos
//      saltando solos mientras escribe.
//   2. Cada sugerencia explica el PORQUÉ con el criterio del autor, no con una
//      norma anónima: el alumno tiene que aprender el fundamento, no obedecer.
//   3. Ninguna sugerencia modifica el proyecto por su cuenta.
//
// Son funciones PURAS: reciben el proyecto (cfg) y devuelven datos.

/* --------------------- Escala de lectura de los planos ---------------------
Cuánto tarda el ojo (y el cerebro) en registrar lo que hay dentro del cuadro.
1 = se lee de un vistazo (un detalle, un rostro) · 5 = necesita recorrerse
(un espacio entero con sus dimensiones y objetos). El orden viene del criterio
del autor: cuanto más abierto el plano, más tiempo necesita en pantalla. */
const ESCALA_LECTURA = [
  ['gran plano general', 5],
  ['plano general', 5],
  ['plano entero', 4],
  ['plano conjunto', 4],
  ['two shot', 4],
  ['plano americano', 3],
  ['over the shoulder', 3],
  ['plano medio izquierdo', 3],
  ['plano medio derecho', 3],
  ['plano medio corto', 2],
  ['plano medio', 3],
  ['primerísimo primer plano', 1],
  ['primerisimo primer plano', 1],
  ['primer plano', 2],
  ['plano detalle', 1],
  ['insert', 1],
];

const sinAcentos = (t) => String(t || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// El campo "plano" es texto libre (viene de una lista sugerida, pero se puede
// escribir a mano y suele traer el ángulo pegado: "Plano General · Picado").
// Se busca el nombre de plano MÁS LARGO que aparezca dentro del texto, para que
// "plano medio corto" no se confunda con "plano medio".
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

/* --------------------- Unidades de tiempo del proyecto ---------------------
En vivo cada CUE tiene su plano y su duración. En narrativo la duración vive en
la ESCENA y el plano en su toma; se toma la primera toma como el plano con el
que está resuelta la escena. */
export function unidadesConPlano(cfg) {
  const unidades = [];
  (cfg?.escaleta || []).forEach((seg, i) => {
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

/* --------------------- Regla: ritmo según el tamaño del plano ---------------------
Criterio del autor: «Los primeros planos deben tener menor duración que un plano
general, porque el ojo junto al cerebro tarda más en registrar y percibir por
completo las dimensiones y objetos dentro del plano general».
Se marca lo que está AL REVÉS: un plano cerrado que dura igual o más que uno
abierto del mismo proyecto. */
export function ritmoDePlanos(cfg) {
  const unidades = unidadesConPlano(cfg);
  const abiertos = unidades.filter((u) => ES_ABIERTO(u.escala));
  const cerrados = unidades.filter((u) => ES_CERRADO(u.escala));
  if (!abiertos.length || !cerrados.length) return [];

  const hallazgos = [];
  cerrados.forEach((c) => {
    // El plano abierto más corto que este cerrado iguala o supera: ese es el
    // contraste más claro para explicarlo.
    const contra = abiertos
      .filter((a) => a.dur <= c.dur)
      .sort((a, b) => a.dur - b.dur)[0];
    if (contra) hallazgos.push({ cerrado: c, abierto: contra, exceso: c.dur - contra.dur });
  });

  return hallazgos
    .sort((a, b) => b.exceso - a.exceso)
    .slice(0, 3)
    .map(({ cerrado, abierto }) => ({
      id: `ritmo-${cerrado.id}`,
      regla: 'ritmo-planos',
      titulo: 'Un plano cerrado dura más que uno abierto',
      mensaje: `${cerrado.donde === 'cue' ? 'El cue' : 'La escena'} ${cerrado.ref} («${cerrado.titulo}») se resuelve en ${cerrado.plano} y dura ${fmtSeg(cerrado.dur)}, mientras que ${abierto.donde === 'cue' ? 'el cue' : 'la escena'} ${abierto.ref}, en ${abierto.plano}, dura ${fmtSeg(abierto.dur)}.`,
      porque: 'El ojo, junto al cerebro, tarda más en registrar y percibir por completo las dimensiones y los objetos de un plano general que los de un primer plano. Por eso el plano cerrado debería durar menos que el abierto, no más.',
      donde: cerrado.donde,
      refs: [cerrado.ref, abierto.ref],
      segmentoId: cerrado.segmentoId,
    }));
}

const fmtSeg = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s} s`);

// Punto de entrada: todas las reglas, en orden de aparición en el proyecto.
export function revisar(cfg) {
  return [...ritmoDePlanos(cfg)];
}

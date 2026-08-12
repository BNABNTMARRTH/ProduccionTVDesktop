// Pruebas de la lógica pura del frontend (sin navegador ni framework):
//   node --test tests/frontend.test.mjs
// (con la ruta explícita: `node --test tests/` no descubre archivos .mjs
// en las versiones recientes de Node)
// Cubre plantillas/migración de datos y el catálogo de iluminación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTemplate, infografiaFromDiagram, templateDefaults, SCHEMA_VERSION, normalizeMode } from '../frontend/src/templates.js';
import {
  LUZ_CATALOGO, SETUPS_ILUMINACION, SETUPS_EXTERIOR, RECOMENDADAS_POR_PLANTILLA,
  getSetup, instanciarSetup, instanciarElemento, posicionesParaLuces,
} from '../web-sources/generador-tv/src/iluminacion.js';
import { ESTRUCTURAS, loglineDe, escenasDe, alertasDe, planoPorEncuadre, anguloPorPercepcion, sincronizarPersonajes, construirProyectoNarrativo } from '../web-sources/generador-tv/src/narrativa.js';
import { revisar, escalaDePlano, NIVELES } from '../web-sources/generador-tv/src/sugerencias.js';
import { objetivoDe } from '../web-sources/generador-tv/src/proyecto.js';
import { escaletaEnVivoDe, TIPOS_PROGRAMA, construirEscaletaEnVivo } from '../web-sources/generador-tv/src/envivo.js';

test('makeTemplate produce el esquema v3 con sets, talentos y mics asignados', () => {
  const cfg = makeTemplate('entrevista', {
    projectName: 'Prueba',
    location: 'mixta',
    talents: [{ name: 'Ana', tipo: 'conductor' }, { name: 'Luis', tipo: 'invitado' }],
  });
  assert.equal(cfg.schema, SCHEMA_VERSION);
  assert.equal(cfg.plantilla, 'entrevista');
  // mixta = set de estudio + locación exterior
  assert.equal(cfg.sets.length, 2);
  assert.equal(cfg.sets[0].locacion, 'int');
  assert.equal(cfg.sets[1].locacion, 'ext');
  assert.equal(cfg.setActivo, cfg.sets[0].id);
  // talentos propios, un mic de solapa asignado a cada uno
  assert.equal(cfg.talentos.length, 2);
  const solapas = cfg.microfonos.filter((m) => m.micTipo === 'solapa');
  assert.equal(solapas.length, 2);
  solapas.forEach((m, i) => assert.equal(m.asignadoA, `tal:${cfg.talentos[i].id}`));
  // sugerencias del asistente listas para que el generador las aplique
  assert.equal(cfg.iluminacionSugerida, 'three_point_lighting');
  assert.deepEqual(cfg.mueblesSugeridos, ['sillon1', 'sillon2']);
});

test('el modo por defecto es "live" y solo "narrative" se conserva (migración)', () => {
  assert.equal(normalizeMode(undefined), 'live', 'proyecto viejo sin modo → live');
  assert.equal(normalizeMode('live'), 'live');
  assert.equal(normalizeMode('narrative'), 'narrative');
  assert.equal(normalizeMode('cualquier-cosa'), 'live', 'valor inválido → live');
});

test('makeTemplate estampa el modo; en narrativo siembra el tipo del asistente', () => {
  const vivo = makeTemplate('noticiero', {});
  assert.equal(vivo.modo, 'live', 'sin modo explícito, un programa es en vivo');
  assert.equal(vivo.narrativa, undefined, 'el modo vivo no siembra narrativa');
  const narr = makeTemplate('vacio', { modo: 'narrative', narrativeTipo: 'videoclip' });
  assert.equal(narr.modo, 'narrative');
  assert.equal(narr.narrativa.tipo, 'videoclip', 'el tipo elegido llega al Asistente narrativo');
});

test('makeTemplate en exterior marca el set sin mesa y mics inalámbricos', () => {
  const cfg = makeTemplate('streaming', { location: 'ext' });
  assert.equal(cfg.sets.length, 1);
  assert.equal(cfg.sets[0].locacion, 'ext');
  assert.equal(cfg.sets[0].mesaVisible, false);
  cfg.microfonos.forEach((m) => assert.equal(m.conexion, 'Inalámbrico'));
});

test('templateDefaults conserva los números de la plantilla', () => {
  assert.deepEqual(templateDefaults('noticiero'), { cams: 3, mics: 2 });
});

test('infografiaFromDiagram preserva micTipo y asignadoA al sincronizar', () => {
  const cfg = {
    camaras: [{ id: 'c1', nombre: 'CAM 1', plano: 'PG', color: '#111111' }],
    microfonos: [{ id: 'm1', nombre: 'Boom', conexion: 'XLR', micTipo: 'boom', asignadoA: 'set' }],
    extras: [],
  };
  const diagram = {
    nodes: [
      { id: 'n1', type: 'camara', label: 'CAM 1', syncKey: 'cam:c1', props: {} },
      { id: 'n2', type: 'microfono', label: 'Boom renombrado', syncKey: 'mic:m1', props: { conexion: 'XLR' } },
    ],
    edges: [],
  };
  const out = infografiaFromDiagram(diagram, cfg);
  assert.equal(out.microfonos[0].micTipo, 'boom');
  assert.equal(out.microfonos[0].asignadoA, 'set');
  assert.equal(out.microfonos[0].nombre, 'Boom renombrado');
});

test('todos los elementos de todos los setups existen en el catálogo', () => {
  SETUPS_ILUMINACION.forEach((s) => {
    [...(s.required_elements || []), ...(s.optional_elements || [])].forEach((tipo) => {
      assert.ok(LUZ_CATALOGO[tipo], `${s.id}: elemento desconocido "${tipo}"`);
    });
  });
  SETUPS_EXTERIOR.forEach((id) => assert.ok(getSetup(id), `setup exterior faltante: ${id}`));
  Object.values(RECOMENDADAS_POR_PLANTILLA).flat().forEach((id) => assert.ok(getSetup(id), `recomendada faltante: ${id}`));
});

test('instanciarSetup coloca los requeridos con posición e ids únicos', () => {
  const { luces, pos } = instanciarSetup(getSetup('three_point_lighting'), { x: 490, y: 240 });
  assert.equal(luces.length, 3);
  assert.equal(new Set(luces.map((l) => l.id)).size, 3);
  luces.forEach((l) => {
    const p = pos[`luz:${l.id}`];
    assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.y), `sin posición para ${l.tipo}`);
    assert.ok(l.nombre && l.abrev && l.forma && l.color, `instancia incompleta de ${l.tipo}`);
  });
});

test('los elementos count 2 generan dos instancias espejadas', () => {
  const { luces, pos } = instanciarElemento('back_lights', { x: 490, y: 240 });
  assert.equal(luces.length, 2);
  const [a, b] = luces.map((l) => pos[`luz:${l.id}`]);
  assert.notEqual(a.x, b.x);
  assert.equal(a.y, b.y);
});

test('posicionesParaLuces (Reacomodar) no apila luces en el centro', () => {
  const { luces } = instanciarSetup(getSetup('four_point_lighting'), { x: 490, y: 240 });
  // dos luces extra del mismo tipo para probar el escalonado
  const extra = instanciarElemento('practical_light', { x: 490, y: 240 }, { opcional: true });
  const extra2 = instanciarElemento('practical_light', { x: 490, y: 240 }, { opcional: true });
  const todas = [...luces, ...extra.luces, ...extra2.luces];
  const pos = posicionesParaLuces(todas);
  const puntos = todas.map((l) => pos[`luz:${l.id}`]);
  puntos.forEach((p) => assert.ok(p, 'toda luz recibe posición'));
  // sin duplicados exactos (el default roto era: todas en 490,320)
  const unicos = new Set(puntos.map((p) => `${p.x},${p.y}`));
  assert.equal(unicos.size, puntos.length);
});

test('escenasDe reparte la duración objetivo entre los beats de la estructura', () => {
  const esc = escenasDe({ estructura: 'harmon', personajes: [{ nombre: 'Ana' }] }, { durTotalSeg: 480 });
  assert.equal(esc.length, 8);
  const total = esc.reduce((n, e) => n + e.dur, 0);
  assert.ok(Math.abs(total - 480) <= 8 * 5, `total ${total} lejos de 480`);
  esc.forEach((e) => {
    assert.ok(e.dur >= 10);
    assert.equal(e.tomas.length, 1);
    assert.ok(e.tomas[0].plano, 'toda toma nace con plano recomendado');
    assert.match(e.nota, /Sonido/, 'el guion incluye apuntes de sonido por escena');
  });
  assert.equal(esc[0].segmento, '1. Tú');
  assert.match(esc[0].tomas[0].texto, /Ana/, 'la primera escena presenta al protagonista');
});

test('loglineDe usa la fórmula narrativa o la de exploración según el tipo', () => {
  const narr = loglineDe({ tipo: 'ficcion', premisa: { quien: 'Leo', quiere: 'ganar el concurso', obstaculo: 'su miedo escénico', accion: 'presentarse en vivo', limite: 'la final' } });
  assert.match(narr, /^Esta es la historia de Leo/);
  assert.match(narr, /antes de la final\./);
  const doc = loglineDe({ tipo: 'documental', premisa: { quien: 'la radio comunitaria', quiere: 'sus fundadoras', accion: 'demostrar', obstaculo: 'que comunicar es un derecho' } });
  assert.match(doc, /^Este proyecto explora la radio comunitaria/);
  assert.equal(loglineDe({ tipo: 'ficcion', premisa: {} }), '', 'sin premisa no hay logline');
});

test('todas las estructuras tienen beats completos', () => {
  Object.values(ESTRUCTURAS).forEach((e) => {
    assert.ok(e.nombre && e.detalle && e.beats.length >= 3);
    e.beats.forEach(([titulo, funcion, plano, peso]) => {
      assert.ok(titulo && funcion && plano && peso > 0, `beat incompleto en ${e.nombre}`);
    });
  });
});

test('escenasDe usa las fichas: encuadre→plano, percepción→ángulo, sonido y duración manual', () => {
  const n = {
    estructura: 'sencilla',
    personajes: [{ nombre: 'Ana' }],
    escenas: [
      { titulo: 'La sala', lugar: 'Foro 2, noche', cambio: 'Ana descubre la carta', encuadre: 'Mostrar contexto',
        percepcion: 'Vulnerable', mov: 'Travelling', voz: 'Diálogo', sonidos: 'lluvia',
        musica: 'Anempática (contrasta o la ignora)', fueraCampo: 'sirenas a lo lejos', dur: 45 },
      {}, {},
    ],
  };
  const esc = escenasDe(n, { durTotalSeg: 180 });
  assert.equal(esc.length, 3);
  assert.equal(esc[0].segmento, '1. La sala');
  assert.equal(esc[0].dur, 45);
  assert.match(esc[0].tomas[0].plano, /^Gran Plano General · Picado/);
  assert.equal(esc[0].tomas[0].mov, 'Travelling');
  assert.equal(esc[0].tomas[0].audio, 'Diálogo + lluvia');
  assert.match(esc[0].nota, /sirenas a lo lejos/);
  assert.match(esc[0].nota, /Foro 2, noche/);
});

test('alertasDe detecta cambio faltante, nocturno, soporte y audio sin crew', () => {
  const n = { estructura: 'sencilla', escenas: [
    { titulo: 'Uno', lugar: 'calle, noche', mov: 'Travelling', encuadre: 'Mostrar acción', voz: 'Diálogo' },
  ] };
  const alertas = alertasDe(n, { hayAudioCrew: false });
  assert.ok(alertas.some((a) => /qué cambia/.test(a)), 'falta alerta de cambio');
  assert.ok(alertas.some((a) => /nocturna/.test(a)), 'falta alerta nocturna');
  assert.ok(alertas.some((a) => /estabilización/i.test(a)), 'falta alerta de soporte');
  assert.ok(alertas.some((a) => /operador de audio/.test(a)), 'falta alerta de audio');
});

test('sincronizarPersonajes reusa el talento placeholder y agrega el resto como invitados', () => {
  const cfg = {
    talentos: [{ id: 't1', nombre: 'Conductor(a)', tipo: 'conductor' }],
    microfonos: [{ id: 'm1', nombre: 'Mic 1', conexion: 'Inalámbrico', micTipo: 'solapa', asignadoA: 'tal:t1' }],
    personal: [{ id: 'p1', rol: 'Conductor(a)', icon: 'conductor' }],
  };
  const out = sincronizarPersonajes(cfg, [{ nombre: 'Ana' }, { nombre: 'Luis' }, { nombre: 'ana' }]);
  // El primer personaje reescribe el placeholder (no crea otro talento)
  assert.equal(out.talentos.length, 2, 'placeholder reusado; el duplicado "ana" se ignora');
  assert.equal(out.talentos[0].nombre, 'Ana');
  assert.equal(out.talentos[0].tipo, 'conductor');
  assert.equal(out.talentos[1].nombre, 'Luis');
  assert.equal(out.talentos[1].tipo, 'invitado');
  // El mic y el personal del placeholder heredan el nombre real
  assert.equal(out.microfonos.find((m) => m.asignadoA === 'tal:t1').nombre, 'Mic · Ana');
  assert.equal(out.personal[0].rol, 'Ana · Conductor(a)');
  // El invitado nuevo trae su propio mic de solapa y su rol en personal
  const micLuis = out.microfonos.find((m) => m.nombre.includes('Luis'));
  assert.ok(micLuis && micLuis.micTipo === 'solapa', 'Luis recibe mic de solapa');
  assert.ok(out.personal.some((r) => r.rol === 'Luis · Invitado(a)'));
  // No muta el cfg original
  assert.equal(cfg.talentos.length, 1);
});

test('escaletaEnVivoDe arma una escaleta EDITORIAL por bloques (objetivo/participantes/recursos)', () => {
  const esc = escaletaEnVivoDe('noticiero', { durTotalSeg: 1800 });
  assert.ok(esc.length >= 8, 'el noticiero trae varios segmentos');
  // Campos editoriales presentes, y NADA de "fuente al aire" (eso es del rundown)
  esc.forEach((s) => {
    assert.ok(s.segmento && s.objetivo && s.bloque >= 1, 'cada segmento tiene título, objetivo y bloque');
    assert.equal('fuente' in s, false, 'la escaleta editorial no lleva fuente al aire');
    assert.ok(s.dur >= 10);
  });
  // Reparte para acercarse al objetivo (30 min)
  const total = esc.reduce((n, s) => n + s.dur, 0);
  assert.ok(Math.abs(total - 1800) <= esc.length * 5, `total ${total} lejos de 1800`);
  // Los segmentos de duración fija la conservan (cortinilla de entrada = 30s)
  assert.equal(esc[0].dur, 30, 'la cortinilla de entrada mantiene su duración fija');
  // Hay más de un bloque
  assert.ok(new Set(esc.map((s) => s.bloque)).size > 1, 'el programa se divide en bloques');
});

test('todos los tipos de programa en vivo generan escaletas válidas', () => {
  TIPOS_PROGRAMA.forEach((t) => {
    const esc = escaletaEnVivoDe(t.id, { durTotalSeg: 1200 });
    assert.ok(esc.length >= 3, `${t.id} genera segmentos`);
    esc.forEach((s) => assert.ok(s.segmento && s.dur >= 10, `${t.id}: segmento válido`));
  });
});

test('escenasDe emite los campos de la escaleta narrativa (encabezado/acción/función/cambio)', () => {
  const n = {
    estructura: 'sencilla',
    personajes: [{ nombre: 'Ana' }, { nombre: 'Luis' }],
    escenas: [
      { titulo: 'La calle', lugar: 'EXT. CALLE – NOCHE', cambio: 'Ana se siente vigilada' },
      {}, {},
    ],
  };
  const esc = escenasDe(n, { durTotalSeg: 180 });
  assert.equal(esc[0].encabezado, 'EXT. CALLE – NOCHE');
  assert.equal(esc[0].cambio, 'Ana se siente vigilada');
  assert.equal(esc[0].personajes, 'Ana, Luis', 'personajes de la escena = reparto');
  assert.ok(esc[0].funcion && esc[0].funcion.length > 3, 'cada escena trae su función narrativa');
  assert.equal('fuente' in esc[0], false, 'la escaleta narrativa no lleva fuente al aire');
});

test('construirProyectoNarrativo arma escaleta + logline + talentos desde un cfg base', () => {
  const cfg = {
    camaras: [{ id: 'c1', nombre: 'CAM 1' }, { id: 'c2', nombre: 'CAM 2' }],
    talentos: [{ id: 't1', nombre: 'Conductor(a)', tipo: 'conductor' }],
    microfonos: [{ id: 'm1', nombre: 'Mic 1', micTipo: 'solapa', asignadoA: 'tal:t1' }],
    personal: [{ id: 'p1', rol: 'Conductor(a)', icon: 'conductor' }],
    extras: [],
  };
  const n = { tipo: 'ficcion', estructura: 'sencilla', durMin: 3,
    premisa: { quien: 'Ana', quiere: 'volver a casa', obstaculo: 'la tormenta' },
    personajes: [{ nombre: 'Ana' }] };
  const out = construirProyectoNarrativo(cfg, n);
  assert.ok(out.escaleta.length >= 3, 'genera escaleta de escenas');
  assert.ok(out.escaleta.every((s) => s.id && s.funcion && 'encabezado' in s), 'cada escena trae id y campos narrativos');
  assert.match(out.narrativa.logline, /^Esta es la historia de Ana/);
  assert.ok(out.talentos.some((t) => t.nombre === 'Ana'), 'el personaje se vuelve talento');
});

test('construirEscaletaEnVivo arma la escaleta editorial y guarda cfg.programa', () => {
  const cfg = { camaras: [{ id: 'c1', nombre: 'CAM 1' }], talentos: [], microfonos: [], personal: [],
    extras: [{ id: 'x1', nombre: 'COMERCIALES', esCorte: true }] };
  const out = construirEscaletaEnVivo(cfg, { tipoPrograma: 'noticiero', durMin: 30, enVivo: true, nombre: 'Noti U' });
  assert.equal(out.programa.tipoPrograma, 'noticiero');
  assert.equal(out.programa.nombre, 'Noti U');
  assert.ok(out.escaleta.length >= 8 && out.escaleta.every((s) => s.id && s.objetivo && s.bloque >= 1));
  // Un segmento de corte usa la fuente de corte
  const corte = out.escaleta.find((s) => /corte/i.test(s.segmento));
  if (corte) assert.equal(corte.fuente, 'x1');
});

test('la técnica se recomienda desde la intención (manual audiovisual)', () => {
  assert.equal(planoPorEncuadre('Mostrar emoción'), 'Primer Plano');
  assert.equal(planoPorEncuadre('Mostrar contexto'), 'Gran Plano General');
  assert.equal(anguloPorPercepcion('Poderoso')[1], 'Contrapicado');
  assert.ok(anguloPorPercepcion('Aislado')[2].length > 10, 'toda percepción explica su efecto');
});

/* --------------------- Sugerencias: ritmo según el tamaño del plano ---------------------
Criterio del autor: un plano cerrado debe durar menos que uno abierto, porque el
ojo y el cerebro tardan más en leer las dimensiones y objetos de un plano general. */

test('escalaDePlano distingue el tamaño del plano aunque el texto venga sucio', () => {
  assert.equal(escalaDePlano('Plano General · Picado'), 5, 'el ángulo pegado no estorba');
  assert.equal(escalaDePlano('plano medio corto'), 2, 'no se confunde con Plano Medio');
  assert.equal(escalaDePlano('Plano Medio'), 3);
  assert.equal(escalaDePlano('primerisimo primer plano'), 1, 'sin acentos también');
  assert.equal(escalaDePlano('Plano Holandés'), null, 'un ángulo no define el tamaño');
});

test('se avisa cuando un plano cerrado dura más que uno abierto', () => {
  const cfg = { escaleta: [
    { id: 'e1', segmento: '1. Llega al taller', dur: 6, tomas: [{ plano: 'Plano General' }] },
    { id: 'e2', segmento: '2. Duda', dur: 12, tomas: [{ plano: 'Primer Plano' }] },
  ] };
  const avisos = revisar(cfg).filter((a) => a.regla === 'ritmo-planos');
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].nivel, 'precaucion');
  assert.match(avisos[0].motivo, /Primer Plano/);
  assert.match(avisos[0].motivo, /Plano General/);
  assert.match(avisos[0].porque, /ojo, junto al cerebro/);
});

test('un proyecto bien resuelto no recibe avisos', () => {
  const cfg = { escaleta: [
    { id: 'e1', segmento: '1. Llega', dur: 12, tomas: [{ plano: 'Plano General' }] },
    { id: 'e2', segmento: '2. Duda', dur: 4, tomas: [{ plano: 'Primer Plano' }] },
  ] };
  assert.deepEqual(revisar(cfg), []);
});

test('la regla también aplica a los cues del rundown en vivo', () => {
  const cfg = { escaleta: [{ id: 'b1', segmento: 'Entrada', cues: [
    { id: 'c1', texto: 'Abre en set', plano: 'Plano General', dur: 5 },
    { id: 'c2', texto: 'Conductor presenta', plano: 'Primer Plano', dur: 25 },
  ] }] };
  const avisos = revisar(cfg).filter((a) => a.regla === 'ritmo-planos');
  assert.equal(avisos.length, 1);
  assert.match(avisos[0].motivo, /El cue/);
});

test('sin planos escritos o sin proyecto, las sugerencias callan', () => {
  assert.deepEqual(revisar({ escaleta: [{ id: 'x', dur: 10, tomas: [{}] }] }), []);
  assert.deepEqual(revisar({}), []);
});

/* --------------------- Sugerencias: el resto de las reglas del autor --------------------- */

const proyectoNarrativo = () => ({
  modo: 'narrative', microfonos: [], camaras: [{ id: 'c1', nombre: 'CAM 1', plano: 'Plano Medio' }],
  escaleta: [
    { id: 'e1', segmento: '1. Llega', dur: 6, encabezado: 'EXT. Calle - Día', personajes: 'Ana', cambio: 'Decide entrar', tomas: [{ plano: 'Plano General', audio: 'Ambiente' }] },
    { id: 'e2', segmento: '2. Duda', dur: 12, encabezado: 'INT. Taller - Día', personajes: 'Ana', cambio: '', tomas: [{ plano: 'Primer Plano', audio: 'Voz de Ana + música triste' }] },
    { id: 'e3', segmento: '3. Manos', dur: 5, encabezado: 'INT. Taller - Día', personajes: 'Ana', cambio: '', tomas: [{ plano: 'Primer Plano', audio: 'Voz' }] },
  ],
});

const proyectoEnVivo = () => ({
  modo: 'live', programa: { tipoPrograma: 'noticiero', durMin: 30 },
  camaras: [
    { id: 'c1', nombre: 'CAM 1', plano: 'Plano Medio' },
    { id: 'c2', nombre: 'CAM 2', plano: 'Plano Medio' },
  ],
  microfonos: [{ id: 'm1' }], personal: [{ id: 'p1', rol: 'Operador de audio' }],
  escaleta: [
    { id: 'b1', segmento: 'Entrada', dur: 600, cues: [
      { id: 'q1', tipo: 'camara', texto: 'Abre en set', plano: 'Plano General', dur: 20 },
      { id: 'q2', tipo: 'vtr', texto: 'Lanzar nota', dur: 90 },
    ] },
    { id: 'b2', segmento: 'Nota', dur: 1380, cues: [
      { id: 'q3', tipo: 'camara', texto: 'Conductor cierra', plano: 'Primer Plano', dur: 60 },
    ] },
  ],
});

const reglasDe = (cfg) => revisar(cfg).map((a) => a.regla);

test('cada aviso trae nivel, problema, motivo, acción y el porqué', () => {
  const avisos = revisar(proyectoNarrativo());
  assert.ok(avisos.length > 0);
  avisos.forEach((a) => {
    assert.ok(NIVELES[a.nivel], `nivel válido: ${a.nivel}`);
    ['problema', 'motivo', 'accion', 'porque'].forEach((campo) => {
      assert.ok(String(a[campo] || '').trim(), `${a.regla} trae ${campo}`);
    });
  });
});

test('narrativo: detecta audio, cambio, música sobre voz, int/ext y falta de recursos', () => {
  const reglas = reglasDe(proyectoNarrativo());
  ['dialogo-sin-audio', 'escena-sin-cambio', 'musica-sobre-dialogo', 'salto-int-ext', 'sin-planos-recurso']
    .forEach((r) => assert.ok(reglas.includes(r), `falta la regla ${r}`));
});

test('en vivo: duración contra objetivo, encuadres repetidos, responsable del corte y retorno del video', () => {
  const reglas = reglasDe(proyectoEnVivo());
  ['duracion-objetivo', 'camaras-mismo-encuadre', 'sin-responsable-corte', 'vtr-sin-retorno']
    .forEach((r) => assert.ok(reglas.includes(r), `falta la regla ${r}`));
  const dur = revisar(proyectoEnVivo()).find((a) => a.regla === 'duracion-objetivo');
  assert.equal(dur.nivel, 'error', 'pasarse de la duración en vivo es error, no sugerencia');
  assert.match(dur.problema, /3 min/);
});

test('los avisos llegan ordenados: primero los errores', () => {
  const avisos = revisar(proyectoEnVivo());
  const ordenes = avisos.map((a) => NIVELES[a.nivel].orden);
  assert.deepEqual(ordenes, [...ordenes].sort((a, b) => a - b));
});

test('cinco planos cerrados seguidos piden un plano que ubique', () => {
  const cfg = { modo: 'narrative', escaleta: Array.from({ length: 5 }, (_, i) => ({
    id: `e${i}`, segmento: `${i + 1}`, dur: 4, tomas: [{ plano: 'Primer Plano' }],
  })) };
  assert.ok(reglasDe(cfg).includes('planos-cerrados-seguidos'));
});

test('un proyecto bien armado no recibe avisos', () => {
  const cfg = {
    modo: 'live', camaras: [{ id: 'c1', nombre: 'CAM 1', plano: 'Plano General' }, { id: 'c2', nombre: 'CAM 2', plano: 'Primer Plano' }],
    microfonos: [{ id: 'm1' }], personal: [{ id: 'p1', rol: 'Director de cámaras' }],
    escaleta: [{ id: 'b1', segmento: 'Bloque', dur: 60, cues: [
      { id: 'q1', tipo: 'camara', texto: 'General', plano: 'Plano General', dur: 20 },
      { id: 'q2', tipo: 'camara', texto: 'Detalle', plano: 'Plano Detalle', dur: 5 },
    ] }],
  };
  assert.deepEqual(revisar(cfg), []);
});

/* --------------------- Duración objetivo del proyecto --------------------- */

test('la duración objetivo se lee del proyecto y respeta a los proyectos viejos', () => {
  assert.equal(objetivoDe({ duracionObjetivoMin: 12 }), 12);
  assert.equal(objetivoDe({ programa: { durMin: 30 } }), 30, 'proyectos del asistente en vivo retirado');
  assert.equal(objetivoDe({ duracionObjetivoMin: 8, programa: { durMin: 30 } }), 8, 'manda el campo nuevo');
  assert.equal(objetivoDe({}), 0, 'sin objetivo definido');
  assert.equal(objetivoDe(), 0);
});

test('con duración objetivo, el aviso aparece en cualquier modo', () => {
  const base = (extra) => ({
    escaleta: [{ id: 's1', segmento: 'Único', dur: 400 }],
    ...extra,
  });
  assert.deepEqual(revisar(base({})), [], 'sin objetivo no hay nada que comparar');

  const sobra = revisar(base({ duracionObjetivoMin: 5 })).find((a) => a.regla === 'duracion-objetivo');
  assert.equal(sobra.nivel, 'error');
  assert.match(sobra.problema, /Te pasas/);

  const falta = revisar(base({ duracionObjetivoMin: 10 })).find((a) => a.regla === 'duracion-objetivo');
  assert.equal(falta.nivel, 'precaucion');
  assert.match(falta.problema, /Te faltan/);

  const justo = revisar(base({ duracionObjetivoMin: 7 })).find((a) => a.regla === 'duracion-objetivo');
  assert.equal(justo, undefined, 'a menos de 30 s del objetivo no molesta');
});

/* --------------------- Correcciones automáticas: solo lo mecánico --------------------- */

const proyectoConHuecos = () => ({
  modo: 'live',
  talentos: [{ id: 't1', nombre: 'Ana' }, { id: 't2', nombre: 'Beto' }],
  microfonos: [], personal: [{ id: 'p1', rol: 'Operador de audio' }],
  camaras: [{ id: 'c1', nombre: 'CAM 1', plano: 'Plano General' }, { id: 'c2', nombre: 'CAM 2', plano: 'Primer Plano' }],
  escaleta: [{ id: 'b1', segmento: 'Entrada', dur: 120, personajes: 'Ana', cues: [
    { id: 'q1', tipo: 'camara', texto: 'Abre', plano: 'Plano General', dur: 20 },
    { id: 'q2', tipo: 'vtr', texto: 'Lanzar nota', dur: 90 },
  ] }],
});

test('solo las reglas mecánicas ofrecen corregir automáticamente', () => {
  const conArreglo = revisar(proyectoConHuecos()).filter((a) => a.arreglo).map((a) => a.regla).sort();
  assert.deepEqual(conArreglo, ['dialogo-sin-audio', 'sin-responsable-corte', 'vtr-sin-retorno']);
  // Lo creativo (qué recortar, cómo repartir encuadres, qué cambia en la escena)
  // NUNCA se corrige solo: lo decide el autor.
  const creativas = ['ritmo-planos', 'duracion-objetivo', 'camaras-mismo-encuadre', 'escena-sin-cambio',
    'planos-cerrados-seguidos', 'sin-planos-recurso', 'musica-sobre-dialogo', 'salto-int-ext'];
  const cfgCreativo = { ...proyectoConHuecos(), duracionObjetivoMin: 1 };
  revisar(cfgCreativo).filter((a) => creativas.includes(a.regla))
    .forEach((a) => assert.equal(a.arreglo, undefined, `${a.regla} no debe corregirse sola`));
});

test('el arreglo del video sin retorno inserta el cue en su lugar y no toca nada más', () => {
  const cfg = proyectoConHuecos();
  const aviso = revisar(cfg).find((a) => a.regla === 'vtr-sin-retorno');
  const nuevo = aviso.arreglo.aplicar(cfg);
  const cues = nuevo.escaleta[0].cues;
  assert.equal(cues.length, 3);
  assert.equal(cues[1].tipo, 'vtr', 'el video sigue donde estaba');
  assert.equal(cues[2].texto, 'Retorno a conductor');
  assert.equal(cues[2].alAire, 'c1', 'sale por la primera cámara');
  assert.equal(cfg.escaleta[0].cues.length, 2, 'el proyecto original no se modifica');
  assert.ok(!revisar(nuevo).some((a) => a.regla === 'vtr-sin-retorno'), 'el aviso desaparece');
});

test('el arreglo del responsable agrega el rol sin borrar el equipo', () => {
  const cfg = proyectoConHuecos();
  const nuevo = revisar(cfg).find((a) => a.regla === 'sin-responsable-corte').arreglo.aplicar(cfg);
  assert.equal(nuevo.personal.length, 2);
  assert.equal(nuevo.personal[1].rol, 'Director de cámaras');
  assert.ok(!revisar(nuevo).some((a) => a.regla === 'sin-responsable-corte'));
});

test('el arreglo del audio pone un micrófono de solapa por talento, ya asignado', () => {
  const cfg = proyectoConHuecos();
  const nuevo = revisar(cfg).find((a) => a.regla === 'dialogo-sin-audio').arreglo.aplicar(cfg);
  assert.equal(nuevo.microfonos.length, 2);
  assert.equal(nuevo.microfonos[0].micTipo, 'solapa');
  assert.equal(nuevo.microfonos[0].asignadoA, 'tal:t1');
  assert.match(nuevo.microfonos[1].nombre, /Beto/);
  assert.ok(!revisar(nuevo).some((a) => a.regla === 'dialogo-sin-audio'));
});

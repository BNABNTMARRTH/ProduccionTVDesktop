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
import { ESTRUCTURAS, loglineDe, escenasDe, alertasDe, planoPorEncuadre, anguloPorPercepcion, sincronizarPersonajes } from '../web-sources/generador-tv/src/narrativa.js';

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

test('la técnica se recomienda desde la intención (manual audiovisual)', () => {
  assert.equal(planoPorEncuadre('Mostrar emoción'), 'Primer Plano');
  assert.equal(planoPorEncuadre('Mostrar contexto'), 'Gran Plano General');
  assert.equal(anguloPorPercepcion('Poderoso')[1], 'Contrapicado');
  assert.ok(anguloPorPercepcion('Aislado')[2].length > 10, 'toda percepción explica su efecto');
});

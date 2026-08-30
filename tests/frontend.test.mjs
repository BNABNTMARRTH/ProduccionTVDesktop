// Pruebas de la lógica pura del frontend (sin navegador ni framework):
//   node --test tests/frontend.test.mjs
// (con la ruta explícita: `node --test tests/` no descubre archivos .mjs
// en las versiones recientes de Node)
// Cubre plantillas/migración de datos y el catálogo de iluminación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTemplate, infografiaFromDiagram, templateDefaults, SCHEMA_VERSION, normalizeMode } from '../frontend/src/templates.js';
import { PLANTILLAS_SET, cfgDePlantilla, plantillaPorId } from '../frontend/src/plantillas.js';
import { construirPrograma, pasoEn } from '../frontend/src/production.js';
import {
  LUZ_CATALOGO, SETUPS_ILUMINACION, SETUPS_EXTERIOR, RECOMENDADAS_POR_PLANTILLA,
  getSetup, instanciarSetup, instanciarElemento, posicionesParaLuces,
} from '../web-sources/generador-tv/src/iluminacion.js';
import { MUEBLES_CATALOGO, MUEBLE_ASIENTOS } from '../web-sources/generador-tv/src/catalogos.js';
import { ESTRUCTURAS, loglineDe, escenasDe, alertasDe, planoPorEncuadre, anguloPorPercepcion, sincronizarPersonajes, construirProyectoNarrativo } from '../web-sources/generador-tv/src/narrativa.js';
import { revisar, publicoDe, escalaDePlano, NIVELES } from '../web-sources/generador-tv/src/sugerencias.js';
import { FICHAS, fichasDe } from '../web-sources/generador-tv/src/fichas.js';
import { objetivoDe, objetivoSegDe, normalizeCfg, normPerfil, formatoSugerido, porSegundo,
         repartoCalculado, repartoVacio, BLOQUES, FORMATOS } from '../web-sources/generador-tv/src/proyecto.js';
import { escaletaEnVivoDe, TIPOS_PROGRAMA, construirEscaletaEnVivo } from '../web-sources/generador-tv/src/envivo.js';
import { guionDe,
  TIPOS, TIPO_SIGUIENTE, siguienteEnRotacion, bloqueNuevo, renglonesDe, medidasDe,
  normalizarEncabezado, esEncabezadoValido, personajesDe, guionATexto,
  MARCADORES, aplicarMarca, quitarMarca, trozosMarcados, moverMarcas,
} from '../web-sources/generador-tv/src/guion.js';

/* ---- El proyecto nuevo empieza vacío, y las plantillas lo llenan ---- */

test('un proyecto vacío nace VACÍO: sin cámaras, sin gente y sin equipo', () => {
  const cfg = makeTemplate('vacio', {});
  assert.equal(cfg.camaras.length, 0, 'no se inventan cámaras');
  assert.equal(cfg.talentos.length, 0, 'no se inventa un(a) conductor(a)');
  assert.equal(cfg.microfonos.length, 0, 'sin talentos no hay micrófonos');
  assert.equal(cfg.personal.length, 0, 'no se inventa el equipo de operación');
  assert.equal(cfg.escaleta.length, 0, 'la escaleta arranca en blanco');
  assert.equal(cfg.sets.length, 1, 'pero sí hay un set: es el lienzo donde se arma');
});

test('el proyecto vacío sigue admitiendo lo que el usuario SÍ pidió', () => {
  const cfg = makeTemplate('vacio', { cams: 2, talents: [{ name: 'Ana', tipo: 'conductor' }] });
  assert.equal(cfg.camaras.length, 2, 'lo pedido manda sobre el vacío');
  assert.equal(cfg.talentos.length, 1);
  assert.ok(cfg.personal.some((r) => r.rol.startsWith('Ana')), 'el talento con nombre entra al personal');
  assert.ok(cfg.personal.length > 1, 'con gente vuelve el equipo básico');
});

test('las demás plantillas siguen sembrando su gente', () => {
  const cfg = makeTemplate('noticiero', {});
  assert.equal(cfg.camaras.length, 3);
  assert.equal(cfg.talentos.length, 1, 'un noticiero sin conductor(a) no es un noticiero');
  assert.ok(cfg.personal.length >= 4);
});

test('cada plantilla de set apunta a un setup y a muebles que existen', () => {
  assert.ok(PLANTILLAS_SET.length >= 6, 'la galería necesita variedad para servir de algo');
  const ids = new Set();
  PLANTILLAS_SET.forEach((p) => {
    assert.ok(!ids.has(p.id), `plantilla repetida: ${p.id}`);
    ids.add(p.id);
    assert.ok(getSetup(p.setup), `${p.id}: setup de iluminación inexistente (${p.setup})`);
    (p.muebles || []).forEach((tipo) => assert.ok(MUEBLES_CATALOGO[tipo], `${p.id}: mueble inexistente (${tipo})`));
    assert.ok(p.nombre && p.resumen && p.detalle, `${p.id}: la tarjeta necesita nombre, resumen y detalle`);
  });
});

test('una plantilla de set llega con el plano YA armado (no como sugerencia)', () => {
  const cfg = cfgDePlantilla(plantillaPorId('podcast'), 'Mi podcast');
  const set = cfg.sets[0];
  assert.equal(cfg.camaras.length, 2);
  assert.equal(cfg.talentos.length, 2);
  assert.ok(set.iluminacion?.luces.length, 'las luces vienen instanciadas');
  assert.equal(set.muebles.length, 3, 'la mesa baja y los dos sillones del podcast');
  assert.equal(set.muebles[0].tipo, 'mesa', 'la mesa ahora es un mueble, no parte fija del set');
  assert.equal(set.mesaVisible, false, 'ningún set nuevo trae la mesa fija de serie');
  // Cada mueble y cada luz con su posición en el lienzo: sin esto caerían
  // todas al centro y el plano de la tarjeta sería una pila.
  set.muebles.forEach((m) => assert.ok(cfg.sets[0].setLayout.pos[`mue:${m.id}`], 'mueble sin posición'));
  set.iluminacion.luces.forEach((l) => assert.ok(set.setLayout.pos[`luz:${l.id}`], 'luz sin posición'));
  assert.deepEqual(set.muebles[0].ocupantes, [], 'nadie se sienta ENCIMA de la mesa');
  assert.equal(set.muebles[1].ocupantes[0], cfg.talentos[0].id, 'quien conduce va en el primer sillón');
  assert.equal(set.muebles[2].ocupantes[0], cfg.talentos[1].id, 'y quien lo visita, en el otro');
  assert.equal(cfg.iluminacionSugerida, undefined, 'ya está aplicada: la bandera sobra');
  assert.equal(cfg.mueblesSugeridos, undefined);
  assert.ok(cfg.titulo.includes('Mi podcast'), 'el nombre escrito llega al título');
});

test('la mesa dejó de venir de serie y ahora es mobiliario', () => {
  // Un proyecto vacío nace SIN mesa: solo el punto de foco.
  const vacio = makeTemplate('vacio', {});
  assert.equal(vacio.sets[0].mesaVisible, false, 'la mesa fija ya no viene de serie');
  assert.equal(vacio.sets[0].muebles.length, 0);
  // Y las dos mesas existen como muebles, con sus asientos alrededor (nadie
  // se sienta en el centro de una mesa).
  ['mesa', 'mesaRedonda'].forEach((tipo) => {
    assert.ok(MUEBLES_CATALOGO[tipo], `falta el mueble ${tipo}`);
    const asientos = MUEBLE_ASIENTOS[tipo];
    assert.equal(asientos.length, MUEBLES_CATALOGO[tipo].cap, `${tipo}: plazas y asientos no cuadran`);
    asientos.forEach((a) => assert.ok(Math.hypot(a.x, a.y) > 20, `${tipo}: un asiento cae encima de la mesa`));
  });
  assert.equal(MUEBLE_ASIENTOS.mesa[0].x, 0, 'con una sola persona, se sienta al centro del escritorio');
});

test('un proyecto viejo NO pierde la mesa que ya tenía', () => {
  // Sets guardados antes del cambio no traen el campo: la migración se lo
  // repone en true para que su plano se siga viendo igual.
  const viejo = normalizeCfg({ camaras: [], microfonos: [], escaleta: [],
    sets: [{ id: 's1', nombre: 'Set', locacion: 'int', setLayout: { pos: {}, rot: {} }, muebles: [] }], setActivo: 's1' });
  assert.equal(viejo.sets[0].mesaVisible, true, 'a un proyecto viejo no se le quita la mesa');
});

test('la mesa redonda del panel sienta a los cuatro en corro', () => {
  const cfg = cfgDePlantilla(plantillaPorId('panel'));
  const set = cfg.sets[0];
  assert.equal(set.muebles.length, 1);
  assert.equal(set.muebles[0].tipo, 'mesaRedonda');
  assert.equal(set.muebles[0].ocupantes.length, 4, 'los cuatro se sientan a la misma mesa');
  assert.deepEqual(set.muebles[0].ocupantes, cfg.talentos.map((t) => t.id));
});

test('todas las plantillas de set producen un proyecto dibujable', () => {
  PLANTILLAS_SET.forEach((p) => {
    const cfg = cfgDePlantilla(p);
    assert.equal(cfg.schema, SCHEMA_VERSION, `${p.id}: esquema viejo`);
    assert.equal(cfg.camaras.length, p.cams, `${p.id}: no salieron las cámaras pedidas`);
    assert.equal(cfg.sets[0].mesaVisible, p.mesa !== false, `${p.id}: la mesa no coincide`);
    assert.equal(cfg.sets[0].locacion, p.locacion, `${p.id}: la locación no coincide`);
    assert.ok(cfg.microfonos.length, `${p.id}: un set sin micrófonos no se puede grabar`);
    // Las posiciones tienen que caer DENTRO del lienzo de 980×600.
    Object.entries(cfg.sets[0].setLayout.pos).forEach(([k, v]) => {
      assert.ok(v.x >= 0 && v.x <= 980 && v.y >= 0 && v.y <= 600, `${p.id}: ${k} fuera del lienzo`);
    });
  });
});

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

test('la duración objetivo se guarda en segundos y admite piezas de menos de un minuto', () => {
  // El caso que no se podía escribir antes: el campo era de minutos enteros.
  assert.equal(objetivoSegDe({ duracionObjetivoSeg: 50 }), 50, 'una cápsula de 50 segundos');
  assert.equal(objetivoSegDe({ duracionObjetivoSeg: 30 }), 30, 'un spot de 30 segundos');
  assert.equal(objetivoSegDe({ duracionObjetivoSeg: 90 }), 90);
  // Proyectos ya guardados: el campo viejo en minutos se sigue leyendo.
  assert.equal(objetivoSegDe({ duracionObjetivoMin: 12 }), 720, 'proyecto viejo, en minutos');
  assert.equal(objetivoSegDe({ programa: { durMin: 30 } }), 1800, 'proyecto del asistente retirado');
  // Si están los dos, manda el nuevo (es el que el usuario acaba de escribir).
  assert.equal(objetivoSegDe({ duracionObjetivoSeg: 50, duracionObjetivoMin: 1 }), 50);
  assert.equal(objetivoSegDe({}), 0, 'sin objetivo definido');
  assert.equal(objetivoSegDe(), 0);
  assert.equal(objetivoSegDe({ duracionObjetivoSeg: 0 }), 0, 'cero es "sin objetivo", no una duración');
  assert.equal(objetivoSegDe({ duracionObjetivoSeg: 'nada' }), 0, 'basura no rompe la cuenta');
});

test('el costo por segundo divide entre el objetivo, y con él la cuenta cierra', () => {
  // La duda de siempre: "si mi pieza dura 50 s, ¿$/s × 50 no debería dar el
  // presupuesto?". Sí — siempre y cuando el objetivo SEA de 50 s. Antes no se
  // podía escribir esa duración y la cuenta nunca cerraba.
  const seg = objetivoSegDe({ duracionObjetivoSeg: 50 });
  assert.equal(seg, 50);
  assert.equal(porSegundo(5000, seg), 100);
  assert.equal(porSegundo(5000, seg) * seg, 5000, 'la multiplicación regresa al presupuesto');
  // Sin objetivo la cifra no se inventa nada.
  assert.equal(porSegundo(5000, 0), null);
  assert.equal(porSegundo('', 50), null);
  // Acepta el presupuesto escrito con signos, como lo teclea la gente.
  assert.equal(porSegundo('$5,000', 50), 100);
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

test('el aviso de duración también sirve para piezas de segundos', () => {
  const base = (extra) => ({ escaleta: [{ id: 's1', segmento: 'Único', dur: 50 }], ...extra });
  const sobra = revisar(base({ duracionObjetivoSeg: 30 })).find((a) => a.regla === 'duracion-objetivo');
  assert.equal(sobra.nivel, 'error');
  assert.match(sobra.problema, /Te pasas/);
  // Debajo del minuto las duraciones se dicen en segundos: "0.3 min" no dice nada.
  assert.match(sobra.problema, /\bs\b/, 'la diferencia se expresa en segundos');
  assert.match(sobra.motivo, /El programa dura 30 s/);
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


/* ---------------------- Guion literario (formato tradicional) ---------------------- */

test('el Enter encadena los tipos como en un guion de verdad', () => {
  // Tras el nombre del personaje SIEMPRE viene lo que dice; tras el diálogo,
  // se vuelve a la acción. Eso es lo que hace que escribir sea rápido.
  assert.equal(TIPO_SIGUIENTE.personaje, 'dialogo');
  assert.equal(TIPO_SIGUIENTE.parentesis, 'dialogo');
  assert.equal(TIPO_SIGUIENTE.dialogo, 'accion');
  assert.equal(TIPO_SIGUIENTE.accion, 'accion');
});

test('el Tab rota entre los cinco tipos y vuelve al principio', () => {
  const vistos = [];
  let t = 'accion';
  for (let i = 0; i < 5; i++) { vistos.push(t); t = siguienteEnRotacion(t); }
  assert.deepEqual(vistos, ['accion', 'personaje', 'parentesis', 'dialogo', 'transicion']);
  assert.equal(t, 'accion');
});

test('los encabezados de escena se normalizan al formato del oficio', () => {
  assert.equal(normalizarEncabezado('int. mercado república - día'), 'INT. MERCADO REPÚBLICA - DÍA');
  assert.equal(normalizarEncabezado('ext casa de ana – noche'), 'EXT. CASA DE ANA – NOCHE');
  assert.equal(normalizarEncabezado(''), '');
  assert.ok(esEncabezadoValido('INT. COCINA - DÍA'));
  assert.ok(!esEncabezadoValido('la cocina de Ana'));
});

test('una página de guion equivale a un minuto de pantalla', () => {
  // 55 renglones = 1 página = 60 segundos. Un bloque de acción de una línea
  // ocupa 2 renglones (su línea más el aire de arriba).
  const escena = { encabezado: 'INT. MERCADO - DÍA', guion: Array.from({ length: 26 }, () => bloqueNuevo('accion', 'Ana camina.')) };
  const m = medidasDe([escena]);
  assert.equal(m.renglones, 26 * 2 + 2);
  assert.ok(Math.abs(m.segundos - 59) <= 2, `segundos calculados: ${m.segundos}`);
});

test('el diálogo se pega a su personaje y la acción respira', () => {
  assert.equal(renglonesDe(bloqueNuevo('dialogo', 'Hola.')), 1);
  assert.equal(renglonesDe(bloqueNuevo('accion', 'Hola.')), 2);
  // Un diálogo largo se parte según el ancho de su columna (35 caracteres).
  assert.equal(renglonesDe(bloqueNuevo('dialogo', 'x'.repeat(70))), 2);
});

test('los personajes para autocompletar salen del guion y de los talentos', () => {
  const cfg = {
    talentos: [{ nombre: 'Doña Rosa' }],
    escaleta: [{ guion: [bloqueNuevo('personaje', 'ana'), bloqueNuevo('dialogo', 'Hola'), bloqueNuevo('personaje', 'ANA')] }],
  };
  assert.deepEqual(personajesDe(cfg), ['ANA', 'DOÑA ROSA']);
});

test('el guion se exporta como texto con la sangría del formato', () => {
  const txt = guionATexto([{
    encabezado: 'int. mercado - día',
    guion: [bloqueNuevo('accion', 'Ana abre la cortina.'), bloqueNuevo('personaje', 'ana'), bloqueNuevo('dialogo', 'Ya abrimos.')],
  }]);
  assert.ok(txt.includes('1. INT. MERCADO - DÍA'));
  assert.ok(txt.includes('Ana abre la cortina.'));
  assert.ok(txt.includes(' '.repeat(22) + 'ANA'));
  assert.ok(txt.includes(' '.repeat(11) + 'Ya abrimos.'));
});


test('un proyecto sin `flujo` no tumba la pantalla: normalizeCfg lo repone', () => {
  // Un .ptv viejo (o hecho a mano) puede no traer el campo. La tarjeta de Flujo
  // lo leía directo y dejaba la etapa en blanco.
  const cfg = normalizeCfg({ titulo: 'Viejo', escaleta: [], camaras: [], microfonos: [] });
  assert.deepEqual(cfg.flujo, { preview: true, playback: true });
  // Y si el proyecto ya trae valores, se respetan.
  assert.deepEqual(normalizeCfg({ flujo: { preview: false, playback: true } }).flujo, { preview: false, playback: true });
});


/* -------------------------- Marcatextos del guion -------------------------- */

test('hay cuatro marcadores y cada uno trae color de fondo y de tinta', () => {
  assert.deepEqual(Object.keys(MARCADORES), ['verde', 'amarillo', 'naranja', 'rojo']);
  Object.values(MARCADORES).forEach((m) => {
    assert.match(m.color, /^#[0-9A-F]{6}$/i);
    assert.match(m.tinta, /^#[0-9A-F]{6}$/i);
  });
});

test('un marcador encima de otro lo recorta, no se encima', () => {
  let m = aplicarMarca([], 5, 10, 'amarillo');
  m = aplicarMarca(m, 8, 14, 'verde');
  assert.deepEqual(m, [{ ini: 5, fin: 8, color: 'amarillo' }, { ini: 8, fin: 14, color: 'verde' }]);
});

test('dos marcas pegadas del mismo color se unen en una', () => {
  let m = aplicarMarca([], 0, 5, 'rojo');
  m = aplicarMarca(m, 5, 9, 'rojo');
  assert.deepEqual(m, [{ ini: 0, fin: 9, color: 'rojo' }]);
});

test('borrar en medio de una marca la parte en dos', () => {
  const m = quitarMarca([{ ini: 0, fin: 20, color: 'verde' }], 8, 12);
  assert.deepEqual(m, [{ ini: 0, fin: 8, color: 'verde' }, { ini: 12, fin: 20, color: 'verde' }]);
});

test('el texto se parte en trozos con y sin color, sin perder ni un carácter', () => {
  const texto = '0123456789ABCDEFG';
  const m = aplicarMarca([], 5, 10, 'naranja');
  const trozos = trozosMarcados(texto, m);
  assert.equal(trozos.map((t) => t.texto).join(''), texto);
  assert.deepEqual(trozos.find((t) => t.color === 'naranja'), { texto: '56789', color: 'naranja' });
});

test('escribir antes de una marca la recorre: el resaltado no se despega', () => {
  const m = [{ ini: 10, fin: 15, color: 'amarillo' }];
  assert.deepEqual(moverMarcas(m, 3, 4), [{ ini: 14, fin: 19, color: 'amarillo' }]);   // se escribieron 4 letras
  assert.deepEqual(moverMarcas(m, 3, -2), [{ ini: 8, fin: 13, color: 'amarillo' }]);   // se borraron 2
  // Si se borra TODO lo marcado, la marca desaparece en vez de quedar al revés.
  assert.deepEqual(moverMarcas([{ ini: 4, fin: 6, color: 'rojo' }], 0, -10), []);
});

test('un texto sin marcas devuelve un solo trozo sin color', () => {
  assert.deepEqual(trozosMarcados('Hola', []), [{ texto: 'Hola', color: null }]);
});

/* ---------------- Reglas de ritmo (duración como serie) ----------------
Criterios tomados del cuaderno «2. Guion y narrativa»: el tempo se mide por
cuánto VARÍA la duración de las escenas, no por su valor absoluto. */

// Escaleta de n segmentos, todos de la misma duración salvo los que se indiquen.
const escaletaDe = (durs) => ({
  escaleta: durs.map((dur, i) => ({ id: `s${i}`, segmento: `Bloque ${i + 1}`, dur })),
});

test('ritmo plano: escenas todas iguales piden contraste', () => {
  const avisos = revisar(escaletaDe([60, 60, 60, 60, 60])).filter((a) => a.regla === 'ritmo-plano');
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].nivel, 'recomendacion');
  assert.match(avisos[0].porque, /contraste/);
});

test('ritmo plano: si las duraciones varían, la regla calla', () => {
  const reglas = reglasDe(escaletaDe([20, 90, 45, 150, 30]));
  assert.ok(!reglas.includes('ritmo-plano'));
});

test('ritmo plano: con menos de cuatro segmentos no opina', () => {
  const reglas = reglasDe(escaletaDe([60, 60, 60]));
  assert.ok(!reglas.includes('ritmo-plano'));
});

test('final sin acelerar: el último tercio mucho más largo que el primero', () => {
  const avisos = revisar(escaletaDe([20, 20, 30, 40, 90, 100]))
    .filter((a) => a.regla === 'final-sin-acelerar');
  assert.equal(avisos.length, 1);
  assert.match(avisos[0].problema, /más lento/);
});

test('final sin acelerar: si el final se acorta, no dice nada', () => {
  const reglas = reglasDe(escaletaDe([100, 90, 60, 40, 20, 15]));
  assert.ok(!reglas.includes('final-sin-acelerar'));
});

test('texto que no cabe: avisa cuántos segundos faltan', () => {
  // 120 palabras necesitan ~48 s a 2.5 palabras/segundo; el bloque dura 10.
  const cfg = { escaleta: [{ id: 'a', segmento: 'Apertura', dur: 10,
    nota: Array.from({ length: 120 }, (_, i) => `palabra${i}`).join(' ') }] };
  const avisos = revisar(cfg).filter((a) => a.regla === 'texto-no-cabe');
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].nivel, 'precaucion');
  assert.match(avisos[0].motivo, /120 palabras/);
  assert.match(avisos[0].porque, /150 palabras por minuto/);
});

test('texto que no cabe: un texto que sí entra en el tiempo no genera aviso', () => {
  const cfg = { escaleta: [{ id: 'a', segmento: 'Apertura', dur: 60,
    nota: Array.from({ length: 100 }, (_, i) => `palabra${i}`).join(' ') }] };
  assert.ok(!reglasDe(cfg).includes('texto-no-cabe'));
});

test('las reglas de ritmo también traen los cuatro campos y nivel válido', () => {
  const avisos = revisar(escaletaDe([60, 60, 60, 60, 60]));
  avisos.forEach((a) => {
    assert.ok(NIVELES[a.nivel]);
    ['problema', 'motivo', 'accion', 'porque'].forEach((c) => assert.ok(String(a[c] || '').trim()));
  });
});

/* ------------------- Fichas de "cómo se hace" -------------------
No hay buscador: la ficha se deduce de lo que el proyecto ya declara — su tipo
(cfg.narrativa.tipo) y dónde se va a publicar (cfg.perfil.medios). */

const idsDe = (cfg) => fichasDe(cfg).map((f) => f.id);

test('cada ficha trae los seis apartados llenos y dice de qué cuaderno viene', () => {
  assert.ok(FICHAS.length >= 7, `se esperaban 7 fichas, hay ${FICHAS.length}`);
  FICHAS.forEach((f) => {
    assert.ok(String(f.titulo || '').trim(), `${f.id} sin título`);
    assert.ok(String(f.fuente || '').trim(), `${f.id} no dice de qué cuaderno viene`);
    ['empezar', 'pasos', 'estructura', 'duracion', 'errores', 'revisa'].forEach((c) => {
      const v = f[c];
      const lleno = Array.isArray(v) ? v.length > 0 : String(v || '').trim().length > 0;
      assert.ok(lleno, `${f.id} tiene vacío el apartado ${c}`);
    });
  });
});

test('el tipo de proyecto elige la ficha, sin que el usuario busque nada', () => {
  assert.equal(idsDe({ modo: 'narrative', narrativa: { tipo: 'videoclip' } })[0], 'videoclip');
  assert.equal(idsDe({ modo: 'narrative', narrativa: { tipo: 'publicidad' } })[0], 'comercial');
  assert.equal(idsDe({ modo: 'narrative', narrativa: { tipo: 'ficcion' } })[0], 'narrativo');
  assert.equal(idsDe({ modo: 'live', narrativa: { tipo: 'estudio' } })[0], 'envivo');
});

test('un proyecto en vivo sin tipo declarado cae en la ficha de en vivo', () => {
  assert.equal(idsDe({ modo: 'live' })[0], 'envivo');
});

test('un proyecto narrativo sin tipo declarado cae en la ficha de guion', () => {
  assert.equal(idsDe({ modo: 'narrative' })[0], 'narrativo');
});

test('el medio donde se publica suma su propia ficha de formato', () => {
  const spotEnTikTok = { modo: 'narrative', narrativa: { tipo: 'publicidad' },
    perfil: { medios: ['TikTok'] } };
  assert.deepEqual(idsDe(spotEnTikTok).slice(0, 2), ['comercial', 'tiktok']);

  const clipEnReels = { modo: 'narrative', narrativa: { tipo: 'videoclip' },
    perfil: { medios: ['Instagram / Reels'] } };
  assert.deepEqual(idsDe(clipEnReels).slice(0, 2), ['videoclip', 'reel']);
});

test('preparar el rodaje se ofrece siempre, y al final', () => {
  [{ modo: 'live' }, { modo: 'narrative', narrativa: { tipo: 'ficcion' } }].forEach((cfg) => {
    const ids = idsDe(cfg);
    assert.equal(ids[ids.length - 1], 'rodaje');
  });
});

test('ninguna ficha se repite aunque el tipo y el medio coincidan', () => {
  const ids = idsDe({ modo: 'narrative', narrativa: { tipo: 'publicidad' },
    perfil: { medios: ['TikTok', 'TikTok', 'Instagram / Reels'] } });
  assert.deepEqual(ids, [...new Set(ids)]);
});

test('un proyecto vacío o sin datos no rompe: siempre devuelve algo que leer', () => {
  [null, undefined, {}, { perfil: {} }].forEach((cfg) => {
    assert.ok(fichasDe(cfg).length > 0, 'debería ofrecer al menos una ficha');
  });
});


/* ===================== PERFIL AMPLIADO (2026-08-26) =====================
El formato del cuadro, el alcance y el reparto del presupuesto. Los rangos
del reparto son los de la industria (Above/Below the Line), no inventados. */

test('la forma del cuadro se deduce de dónde lo va a ver el receptor', () => {
  assert.equal(formatoSugerido(['TikTok', 'Instagram / Reels']), '9:16');
  assert.equal(formatoSugerido(['Cine']), '2.39:1');
  assert.equal(formatoSugerido(['TV abierta']), '16:9');
  assert.equal(formatoSugerido([]), '16:9', 'sin medios, el horizontal es lo seguro');
});

test('si va a TikTok Y a cine, manda el panorámico: se recorta, no se inventa cuadro', () => {
  assert.equal(formatoSugerido(['TikTok', 'Cine']), '2.39:1');
});

test('la sugerencia de formato no pisa lo que el usuario ya eligió a mano', () => {
  assert.equal(normPerfil({ medios: ['TikTok'], formato: '16:9' }).formato, '16:9');
  assert.equal(normPerfil({ medios: ['TikTok'] }).formato, '9:16', 'vacío sí se sugiere');
});

test('un perfil viejo no rompe: el reparto se repone entero', () => {
  const p = normPerfil({ emisor: 'FCC' });
  assert.deepEqual(p.reparto, repartoVacio());
  assert.equal(p.reparto.atl + p.reparto.btl + p.reparto.pos + p.reparto.imprev, 100);
});

test('un reparto a medias no deja huecos que rompan la suma', () => {
  const p = normPerfil({ reparto: { atl: 40 } });
  assert.equal(p.reparto.atl, 40);
  assert.equal(typeof p.reparto.pos, 'number', 'las llaves que faltan se reponen');
});

test('el reparto convierte porcentajes a pesos', () => {
  const { filas, total, suma } = repartoCalculado({ presupuesto: '12000', reparto: repartoVacio() });
  assert.equal(total, 12000);
  assert.equal(suma, 100);
  assert.equal(filas.find((f) => f.id === 'atl').mxn, 3600);
  assert.equal(filas.find((f) => f.id === 'btl').mxn, 5400);
});

test('avisa cuando un bloque se sale del rango de la industria', () => {
  // El error clásico: se gastan todo grabando y llegan secos a editar.
  const { filas } = repartoCalculado({ presupuesto: '12000', reparto: { atl: 30, btl: 52, pos: 8, imprev: 10 } });
  const fuera = filas.filter((f) => f.fuera).map((f) => f.id);
  assert.deepEqual(fuera, ['btl', 'pos']);
  assert.ok(!filas.find((f) => f.id === 'atl').fuera, '30% en sobre la línea está bien');
});

test('los rangos del reparto dejan margen: los mínimos no pasan de 100', () => {
  const minimos = BLOQUES.reduce((a, b) => a + b.min, 0);
  assert.ok(minimos <= 100, `los mínimos suman ${minimos}%`);
  assert.ok(BLOQUES.reduce((a, b) => a + b.max, 0) >= 100, 'los máximos deben poder cubrir el total');
});

test('el presupuesto con comas o signo de pesos igual se lee', () => {
  assert.equal(porSegundo('$12,000', 30), 400);
  assert.equal(porSegundo('12000', 30), 400);
  assert.equal(porSegundo('', 30), null, 'sin presupuesto no se inventa un número');
  assert.equal(porSegundo('12000', 0), null, 'sin duración tampoco');
});

test('cada formato declara proporción usable para dibujarlo', () => {
  FORMATOS.forEach((f) => {
    assert.ok(f.w > 0 && f.h > 0, `${f.id} sin proporción`);
    assert.ok(f.para, `${f.id} no dice para qué sirve`);
  });
});


/* ============== HOJA DE GUION IMPRIMIBLE (2026-08-27) ==============
La cuenta de páginas no es cosmética: una página ≈ un minuto de pantalla es la
regla con la que se cronometra un guion antes de rodarlo. Si la cuenta miente,
el alumno llega al set con una pieza que no dura lo que creía. */

const S = await (async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../frontend/public/tools/shared/sheets.js', import.meta.url), 'utf8');
  const ventana = { PTVSheets: null };
  new Function('window', src)(ventana);
  return ventana.PTVSheets;
})();

const escenaCon = (bloques) => ({ encabezado: 'INT. SALA - DÍA', guion: bloques });

test('la hoja de guion existe y se puede pedir como cualquier otra', () => {
  assert.equal(typeof S.guion, 'function');
  assert.equal(typeof S.medidasGuion, 'function');
});

test('un guion vacío da una hoja para llenar a mano, no un error', () => {
  const html = S.guion({}, 'Proyecto');
  assert.ok(html.includes('todavía está en blanco'));
  assert.ok(html.includes('lines'), 'trae renglones para escribir a mano');
});

test('la cuenta de páginas sigue la regla del oficio: 55 renglones = 1 página', () => {
  // Un bloque de acción de una línea ocupa 1 renglón + 1 de aire; la escena
  // suma 2 por su encabezado. 55 renglones tienen que dar exactamente 1 página.
  const cfg = { escaleta: [escenaCon(Array.from({ length: 26 }, () => ({ tipo: 'accion', texto: 'x' })))] };
  const m = S.medidasGuion(cfg);
  assert.equal(m.renglones, 2 + 26 * 2, 'encabezado + cada bloque con su aire');
  assert.ok(Math.abs(m.paginas - m.renglones / 55) < 1e-9);
});

test('una línea larga cuenta los renglones que de verdad ocupa', () => {
  const corto = S.medidasGuion({ escaleta: [escenaCon([{ tipo: 'accion', texto: 'a'.repeat(30) }])] });
  const largo = S.medidasGuion({ escaleta: [escenaCon([{ tipo: 'accion', texto: 'a'.repeat(180) }])] });
  assert.ok(largo.renglones > corto.renglones, 'un párrafo largo ocupa más página');
});

test('el diálogo, más angosto, ocupa más renglones que la misma acción', () => {
  const texto = 'a'.repeat(120);
  const acc = S.medidasGuion({ escaleta: [escenaCon([{ tipo: 'accion', texto }])] });
  const dia = S.medidasGuion({ escaleta: [escenaCon([{ tipo: 'dialogo', texto }])] });
  assert.ok(dia.renglones > acc.renglones, 'la caja del diálogo es más angosta');
});

test('las escenas sin texto no cuentan: no inflan la duración', () => {
  const cfg = { escaleta: [escenaCon([{ tipo: 'accion', texto: '' }]), escenaCon([{ tipo: 'accion', texto: 'sí' }])] };
  assert.equal(S.medidasGuion(cfg).escenas, 1);
});

test('la hoja imprime el guion con las sangrías del oficio', () => {
  const cfg = { escaleta: [escenaCon([
    { tipo: 'accion', texto: 'Ana abre la bolsa.' },
    { tipo: 'personaje', texto: 'ana' },
    { tipo: 'parentesis', texto: 'bajito' },
    { tipo: 'dialogo', texto: 'No se puede disimular.' },
  ])] };
  const html = S.guion(cfg, 'Tostacruj');
  assert.ok(html.includes('gl-per'), 'personaje con su sangría');
  assert.ok(html.includes('gl-dia'), 'diálogo con la suya');
  assert.ok(html.includes('ANA'), 'el personaje va en mayúsculas');
  assert.ok(html.includes('(bajito)'), 'el paréntesis lleva sus paréntesis');
});

test('los marcatextos se imprimen: si alguien marcó algo, es porque importa', () => {
  const cfg = { escaleta: [escenaCon([
    { tipo: 'dialogo', texto: 'No se puede disimular.', marcas: [{ ini: 0, fin: 2, color: '#B8FF3C' }] },
  ])] };
  const html = S.guion(cfg, 'X');
  assert.ok(html.includes('<mark'), 'la marca sale en papel');
  assert.ok(html.includes('#B8FF3C'), 'con su color');
});

test('una marca con rangos fuera del texto no rompe la hoja', () => {
  const cfg = { escaleta: [escenaCon([
    { tipo: 'accion', texto: 'corto', marcas: [{ ini: -5, fin: 999, color: '#FFF25C' }] },
  ])] };
  assert.ok(S.guion(cfg, 'X').includes('corto'));
});

test('avisa cuando el guion no dura lo que el proyecto pidió', () => {
  const largo = { duracionObjetivoMin: 1,
    escaleta: [escenaCon(Array.from({ length: 200 }, () => ({ tipo: 'accion', texto: 'x' })))] };
  assert.ok(S.guion(largo, 'X').includes('min de más'));
});


/* ------------- Reglas de MEDIO y PÚBLICO (dónde se ve y a quién) ------------- */

test('el público se deduce de la edad escrita a mano, y ante la duda se calla', () => {
  const p = (edad, receptor = '') => publicoDe({ perfil: { edad, receptor } });
  assert.equal(p('18-25'), 'joven', 'un rango que termina antes de los 30');
  assert.equal(p('13 a 17'), 'joven');
  assert.equal(p('de 40 en adelante'), 'maduro');
  assert.equal(p('45-60'), 'maduro');
  assert.equal(p('18 a 60'), null, 'un rango que abarca a los dos no afina nada');
  // Sin números, por las palabras. Y "adulto joven" es joven.
  assert.equal(p('Jóvenes universitarios'), 'joven');
  assert.equal(p('adulto joven'), 'joven');
  assert.equal(p('Generación Z'), 'joven', 'sin acentos y con mayúsculas');
  assert.equal(p('Niños de primaria'), 'joven');
  assert.equal(p('Adultos profesionistas'), 'maduro');
  // También lee el campo "receptor", donde mucha gente pone la edad.
  assert.equal(p('', 'Estudiantes de la facultad'), 'joven');
  assert.equal(p(''), null, 'sin datos no inventa');
  assert.equal(publicoDe({}), null);
  assert.equal(publicoDe(), null);
});

const paraMedio = (medios, extra = {}) => ({
  modo: 'narrative',
  perfil: { medios, edad: '', receptor: '', ...(extra.perfil || {}) },
  escaleta: extra.escaleta || [],
  ...(extra.cfg || {}),
});
const dame = (cfg, regla) => revisar(cfg).find((a) => a.regla === regla);

test('la duración objetivo se mide contra el medio donde se va a publicar', () => {
  // 3 minutos en TikTok: arriba del tope de 100 s documentado en la ficha.
  const largo = dame(paraMedio(['TikTok'], { cfg: { duracionObjetivoSeg: 180 } }), 'duracion-medio');
  assert.equal(largo.nivel, 'error');
  assert.match(largo.problema, /TikTok/);
  assert.match(largo.accion, /15 y 50/, 'dice el rango concreto al que bajar');

  // 45 s en TikTok con público SIN definir: cae dentro del rango, no molesta.
  assert.equal(dame(paraMedio(['TikTok'], { cfg: { duracionObjetivoSeg: 45 } }), 'duracion-medio'), undefined);

  // Los mismos 45 s con público JOVEN: se apunta a la mitad baja del rango.
  const joven = dame(paraMedio(['TikTok'], {
    perfil: { edad: '15-22' }, cfg: { duracionObjetivoSeg: 45 },
  }), 'duracion-medio');
  assert.equal(joven.nivel, 'precaucion');
  assert.match(joven.problema, /joven/);

  // Y esos mismos 45 s con público maduro no dicen nada: siguen en rango.
  assert.equal(dame(paraMedio(['TikTok'], {
    perfil: { edad: '40-55' }, cfg: { duracionObjetivoSeg: 45 },
  }), 'duracion-medio'), undefined);

  // Demasiado corto también avisa.
  const corto = dame(paraMedio(['Instagram / Reels'], { cfg: { duracionObjetivoSeg: 8 } }), 'duracion-medio');
  assert.equal(corto.nivel, 'recomendacion');
  assert.match(corto.motivo, /15 y 30/);

  // Cine no tiene rango documentado: no se inventa uno.
  assert.equal(dame(paraMedio(['Cine'], { cfg: { duracionObjetivoSeg: 180 } }), 'duracion-medio'), undefined);
  // Y sin medios tampoco opina.
  assert.equal(dame(paraMedio([], { cfg: { duracionObjetivoSeg: 180 } }), 'duracion-medio'), undefined);
});

test('en formato vertical el gancho tiene que caber en los primeros segundos', () => {
  const con = (dur) => paraMedio(['TikTok'], { escaleta: [
    { id: 'a', segmento: 'Presentación larguísima', dur },
    { id: 'b', segmento: 'Desarrollo', dur: 20 },
  ] });
  const a = dame(con(14), 'gancho-medio');
  assert.equal(a.nivel, 'precaucion');
  assert.match(a.motivo, /Presentación larguísima/);
  assert.match(a.accion, /3 segundos/);
  // Un arranque corto no tiene nada de malo.
  assert.equal(dame(con(4), 'gancho-medio'), undefined);
  // En cine esta regla no aplica.
  assert.equal(dame(paraMedio(['Cine'], { escaleta: [{ id: 'a', segmento: 'Apertura', dur: 40 }] }), 'gancho-medio'), undefined);
});

test('los cortes se miden contra el medio: el feed pide más, la sala menos', () => {
  // Una sola toma de 40 s para TikTok.
  const pocos = dame(paraMedio(['TikTok'], { escaleta: [{ id: 'a', segmento: 'Todo', dur: 40 }] }), 'cortes-medio');
  assert.equal(pocos.nivel, 'recomendacion');
  assert.match(pocos.problema, /TikTok/);

  // Un segmento que se come la pieza (30 de 45 s = 66%).
  const desbalance = revisar(paraMedio(['TikTok'], { escaleta: [
    { id: 'a', segmento: 'Gancho', dur: 3 },
    { id: 'b', segmento: 'La explicación eterna', dur: 30 },
    { id: 'c', segmento: 'Cierre', dur: 12 },
  ] })).find((x) => x.id === 'cortes-desbalance');
  assert.equal(desbalance.nivel, 'precaucion');
  assert.match(desbalance.problema, /67%/, "30 de 45 s es el 67%");
  assert.match(desbalance.motivo, /La explicación eterna/);

  // Repartido parejo no dice nada.
  assert.equal(revisar(paraMedio(['TikTok'], { escaleta: [
    { id: 'a', segmento: 'Uno', dur: 12 }, { id: 'b', segmento: 'Dos', dur: 15 }, { id: 'c', segmento: 'Tres', dur: 13 },
  ] })).find((x) => x.id === 'cortes-desbalance'), undefined);

  // Una escaleta de programa (bloques de minutos) queda fuera de esta regla.
  assert.equal(dame(paraMedio(['TikTok'], { escaleta: [
    { id: 'a', segmento: 'Bloque 1', dur: 600 }, { id: 'b', segmento: 'Bloque 2', dur: 400 },
  ] }), 'cortes-medio'), undefined);
});

test('para cine, TV o streaming con público maduro la pieza puede respirar', () => {
  const escaleta = [1, 2, 3, 4, 5].map((n) => ({ id: `e${n}`, segmento: `Escena ${n}`, dur: 3 }));
  const a = dame(paraMedio(['Cine'], { perfil: { edad: '45-60' }, escaleta }), 'ritmo-medio-largo');
  assert.equal(a.nivel, 'recomendacion');
  assert.match(a.problema, /Cine/);

  // Con público joven no aplica: el ritmo rápido es suyo.
  assert.equal(dame(paraMedio(['Cine'], { perfil: { edad: '16-22' }, escaleta }), 'ritmo-medio-largo'), undefined);
  // Si además va a TikTok, tampoco: ahí manda el feed.
  assert.equal(dame(paraMedio(['Cine', 'TikTok'], { perfil: { edad: '45-60' }, escaleta }), 'ritmo-medio-largo'), undefined);
  // Y con escenas de duración normal, nada que decir.
  assert.equal(dame(paraMedio(['Cine'], { perfil: { edad: '45-60' },
    escaleta: escaleta.map((e) => ({ ...e, dur: 25 })) }), 'ritmo-medio-largo'), undefined);
});

test('avisa cuando la misma pieza va al feed y a la pantalla grande', () => {
  const a = dame(paraMedio(['TikTok', 'Cine'], { cfg: { duracionObjetivoSeg: 45 } }), 'medios-no-casan');
  assert.equal(a.nivel, 'recomendacion');
  assert.match(a.problema, /TikTok/);
  assert.match(a.problema, /Cine/);
  assert.match(a.accion, /del largo sale el corto/);
  // Solo feed, o solo pantalla grande, no es contradicción.
  assert.equal(dame(paraMedio(['TikTok']), 'medios-no-casan'), undefined);
  assert.equal(dame(paraMedio(['Cine', 'YouTube']), 'medios-no-casan'), undefined);
});

/* ------- El primer bloque de una escena en blanco tiene identidad estable -------
La escritura en el guion se aplica buscando el bloque POR SU ID. Antes, el
bloque por omisión de una escena vacía se creaba con un id al azar en cada
llamada, así que el bloque pintado y el buscado al guardar eran distintos: lo
que el usuario escribía no encontraba dónde aplicarse, se perdía, y en su lugar
quedaba un bloque vacío. Este es el caso que lo protege. */
test('el bloque por omisión de una escena vacía conserva su id entre llamadas', () => {
  const escena = { id: 'esc-1' };
  assert.equal(guionDe(escena)[0].id, guionDe(escena)[0].id, 'dos llamadas seguidas dan el mismo id');
  assert.notEqual(guionDe({ id: 'esc-1' })[0].id, guionDe({ id: 'esc-2' })[0].id, 'cada escena tiene el suyo');
  assert.equal(guionDe(escena)[0].tipo, 'accion', 'una página en blanco empieza por acción');
  assert.equal(guionDe(escena)[0].texto, '');
});

test('escribir en una escena en blanco guarda el texto, no lo tira', () => {
  // Simula lo que hace el editor: pinta, el usuario escribe, y el guardado
  // aplica el cambio buscando el bloque por su id (upGuion → upBloque).
  const escena = { id: 'esc-1', segmento: 'Escena en blanco' };
  const pintado = guionDe(escena)[0];              // lo que ve el usuario
  const guardado = guionDe(escena)                  // lo que toca el guardado
    .map((b) => (b.id === pintado.id ? { ...b, texto: 'LO QUE ESCRIBI' } : b));
  assert.equal(guardado[0].texto, 'LO QUE ESCRIBI', 'el texto encontró su bloque');
  assert.equal(guardado.length, 1);
  // Y una vez guardado, el guion existente manda sobre el bloque por omisión.
  assert.equal(guionDe({ ...escena, guion: guardado })[0].texto, 'LO QUE ESCRIBI');
});

/* ---- EL PROGRAMA DEL ENSAYO: la escaleta aplanada en una línea de tiempo ----
   Es lo que el director mira mientras el programa corre, así que tiene que
   decir la verdad en cada segundo. */

const escaleta = () => [
  { id: 's1', segmento: 'Open Show', dur: 20, fuente: 'cam1' },
  { id: 's2', segmento: 'Titulares', dur: 60, fuente: 'cam2', tomas: [
      { id: 't1', tipo: 'camara', dur: 15, alAire: 'cam2', texto: 'Titular 1 a cámara' },
      { id: 't2', tipo: 'grafico', dur: 20, alAire: 'cam3', grafico: 'Lower third' },
  ] },
  { id: 's3', segmento: 'Comerciales', dur: 30, fuente: 'corte' },
];

test('el programa aplana la escaleta: los cues mandan en el detalle, la escaleta en el total', () => {
  const { pasos, total } = construirPrograma({ escaleta: escaleta() });
  assert.equal(total, 110, 'el total es la suma de las duraciones de la escaleta');
  // Open Show · cue 1 · cue 2 · el resto de Titulares · Comerciales
  assert.deepEqual(pasos.map((p) => p.dur), [20, 15, 20, 25, 30]);
  assert.deepEqual(pasos.map((p) => p.t0), [0, 20, 35, 55, 80]);
  assert.equal(pasos[1].texto, 'Titular 1 a cámara');
  assert.equal(pasos[2].grafico, 'Lower third');
});

test('un segmento sin cues es UN paso, y lo que los cues no llenan no se pierde', () => {
  const { pasos } = construirPrograma({ escaleta: escaleta() });
  const deTitulares = pasos.filter((p) => p.segNombre === 'Titulares');
  assert.equal(deTitulares.length, 3, 'dos cues y el sobrante del segmento');
  assert.equal(deTitulares.reduce((a, p) => a + p.dur, 0), 60, 'los tres suman la duración de la escaleta');
});

test('el previo por omisión es lo que viene: lo que un director deja preparado', () => {
  const { pasos } = construirPrograma({ escaleta: escaleta() });
  assert.equal(pasos[0].previo, pasos[1].aire);
  assert.equal(pasos.at(-1).previo, '', 'el último no tiene siguiente que preparar');
});

test('pasoEn dice en qué va el programa a cada segundo, y al final se queda en el último', () => {
  const programa = construirPrograma({ escaleta: escaleta() });
  assert.equal(pasoEn(programa, 0).segNombre, 'Open Show');
  assert.equal(pasoEn(programa, 19.9).segNombre, 'Open Show');
  assert.equal(pasoEn(programa, 20).texto, 'Titular 1 a cámara', 'el corte cae en el segundo exacto');
  assert.equal(pasoEn(programa, 90).segNombre, 'Comerciales');
  assert.equal(pasoEn(programa, 999).segNombre, 'Comerciales', 'pasado el final no se sale de la lista');
  assert.equal(pasoEn(construirPrograma({ escaleta: [] }), 5), null, 'sin escaleta no hay paso');
});

test('una escaleta con duraciones en cero no tumba el programa', () => {
  const programa = construirPrograma({ escaleta: [{ id: 'x', segmento: 'Vacío', dur: 0, fuente: 'cam1' }] });
  assert.equal(programa.total, 0);
  assert.equal(programa.pasos.length, 1);
  assert.equal(pasoEn(programa, 0).segNombre, 'Vacío');
});

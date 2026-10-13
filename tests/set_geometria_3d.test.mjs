import test from "node:test";
import assert from "node:assert/strict";
import {
  acotarPuntoAlForo,
  acotarPuntoArrastrable,
  aplicarMedidasForo,
  clavesActivasDelSet,
  crearGeometriaSet,
  distanciaFocalDeCamara,
  escalaAnotacionesPlano,
  FORO_COMO_ESTABA,
  fovHorizontalDesdeFocal,
  fovVerticalDesdeFocal,
  geometriaPlano,
  medidasPantallaDelForo,
  posicionPantallaMueble,
  posicionesDefaultDelSet,
  posicionesFueraDelForo,
  puntoFueraDelForo,
  puntoPlanoAMetros,
  resguardoElementoPlano,
  traerElementosAdentro,
  zObjetivoParedPosterior,
} from "../web-sources/generador-tv/src/setGeometria.js";
import {
  instanciarSetup,
  LUZ_CATALOGO,
} from "../web-sources/generador-tv/src/iluminacion.js";

const casiIgual = (actual, esperado, tolerancia = 1e-9) => {
  assert.ok(Math.abs(actual - esperado) <= tolerancia, `${actual} no coincide con ${esperado}`);
};

function muestra() {
  const cfg = {
    talentos: [
      { id: "t1", nombre: "Conductora" },
      { id: "t2", nombre: "Invitado" },
      { id: "t3", nombre: "Analista" },
    ],
    microfonos: [
      { id: "boom1", micTipo: "boom" },
      { id: "mano1", micTipo: "mano", asignadoA: "" },
      { id: "solapa1", micTipo: "solapa", asignadoA: "tal:t1" },
      { id: "shotgun1", micTipo: "shotgun", asignadoA: "cam:c1" },
    ],
  };
  const set = {
    muebles: [
      { id: "m1", tipo: "sillon1", ocupantes: [] },
      { id: "m2", tipo: "silla", ocupantes: [] },
    ],
    setLayout: { pos: {}, rot: {} },
  };
  const cams = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
  return { cfg, set, cams };
}

test("un proyecto sin medidas conserva exactamente el lienzo legado", () => {
  const plano = geometriaPlano({ setLayout: { pos: {}, rot: {} } });
  assert.equal(plano.ancho, 980);
  assert.equal(plano.alto, 600);
  assert.equal(plano.margen, 20);
  assert.equal(plano.unidadesPorMetro, 52);
  assert.deepEqual(plano.metros, FORO_COMO_ESTABA);
  assert.deepEqual(acotarPuntoArrastrable({ x: -10, y: 900 }), { x: 48, y: 556 });
});

test("las medidas reales determinan el tamaño del lienzo a 52 unidades por metro", () => {
  const set = aplicarMedidasForo(
    { id: "foro", setLayout: { pos: {}, rot: {} } },
    { ancho: 8, fondo: 6, alto: 3 }
  );
  assert.deepEqual(set.setLayout.foro, { ancho: 8, fondo: 6, alto: 3 });
  assert.deepEqual(geometriaPlano(set), {
    ancho: 456,
    alto: 352,
    margen: 20,
    unidadesPorMetro: 52,
    metros: { ancho: 8, fondo: 6, alto: 3 },
  });
  assert.deepEqual(puntoPlanoAMetros({ x: 280, y: 228 }, set), { x: 1, z: 1 });
});

test("las anotaciones conservan su tamaño de pantalla y el foro legado usa factor uno", () => {
  const legado = { setLayout: { pos: {}, rot: {} } };
  const aula = { setLayout: { foro: { ancho: 8, fondo: 6, alto: 3 } } };
  assert.equal(escalaAnotacionesPlano(legado), 1);
  casiIgual(escalaAnotacionesPlano(aula), 456 / 980);

  // Doce unidades de tipografía terminan con los mismos píxeles aparentes:
  // factor de anotación por ampliación del viewBox reducido.
  casiIgual(12 * escalaAnotacionesPlano(aula) * (980 / 456), 12);
});

test("la pantalla respeta el ancho y la altura del foro sin cambiar el legado", () => {
  assert.deepEqual(medidasPantallaDelForo({ setLayout: {} }), {
    anchoPlano: 500,
    ancho3d: 4.95,
    escala3d: 1,
    margenLateral: 0.3,
  });

  const aula = { setLayout: { foro: { ancho: 8, fondo: 6, alto: 3 } } };
  const pantallaAula = medidasPantallaDelForo(aula);
  casiIgual(pantallaAula.anchoPlano, 7.4 * 52);
  casiIgual(pantallaAula.escala3d, 2.85 / 2.94);
  assert.ok(pantallaAula.ancho3d <= 8 - pantallaAula.margenLateral * 2);

  const estrecho = { setLayout: { foro: { ancho: 4, fondo: 6, alto: 4 } } };
  const pantallaEstrecha = medidasPantallaDelForo(estrecho);
  casiIgual(pantallaEstrecha.anchoPlano, 3.4 * 52);
  casiIgual(pantallaEstrecha.ancho3d, 3.4);
});

test("la pantalla como mueble queda dentro del cuarto y conserva la alineación histórica", () => {
  const casos = [
    ["Aula", { ancho: 8, fondo: 6, alto: 3 }],
    ["Foro chico", { ancho: 10, fondo: 8, alto: 4 }],
    ["Mínimo", { ancho: 2, fondo: 2, alto: 2.2 }],
    ["Como estaba", FORO_COMO_ESTABA],
  ];

  casos.forEach(([nombre, foro]) => {
    const set = { setLayout: { foro } };
    const escala = medidasPantallaDelForo(set).escala3d;
    const centro = puntoPlanoAMetros(posicionPantallaMueble(set), set);
    const plano = geometriaPlano(set);
    const frenteBanda = puntoPlanoAMetros({
      x: plano.ancho / 2,
      y: plano.margen + 34,
    }, set).z;
    const zMin = centro.z - 0.07 * escala;
    const zMax = centro.z + 0.31 * escala;
    const yMin = 0.005 * escala;
    const yMax = 2.92 * escala;
    const zFrente = centro.z + 0.15 * escala;

    assert.ok(zMin >= -foro.fondo / 2, `${nombre}: pantalla detrás del muro`);
    assert.ok(zMax <= foro.fondo / 2, `${nombre}: pantalla fuera del cuarto`);
    assert.ok(yMin >= 0, `${nombre}: pantalla bajo el piso`);
    assert.ok(yMax <= foro.alto, `${nombre}: pantalla sobre el techo`);
    assert.ok(Math.abs(zFrente - frenteBanda) <= 0.12, `${nombre}: no coincide con la banda 2D`);
    assert.ok(zObjetivoParedPosterior(set) >= -foro.fondo / 2, `${nombre}: luz apunta detrás del muro`);
    assert.ok(zObjetivoParedPosterior(set) <= foro.fondo / 2, `${nombre}: luz apunta fuera del cuarto`);
  });
});

test("mesa y mobiliario usan su huella completa para no atravesar los muros", () => {
  const set = {
    mesaVisible: true,
    muebles: [{ id: "sofa", tipo: "sillon3" }],
    setLayout: {
      foro: { ancho: 8, fondo: 6, alto: 3 },
      pos: { mesa: { x: 100, y: 200 }, "mue:sofa": { x: 40, y: 180 } },
      rot: { "mue:sofa": 90 },
    },
  };
  assert.deepEqual(resguardoElementoPlano("mesa", set), {
    izquierda: 110, derecha: 110, arriba: 34, abajo: 34,
  });
  const guardaSofa = resguardoElementoPlano("mue:sofa", set);
  casiIgual(guardaSofa.izquierda, 16);
  casiIgual(guardaSofa.arriba, 52);
  assert.deepEqual(posicionesFueraDelForo(set).map(([clave]) => clave), ["mesa"]);

  const corregido = traerElementosAdentro(set);
  assert.deepEqual(corregido.setLayout.pos.mesa, { x: 130, y: 200 });
  assert.deepEqual(corregido.setLayout.pos["mue:sofa"], { x: 40, y: 180 });
});

test("detectar y acotar elementos fuera del foro no altera los que ya caben", () => {
  const dentro = { x: 120, y: 90 };
  const set = {
    setLayout: {
      foro: { ancho: 8, fondo: 6, alto: 3 },
      pos: { dentro, derecha: { x: 900, y: 120 }, arriba: { x: 80, y: -5 } },
      rot: { derecha: 17 },
    },
  };
  assert.deepEqual(posicionesFueraDelForo(set).map(([clave]) => clave), ["derecha", "arriba"]);
  assert.deepEqual(acotarPuntoAlForo({ x: 900, y: -5 }, set), { x: 436, y: 20 });

  const corregido = traerElementosAdentro(set);
  assert.equal(corregido.setLayout.pos.dentro, dentro);
  assert.deepEqual(corregido.setLayout.pos.derecha, { x: 408, y: 120 });
  assert.deepEqual(corregido.setLayout.pos.arriba, { x: 80, y: 100 });
  assert.deepEqual(corregido.setLayout.rot, { derecha: 17 });
});

test("los defaults y un catálogo completo de luces caben aun en foros pequeños", () => {
  const cfg = {
    talentos: Array.from({ length: 4 }, (_, i) => ({ id: `t${i + 1}` })),
    microfonos: [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `boom${i + 1}`, micTipo: "boom" })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `suelto${i + 1}`, micTipo: "mano", asignadoA: "" })),
    ],
  };
  const cams = Array.from({ length: 4 }, (_, i) => ({ id: `c${i + 1}` }));
  const muebles = Array.from({ length: 6 }, (_, i) => ({ id: `m${i + 1}`, tipo: "silla" }));
  const casos = [
    { ancho: 8, fondo: 6, alto: 3 },
    { ancho: 10, fondo: 8, alto: 4 },
    { ancho: 2, fondo: 2, alto: 2.2 },
  ];

  casos.forEach((foro) => {
    const set = { muebles, setLayout: { foro, pos: {}, rot: {} } };
    const defaults = posicionesDefaultDelSet(cfg, set, cams);
    Object.entries(defaults).forEach(([clave, punto]) => {
      assert.equal(puntoFueraDelForo(punto, set), false, `${clave} quedó fuera en ${foro.ancho} x ${foro.fondo}`);
    });

    const setupCompleto = { required_elements: Object.keys(LUZ_CATALOGO) };
    const iluminacion = instanciarSetup(setupCompleto, defaults.mesa, set);
    Object.entries(iluminacion.pos).forEach(([clave, punto]) => {
      assert.equal(puntoFueraDelForo(punto, set), false, `${clave} quedó fuera en ${foro.ancho} x ${foro.fondo}`);
    });
  });
});

test("la detección y Traer adentro ignoran claves de elementos eliminados", () => {
  const cfg = {
    talentos: [{ id: "t1" }],
    camaras: [{ id: "c1" }],
    microfonos: [{ id: "mic1", micTipo: "boom" }],
  };
  const fuera = { x: 900, y: -5 };
  const set = {
    mesaVisible: false,
    muebles: [{ id: "m1", tipo: "silla" }],
    iluminacion: { luces: [{ id: "l1", tipo: "key_light" }] },
    setLayout: {
      foro: { ancho: 8, fondo: 6, alto: 3 },
      pos: {
        "tal:t1": fuera,
        "cam:c1": fuera,
        "mic:mic1": fuera,
        "mue:m1": fuera,
        "luz:l1": fuera,
        "tal:eliminado": fuera,
        "cam:eliminada": fuera,
        "mic:eliminado": fuera,
        mesa: fuera,
      },
      rot: { "cam:c1": 31 },
    },
  };
  const activas = clavesActivasDelSet(cfg, set);
  assert.deepEqual(
    posicionesFueraDelForo(set, activas).map(([clave]) => clave),
    ["tal:t1", "cam:c1", "mic:mic1", "mue:m1", "luz:l1"]
  );

  const corregido = traerElementosAdentro(set, activas);
  ["tal:t1", "cam:c1", "mic:mic1", "mue:m1", "luz:l1"].forEach((clave) => {
    assert.deepEqual(corregido.setLayout.pos[clave], { x: 408, y: 100 });
  });
  assert.equal(corregido.setLayout.pos["tal:eliminado"], fuera);
  assert.equal(corregido.setLayout.pos["cam:eliminada"], fuera);
  assert.equal(corregido.setLayout.pos["mic:eliminado"], fuera);
  assert.equal(corregido.setLayout.pos.mesa, fuera);
  assert.deepEqual(corregido.setLayout.rot, { "cam:c1": 31 });
});

test("cambiar el tamaño conserva el layout centrado y el viaje de vuelta es exacto", () => {
  const pos = {
    mesa: { x: 490, y: 240 },
    "cam:c1": { x: 179.9014232862428, y: 332.08483439816047 },
    "tal:eliminado": { x: 60, y: 70 },
  };
  const rot = { "cam:c1": 27 };
  const original = { setLayout: { pos, rot } };
  const chico = aplicarMedidasForo(original, { ancho: 10, fondo: 8, alto: 4 });

  assert.deepEqual(chico.setLayout.pos, {
    mesa: { x: 280, y: 168 },
    "cam:c1": { x: pos["cam:c1"].x - 210, y: pos["cam:c1"].y - 72 },
    "tal:eliminado": { x: -150, y: -2 },
  });
  assert.equal(chico.setLayout.rot, rot);

  const restaurado = aplicarMedidasForo(chico, FORO_COMO_ESTABA);
  assert.deepEqual(restaurado.setLayout.pos, pos);
  assert.equal(restaurado.setLayout.rot, rot);
});

test("la geometría compartida conserva los defaults históricos del plano 2D", () => {
  const { cfg, set, cams } = muestra();
  const posiciones = posicionesDefaultDelSet(cfg, set, cams);

  assert.deepEqual(posiciones.mesa, { x: 490, y: 240 });
  assert.deepEqual(posiciones["tal:t1"], { x: 362, y: 168 });
  assert.deepEqual(posiciones["tal:t2"], { x: 490, y: 168 });
  assert.deepEqual(posiciones["tal:t3"], { x: 618, y: 168 });
  assert.deepEqual(posiciones["mic:boom1"], { x: 645, y: 205 });
  assert.deepEqual(posiciones["mic:mano1"], { x: 215, y: 305 });
  assert.deepEqual(posiciones["mue:m1"], { x: 335, y: 330 });
  assert.deepEqual(posiciones["mue:m2"], { x: 420, y: 330 });

  const angulo = (70 * Math.PI) / 180;
  casiIgual(posiciones["cam:c1"].x, 490 - Math.sin(angulo) * 330);
  casiIgual(posiciones["cam:c1"].y, 250 + Math.cos(angulo) * 240);
  assert.deepEqual(posiciones["cam:c2"], { x: 490, y: 490 });
  casiIgual(posiciones["cam:c3"].x, 490 + Math.sin(angulo) * 330);
  casiIgual(posiciones["cam:c3"].y, 250 + Math.cos(angulo) * 240);

  const geometria = crearGeometriaSet({ cfg, set, cams });
  const camara = posiciones["cam:c1"];
  const boom = posiciones["mic:boom1"];
  casiIgual(
    geometria.rotacionDe("cam:c1", "camara"),
    (Math.atan2(posiciones.mesa.y - camara.y, posiciones.mesa.x - camara.x) * 180) / Math.PI
  );
  casiIgual(
    geometria.rotacionDe("mic:boom1", "boom"),
    (Math.atan2(posiciones.mesa.y - boom.y, posiciones.mesa.x - boom.x) * 180) / Math.PI
  );
});

test("posición viva, posición guardada y rotación manual mantienen su precedencia", () => {
  const { cfg, set, cams } = muestra();
  set.setLayout = {
    pos: { "cam:c1": { x: 120, y: 210 }, mesa: { x: 500, y: 245 } },
    rot: { "cam:c1": 17 },
  };
  const geometria = crearGeometriaSet({
    cfg,
    set,
    cams,
    live: { "cam:c1": { x: 135, y: 225 } },
    liveRot: { "cam:c1": 23 },
  });

  assert.deepEqual(geometria.posDe("cam:c1"), { x: 135, y: 225 });
  assert.deepEqual(geometria.posDe("mesa"), { x: 500, y: 245 });
  assert.equal(geometria.rotacionDe("cam:c1", "camara"), 23);
  casiIgual(
    geometria.rotacionAutomaticaDe("cam:c1", "camara"),
    (Math.atan2(245 - 225, 500 - 135) * 180) / Math.PI
  );
  assert.equal(geometria.rotacionDe("luz:fondo", "luz", "muro"), -90);
  assert.equal(geometria.rotacionDe("luz:ambiente", "luz", null), null);
});

test("las unidades SVG se convierten a metros sin desplazar el centro", () => {
  assert.deepEqual(puntoPlanoAMetros({ x: 490, y: 300 }), { x: 0, z: 0 });
  assert.deepEqual(puntoPlanoAMetros({ x: 542, y: 352 }), { x: 1, z: 1 });
});

test("la focal se lee del nombre o se deriva del tipo de plano", () => {
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM A · A7 III 13 mm", plano: "Plano medio" }), 13);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM B", plano: "Plano general" }), 24);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM C", plano: "Plano abierto" }), 24);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM D", plano: "Plano medio corto" }), 50);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM E", plano: "Primer plano" }), 85);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM F", plano: "Plano cerrado" }), 85);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM G", plano: "Detalle" }), 35);
});

test("el FOV vertical usa un sensor full-frame de 24 mm de alto", () => {
  const esperado = (2 * Math.atan(24 / (2 * 50)) * 180) / Math.PI;
  casiIgual(fovVerticalDesdeFocal(50), esperado);
  casiIgual(fovVerticalDesdeFocal(24), 53.13010235415598);
});

test("el FOV horizontal usa el ancho del mismo sensor", () => {
  casiIgual(fovHorizontalDesdeFocal(50), (2 * Math.atan(36 / 100) * 180) / Math.PI);
  casiIgual(fovHorizontalDesdeFocal(35, [24, 13.5]), (2 * Math.atan(24 / 70) * 180) / Math.PI);
});

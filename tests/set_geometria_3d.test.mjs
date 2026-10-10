import test from "node:test";
import assert from "node:assert/strict";
import {
  crearGeometriaSet,
  distanciaFocalDeCamara,
  fovVerticalDesdeFocal,
  posicionesDefaultDelSet,
  puntoPlanoAMetros,
} from "../web-sources/generador-tv/src/setGeometria.js";

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

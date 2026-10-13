import test from "node:test";
import assert from "node:assert/strict";
import { armarTextoEtiquetaCaptura } from "../web-sources/generador-tv/src/captura3d.js";
import { crearPlanoNuevoPorModo } from "../web-sources/generador-tv/src/tomas.js";

test("crear plano nuevo narrativo asigna camId y los defaults del guion técnico", () => {
  const cfg = { modo: "narrative", camaras: [{ id: "cam-1" }], extras: [] };
  assert.deepEqual(crearPlanoNuevoPorModo(cfg, "cam-2", () => "plano-nuevo"), {
    id: "plano-nuevo",
    camId: "cam-2",
    plano: "Plano Medio",
    mov: "Fija",
    audio: "",
    texto: "",
    imagen: "",
  });
});

test("crear plano nuevo en vivo produce un cue de cámara con alAire", () => {
  const cfg = {
    modo: "live",
    camaras: [{ id: "cam-1" }, { id: "cam-2" }],
    extras: [{ id: "corte", esCorte: true }],
  };
  assert.deepEqual(crearPlanoNuevoPorModo(cfg, "cam-2", () => "cue-nuevo"), {
    id: "cue-nuevo",
    tipo: "camara",
    dur: 8,
    alAire: "cam-2",
    previo: "cam-2",
    transicion: "Corte",
    audio: "",
    grafico: "",
    texto: "",
    plano: "",
    estado: "borrador",
  });
});

test("la etiqueta de captura usa los mismos redondeos y siempre muestra tilt", () => {
  assert.equal(armarTextoEtiquetaCaptura({
    camara: { nombre: "Cámara 1 principal" },
    indiceCamara: 0,
    focal: 34.2,
    fovH: 37.6,
    fovV: 21.7,
    tilt: -4.6,
  }), "CAM 1 · 34 mm · visión 38° × 22° · Tilt −5°");

  assert.equal(armarTextoEtiquetaCaptura({
    camara: { nombre: "Unidad móvil" },
    indiceCamara: 1,
    focal: 50,
    fovH: 20,
    fovV: 12,
    tilt: 0,
  }), "CAM B · 50 mm · visión 20° × 12° · Tilt 0°");
});

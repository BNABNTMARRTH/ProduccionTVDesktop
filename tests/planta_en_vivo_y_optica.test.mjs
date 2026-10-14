import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { distanciaAlBorde, elegirArribaPlanta, puntosAbanico } from "../web-sources/generador-tv/src/plantaEnVivo3d.js";
import { opticaDeEquipo } from "../web-sources/generador-tv/src/equipoCamara.js";

const catalogo = JSON.parse(readFileSync(new URL("../web-sources/generador-tv/public/modelos3d/catalogo_camaras.json", import.meta.url)));
const cuarto = { xMin: -4, xMax: 4, zMin: -2, zMax: 2 };

test("el abanico de la planta llega justo a las paredes", () => {
  assert.equal(distanciaAlBorde({ x: 0, z: 0 }, 1, 0, cuarto), 4);
  assert.equal(distanciaAlBorde({ x: 0, z: 1 }, 0, -1, cuarto), 3);
  const puntos = puntosAbanico({ x: 0, z: 0 }, 0, Math.PI / 6, cuarto);
  assert.deepEqual(puntos[0], { x: 0, z: 0 });
  puntos.slice(1).forEach((punto) => assert.ok(Math.abs(punto.x - 4) < 1e-9 || Math.abs(Math.abs(punto.z) - 2) < 1e-9));
});

test("un set ancho en un hueco alto se acuesta, con la cámara mirando hacia arriba", () => {
  const vertical = elegirArribaPlanta(cuarto, 0.75, -Math.PI / 2);
  assert.equal(vertical.acostado, true);
  const horizontal = elegirArribaPlanta(cuarto, 2, -Math.PI / 2);
  assert.equal(horizontal.acostado, false);
  assert.deepEqual([horizontal.x, horizontal.z], [0, -1]);
});

test("cada cámara lleva su lente, con adaptador cuando hace falta", () => {
  assert.equal(opticaDeEquipo(catalogo, null, "sony_fx6").lente.clave, "sony_pz_28_135");
  const adaptada = opticaDeEquipo(catalogo, { camara: "sony_fx6", lente: "canon_ef_24_105" }, "sony_fx6");
  assert.equal(adaptada.adaptador.clave, "sigma_mc11");
  assert.ok(adaptada.adaptador.largo > 0);
  Object.values(catalogo.lentes).forEach((lente) => assert.match(lente.modelo, /^lentes\/.+\.glb$/));
});

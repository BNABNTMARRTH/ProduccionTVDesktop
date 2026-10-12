import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  crearAjustesModelos3D,
  GIRO_Y_FRENTE_X_A_Z,
} from "../web-sources/generador-tv/src/ajustesModelos3d.js";

const DIRECTORIO_MODELOS = fileURLToPath(
  new URL("../web-sources/generador-tv/public/modelos3d/", import.meta.url)
);
const DIRECTORIO_MODELOS_COMPILADOS = fileURLToPath(
  new URL("../frontend/public/tools/infografias/modelos3d/", import.meta.url)
);
const MANIFIESTO = JSON.parse(readFileSync(`${DIRECTORIO_MODELOS}/modelos.json`, "utf8"));
const AJUSTES = crearAjustesModelos3D(MANIFIESTO);

const ARCHIVOS_AJENOS = [
  "ArmChair_01.glb",
  "Sofa_01.glb",
  "WoodenTable_01.glb",
  "coffee_table_round_01.glb",
  "folding_wooden_stool.glb",
  "camara_tripie.glb",
  "boom.glb",
  "fresnel.glb",
  "luz_estudio_b.glb",
  "softbox.glb",
  "sombrilla.glb",
];

function jsonDeGlb(ruta) {
  const glb = readFileSync(ruta);
  assert.equal(glb.subarray(0, 4).toString("ascii"), "glTF", `${ruta}: cabecera GLB inválida`);
  assert.equal(glb.readUInt32LE(4), 2, `${ruta}: se esperaba glTF 2`);
  const longitudJson = glb.readUInt32LE(12);
  assert.equal(glb.readUInt32LE(16), 0x4e4f534a, `${ruta}: falta el bloque JSON inicial`);
  return JSON.parse(glb.subarray(20, 20 + longitudJson).toString("utf8").trimEnd());
}

test("AJUSTES_MODELOS_3D sale completo de modelos.json y usa escala real", () => {
  assert.deepEqual(Object.keys(AJUSTES), Object.keys(MANIFIESTO));
  Object.entries(AJUSTES).forEach(([clave, ajuste]) => {
    assert.equal(ajuste.archivo, MANIFIESTO[clave].archivo, `${clave}: archivo desincronizado`);
    assert.equal(ajuste.alto, MANIFIESTO[clave].alto, `${clave}: alto duplicado o desincronizado`);
    assert.equal(ajuste.ancho, MANIFIESTO[clave].ancho, `${clave}: ancho duplicado o desincronizado`);
    assert.equal(ajuste.modoEscala, "real", `${clave}: debe conservar la escala real del GLB`);
    assert.ok(existsSync(`${DIRECTORIO_MODELOS}/${ajuste.archivo}`), `${clave}: no existe ${ajuste.archivo}`);
    assert.ok(
      existsSync(`${DIRECTORIO_MODELOS_COMPILADOS}/${ajuste.archivo}`),
      `${clave}: el build no contiene ${ajuste.archivo}`
    );
  });
  assert.equal(AJUSTES.mesa.archivo, "mesa_noticiero.glb");
  assert.equal(AJUSTES.podio.archivo, "atril.glb");
});

test("el giro de -90 grados lleva el frente +X a +Z", () => {
  assert.equal(GIRO_Y_FRENTE_X_A_Z, -90);
  Object.entries(AJUSTES).forEach(([clave, ajuste]) => {
    const angulo = ajuste.giroY * Math.PI / 180;
    const frenteGirado = { x: Math.cos(angulo), z: -Math.sin(angulo) };
    assert.ok(Math.abs(frenteGirado.x) < 1e-12, `${clave}: el frente conserva componente X`);
    assert.ok(Math.abs(frenteGirado.z - 1) < 1e-12, `${clave}: el frente no termina en +Z`);
  });
});

test("todos los GLB propios declaran EXT_meshopt_compression", () => {
  Object.entries(AJUSTES).forEach(([clave, ajuste]) => {
    const json = jsonDeGlb(`${DIRECTORIO_MODELOS}/${ajuste.archivo}`);
    assert.ok(
      json.extensionsUsed?.includes("EXT_meshopt_compression"),
      `${clave}: ${ajuste.archivo} no declara EXT_meshopt_compression`
    );
  });
});

test("CREDITOS.json y los modelos ajenos ya no se distribuyen", () => {
  [DIRECTORIO_MODELOS, DIRECTORIO_MODELOS_COMPILADOS].forEach((directorio) => {
    assert.equal(existsSync(`${directorio}/CREDITOS.json`), false, `${directorio}: queda CREDITOS.json`);
    ARCHIVOS_AJENOS.forEach((archivo) => {
      assert.equal(existsSync(`${directorio}/${archivo}`), false, `${directorio}: queda ${archivo}`);
    });
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  cambiarColorCiclorama,
  COLORES_CICLORAMA,
  crearCuartoCiclorama,
  normalizarColorCiclorama,
} from "../web-sources/generador-tv/src/ciclorama3d.js";

function hexDelMaterial(material) {
  return `#${material.color.getHexString().toUpperCase()}`;
}

test("el catálogo de ciclorama conserva el orden Verde, Azul, Blanco", () => {
  assert.deepEqual(Object.keys(COLORES_CICLORAMA), ["verde", "azul", "blanco"]);
  assert.deepEqual(
    Object.values(COLORES_CICLORAMA).map(({ etiqueta }) => etiqueta),
    ["Verde", "Azul", "Blanco"]
  );
});

test("paredes y piso usan materiales distintos con la configuración de cada color", () => {
  Object.entries(COLORES_CICLORAMA).forEach(([color, configuracion]) => {
    const ciclorama = crearCuartoCiclorama(color);
    const { materialPared, materialPiso, paredes, esquinas } = ciclorama.userData;

    assert.notEqual(materialPared, materialPiso);
    assert.equal(hexDelMaterial(materialPared), configuracion.pared);
    assert.equal(hexDelMaterial(materialPiso), configuracion.piso);
    assert.equal(materialPared.roughness, configuracion.roughness);
    assert.equal(materialPiso.roughness, configuracion.roughness);
    assert.equal(materialPared.envMapIntensity, configuracion.envMapIntensity);
    assert.equal(materialPiso.envMapIntensity, configuracion.envMapIntensity);
    assert.equal(materialPared.toneMapped, configuracion.toneMapped);
    assert.equal(materialPiso.toneMapped, configuracion.toneMapped);
    Object.values(paredes).forEach((pared) => assert.equal(pared.material, materialPared));
    Object.values(esquinas).forEach((esquina) => assert.equal(esquina.material, materialPared));
  });
});

test("un color de ciclorama desconocido cae en verde al crear y al cambiar", () => {
  assert.equal(normalizarColorCiclorama("magenta"), "verde");
  const ciclorama = crearCuartoCiclorama("magenta");
  assert.equal(ciclorama.userData.color, "verde");
  assert.equal(hexDelMaterial(ciclorama.userData.materialPared), COLORES_CICLORAMA.verde.pared);
  assert.equal(hexDelMaterial(ciclorama.userData.materialPiso), COLORES_CICLORAMA.verde.piso);

  cambiarColorCiclorama(ciclorama, "azul");
  assert.equal(ciclorama.userData.color, "azul");
  cambiarColorCiclorama(ciclorama, "guardado-desconocido");
  assert.equal(ciclorama.userData.color, "verde");
  assert.equal(hexDelMaterial(ciclorama.userData.materialPared), COLORES_CICLORAMA.verde.pared);
  assert.equal(hexDelMaterial(ciclorama.userData.materialPiso), COLORES_CICLORAMA.verde.piso);
});

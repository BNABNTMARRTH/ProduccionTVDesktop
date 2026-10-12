import * as THREE from "three";
import { medidasForo, RADIO_CICLORAMA_METROS } from "./setGeometria.js";

export const COLORES_CICLORAMA = Object.freeze({
  verde: Object.freeze({
    etiqueta: "Verde",
    pared: "#159E2B",
    piso: "#107A21",
    roughness: 0.62,
    envMapIntensity: 0.18,
    toneMapped: false,
  }),
  azul: Object.freeze({
    etiqueta: "Azul",
    pared: "#1F4FBF",
    piso: "#183C93",
    roughness: 0.62,
    envMapIntensity: 0.18,
    toneMapped: false,
  }),
  blanco: Object.freeze({
    etiqueta: "Blanco",
    pared: "#E9E9E6",
    piso: "#B4B4AE",
    roughness: 0.9,
    envMapIntensity: 0.5,
    toneMapped: true,
  }),
});

export function normalizarColorCiclorama(color) {
  return Object.prototype.hasOwnProperty.call(COLORES_CICLORAMA, color) ? color : "verde";
}

export function limitesDelCuarto(set) {
  const { ancho, fondo } = medidasForo(set);
  return {
    xMin: -ancho / 2,
    xMax: ancho / 2,
    zMin: -fondo / 2,
    zMax: fondo / 2,
  };
}

function crearMaterialCiclorama(color, superficie) {
  const material = new THREE.MeshStandardMaterial({
    color: COLORES_CICLORAMA.verde[superficie],
    metalness: 0,
    side: THREE.DoubleSide,
    fog: false,
  });
  aplicarColorAlMaterial(material, color, superficie);
  return material;
}

function aplicarColorAlMaterial(material, color, superficie) {
  const configuracion = COLORES_CICLORAMA[normalizarColorCiclorama(color)];
  material.color.set(configuracion[superficie]);
  material.roughness = configuracion.roughness;
  material.envMapIntensity = configuracion.envMapIntensity;
  material.toneMapped = configuracion.toneMapped;
  material.needsUpdate = true;
}

function crearParedConCove(largo, alto, radio, material) {
  const perfil = [{ y: alto, z: 0 }, { y: radio, z: 0 }];
  for (let i = 1; i <= 10; i += 1) {
    const angulo = Math.PI + (i / 10) * (Math.PI / 2);
    perfil.push({
      y: radio + Math.sin(angulo) * radio,
      z: radio + Math.cos(angulo) * radio,
    });
  }
  perfil.push({ y: 0, z: radio + 0.72 });
  const vertices = [];
  perfil.forEach(({ y, z }) => vertices.push(-largo / 2, y, z, largo / 2, y, z));
  const indices = [];
  for (let i = 0; i < perfil.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  const pared = new THREE.Mesh(geometria, material);
  pared.receiveShadow = true;
  return pared;
}

function crearEsquinaVertical(centroX, centroZ, inicio, radio, alto, material) {
  const segmentos = 10;
  const vertices = [];
  for (let i = 0; i <= segmentos; i += 1) {
    const angulo = inicio + (i / segmentos) * (Math.PI / 2);
    const x = centroX + Math.cos(angulo) * radio;
    const z = centroZ + Math.sin(angulo) * radio;
    vertices.push(x, 0, z, x, alto, z);
  }
  const indices = [];
  for (let i = 0; i < segmentos; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  const esquina = new THREE.Mesh(geometria, material);
  esquina.receiveShadow = true;
  return esquina;
}

function barraEntre(inicio, fin, radio, material) {
  const vector = fin.clone().sub(inicio);
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, vector.length(), 8), material);
  barra.position.copy(inicio).add(fin).multiplyScalar(0.5);
  barra.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
  return barra;
}

function crearParrilla(limites, alto) {
  const grupo = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#555B62", roughness: 0.3, metalness: 0.78 });
  const ancho = limites.xMax - limites.xMin;
  const fondo = limites.zMax - limites.zMin;
  const margen = Math.min(0.72, ancho / 4, fondo / 4);
  const y = alto - 0.18;
  const divisionesFondo = Math.max(1, Math.round((fondo - margen * 2) / 2));
  const divisionesAncho = Math.max(1, Math.round((ancho - margen * 2) / 2));
  for (let i = 0; i <= divisionesFondo; i += 1) {
    const z = limites.zMin + margen + (i / divisionesFondo) * (fondo - margen * 2);
    grupo.add(barraEntre(
      new THREE.Vector3(limites.xMin + margen, y, z),
      new THREE.Vector3(limites.xMax - margen, y, z),
      0.025,
      material
    ));
  }
  for (let i = 0; i <= divisionesAncho; i += 1) {
    const x = limites.xMin + margen + (i / divisionesAncho) * (ancho - margen * 2);
    grupo.add(barraEntre(
      new THREE.Vector3(x, y, limites.zMin + margen),
      new THREE.Vector3(x, y, limites.zMax - margen),
      0.025,
      material
    ));
  }
  return grupo;
}

export function crearCuartoCiclorama(color = "verde", set = null) {
  const colorNormalizado = normalizarColorCiclorama(color);
  const limites = limitesDelCuarto(set);
  const { alto } = medidasForo(set);
  const radio = RADIO_CICLORAMA_METROS;
  const materialPared = crearMaterialCiclorama(colorNormalizado, "pared");
  const materialPiso = crearMaterialCiclorama(colorNormalizado, "piso");
  const grupo = new THREE.Group();
  const ancho = limites.xMax - limites.xMin;
  const fondo = limites.zMax - limites.zMin;

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), materialPiso);
  piso.rotation.x = -Math.PI / 2;
  piso.position.set((limites.xMin + limites.xMax) / 2, -0.005, (limites.zMin + limites.zMax) / 2);
  piso.receiveShadow = true;
  grupo.add(piso);

  const paredes = {
    fondo: crearParedConCove(ancho - radio * 2, alto, radio, materialPared),
    frente: crearParedConCove(ancho - radio * 2, alto, radio, materialPared),
    izquierda: crearParedConCove(fondo - radio * 2, alto, radio, materialPared),
    derecha: crearParedConCove(fondo - radio * 2, alto, radio, materialPared),
  };
  paredes.fondo.position.set(0, 0, limites.zMin);
  paredes.frente.position.set(0, 0, limites.zMax);
  paredes.frente.rotation.y = Math.PI;
  paredes.izquierda.position.set(limites.xMin, 0, 0);
  paredes.izquierda.rotation.y = Math.PI / 2;
  paredes.derecha.position.set(limites.xMax, 0, 0);
  paredes.derecha.rotation.y = -Math.PI / 2;
  grupo.add(paredes.fondo, paredes.frente, paredes.izquierda, paredes.derecha);

  const esquinas = {
    fondoIzquierda: crearEsquinaVertical(limites.xMin + radio, limites.zMin + radio, Math.PI, radio, alto, materialPared),
    fondoDerecha: crearEsquinaVertical(limites.xMax - radio, limites.zMin + radio, Math.PI * 1.5, radio, alto, materialPared),
    frenteDerecha: crearEsquinaVertical(limites.xMax - radio, limites.zMax - radio, 0, radio, alto, materialPared),
    frenteIzquierda: crearEsquinaVertical(limites.xMin + radio, limites.zMax - radio, Math.PI / 2, radio, alto, materialPared),
  };
  grupo.add(...Object.values(esquinas));
  grupo.add(crearParrilla(limites, alto));
  grupo.userData = { materialPared, materialPiso, paredes, esquinas, limites, color: colorNormalizado, alto };
  return grupo;
}

export function cambiarColorCiclorama(ciclorama, color) {
  const { materialPared, materialPiso } = ciclorama?.userData || {};
  if (!materialPared || !materialPiso) return;
  const colorNormalizado = normalizarColorCiclorama(color);
  aplicarColorAlMaterial(materialPared, colorNormalizado, "pared");
  aplicarColorAlMaterial(materialPiso, colorNormalizado, "piso");
  ciclorama.userData.color = colorNormalizado;
}

export function actualizarCorteCiclorama(ciclorama, camara, modoCamara) {
  if (!ciclorama?.userData?.paredes) return;
  const { paredes, esquinas, limites } = ciclorama.userData;
  Object.values(paredes).forEach((pared) => { pared.visible = true; });
  Object.values(esquinas).forEach((esquina) => { esquina.visible = true; });
  if (modoCamara) return;

  const centroX = (limites.xMin + limites.xMax) / 2;
  const centroZ = (limites.zMin + limites.zMax) / 2;
  if (camara.position.z >= centroZ) paredes.frente.visible = false;
  else paredes.fondo.visible = false;
  if (camara.position.x > centroX + 0.08) paredes.derecha.visible = false;
  else if (camara.position.x < centroX - 0.08) paredes.izquierda.visible = false;

  esquinas.fondoIzquierda.visible = paredes.fondo.visible && paredes.izquierda.visible;
  esquinas.fondoDerecha.visible = paredes.fondo.visible && paredes.derecha.visible;
  esquinas.frenteIzquierda.visible = paredes.frente.visible && paredes.izquierda.visible;
  esquinas.frenteDerecha.visible = paredes.frente.visible && paredes.derecha.visible;
}

export function zDeParedPosterior(ciclorama) {
  return ciclorama?.userData?.limites?.zMin ?? -6.5;
}

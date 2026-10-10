import * as THREE from "three";
import { PLANO_SET } from "./setGeometria.js";

export const COLORES_CICLORAMA = Object.freeze({
  verde: "#159E2B",
  blanco: "#E9E9E6",
});

function limitesDelCuarto() {
  const { ancho, alto, margen, unidadesPorMetro } = PLANO_SET;
  const extra = 1.2;
  return {
    xMin: (margen - ancho / 2) / unidadesPorMetro - extra,
    xMax: (ancho - margen - ancho / 2) / unidadesPorMetro + extra,
    zMin: (margen - alto / 2) / unidadesPorMetro - extra,
    zMax: (alto - margen - alto / 2) / unidadesPorMetro + extra,
  };
}

function crearMaterialCiclorama(color) {
  const material = new THREE.MeshStandardMaterial({
    color: COLORES_CICLORAMA.verde,
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.18,
    side: THREE.DoubleSide,
    fog: false,
  });
  aplicarColorAlMaterial(material, color);
  return material;
}

function aplicarColorAlMaterial(material, color) {
  const esVerde = color !== "blanco";
  material.color.set(esVerde ? COLORES_CICLORAMA.verde : COLORES_CICLORAMA.blanco);
  material.roughness = esVerde ? 0.62 : 0.9;
  material.envMapIntensity = esVerde ? 0.18 : 0.5;
  material.toneMapped = !esVerde;
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
  const margen = 0.72;
  const y = alto - 0.18;
  const ancho = limites.xMax - limites.xMin;
  const fondo = limites.zMax - limites.zMin;
  for (let i = 0; i <= 5; i += 1) {
    const z = limites.zMin + margen + (i / 5) * (fondo - margen * 2);
    grupo.add(barraEntre(
      new THREE.Vector3(limites.xMin + margen, y, z),
      new THREE.Vector3(limites.xMax - margen, y, z),
      0.025,
      material
    ));
  }
  for (let i = 0; i <= 7; i += 1) {
    const x = limites.xMin + margen + (i / 7) * (ancho - margen * 2);
    grupo.add(barraEntre(
      new THREE.Vector3(x, y, limites.zMin + margen),
      new THREE.Vector3(x, y, limites.zMax - margen),
      0.025,
      material
    ));
  }
  return grupo;
}

export function crearCuartoCiclorama(color = "verde") {
  const limites = limitesDelCuarto();
  const alto = 4;
  const radio = 0.6;
  const material = crearMaterialCiclorama(color);
  const grupo = new THREE.Group();
  const ancho = limites.xMax - limites.xMin;
  const fondo = limites.zMax - limites.zMin;

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), material);
  piso.rotation.x = -Math.PI / 2;
  piso.position.set((limites.xMin + limites.xMax) / 2, -0.005, (limites.zMin + limites.zMax) / 2);
  piso.receiveShadow = true;
  grupo.add(piso);

  const paredes = {
    fondo: crearParedConCove(ancho - radio * 2, alto, radio, material),
    frente: crearParedConCove(ancho - radio * 2, alto, radio, material),
    izquierda: crearParedConCove(fondo - radio * 2, alto, radio, material),
    derecha: crearParedConCove(fondo - radio * 2, alto, radio, material),
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
    fondoIzquierda: crearEsquinaVertical(limites.xMin + radio, limites.zMin + radio, Math.PI, radio, alto, material),
    fondoDerecha: crearEsquinaVertical(limites.xMax - radio, limites.zMin + radio, Math.PI * 1.5, radio, alto, material),
    frenteDerecha: crearEsquinaVertical(limites.xMax - radio, limites.zMax - radio, 0, radio, alto, material),
    frenteIzquierda: crearEsquinaVertical(limites.xMin + radio, limites.zMax - radio, Math.PI / 2, radio, alto, material),
  };
  grupo.add(...Object.values(esquinas));
  grupo.add(crearParrilla(limites, alto));
  grupo.userData = { material, paredes, esquinas, limites, color };
  return grupo;
}

export function cambiarColorCiclorama(ciclorama, color) {
  if (!ciclorama?.userData?.material) return;
  aplicarColorAlMaterial(ciclorama.userData.material, color);
  ciclorama.userData.color = color;
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

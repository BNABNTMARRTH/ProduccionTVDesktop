import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import manifiestoModelos3D from "virtual:modelos3d-manifiesto";
import { crearAjustesModelos3D } from "./ajustesModelos3d.js";

// Ajustes de importación: todos los modelos terminan centrados en X/Z, apoyados
// en Y=0 y mirando hacia +Z, igual que la fábrica procedural.
export const AJUSTES_MODELOS_3D = crearAjustesModelos3D(manifiestoModelos3D);

const cargador = new GLTFLoader();
cargador.setMeshoptDecoder(MeshoptDecoder);
const cachePlantillas = new Map();

function rutaPublica(nombre) {
  const base = new URL(import.meta.env.BASE_URL || "./", document.baseURI);
  return new URL(`modelos3d/${nombre}`, base).href;
}

function cargarPlantilla(archivo) {
  if (!cachePlantillas.has(archivo)) {
    cachePlantillas.set(archivo, cargador.loadAsync(rutaPublica(archivo)).then((gltf) => gltf.scene));
  }
  return cachePlantillas.get(archivo);
}

function normalizarModelo(modelo, ajuste) {
  if (ajuste.modoEscala !== "real") {
    modelo.updateMatrixWorld(true);
    const cajaInicial = new THREE.Box3().setFromObject(modelo);
    const tamano = cajaInicial.getSize(new THREE.Vector3());
    const escala = ajuste.ancho
      ? ajuste.ancho / Math.max(0.0001, tamano.x)
      : ajuste.alto / Math.max(0.0001, tamano.y);
    modelo.scale.set(
      escala * (ajuste.escalaX || 1),
      escala,
      escala * (ajuste.escalaZ || 1)
    );
  }
  modelo.rotation.set(
    THREE.MathUtils.degToRad(ajuste.giroX || 0),
    THREE.MathUtils.degToRad(ajuste.giroY || 0),
    THREE.MathUtils.degToRad(ajuste.giroZ || 0)
  );
  modelo.updateMatrixWorld(true);
  const cajaFinal = new THREE.Box3().setFromObject(modelo);
  const centro = cajaFinal.getCenter(new THREE.Vector3());
  modelo.position.set(-centro.x, -cajaFinal.min.y + (ajuste.desplazamientoY || 0), -centro.z);
  modelo.updateMatrixWorld(true);
}

function prepararSombras(modelo) {
  modelo.traverse((objeto) => {
    if (!objeto.isMesh) return;
    const caja = new THREE.Box3().setFromObject(objeto);
    const tamano = caja.getSize(new THREE.Vector3());
    objeto.castShadow = Math.max(tamano.x, tamano.y, tamano.z) >= 0.18;
    objeto.receiveShadow = true;
  });
}

export async function crearModeloDescargado(ajuste) {
  const plantilla = await cargarPlantilla(ajuste.archivo);
  const modelo = plantilla.clone(true);
  normalizarModelo(modelo, ajuste);
  prepararSombras(modelo);
  const grupo = new THREE.Group();
  grupo.add(modelo);
  grupo.userData.archivoModelo = ajuste.archivo;
  grupo.userData.alturaRotulo = ajuste.alto + 0.3;
  grupo.userData.alturaHaz = ajuste.alto_trabajo;
  grupo.userData.altoLente = ajuste.alto_lente;
  return grupo;
}

export function precargarModelosDescargados(ajustes) {
  return [...new Set(ajustes.map((ajuste) => ajuste.archivo))].map((archivo) => cargarPlantilla(archivo));
}

function liberarObjeto(objeto, recursos) {
  objeto.traverse((parte) => {
    if (parte.geometry) recursos.geometrias.add(parte.geometry);
    const materiales = Array.isArray(parte.material) ? parte.material : [parte.material];
    materiales.filter(Boolean).forEach((material) => {
      recursos.materiales.add(material);
      Object.values(material).forEach((valor) => {
        if (valor?.isTexture) recursos.texturas.add(valor);
      });
    });
  });
}

export function reiniciarCacheModelosDescargados() {
  const promesas = [...cachePlantillas.values()];
  cachePlantillas.clear();
  Promise.allSettled(promesas).then((resultados) => {
    const recursos = { geometrias: new Set(), materiales: new Set(), texturas: new Set() };
    resultados.forEach((resultado) => {
      if (resultado.status === "fulfilled") liberarObjeto(resultado.value, recursos);
    });
    recursos.texturas.forEach((textura) => textura.dispose());
    recursos.materiales.forEach((material) => material.dispose());
    recursos.geometrias.forEach((geometria) => geometria.dispose());
  });
}

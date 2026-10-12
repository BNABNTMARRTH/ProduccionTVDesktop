import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MUEBLE_ASIENTOS } from "./catalogos.js";
import {
  actualizarCorteCiclorama,
  cambiarColorCiclorama,
  COLORES_CICLORAMA,
  crearCuartoCiclorama,
  normalizarColorCiclorama,
} from "./ciclorama3d.js";
import {
  crearModeloBoom,
  crearModeloCamara,
  crearModeloClaqueta,
  crearModeloLuz,
  crearModeloMicSuelto,
  crearModeloMueble,
  crearModeloPersona,
  MUEBLES_3D,
  reiniciarCacheModelos3D,
} from "./modelos3d.js";
import {
  AJUSTES_MODELOS_3D,
  cargarCreditosModelos3D,
  crearModeloDescargado,
  precargarModelosDescargados,
  reiniciarCacheModelosDescargados,
} from "./modelosDescargados3d.js";
import {
  ALTURAS_3D,
  clasificarMicrofonos,
  crearGeometriaSet,
  distanciaFocalDeCamara,
  fovVerticalDesdeFocal,
  geometriaPlano,
  medidasForo,
  medidasPantallaDelForo,
  posicionPantallaDelForo,
  puntoPlanoAMetros,
  zObjetivoParedPosterior,
} from "./setGeometria.js";
import "./visorSet3D.css";

const LENTES = [13, 18, 24, 35, 50, 85, 135];
const colorCicloramaPorSet = new Map();
let ayudaNavegacionMostrada = false;

function esPantallaCompacta() {
  if (typeof window === "undefined") return false;
  return Math.min(window.innerWidth, window.innerHeight) < 500;
}

function recortar(texto, maximo = 25) {
  const valor = String(texto || "");
  return valor.length <= maximo ? valor : `${valor.slice(0, Math.max(1, maximo - 1))}…`;
}

function dibujarRectanguloRedondeado(ctx, x, y, ancho, alto, radio) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.lineTo(x + ancho - radio, y);
  ctx.quadraticCurveTo(x + ancho, y, x + ancho, y + radio);
  ctx.lineTo(x + ancho, y + alto - radio);
  ctx.quadraticCurveTo(x + ancho, y + alto, x + ancho - radio, y + alto);
  ctx.lineTo(x + radio, y + alto);
  ctx.quadraticCurveTo(x, y + alto, x, y + alto - radio);
  ctx.lineTo(x, y + radio);
  ctx.quadraticCurveTo(x, y, x + radio, y);
  ctx.closePath();
}

function crearEtiquetaFlotante(texto, color = "#0A84FF", prioridad = 1) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 512;
  lienzo.height = 112;
  const ctx = lienzo.getContext("2d");
  dibujarRectanguloRedondeado(ctx, 7, 7, 498, 98, 20);
  ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "700 34px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(recortar(texto), 256, 57);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.minFilter = THREE.LinearFilter;
  const etiqueta = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textura,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
  }));
  etiqueta.scale.set(0.18, 0.039, 1);
  etiqueta.renderOrder = 10;
  etiqueta.userData.prioridadEtiqueta = prioridad;
  etiqueta.userData.anchoEtiqueta = Math.min(152, Math.max(72, String(texto || "").length * 6.5 + 24));
  etiqueta.userData.altoEtiqueta = 26;
  return etiqueta;
}

function crearFondoDegradado() {
  const lienzo = document.createElement("canvas");
  lienzo.width = 8;
  lienzo.height = 512;
  const ctx = lienzo.getContext("2d");
  const degradado = ctx.createLinearGradient(0, 0, 0, lienzo.height);
  degradado.addColorStop(0, "#ECEDEF");
  degradado.addColorStop(0.56, "#F5F5F5");
  degradado.addColorStop(1, "#FFFFFF");
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = THREE.LinearFilter;
  return textura;
}

function partirTexto(ctx, texto, anchoMaximo) {
  const palabras = String(texto || "").trim().split(/\s+/).filter(Boolean);
  const lineas = [];
  let linea = "";
  palabras.forEach((palabraOriginal) => {
    let palabra = palabraOriginal;
    if (ctx.measureText(palabra).width > anchoMaximo) {
      if (linea) lineas.push(linea);
      linea = "";
      let parte = "";
      [...palabra].forEach((letra) => {
        if (ctx.measureText(parte + letra).width > anchoMaximo && parte) {
          lineas.push(parte);
          parte = letra;
        } else parte += letra;
      });
      palabra = parte;
    }
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (ctx.measureText(candidata).width <= anchoMaximo) linea = candidata;
    else {
      if (linea) lineas.push(linea);
      linea = palabra;
    }
  });
  if (linea) lineas.push(linea);
  return lineas.length ? lineas : ["PANTALLA"];
}

function crearTexturaPantalla(texto) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1024;
  lienzo.height = 384;
  const ctx = lienzo.getContext("2d");
  const degradado = ctx.createLinearGradient(0, 0, lienzo.width, lienzo.height);
  degradado.addColorStop(0, "#0B1D35");
  degradado.addColorStop(1, "#07101D");
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.strokeStyle = "rgba(10, 132, 255, .42)";
  ctx.lineWidth = 7;
  ctx.strokeRect(18, 18, lienzo.width - 36, lienzo.height - 36);
  let tamano = 78;
  let lineas = [];
  while (tamano >= 5) {
    ctx.font = `750 ${tamano}px -apple-system, BlinkMacSystemFont, sans-serif`;
    lineas = partirTexto(ctx, texto || "PANTALLA", 900);
    if (lineas.length * tamano * 1.16 <= 286) break;
    tamano -= 2;
  }
  ctx.fillStyle = "#F8FAFC";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const interlinea = tamano * 1.16;
  const inicio = lienzo.height / 2 - ((lineas.length - 1) * interlinea) / 2;
  lineas.forEach((linea, indice) => ctx.fillText(linea, lienzo.width / 2, inicio + indice * interlinea));
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.minFilter = THREE.LinearFilter;
  textura.anisotropy = 2;
  return textura;
}

function crearReticula(set, exterior) {
  const { ancho, alto, margen, unidadesPorMetro } = geometriaPlano(set);
  const xMin = (margen - ancho / 2) / unidadesPorMetro;
  const xMax = (ancho - margen - ancho / 2) / unidadesPorMetro;
  const zMin = (margen - alto / 2) / unidadesPorMetro;
  const zMax = (alto - margen - alto / 2) / unidadesPorMetro;
  const vertices = [];
  for (let xSvg = margen; xSvg <= ancho - margen; xSvg += unidadesPorMetro) {
    const x = (xSvg - ancho / 2) / unidadesPorMetro;
    vertices.push(x, 0.012, zMin, x, 0.012, zMax);
  }
  for (let ySvg = margen; ySvg <= alto - margen; ySvg += unidadesPorMetro) {
    const z = (ySvg - alto / 2) / unidadesPorMetro;
    vertices.push(xMin, 0.012, z, xMax, 0.012, z);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const reticula = new THREE.LineSegments(geometria, new THREE.LineBasicMaterial({
    color: exterior ? 0x71836b : 0x718096,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  }));
  reticula.visible = true;
  return reticula;
}

function crearBarra(inicio, fin, radio, material) {
  const vector = fin.clone().sub(inicio);
  const objeto = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, vector.length(), 8), material);
  objeto.position.copy(inicio).add(fin).multiplyScalar(0.5);
  objeto.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
  return objeto;
}

function crearPantalla(texto, set) {
  const grupo = new THREE.Group();
  const materialMarco = new THREE.MeshStandardMaterial({ color: "#171A1F", roughness: 0.44, metalness: 0.32 });
  const borde = new THREE.Mesh(new THREE.BoxGeometry(4.95, 1.98, 0.12), materialMarco);
  borde.position.set(0, 1.93, 0.08);
  grupo.add(borde);
  const pantalla = new THREE.Mesh(
    new THREE.PlaneGeometry(4.75, 1.78),
    new THREE.MeshStandardMaterial({ map: crearTexturaPantalla(texto), roughness: 0.34, metalness: 0.05 })
  );
  pantalla.position.set(0, 1.93, 0.15);
  pantalla.renderOrder = 1;
  grupo.add(pantalla);
  [-1.65, 1.65].forEach((x) => {
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.0, 10), materialMarco);
    pie.position.set(x, 0.51, 0.03);
    grupo.add(pie);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.38), materialMarco);
    base.position.set(x, 0.03, 0.12);
    grupo.add(base);
  });
  const { escala3d } = medidasPantallaDelForo(set);
  const { zGrupo } = posicionPantallaDelForo(set);
  grupo.scale.setScalar(escala3d);
  grupo.position.z = zGrupo;
  return grupo;
}

function crearSuperficie(escena, cfg, set, colorCiclorama) {
  const exterior = set.locacion === "ext";
  const reticula = crearReticula(set, exterior);
  escena.add(reticula);
  let ciclorama = null;
  let pantalla = null;
  if (exterior) {
    const foro = medidasForo(set);
    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(foro.ancho, foro.fondo),
      new THREE.MeshStandardMaterial({ color: "#DCE4D5", roughness: 0.94, metalness: 0 })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.y = -0.012;
    piso.receiveShadow = true;
    escena.add(piso);
    const sol = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 8), new THREE.MeshBasicMaterial({ color: "#FFF0B8", fog: false }));
    sol.position.set(-10, 11, -18);
    escena.add(sol);
  } else {
    ciclorama = crearCuartoCiclorama(colorCiclorama, set);
    escena.add(ciclorama);
    if (String(cfg.pantalla || "").trim()) {
      pantalla = crearPantalla(cfg.pantalla, set);
      escena.add(pantalla);
    }
  }
  return { reticula, ciclorama, pantalla };
}

function posicionDeAsiento(posicionMueble, rotacion, asiento) {
  const angulo = THREE.MathUtils.degToRad(rotacion || 0);
  return {
    x: posicionMueble.x + asiento.x * Math.cos(angulo) - asiento.y * Math.sin(angulo),
    y: posicionMueble.y + asiento.x * Math.sin(angulo) + asiento.y * Math.cos(angulo),
  };
}

function orientarHaciaAngulo(objeto, rotacion) {
  objeto.rotation.y = Math.PI / 2 - THREE.MathUtils.degToRad(rotacion || 0);
}

function ubicarModelo(objeto, posicion, rotacion, orientaHacia = false, set = null) {
  const p = puntoPlanoAMetros(posicion, set);
  objeto.position.set(p.x, 0, p.z);
  if (orientaHacia) orientarHaciaAngulo(objeto, rotacion);
  else objeto.rotation.y = -THREE.MathUtils.degToRad(rotacion || 0);
  return objeto;
}

function crearCampoCamara(posicion, rotacion, color, set) {
  const p = puntoPlanoAMetros(posicion, set);
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0.03, 0, 4.3, 0.03, -1.7,
    0, 0.03, 0, 4.3, 0.03, 1.7,
    4.3, 0.03, -1.7, 4.3, 0.03, 1.7,
  ], 3));
  const lineas = new THREE.LineSegments(
    geometria,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
  );
  lineas.position.set(p.x, 0, p.z);
  orientarHaciaAngulo(lineas, rotacion);
  return lineas;
}

function crearHaz(origen, destino) {
  const desde = new THREE.Vector3(origen.x, origen.y, origen.z);
  const hasta = new THREE.Vector3(destino.x, destino.y, destino.z);
  const direccion = hasta.clone().sub(desde);
  const distancia = Math.max(0.4, direccion.length());
  direccion.normalize();
  const auxiliar = Math.abs(direccion.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const lado = new THREE.Vector3().crossVectors(direccion, auxiliar).normalize();
  const arriba = new THREE.Vector3().crossVectors(lado, direccion).normalize();
  const radio = Math.min(1.65, 0.18 + distancia * 0.2);
  const vertices = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const b = ((i + 1) / 12) * Math.PI * 2;
    const pa = hasta.clone().addScaledVector(lado, Math.cos(a) * radio).addScaledVector(arriba, Math.sin(a) * radio);
    const pb = hasta.clone().addScaledVector(lado, Math.cos(b) * radio).addScaledVector(arriba, Math.sin(b) * radio);
    vertices.push(desde.x, desde.y, desde.z, pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.computeVertexNormals();
  return new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({
    color: "#FFD08A",
    transparent: true,
    opacity: 0.055,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
}

function destinoDeHaz(luz, punto, altura, rotacion, mesa, esManual, set) {
  if (luz.forma === "top" || String(luz.tipo || "").includes("top") || rotacion === null) {
    return { x: punto.x, y: 0.05, z: punto.z };
  }
  if (luz.dir === "mesa" && !esManual) return { x: mesa.x, y: ALTURAS_3D.mesa, z: mesa.z };
  if (luz.dir === "muro" && !esManual) {
    return { x: punto.x, y: 1.35, z: zObjetivoParedPosterior(set) };
  }
  const angulo = THREE.MathUtils.degToRad(rotacion || 0);
  const largo = 4.2;
  return {
    x: punto.x + Math.cos(angulo) * largo,
    y: Math.min(ALTURAS_3D.mesa, altura * 0.45),
    z: punto.z + Math.sin(angulo) * largo,
  };
}

function agregarEtiqueta(grupo, texto, color, posicion, altura, prioridad = 1, set = null) {
  const p = puntoPlanoAMetros(posicion, set);
  const etiqueta = crearEtiquetaFlotante(texto, color, prioridad);
  etiqueta.position.set(p.x, altura, p.z);
  grupo.add(etiqueta);
}

function crearSoporteLigero(alto) {
  const grupo = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: "#3F454C", roughness: 0.32, metalness: 0.72 });
  grupo.add(crearBarra(new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0, alto, 0), 0.023, metal));
  [[-0.42, 0.28], [0.42, 0.28], [0, -0.48]].forEach(([x, z]) => {
    grupo.add(crearBarra(new THREE.Vector3(0, 0.17, 0), new THREE.Vector3(x, 0.025, z), 0.018, metal));
  });
  return grupo;
}

function decorarModeloDescargado(modelo, reemplazo) {
  if (reemplazo.clase === "camara") {
    const color = reemplazo.color || "#0A84FF";
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.32,
      roughness: 0.4,
      metalness: 0.08,
    });
    const franja = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.025), material);
    franja.position.set(0, 1.53, 0.43);
    modelo.add(franja);
    const tally = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.025), material);
    tally.position.set(0.18, 1.67, 0.36);
    modelo.add(tally);
    if (reemplazo.tieneShotgun) {
      const mic = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.035, 0.36, 4, 10),
        new THREE.MeshStandardMaterial({ color: "#171A1F", roughness: 0.88, metalness: 0.04 })
      );
      mic.rotation.x = Math.PI / 2;
      mic.position.set(0.12, 1.72, 0.18);
      modelo.add(mic);
    }
  } else if (reemplazo.clase === "fresnel") {
    modelo.add(crearSoporteLigero(1.82));
  } else if (reemplazo.clase === "cstand") {
    const esDifusor = reemplazo.luz.forma === "difusor";
    const material = new THREE.MeshStandardMaterial({
      color: esDifusor ? "#F3F2ED" : "#111317",
      roughness: esDifusor ? 0.98 : 0.9,
      metalness: 0,
      transparent: esDifusor,
      opacity: esDifusor ? 0.72 : 1,
      side: THREE.DoubleSide,
    });
    // Como en un set real: la bandera no va pegada al tubo, cuelga del extremo
    // del brazo (grip arm) que sale de la cabeza del C-stand hacia un lado.
    const metal = new THREE.MeshStandardMaterial({ color: "#B9BEC4", roughness: 0.3, metalness: 0.85 });
    // El tubo de cstand.glb no está en el centro de su caja (la base de tres
    // patas es asimétrica): medido desde arriba, queda en x −0.02, z −0.13 m.
    const tubo = { x: -0.02, z: -0.13 };
    const alturaBrazo = 1.78;
    modelo.add(crearBarra(
      new THREE.Vector3(tubo.x, alturaBrazo, tubo.z),
      new THREE.Vector3(tubo.x + 0.95, alturaBrazo, tubo.z),
      0.016,
      metal
    ));
    const bandera = new THREE.Mesh(new THREE.BoxGeometry(0.61, 0.46, 0.02), material);
    bandera.position.set(tubo.x + 0.95 + 0.305, alturaBrazo - 0.08, tubo.z);
    bandera.castShadow = !esDifusor;
    modelo.add(bandera);
  }
}

function ajusteParaLuz(luz) {
  if (luz.forma === "fresnel") return { ...AJUSTES_MODELOS_3D.fresnel, clase: "fresnel", luz };
  if (luz.forma === "panel") return { ...AJUSTES_MODELOS_3D.panel, clase: "panel", luz };
  if (luz.forma === "softbox") {
    const usaSombrilla = luz.tipo === "soft_key_light" || luz.tipo === "key_light";
    return { ...(usaSombrilla ? AJUSTES_MODELOS_3D.sombrilla : AJUSTES_MODELOS_3D.softbox), clase: "softbox", luz };
  }
  if (["flag", "control", "difusor"].includes(luz.forma)) {
    return { ...AJUSTES_MODELOS_3D.cstand, clase: "cstand", luz };
  }
  return null;
}

function hidratarModelosDescargados(reemplazos, motor, destruido) {
  const ajustes = reemplazos.map((reemplazo) => reemplazo.ajuste);
  Promise.allSettled(precargarModelosDescargados(ajustes));
  reemplazos.forEach(async (reemplazo) => {
    try {
      const modelo = await crearModeloDescargado(reemplazo.ajuste);
      if (destruido()) return;
      decorarModeloDescargado(modelo, reemplazo);
      const eraVisible = reemplazo.respaldo.visible;
      modelo.position.copy(reemplazo.respaldo.position);
      modelo.quaternion.copy(reemplazo.respaldo.quaternion);
      modelo.visible = eraVisible;
      reemplazo.respaldo.parent?.add(modelo);
      reemplazo.respaldo.visible = false;
      reemplazo.alReemplazar?.(modelo);
      motor.renderer.shadowMap.needsUpdate = true;
      motor.invalidar();
    } catch (fallo) {
      // El modelo procedural visible es el respaldo deliberado de cada descarga.
    }
  });
}

function poblarEscena(escena, cfg, set, cams, colorCiclorama) {
  const geometria = crearGeometriaSet({ cfg, set, cams });
  const { micsDeTal, shotgunDe, booms, sueltos } = clasificarMicrofonos(cfg, cams);
  const muebles = set.muebles || [];
  const talentos = cfg.talentos || [];
  const sentados = new Set(muebles.flatMap((mueble) => mueble.ocupantes || []));
  const conos = new THREE.Group();
  const campos = new THREE.Group();
  const etiquetas = new THREE.Group();
  const objetosCamara = new Map();
  const objetosEncuadre = [];
  const reemplazos = [];
  escena.add(conos, campos, etiquetas);
  const superficie = crearSuperficie(escena, cfg, set, colorCiclorama);
  if (superficie.pantalla) objetosEncuadre.push(superficie.pantalla);
  if (set.mesaVisible !== false) {
    const mesaFija = ubicarModelo(crearModeloMueble("mesa"), geometria.posDe("mesa"), 0, false, set);
    mesaFija.scale.x = 1.48;
    escena.add(mesaFija);
    objetosEncuadre.push(mesaFija);
  }
  muebles.forEach((mueble) => {
    const key = `mue:${mueble.id}`;
    const posicion = geometria.posDe(key);
    const rotacion = geometria.rotacionDe(key, "mueble");
    const respaldo = ubicarModelo(crearModeloMueble(mueble.tipo), posicion, rotacion, false, set);
    escena.add(respaldo);
    objetosEncuadre.push(respaldo);
    const ajuste = AJUSTES_MODELOS_3D[mueble.tipo];
    if (ajuste) reemplazos.push({ ajuste, respaldo, clase: "mueble" });
    const asientos = MUEBLE_ASIENTOS[mueble.tipo] || MUEBLE_ASIENTOS.sillon1;
    const medidas = MUEBLES_3D[mueble.tipo] || MUEBLES_3D.sillon1;
    (mueble.ocupantes || []).forEach((talentoId, indice) => {
      const talento = talentos.find((item) => item.id === talentoId);
      if (!talento) return;
      const posicionTalento = posicionDeAsiento(posicion, rotacion, asientos[indice % asientos.length]);
      const color = talento.color || (talento.tipo === "invitado" ? "#30D158" : "#AF52DE");
      const persona = ubicarModelo(
        crearModeloPersona({ sentada: true, alturaAsiento: medidas.asiento, color, tieneMic: micsDeTal(talento.id).length > 0 }),
        posicionTalento,
        rotacion,
        false,
        set
      );
      escena.add(persona);
      objetosEncuadre.push(persona);
      agregarEtiqueta(etiquetas, talento.nombre, color, posicionTalento, persona.userData.alturaRotulo || 1.75, 1, set);
    });
  });
  talentos.filter((talento) => !sentados.has(talento.id)).forEach((talento) => {
    const posicion = geometria.posDe(`tal:${talento.id}`);
    const color = talento.color || (talento.tipo === "invitado" ? "#30D158" : "#AF52DE");
    const persona = ubicarModelo(crearModeloPersona({ color, tieneMic: micsDeTal(talento.id).length > 0 }), posicion, 0, false, set);
    escena.add(persona);
    objetosEncuadre.push(persona);
    agregarEtiqueta(etiquetas, talento.nombre, color, posicion, persona.userData.alturaRotulo || 2.0, 1, set);
  });
  cams.forEach((camara) => {
    const key = `cam:${camara.id}`;
    const posicion = geometria.posDe(key);
    const rotacion = geometria.rotacionDe(key, "camara");
    const modelo = ubicarModelo(
      crearModeloCamara({ color: camara.color, tieneShotgun: shotgunDe(camara.id).length > 0 }),
      posicion,
      rotacion,
      true,
      set
    );
    objetosCamara.set(camara.id, modelo);
    escena.add(modelo);
    objetosEncuadre.push(modelo);
    reemplazos.push({
      ajuste: AJUSTES_MODELOS_3D.camara,
      respaldo: modelo,
      clase: "camara",
      color: camara.color,
      tieneShotgun: shotgunDe(camara.id).length > 0,
      alReemplazar: (descargado) => objetosCamara.set(camara.id, descargado),
    });
    campos.add(crearCampoCamara(posicion, rotacion, camara.color || "#0A84FF", set));
    agregarEtiqueta(etiquetas, camara.nombre, camara.color || "#0A84FF", posicion, modelo.userData.alturaRotulo || 2.1, 0, set);
  });
  booms.forEach((mic) => {
    const key = `mic:${mic.id}`;
    const posicion = geometria.posDe(key);
    const modelo = ubicarModelo(crearModeloBoom(), posicion, geometria.rotacionDe(key, "boom"), true, set);
    escena.add(modelo);
    objetosEncuadre.push(modelo);
    reemplazos.push({ ajuste: AJUSTES_MODELOS_3D.boom, respaldo: modelo, clase: "boom" });
    agregarEtiqueta(etiquetas, `${mic.nombre} · boom`, "#1FA14E", posicion, modelo.userData.alturaRotulo || 2.45, 2, set);
  });
  sueltos.forEach((mic) => {
    const modelo = ubicarModelo(crearModeloMicSuelto(mic.micTipo), geometria.posDe(`mic:${mic.id}`), 0, false, set);
    escena.add(modelo);
    objetosEncuadre.push(modelo);
  });
  const mesa = puntoPlanoAMetros(geometria.posDe("mesa"), set);
  // En el plano 2D una luz es un icono chico; en 3D, a tamaño real, dos
  // soportes casi en el mismo punto se atraviesan. Solo aquí se separan lo
  // justo para que cada pie tenga su lugar (el plano guardado no cambia).
  const piesOcupados = [];
  const SEPARACION_PIES = 0.8;
  (set.iluminacion?.luces || []).forEach((luz) => {
    const key = `luz:${luz.id}`;
    const posicion = geometria.posDe(key);
    const punto = puntoPlanoAMetros(posicion, set);
    piesOcupados.forEach((otro) => {
      const dx = punto.x - otro.x, dz = punto.z - otro.z, d = Math.hypot(dx, dz);
      if (d >= SEPARACION_PIES) return;
      const ux = d > 0.001 ? dx / d : 1, uz = d > 0.001 ? dz / d : 0;
      punto.x = otro.x + ux * SEPARACION_PIES;
      punto.z = otro.z + uz * SEPARACION_PIES;
    });
    piesOcupados.push({ x: punto.x, z: punto.z });
    const rotacion = geometria.rotacionDe(key, "luz", luz.dir);
    const modelo = ubicarModelo(crearModeloLuz(luz), posicion, rotacion, true, set);
    modelo.position.set(punto.x, 0, punto.z);
    escena.add(modelo);
    objetosEncuadre.push(modelo);
    const ajuste = ajusteParaLuz(luz);
    if (ajuste) reemplazos.push({ ajuste, respaldo: modelo, clase: ajuste.clase, luz });
    const altura = modelo.userData.alturaHaz || ALTURAS_3D.luz;
    conos.add(crearHaz(
      { x: punto.x, y: altura, z: punto.z },
      destinoDeHaz(luz, punto, altura, rotacion, mesa, typeof geometria.giroManualDe(key) === "number", set)
    ));
  });
  if (cams.length) {
    const posicion = puntoPlanoAMetros(geometria.posDe(`cam:${cams[0].id}`), set);
    const claqueta = crearModeloClaqueta();
    claqueta.position.set(posicion.x + 0.72, 0, posicion.z + 0.52);
    claqueta.rotation.y = -0.35;
    escena.add(claqueta);
    objetosEncuadre.push(claqueta);
    reemplazos.push({ ajuste: AJUSTES_MODELOS_3D.claqueta, respaldo: claqueta, clase: "claqueta" });
  }
  return {
    geometria,
    conos,
    campos,
    reticula: superficie.reticula,
    ciclorama: superficie.ciclorama,
    etiquetas,
    objetosCamara,
    objetosEncuadre,
    reemplazos,
  };
}

function liberarEscena(escena) {
  const geometrias = new Set();
  const materiales = new Set();
  const texturas = new Set();
  escena.traverse((objeto) => {
    if (objeto.geometry) geometrias.add(objeto.geometry);
    const lista = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
    lista.filter(Boolean).forEach((material) => {
      materiales.add(material);
      Object.values(material).forEach((valor) => {
        if (valor?.isTexture) texturas.add(valor);
      });
    });
  });
  texturas.forEach((textura) => textura.dispose());
  materiales.forEach((material) => material.dispose());
  geometrias.forEach((geometria) => geometria.dispose());
}

function nombreCortoCamara(camara, indice) {
  const encontrada = String(camara.nombre || "").match(/CAM(?:ARA)?\s+[A-Z0-9]+/i);
  return encontrada ? encontrada[0].toUpperCase().replace("CAMARA", "CAM") : `CAM ${String.fromCharCode(65 + indice)}`;
}

function cajaDeEncuadreDelSet(objetos = [], set = null) {
  const foro = medidasForo(set);
  const caja = new THREE.Box3();
  caja.set(
    new THREE.Vector3(-foro.ancho / 2, 0, -foro.fondo / 2),
    new THREE.Vector3(foro.ancho / 2, foro.alto, foro.fondo / 2)
  );
  objetos.forEach((objeto) => {
    objeto.updateWorldMatrix(true, true);
    caja.expandByObject(objeto);
  });
  const centro = caja.getCenter(new THREE.Vector3());
  const tamano = caja.getSize(new THREE.Vector3());
  const medioX = Math.max(3.2, tamano.x / 2 + 0.7);
  const medioZ = Math.max(2.6, tamano.z / 2 + 0.7);
  caja.min.set(centro.x - medioX, 0, centro.z - medioZ);
  caja.max.set(centro.x + medioX, Math.max(2.6, caja.max.y + 0.18), centro.z + medioZ);
  return caja;
}

function esquinasDeCaja(caja) {
  const { min, max } = caja;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

function encuadrarSet(motor, vista = "perspectiva", conservarDireccion = false) {
  if (!motor || motor.modoCamara) return;
  const { camara, controles, cajaEncuadre } = motor;
  const centro = cajaEncuadre.getCenter(new THREE.Vector3());
  let direccion;
  if (conservarDireccion) {
    direccion = camara.position.clone().sub(controles.target).normalize();
    if (direccion.lengthSq() < 0.001) direccion = null;
  }
  if (!direccion) {
    direccion = vista === "planta"
      ? new THREE.Vector3(0, 1, 0.0001).normalize()
      : new THREE.Vector3(1.08, 0.78, 1).normalize();
  }
  camara.up.set(0, vista === "planta" ? 0 : 1, vista === "planta" ? -1 : 0);
  camara.position.copy(centro).add(direccion);
  camara.lookAt(centro);
  camara.updateMatrixWorld(true);

  const derecha = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 0).normalize();
  const arriba = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 1).normalize();
  const adelante = direccion.clone().multiplyScalar(-1);
  const tangenteVertical = Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2);
  const tangenteHorizontal = tangenteVertical * camara.aspect;
  let distancia = 2;
  esquinasDeCaja(cajaEncuadre).forEach((esquina) => {
    const desplazamiento = esquina.sub(centro);
    const profundidad = desplazamiento.dot(adelante);
    distancia = Math.max(
      distancia,
      Math.abs(desplazamiento.dot(derecha)) / tangenteHorizontal - profundidad,
      Math.abs(desplazamiento.dot(arriba)) / tangenteVertical - profundidad
    );
  });
  distancia = distancia * 1.08 + 0.28;
  camara.position.copy(centro).addScaledVector(direccion, distancia);
  controles.target.copy(centro);
  controles.maxDistance = Math.max(31, distancia * 2.5);
  controles.update();
  motor.vistaOrbita = vista;
}

function rectangulosSeCruzan(a, b) {
  return a.izquierda < b.derecha
    && a.derecha > b.izquierda
    && a.arriba < b.abajo
    && a.abajo > b.arriba;
}

function distribuirEtiquetas(etiquetas, camara, ancho, alto, mostrar) {
  etiquetas.visible = mostrar;
  if (!mostrar) return;
  camara.updateMatrixWorld(true);
  etiquetas.updateMatrixWorld(true);
  const posicion = new THREE.Vector3();
  const candidatos = etiquetas.children
    .map((etiqueta) => {
      etiqueta.getWorldPosition(posicion);
      const pantalla = posicion.clone().project(camara);
      const anchoEtiqueta = etiqueta.userData.anchoEtiqueta || 96;
      const altoEtiqueta = etiqueta.userData.altoEtiqueta || 26;
      const x = (pantalla.x * 0.5 + 0.5) * ancho;
      const y = (-pantalla.y * 0.5 + 0.5) * alto;
      return {
        etiqueta,
        profundidad: pantalla.z,
        prioridad: etiqueta.userData.prioridadEtiqueta ?? 1,
        rectangulo: {
          izquierda: x - anchoEtiqueta / 2 - 3,
          derecha: x + anchoEtiqueta / 2 + 3,
          arriba: y - altoEtiqueta / 2 - 3,
          abajo: y + altoEtiqueta / 2 + 3,
        },
      };
    })
    .sort((a, b) => a.prioridad - b.prioridad || a.profundidad - b.profundidad);
  const ocupados = [];
  candidatos.forEach((candidato) => {
    const { rectangulo } = candidato;
    const dentro = candidato.profundidad >= -1 && candidato.profundidad <= 1
      && rectangulo.derecha > 0 && rectangulo.izquierda < ancho
      && rectangulo.abajo > 0 && rectangulo.arriba < alto;
    const libre = dentro && !ocupados.some((ocupado) => rectangulosSeCruzan(rectangulo, ocupado));
    candidato.etiqueta.visible = libre;
    if (libre) ocupados.push(rectangulo);
  });
}

export default function VisorSet3D({ cfg, set, cams = [], onClose }) {
  const hostRef = useRef(null);
  const panelRef = useRef(null);
  const capasRef = useRef(null);
  const camarasRef = useRef(null);
  const lentesRef = useRef(null);
  const motorRef = useRef(null);
  const [error, setError] = useState("");
  const [mostrarConos, setMostrarConos] = useState(true);
  const [mostrarCampos, setMostrarCampos] = useState(true);
  const [mostrarReticula, setMostrarReticula] = useState(true);
  const [mostrarNombres, setMostrarNombres] = useState(() => !esPantallaCompacta());
  const [esCompacto, setEsCompacto] = useState(esPantallaCompacta);
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  const [lentesAbiertos, setLentesAbiertos] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(() => !ayudaNavegacionMostrada);
  const [camaraActivaId, setCamaraActivaId] = useState(null);
  const [focal, setFocal] = useState(35);
  const [colorCiclorama, setColorCiclorama] = useState(
    () => normalizarColorCiclorama(colorCicloramaPorSet.get(set.id))
  );
  const [creditosAbiertos, setCreditosAbiertos] = useState(false);
  const [creditos, setCreditos] = useState(null);
  const [errorCreditos, setErrorCreditos] = useState("");
  const camaraActiva = useMemo(
    () => cams.find((camara) => camara.id === camaraActivaId) || null,
    [cams, camaraActivaId]
  );

  useEffect(() => {
    const alTeclado = (evento) => {
      if (evento.key !== "Escape") return;
      if (creditosAbiertos) setCreditosAbiertos(false);
      else if (lentesAbiertos) setLentesAbiertos(false);
      else if (capasAbiertas) setCapasAbiertas(false);
      else onClose();
    };
    window.addEventListener("keydown", alTeclado);
    panelRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", alTeclado);
  }, [capasAbiertas, creditosAbiertos, lentesAbiertos, onClose]);

  useEffect(() => {
    const revisarTamano = () => setEsCompacto(esPantallaCompacta());
    window.addEventListener("resize", revisarTamano);
    window.visualViewport?.addEventListener("resize", revisarTamano);
    return () => {
      window.removeEventListener("resize", revisarTamano);
      window.visualViewport?.removeEventListener("resize", revisarTamano);
    };
  }, []);

  useEffect(() => {
    if (!mostrarAyuda) return undefined;
    ayudaNavegacionMostrada = true;
    const temporizador = window.setTimeout(() => setMostrarAyuda(false), 3000);
    return () => window.clearTimeout(temporizador);
  }, [mostrarAyuda]);

  useEffect(() => {
    if (!capasAbiertas) return undefined;
    const cerrarFuera = (evento) => {
      if (!capasRef.current?.contains(evento.target)) setCapasAbiertas(false);
    };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, [capasAbiertas]);

  useEffect(() => {
    if (!lentesAbiertos) return undefined;
    const cerrarFuera = (evento) => {
      if (!lentesRef.current?.contains(evento.target)) setLentesAbiertos(false);
    };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, [lentesAbiertos]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    let frame = null;
    let observador;
    let destruido = false;
    let entorno;
    const lienzo = document.createElement("canvas");
    try {
      const atributos = { antialias: true, alpha: false, powerPreference: "high-performance" };
      const contexto = lienzo.getContext("webgl2", atributos) || lienzo.getContext("webgl", atributos);
      if (!contexto) throw new Error("WebGL no está disponible");
      renderer = new THREE.WebGLRenderer({ canvas: lienzo, context: contexto, antialias: true, powerPreference: "high-performance" });
    } catch (fallo) {
      setError("Este dispositivo no pudo iniciar la vista 3D. El plano 2D sigue disponible para trabajar.");
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    host.replaceChildren(renderer.domElement);
    const escena = new THREE.Scene();
    const fondo = crearFondoDegradado();
    escena.background = fondo;
    escena.fog = new THREE.Fog(0xf5f5f4, 21, 39);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const sala = new RoomEnvironment();
    entorno = pmrem.fromScene(sala, 0.04);
    escena.environment = entorno.texture;
    sala.dispose();
    pmrem.dispose();
    const camara = new THREE.PerspectiveCamera(45, 1, 0.05, 80);
    camara.position.set(9.4, 7.1, 11.2);
    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.set(0, 0.92, -0.4);
    controles.enableDamping = false;
    controles.enablePan = true;
    controles.screenSpacePanning = true;
    controles.minDistance = 2.0;
    controles.maxDistance = 31;
    controles.maxPolarAngle = Math.PI / 2 - 0.018;
    controles.update();
    escena.add(new THREE.HemisphereLight(0xffffff, 0xbfc4c8, 1.18));
    const luzClave = new THREE.DirectionalLight(0xfff7ed, 2.35);
    luzClave.position.set(8, 12, 7);
    luzClave.castShadow = true;
    luzClave.shadow.mapSize.set(1536, 1536);
    luzClave.shadow.camera.left = -11;
    luzClave.shadow.camera.right = 11;
    luzClave.shadow.camera.top = 9;
    luzClave.shadow.camera.bottom = -9;
    luzClave.shadow.camera.near = 1;
    luzClave.shadow.camera.far = 34;
    luzClave.shadow.bias = -0.00035;
    luzClave.shadow.normalBias = 0.018;
    luzClave.target.position.set(0, 0, -0.6);
    escena.add(luzClave, luzClave.target);
    const contenido = poblarEscena(escena, cfg, set, cams, colorCiclorama);
    renderer.shadowMap.needsUpdate = true;

    const calcularMarco = () => {
      const ancho = Math.max(1, host.clientWidth);
      const alto = Math.max(1, host.clientHeight);
      const rectHost = host.getBoundingClientRect();
      const rectCamaras = camarasRef.current?.getBoundingClientRect();
      const limiteInferior = rectCamaras
        ? Math.min(alto, Math.max(1, rectCamaras.top - rectHost.top))
        : alto;
      const margen = Math.min(ancho, alto) < 500 ? 6 : 12;
      const disponible = Math.max(1, limiteInferior - margen * 2);
      const anchoMarco = Math.max(1, Math.min(ancho - margen * 2, disponible * (16 / 9)));
      const altoMarco = anchoMarco * (9 / 16);
      const x = (ancho - anchoMarco) / 2;
      const y = margen + (disponible - altoMarco) / 2;
      panelRef.current?.style.setProperty("--marco-x", `${x}px`);
      panelRef.current?.style.setProperty("--marco-y", `${y}px`);
      panelRef.current?.style.setProperty("--marco-ancho", `${anchoMarco}px`);
      panelRef.current?.style.setProperty("--marco-alto", `${altoMarco}px`);
      return { x, y, ancho: anchoMarco, alto: altoMarco, altoTotal: alto };
    };
    const invalidar = () => {
      if (destruido || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const ancho = Math.max(1, host.clientWidth);
        const alto = Math.max(1, host.clientHeight);
        const motor = motorRef.current;
        actualizarCorteCiclorama(contenido.ciclorama, camara, motor?.modoCamara);
        distribuirEtiquetas(contenido.etiquetas, camara, ancho, alto, Boolean(motor?.mostrarNombres && !motor.modoCamara));
        if (motor?.modoCamara) {
          const marco = calcularMarco();
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, ancho, alto);
          renderer.setClearColor(0x090d12, 1);
          renderer.clear();
          renderer.setViewport(marco.x, marco.altoTotal - marco.y - marco.alto, marco.ancho, marco.alto);
          renderer.setScissor(marco.x, marco.altoTotal - marco.y - marco.alto, marco.ancho, marco.alto);
          renderer.setScissorTest(true);
          renderer.render(escena, camara);
          renderer.setScissorTest(false);
        } else {
          renderer.setViewport(0, 0, ancho, alto);
          renderer.setScissorTest(false);
          renderer.render(escena, camara);
        }
      });
    };
    const ajustar = (reencuadrar = false) => {
      if (destruido) return;
      const ancho = Math.max(1, host.clientWidth);
      const alto = Math.max(1, host.clientHeight);
      renderer.setSize(ancho, alto, false);
      calcularMarco();
      camara.aspect = motorRef.current?.modoCamara ? 16 / 9 : ancho / alto;
      camara.updateProjectionMatrix();
      if (reencuadrar && motorRef.current && !motorRef.current.modoCamara) {
        encuadrarSet(motorRef.current, motorRef.current.vistaOrbita, true);
      }
      invalidar();
    };
    const alRedimensionar = () => ajustar(true);
    const contextoPerdido = (evento) => {
      evento.preventDefault();
      setError("La vista 3D perdió el contexto gráfico. Cierra el visor y vuelve a abrirlo para continuar.");
    };
    const contextoRestaurado = () => {
      setError("");
      renderer.shadowMap.needsUpdate = true;
      ajustar(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextoPerdido, false);
    renderer.domElement.addEventListener("webglcontextrestored", contextoRestaurado, false);
    controles.addEventListener("change", invalidar);
    if (typeof ResizeObserver === "function") {
      observador = new ResizeObserver(alRedimensionar);
      observador.observe(host);
      if (camarasRef.current) observador.observe(camarasRef.current);
    } else window.addEventListener("resize", alRedimensionar);
    const motor = {
      renderer,
      escena,
      camara,
      controles,
      invalidar,
      ajustar,
      geometria: contenido.geometria,
      conos: contenido.conos,
      campos: contenido.campos,
      reticula: contenido.reticula,
      ciclorama: contenido.ciclorama,
      etiquetas: contenido.etiquetas,
      objetosCamara: contenido.objetosCamara,
      cajaEncuadre: cajaDeEncuadreDelSet(contenido.objetosEncuadre, set),
      estadoOrbita: null,
      modoCamara: false,
      mostrarNombres,
      vistaOrbita: "perspectiva",
    };
    motorRef.current = motor;
    hidratarModelosDescargados(contenido.reemplazos, motor, () => destruido);
    ajustar();
    encuadrarSet(motor, "perspectiva", false);
    invalidar();
    return () => {
      destruido = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observador?.disconnect();
      window.removeEventListener("resize", alRedimensionar);
      controles.removeEventListener("change", invalidar);
      controles.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextoPerdido);
      renderer.domElement.removeEventListener("webglcontextrestored", contextoRestaurado);
      escena.background = null;
      escena.environment = null;
      fondo.dispose();
      entorno?.dispose();
      liberarEscena(escena);
      reiniciarCacheModelos3D();
      reiniciarCacheModelosDescargados();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      motorRef.current = null;
    };
  }, [cfg, set, cams]);

  useEffect(() => {
    const motor = motorRef.current;
    if (!motor?.ciclorama) return;
    cambiarColorCiclorama(motor.ciclorama, colorCiclorama);
    motor.renderer.shadowMap.needsUpdate = true;
    motor.invalidar();
  }, [colorCiclorama]);

  useEffect(() => {
    const motor = motorRef.current;
    if (!motor) return;
    motor.conos.visible = mostrarConos && !motor.modoCamara;
    motor.campos.visible = mostrarCampos && !motor.modoCamara;
    motor.reticula.visible = mostrarReticula && !motor.modoCamara;
    motor.mostrarNombres = mostrarNombres;
    motor.invalidar();
  }, [mostrarCampos, mostrarConos, mostrarNombres, mostrarReticula]);

  useEffect(() => {
    const motor = motorRef.current;
    if (!motor || !camaraActiva) return;
    motor.camara.fov = fovVerticalDesdeFocal(focal);
    motor.camara.aspect = 16 / 9;
    motor.camara.updateProjectionMatrix();
    motor.ajustar();
  }, [camaraActiva, focal]);

  const volverAOrbita = () => {
    const motor = motorRef.current;
    if (!motor) return;
    motor.modoCamara = false;
    motor.controles.enabled = true;
    motor.camara.fov = 45;
    motor.etiquetas.visible = mostrarNombres;
    motor.conos.visible = mostrarConos;
    motor.campos.visible = mostrarCampos;
    motor.reticula.visible = mostrarReticula;
    motor.objetosCamara.forEach((objeto) => { objeto.visible = true; });
    if (motor.estadoOrbita) {
      motor.camara.position.copy(motor.estadoOrbita.posicion);
      motor.camara.up.copy(motor.estadoOrbita.arriba);
      motor.controles.target.copy(motor.estadoOrbita.blanco);
      motor.vistaOrbita = motor.estadoOrbita.vista;
      motor.controles.update();
    } else {
      motor.camara.aspect = Math.max(1, motor.renderer.domElement.clientWidth)
        / Math.max(1, motor.renderer.domElement.clientHeight);
      motor.camara.updateProjectionMatrix();
      encuadrarSet(motor, "perspectiva", false);
    }
    motor.estadoOrbita = null;
    setLentesAbiertos(false);
    setCamaraActivaId(null);
    motor.ajustar();
  };

  const aplicarVista = (vista) => {
    const motor = motorRef.current;
    if (!motor) return;
    setCapasAbiertas(false);
    if (motor.modoCamara) volverAOrbita();
    motor.controles.enabled = true;
    motor.camara.fov = 45;
    motor.camara.aspect = Math.max(1, motor.renderer.domElement.clientWidth)
      / Math.max(1, motor.renderer.domElement.clientHeight);
    motor.camara.updateProjectionMatrix();
    encuadrarSet(motor, vista, false);
    motor.invalidar();
  };

  const verDesdeCamara = (camaraSeleccionada) => {
    const motor = motorRef.current;
    if (!motor) return;
    setCapasAbiertas(false);
    if (!motor.modoCamara) {
      motor.estadoOrbita = {
        posicion: motor.camara.position.clone(),
        arriba: motor.camara.up.clone(),
        blanco: motor.controles.target.clone(),
        vista: motor.vistaOrbita,
      };
    }
    const key = `cam:${camaraSeleccionada.id}`;
    const punto = puntoPlanoAMetros(motor.geometria.posDe(key), set);
    const rotacion = motor.geometria.rotacionDe(key, "camara");
    const angulo = THREE.MathUtils.degToRad(rotacion || 0);
    const focalInicial = distanciaFocalDeCamara(camaraSeleccionada);
    motor.modoCamara = true;
    motor.controles.enabled = false;
    motor.etiquetas.visible = false;
    motor.conos.visible = false;
    motor.campos.visible = false;
    motor.reticula.visible = false;
    motor.objetosCamara.forEach((objeto, id) => { objeto.visible = id !== camaraSeleccionada.id; });
    motor.camara.up.set(0, 1, 0);
    motor.camara.position.set(punto.x, ALTURAS_3D.lenteCamara, punto.z);
    motor.camara.lookAt(
      punto.x + Math.cos(angulo) * 10,
      ALTURAS_3D.lenteCamara,
      punto.z + Math.sin(angulo) * 10
    );
    motor.camara.aspect = 16 / 9;
    motor.camara.fov = fovVerticalDesdeFocal(focalInicial);
    motor.camara.updateProjectionMatrix();
    setFocal(focalInicial);
    setLentesAbiertos(false);
    setCamaraActivaId(camaraSeleccionada.id);
    motor.ajustar();
  };

  const elegirColorCiclorama = (color) => {
    colorCicloramaPorSet.set(set.id, color);
    setColorCiclorama(color);
  };

  const abrirCreditos = async () => {
    setCapasAbiertas(false);
    setCreditosAbiertos(true);
    if (creditos || errorCreditos) return;
    try {
      setCreditos(await cargarCreditosModelos3D());
    } catch (fallo) {
      setErrorCreditos("No se pudo leer la lista de créditos incluida con los modelos.");
    }
  };

  return (
    <section
      ref={panelRef}
      className={`visor-set-3d${esCompacto ? " visor-set-3d--compacto" : ""}`}
      aria-label="Vista 3D del plano del set"
      tabIndex={-1}
    >
      <div ref={hostRef} className="visor-set-3d__lienzo" aria-hidden="true" />
      <div className="visor-set-3d__superior-izquierda visor-set-3d__vidrio">
        <button type="button" className="visor-set-3d__cerrar" onClick={onClose} aria-label="Cerrar vista 3D">
          <span aria-hidden="true">×</span>
        </button>
        <strong>Vista 3D</strong>
      </div>
      <div ref={capasRef} className="visor-set-3d__superior-derecha">
        <div className="visor-set-3d__vistas visor-set-3d__vidrio" role="toolbar" aria-label="Vistas y capas">
          <button type="button" onClick={() => aplicarVista("planta")}>Planta</button>
          <button type="button" onClick={() => aplicarVista("perspectiva")}>Perspectiva</button>
          {/* Atajo directo: las etiquetas se prenden y apagan seguido, no van
              escondidas en Capas (el interruptor de allá sigue en sincronía). */}
          <button
            type="button"
            className={mostrarNombres ? "activo" : ""}
            aria-pressed={mostrarNombres}
            onClick={() => setMostrarNombres((valor) => !valor)}
          >
            Etiquetas
          </button>
          <button
            type="button"
            className={capasAbiertas ? "activo" : ""}
            aria-expanded={capasAbiertas}
            aria-controls="visor-set-3d-capas"
            onClick={() => setCapasAbiertas((valor) => !valor)}
          >
            … Capas
          </button>
        </div>
        {capasAbiertas && (
          <aside id="visor-set-3d-capas" className="visor-set-3d__capas visor-set-3d__vidrio" aria-label="Capas de la vista 3D">
            <button type="button" className="visor-set-3d__capa" aria-pressed={mostrarReticula} onClick={() => setMostrarReticula((valor) => !valor)}>
              <span>Retícula</span><i className={mostrarReticula ? "activo" : ""} aria-hidden="true" />
            </button>
            <button type="button" className="visor-set-3d__capa" aria-pressed={mostrarConos} onClick={() => setMostrarConos((valor) => !valor)}>
              <span>Conos de luz</span><i className={mostrarConos ? "activo" : ""} aria-hidden="true" />
            </button>
            <button type="button" className="visor-set-3d__capa" aria-pressed={mostrarCampos} onClick={() => setMostrarCampos((valor) => !valor)}>
              <span>Campo de cámaras</span><i className={mostrarCampos ? "activo" : ""} aria-hidden="true" />
            </button>
            <button type="button" className="visor-set-3d__capa" aria-pressed={mostrarNombres} onClick={() => setMostrarNombres((valor) => !valor)}>
              <span>Nombres</span><i className={mostrarNombres ? "activo" : ""} aria-hidden="true" />
            </button>
            {set.locacion !== "ext" && (
              <div className="visor-set-3d__ciclorama" role="group" aria-label="Color del ciclorama">
                <span>Ciclorama</span>
                <div>
                  {Object.entries(COLORES_CICLORAMA).map(([color, { etiqueta }]) => {
                    const activo = colorCiclorama === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        className={activo ? `activo ${color}` : ""}
                        aria-pressed={activo}
                        onClick={() => elegirColorCiclorama(color)}
                      >
                        {etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button type="button" className="visor-set-3d__abrir-creditos" onClick={abrirCreditos}>Créditos 3D</button>
          </aside>
        )}
      </div>
      {creditosAbiertos && (
        <aside className="visor-set-3d__creditos" role="dialog" aria-modal="true" aria-label="Créditos de modelos 3D">
          <div className="visor-set-3d__creditos-cabecera">
            <div>
              <span>MODELOS DESCARGADOS</span>
              <strong>Créditos 3D</strong>
            </div>
            <button type="button" onClick={() => setCreditosAbiertos(false)} aria-label="Cerrar créditos">Cerrar</button>
          </div>
          {errorCreditos && <p>{errorCreditos}</p>}
          {!creditos && !errorCreditos && <p>Cargando créditos…</p>}
          {creditos && (
            <ul>
              {creditos.map((credito) => (
                <li key={credito.archivo}>
                  <a href={credito.url} target="_blank" rel="noreferrer">{credito.titulo}</a>
                  <span>
                    {credito.autor} ·{" "}
                    {credito.licencia_url
                      ? <a href={credito.licencia_url} target="_blank" rel="noreferrer">{credito.licencia}</a>
                      : credito.licencia}
                  </span>
                  {credito.cambios && <span>{credito.cambios}</span>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
      {camaraActiva && (
        <div className="visor-set-3d__encuadre" aria-hidden="true">
          <div className="visor-set-3d__marco">
            <div className="visor-set-3d__datos-camara">
              <span>{recortar(camaraActiva.nombre, 42)}</span>
              <strong>{focal} mm · {fovVerticalDesdeFocal(focal).toFixed(1)}°</strong>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="visor-set-3d__error" role="status">
          <strong>La vista 3D no está disponible</strong>
          <p>{error}</p>
          <button type="button" onClick={onClose}>Volver al plano 2D</button>
        </div>
      )}
      {!error && (
        <>
          {cams.length > 0 && (
            <div ref={camarasRef} className="visor-set-3d__camaras-flotantes visor-set-3d__vidrio">
              <div className="visor-set-3d__camaras" aria-label="Ver desde una cámara">
                {camaraActiva && <button type="button" className="visor-set-3d__volver" onClick={volverAOrbita}>Órbita</button>}
                {cams.map((camara, indice) => (
                  <button
                    key={camara.id}
                    type="button"
                    className={camaraActivaId === camara.id ? "activo" : ""}
                    aria-pressed={camaraActivaId === camara.id}
                    onClick={() => verDesdeCamara(camara)}
                    title={camara.nombre}
                  >
                    <i style={{ background: camara.color || "#0A84FF" }} />
                    {nombreCortoCamara(camara, indice)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {camaraActiva && (
            <div ref={lentesRef} className="visor-set-3d__lente-flotante">
              {lentesAbiertos && (
                <div className="visor-set-3d__lista-lentes visor-set-3d__vidrio" aria-label="Distancia focal temporal">
                  {LENTES.map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      className={focal === valor ? "activo" : ""}
                      aria-pressed={focal === valor}
                      onClick={() => { setFocal(valor); setLentesAbiertos(false); }}
                    >
                      {valor} mm
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="visor-set-3d__selector-lente visor-set-3d__vidrio"
                aria-expanded={lentesAbiertos}
                onClick={() => setLentesAbiertos((valor) => !valor)}
              >
                {focal} mm <span aria-hidden="true">⌄</span>
              </button>
            </div>
          )}
          {mostrarAyuda && !camaraActiva && (
            <div className="visor-set-3d__ayuda visor-set-3d__vidrio" role="status">
              Arrastra para orbitar · pellizca para acercar · dos dedos para desplazar
            </div>
          )}
        </>
      )}
    </section>
  );
}

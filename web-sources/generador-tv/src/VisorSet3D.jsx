import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MUEBLE_ASIENTOS, MUEBLES_CATALOGO } from "./catalogos.js";
import {
  ALTURAS_3D,
  clasificarMicrofonos,
  crearGeometriaSet,
  distanciaFocalDeCamara,
  fovVerticalDesdeFocal,
  PLANO_SET,
  puntoPlanoAMetros,
} from "./setGeometria.js";
import "./visorSet3D.css";

const LENTES = [13, 18, 24, 35, 50, 85, 135];

// Medidas aproximadas en metros para una lectura volumétrica clara del plano.
const MUEBLES_3D = Object.freeze({
  mesa: { ancho: 2.4, fondo: 0.82, alto: ALTURAS_3D.mesa, asiento: 0.48 },
  mesaRedonda: { ancho: 1.7, fondo: 1.7, alto: ALTURAS_3D.mesa, asiento: 0.48, redondo: true },
  podio: { ancho: 0.62, fondo: 0.52, alto: 1.08, asiento: 0.05 },
  sillon1: { ancho: 0.92, fondo: 0.82, alto: 0.74, asiento: ALTURAS_3D.asientoBajo },
  sillon2: { ancho: 1.58, fondo: 0.82, alto: 0.74, asiento: ALTURAS_3D.asientoBajo },
  sillon3: { ancho: 2.2, fondo: 0.82, alto: 0.74, asiento: ALTURAS_3D.asientoBajo },
  silla: { ancho: 0.52, fondo: 0.52, alto: 0.86, asiento: ALTURAS_3D.asientoBajo },
  banco: { ancho: 0.46, fondo: 0.46, alto: 0.76, asiento: ALTURAS_3D.asientoAlto },
});

function recortar(texto, maximo = 24) {
  const valor = String(texto || "");
  return valor.length <= maximo ? valor : `${valor.slice(0, Math.max(1, maximo - 1))}…`;
}

function material(color, opciones = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08, ...opciones });
}

function caja(ancho, alto, fondo, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material(color));
}

function cilindro(radioSuperior, radioInferior, alto, color, segmentos = 10) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radioSuperior, radioInferior, alto, segmentos),
    material(color)
  );
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

function crearEtiqueta(texto, color = "#8fc4f7", anchoMetros = 1.8) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 512;
  lienzo.height = 112;
  const ctx = lienzo.getContext("2d");
  dibujarRectanguloRedondeado(ctx, 6, 6, 500, 100, 22);
  ctx.fillStyle = "rgba(8, 13, 22, 0.9)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 36px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(recortar(texto, 25), 256, 58);

  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false }));
  sprite.scale.set(anchoMetros, anchoMetros * 0.219, 1);
  return sprite;
}

function agregarReticula(escena, exterior) {
  const { ancho, alto, margen, unidadesPorMetro } = PLANO_SET;
  const xMin = (margen - ancho / 2) / unidadesPorMetro;
  const xMax = (ancho - margen - ancho / 2) / unidadesPorMetro;
  const zMin = (margen - alto / 2) / unidadesPorMetro;
  const zMax = (alto - margen - alto / 2) / unidadesPorMetro;
  const vertices = [];

  for (let xSvg = unidadesPorMetro; xSvg < ancho - margen; xSvg += unidadesPorMetro) {
    const x = (xSvg - ancho / 2) / unidadesPorMetro;
    if (x >= xMin) vertices.push(x, 0.012, zMin, x, 0.012, zMax);
  }
  for (let ySvg = unidadesPorMetro; ySvg < alto - margen; ySvg += unidadesPorMetro) {
    const z = (ySvg - alto / 2) / unidadesPorMetro;
    if (z >= zMin) vertices.push(xMin, 0.012, z, xMax, 0.012, z);
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const lineas = new THREE.LineSegments(
    geometria,
    new THREE.LineBasicMaterial({ color: exterior ? 0x2b4d32 : 0x27354d, transparent: true, opacity: 0.9 })
  );
  escena.add(lineas);

  const borde = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(xMax - xMin, 0.02, zMax - zMin)),
    new THREE.LineBasicMaterial({ color: exterior ? 0x3b6a46 : 0x3a4c68 })
  );
  borde.position.y = 0.002;
  escena.add(borde);
}

function crearPisoYMuro(escena, cfg, set) {
  const { ancho, alto, margen, unidadesPorMetro } = PLANO_SET;
  const anchoPiso = (ancho - margen * 2) / unidadesPorMetro;
  const fondoPiso = (alto - margen * 2) / unidadesPorMetro;
  const exterior = set.locacion === "ext";
  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(anchoPiso, fondoPiso),
    material(exterior ? "#152419" : "#111827", { side: THREE.DoubleSide })
  );
  piso.rotation.x = -Math.PI / 2;
  escena.add(piso);
  agregarReticula(escena, exterior);

  if (exterior) {
    const rotulo = crearEtiqueta("LOCACIÓN EXTERIOR", "#34D399", 3.2);
    rotulo.position.set(-anchoPiso / 2 + 2.1, 0.55, -fondoPiso / 2 + 0.45);
    escena.add(rotulo);
    return;
  }

  const zMuro = (margen - alto / 2) / unidadesPorMetro;
  const muro = caja(anchoPiso, ALTURAS_3D.muro, 0.14, "#182333");
  muro.position.set(0, ALTURAS_3D.muro / 2, zMuro - 0.07);
  escena.add(muro);

  const pantalla = caja(500 / unidadesPorMetro, 1.55, 0.08, "#08101b");
  pantalla.position.set(0, 1.72, zMuro + 0.055);
  escena.add(pantalla);
  const marco = new THREE.LineSegments(
    new THREE.EdgesGeometry(pantalla.geometry),
    new THREE.LineBasicMaterial({ color: 0x0a84ff })
  );
  marco.position.copy(pantalla.position);
  escena.add(marco);

  const rotulo = crearEtiqueta(cfg.pantalla || "NOTICIERO", "#0A84FF", 5.4);
  rotulo.position.set(0, 1.72, zMuro + 0.12);
  escena.add(rotulo);
}

function crearMesaFija(escena, posicion) {
  const p = puntoPlanoAMetros(posicion);
  const tablero = caja(220 / PLANO_SET.unidadesPorMetro, 0.14, 68 / PLANO_SET.unidadesPorMetro, "#26354a");
  tablero.position.set(p.x, ALTURAS_3D.mesa, p.z);
  escena.add(tablero);
  [-1.65, 1.65].forEach((dx) => {
    const pata = caja(0.12, ALTURAS_3D.mesa, 0.55, "#1b2636");
    pata.position.set(p.x + dx, ALTURAS_3D.mesa / 2, p.z);
    escena.add(pata);
  });
}

function crearMueble(mueble, posicion, rotacion) {
  const medidas = MUEBLES_3D[mueble.tipo] || MUEBLES_3D.sillon1;
  const grupo = new THREE.Group();
  const p = puntoPlanoAMetros(posicion);
  grupo.position.set(p.x, 0, p.z);
  grupo.rotation.y = -THREE.MathUtils.degToRad(rotacion || 0);

  if (medidas.redondo) {
    const tablero = cilindro(medidas.ancho / 2, medidas.ancho / 2, 0.13, "#536174", 20);
    tablero.position.y = medidas.alto;
    grupo.add(tablero);
    const pedestal = cilindro(0.16, 0.28, medidas.alto, "#273447", 10);
    pedestal.position.y = medidas.alto / 2;
    grupo.add(pedestal);
  } else if (mueble.tipo === "mesa") {
    const tablero = caja(medidas.ancho, 0.13, medidas.fondo, "#536174");
    tablero.position.y = medidas.alto;
    grupo.add(tablero);
    [-0.85, 0.85].forEach((x) => {
      const pata = caja(0.1, medidas.alto, 0.42, "#273447");
      pata.position.set(x, medidas.alto / 2, 0);
      grupo.add(pata);
    });
  } else if (mueble.tipo === "podio") {
    const cuerpo = caja(medidas.ancho, medidas.alto, medidas.fondo, "#39485c");
    cuerpo.position.y = medidas.alto / 2;
    grupo.add(cuerpo);
  } else {
    const base = caja(medidas.ancho, Math.min(0.34, medidas.asiento), medidas.fondo, "#46566b");
    base.position.y = medidas.asiento / 2;
    grupo.add(base);
    const respaldo = caja(medidas.ancho, Math.max(0.28, medidas.alto - medidas.asiento), 0.14, "#596a80");
    respaldo.position.set(0, medidas.asiento + (medidas.alto - medidas.asiento) / 2, -medidas.fondo / 2 + 0.07);
    grupo.add(respaldo);
  }

  const definicion = MUEBLES_CATALOGO[mueble.tipo] || MUEBLES_CATALOGO.sillon1;
  grupo.userData.nombre = definicion.es;
  return grupo;
}

function crearPersona(talento, posicion, sentada, alturaAsiento, tieneMic) {
  const grupo = new THREE.Group();
  const p = puntoPlanoAMetros(posicion);
  const color = talento.color || (talento.tipo === "invitado" ? "#30D158" : "#AF52DE");
  const altura = sentada ? ALTURAS_3D.personaSentada : ALTURAS_3D.personaDePie;
  const base = sentada ? alturaAsiento : 0;
  const radio = 0.21;
  const cuerpo = new THREE.Mesh(
    new THREE.CapsuleGeometry(radio, Math.max(0.3, altura - radio * 2), 4, 8),
    material(color)
  );
  cuerpo.position.y = base + altura / 2;
  grupo.add(cuerpo);
  if (tieneMic) {
    const mic = cilindro(0.035, 0.035, 0.18, "#30D158", 8);
    mic.rotation.z = Math.PI / 2;
    mic.position.set(0.22, base + altura * 0.68, 0.08);
    grupo.add(mic);
  }
  const etiqueta = crearEtiqueta(talento.nombre, color);
  etiqueta.position.set(0, base + altura + 0.35, 0);
  grupo.add(etiqueta);
  grupo.position.set(p.x, 0, p.z);
  return grupo;
}

function posicionDeAsiento(posicionMueble, rotacion, asiento) {
  const angulo = THREE.MathUtils.degToRad(rotacion || 0);
  return {
    x: posicionMueble.x + asiento.x * Math.cos(angulo) - asiento.y * Math.sin(angulo),
    y: posicionMueble.y + asiento.x * Math.sin(angulo) + asiento.y * Math.cos(angulo),
  };
}

function crearCunaCamara(camara, posicion, rotacion, tieneShotgun) {
  const grupo = new THREE.Group();
  const p = puntoPlanoAMetros(posicion);
  const color = camara.color || "#0A84FF";
  grupo.position.set(p.x, 0, p.z);
  grupo.rotation.y = -THREE.MathUtils.degToRad(rotacion || 0);

  const poste = cilindro(0.035, 0.05, 1.3, "#718096", 7);
  poste.position.y = 0.72;
  grupo.add(poste);
  const cuerpo = caja(0.58, 0.32, 0.34, color);
  cuerpo.position.set(0, ALTURAS_3D.lenteCamara, 0);
  grupo.add(cuerpo);
  const lente = cilindro(0.13, 0.17, 0.3, color, 12);
  lente.rotation.z = Math.PI / 2;
  lente.position.set(0.43, ALTURAS_3D.lenteCamara, 0);
  grupo.add(lente);

  const patas = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(-0.48, 0.02, -0.34),
    new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(-0.48, 0.02, 0.34),
    new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0.5, 0.02, 0),
  ]);
  grupo.add(new THREE.LineSegments(patas, new THREE.LineBasicMaterial({ color: 0x718096 })));

  if (tieneShotgun) {
    const shotgun = cilindro(0.035, 0.035, 0.48, "#30D158", 8);
    shotgun.rotation.z = Math.PI / 2;
    shotgun.position.set(0.06, ALTURAS_3D.lenteCamara + 0.27, 0);
    grupo.add(shotgun);
  }
  const etiqueta = crearEtiqueta(camara.nombre, color, 2.0);
  etiqueta.position.set(0, ALTURAS_3D.lenteCamara + 0.58, 0);
  grupo.add(etiqueta);
  return grupo;
}

function crearFrustum(posicion, rotacion, color) {
  const p = puntoPlanoAMetros(posicion);
  const largo = 4.2;
  const ancho = 1.75;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0.02, 0, largo, 0.02, -ancho, largo, 0.02, ancho], 3)
  );
  geometria.computeVertexNormals();
  const malla = new THREE.Mesh(
    geometria,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
  );
  malla.position.set(p.x, 0, p.z);
  malla.rotation.y = -THREE.MathUtils.degToRad(rotacion || 0);
  return malla;
}

function crearHaz(origen, destino, color) {
  const desde = new THREE.Vector3(origen.x, origen.y, origen.z);
  const hasta = new THREE.Vector3(destino.x, destino.y, destino.z);
  const direccion = hasta.clone().sub(desde);
  const distancia = Math.max(0.4, direccion.length());
  direccion.normalize();
  const auxiliar = Math.abs(direccion.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const lado = new THREE.Vector3().crossVectors(direccion, auxiliar).normalize();
  const arriba = new THREE.Vector3().crossVectors(lado, direccion).normalize();
  const radio = Math.min(1.6, 0.22 + distancia * 0.22);
  const vertices = [];
  const segmentos = 12;
  for (let i = 0; i < segmentos; i += 1) {
    const a = (i / segmentos) * Math.PI * 2;
    const b = ((i + 1) / segmentos) * Math.PI * 2;
    const pa = hasta.clone().addScaledVector(lado, Math.cos(a) * radio).addScaledVector(arriba, Math.sin(a) * radio);
    const pb = hasta.clone().addScaledVector(lado, Math.cos(b) * radio).addScaledVector(arriba, Math.sin(b) * radio);
    vertices.push(desde.x, desde.y, desde.z, pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.computeVertexNormals();
  return new THREE.Mesh(
    geometria,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
  );
}

function crearLuz(luz, posicion, rotacion) {
  const grupo = new THREE.Group();
  const p = puntoPlanoAMetros(posicion);
  const esCenital = luz.forma === "top" || String(luz.tipo || "").includes("top");
  const altura = esCenital ? ALTURAS_3D.luzCenital : ALTURAS_3D.luz;
  const color = luz.color || "#FF9F0A";
  grupo.position.set(p.x, 0, p.z);
  grupo.rotation.y = -THREE.MathUtils.degToRad(rotacion || 0);
  const soporte = cilindro(0.025, 0.045, altura - 0.15, "#64748B", 7);
  soporte.position.y = (altura - 0.15) / 2;
  grupo.add(soporte);
  const cabeza = luz.forma === "tube" ? cilindro(0.055, 0.055, 0.62, color, 8) : caja(0.42, 0.28, 0.28, color);
  cabeza.rotation.z = luz.forma === "tube" ? Math.PI / 2 : 0;
  cabeza.position.set(0, altura, 0);
  grupo.add(cabeza);
  return { grupo, altura, color, punto: p };
}

function crearBoom(mic, posicion, rotacion) {
  const grupo = new THREE.Group();
  const p = puntoPlanoAMetros(posicion);
  grupo.position.set(p.x, 0, p.z);
  grupo.rotation.y = -THREE.MathUtils.degToRad(rotacion || 0);
  const soporte = cilindro(0.025, 0.04, ALTURAS_3D.boom, "#64748B", 7);
  soporte.position.y = ALTURAS_3D.boom / 2;
  grupo.add(soporte);
  const brazo = cilindro(0.022, 0.022, 1.45, "#94A3B8", 7);
  brazo.rotation.z = Math.PI / 2;
  brazo.position.set(0.68, ALTURAS_3D.boom, 0);
  grupo.add(brazo);
  const capsula = cilindro(0.055, 0.055, 0.32, "#30D158", 8);
  capsula.rotation.z = Math.PI / 2;
  capsula.position.set(1.48, ALTURAS_3D.boom, 0);
  grupo.add(capsula);
  const etiqueta = crearEtiqueta(`${mic.nombre} · boom`, "#30D158", 1.9);
  etiqueta.position.set(0.55, ALTURAS_3D.boom + 0.42, 0);
  grupo.add(etiqueta);
  return grupo;
}

function crearMicSuelto(mic, posicion) {
  const grupo = new THREE.Group();
  const p = puntoPlanoAMetros(posicion);
  const altura = mic.micTipo === "mano" ? 0.95 : 0.68;
  const soporte = cilindro(0.03, 0.08, altura, "#64748B", 8);
  soporte.position.y = altura / 2;
  grupo.add(soporte);
  const capsula = cilindro(0.06, 0.045, 0.22, "#30D158", 8);
  capsula.position.y = altura + 0.08;
  grupo.add(capsula);
  grupo.position.set(p.x, 0, p.z);
  return grupo;
}

function destinoDeHaz(luz, punto, altura, rotacion, mesa, esManual) {
  if (luz.forma === "top" || String(luz.tipo || "").includes("top") || rotacion === null) {
    return { x: punto.x, y: 0.05, z: punto.z };
  }
  if (luz.dir === "mesa" && !esManual) return { x: mesa.x, y: ALTURAS_3D.mesa, z: mesa.z };
  const angulo = THREE.MathUtils.degToRad(rotacion || 0);
  const largo = luz.dir === "muro" ? 5 : 4.2;
  return {
    x: punto.x + Math.cos(angulo) * largo,
    y: luz.dir === "muro" ? 1.35 : Math.min(ALTURAS_3D.mesa, altura * 0.45),
    z: punto.z + Math.sin(angulo) * largo,
  };
}

function poblarEscena(escena, cfg, set, cams) {
  const geometria = crearGeometriaSet({ cfg, set, cams });
  const { micsDeTal, shotgunDe, booms, sueltos } = clasificarMicrofonos(cfg, cams);
  const muebles = set.muebles || [];
  const talentos = cfg.talentos || [];
  const sentados = new Set(muebles.flatMap((mueble) => mueble.ocupantes || []));
  const conos = new THREE.Group();
  const campos = new THREE.Group();
  const objetosCamara = new Map();
  escena.add(conos, campos);

  crearPisoYMuro(escena, cfg, set);
  if (set.mesaVisible !== false) crearMesaFija(escena, geometria.posDe("mesa"));

  muebles.forEach((mueble) => {
    const key = `mue:${mueble.id}`;
    const posicion = geometria.posDe(key);
    const rotacion = geometria.rotacionDe(key, "mueble");
    escena.add(crearMueble(mueble, posicion, rotacion));
    const asientos = MUEBLE_ASIENTOS[mueble.tipo] || MUEBLE_ASIENTOS.sillon1;
    const medidas = MUEBLES_3D[mueble.tipo] || MUEBLES_3D.sillon1;
    (mueble.ocupantes || []).forEach((talentoId, indice) => {
      const talento = talentos.find((item) => item.id === talentoId);
      if (!talento) return;
      const asiento = asientos[indice % asientos.length];
      const posicionTalento = posicionDeAsiento(posicion, rotacion, asiento);
      escena.add(crearPersona(talento, posicionTalento, true, medidas.asiento, micsDeTal(talento.id).length > 0));
    });
  });

  talentos.filter((talento) => !sentados.has(talento.id)).forEach((talento) => {
    escena.add(crearPersona(talento, geometria.posDe(`tal:${talento.id}`), false, 0, micsDeTal(talento.id).length > 0));
  });

  cams.forEach((camara) => {
    const key = `cam:${camara.id}`;
    const posicion = geometria.posDe(key);
    const rotacion = geometria.rotacionDe(key, "camara");
    const objetoCamara = crearCunaCamara(camara, posicion, rotacion, shotgunDe(camara.id).length > 0);
    objetosCamara.set(camara.id, objetoCamara);
    escena.add(objetoCamara);
    campos.add(crearFrustum(posicion, rotacion, camara.color || "#0A84FF"));
  });

  booms.forEach((mic) => {
    const key = `mic:${mic.id}`;
    escena.add(crearBoom(mic, geometria.posDe(key), geometria.rotacionDe(key, "boom")));
  });
  sueltos.forEach((mic) => escena.add(crearMicSuelto(mic, geometria.posDe(`mic:${mic.id}`))));

  const mesa = puntoPlanoAMetros(geometria.posDe("mesa"));
  (set.iluminacion?.luces || []).forEach((luz) => {
    const key = `luz:${luz.id}`;
    const posicion = geometria.posDe(key);
    const rotacion = geometria.rotacionDe(key, "luz", luz.dir);
    const esManual = typeof geometria.giroManualDe(key) === "number";
    const objeto = crearLuz(luz, posicion, rotacion);
    escena.add(objeto.grupo);
    conos.add(crearHaz(
      { x: objeto.punto.x, y: objeto.altura, z: objeto.punto.z },
      destinoDeHaz(luz, objeto.punto, objeto.altura, rotacion, mesa, esManual),
      objeto.color
    ));
  });

  return { geometria, conos, campos, objetosCamara };
}

function liberarEscena(escena) {
  escena.traverse((objeto) => {
    objeto.geometry?.dispose?.();
    const materiales = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
    materiales.filter(Boolean).forEach((mat) => {
      mat.map?.dispose?.();
      mat.dispose?.();
    });
  });
}

function nombreCortoCamara(camara, indice) {
  const encontrada = String(camara.nombre || "").match(/CAM(?:ARA)?\s+[A-Z0-9]+/i);
  return encontrada ? encontrada[0].toUpperCase().replace("CAMARA", "CAM") : `CAM ${String.fromCharCode(65 + indice)}`;
}

export default function VisorSet3D({ cfg, set, cams = [], onClose }) {
  const hostRef = useRef(null);
  const panelRef = useRef(null);
  const motorRef = useRef(null);
  const [error, setError] = useState("");
  const [mostrarConos, setMostrarConos] = useState(true);
  const [mostrarCampos, setMostrarCampos] = useState(true);
  const [camaraActivaId, setCamaraActivaId] = useState(null);
  const [focal, setFocal] = useState(35);
  const camaraActiva = useMemo(() => cams.find((camara) => camara.id === camaraActivaId) || null, [cams, camaraActivaId]);

  useEffect(() => {
    const alTeclado = (evento) => {
      if (evento.key === "Escape") onClose();
    };
    window.addEventListener("keydown", alTeclado);
    panelRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", alTeclado);
  }, [onClose]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    let frame = null;
    let observador;
    let destruido = false;
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
    renderer.toneMappingExposure = 1.05;
    host.replaceChildren(renderer.domElement);

    const escena = new THREE.Scene();
    escena.background = new THREE.Color(set.locacion === "ext" ? "#0c1710" : "#080d16");
    escena.fog = new THREE.Fog(escena.background, 17, 31);
    const camara = new THREE.PerspectiveCamera(45, 1, 0.05, 80);
    camara.position.set(9.2, 8.6, 10.8);

    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.set(0, 0.75, 0);
    controles.enableDamping = false;
    controles.enablePan = true;
    controles.screenSpacePanning = true;
    controles.minDistance = 2.2;
    controles.maxDistance = 30;
    controles.maxPolarAngle = Math.PI / 2 - 0.025;
    controles.update();

    escena.add(new THREE.HemisphereLight(set.locacion === "ext" ? 0x9bd3a5 : 0xa9c8ff, 0x111827, 1.35));
    const luzEstudio = new THREE.DirectionalLight(0xffffff, 1.65);
    luzEstudio.position.set(5, 11, 7);
    escena.add(luzEstudio);
    const contenido = poblarEscena(escena, cfg, set, cams);

    const invalidar = () => {
      if (destruido || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        renderer.render(escena, camara);
      });
    };
    const ajustar = () => {
      if (destruido) return;
      const ancho = Math.max(1, host.clientWidth);
      const alto = Math.max(1, host.clientHeight);
      renderer.setSize(ancho, alto, false);
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
      invalidar();
    };
    const contextoPerdido = (evento) => {
      evento.preventDefault();
      setError("La vista 3D perdió el contexto gráfico. Cierra el visor y vuelve a abrirlo para continuar.");
    };
    const contextoRestaurado = () => {
      setError("");
      ajustar();
    };

    renderer.domElement.addEventListener("webglcontextlost", contextoPerdido, false);
    renderer.domElement.addEventListener("webglcontextrestored", contextoRestaurado, false);
    controles.addEventListener("change", invalidar);
    if (typeof ResizeObserver === "function") {
      observador = new ResizeObserver(ajustar);
      observador.observe(host);
    } else {
      window.addEventListener("resize", ajustar);
    }

    motorRef.current = {
      renderer,
      escena,
      camara,
      controles,
      invalidar,
      geometria: contenido.geometria,
      conos: contenido.conos,
      campos: contenido.campos,
      objetosCamara: contenido.objetosCamara,
      estadoOrbita: null,
    };
    ajustar();

    return () => {
      destruido = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observador?.disconnect();
      window.removeEventListener("resize", ajustar);
      controles.removeEventListener("change", invalidar);
      controles.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextoPerdido);
      renderer.domElement.removeEventListener("webglcontextrestored", contextoRestaurado);
      liberarEscena(escena);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      motorRef.current = null;
    };
  }, [cfg, set, cams]);

  useEffect(() => {
    const motor = motorRef.current;
    if (!motor) return;
    motor.conos.visible = mostrarConos;
    motor.campos.visible = mostrarCampos;
    motor.invalidar();
  }, [mostrarConos, mostrarCampos]);

  useEffect(() => {
    const motor = motorRef.current;
    if (!motor || !camaraActiva) return;
    motor.camara.fov = fovVerticalDesdeFocal(focal);
    motor.camara.updateProjectionMatrix();
    motor.invalidar();
  }, [camaraActiva, focal]);

  const volverAOrbita = () => {
    const motor = motorRef.current;
    if (!motor) return;
    motor.controles.enabled = true;
    motor.camara.fov = 45;
    motor.objetosCamara.forEach((objeto) => { objeto.visible = true; });
    if (motor.estadoOrbita) {
      motor.camara.position.copy(motor.estadoOrbita.posicion);
      motor.controles.target.copy(motor.estadoOrbita.blanco);
    } else {
      motor.camara.position.set(9.2, 8.6, 10.8);
      motor.controles.target.set(0, 0.75, 0);
    }
    motor.camara.updateProjectionMatrix();
    motor.controles.update();
    motor.estadoOrbita = null;
    setCamaraActivaId(null);
    motor.invalidar();
  };

  const aplicarVista = (vista) => {
    const motor = motorRef.current;
    if (!motor) return;
    if (camaraActivaId) volverAOrbita();
    motor.controles.enabled = true;
    motor.camara.fov = 45;
    if (vista === "planta") {
      motor.camara.position.set(0, 18, 0.01);
      motor.controles.target.set(0, 0, 0);
    } else {
      motor.camara.position.set(9.2, 8.6, 10.8);
      motor.controles.target.set(0, 0.75, 0);
    }
    motor.camara.updateProjectionMatrix();
    motor.controles.update();
    motor.invalidar();
  };

  const verDesdeCamara = (camara) => {
    const motor = motorRef.current;
    if (!motor) return;
    if (!camaraActivaId) {
      motor.estadoOrbita = {
        posicion: motor.camara.position.clone(),
        blanco: motor.controles.target.clone(),
      };
    }
    const key = `cam:${camara.id}`;
    const punto = puntoPlanoAMetros(motor.geometria.posDe(key));
    const rotacion = motor.geometria.rotacionDe(key, "camara");
    const angulo = THREE.MathUtils.degToRad(rotacion || 0);
    const focalInicial = distanciaFocalDeCamara(camara);
    motor.controles.enabled = false;
    motor.objetosCamara.forEach((objeto, id) => { objeto.visible = id !== camara.id; });
    motor.camara.position.set(punto.x, ALTURAS_3D.lenteCamara, punto.z);
    motor.camara.lookAt(
      punto.x + Math.cos(angulo) * 10,
      ALTURAS_3D.lenteCamara,
      punto.z + Math.sin(angulo) * 10
    );
    motor.camara.fov = fovVerticalDesdeFocal(focalInicial);
    motor.camara.updateProjectionMatrix();
    setFocal(focalInicial);
    setCamaraActivaId(camara.id);
    motor.invalidar();
  };

  return (
    <section ref={panelRef} className="visor-set-3d" aria-label="Vista 3D del plano del set" tabIndex={-1}>
      <div ref={hostRef} className="visor-set-3d__lienzo" aria-hidden="true" />

      <header className="visor-set-3d__cabecera">
        <div className="visor-set-3d__titulo">
          <span>PLANO DEL SET</span>
          <strong>Vista 3D · sólo consulta</strong>
        </div>
        <div className="visor-set-3d__acciones">
          <button type="button" onClick={() => aplicarVista("planta")}>Planta</button>
          <button type="button" onClick={() => aplicarVista("perspectiva")}>Perspectiva</button>
          <button type="button" className={mostrarConos ? "activo" : ""} aria-pressed={mostrarConos} onClick={() => setMostrarConos((valor) => !valor)}>
            Conos de luz
          </button>
          <button type="button" className={mostrarCampos ? "activo" : ""} aria-pressed={mostrarCampos} onClick={() => setMostrarCampos((valor) => !valor)}>
            Campo de cámaras
          </button>
          <button type="button" className="visor-set-3d__cerrar" onClick={onClose}>Cerrar</button>
        </div>
      </header>

      {camaraActiva && (
        <div className="visor-set-3d__encuadre" aria-hidden="true">
          <div className="visor-set-3d__marco">
            <div className="visor-set-3d__datos-camara">
              <span>{camaraActiva.nombre}</span>
              <strong>{focal} mm · {fovVerticalDesdeFocal(focal).toFixed(1)}° vertical</strong>
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
        <footer className="visor-set-3d__pie">
          <div className="visor-set-3d__camaras" aria-label="Ver desde una cámara">
            <span className="visor-set-3d__etiqueta">Ver desde la cámara</span>
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
            {camaraActiva && <button type="button" onClick={volverAOrbita}>Volver a órbita</button>}
          </div>

          {camaraActiva ? (
            <div className="visor-set-3d__lentes" aria-label="Distancia focal temporal">
              <span className="visor-set-3d__etiqueta">Lente temporal</span>
              {LENTES.map((valor) => (
                <button key={valor} type="button" className={focal === valor ? "activo" : ""} aria-pressed={focal === valor} onClick={() => setFocal(valor)}>
                  {valor} mm
                </button>
              ))}
            </div>
          ) : (
            <p className="visor-set-3d__ayuda">Arrastra para orbitar · pellizca o rueda para acercar · dos dedos para desplazar</p>
          )}
        </footer>
      )}
    </section>
  );
}

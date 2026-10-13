import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import * as THREE from "three";
import catalogoCamaras from "virtual:catalogo-camaras";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MUEBLE_ASIENTOS } from "./catalogos.js";
import { armarTextoEtiquetaCaptura, gradosConSigno, nombreCortoCamara } from "./captura3d.js";
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
  crearModeloDescargado,
  precargarModelosDescargados,
  reiniciarCacheModelosDescargados,
} from "./modelosDescargados3d.js";
import { modeloDe, rangoFocalDeEquipo, sensorMmDeEquipo } from "./equipoCamara.js";
import { prepararCapturaParaStoryboard } from "./imagenesStoryboard.js";
import { esNarrativo } from "./proyecto.js";
import {
  ALTURAS_3D,
  clasificarMicrofonos,
  crearGeometriaSet,
  distanciaFocalDeCamara,
  fovHorizontalDesdeFocal,
  fovVerticalDesdeFocal,
  geometriaPlano,
  medidasForo,
  medidasPantallaDelForo,
  posicionPantallaDelForo,
  puntoPlanoAMetros,
  zObjetivoParedPosterior,
} from "./setGeometria.js";
import { camaraAsignadaAlPlano } from "./tomas.js";
import "./visorSet3D.css";

const LENTES = [13, 18, 24, 35, 50, 85, 135];
const LIMITE_TILT_CAMARA = THREE.MathUtils.degToRad(85);
const SENSIBILIDAD_ARRASTRE_CAMARA = 0.0042;
const colorCicloramaPorSet = new Map();
let ayudaNavegacionMostrada = false;

function limitarTilt(angulo) {
  return THREE.MathUtils.clamp(angulo, -LIMITE_TILT_CAMARA, LIMITE_TILT_CAMARA);
}

function envolverAngulo(angulo) {
  return Math.atan2(Math.sin(angulo), Math.cos(angulo));
}

function normalizarGrados(grados) {
  const normalizados = THREE.MathUtils.radToDeg(envolverAngulo(THREE.MathUtils.degToRad(grados)));
  return Object.is(normalizados, -0) ? 0 : normalizados;
}

function valorTiltGuardado(set, key) {
  const valor = Number(set?.setLayout?.tilt?.[key]);
  return Number.isFinite(valor) ? THREE.MathUtils.clamp(valor, -85, 85) : 0;
}

function sinOrientacionDeCamaras(set) {
  if (!set) return set;
  const layout = set.setLayout || {};
  const rot = Object.fromEntries(
    Object.entries(layout.rot || {}).filter(([key]) => !key.startsWith("cam:"))
  );
  return { ...set, setLayout: { ...layout, rot, tilt: {} } };
}

// Guardar pan/tilt no debe reconstruir WebGL: el modelo y el campo de cámara
// se actualizan en la escena viva. Cualquier otro cambio del proyecto sí crea
// de nuevo la escena para mantener sincronizados mobiliario, foro y equipo.
function firmaEscenaDe(cfg, set, cams) {
  const cfgEscena = { ...cfg };
  // Una imagen de storyboard no cambia ningún objeto 3D. Omitir la escaleta
  // evita destruir el contexto y conserva encuadre y giroscopio al guardarla.
  delete cfgEscena.escaleta;
  return JSON.stringify({
    cfg: { ...cfgEscena, sets: (cfg.sets || []).map(sinOrientacionDeCamaras) },
    set: sinOrientacionDeCamaras(set),
    cams,
  });
}

function aplicarOrientacionDeCamara(motor) {
  if (!motor?.modoCamara || !motor.vistaCamara) return;
  const vista = motor.vistaCamara;
  vista.tilt = limitarTilt(vista.tilt);
  const yaw = vista.yawBase + vista.pan;
  const cosenoTilt = Math.cos(vista.tilt);
  const objetivo = new THREE.Vector3(
    Math.cos(yaw) * cosenoTilt,
    Math.sin(vista.tilt),
    Math.sin(yaw) * cosenoTilt
  ).multiplyScalar(10).add(motor.camara.position);
  motor.camara.up.set(0, 1, 0);
  motor.camara.lookAt(objetivo);
  motor.alCambiarOrientacion?.(vista);
  motor.invalidar();
}

function esDispositivoIOSConGiroscopio() {
  if (typeof window === "undefined" || typeof window.DeviceOrientationEvent === "undefined") return false;
  const agente = navigator.userAgent || "";
  const esIOS = /iPad|iPhone|iPod/.test(agente)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return esIOS;
}

function crearEstadoGiroscopio() {
  return {
    activo: false,
    limpiar: null,
    requiereCalibracion: true,
    pausadoPorArrastre: false,
    yawAnterior: 0,
    yawAcumulado: 0,
    pitchBase: 0,
    panBase: 0,
    tiltBase: 0,
    ultimoTiempo: 0,
    euler: new THREE.Euler(),
    cuaternion: new THREE.Quaternion(),
    giroPantalla: new THREE.Quaternion(),
    giroCamara: new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)),
    ejePantalla: new THREE.Vector3(0, 0, 1),
    frente: new THREE.Vector3(),
  };
}

function angulosDelDispositivo(evento, estado) {
  if (![evento.alpha, evento.beta, evento.gamma].every(Number.isFinite)) return null;
  const alpha = THREE.MathUtils.degToRad(evento.alpha);
  const beta = THREE.MathUtils.degToRad(evento.beta);
  const gamma = THREE.MathUtils.degToRad(evento.gamma);
  const anguloPantalla = Number.isFinite(window.screen?.orientation?.angle)
    ? window.screen.orientation.angle
    : (Number(window.orientation) || 0);

  // Es la misma corrección de ejes de DeviceOrientationControls: primero pone
  // la espalda del teléfono como visor y después compensa retrato/horizontal.
  estado.euler.set(beta, alpha, -gamma, "YXZ");
  estado.cuaternion.setFromEuler(estado.euler);
  estado.cuaternion.multiply(estado.giroCamara);
  estado.giroPantalla.setFromAxisAngle(
    estado.ejePantalla,
    -THREE.MathUtils.degToRad(anguloPantalla)
  );
  estado.cuaternion.multiply(estado.giroPantalla);
  estado.frente.set(0, 0, -1).applyQuaternion(estado.cuaternion).normalize();
  return {
    yaw: Math.atan2(estado.frente.x, -estado.frente.z),
    pitch: Math.asin(THREE.MathUtils.clamp(estado.frente.y, -1, 1)),
  };
}

function ajusteDeCamara(camara) {
  const clave = modeloDe(catalogoCamaras, camara?.equipo);
  return AJUSTES_MODELOS_3D[clave] || AJUSTES_MODELOS_3D.camara;
}

function fovDeCamara(camara, focal) {
  const sensor = camara?.equipo ? sensorMmDeEquipo(catalogoCamaras, camara.equipo) : null;
  return fovVerticalDesdeFocal(focal, sensor);
}

function fovHorizontalDeCamara(camara, focal) {
  const sensor = camara?.equipo ? sensorMmDeEquipo(catalogoCamaras, camara.equipo) : null;
  return fovHorizontalDesdeFocal(focal, sensor);
}

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

function inclinarCabezalCamara(modelo, tilt, altoLente = ALTURAS_3D.lenteCamara) {
  if (!modelo) return;
  let pivote = modelo.userData.pivoteTiltCamara;
  if (!pivote) {
    modelo.updateWorldMatrix(true, true);
    const caja = new THREE.Box3();
    const centro = new THREE.Vector3();
    const piezas = [];
    modelo.traverse((objeto) => {
      if (!objeto.isMesh) return;
      caja.setFromObject(objeto).getCenter(centro);
      modelo.worldToLocal(centro);
      if (centro.y >= altoLente - 0.3) piezas.push(objeto);
    });
    const piezasRaiz = piezas.filter((pieza) => {
      let padre = pieza.parent;
      while (padre && padre !== modelo) {
        if (piezas.includes(padre)) return false;
        padre = padre.parent;
      }
      return true;
    });
    pivote = new THREE.Group();
    pivote.position.y = altoLente;
    modelo.add(pivote);
    modelo.updateWorldMatrix(true, true);
    piezasRaiz.forEach((pieza) => pivote.attach(pieza));
    modelo.userData.pivoteTiltCamara = pivote;
  }
  // El modelo mira hacia +Z: para que un tilt positivo levante el lente,
  // su cabezal gira en X con signo contrario.
  pivote.rotation.x = -THREE.MathUtils.degToRad(tilt || 0);
  pivote.updateMatrixWorld(true);
}

function ubicarModelo(objeto, posicion, rotacion, orientaHacia = false, set = null) {
  const p = puntoPlanoAMetros(posicion, set);
  objeto.position.set(p.x, 0, p.z);
  if (orientaHacia) orientarHaciaAngulo(objeto, rotacion);
  else objeto.rotation.y = -THREE.MathUtils.degToRad(rotacion || 0);
  return objeto;
}

function crearCampoCamara(posicion, rotacion, tilt, color, altoLente, set) {
  const p = puntoPlanoAMetros(posicion, set);
  const largo = 4.3;
  const mitadAncho = 1.7;
  const mitadAlto = 0.96;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, -mitadAncho, -mitadAlto, largo,
    0, 0, 0, mitadAncho, -mitadAlto, largo,
    0, 0, 0, -mitadAncho, mitadAlto, largo,
    0, 0, 0, mitadAncho, mitadAlto, largo,
    -mitadAncho, -mitadAlto, largo, mitadAncho, -mitadAlto, largo,
    mitadAncho, -mitadAlto, largo, mitadAncho, mitadAlto, largo,
    mitadAncho, mitadAlto, largo, -mitadAncho, mitadAlto, largo,
    -mitadAncho, mitadAlto, largo, -mitadAncho, -mitadAlto, largo,
  ], 3));
  const lineas = new THREE.LineSegments(
    geometria,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
  );
  lineas.position.set(p.x, altoLente, p.z);
  orientarHaciaAngulo(lineas, rotacion);
  lineas.rotation.x = -THREE.MathUtils.degToRad(tilt || 0);
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

// Luz general del visor ("luz de trabajo" del foro). Antes (1.18 / 2.35 / 1.08
// y entorno a 1) estaba pensada para maquetas blancas y deslavaba los modelos
// con color de Blender: el sofá azul salía casi blanco.
const LUZ_VISOR = { cielo: 0.62, clave: 1.55, entorno: 0.55, exposicion: 0.98 };

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
    modelo.updateMatrixWorld(true);
    const cajaTotal = new THREE.Box3().setFromObject(modelo);
    const altoLenteGuardado = Number(reemplazo.ajuste?.alto_lente);
    const altoLente = Number.isFinite(altoLenteGuardado) && altoLenteGuardado > 0
      ? altoLenteGuardado
      : cajaTotal.min.y + (cajaTotal.max.y - cajaTotal.min.y) * 0.84;
    // Las marcas van sobre el CUERPO de la cámara, no sobre la caja de todo el
    // equipo: las patas del tripié abren casi un metro y alejarían la franja.
    // El cuerpo = las piezas cuyo centro queda cerca o arriba del lente.
    const cuerpo = new THREE.Box3();
    const cajaPieza = new THREE.Box3();
    const centroPieza = new THREE.Vector3();
    modelo.traverse((objeto) => {
      if (!objeto.isMesh) return;
      cajaPieza.setFromObject(objeto);
      if (cajaPieza.getCenter(centroPieza).y >= altoLente - 0.06) cuerpo.union(cajaPieza);
    });
    if (cuerpo.isEmpty()) cuerpo.copy(cajaTotal);
    const tamano = cuerpo.getSize(new THREE.Vector3());
    const centro = cuerpo.getCenter(new THREE.Vector3());
    const anchoFranja = THREE.MathUtils.clamp(tamano.x * 0.8, 0.03, 0.22);
    const altoFranja = THREE.MathUtils.clamp(tamano.y * 0.12, 0.006, 0.025);
    const fondoFranja = THREE.MathUtils.clamp(tamano.z * 0.3, 0.01, 0.12);
    const franja = new THREE.Mesh(
      new THREE.BoxGeometry(anchoFranja, altoFranja, fondoFranja),
      material
    );
    // Franja de color encima del cuerpo, como la cinta de identificación.
    franja.position.set(centro.x, cuerpo.max.y + altoFranja / 2, centro.z);
    modelo.add(franja);
    const ladoTally = THREE.MathUtils.clamp(tamano.x * 0.25, 0.012, 0.05);
    const tally = new THREE.Mesh(
      new THREE.BoxGeometry(ladoTally, ladoTally * 0.7, ladoTally),
      material
    );
    // Tally adelante y arriba, visible desde el set.
    tally.position.set(
      centro.x,
      cuerpo.max.y + altoFranja + ladoTally * 0.35,
      centro.z + fondoFranja / 2 - ladoTally / 2
    );
    modelo.add(tally);
    if (reemplazo.tieneShotgun) {
      const largoMic = THREE.MathUtils.clamp(tamano.z * 0.6, 0.12, 0.3);
      const radioMic = THREE.MathUtils.clamp(tamano.x * 0.06, 0.009, 0.02);
      const mic = new THREE.Mesh(
        new THREE.CapsuleGeometry(radioMic, largoMic, 4, 10),
        new THREE.MeshStandardMaterial({ color: "#171A1F", roughness: 0.88, metalness: 0.04 })
      );
      mic.rotation.x = Math.PI / 2;
      mic.position.set(
        centro.x + tamano.x / 2 + radioMic,
        cuerpo.max.y + radioMic,
        centro.z + tamano.z * 0.15
      );
      modelo.add(mic);
    }
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
  const camposCamara = new Map();
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
    reemplazos.push({ ajuste: AJUSTES_MODELOS_3D.mesa, respaldo: mesaFija, clase: "mueble" });
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
    const tilt = valorTiltGuardado(set, key);
    const ajusteCamara = ajusteDeCamara(camara);
    const altoLente = Number(ajusteCamara?.alto_lente) > 0
      ? Number(ajusteCamara.alto_lente)
      : ALTURAS_3D.lenteCamara;
    const modelo = ubicarModelo(
      crearModeloCamara({ color: camara.color, tieneShotgun: shotgunDe(camara.id).length > 0 }),
      posicion,
      rotacion,
      true,
      set
    );
    modelo.userData.altoLenteOrientacion = altoLente;
    modelo.userData.rotacionCamara = rotacion;
    modelo.userData.tiltCamara = tilt;
    inclinarCabezalCamara(modelo, tilt, altoLente);
    if (ajusteCamara?.alto) modelo.userData.alturaRotulo = ajusteCamara.alto + 0.3;
    objetosCamara.set(camara.id, modelo);
    escena.add(modelo);
    objetosEncuadre.push(modelo);
    reemplazos.push({
      ajuste: ajusteCamara,
      respaldo: modelo,
      clase: "camara",
      color: camara.color,
      tieneShotgun: shotgunDe(camara.id).length > 0,
      alReemplazar: (descargado) => {
        const orientacionActual = objetosCamara.get(camara.id)?.userData || {};
        const rotacionActual = Number.isFinite(orientacionActual.rotacionCamara)
          ? orientacionActual.rotacionCamara
          : rotacion;
        const tiltActual = Number.isFinite(orientacionActual.tiltCamara)
          ? orientacionActual.tiltCamara
          : tilt;
        descargado.userData.altoLenteOrientacion = altoLente;
        descargado.userData.rotacionCamara = rotacionActual;
        descargado.userData.tiltCamara = tiltActual;
        orientarHaciaAngulo(descargado, rotacionActual);
        inclinarCabezalCamara(descargado, tiltActual, altoLente);
        objetosCamara.set(camara.id, descargado);
      },
    });
    const campo = crearCampoCamara(
      posicion,
      rotacion,
      tilt,
      camara.color || "#0A84FF",
      altoLente,
      set
    );
    campos.add(campo);
    camposCamara.set(camara.id, campo);
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
    // El cono nace a la altura de trabajo declarada por el modelo propio. El
    // equipo completo solo gira en Y hacia el objetivo; no se inclina el pie.
    const altura = ajuste?.alto_trabajo || modelo.userData.alturaHaz || ALTURAS_3D.luz;
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
    camposCamara,
    objetosEncuadre,
    reemplazos,
  };
}

function actualizarOrientacionCamaraEnEscena(motor, camaraId, rotacion, tilt) {
  const modelo = motor?.objetosCamara?.get(camaraId);
  if (modelo) {
    modelo.userData.rotacionCamara = rotacion;
    modelo.userData.tiltCamara = tilt;
    orientarHaciaAngulo(modelo, rotacion);
    inclinarCabezalCamara(modelo, tilt, modelo.userData.altoLenteOrientacion);
  }
  const campo = motor?.camposCamara?.get(camaraId);
  if (campo) {
    orientarHaciaAngulo(campo, rotacion);
    campo.rotation.x = -THREE.MathUtils.degToRad(tilt || 0);
  }
  if (modelo || campo) {
    motor.renderer.shadowMap.needsUpdate = true;
    motor.invalidar();
  }
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

function renderizarCapturaDeCamara(motor) {
  if (!motor?.modoCamara || !motor.vistaCamara) throw new Error("No hay una cámara activa");
  const { renderer, escena, camara } = motor;
  const proporcionAnterior = renderer.getPixelRatio();
  const aspectoAnterior = camara.aspect;
  const destinoAnterior = renderer.getRenderTarget();
  try {
    // El buffer se vuelve 960×540 físicos sin importar DPR, zoom CSS ni el
    // tamaño visible. Se renderiza y se lee en el mismo gesto; no depende de
    // preserveDrawingBuffer.
    renderer.setRenderTarget(null);
    renderer.setPixelRatio(1);
    renderer.setSize(960, 540, false);
    renderer.setViewport(0, 0, 960, 540);
    renderer.setScissorTest(false);
    camara.aspect = 16 / 9;
    camara.updateProjectionMatrix();
    renderer.clear();
    renderer.render(escena, camara);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    renderer.setRenderTarget(destinoAnterior);
    renderer.setPixelRatio(proporcionAnterior);
    camara.aspect = aspectoAnterior;
    camara.updateProjectionMatrix();
    motor.ajustar();
  }
}

function PanelDestinoCaptura({ cfg, camaraId, imagen, onGuardar, onCerrar }) {
  const narrativo = esNarrativo(cfg);
  const [confirmacion, setConfirmacion] = useState(null);
  const segmentos = cfg.escaleta || [];
  const camarasPorId = Object.fromEntries((cfg.camaras || []).map((camara) => [camara.id, camara]));
  const camaraCaptura = camarasPorId[camaraId];

  const elegirPlano = (segmentoId, toma, numero) => {
    const destino = { segmentoId, tomaId: toma.id, numero };
    if (toma.imagen) setConfirmacion(destino);
    else onGuardar(destino);
  };

  return (
    <div
      className="visor-set-3d__destino-capa"
      onPointerDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar(); }}
    >
      <aside className="visor-set-3d__destino visor-set-3d__vidrio" role="dialog" aria-modal="true" aria-labelledby="destino-captura-titulo">
        <header className="visor-set-3d__destino-cabecera">
          <div>
            <strong id="destino-captura-titulo">¿A qué plano va?</strong>
            <span>{nombreCortoCamara(camaraCaptura, Math.max(0, (cfg.camaras || []).findIndex((camara) => camara.id === camaraId)))}</span>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cancelar captura"><X size={19} /></button>
        </header>
        <div className="visor-set-3d__destino-cuerpo">
          <img className="visor-set-3d__captura-previa" src={imagen} alt="Captura que se guardará en el storyboard" />
          {!segmentos.length && (
            <div className="visor-set-3d__sin-destinos" role="status">
              <strong>Todavía no hay {narrativo ? "escenas" : "segmentos"}.</strong>
              <p>
                {narrativo
                  ? "Créalas en Guion literario; después podrás volver aquí y agregar un plano."
                  : "Agrégalos en Escaleta editorial; después podrás volver aquí y agregar un plano de cámara."}
              </p>
            </div>
          )}
          {segmentos.map((segmento, indiceSegmento) => {
            const tomas = (segmento.tomas || [])
              .map((toma, indiceToma) => ({
                toma,
                numero: `${indiceSegmento + 1}.${indiceToma + 1}`,
                asignada: camaraAsignadaAlPlano(toma, narrativo),
              }))
              .filter(({ toma }) => narrativo || (toma.tipo || "camara") === "camara")
              .sort((a, b) => Number(b.asignada === camaraId) - Number(a.asignada === camaraId));
            const numeroNuevo = `${indiceSegmento + 1}.${(segmento.tomas || []).length + 1}`;
            return (
              <section key={segmento.id} className="visor-set-3d__destino-segmento">
                <div className="visor-set-3d__destino-segmento-cab">
                  <div><b>{indiceSegmento + 1}</b><strong>{segmento.segmento || (narrativo ? "Escena sin título" : "Segmento sin título")}</strong></div>
                  <button type="button" onClick={() => onGuardar({ segmentoId: segmento.id, tomaId: null, numero: numeroNuevo })}>＋ Plano nuevo</button>
                </div>
                {!tomas.length && <p className="visor-set-3d__destino-vacio">Sin planos de cámara todavía.</p>}
                {tomas.map(({ toma, numero, asignada }) => {
                  const coincide = asignada === camaraId;
                  const distinta = Boolean(asignada && !coincide);
                  const confirmando = confirmacion?.segmentoId === segmento.id && confirmacion?.tomaId === toma.id;
                  return (
                    <div key={toma.id} className={`visor-set-3d__destino-opcion${coincide ? " coincide" : ""}`}>
                      <button
                        type="button"
                        className="visor-set-3d__destino-plano"
                        onClick={() => elegirPlano(segmento.id, toma, numero)}
                        aria-label={`Guardar captura en el plano ${numero}`}
                      >
                        {toma.imagen
                          ? <img src={toma.imagen} alt="" />
                          : <span className="visor-set-3d__destino-sin-imagen"><Camera size={19} /></span>}
                        <span className="visor-set-3d__destino-detalle">
                          <b>{numero} · {toma.plano || (narrativo ? "Sin plano" : "Cue de cámara")}</b>
                          <small>{asignada ? (camarasPorId[asignada]?.nombre || "Cámara no disponible") : "Sin cámara asignada"}</small>
                          {distinta && <em>Se conservará esta cámara; la captura es de {camaraCaptura?.nombre || "otra cámara"}.</em>}
                        </span>
                        {coincide && <span className="visor-set-3d__coincide">Esta cámara</span>}
                      </button>
                      {confirmando && (
                        <div className="visor-set-3d__confirmar-reemplazo" role="alert">
                          <span>Este plano ya tiene imagen</span>
                          <button type="button" className="principal" onClick={() => onGuardar(confirmacion)}>Reemplazar</button>
                          <button type="button" onClick={() => setConfirmacion(null)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export default function VisorSet3D({ cfg, set, cams = [], editable = false, onGuardarCaptura, onOrientarCamara, onClose }) {
  const hostRef = useRef(null);
  const panelRef = useRef(null);
  const capasRef = useRef(null);
  const camarasRef = useRef(null);
  const lentesRef = useRef(null);
  const motorRef = useRef(null);
  const vistaCamaraPendienteRef = useRef(null);
  const avisoRef = useRef(null);
  const trabajoCapturaRef = useRef(0);
  const onOrientarCamaraRef = useRef(onOrientarCamara);
  onOrientarCamaraRef.current = onOrientarCamara;
  const giroscopioRef = useRef(null);
  if (!giroscopioRef.current) giroscopioRef.current = crearEstadoGiroscopio();
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
  const [giroscopioDisponible, setGiroscopioDisponible] = useState(false);
  const [giroscopioActivo, setGiroscopioActivo] = useState(false);
  const [tiltEnVivo, setTiltEnVivo] = useState(0);
  const [capturando, setCapturando] = useState(false);
  const [capturaPendiente, setCapturaPendiente] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [colorCiclorama, setColorCiclorama] = useState(
    () => normalizarColorCiclorama(colorCicloramaPorSet.get(set.id))
  );
  const camaraActiva = useMemo(
    () => cams.find((camara) => camara.id === camaraActivaId) || null,
    [cams, camaraActivaId]
  );
  const rangoFocalActivo = useMemo(
    () => rangoFocalDeEquipo(catalogoCamaras, camaraActiva?.equipo),
    [camaraActiva]
  );
  const focalesDisponibles = rangoFocalActivo?.pasos || LENTES;
  const firmaEscena = useMemo(() => firmaEscenaDe(cfg, set, cams), [cfg, set, cams]);

  const publicarOrientacion = (vista) => {
    const tilt = Math.round(THREE.MathUtils.radToDeg(vista?.tilt || 0));
    setTiltEnVivo((actual) => (actual === tilt ? actual : tilt));
  };

  const guardarOrientacionMotor = (motor = motorRef.current, { centrar = false } = {}) => {
    const vista = motor?.vistaCamara;
    if (!motor?.modoCamara || !vista?.camaraId) return false;
    const yaw = envolverAngulo(vista.yawBase + vista.pan);
    const tiltRad = limitarTilt(vista.tilt);
    const cambio = Math.abs(envolverAngulo(yaw - vista.yawGuardado)) > 0.00001
      || Math.abs(tiltRad - vista.tiltGuardado) > 0.00001;
    if (!centrar && !cambio) {
      vista.sucia = false;
      return false;
    }
    const rot = centrar ? null : normalizarGrados(THREE.MathUtils.radToDeg(yaw));
    const tilt = centrar ? 0 : THREE.MathUtils.radToDeg(tiltRad);
    const rotacionEscena = rot ?? normalizarGrados(THREE.MathUtils.radToDeg(vista.yawBase));
    actualizarOrientacionCamaraEnEscena(motor, vista.camaraId, rotacionEscena, tilt);
    onOrientarCamaraRef.current?.(vista.camaraId, { rot, tilt });
    vista.yawGuardado = centrar ? vista.yawBase : yaw;
    vista.tiltGuardado = centrar ? 0 : tiltRad;
    vista.sucia = false;
    return true;
  };

  const mostrarAvisoTemporal = (mensaje, tipo = "ok") => {
    window.clearTimeout(avisoRef.current);
    setAviso({ mensaje, tipo });
    avisoRef.current = window.setTimeout(() => setAviso(null), 2800);
  };

  const capturarParaStoryboard = async () => {
    const motor = motorRef.current;
    if (!editable || typeof onGuardarCaptura !== "function" || !camaraActiva || !motor?.vistaCamara) return;
    const trabajo = ++trabajoCapturaRef.current;
    setCapturando(true);
    setCapasAbiertas(false);
    setLentesAbiertos(false);
    try {
      const vista = motor.vistaCamara;
      const fovH = Math.round(fovHorizontalDeCamara(camaraActiva, focal));
      const fovV = Math.round(fovDeCamara(camaraActiva, focal));
      const tilt = Math.round(THREE.MathUtils.radToDeg(vista.tilt));
      const rot = normalizarGrados(THREE.MathUtils.radToDeg(vista.yawBase + vista.pan));
      const indiceCamara = Math.max(0, cams.findIndex((camara) => camara.id === camaraActiva.id));
      const textoEtiqueta = armarTextoEtiquetaCaptura({ camara: camaraActiva, indiceCamara, focal, fovH, fovV, tilt });
      const captura3d = {
        camId: camaraActiva.id,
        setId: set.id,
        focal: Number(focal),
        fovH,
        fovV,
        tilt,
        rot,
        fecha: new Date().toISOString(),
      };

      // Persistir la orientación aquí hace que el metadato y el set queden
      // de acuerdo incluso si la vista se movió con el giroscopio.
      guardarOrientacionMotor(motor);
      const cuadro = renderizarCapturaDeCamara(motor);
      const imagen = await prepararCapturaParaStoryboard(cuadro, textoEtiqueta);
      if (trabajo !== trabajoCapturaRef.current) return;
      setCapturaPendiente({ imagen, captura3d });
    } catch (fallo) {
      console.warn("No se pudo capturar la vista 3D", fallo);
      if (trabajo === trabajoCapturaRef.current) mostrarAvisoTemporal("No se pudo crear la captura", "error");
    } finally {
      if (trabajo === trabajoCapturaRef.current) setCapturando(false);
    }
  };

  const guardarCapturaEnPlano = (destino) => {
    if (!capturaPendiente || !editable || typeof onGuardarCaptura !== "function") return;
    onGuardarCaptura({
      segmentoId: destino.segmentoId,
      tomaId: destino.tomaId,
      imagen: capturaPendiente.imagen,
      captura3d: capturaPendiente.captura3d,
    });
    setCapturaPendiente(null);
    mostrarAvisoTemporal(`Guardado en el plano ${destino.numero}`);
  };

  const activarVistaCamaraEnMotor = (motor, camaraSeleccionada) => {
    const key = `cam:${camaraSeleccionada.id}`;
    const punto = puntoPlanoAMetros(motor.geometria.posDe(key), set);
    const rotacionAutomatica = motor.geometria.rotacionAutomaticaDe(key, "camara");
    const rotacionManual = set.setLayout?.rot?.[key];
    const rotacion = Number.isFinite(rotacionManual) ? rotacionManual : rotacionAutomatica;
    const yawBase = THREE.MathUtils.degToRad(rotacionAutomatica || 0);
    const yawGuardado = THREE.MathUtils.degToRad(rotacion || 0);
    const tiltGuardado = THREE.MathUtils.degToRad(valorTiltGuardado(set, key));
    const ajusteCamara = ajusteDeCamara(camaraSeleccionada);
    const altoLente = Number(ajusteCamara?.alto_lente) > 0
      ? Number(ajusteCamara.alto_lente)
      : ALTURAS_3D.lenteCamara;
    motor.modoCamara = true;
    motor.controles.enabled = false;
    motor.etiquetas.visible = false;
    motor.conos.visible = false;
    motor.campos.visible = false;
    motor.reticula.visible = false;
    motor.objetosCamara.forEach((objeto, id) => { objeto.visible = id !== camaraSeleccionada.id; });
    motor.camara.up.set(0, 1, 0);
    motor.camara.position.set(punto.x, altoLente, punto.z);
    motor.vistaCamara = {
      camaraId: camaraSeleccionada.id,
      yawBase,
      pan: envolverAngulo(yawGuardado - yawBase),
      tilt: limitarTilt(tiltGuardado),
      yawGuardado: envolverAngulo(yawGuardado),
      tiltGuardado: limitarTilt(tiltGuardado),
      sucia: false,
    };
    aplicarOrientacionDeCamara(motor);
  };

  const apagarGiroscopio = (actualizarInterfaz = true) => {
    const estado = giroscopioRef.current;
    estado.limpiar?.();
    estado.limpiar = null;
    estado.activo = false;
    estado.requiereCalibracion = true;
    estado.pausadoPorArrastre = false;
    estado.ultimoTiempo = 0;
    if (actualizarInterfaz) setGiroscopioActivo(false);
  };

  const recalibrarGiroscopio = () => {
    const estado = giroscopioRef.current;
    if (estado.activo) estado.requiereCalibracion = true;
  };

  const iniciarEscuchaGiroscopio = () => {
    apagarGiroscopio(false);
    const estado = giroscopioRef.current;
    estado.activo = true;
    estado.requiereCalibracion = true;

    const alOrientar = (evento) => {
      const motor = motorRef.current;
      if (!estado.activo || estado.pausadoPorArrastre || !motor?.modoCamara || !motor.vistaCamara) return;
      const angulos = angulosDelDispositivo(evento, estado);
      if (!angulos) return;

      if (estado.requiereCalibracion) {
        estado.requiereCalibracion = false;
        estado.yawAnterior = angulos.yaw;
        estado.yawAcumulado = 0;
        estado.pitchBase = angulos.pitch;
        estado.panBase = motor.vistaCamara.pan;
        estado.tiltBase = motor.vistaCamara.tilt;
        estado.ultimoTiempo = evento.timeStamp || performance.now();
        return;
      }

      estado.yawAcumulado += envolverAngulo(angulos.yaw - estado.yawAnterior);
      estado.yawAnterior = angulos.yaw;
      const ahora = evento.timeStamp || performance.now();
      const segundos = Math.min(0.1, Math.max(1 / 120, (ahora - estado.ultimoTiempo) / 1000));
      estado.ultimoTiempo = ahora;
      // Unos 45 ms quitan el temblor del sensor sin dar sensación de retraso.
      const mezcla = 1 - Math.exp(-segundos / 0.045);
      const panObjetivo = estado.panBase + estado.yawAcumulado;
      const tiltObjetivo = limitarTilt(estado.tiltBase + angulos.pitch - estado.pitchBase);
      motor.vistaCamara.pan += (panObjetivo - motor.vistaCamara.pan) * mezcla;
      motor.vistaCamara.tilt += (tiltObjetivo - motor.vistaCamara.tilt) * mezcla;
      motor.vistaCamara.sucia = true;
      aplicarOrientacionDeCamara(motor);
    };
    const alCambiarOrientacion = () => recalibrarGiroscopio();
    window.addEventListener("deviceorientation", alOrientar);
    window.addEventListener("orientationchange", alCambiarOrientacion);
    window.screen?.orientation?.addEventListener?.("change", alCambiarOrientacion);
    estado.limpiar = () => {
      window.removeEventListener("deviceorientation", alOrientar);
      window.removeEventListener("orientationchange", alCambiarOrientacion);
      window.screen?.orientation?.removeEventListener?.("change", alCambiarOrientacion);
    };
    setGiroscopioActivo(true);
  };

  const alternarGiroscopio = async () => {
    if (giroscopioRef.current.activo) {
      guardarOrientacionMotor();
      apagarGiroscopio();
      return;
    }
    try {
      const Orientacion = window.DeviceOrientationEvent;
      if (typeof Orientacion?.requestPermission === "function") {
        // iOS exige que esta llamada ocurra directamente dentro del gesto.
        const permiso = await Orientacion.requestPermission();
        if (permiso !== "granted") return;
      }
      const motor = motorRef.current;
      if (motor?.modoCamara && motor.vistaCamara) iniciarEscuchaGiroscopio();
    } catch (fallo) {
      console.warn("No se pudo activar el giroscopio", fallo);
    }
  };

  const centrarVistaCamara = () => {
    const motor = motorRef.current;
    if (!motor?.modoCamara || !motor.vistaCamara) return;
    motor.vistaCamara.pan = 0;
    motor.vistaCamara.tilt = 0;
    motor.vistaCamara.sucia = true;
    aplicarOrientacionDeCamara(motor);
    guardarOrientacionMotor(motor, { centrar: true });
    recalibrarGiroscopio();
  };

  const cerrarVisor = () => {
    trabajoCapturaRef.current += 1;
    guardarOrientacionMotor();
    apagarGiroscopio();
    onClose();
  };

  useEffect(() => {
    const alTeclado = (evento) => {
      if (evento.key !== "Escape") return;
      if (capturaPendiente) setCapturaPendiente(null);
      else if (lentesAbiertos) setLentesAbiertos(false);
      else if (capasAbiertas) setCapasAbiertas(false);
      else cerrarVisor();
    };
    window.addEventListener("keydown", alTeclado);
    panelRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", alTeclado);
  }, [capasAbiertas, capturaPendiente, lentesAbiertos, onClose]);

  useEffect(() => {
    setGiroscopioDisponible(esDispositivoIOSConGiroscopio());
    return () => {
      trabajoCapturaRef.current += 1;
      window.clearTimeout(avisoRef.current);
      guardarOrientacionMotor();
      apagarGiroscopio(false);
    };
  }, []);

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
    let limpiarArrastreCamara = () => {};
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
    renderer.toneMappingExposure = LUZ_VISOR.exposicion;
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
    escena.environmentIntensity = LUZ_VISOR.entorno;
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
    escena.add(new THREE.HemisphereLight(0xffffff, 0xbfc4c8, LUZ_VISOR.cielo));
    const luzClave = new THREE.DirectionalLight(0xfff7ed, LUZ_VISOR.clave);
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
      camposCamara: contenido.camposCamara,
      cajaEncuadre: cajaDeEncuadreDelSet(contenido.objetosEncuadre, set),
      estadoOrbita: null,
      modoCamara: false,
      vistaCamara: null,
      mostrarNombres,
      vistaOrbita: "perspectiva",
      alCambiarOrientacion: publicarOrientacion,
    };
    motorRef.current = motor;

    const arrastreCamara = { puntero: null, x: 0, y: 0, pan: 0, tilt: 0 };
    const alIniciarArrastreCamara = (evento) => {
      if (!motor.modoCamara || !motor.vistaCamara || evento.button !== 0) return;
      evento.preventDefault();
      arrastreCamara.puntero = evento.pointerId;
      arrastreCamara.x = evento.clientX;
      arrastreCamara.y = evento.clientY;
      arrastreCamara.pan = motor.vistaCamara.pan;
      arrastreCamara.tilt = motor.vistaCamara.tilt;
      renderer.domElement.setPointerCapture?.(evento.pointerId);
      giroscopioRef.current.pausadoPorArrastre = true;
    };
    const alArrastrarCamara = (evento) => {
      if (evento.pointerId !== arrastreCamara.puntero || !motor.vistaCamara) return;
      evento.preventDefault();
      motor.vistaCamara.pan = arrastreCamara.pan
        + (evento.clientX - arrastreCamara.x) * SENSIBILIDAD_ARRASTRE_CAMARA;
      motor.vistaCamara.tilt = limitarTilt(
        arrastreCamara.tilt - (evento.clientY - arrastreCamara.y) * SENSIBILIDAD_ARRASTRE_CAMARA
      );
      motor.vistaCamara.sucia = true;
      aplicarOrientacionDeCamara(motor);
    };
    const alTerminarArrastreCamara = (evento) => {
      if (evento.pointerId !== arrastreCamara.puntero) return;
      arrastreCamara.puntero = null;
      if (renderer.domElement.hasPointerCapture?.(evento.pointerId)) {
        renderer.domElement.releasePointerCapture(evento.pointerId);
      }
      // El arrastre suma un desfase manual. Al soltar se recalibra el sensor
      // sobre ese nuevo encuadre para que el giroscopio continúe sin un salto.
      giroscopioRef.current.pausadoPorArrastre = false;
      guardarOrientacionMotor(motor);
      recalibrarGiroscopio();
    };
    renderer.domElement.addEventListener("pointerdown", alIniciarArrastreCamara);
    renderer.domElement.addEventListener("pointermove", alArrastrarCamara);
    renderer.domElement.addEventListener("pointerup", alTerminarArrastreCamara);
    renderer.domElement.addEventListener("pointercancel", alTerminarArrastreCamara);
    renderer.domElement.addEventListener("lostpointercapture", alTerminarArrastreCamara);
    limpiarArrastreCamara = () => {
      renderer.domElement.removeEventListener("pointerdown", alIniciarArrastreCamara);
      renderer.domElement.removeEventListener("pointermove", alArrastrarCamara);
      renderer.domElement.removeEventListener("pointerup", alTerminarArrastreCamara);
      renderer.domElement.removeEventListener("pointercancel", alTerminarArrastreCamara);
      renderer.domElement.removeEventListener("lostpointercapture", alTerminarArrastreCamara);
    };
    hidratarModelosDescargados(contenido.reemplazos, motor, () => destruido);
    ajustar();
    const vistaPendiente = vistaCamaraPendienteRef.current;
    const camaraARestaurar = cams.find((camara) => (
      camara.id === (vistaPendiente?.camaraId || camaraActivaId)
    ));
    if (camaraARestaurar) {
      activarVistaCamaraEnMotor(motor, camaraARestaurar);
      if (vistaPendiente?.camaraId === camaraARestaurar.id) {
        motor.vistaCamara.pan = envolverAngulo(vistaPendiente.yaw - motor.vistaCamara.yawBase);
        motor.vistaCamara.tilt = limitarTilt(vistaPendiente.tilt);
        motor.vistaCamara.yawGuardado = envolverAngulo(vistaPendiente.yaw);
        motor.vistaCamara.tiltGuardado = limitarTilt(vistaPendiente.tilt);
        aplicarOrientacionDeCamara(motor);
        actualizarOrientacionCamaraEnEscena(
          motor,
          camaraARestaurar.id,
          normalizarGrados(THREE.MathUtils.radToDeg(vistaPendiente.yaw)),
          THREE.MathUtils.radToDeg(vistaPendiente.tilt)
        );
      }
      vistaCamaraPendienteRef.current = null;
      motor.camara.aspect = 16 / 9;
      motor.camara.fov = fovDeCamara(camaraARestaurar, focal);
      motor.camara.updateProjectionMatrix();
      recalibrarGiroscopio();
    } else {
      vistaCamaraPendienteRef.current = null;
      encuadrarSet(motor, "perspectiva", false);
    }
    invalidar();
    return () => {
      if (motor.modoCamara && motor.vistaCamara) {
        vistaCamaraPendienteRef.current = {
          camaraId: motor.vistaCamara.camaraId,
          yaw: envolverAngulo(motor.vistaCamara.yawBase + motor.vistaCamara.pan),
          tilt: limitarTilt(motor.vistaCamara.tilt),
        };
      }
      guardarOrientacionMotor(motor);
      destruido = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observador?.disconnect();
      window.removeEventListener("resize", alRedimensionar);
      controles.removeEventListener("change", invalidar);
      controles.dispose();
      limpiarArrastreCamara();
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
      if (motorRef.current === motor) motorRef.current = null;
    };
  }, [firmaEscena]);

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
    motor.camara.fov = fovDeCamara(camaraActiva, focal);
    motor.camara.aspect = 16 / 9;
    motor.camara.updateProjectionMatrix();
    motor.ajustar();
  }, [camaraActiva, focal]);

  const volverAOrbita = () => {
    const motor = motorRef.current;
    if (!motor) return;
    guardarOrientacionMotor(motor);
    apagarGiroscopio();
    motor.modoCamara = false;
    motor.vistaCamara = null;
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
    if (motor.vistaCamara?.camaraId === camaraSeleccionada.id) {
      guardarOrientacionMotor(motor);
      return;
    }
    const conservarGiroscopio = giroscopioRef.current.activo;
    guardarOrientacionMotor(motor);
    if (!conservarGiroscopio) apagarGiroscopio();
    setCapasAbiertas(false);
    if (!motor.modoCamara) {
      motor.estadoOrbita = {
        posicion: motor.camara.position.clone(),
        arriba: motor.camara.up.clone(),
        blanco: motor.controles.target.clone(),
        vista: motor.vistaOrbita,
      };
    }
    const focalInicial = distanciaFocalDeCamara(camaraSeleccionada);
    activarVistaCamaraEnMotor(motor, camaraSeleccionada);
    motor.camara.aspect = 16 / 9;
    motor.camara.fov = fovDeCamara(camaraSeleccionada, focalInicial);
    motor.camara.updateProjectionMatrix();
    setFocal(focalInicial);
    setLentesAbiertos(false);
    setCamaraActivaId(camaraSeleccionada.id);
    if (conservarGiroscopio) recalibrarGiroscopio();
    motor.ajustar();
  };

  const elegirColorCiclorama = (color) => {
    colorCicloramaPorSet.set(set.id, color);
    setColorCiclorama(color);
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
        <button type="button" className="visor-set-3d__cerrar" onClick={cerrarVisor} aria-label="Cerrar vista 3D">
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
          </aside>
        )}
      </div>
      {camaraActiva && (
        <div className="visor-set-3d__encuadre" aria-hidden="true">
          <div className="visor-set-3d__marco">
            <div className="visor-set-3d__datos-camara">
              <span>{recortar(camaraActiva.nombre, 42)}</span>
              <div>
                <strong>
                  {focal} mm · visión {Math.round(fovHorizontalDeCamara(camaraActiva, focal))}° × {Math.round(fovDeCamara(camaraActiva, focal))}°
              </strong>
              <em>
                Tilt {gradosConSigno(tiltEnVivo)}
              </em>
              </div>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="visor-set-3d__error" role="status">
          <strong>La vista 3D no está disponible</strong>
          <p>{error}</p>
          <button type="button" onClick={cerrarVisor}>Volver al plano 2D</button>
        </div>
      )}
      {!error && (
        <>
          {camaraActiva && editable && typeof onGuardarCaptura === "function" && (
            <button
              type="button"
              className="visor-set-3d__capturar visor-set-3d__vidrio"
              onClick={capturarParaStoryboard}
              disabled={capturando}
            >
              <Camera size={17} aria-hidden="true" />
              {capturando ? "Capturando…" : "Capturar"}
            </button>
          )}
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
              <div className="visor-set-3d__movimiento-camara visor-set-3d__vidrio" role="toolbar" aria-label="Orientación guardada de la cámara">
                <button type="button" onClick={centrarVistaCamara}>Centrar</button>
                {giroscopioDisponible && (
                  <button
                    type="button"
                    className={giroscopioActivo ? "activo" : ""}
                    aria-pressed={giroscopioActivo}
                    onClick={alternarGiroscopio}
                  >
                    {giroscopioActivo ? "Desactivar giroscopio" : "Activar giroscopio"}
                  </button>
                )}
              </div>
              {rangoFocalActivo && !rangoFocalActivo.pasos ? (
                <label className="visor-set-3d__rango-lente visor-set-3d__vidrio">
                  <span>Focal</span>
                  <input
                    type="range"
                    min={rangoFocalActivo.min}
                    max={rangoFocalActivo.max}
                    step="1"
                    value={focal}
                    aria-label={`Distancia focal temporal de ${camaraActiva.nombre}`}
                    onChange={(evento) => setFocal(Number(evento.target.value))}
                  />
                  <strong>{focal} mm</strong>
                </label>
              ) : <>
              {lentesAbiertos && (
                <div className="visor-set-3d__lista-lentes visor-set-3d__vidrio" aria-label="Distancia focal temporal">
                  {focalesDisponibles.map((valor) => (
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
              </>}
            </div>
          )}
          {mostrarAyuda && !camaraActiva && (
            <div className="visor-set-3d__ayuda visor-set-3d__vidrio" role="status">
              Arrastra para orbitar · pellizca para acercar · dos dedos para desplazar
            </div>
          )}
        </>
      )}
      {aviso && (
        <div className={`visor-set-3d__toast ${aviso.tipo}`} role="status">{aviso.mensaje}</div>
      )}
      {capturaPendiente && (
        <PanelDestinoCaptura
          cfg={cfg}
          camaraId={capturaPendiente.captura3d.camId}
          imagen={capturaPendiente.imagen}
          onGuardar={guardarCapturaEnPlano}
          onCerrar={() => setCapturaPendiente(null)}
        />
      )}
    </section>
  );
}

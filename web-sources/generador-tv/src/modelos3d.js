import * as THREE from "three";
import { ALTURAS_3D } from "./setGeometria.js";

// Fábrica procedural de utilería 3D. Cada modelo nace al centro del piso y
// mira hacia +Z; quien compone la escena aplica la posición y el giro del plano.

export const MUEBLES_3D = Object.freeze({
  mesa: { ancho: 2.4, fondo: 0.82, alto: ALTURAS_3D.mesa, asiento: 0.48 },
  mesaRedonda: { ancho: 1.7, fondo: 1.7, alto: ALTURAS_3D.mesa, asiento: 0.48 },
  podio: { ancho: 0.62, fondo: 0.52, alto: 1.08, asiento: 0.05 },
  sillon1: { ancho: 0.92, fondo: 0.82, alto: 0.78, asiento: ALTURAS_3D.asientoBajo },
  sillon2: { ancho: 1.58, fondo: 0.82, alto: 0.78, asiento: ALTURAS_3D.asientoBajo },
  sillon3: { ancho: 2.2, fondo: 0.82, alto: 0.78, asiento: ALTURAS_3D.asientoBajo },
  silla: { ancho: 0.62, fondo: 0.58, alto: 0.94, asiento: ALTURAS_3D.asientoBajo },
  banco: { ancho: 0.46, fondo: 0.46, alto: 0.45, asiento: 0.43 },
});

const materiales = new Map();
const geometrias = new Map();

function materialPbr(clave, color, rugosidad = 0.68, metal = 0.04, extras = {}) {
  const id = `${clave}:${color}:${rugosidad}:${metal}:${JSON.stringify(extras)}`;
  if (!materiales.has(id)) {
    materiales.set(id, new THREE.MeshStandardMaterial({
      color,
      roughness: rugosidad,
      metalness: metal,
      ...extras,
    }));
  }
  return materiales.get(id);
}

function geometria(clave, crear) {
  if (!geometrias.has(clave)) geometrias.set(clave, crear());
  return geometrias.get(clave);
}

function geoCaja(ancho, alto, fondo) {
  return geometria(`caja:${ancho}:${alto}:${fondo}`, () => new THREE.BoxGeometry(ancho, alto, fondo));
}

function geoCilindro(r1, r2, alto, segmentos = 10, abierto = false) {
  return geometria(
    `cil:${r1}:${r2}:${alto}:${segmentos}:${abierto}`,
    () => new THREE.CylinderGeometry(r1, r2, alto, segmentos, 1, abierto)
  );
}

function geoEsfera(radio, segmentos = 12) {
  return geometria(`esf:${radio}:${segmentos}`, () => new THREE.SphereGeometry(radio, segmentos, Math.max(6, segmentos / 2)));
}

function geoToro(radio, tubo, segmentos = 16) {
  return geometria(`toro:${radio}:${tubo}:${segmentos}`, () => new THREE.TorusGeometry(radio, tubo, 6, segmentos));
}

function geoCono(radio, alto, segmentos = 12, abierto = false) {
  return geometria(`cono:${radio}:${alto}:${segmentos}:${abierto}`, () => new THREE.ConeGeometry(radio, alto, segmentos, 1, abierto));
}

function geoCapsula(radio, tramo) {
  return geometria(`capsula:${radio}:${tramo}`, () => new THREE.CapsuleGeometry(radio, tramo, 5, 12));
}

function malla(geo, mat, { sombra = false, recibe = true } = {}) {
  const objeto = new THREE.Mesh(geo, mat);
  objeto.castShadow = sombra;
  objeto.receiveShadow = recibe;
  return objeto;
}

function caja(ancho, alto, fondo, mat, opciones) {
  return malla(geoCaja(ancho, alto, fondo), mat, opciones);
}

function cilindro(r1, r2, alto, mat, segmentos = 10, opciones) {
  return malla(geoCilindro(r1, r2, alto, segmentos), mat, opciones);
}

function esfera(radio, mat, segmentos = 12, opciones) {
  return malla(geoEsfera(radio, segmentos), mat, opciones);
}

function barraEntre(inicio, fin, radio, mat, sombra = false) {
  const a = new THREE.Vector3(...inicio);
  const b = new THREE.Vector3(...fin);
  const vector = b.clone().sub(a);
  const largo = vector.length();
  const barra = cilindro(radio, radio, largo, mat, 8, { sombra });
  barra.position.copy(a).add(b).multiplyScalar(0.5);
  barra.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
  return barra;
}

function capsulaEntre(inicio, fin, radio, mat) {
  const a = new THREE.Vector3(...inicio);
  const b = new THREE.Vector3(...fin);
  const vector = b.clone().sub(a);
  const largo = vector.length();
  const capsula = malla(geoCapsula(radio, Math.max(0.01, largo - radio * 2)), mat);
  capsula.position.copy(a).add(b).multiplyScalar(0.5);
  capsula.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
  return capsula;
}

function materialesBase() {
  return {
    negro: materialPbr("plástico negro", "#181B20", 0.52, 0.18),
    negroMate: materialPbr("negro mate", "#101216", 0.9, 0.02),
    metal: materialPbr("metal oscuro", "#424850", 0.3, 0.72),
    plata: materialPbr("aluminio", "#B9BEC4", 0.28, 0.8),
    madera: materialPbr("madera", "#B8844E", 0.58, 0.02),
    maderaClara: materialPbr("madera clara", "#D0A36D", 0.62, 0.02),
    lona: materialPbr("lona", "#171A1F", 0.95, 0),
    tapiz: materialPbr("tapiz", "#69727C", 0.88, 0),
    tapizClaro: materialPbr("tapiz claro", "#8D959E", 0.86, 0),
    piel: materialPbr("piel neutra", "#C8B6A5", 0.82, 0),
    ropa: materialPbr("ropa neutra", "#A5ABB2", 0.9, 0),
    cristal: materialPbr("cristal", "#BDDFF4", 0.18, 0.05, { transparent: true, opacity: 0.72 }),
    blanco: materialPbr("blanco", "#F4F3EF", 0.7, 0.01),
  };
}

function agregarTripode(grupo, altura, escala = 1) {
  const { metal, negro } = materialesBase();
  const yCabeza = altura - 0.2 * escala;
  grupo.add(cilindro(0.055 * escala, 0.07 * escala, 0.22 * escala, metal, 10));
  grupo.children.at(-1).position.y = yCabeza;
  const centro = [0, yCabeza - 0.06 * escala, 0];
  const pies = [
    [-0.48 * escala, 0.035, 0.38 * escala],
    [0.48 * escala, 0.035, 0.38 * escala],
    [0, 0.035, -0.54 * escala],
  ];
  pies.forEach((pie) => {
    grupo.add(barraEntre(centro, pie, 0.025 * escala, metal));
    const zapata = caja(0.16 * escala, 0.035, 0.08 * escala, negro);
    zapata.position.set(...pie);
    grupo.add(zapata);
  });
  const nucleo = [0, 0.28 * escala, 0];
  pies.forEach((pie) => grupo.add(barraEntre(nucleo, [pie[0] * 0.78, 0.28 * escala, pie[2] * 0.78], 0.012 * escala, metal)));
  const aro = new THREE.Mesh(geoToro(0.12 * escala, 0.012 * escala, 18), metal);
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.28 * escala;
  grupo.add(aro);
}

function agregarSoporteLuz(grupo, altura, conBrazo = false) {
  const { metal, negro } = materialesBase();
  grupo.add(barraEntre([0, 0.04, 0], [0, altura - 0.18, 0], 0.022, metal));
  const pies = [[-0.42, 0.025, 0.27], [0.42, 0.025, 0.27], [0, 0.025, -0.46]];
  pies.forEach((pie) => {
    grupo.add(barraEntre([0, 0.16, 0], pie, 0.018, metal));
    const goma = caja(0.1, 0.025, 0.055, negro);
    goma.position.set(...pie);
    grupo.add(goma);
  });
  const collar = cilindro(0.045, 0.045, 0.08, negro, 10);
  collar.position.y = altura * 0.55;
  grupo.add(collar);
  if (conBrazo) {
    grupo.add(barraEntre([0, altura - 0.18, 0], [0, altura, 0.72], 0.018, metal));
    const contrapeso = esfera(0.08, negro, 10);
    contrapeso.position.set(0, altura - 0.13, -0.2);
    grupo.add(contrapeso);
  }
}

function agregarPuertas(grupo, y, z, ancho, alto) {
  const { negroMate } = materialesBase();
  const superior = caja(ancho, 0.055, alto * 0.55, negroMate);
  superior.position.set(0, y + alto * 0.64, z + 0.08);
  superior.rotation.x = -0.48;
  grupo.add(superior);
  const inferior = caja(ancho, 0.055, alto * 0.55, negroMate);
  inferior.position.set(0, y - alto * 0.64, z + 0.08);
  inferior.rotation.x = 0.48;
  grupo.add(inferior);
  const izquierda = caja(0.055, alto, ancho * 0.48, negroMate);
  izquierda.position.set(-ancho * 0.64, y, z + 0.08);
  izquierda.rotation.y = 0.52;
  grupo.add(izquierda);
  const derecha = caja(0.055, alto, ancho * 0.48, negroMate);
  derecha.position.set(ancho * 0.64, y, z + 0.08);
  derecha.rotation.y = -0.52;
  grupo.add(derecha);
}

export function crearModeloCamara({ color = "#0A84FF", tieneShotgun = false } = {}) {
  const grupo = new THREE.Group();
  const { negro, negroMate, metal, cristal } = materialesBase();
  agregarTripode(grupo, ALTURAS_3D.lenteCamara, 1.08);

  const cabeza = cilindro(0.13, 0.16, 0.16, metal, 12, { sombra: true });
  cabeza.position.y = 1.27;
  grupo.add(cabeza);
  const cuerpo = caja(0.52, 0.34, 0.68, negro, { sombra: true });
  cuerpo.position.set(0, ALTURAS_3D.lenteCamara, -0.25);
  grupo.add(cuerpo);
  const hombro = caja(0.58, 0.12, 0.46, negroMate, { sombra: true });
  hombro.position.set(0, 1.34, -0.28);
  grupo.add(hombro);

  const lente = cilindro(0.13, 0.17, 0.34, negroMate, 16, { sombra: true });
  lente.rotation.x = Math.PI / 2;
  lente.position.set(0, ALTURAS_3D.lenteCamara, 0.25);
  grupo.add(lente);
  const cristalLente = cilindro(0.105, 0.105, 0.018, cristal, 18);
  cristalLente.rotation.x = Math.PI / 2;
  cristalLente.position.set(0, ALTURAS_3D.lenteCamara, 0.43);
  grupo.add(cristalLente);
  const mateBox = caja(0.42, 0.32, 0.1, negroMate, { sombra: true });
  mateBox.position.set(0, ALTURAS_3D.lenteCamara, 0.46);
  grupo.add(mateBox);
  const hueco = caja(0.28, 0.2, 0.015, materialPbr("hueco lente", "#050607", 1, 0));
  hueco.position.set(0, ALTURAS_3D.lenteCamara, 0.518);
  grupo.add(hueco);

  const visor = caja(0.24, 0.16, 0.3, negroMate);
  visor.position.set(-0.27, 1.68, -0.22);
  visor.rotation.z = -0.12;
  grupo.add(visor);
  grupo.add(barraEntre([-0.17, 1.72, -0.35], [0.18, 1.83, -0.25], 0.025, metal));
  grupo.add(barraEntre([0.18, 1.83, -0.25], [0.22, 1.72, 0], 0.025, metal));

  const tira = caja(0.018, 0.22, 0.5, materialPbr(`franja ${color}`, color, 0.48, 0.08));
  tira.position.set(0.269, 1.52, -0.24);
  grupo.add(tira);
  const tally = caja(0.12, 0.055, 0.02, materialPbr(`tally ${color}`, color, 0.34, 0, { emissive: color, emissiveIntensity: 0.5 }));
  tally.position.set(0, 1.68, -0.601);
  grupo.add(tally);

  grupo.add(barraEntre([0.18, 1.31, -0.34], [0.58, 1.02, -0.7], 0.018, metal));
  if (tieneShotgun) {
    const mic = cilindro(0.035, 0.045, 0.54, negroMate, 10);
    mic.rotation.x = Math.PI / 2;
    mic.position.set(0.11, 1.81, -0.02);
    grupo.add(mic);
    const espuma = cilindro(0.055, 0.055, 0.22, negroMate, 10);
    espuma.rotation.x = Math.PI / 2;
    espuma.position.set(0.11, 1.81, 0.31);
    grupo.add(espuma);
  }
  grupo.userData.alturaRotulo = 2.12;
  return grupo;
}

export function crearModeloPersona({ sentada = false, alturaAsiento = 0, color = "#AF52DE", tieneMic = false } = {}) {
  const grupo = new THREE.Group();
  const { piel, ropa, negro } = materialesBase();
  const insignia = materialPbr(`insignia ${color}`, color, 0.52, 0.04);
  const cadera = sentada ? alturaAsiento + 0.12 : 0.86;
  const hombros = cadera + 0.52;
  const cabezaY = hombros + 0.27;

  const torso = cilindro(0.2, 0.28, 0.55, ropa, 14, { sombra: true });
  torso.position.y = cadera + 0.3;
  grupo.add(torso);
  const cabeza = esfera(0.16, piel, 18, { sombra: true });
  cabeza.position.y = cabezaY;
  grupo.add(cabeza);
  const cuello = cilindro(0.07, 0.075, 0.12, piel, 9);
  cuello.position.y = hombros + 0.05;
  grupo.add(cuello);
  const collar = new THREE.Mesh(geoToro(0.12, 0.025, 16), insignia);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, hombros, 0);
  grupo.add(collar);
  const badge = cilindro(0.052, 0.052, 0.018, insignia, 12);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0.13, cadera + 0.36, 0.255);
  grupo.add(badge);

  const hombroIzq = [-0.22, hombros - 0.04, 0];
  const hombroDer = [0.22, hombros - 0.04, 0];
  if (sentada) {
    grupo.add(capsulaEntre(hombroIzq, [-0.35, cadera + 0.06, 0.2], 0.065, ropa));
    grupo.add(capsulaEntre(hombroDer, [0.35, cadera + 0.06, 0.2], 0.065, ropa));
    [-1, 1].forEach((lado) => {
      const x = lado * 0.13;
      grupo.add(capsulaEntre([x, cadera, 0], [lado * 0.16, alturaAsiento - 0.02, 0.34], 0.075, ropa));
      grupo.add(capsulaEntre([lado * 0.16, alturaAsiento - 0.02, 0.34], [lado * 0.16, 0.08, 0.42], 0.065, ropa));
      const pie = caja(0.14, 0.08, 0.27, negro);
      pie.position.set(lado * 0.16, 0.06, 0.5);
      grupo.add(pie);
    });
  } else {
    grupo.add(capsulaEntre(hombroIzq, [-0.3, cadera - 0.2, 0.03], 0.065, ropa));
    grupo.add(capsulaEntre(hombroDer, [0.3, cadera - 0.2, 0.03], 0.065, ropa));
    [-1, 1].forEach((lado) => {
      grupo.add(capsulaEntre([lado * 0.13, cadera, 0], [lado * 0.15, 0.09, 0], 0.075, ropa));
      const pie = caja(0.15, 0.08, 0.28, negro);
      pie.position.set(lado * 0.15, 0.055, 0.08);
      grupo.add(pie);
    });
  }
  if (tieneMic) {
    const lavalier = esfera(0.026, negro, 8);
    lavalier.position.set(0, cadera + 0.43, 0.255);
    grupo.add(lavalier);
    grupo.add(barraEntre([0, cadera + 0.43, 0.25], [0.06, cadera + 0.31, 0.25], 0.006, negro));
  }
  grupo.userData.alturaRotulo = cabezaY + 0.32;
  return grupo;
}

function crearSillon(plazas) {
  const grupo = new THREE.Group();
  const { tapiz, tapizClaro, madera } = materialesBase();
  const medidas = MUEBLES_3D[`sillon${plazas}`];
  const base = caja(medidas.ancho, 0.24, medidas.fondo, tapiz, { sombra: true });
  base.position.y = 0.28;
  grupo.add(base);
  const asiento = caja(medidas.ancho - 0.18, 0.16, 0.58, tapizClaro, { sombra: true });
  asiento.position.set(0, medidas.asiento, 0.04);
  grupo.add(asiento);
  const respaldo = caja(medidas.ancho - 0.12, 0.48, 0.16, tapiz, { sombra: true });
  respaldo.position.set(0, 0.62, -0.31);
  respaldo.rotation.x = -0.08;
  grupo.add(respaldo);
  [-1, 1].forEach((lado) => {
    const brazo = caja(0.14, 0.42, 0.68, tapiz);
    brazo.position.set(lado * (medidas.ancho / 2 - 0.07), 0.42, 0);
    grupo.add(brazo);
    grupo.add(barraEntre([lado * (medidas.ancho / 2 - 0.12), 0.2, -0.25], [lado * (medidas.ancho / 2 - 0.12), 0.03, -0.25], 0.035, madera));
    grupo.add(barraEntre([lado * (medidas.ancho / 2 - 0.12), 0.2, 0.25], [lado * (medidas.ancho / 2 - 0.12), 0.03, 0.25], 0.035, madera));
  });
  return grupo;
}

function crearSillaDirector() {
  const grupo = new THREE.Group();
  const { maderaClara, lona, metal } = materialesBase();
  const x = 0.27;
  [-1, 1].forEach((lado) => {
    grupo.add(barraEntre([lado * x, 0.03, -0.22], [lado * x, 0.84, 0.22], 0.035, maderaClara));
    grupo.add(barraEntre([lado * x, 0.03, 0.22], [lado * x, 0.84, -0.22], 0.035, maderaClara));
    grupo.add(barraEntre([lado * x, 0.66, -0.08], [lado * x, 0.66, 0.4], 0.035, maderaClara));
    const brazo = caja(0.09, 0.055, 0.54, maderaClara);
    brazo.position.set(lado * x, 0.68, 0.14);
    grupo.add(brazo);
  });
  const asiento = caja(0.52, 0.055, 0.48, lona, { sombra: true });
  asiento.position.set(0, ALTURAS_3D.asientoBajo, 0.04);
  grupo.add(asiento);
  const respaldo = caja(0.54, 0.28, 0.045, lona, { sombra: true });
  respaldo.position.set(0, 0.82, -0.24);
  grupo.add(respaldo);
  grupo.add(barraEntre([-0.34, 0.04, 0], [0.34, 0.04, 0], 0.025, metal));
  return grupo;
}

export function crearModeloMueble(tipo) {
  const grupo = new THREE.Group();
  const { madera, maderaClara, metal, tapiz, tapizClaro } = materialesBase();
  const medidas = MUEBLES_3D[tipo] || MUEBLES_3D.sillon1;

  if (tipo === "mesa") {
    const tablero = caja(medidas.ancho, 0.1, medidas.fondo, maderaClara, { sombra: true });
    tablero.position.y = medidas.alto;
    grupo.add(tablero);
    const frente = caja(medidas.ancho - 0.24, 0.52, 0.09, materialPbr("frente escritorio", "#48515B", 0.65, 0.18), { sombra: true });
    frente.position.set(0, 0.43, 0.3);
    grupo.add(frente);
    const zocalo = caja(medidas.ancho - 0.38, 0.055, 0.14, metal);
    zocalo.position.set(0, 0.12, 0.33);
    grupo.add(zocalo);
  } else if (tipo === "mesaRedonda") {
    const tablero = cilindro(medidas.ancho / 2, medidas.ancho / 2, 0.1, maderaClara, 24, { sombra: true });
    tablero.position.y = medidas.alto;
    grupo.add(tablero);
    const pedestal = cilindro(0.14, 0.3, medidas.alto - 0.05, metal, 12, { sombra: true });
    pedestal.position.y = (medidas.alto - 0.05) / 2;
    grupo.add(pedestal);
  } else if (tipo === "podio") {
    const cuerpo = caja(0.5, 0.88, 0.42, madera, { sombra: true });
    cuerpo.position.set(0, 0.47, 0);
    cuerpo.rotation.x = -0.04;
    grupo.add(cuerpo);
    const tapa = caja(0.68, 0.08, 0.58, maderaClara, { sombra: true });
    tapa.position.set(0, 0.98, 0.03);
    tapa.rotation.x = -0.14;
    grupo.add(tapa);
    const frente = caja(0.34, 0.3, 0.02, materialPbr("placa podio", "#253246", 0.55, 0.22));
    frente.position.set(0, 0.58, 0.221);
    grupo.add(frente);
  } else if (/^sillon[123]$/.test(tipo)) {
    return crearSillon(Number(tipo.at(-1)));
  } else if (tipo === "silla") {
    return crearSillaDirector();
  } else if (tipo === "banco") {
    const asiento = cilindro(0.25, 0.25, 0.1, tapizClaro, 18, { sombra: true });
    asiento.position.y = medidas.asiento;
    grupo.add(asiento);
    grupo.add(barraEntre([0, 0.06, 0], [0, medidas.asiento - 0.05, 0], 0.045, metal));
    const aro = new THREE.Mesh(geoToro(0.22, 0.018, 18), metal);
    aro.rotation.x = Math.PI / 2;
    aro.position.y = 0.28;
    grupo.add(aro);
    [-1, 1].forEach((lado) => {
      grupo.add(barraEntre([0, 0.27, 0], [lado * 0.25, 0.03, 0.18], 0.025, metal));
      grupo.add(barraEntre([0, 0.27, 0], [lado * 0.25, 0.03, -0.18], 0.025, metal));
    });
  } else {
    return crearSillon(1);
  }
  grupo.userData.alturaRotulo = medidas.alto + 0.35;
  return grupo;
}

function crearFresnel(luz, altura) {
  const grupo = new THREE.Group();
  const { negro, negroMate, cristal } = materialesBase();
  agregarSoporteLuz(grupo, altura);
  const cuerpo = cilindro(0.18, 0.24, 0.42, negro, 14, { sombra: true });
  cuerpo.rotation.x = Math.PI / 2;
  cuerpo.position.set(0, altura, -0.08);
  grupo.add(cuerpo);
  const lente = cilindro(0.155, 0.155, 0.025, cristal, 16);
  lente.rotation.x = Math.PI / 2;
  lente.position.set(0, altura, 0.145);
  grupo.add(lente);
  agregarPuertas(grupo, altura, 0.24, 0.38, 0.34);
  const detalle = caja(0.08, 0.08, 0.02, materialPbr(`detalle luz ${luz.color}`, luz.color || "#F59E0B", 0.45, 0.1));
  detalle.position.set(0.2, altura, 0.03);
  grupo.add(detalle);
  return grupo;
}

function crearPanel(luz, altura) {
  const grupo = new THREE.Group();
  const { negro, blanco } = materialesBase();
  agregarSoporteLuz(grupo, altura);
  const carcasa = caja(0.64, 0.44, 0.12, negro, { sombra: true });
  carcasa.position.set(0, altura, 0);
  grupo.add(carcasa);
  const difusor = caja(0.54, 0.34, 0.018, materialPbr("difusor led", "#FFF7DD", 0.8, 0, { emissive: "#FFF1C4", emissiveIntensity: 0.26 }));
  difusor.position.set(0, altura, 0.071);
  grupo.add(difusor);
  agregarPuertas(grupo, altura, 0.13, 0.6, 0.42);
  return grupo;
}

function crearSombrilla(altura) {
  const grupo = new THREE.Group();
  const { plata, metal } = materialesBase();
  agregarSoporteLuz(grupo, altura);
  const copa = malla(geoCono(0.62, 0.3, 16, true), materialPbr("sombrilla plata", "#D5D8DA", 0.35, 0.68, { side: THREE.DoubleSide }), { sombra: true });
  copa.rotation.x = -Math.PI / 2;
  copa.position.set(0, altura, 0.14);
  grupo.add(copa);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    grupo.add(barraEntre([0, altura, -0.02], [Math.cos(a) * 0.6, altura + Math.sin(a) * 0.6, 0.28], 0.008, metal));
  }
  grupo.add(barraEntre([0, altura, -0.42], [0, altura, 0.18], 0.018, metal));
  return grupo;
}

function crearSoftbox(altura) {
  const grupo = new THREE.Group();
  const { negro } = materialesBase();
  agregarSoporteLuz(grupo, altura);
  const cajaNegra = caja(0.74, 0.52, 0.34, negro, { sombra: true });
  cajaNegra.position.set(0, altura, -0.08);
  grupo.add(cajaNegra);
  const tela = caja(0.68, 0.46, 0.02, materialPbr("tela softbox", "#FFFDF5", 0.92, 0, { emissive: "#FFF7DA", emissiveIntensity: 0.18 }));
  tela.position.set(0, altura, 0.1);
  grupo.add(tela);
  return grupo;
}

function crearTubo(altura) {
  const grupo = new THREE.Group();
  const { metal } = materialesBase();
  agregarSoporteLuz(grupo, altura - 0.15);
  const tubo = cilindro(0.045, 0.045, 0.82, materialPbr("tubo led", "#F8F4E6", 0.45, 0.02, { emissive: "#FFF0B7", emissiveIntensity: 0.3 }), 10, { sombra: true });
  tubo.position.set(0, altura, 0.05);
  grupo.add(tubo);
  grupo.add(barraEntre([0, altura - 0.42, 0], [0, altura + 0.42, 0], 0.055, metal));
  return grupo;
}

function crearReflector(altura) {
  const grupo = new THREE.Group();
  const { plata, metal } = materialesBase();
  agregarSoporteLuz(grupo, altura);
  const disco = malla(
    geometria("reflector:circulo", () => new THREE.CircleGeometry(0.52, 24)),
    materialPbr("reflector plata", "#D9DADB", 0.3, 0.68, { side: THREE.DoubleSide }),
    { sombra: true }
  );
  disco.position.set(0, altura, 0.03);
  grupo.add(disco);
  const aro = new THREE.Mesh(geoToro(0.52, 0.018, 24), metal);
  aro.position.set(0, altura, 0.04);
  grupo.add(aro);
  return grupo;
}

function crearBandera(luz, altura) {
  const grupo = new THREE.Group();
  const { metal, negroMate } = materialesBase();
  agregarSoporteLuz(grupo, altura, true);
  const esDifusor = luz.forma === "difusor";
  const panel = caja(
    0.78,
    0.58,
    0.025,
    esDifusor
      ? materialPbr("difusión", "#F5F4ED", 0.98, 0, { transparent: true, opacity: 0.68, side: THREE.DoubleSide })
      : negroMate,
    { sombra: !esDifusor }
  );
  panel.position.set(0, altura, 0.64);
  grupo.add(panel);
  [[-0.42, -0.32], [0.42, -0.32], [-0.42, 0.32], [0.42, 0.32]].forEach(([x, y]) => {
    grupo.add(barraEntre([x, altura + y, 0.6], [x, altura + y, 0.68], 0.012, metal));
  });
  return grupo;
}

function crearPractica(altura) {
  const grupo = new THREE.Group();
  const { madera, metal } = materialesBase();
  grupo.add(barraEntre([0, 0.04, 0], [0, altura - 0.22, 0], 0.025, metal));
  const base = cilindro(0.28, 0.28, 0.045, metal, 18, { sombra: true });
  base.position.y = 0.025;
  grupo.add(base);
  const pantalla = malla(geoCono(0.34, 0.42, 18, true), materialPbr("pantalla lámpara", "#E2C49A", 0.85, 0, { side: THREE.DoubleSide }), { sombra: true });
  pantalla.position.y = altura;
  grupo.add(pantalla);
  const bombilla = esfera(0.09, materialPbr("bombilla", "#FFF2C4", 0.4, 0, { emissive: "#FFD58A", emissiveIntensity: 0.65 }), 12);
  bombilla.position.y = altura - 0.08;
  grupo.add(bombilla);
  return grupo;
}

function crearCabezaMovil(altura) {
  const grupo = new THREE.Group();
  const { negro, metal, cristal } = materialesBase();
  agregarSoporteLuz(grupo, altura - 0.3);
  const base = cilindro(0.22, 0.25, 0.2, negro, 14, { sombra: true });
  base.position.y = altura - 0.22;
  grupo.add(base);
  grupo.add(barraEntre([-0.2, altura - 0.2, 0], [-0.2, altura + 0.2, 0], 0.035, metal));
  grupo.add(barraEntre([0.2, altura - 0.2, 0], [0.2, altura + 0.2, 0], 0.035, metal));
  const cabeza = cilindro(0.17, 0.2, 0.34, negro, 14, { sombra: true });
  cabeza.rotation.x = Math.PI / 2;
  cabeza.position.y = altura + 0.12;
  grupo.add(cabeza);
  const lente = cilindro(0.11, 0.11, 0.02, cristal, 14);
  lente.rotation.x = Math.PI / 2;
  lente.position.set(0, altura + 0.12, 0.18);
  grupo.add(lente);
  return grupo;
}

function crearCenital(altura) {
  const grupo = new THREE.Group();
  const { metal, negro } = materialesBase();
  grupo.add(barraEntre([-0.9, altura, 0], [0.9, altura, 0], 0.035, metal));
  grupo.add(barraEntre([-0.58, altura, -0.28], [-0.58, altura, 0.28], 0.022, metal));
  grupo.add(barraEntre([0.58, altura, -0.28], [0.58, altura, 0.28], 0.022, metal));
  grupo.add(barraEntre([0, altura, 0], [0, altura - 0.3, 0], 0.018, metal));
  const cabeza = caja(0.58, 0.16, 0.42, negro, { sombra: true });
  cabeza.position.y = altura - 0.38;
  grupo.add(cabeza);
  const panel = caja(0.5, 0.018, 0.34, materialPbr("cenital", "#FFF8DE", 0.7, 0, { emissive: "#FFE7A3", emissiveIntensity: 0.24 }));
  panel.position.y = altura - 0.47;
  grupo.add(panel);
  return grupo;
}

export function crearModeloLuz(luz) {
  const esCenital = luz.forma === "top" || String(luz.tipo || "").includes("top");
  const altura = esCenital ? ALTURAS_3D.luzCenital : ALTURAS_3D.luz;
  let grupo;
  if (esCenital || luz.forma === "wash") grupo = crearCenital(altura);
  else if (luz.forma === "fresnel") grupo = crearFresnel(luz, altura);
  else if (luz.forma === "panel") grupo = crearPanel(luz, altura);
  else if (luz.forma === "softbox") grupo = luz.tipo === "soft_key_light" ? crearSombrilla(altura) : crearSoftbox(altura);
  else if (luz.forma === "tube") grupo = crearTubo(altura);
  else if (luz.forma === "reflector") grupo = crearReflector(altura);
  else if (["flag", "control", "difusor"].includes(luz.forma)) grupo = crearBandera(luz, altura);
  else if (luz.forma === "practical") grupo = crearPractica(1.42);
  else if (["movil", "fx"].includes(luz.forma)) grupo = crearCabezaMovil(altura);
  else grupo = crearFresnel(luz, altura);
  grupo.userData.alturaHaz = esCenital ? altura - 0.47 : altura;
  grupo.userData.alturaRotulo = altura + 0.55;
  return grupo;
}

export function crearModeloBoom() {
  const grupo = new THREE.Group();
  const { metal, negro, negroMate } = materialesBase();
  agregarSoporteLuz(grupo, 1.72, true);
  grupo.add(barraEntre([0, 1.72, -0.18], [0, ALTURAS_3D.boom, 1.38], 0.025, metal));
  const blimp = cilindro(0.085, 0.085, 0.46, negroMate, 12, { sombra: true });
  blimp.rotation.x = Math.PI / 2;
  blimp.position.set(0, ALTURAS_3D.boom, 1.6);
  grupo.add(blimp);
  const punta = esfera(0.086, negro, 10);
  punta.scale.z = 0.62;
  punta.position.set(0, ALTURAS_3D.boom, 1.83);
  grupo.add(punta);
  grupo.userData.alturaRotulo = ALTURAS_3D.boom + 0.35;
  return grupo;
}

export function crearModeloMicSuelto(tipo = "mano") {
  const grupo = new THREE.Group();
  const { metal, negro, negroMate } = materialesBase();
  const altura = tipo === "mano" || tipo === "dinamico" ? 1.0 : 0.72;
  agregarSoporteLuz(grupo, altura);
  const mango = cilindro(0.035, 0.045, 0.28, negro, 10);
  mango.position.set(0, altura + 0.08, 0);
  grupo.add(mango);
  const rejilla = esfera(0.065, negroMate, 10);
  rejilla.scale.y = 1.18;
  rejilla.position.set(0, altura + 0.25, 0);
  grupo.add(rejilla);
  return grupo;
}

export function crearModeloClaqueta() {
  const grupo = new THREE.Group();
  const { negroMate, blanco } = materialesBase();
  const tablero = caja(0.52, 0.31, 0.045, negroMate, { sombra: true });
  tablero.position.set(0, 0.18, 0);
  tablero.rotation.x = -0.18;
  grupo.add(tablero);
  [0.02, 0.11, 0.2].forEach((y) => {
    const linea = caja(0.4, 0.012, 0.012, blanco);
    linea.position.set(0, 0.08 + y, 0.03);
    linea.rotation.x = -0.18;
    grupo.add(linea);
  });
  const bisagra = caja(0.56, 0.08, 0.055, blanco, { sombra: true });
  bisagra.position.set(0, 0.38, -0.02);
  bisagra.rotation.z = -0.12;
  grupo.add(bisagra);
  for (let i = -2; i <= 2; i += 2) {
    const franja = caja(0.07, 0.082, 0.058, negroMate);
    franja.position.set(i * 0.1, 0.38 + i * -0.012, -0.051);
    franja.rotation.z = -0.12;
    grupo.add(franja);
  }
  return grupo;
}

// Los recursos se liberan al cerrar el visor; vaciar las cachés permite que
// una apertura posterior reconstruya materiales y geometrías válidos.
export function reiniciarCacheModelos3D() {
  materiales.clear();
  geometrias.clear();
}

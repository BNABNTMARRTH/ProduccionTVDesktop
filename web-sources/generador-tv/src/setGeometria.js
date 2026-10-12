// Geometría compartida del plano del set. Este módulo es puro: concentra las
// medidas, posiciones y direcciones que deben coincidir entre la planta 2D,
// las hojas impresas y el visor 3D.

export const UNIDADES_POR_METRO = 52;
export const MARGEN_PLANO = 20;
export const ANCHO_LIENZO_COMO_ESTABA = 980;
export const ANCHO_PANTALLA_PLANO_COMO_ESTABA = 500;
export const ANCHO_PANTALLA_3D_COMO_ESTABA = 4.95;
export const MARGEN_LATERAL_PANTALLA_METROS = 0.3;
export const RADIO_CICLORAMA_METROS = 0.6;
const DESFASE_Y_PANTALLA_PLANO = 18;
const ALTO_PANTALLA_PLANO = 16;
const HOLGURA_CICLORAMA_METROS = 0.01;
const Z_LOCAL_FRENTE_PANTALLA_3D = 0.15;
const Z_LOCAL_MIN_PANTALLA_3D = 0.12 - 0.38 / 2;
const Z_LOCAL_MAX_PANTALLA_3D = 0.12 + 0.38 / 2;
const MEDIO_FONDO_MARCO_PANTALLA_3D = 0.06;
const Y_MIN_PANTALLA_3D = 0.03 - 0.025;
const Y_MAX_PANTALLA_3D = 1.93 + 1.98 / 2;
export const FORO_COMO_ESTABA = Object.freeze({
  ancho: (ANCHO_LIENZO_COMO_ESTABA - MARGEN_PLANO * 2) / UNIDADES_POR_METRO,
  fondo: (600 - MARGEN_PLANO * 2) / UNIDADES_POR_METRO,
  alto: 4,
});

const RANGOS_FORO = Object.freeze({
  ancho: [2, 40],
  fondo: [2, 40],
  alto: [2.2, 12],
});

const numeroValido = (valor, respaldo) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : respaldo;
};

const acotarNumero = (valor, [minimo, maximo], respaldo) => (
  Math.max(minimo, Math.min(maximo, numeroValido(valor, respaldo)))
);

export function medidasForo(set) {
  const guardadas = set?.setLayout?.foro || {};
  return {
    ancho: acotarNumero(guardadas.ancho, RANGOS_FORO.ancho, FORO_COMO_ESTABA.ancho),
    fondo: acotarNumero(guardadas.fondo, RANGOS_FORO.fondo, FORO_COMO_ESTABA.fondo),
    alto: acotarNumero(guardadas.alto, RANGOS_FORO.alto, FORO_COMO_ESTABA.alto),
  };
}

export function geometriaPlano(set) {
  const metros = medidasForo(set);
  return {
    ancho: metros.ancho * UNIDADES_POR_METRO + MARGEN_PLANO * 2,
    alto: metros.fondo * UNIDADES_POR_METRO + MARGEN_PLANO * 2,
    margen: MARGEN_PLANO,
    unidadesPorMetro: UNIDADES_POR_METRO,
    metros,
  };
}

// Las anotaciones no representan metros: deben conservar el mismo tamaño en
// pantalla aunque cambie el viewBox. En el foro histórico el factor es 1.
export function escalaAnotacionesPlano(set) {
  return geometriaPlano(set).ancho / ANCHO_LIENZO_COMO_ESTABA;
}

// La pantalla es escenografía y no puede atravesar los muros. Cada vista
// conserva su tamaño histórico y aplica el mismo resguardo físico por lado.
export function medidasPantallaDelForo(set) {
  const foro = medidasForo(set);
  const anchoDisponible = Math.max(
    0,
    foro.ancho - MARGEN_LATERAL_PANTALLA_METROS * 2
  );
  const escala3d = Math.max(0.25, Math.min(
    1,
    anchoDisponible / ANCHO_PANTALLA_3D_COMO_ESTABA,
    (foro.alto - 0.15) / 2.94
  ));
  return {
    anchoPlano: Math.min(
      ANCHO_PANTALLA_PLANO_COMO_ESTABA,
      anchoDisponible * UNIDADES_POR_METRO
    ),
    ancho3d: ANCHO_PANTALLA_3D_COMO_ESTABA * escala3d,
    escala3d,
    margenLateral: MARGEN_LATERAL_PANTALLA_METROS,
  };
}

export function bandaPantallaDelForo(set) {
  const plano = geometriaPlano(set);
  const { anchoPlano } = medidasPantallaDelForo(set);
  return {
    x: (plano.ancho - anchoPlano) / 2,
    y: plano.margen + DESFASE_Y_PANTALLA_PLANO,
    ancho: anchoPlano,
    alto: ALTO_PANTALLA_PLANO,
  };
}

// La cara visible coincide con el frente de la banda del plano 2D. El marco
// queda delante del radio del ciclorama, con una holgura que evita el z-fight.
export function posicionPantallaDelForo(set) {
  const foro = medidasForo(set);
  const { escala3d } = medidasPantallaDelForo(set);
  const banda = bandaPantallaDelForo(set);
  const zMuro = -foro.fondo / 2;
  const frenteBanda = (banda.y + banda.alto - geometriaPlano(set).alto / 2)
    / UNIDADES_POR_METRO;
  const desdeMuro = Math.max(
    frenteBanda - zMuro,
    RADIO_CICLORAMA_METROS
      + HOLGURA_CICLORAMA_METROS
      + MEDIO_FONDO_MARCO_PANTALLA_3D * escala3d
  );
  const zFrente = zMuro + desdeMuro;
  return {
    zMuro,
    zFrente,
    zGrupo: zFrente - Z_LOCAL_FRENTE_PANTALLA_3D * escala3d,
    zMin: zFrente + (Z_LOCAL_MIN_PANTALLA_3D - Z_LOCAL_FRENTE_PANTALLA_3D) * escala3d,
    zMax: zFrente + (Z_LOCAL_MAX_PANTALLA_3D - Z_LOCAL_FRENTE_PANTALLA_3D) * escala3d,
    yMin: Y_MIN_PANTALLA_3D * escala3d,
    yMax: Y_MAX_PANTALLA_3D * escala3d,
  };
}

// Las luces de fondo apuntan al muro real, no a cinco metros de distancia.
export function zObjetivoParedPosterior(set) {
  return -medidasForo(set).fondo / 2 + HOLGURA_CICLORAMA_METROS;
}

// Reduce los desplazamientos históricos cuando el foro es menor. Una sola
// escala conserva la composición del set y vale exactamente 1 en el lienzo
// legado, por lo que los proyectos existentes no cambian.
export function escalaDefaultsDelForo(set) {
  const metros = medidasForo(set);
  return Math.min(
    1,
    metros.ancho / FORO_COMO_ESTABA.ancho,
    metros.fondo / FORO_COMO_ESTABA.fondo
  );
}

// Única ruta de escritura de las medidas. Una futura captura RoomPlan/LiDAR
// puede entregar aquí su resultado sin conocer la forma interna del proyecto.
export function aplicarMedidasForo(set, medidas) {
  const actuales = medidasForo(set);
  const planoActual = geometriaPlano(set);
  const foro = {
    ancho: acotarNumero(medidas?.ancho, RANGOS_FORO.ancho, actuales.ancho),
    fondo: acotarNumero(medidas?.fondo, RANGOS_FORO.fondo, actuales.fondo),
    alto: acotarNumero(medidas?.alto, RANGOS_FORO.alto, actuales.alto),
  };
  const anchoNuevo = foro.ancho * UNIDADES_POR_METRO + MARGEN_PLANO * 2;
  const altoNuevo = foro.fondo * UNIDADES_POR_METRO + MARGEN_PLANO * 2;
  const dx = (anchoNuevo - planoActual.ancho) / 2;
  const dy = (altoNuevo - planoActual.alto) / 2;
  const posActual = set?.setLayout?.pos || {};
  const pos = dx === 0 && dy === 0
    ? posActual
    : Object.fromEntries(Object.entries(posActual).map(([clave, punto]) => {
      const x = Number(punto?.x);
      const y = Number(punto?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [clave, punto];
      return [clave, { ...punto, x: x + dx, y: y + dy }];
    }));
  return {
    ...set,
    setLayout: { ...(set?.setLayout || {}), foro, pos },
  };
}

export function limitesDelForo(set) {
  const { ancho, alto, margen } = geometriaPlano(set);
  return { xMin: margen, xMax: ancho - margen, yMin: margen, yMax: alto - margen };
}

export function puntoFueraDelForo(punto, set, resguardo = {}) {
  if (!punto || !Number.isFinite(Number(punto.x)) || !Number.isFinite(Number(punto.y))) return true;
  const limites = limitesDelForo(set);
  const izquierda = resguardo.izquierda ?? resguardo.x ?? 0;
  const derecha = resguardo.derecha ?? resguardo.x ?? 0;
  const arriba = resguardo.arriba ?? resguardo.y ?? 0;
  const abajo = resguardo.abajo ?? resguardo.y ?? 0;
  return punto.x < limites.xMin + izquierda || punto.x > limites.xMax - derecha
    || punto.y < limites.yMin + arriba || punto.y > limites.yMax - abajo;
}

export function acotarPuntoAlForo(punto, set, resguardo = {}) {
  const limites = limitesDelForo(set);
  const xMin = limites.xMin + (resguardo.izquierda ?? resguardo.x ?? 0);
  const xMax = limites.xMax - (resguardo.derecha ?? resguardo.x ?? 0);
  const yMin = limites.yMin + (resguardo.arriba ?? resguardo.y ?? 0);
  const yMax = limites.yMax - (resguardo.abajo ?? resguardo.y ?? 0);
  const acotarEje = (valor, minimo, maximo) => {
    const numero = Number(valor);
    const seguro = Number.isFinite(numero) ? numero : (minimo + maximo) / 2;
    return minimo <= maximo
      ? Math.max(minimo, Math.min(maximo, seguro))
      : (minimo + maximo) / 2;
  };
  return {
    x: Math.round(acotarEje(punto?.x, xMin, xMax)),
    y: Math.round(acotarEje(punto?.y, yMin, yMax)),
  };
}

// Huellas cenitales de la escenografía fija. El cálculo rotado usa la caja
// envolvente para que ni una esquina del mueble atraviese el muro.
const HUELLAS_MUEBLES = Object.freeze({
  mesa: [56, 23],
  mesaRedonda: [34, 34],
  podio: [17, 17],
  sillon1: [24, 16],
  sillon2: [38, 16],
  sillon3: [52, 16],
  silla: [12, 14],
  banco: [11, 11],
});

export function resguardoElementoPlano(clave, set) {
  if (clave === "mesa" && set?.mesaVisible !== false) {
    return { izquierda: 110, derecha: 110, arriba: 34, abajo: 34 };
  }
  if (!String(clave || "").startsWith("mue:")) return null;
  const id = String(clave).slice(4);
  const mueble = (set?.muebles || []).find((item) => String(item.id) === id);
  if (!mueble) return null;
  const [mitadX, mitadY] = HUELLAS_MUEBLES[mueble.tipo] || HUELLAS_MUEBLES.sillon1;
  const giro = Number(set?.setLayout?.rot?.[clave]) || 0;
  const radianes = (giro * Math.PI) / 180;
  const x = Math.abs(Math.cos(radianes)) * mitadX + Math.abs(Math.sin(radianes)) * mitadY;
  const y = Math.abs(Math.sin(radianes)) * mitadX + Math.abs(Math.cos(radianes)) * mitadY;
  return { izquierda: x, derecha: x, arriba: y, abajo: y };
}

// Conserva exactamente los resguardos históricos (48/100/932/556) en el
// foro legado. La escenografía puede pedir más espacio para conservar dentro
// del cuarto todo su volumen, no solamente su punto central.
export function acotarPuntoArrastrable(punto, set, resguardo = {}) {
  return acotarPuntoAlForo(punto, set, {
    izquierda: Math.max(28, resguardo.izquierda ?? resguardo.x ?? 0),
    derecha: Math.max(28, resguardo.derecha ?? resguardo.x ?? 0),
    arriba: Math.max(80, resguardo.arriba ?? resguardo.y ?? 0),
    abajo: Math.max(24, resguardo.abajo ?? resguardo.y ?? 0),
  });
}

export function clavesActivasDelSet(cfg, set, cams = null) {
  const claves = new Set();
  if (set?.mesaVisible !== false) claves.add("mesa");
  (cfg?.talentos || []).forEach((talento) => {
    claves.add(`tal:${talento.id}`);
    if (talento._legacyPosKey) claves.add(talento._legacyPosKey);
  });
  (cams || cfg?.camaras || []).forEach((camara) => claves.add(`cam:${camara.id}`));
  (cfg?.microfonos || []).forEach((mic) => claves.add(`mic:${mic.id}`));
  (set?.muebles || []).forEach((mueble) => claves.add(`mue:${mueble.id}`));
  (set?.iluminacion?.luces || []).forEach((luz) => claves.add(`luz:${luz.id}`));
  return claves;
}

export function posicionesFueraDelForo(set, clavesActivas = null) {
  const filtro = clavesActivas == null
    ? null
    : (clavesActivas instanceof Set ? clavesActivas : new Set(clavesActivas));
  return Object.entries(set?.setLayout?.pos || {})
    .filter(([clave, punto]) => (
      (!filtro || filtro.has(clave))
      && puntoFueraDelForo(punto, set, resguardoElementoPlano(clave, set) || {})
    ));
}

export function traerElementosAdentro(set, clavesActivas = null) {
  const posActual = set?.setLayout?.pos || {};
  const fuera = new Set(posicionesFueraDelForo(set, clavesActivas).map(([clave]) => clave));
  let cambio = false;
  const pos = Object.fromEntries(Object.entries(posActual).map(([clave, punto]) => {
    if (!fuera.has(clave)) return [clave, punto];
    cambio = true;
    return [clave, acotarPuntoArrastrable(
      punto,
      set,
      resguardoElementoPlano(clave, set) || {}
    )];
  }));
  return cambio
    ? { ...set, setLayout: { ...(set?.setLayout || {}), pos } }
    : set;
}

export const SENSOR_FULL_FRAME = Object.freeze({ ancho: 36, alto: 24 });

// Todas las alturas están expresadas en metros.
export const ALTURAS_3D = Object.freeze({
  // Centro óptico del modelo Sony FX6 propio (el conjunto completo mide 1.547 m).
  lenteCamara: 1.38,
  mesa: 0.75,
  personaDePie: 1.7,
  personaSentada: 1.25,
  asientoBajo: 0.43,
  asientoAlto: 0.72,
  boom: 2.1,
  luz: 2.2,
  luzCenital: 3.0,
  muro: 3.2,
});

export function clasificarMicrofonos(cfg, cams = []) {
  const talentos = cfg.talentos || [];
  const mics = cfg.microfonos || [];
  const talIds = new Set(talentos.map((t) => t.id));
  const camIds = new Set(cams.map((c) => c.id));

  return {
    micsDeTal: (talentoId) => mics.filter((m) => m.micTipo !== "boom" && m.asignadoA === `tal:${talentoId}`),
    shotgunDe: (camaraId) => mics.filter((m) => m.micTipo === "shotgun" && m.asignadoA === `cam:${camaraId}`),
    booms: mics.filter((m) => m.micTipo === "boom"),
    sueltos: mics.filter((m) => {
      if (m.micTipo === "boom") return false;
      const asignado = m.asignadoA || "";
      if (m.micTipo === "shotgun") return !(asignado.startsWith("cam:") && camIds.has(asignado.slice(4)));
      return !(asignado.startsWith("tal:") && talIds.has(asignado.slice(4)));
    }),
  };
}

export function posicionesDefaultDelSet(cfg, set, cams = []) {
  const { ancho, alto } = geometriaPlano(set);
  const centroX = ancho / 2;
  const centroY = alto / 2;
  const escala = escalaDefaultsDelForo(set);
  const talentos = cfg.talentos || [];
  const muebles = set.muebles || [];
  const { booms, sueltos } = clasificarMicrofonos(cfg, cams);
  const acotarDefault = (punto, clave = null) => {
    const resguardo = clave ? (resguardoElementoPlano(clave, set) || {}) : {};
    return puntoFueraDelForo(punto, set, resguardo)
      ? acotarPuntoAlForo(punto, set, resguardo)
      : punto;
  };
  const defaults = { mesa: acotarDefault({ x: centroX, y: centroY - 60 * escala }, "mesa") };

  talentos.forEach((talento, indice) => {
    const k = talentos.length === 1 ? 0 : -1 + (2 * indice) / (talentos.length - 1);
    defaults[`tal:${talento.id}`] = acotarDefault({
      x: centroX + k * Math.min(170, 50 + talentos.length * 26) * escala,
      y: centroY - 132 * escala,
    });
  });
  booms.forEach((mic, indice) => {
    defaults[`mic:${mic.id}`] = acotarDefault({
      x: centroX + (155 + indice * 58) * escala,
      y: centroY - 95 * escala,
    });
  });
  sueltos.forEach((mic, indice) => {
    defaults[`mic:${mic.id}`] = acotarDefault({
      x: centroX + (-275 + indice * 54) * escala,
      y: centroY + 5 * escala,
    });
  });
  muebles.forEach((mueble, indice) => {
    defaults[`mue:${mueble.id}`] = posicionMuebleDefault(indice, set);
  });
  cams.forEach((camara, indice) => {
    const k = cams.length === 1 ? 0 : -1 + (2 * indice) / (cams.length - 1);
    const angulo = (k * 70 * Math.PI) / 180;
    defaults[`cam:${camara.id}`] = acotarDefault({
      x: centroX + Math.sin(angulo) * 330 * escala,
      y: centroY + (-50 + Math.cos(angulo) * 240) * escala,
    });
  });

  return defaults;
}

export function crearGeometriaSet({ cfg, set, cams = [], live = null, liveRot = null }) {
  const defaults = posicionesDefaultDelSet(cfg, set, cams);
  const plano = geometriaPlano(set);
  const guardadas = set.setLayout?.pos || {};
  const girosGuardados = set.setLayout?.rot || {};
  const posDe = (key) => live?.[key] || guardadas[key] || defaults[key] || { x: plano.ancho / 2, y: plano.alto / 2 + 20 };
  const giroManualDe = (key) => liveRot?.[key] ?? girosGuardados[key];

  const rotacionDe = (key, tipo, dir = null) => {
    const manual = giroManualDe(key);
    if (typeof manual === "number") return manual;
    if (tipo === "camara" || tipo === "boom" || dir === "mesa") {
      const punto = posDe(key);
      const mesa = posDe("mesa");
      return (Math.atan2(mesa.y - punto.y, mesa.x - punto.x) * 180) / Math.PI;
    }
    if (dir === "muro") return -90;
    return tipo === "luz" ? null : 0;
  };

  return { defaults, plano, posDe, giroManualDe, rotacionDe };
}

export function posicionMuebleDefault(indice, set) {
  const { ancho, alto } = geometriaPlano(set);
  const escala = escalaDefaultsDelForo(set);
  const punto = {
    x: ancho / 2 + (-155 + (indice % 4) * 85) * escala,
    y: alto / 2 + (30 + Math.floor(indice / 4) * 75) * escala,
  };
  const mueble = set?.muebles?.[indice];
  const clave = mueble ? `mue:${mueble.id}` : null;
  const resguardo = clave ? (resguardoElementoPlano(clave, set) || {}) : {};
  return puntoFueraDelForo(punto, set, resguardo)
    ? acotarPuntoAlForo(punto, set, resguardo)
    : punto;
}

export function puntoPlanoAMetros(punto, set) {
  const plano = geometriaPlano(set);
  return {
    x: (punto.x - plano.ancho / 2) / plano.unidadesPorMetro,
    z: (punto.y - plano.alto / 2) / plano.unidadesPorMetro,
  };
}

export function distanciaFocalDeCamara(camara) {
  const focalEquipo = Number(camara?.equipo?.focal);
  if (Number.isFinite(focalEquipo) && focalEquipo > 0) return focalEquipo;

  const encontrada = String(camara?.nombre || "").match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  if (encontrada) return Number(encontrada[1].replace(",", "."));

  const plano = String(camara?.plano || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/general|abierto/.test(plano)) return 24;
  if (/primer plano|cerrado/.test(plano)) return 85;
  if (/medio/.test(plano)) return 50;
  return 35;
}

export function fovVerticalDesdeFocal(distanciaFocal, sensorMm = null) {
  const focal = Math.max(1, Number(distanciaFocal) || 35);
  const anchoSensor = Number(
    Array.isArray(sensorMm)
      ? sensorMm[0]
      : (sensorMm?.sensor_mm?.[0] ?? sensorMm?.ancho ?? sensorMm)
  );
  if (Number.isFinite(anchoSensor) && anchoSensor > 0) {
    // El catálogo guarda el ancho activo. Primero se obtiene el FOV horizontal
    // y luego el vertical del cuadro 16:9; la cámara genérica no entra aquí.
    const horizontal = 2 * Math.atan(anchoSensor / (2 * focal));
    return (2 * Math.atan(Math.tan(horizontal / 2) / (16 / 9)) * 180) / Math.PI;
  }
  // Compatibilidad exacta: los proyectos sin ficha conservan el cálculo viejo.
  return (2 * Math.atan(SENSOR_FULL_FRAME.alto / (2 * focal)) * 180) / Math.PI;
}

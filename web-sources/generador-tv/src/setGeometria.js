// Geometría compartida del plano del set. Este módulo es puro: concentra las
// posiciones y direcciones que deben coincidir entre la planta 2D y el visor 3D.
import { posMuebleDefault } from "./sets.js";

export const PLANO_SET = Object.freeze({
  ancho: 980,
  alto: 600,
  margen: 20,
  unidadesPorMetro: 52,
});

export const SENSOR_FULL_FRAME = Object.freeze({ ancho: 36, alto: 24 });

// Todas las alturas están expresadas en metros.
export const ALTURAS_3D = Object.freeze({
  lenteCamara: 1.5,
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
  const { ancho } = PLANO_SET;
  const talentos = cfg.talentos || [];
  const muebles = set.muebles || [];
  const { booms, sueltos } = clasificarMicrofonos(cfg, cams);
  const defaults = { mesa: { x: ancho / 2, y: 240 } };

  talentos.forEach((talento, indice) => {
    const k = talentos.length === 1 ? 0 : -1 + (2 * indice) / (talentos.length - 1);
    defaults[`tal:${talento.id}`] = {
      x: ancho / 2 + k * Math.min(170, 50 + talentos.length * 26),
      y: 168,
    };
  });
  booms.forEach((mic, indice) => {
    defaults[`mic:${mic.id}`] = { x: 645 + indice * 58, y: 205 };
  });
  sueltos.forEach((mic, indice) => {
    defaults[`mic:${mic.id}`] = { x: 215 + indice * 54, y: 305 };
  });
  muebles.forEach((mueble, indice) => {
    defaults[`mue:${mueble.id}`] = posMuebleDefault(indice);
  });
  cams.forEach((camara, indice) => {
    const k = cams.length === 1 ? 0 : -1 + (2 * indice) / (cams.length - 1);
    const angulo = (k * 70 * Math.PI) / 180;
    defaults[`cam:${camara.id}`] = {
      x: ancho / 2 + Math.sin(angulo) * 330,
      y: 250 + Math.cos(angulo) * 240,
    };
  });

  return defaults;
}

export function crearGeometriaSet({ cfg, set, cams = [], live = null, liveRot = null }) {
  const defaults = posicionesDefaultDelSet(cfg, set, cams);
  const guardadas = set.setLayout?.pos || {};
  const girosGuardados = set.setLayout?.rot || {};
  const posDe = (key) => live?.[key] || guardadas[key] || defaults[key] || { x: PLANO_SET.ancho / 2, y: 320 };
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

  return { defaults, posDe, giroManualDe, rotacionDe };
}

export function puntoPlanoAMetros(punto) {
  return {
    x: (punto.x - PLANO_SET.ancho / 2) / PLANO_SET.unidadesPorMetro,
    z: (punto.y - PLANO_SET.alto / 2) / PLANO_SET.unidadesPorMetro,
  };
}

export function distanciaFocalDeCamara(camara) {
  const encontrada = String(camara?.nombre || "").match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  if (encontrada) return Number(encontrada[1].replace(",", "."));

  const plano = String(camara?.plano || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/general|abierto/.test(plano)) return 24;
  if (/primer plano|cerrado/.test(plano)) return 85;
  if (/medio/.test(plano)) return 50;
  return 35;
}

export function fovVerticalDesdeFocal(distanciaFocal) {
  const focal = Math.max(1, Number(distanciaFocal) || 35);
  return (2 * Math.atan(SENSOR_FULL_FRAME.alto / (2 * focal)) * 180) / Math.PI;
}

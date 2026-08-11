// Modelo de SETS: cada proyecto tiene uno o varios espacios físicos (estudio,
// exterior, locación) y cada set guarda su propio plano (posiciones y giros),
// su iluminación y su mobiliario. Aquí viven las piezas puras de ese modelo:
// crear un set, saber cuál está seleccionado, parcharlo y reacomodarlo.
import { uid } from "./util.js";
import { posicionesParaLuces } from "./iluminacion.js";

export const setNuevo = (n = 1) => ({
  id: `set-${uid()}`, nombre: n === 1 ? "Set principal" : `Set ${n}`,
  locacion: "int", mesaVisible: true,
  setLayout: { pos: {}, rot: {} }, iluminacion: null, muebles: [],
});

// Set actualmente seleccionado (siempre existe tras normalizeCfg).
export const setActivoDe = (cfg) => (cfg.sets || []).find((s) => s.id === cfg.setActivo) || (cfg.sets || [])[0] || setNuevo(1);

// Aplica un parche funcional a un set por id dentro de un updater de setCfg.
export const upSetPor = (c, setId, fn) => ({ ...c, sets: (c.sets || []).map((s) => (s.id === setId ? fn(s) : s)) });

// Posición inicial (y de reacomodo) del mueble n en el lienzo.
export const posMuebleDefault = (n) => ({ x: 335 + (n % 4) * 85, y: 330 + Math.floor(n / 4) * 75 });

// "Reacomodar automáticamente": regresa mesa/talentos/cámaras a sus posiciones
// derivadas y recoloca luces y muebles en sus posiciones típicas (las luces y
// muebles no tienen default en el lienzo: sin esto caerían al centro).
export const reacomodoDe = (s) => {
  const pos = posicionesParaLuces(s.iluminacion?.luces);
  (s.muebles || []).forEach((m, i) => { pos[`mue:${m.id}`] = posMuebleDefault(i); });
  return { ...s, setLayout: { pos, rot: {} } };
};

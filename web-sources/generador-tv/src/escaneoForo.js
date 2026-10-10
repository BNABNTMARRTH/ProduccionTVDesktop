/* ESCANEAR EL FORO DESDE EL IFRAME.
   -------------------------------------------------------------------------
   La herramienta no ve window.go: vive dentro de un iframe y le pide al
   caparazón que cruce el último tramo hasta Swift. Es el mismo protocolo con
   folio que usan la agenda y la mesa de luz, pero con un reloj mucho más largo
   para la captura: recorrer un foro de verdad puede tomar varios minutos. */

import { EMBEDDED } from "./puente.js";

let folioSiguiente = 1;
const enEspera = new Map();
let consultaDeDisponibilidad = null;

if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (d?.type !== "producciontv:foro-respuesta") return;
    const pendiente = enEspera.get(d.folio);
    if (!pendiente) return;
    enEspera.delete(d.folio);
    clearTimeout(pendiente.reloj);
    if (d.ok) pendiente.cumplir(d.datos);
    else pendiente.fallar(new Error(d.error || "El escáner del foro no respondió"));
  });
}

function pedir(op, esperaMs) {
  if (!EMBEDDED) return Promise.reject(new Error("El escáner sólo está disponible dentro de la app."));
  const folio = folioSiguiente++;
  return new Promise((cumplir, fallar) => {
    const reloj = setTimeout(() => {
      enEspera.delete(folio);
      fallar(new Error("El escáner del foro tardó demasiado en responder"));
    }, esperaMs);
    enEspera.set(folio, { cumplir, fallar, reloj });
    window.parent.postMessage({ type: "producciontv:foro", op, folio }, "*");
  });
}

/** Se guarda la primera respuesta: aunque React remonte un efecto en desarrollo,
 *  el dispositivo sólo recibe una pregunta de capacidad. */
export function puedeEscanearForo() {
  if (!consultaDeDisponibilidad) {
    consultaDeDisponibilidad = pedir("disponible", 10000)
      .then(Boolean)
      .catch(() => false);
  }
  return consultaDeDisponibilidad;
}

/** Abre RoomPlan. La promesa termina cuando la pantalla nativa ya se cerró. */
export const escanearForo = () => pedir("escanear", 15 * 60 * 1000);

const numeroPositivo = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

const conteo = (valor) => {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) && numero >= 0 ? Math.trunc(numero) : 0;
};

/** La respuesta nativa cruza dos puentes y por eso se valida antes de enseñarla
 *  o guardarla. Los límites editoriales se aplican después, exclusivamente en
 *  aplicarMedidasForo, que sigue siendo la única ruta de escritura. */
export function normalizarEscaneoForo(resultado) {
  if (!resultado || resultado.ok !== true) return null;
  const ancho = numeroPositivo(resultado.ancho);
  const fondo = numeroPositivo(resultado.fondo);
  const alto = numeroPositivo(resultado.alto);
  if (ancho === null || fondo === null || alto === null) return null;
  return {
    ok: true,
    ancho,
    fondo,
    alto,
    paredes: conteo(resultado.paredes),
    puertas: conteo(resultado.puertas),
    ventanas: conteo(resultado.ventanas),
    aberturas: conteo(resultado.aberturas),
  };
}

export function intercambiarEscaneoForo(resultado) {
  const valido = normalizarEscaneoForo(resultado);
  return valido ? { ...valido, ancho: valido.fondo, fondo: valido.ancho } : null;
}

const conPlural = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

/** Texto estable y probado aparte: las medidas conservan los centímetros que
 *  entrega RoomPlan; los campos pasarán a décimas sólo cuando se acepten. */
export function describirEscaneoForo(resultado) {
  const valido = normalizarEscaneoForo(resultado);
  if (!valido) return "";
  const encontrados = [conPlural(valido.paredes, "pared", "paredes")];
  if (valido.puertas) encontrados.push(conPlural(valido.puertas, "puerta", "puertas"));
  if (valido.ventanas) encontrados.push(conPlural(valido.ventanas, "ventana", "ventanas"));
  if (valido.aberturas) encontrados.push(conPlural(valido.aberturas, "abertura", "aberturas"));
  return `Medí ${valido.ancho.toFixed(2)} × ${valido.fondo.toFixed(2)} m, alto ${valido.alto.toFixed(2)} m (${encontrados.join(", ")})`;
}

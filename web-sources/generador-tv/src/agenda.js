/* LA AGENDA DE CREW — la gente a la que puedes llamar.
   ---------------------------------------------------------------------------
   La app ya sabía QUÉ hace falta: la etapa Necesidades lista los puestos de un
   rodaje. Lo que no sabía es A QUIÉN llamas para cubrirlos. Los puestos hoy son
   cajas vacías (`personal[].rol` es un texto, `talentos[].nombre` otro), y esta
   agenda es lo que les pone una persona real detrás.

   ESTO NO ES UN DIRECTORIO PÚBLICO, y la diferencia no es de tamaño sino de
   naturaleza. Un directorio publica datos de terceros y eso trae consentimiento,
   aviso de privacidad, derecho de baja y un servidor que mantener para siempre.
   Esto es TU AGENDA: la gente con la que ya trabajaste o a la que ya le
   llamaste, guardada en tu disco, como los contactos de tu teléfono. No se
   publica, no se sube y no sale de aquí. Si algún día quieres el directorio
   público, será otro producto — pero esto sirve desde el primer contacto.

   DÓNDE VIVE. En ~/Documents/ProduccionTV/Contactos (y su gemela dentro de la
   app en el iPad), fuera de los proyectos, por la misma razón que la fototeca:
   el camarógrafo que te salvó el rodaje de marzo te sirve en el de noviembre.
   El proyecto solo guarda a QUIÉN apuntó. */

import { EMBEDDED } from "./puente.js";
import { uid } from "./util.js";
import { departamentoDe } from "./crew.js";

/* --------------------------- Hablar con el disco --------------------------- */

let folioSiguiente = 1;
const enEspera = new Map();

if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (d?.type !== "producciontv:agenda-respuesta") return;
    const pendiente = enEspera.get(d.folio);
    if (!pendiente) return;
    enEspera.delete(d.folio);
    clearTimeout(pendiente.reloj);
    if (d.ok) pendiente.cumplir(d.datos);
    else pendiente.fallar(new Error(d.error || "La agenda no respondió"));
  });
}

function pedir(op, extra = {}) {
  if (!EMBEDDED) return Promise.reject(new Error("La agenda solo funciona dentro de la app."));
  const folio = folioSiguiente++;
  return new Promise((cumplir, fallar) => {
    const reloj = setTimeout(() => {
      enEspera.delete(folio);
      fallar(new Error("La agenda tardó demasiado en responder"));
    }, 20000);
    enEspera.set(folio, { cumplir, fallar, reloj });
    window.parent.postMessage({ type: "producciontv:agenda", op, folio, ...extra }, "*");
  });
}

export async function listarContactos() {
  const crudos = await pedir("list");
  return (crudos || [])
    .map((t) => { try { return JSON.parse(t); } catch { return null; } })
    .filter((c) => c && c.id)
    .map(normContacto)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export const guardarContacto = (c) => pedir("save", { id: c.id, ficha: JSON.stringify(c) });
export const borrarContacto = (id) => pedir("delete", { id });

/* ------------------------------ La ficha ------------------------------ */

export const contactoNuevo = (semilla = {}) => ({
  id: "con-" + uid().replace(/[^a-zA-Z0-9]/g, "").slice(0, 12),
  creado: new Date().toISOString(),
  nombre: "",
  rol: "",              // puesto principal; el departamento se deduce de él
  otrosRoles: [],
  nivel: "",
  ciudad: "San Luis Potosí",
  telefono: "", email: "", instagram: "", web: "",
  tarifa: "",           // texto libre: "800/día", "por proyecto", "a convenir"
  equipo: "",           // qué trae puesto: cámara, luces, transporte
  notas: "",
  etiquetas: [],
  disponibilidad: [],
  favorito: false,      // con quién ya trabajaste y repetirías
  foto: "",             // retrato chico, dentro de la propia ficha
  /* Rasgos de casting. Solo se llenan si la persona trabaja frente a cámara,
     y solo porque un casting real los pide ("actor de 25 a 35, tez clara,
     1.80"). Todos opcionales: describen a alguien para un papel concreto, no
     lo califican ni lo ordenan. */
  esTalento: false,
  edadMin: "", edadMax: "", estaturaCm: "",
  complexion: "", tez: "", ojos: "", cabello: "", cabelloTipo: "",
  idiomas: [], habilidades: [],
  ...semilla,
});

/** Rellena lo que falte de una ficha vieja, para que la agenda nunca se rompa. */
export const normContacto = (c) => ({
  ...contactoNuevo(),
  ...(c || {}),
  id: c?.id || "",
  otrosRoles: Array.isArray(c?.otrosRoles) ? c.otrosRoles : [],
  etiquetas: Array.isArray(c?.etiquetas) ? c.etiquetas : [],
  disponibilidad: Array.isArray(c?.disponibilidad) ? c.disponibilidad : [],
  idiomas: Array.isArray(c?.idiomas) ? c.idiomas : [],
  habilidades: Array.isArray(c?.habilidades) ? c.habilidades : [],
  nombre: c?.nombre || "",
});

/** El departamento no se guarda: se deduce del rol. Dos campos que pueden
    contradecirse son un campo de más. */
export const deptoDe = (c) => departamentoDe(c?.rol || "");

/* ------------------------------ Buscar ------------------------------
   Un solo colador, igual que en la mesa de luz: los filtros con valor tienen
   que coincidir TODOS, y el texto busca a la vez en el nombre, el puesto, las
   notas, el equipo y las etiquetas. */

// Sin acentos y en minúsculas: quien escribe "camarografo" tiene que encontrar
// al "Camarógrafo". Es la diferencia entre una búsqueda que sirve y una que
// castiga por no poner la tilde.
export const pelar = (s) => String(s || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function filtrarContactos(lista, f = {}) {
  const texto = pelar(f.texto).trim();
  return lista.filter((c) => {
    if (f.depto && deptoDe(c) !== f.depto) return false;
    if (f.rol && c.rol !== f.rol) return false;
    if (f.nivel && c.nivel !== f.nivel) return false;
    if (f.favoritos && !c.favorito) return false;
    if (f.etiqueta && !(c.etiquetas || []).includes(f.etiqueta)) return false;
    if (!texto) return true;
    const paja = pelar([c.nombre, c.rol, c.ciudad, c.notas, c.equipo, c.tarifa,
      ...(c.otrosRoles || []), ...(c.etiquetas || []), ...(c.habilidades || [])].join(" "));
    return paja.includes(texto);
  });
}

/* Qué tan llena está una ficha. No es una nota: es un empujón. Un contacto sin
   teléfono no sirve para lo único que tiene que servir —llamarle— y conviene
   que eso se vea antes de necesitarlo un martes a las siete de la mañana. */
export function completitud(c) {
  const pesos = [
    [!!c.nombre, 3], [!!c.rol, 3],
    [!!(c.telefono || c.email || c.instagram), 3],   // alguna forma de llamarle
    [!!c.ciudad, 1], [!!c.nivel, 1], [!!c.tarifa, 1],
    [!!(c.etiquetas || []).length, 1], [!!c.notas, 1], [!!c.foto, 1],
  ];
  const total = pesos.reduce((n, [, p]) => n + p, 0);
  const hecho = pesos.reduce((n, [ok, p]) => n + (ok ? p : 0), 0);
  return Math.round((hecho / total) * 100);
}

/** Lo que le falta para poder llamarle. Vacío = está lista. */
export const loQueFalta = (c) => [
  !c.nombre && "el nombre",
  !c.rol && "el puesto",
  !(c.telefono || c.email || c.instagram) && "alguna forma de contactarle",
].filter(Boolean);

/* ---------------------- El retrato ----------------------
   480 px basta para reconocer una cara, y a ese tamaño el retrato cabe DENTRO
   de la ficha sin partirla en dos archivos como sí hace la fototeca. Una foto
   de teléfono moderna pesa 4 MB; así pesa como una página de texto. */
export function leerRetrato(file) {
  return new Promise((cumplir, fallar) => {
    if (!file || !/^image\//.test(file.type || "")) { fallar(new Error("Eso no es una imagen")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const lado = 480;
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(img.naturalWidth * escala));
      cv.height = Math.max(1, Math.round(img.naturalHeight * escala));
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cumplir(cv.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fallar(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

/* LA MESA DE LUZ — la fototeca de referencias visuales.
   ---------------------------------------------------------------------------
   "Mesa de luz" es el nombre de toda la vida: la caja con vidrio iluminado
   donde se tienden los negativos para verlos juntos y decidir cuál sirve.
   Es lo que hace este módulo, con la diferencia de que aquí las imágenes se
   pueden etiquetar y buscar.

   DÓNDE VIVE. Fuera de los proyectos, en ~/Documents/ProduccionTV/Referencias
   (y su gemela dentro de la app en el iPad). Dos razones que no son la misma:
     · una fototeca es de quien la junta, no de un proyecto: la imagen que te
       sirvió para el noticiero te sirve para el documental del año que viene;
     · un .ptv tiene que seguir siendo texto. Con cientos de cuadros adentro
       pesaría cientos de megas y el iPad no lo abriría.
   El proyecto solo guarda a QUÉ referencia apunta, nunca la imagen.

   CÓMO LLEGA AL DISCO. Esta herramienta corre dentro de un iframe y no
   alcanza el puente nativo, así que se lo pide al caparazón por postMessage
   y el caparazón llama a Go (Mac) o a Swift (iPad). Ver el atendedor de
   'producciontv:ref' en frontend/src/main.js. */

import { EMBEDDED } from "./puente.js";
import { uid } from "./util.js";

/* --------------------------- Hablar con el disco --------------------------- */

/* Cada petición lleva un FOLIO y la respuesta lo devuelve. Con varias
   pestañas abiertas hay varias herramientas preguntando a la vez, y sin folio
   una se quedaría con la respuesta de otra. */
let folioSiguiente = 1;
const enEspera = new Map();

if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (d?.type !== "producciontv:ref-respuesta") return;
    const pendiente = enEspera.get(d.folio);
    if (!pendiente) return;
    enEspera.delete(d.folio);
    clearTimeout(pendiente.reloj);
    if (d.ok) pendiente.cumplir(d.datos);
    else pendiente.fallar(new Error(d.error || "La mesa de luz no respondió"));
  });
}

function pedir(op, extra = {}) {
  if (!EMBEDDED) {
    return Promise.reject(new Error("La mesa de luz solo funciona dentro de la app."));
  }
  const folio = folioSiguiente++;
  return new Promise((cumplir, fallar) => {
    /* Si el caparazón no contesta, la promesa no puede quedarse colgada para
       siempre: la mesa se quedaría con el "cargando…" puesto y sin explicar
       por qué. A los 20 s se da por perdida. */
    const reloj = setTimeout(() => {
      enEspera.delete(folio);
      fallar(new Error("La mesa de luz tardó demasiado en responder"));
    }, 20000);
    enEspera.set(folio, { cumplir, fallar, reloj });
    window.parent.postMessage({ type: "producciontv:ref", op, folio, ...extra }, "*");
  });
}

/** Todas las fichas de la fototeca (sin las imágenes completas: solo miniaturas). */
export async function listarReferencias() {
  const crudas = await pedir("list");
  return (crudas || [])
    .map((t) => { try { return JSON.parse(t); } catch { return null; } })
    .filter((r) => r && r.id)
    .sort((a, b) => String(b.creada || "").localeCompare(String(a.creada || "")));
}

/** Guarda la ficha. `imagen` vacía = solo cambiaron etiquetas y no se reescribe el .jpg. */
export const guardarReferencia = (ficha, imagen = "") =>
  pedir("save", { id: ficha.id, ficha: JSON.stringify(ficha), imagen });

/** La imagen completa, solo cuando se abre en grande. */
export const imagenDeReferencia = (id) => pedir("image", { id });

/** Manda ficha e imagen a la papelera interna (no destruye). */
export const borrarReferencia = (id) => pedir("delete", { id });

/* EL OJO DE LA APP. Le pregunta al iPad qué ve en la imagen: cuánta gente sale,
   qué tan cerrado es el plano, si es interior o exterior y si es de día o de
   noche. En el Mac esta puerta devuelve vacío —no hay un detector a mano en
   Go— y la mesa sigue funcionando igual, solo que etiquetando a mano.

   Nunca lanza: que el ojo falle o no exista no puede impedir que una imagen
   entre a la fototeca. Es un extra, no un requisito. */
export const analizarImagen = (imagen) =>
  pedir("analizar", { imagen }).catch(() => null);

/* ------------------------------ El vocabulario ------------------------------
   Las etiquetas que NO estaban ya en la app. El tipo de plano, el movimiento,
   el formato y el esquema de luz salen de los catálogos que la app ya habla
   (catalogos.js, proyecto.js, iluminacion.js): una referencia etiquetada
   "Primer Plano" usa exactamente la misma palabra que el guion técnico, y por
   eso se pueden cruzar. Estas cuatro son de ShotDeck y no existían. */

export const LUGARES = ["Interior", "Exterior"];
export const MOMENTOS = ["Día", "Noche", "Amanecer", "Atardecer", "Indistinto"];
export const GENTE = ["Nadie", "1 persona", "2 personas", "3 o más", "Multitud"];

/* Familias de color, para buscar "lo azul" sin tener que acertarle al tono
   exacto. Es lo que hace la barra de colores de ShotDeck. Cada familia es un
   arco del círculo de matiz; los grises y los extremos de luz salen aparte
   porque ahí el matiz ya no significa nada. */
export const FAMILIAS = [
  { id: "rojo", nombre: "Rojo", muestra: "#C0392B", min: 345, max: 15 },
  { id: "naranja", nombre: "Naranja", muestra: "#E07B12", min: 15, max: 45 },
  { id: "amarillo", nombre: "Amarillo", muestra: "#D4B106", min: 45, max: 70 },
  { id: "verde", nombre: "Verde", muestra: "#3A8B4C", min: 70, max: 160 },
  /* La frontera cian/azul va en 195° y no en 200 a propósito: el "teal" del
     cine (el azul verdoso del naranja-y-teal) vive en 180-190 y se queda del
     lado cian, mientras que un cielo —que ronda los 197— cae en azul, que es
     donde alguien lo va a buscar. */
  { id: "cian", nombre: "Cian", muestra: "#1B9AAA", min: 160, max: 195 },
  { id: "azul", nombre: "Azul", muestra: "#2B5FA8", min: 195, max: 255 },
  { id: "morado", nombre: "Morado", muestra: "#6B4FA8", min: 255, max: 290 },
  { id: "magenta", nombre: "Magenta", muestra: "#B03A7A", min: 290, max: 345 },
  { id: "neutro", nombre: "Neutro", muestra: "#8A8A85", min: null, max: null },
  { id: "oscuro", nombre: "Oscuro", muestra: "#2A2A2E", min: null, max: null },
  { id: "claro", nombre: "Claro", muestra: "#E6E2D8", min: null, max: null },
];

/* De #RRGGBB a la familia a la que pertenece.

   Los cortes NO son solo por luminosidad, y ahí estaba el error de la primera
   versión. Un crema (#E7DCC0) salía clasificado como "naranja" porque su matiz
   cae en 43°, y un azul de noche cerrado (#0D1B2A) salía como "oscuro"
   perdiendo justo lo único que importa de él: que es azul.

   La regla que sí funciona en cine mira las dos cosas a la vez. Muy claro y
   poco saturado es un crema, no un naranja pálido. Muy oscuro pero saturado
   sigue siendo su color: el azul noche es azul. Solo cuando la luz se va Y el
   color con ella, la imagen es de verdad "oscura". */
export function familiaDe(hex) {
  const { h, s, l } = aHSL(hex);
  if (l < 0.14 && s < 0.5) return "oscuro";
  if (l > 0.78 && s < 0.55) return "claro";
  if (s < 0.12) return "neutro";
  const f = FAMILIAS.find((x) => x.min != null && (x.min > x.max
    ? (h >= x.min || h < x.max)   // el rojo cruza el 0° y da la vuelta
    : (h >= x.min && h < x.max)));
  return f ? f.id : "neutro";
}

function aHSL(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16) || 0;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (!d) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
  return { h: h * 60, s, l };
}

/* --------------------------- Leer y pesar la imagen ---------------------------
   De un archivo salen TRES cosas, y por eso se hace todo en una pasada:
     · la imagen completa a 1400 px  — lo que se ve al abrirla en grande
     · la miniatura a 240 px         — lo que se ve en la cuadrícula
     · la paleta de color            — sacada de la propia imagen, sin etiquetar

   La miniatura viaja DENTRO de la ficha .json a propósito. Abrir la mesa lee
   trescientas fichas de ~10 KB de un jalón; si cada miniatura fuera un archivo
   aparte serían trescientos viajes al disco y la cuadrícula aparecería a
   pedazos. La imagen completa sí es un archivo aparte, y solo se lee cuando
   de verdad se abre una. */

const MAX_COMPLETA = 1400;
const MAX_MINIATURA = 240;

export function leerImagen(file) {
  return new Promise((cumplir, fallar) => {
    if (!file || !/^image\//.test(file.type || "")) {
      fallar(new Error("Eso no es una imagen"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const completa = aLienzo(img, MAX_COMPLETA);
        const mini = aLienzo(img, MAX_MINIATURA);
        cumplir({
          completa: completa.canvas.toDataURL("image/jpeg", 0.82),
          min: mini.canvas.toDataURL("image/jpeg", 0.7),
          colores: paletaDe(mini.canvas),
          ancho: img.naturalWidth,
          alto: img.naturalHeight,
        });
      } catch (e) { fallar(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); fallar(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

function aLienzo(img, lado) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const escala = Math.min(1, lado / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * escala));
  canvas.height = Math.max(1, Math.round(h * escala));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

/* LA PALETA. Se agrupan los píxeles en cubos de color (5 bits por canal: 32
   niveles en vez de 256) y se cuentan. Los cubos más poblados son los colores
   que de verdad mandan en el cuadro.

   Luego se eligen de mayor a menor, pero SALTÁNDOSE los que se parecen
   demasiado a uno ya elegido: sin ese filtro, una imagen azul devolvía cinco
   azules casi idénticos y la paleta no decía nada. Con él devuelve el azul, y
   después el color que de verdad contrasta. */
export function paletaDe(canvas, cuantos = 5) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const cubos = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // transparente: no cuenta
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const clave = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const c = cubos.get(clave);
    if (c) { c.n++; c.r += r; c.g += g; c.b += b; }
    else cubos.set(clave, { n: 1, r, g, b });
  }
  const ordenados = [...cubos.values()]
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n, n: c.n }));

  const elegidos = [];
  const LEJOS = 60; // distancia mínima para que dos colores cuenten como distintos
  for (const c of ordenados) {
    if (elegidos.length >= cuantos) break;
    const cerca = elegidos.some((e) =>
      Math.hypot(e.r - c.r, e.g - c.g, e.b - c.b) < LEJOS);
    if (!cerca) elegidos.push(c);
  }
  return elegidos.map((c) => aHex(c.r, c.g, c.b));
}

const aHex = (r, g, b) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();

/* ------------------------------ La ficha ------------------------------ */

/** Ficha nueva a partir de una imagen ya leída. */
export function fichaNueva(leida, semilla = {}) {
  return {
    id: "ref-" + uid().replace(/[^a-zA-Z0-9]/g, "").slice(0, 12),
    creada: new Date().toISOString(),
    nota: "",
    plano: "", movimiento: "", formato: "", luz: "",
    lugar: "", momento: "", gente: "",
    libres: [],
    /* Qué etiquetas puso el ojo de la app y no una persona. Se guarda para
       poder marcarlas en pantalla: una conjetura tiene que verse como
       conjetura, sobre todo cuando se equivoca. */
    auto: [],
    ...semilla,
    colores: leida.colores || [],
    familias: [...new Set((leida.colores || []).map(familiaDe))],
    ancho: leida.ancho || 0,
    alto: leida.alto || 0,
    min: leida.min || "",
  };
}

/** Rellena lo que falte de una ficha vieja, para que la mesa nunca se rompa. */
export const normFicha = (f) => ({
  id: "", creada: "", nota: "",
  plano: "", movimiento: "", formato: "", luz: "",
  lugar: "", momento: "", gente: "",
  libres: [], auto: [], colores: [], familias: [], ancho: 0, alto: 0, min: "",
  ...(f || {}),
  libres: Array.isArray(f?.libres) ? f.libres : [],
  auto: Array.isArray(f?.auto) ? f.auto : [],
  colores: Array.isArray(f?.colores) ? f.colores : [],
  familias: Array.isArray(f?.familias) && f.familias.length
    ? f.familias
    : [...new Set((f?.colores || []).map(familiaDe))],
});

/* ------------------------------ Buscar ------------------------------
   Un solo colador para todos los filtros. Los campos con valor tienen que
   coincidir TODOS (es una búsqueda que se estrecha, como la de ShotDeck: cada
   filtro que pones quita, no agrega), y el texto libre busca en la nota, en
   las palabras sueltas y en las etiquetas de catálogo a la vez. */
export function filtrar(fichas, f = {}) {
  const texto = (f.texto || "").trim().toLowerCase();
  return fichas.filter((r) => {
    for (const campo of ["plano", "movimiento", "formato", "luz", "lugar", "momento", "gente"]) {
      if (f[campo] && r[campo] !== f[campo]) return false;
    }
    if (f.familia && !(r.familias || []).includes(f.familia)) return false;
    if (!texto) return true;
    const paja = [r.nota, r.plano, r.movimiento, r.formato, r.lugar, r.momento, r.gente,
      ...(r.libres || [])].join(" ").toLowerCase();
    return paja.includes(texto);
  });
}

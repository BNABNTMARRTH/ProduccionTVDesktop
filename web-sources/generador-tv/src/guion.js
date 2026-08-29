// GUION LITERARIO: el guion en su forma tradicional (estilo Final Draft).
//
// No es un documento aparte: es OTRA VISTA de las mismas escenas de la
// escaleta. Cada escena aporta su encabezado (INT. LUGAR – DÍA) y guarda el
// cuerpo del guion en `escena.guion`, una lista de bloques con tipo:
//
//   accion      Lo que se ve y se oye. Ancho completo.
//   personaje   Quién habla. MAYÚSCULAS, centrado a la derecha del centro.
//   parentesis  Cómo lo dice. Debajo del personaje, entre paréntesis.
//   dialogo     Lo que dice. Columna angosta al centro.
//   transicion  CORTE A:, FUNDE A NEGRO. Alineado a la derecha.
//
// Las medidas son las del formato estándar de guion (página carta, Courier 12),
// convertidas a porcentaje del ancho para que se vean igual en pantalla y al
// imprimir. La regla de oro del oficio: 1 página ≈ 1 minuto de pantalla.

// El `color` es el de la ETIQUETA que el editor pinta al margen del bloque.
// Va sobre la HOJA, que es blanca en los dos temas, así que son tonos oscuros
// medidos contra blanco (todos ≥ 4.5:1, que es lo que pide un texto chico).
export const TIPOS = {
  accion: { nombre: 'Acción', sangria: 0, ancho: 100, caja: 61, mayus: false, align: 'left', color: '#2E7D5B' },
  personaje: { nombre: 'Personaje', sangria: 37, ancho: 63, caja: 38, mayus: true, align: 'left', color: '#1D6FD1' },
  parentesis: { nombre: 'Paréntesis', sangria: 31, ancho: 69, caja: 25, mayus: false, align: 'left', color: '#8A5CD6' },
  dialogo: { nombre: 'Diálogo', sangria: 22, ancho: 62, caja: 35, mayus: false, align: 'left', color: '#B4232A' },
  transicion: { nombre: 'Transición', sangria: 0, ancho: 100, caja: 61, mayus: true, align: 'right', color: '#9A5B00' },
};

export const ORDEN_TIPOS = ['accion', 'personaje', 'parentesis', 'dialogo', 'transicion'];

// Qué sigue al dar Enter. Es lo que hace rápido escribir un guion: casi nunca
// hay que elegir el tipo a mano, porque después de un personaje SIEMPRE viene
// su diálogo, y después de un diálogo casi siempre vuelve la acción.
export const TIPO_SIGUIENTE = {
  accion: 'accion',
  personaje: 'dialogo',
  parentesis: 'dialogo',
  dialogo: 'accion',
  transicion: 'accion',
};

// Con Tab se rota el tipo del bloque actual (igual que en Final Draft).
export const siguienteEnRotacion = (tipo) => {
  const i = ORDEN_TIPOS.indexOf(tipo);
  return ORDEN_TIPOS[(i + 1) % ORDEN_TIPOS.length];
};

export const bloqueNuevo = (tipo = 'accion', texto = '') => ({ id: `g${Math.random().toString(36).slice(2, 9)}`, tipo, texto });

// Un guion vacío arranca con una línea de acción: la página en blanco de un
// guion nunca empieza por un diálogo.
//
// OJO CON EL ID de ese primer bloque. Antes se creaba con bloqueNuevo(), que
// sortea un id AL AZAR en cada llamada — y guionDe() se llama en cada pintado
// y otra vez al guardar. Resultado: el bloque que veías en pantalla y el que
// buscaba el guardado tenían ids distintos, la escritura no encontraba a quién
// aplicarse y se tiraba, dejando en su lugar un bloque vacío. Es decir: en una
// escena todavía en blanco, lo que escribías desaparecía y quedaba la plantilla.
// El id ahora se deriva de la escena, así que es el MISMO en los dos lados.
export const guionDe = (escena) => (
  Array.isArray(escena?.guion) && escena.guion.length
    ? escena.guion
    : [{ id: `g0-${escena?.id || 'escena'}`, tipo: 'accion', texto: '' }]
);

/* ----------------------------- Medidas ----------------------------- */
// Cuántos renglones ocupa un bloque al imprimirse, según el ancho de su caja
// en caracteres (Courier 12 = 61 caracteres por línea a ancho completo).
export function renglonesDe(bloque) {
  const t = TIPOS[bloque.tipo] || TIPOS.accion;
  const texto = String(bloque.texto || '');
  const lineas = texto.split('\n').reduce((n, linea) => n + Math.max(1, Math.ceil(linea.length / t.caja)), 0);
  // Los bloques llevan un renglón de aire antes, salvo el diálogo pegado a su
  // personaje o paréntesis.
  const aire = bloque.tipo === 'dialogo' || bloque.tipo === 'parentesis' ? 0 : 1;
  return lineas + aire;
}

// Una página de guion son 55 renglones; una página ≈ un minuto de pantalla.
export const RENGLONES_POR_PAGINA = 55;

export function medidasDe(escenas) {
  const renglones = (escenas || []).reduce((n, esc) => {
    const cuerpo = (esc.guion || []).reduce((m, b) => m + renglonesDe(b), 0);
    return n + cuerpo + 2; // el encabezado de escena y su aire
  }, 0);
  const paginas = renglones / RENGLONES_POR_PAGINA;
  return { renglones, paginas, segundos: Math.round(paginas * 60) };
}

/* -------------------------- Encabezados --------------------------- */
// Un encabezado de escena bien escrito dice tres cosas: dentro o fuera, dónde
// y cuándo. Se acepta lo que el usuario escriba, pero se normaliza el formato.
const INT_EXT = /^\s*(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?)\s*/i;

export function normalizarEncabezado(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  const m = t.match(INT_EXT);
  if (!m) return t.toUpperCase();
  const prefijo = m[1].toUpperCase().replace(/\.?$/, '.').replace(/\.\//, './');
  return (prefijo + ' ' + t.slice(m[0].length)).toUpperCase().replace(/\s+/g, ' ').trim();
}

export const esEncabezadoValido = (texto) => INT_EXT.test(String(texto || '').trim());

/* ------------------------- Personajes ----------------------------- */
// Para autocompletar: quién ha hablado ya en el guion, más los talentos que el
// proyecto tenga capturados.
export function personajesDe(cfg) {
  const enGuion = (cfg?.escaleta || []).flatMap((e) => (e.guion || [])
    .filter((b) => b.tipo === 'personaje' && b.texto.trim())
    .map((b) => b.texto.trim().toUpperCase()));
  const enTalentos = (cfg?.talentos || []).map((t) => String(t.nombre || '').trim().toUpperCase()).filter(Boolean);
  return [...new Set([...enGuion, ...enTalentos])].sort();
}

/* --------------------- Texto plano (exportar) ---------------------- */
// El guion como texto, con la sangría del formato. Se usa para imprimir y para
// el portapapeles.
export function guionATexto(escenas) {
  const sangria = { accion: 0, personaje: 22, parentesis: 18, dialogo: 11, transicion: 0 };
  return (escenas || []).map((esc, i) => {
    const enc = normalizarEncabezado(esc.encabezado) || `ESCENA ${i + 1}`;
    const cuerpo = (esc.guion || []).map((b) => {
      const t = TIPOS[b.tipo] || TIPOS.accion;
      const texto = t.mayus ? String(b.texto || '').toUpperCase() : String(b.texto || '');
      if (b.tipo === 'transicion') return texto ? ' '.repeat(Math.max(0, 61 - texto.length)) + texto : '';
      return texto.split('\n').map((l) => ' '.repeat(sangria[b.tipo] || 0) + l).join('\n');
    }).join('\n');
    return `${i + 1}. ${enc}\n\n${cuerpo}`;
  }).join('\n\n');
}


/* ----------------------------- MARCATEXTOS -----------------------------
Cuatro colores de marcador sobre el texto del guion, como en papel. Cada marca
es un rango {ini, fin, color} sobre el texto del bloque; se guardan en
`bloque.marcas`. Se trabajan como rangos y no como HTML para que el texto del
guion siga siendo texto plano: así se sigue contando páginas, exportando e
imprimiendo sin depender del formato de la marca. */

export const MARCADORES = {
  verde:    { nombre: 'Verde',    color: '#B8FF3C', tinta: '#1B3A00' },
  amarillo: { nombre: 'Amarillo', color: '#FFF25C', tinta: '#3A3200' },
  naranja:  { nombre: 'Naranja',  color: '#FFB03A', tinta: '#40230A' },
  rojo:     { nombre: 'Rojo',     color: '#FF7A7A', tinta: '#440C0C' },
};

const ordenar = (marcas) => [...marcas].sort((a, b) => a.ini - b.ini);

// Quita del listado todo lo que caiga dentro de [ini, fin): las marcas que
// cruzan el borde se recortan, las que quedan partidas en dos se parten.
export function quitarMarca(marcas, ini, fin) {
  if (fin <= ini) return ordenar(marcas || []);
  const fuera = [];
  (marcas || []).forEach((m) => {
    if (m.fin <= ini || m.ini >= fin) { fuera.push(m); return; }   // no se tocan
    if (m.ini < ini) fuera.push({ ...m, fin: ini });               // pedazo de la izquierda
    if (m.fin > fin) fuera.push({ ...m, ini: fin });               // pedazo de la derecha
  });
  return ordenar(fuera).filter((m) => m.fin > m.ini);
}

// Pinta [ini, fin) con un color: primero limpia lo que hubiera debajo (un
// marcador tapa al anterior) y luego une las marcas pegadas del mismo color.
export function aplicarMarca(marcas, ini, fin, color) {
  if (fin <= ini || !MARCADORES[color]) return ordenar(marcas || []);
  const lista = ordenar([...quitarMarca(marcas, ini, fin), { ini, fin, color }]);
  const unidas = [];
  lista.forEach((m) => {
    const ult = unidas[unidas.length - 1];
    if (ult && ult.color === m.color && ult.fin >= m.ini) ult.fin = Math.max(ult.fin, m.fin);
    else unidas.push({ ...m });
  });
  return unidas;
}

// Parte el texto en trozos para dibujarlo: [{texto, color|null}, …].
export function trozosMarcados(texto, marcas) {
  const t = String(texto ?? '');
  const lista = ordenar(marcas || []).filter((m) => m.ini < t.length && m.fin > 0);
  const trozos = [];
  let i = 0;
  lista.forEach((m) => {
    const ini = Math.max(0, m.ini), fin = Math.min(t.length, m.fin);
    if (ini > i) trozos.push({ texto: t.slice(i, ini), color: null });
    if (fin > ini) trozos.push({ texto: t.slice(ini, fin), color: m.color });
    i = Math.max(i, fin);
  });
  if (i < t.length) trozos.push({ texto: t.slice(i), color: null });
  return trozos.length ? trozos : [{ texto: t, color: null }];
}

// Al editar el texto hay que mover las marcas: si se escribe o se borra antes
// de una marca, la marca se recorre. Sin esto el resaltado se despega del texto.
export function moverMarcas(marcas, pos, delta) {
  if (!delta) return ordenar(marcas || []);
  return ordenar((marcas || []).map((m) => {
    const ini = m.ini >= pos ? m.ini + delta : m.ini;
    const fin = m.fin > pos ? m.fin + delta : m.fin;
    return { ...m, ini: Math.max(0, ini), fin: Math.max(0, fin) };
  })).filter((m) => m.fin > m.ini);
}

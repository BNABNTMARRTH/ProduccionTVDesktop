// Lógica pura del catálogo de cámaras. El catálogo se recibe como argumento
// para que este módulo funcione igual en Vite, en Node y en futuras fuentes.

const numeroFinito = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const valoresUnicos = (valores) => [...new Set(
  (Array.isArray(valores) ? valores : [])
    .map(numeroFinito)
    .filter((valor) => valor !== null && valor > 0)
)].sort((a, b) => a - b);

function entradaCamara(catalogo, camara) {
  if (!camara) return null;
  if (typeof camara === "string") {
    const datos = catalogo?.camaras?.[camara];
    return datos ? { clave: camara, ...datos } : null;
  }
  if (camara.clave && catalogo?.camaras?.[camara.clave]) {
    return { clave: camara.clave, ...catalogo.camaras[camara.clave] };
  }
  const encontrada = Object.entries(catalogo?.camaras || {})
    .find(([, datos]) => datos === camara);
  return encontrada ? { clave: encontrada[0], ...encontrada[1] } : null;
}

function entradaLente(catalogo, lente) {
  if (!lente) return null;
  if (typeof lente === "string") {
    const datos = catalogo?.lentes?.[lente];
    return datos ? { clave: lente, ...datos } : null;
  }
  if (lente.clave && catalogo?.lentes?.[lente.clave]) {
    return { clave: lente.clave, ...catalogo.lentes[lente.clave] };
  }
  const encontrada = Object.entries(catalogo?.lentes || {})
    .find(([, datos]) => datos === lente);
  return encontrada ? { clave: encontrada[0], ...encontrada[1] } : null;
}

export function camarasPorTipo(catalogo, tipo = "") {
  const ordenTipos = new Map((catalogo?.tipos || []).map((item, indice) => [item.clave, indice]));
  return Object.entries(catalogo?.camaras || {})
    .map(([clave, camara], indice) => ({ clave, ...camara, indiceCatalogo: indice }))
    .filter((camara) => !tipo || camara.tipo === tipo)
    .sort((a, b) => (
      (ordenTipos.get(a.tipo) ?? Number.MAX_SAFE_INTEGER)
      - (ordenTipos.get(b.tipo) ?? Number.MAX_SAFE_INTEGER)
      || a.indiceCatalogo - b.indiceCatalogo
    ))
    .map(({ indiceCatalogo, ...camara }) => camara);
}

export function lentesCompatibles(catalogo, camara) {
  const datosCamara = entradaCamara(catalogo, camara);
  if (!datosCamara?.montura) return [];
  return (Array.isArray(datosCamara.lentes) ? datosCamara.lentes : [])
    .map((compatibilidad, indice) => {
      const lente = entradaLente(catalogo, compatibilidad?.clave);
      if (!lente) return null;
      return {
        ...lente,
        via: compatibilidad.via || "nativo",
        recorte: compatibilidad.recorte === true,
        recomendado: lente.clave === datosCamara.recomendado,
        indiceCompatibilidad: indice,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      Number(a.via !== "nativo") - Number(b.via !== "nativo")
      || a.indiceCompatibilidad - b.indiceCompatibilidad
    ))
    .map(({ indiceCompatibilidad, ...lente }) => lente);
}

export function rangoFocal(catalogo, camara, lente = null) {
  const datosCamara = entradaCamara(catalogo, camara);
  if (!datosCamara) return null;

  const focalesCamara = valoresUnicos(datosCamara.focales_fijas);
  if (!datosCamara.montura && focalesCamara.length) {
    return { min: focalesCamara[0], max: focalesCamara.at(-1), pasos: focalesCamara };
  }

  const datosLente = entradaLente(catalogo, lente);
  if (!datosLente) return null;
  const focalesLente = valoresUnicos(datosLente.focales);
  if (focalesLente.length) {
    return { min: focalesLente[0], max: focalesLente.at(-1), pasos: focalesLente };
  }

  const minimo = numeroFinito(datosLente.focal_min);
  const maximo = numeroFinito(datosLente.focal_max);
  if (minimo === null && maximo === null) return null;
  const min = Math.max(0.1, Math.min(minimo ?? maximo, maximo ?? minimo));
  const max = Math.max(min, Math.max(minimo ?? maximo, maximo ?? minimo));
  const esFijo = datosLente.tipo === "fijo" || min === max;
  return { min, max, pasos: esFijo ? [min] : null };
}

export function soportesDe(catalogo, camara) {
  const datosCamara = entradaCamara(catalogo, camara);
  if (!datosCamara) return [];
  const claves = [datosCamara.soporte, ...(datosCamara.soportes_alt || [])]
    .filter((clave, indice, todas) => clave && todas.indexOf(clave) === indice);
  return claves
    .filter((clave) => catalogo?.soportes?.[clave])
    .map((clave) => ({
      clave,
      ...catalogo.soportes[clave],
      sugerido: clave === datosCamara.soporte,
    }))
    .sort((a, b) => Number(b.sugerido) - Number(a.sugerido));
}

export function modeloDe(catalogo, equipo) {
  const camara = entradaCamara(catalogo, equipo?.camara);
  if (!camara) return "camara";
  const clave = camara.modelos?.[equipo?.soporte || ""];
  return typeof clave === "string" && clave ? clave : "camara";
}

export function sensorMmDeEquipo(catalogo, equipo) {
  const sensor = entradaCamara(catalogo, equipo?.camara)?.sensor_mm;
  if (!Array.isArray(sensor) || sensor.length < 2) return null;
  const ancho = numeroFinito(sensor[0]);
  const alto = numeroFinito(sensor[1]);
  return ancho && ancho > 0 && alto && alto > 0 ? [ancho, alto] : null;
}

export function focalEquivalente35(catalogo, equipo, focal = equipo?.focal) {
  const ancho = sensorMmDeEquipo(catalogo, equipo)?.[0];
  const valor = numeroFinito(focal);
  if (!ancho || valor === null) return null;
  return valor * 36 / ancho;
}

function acotarAlRango(valor, rango, respaldo) {
  const numero = numeroFinito(valor);
  const base = numero !== null ? numero : respaldo;
  if (!rango) return Math.max(1, numeroFinito(base) ?? 35);
  if (rango.pasos?.length) {
    return rango.pasos.reduce((mejor, paso) => (
      Math.abs(paso - base) < Math.abs(mejor - base) ? paso : mejor
    ), rango.pasos[0]);
  }
  return Math.max(rango.min, Math.min(rango.max, base));
}

function focalPorDefecto(catalogo, camara, lente) {
  const rango = rangoFocal(catalogo, camara, lente);
  if (!rango) return 35;
  const ancho = entradaCamara(catalogo, camara)?.sensor_mm?.[0];
  const equivalente35 = ancho > 0 ? Math.round(35 * ancho / 36) : rango.min;
  return acotarAlRango(equivalente35, rango, rango.min);
}

export function equipoPorDefecto(catalogo, claveCamara) {
  const camara = entradaCamara(catalogo, claveCamara);
  if (!camara) return null;
  const compatibles = lentesCompatibles(catalogo, camara);
  const lente = camara.montura
    ? (compatibles.find((item) => item.recomendado)?.clave || compatibles[0]?.clave || null)
    : null;
  const soportes = soportesDe(catalogo, camara);
  const soporte = soportes.find((item) => item.sugerido)?.clave || soportes[0]?.clave || "";
  return {
    camara: camara.clave,
    lente,
    focal: focalPorDefecto(catalogo, camara, lente),
    soporte,
  };
}

export function cambiarCamara(catalogo, equipo, claveCamara) {
  const base = equipoPorDefecto(catalogo, claveCamara);
  const camara = entradaCamara(catalogo, claveCamara);
  if (!base || !camara) return null;

  const compatibles = new Set(lentesCompatibles(catalogo, camara).map((lente) => lente.clave));
  const lente = camara.montura && compatibles.has(equipo?.lente) ? equipo.lente : base.lente;
  const soportes = new Set(soportesDe(catalogo, camara).map((soporte) => soporte.clave));
  const soporte = soportes.has(equipo?.soporte) ? equipo.soporte : base.soporte;
  const rango = rangoFocal(catalogo, camara, lente);
  return {
    camara: camara.clave,
    lente,
    focal: acotarAlRango(equipo?.focal, rango, focalPorDefecto(catalogo, camara, lente)),
    soporte,
  };
}

export function cambiarLente(catalogo, equipo, claveLente) {
  const camara = entradaCamara(catalogo, equipo?.camara);
  if (!camara) return null;
  if (!camara.montura) return cambiarFocal(catalogo, { ...equipo, lente: null }, equipo?.focal);
  const compatibles = lentesCompatibles(catalogo, camara);
  const lente = compatibles.some((item) => item.clave === claveLente)
    ? claveLente
    : (compatibles.find((item) => item.recomendado)?.clave || compatibles[0]?.clave || null);
  return cambiarFocal(catalogo, { ...equipo, lente }, equipo?.focal);
}

export function cambiarFocal(catalogo, equipo, focal) {
  const camara = entradaCamara(catalogo, equipo?.camara);
  if (!camara) return null;
  const rango = rangoFocal(catalogo, camara, equipo?.lente);
  const respaldo = focalPorDefecto(catalogo, camara, equipo?.lente);
  return { ...equipo, focal: acotarAlRango(focal, rango, respaldo) };
}

export function rangoFocalDeEquipo(catalogo, equipo) {
  const camara = entradaCamara(catalogo, equipo?.camara);
  return camara ? rangoFocal(catalogo, camara, equipo?.lente) : null;
}

// La migración descarta una cámara inexistente. Dentro de una cámara válida,
// una lente o soporte desconocidos se vacían; no se guardan claves huérfanas.
export function normalizarEquipo(catalogo, equipo) {
  const camara = entradaCamara(catalogo, equipo?.camara);
  if (!camara) return null;
  const compatibles = new Set(lentesCompatibles(catalogo, camara).map((lente) => lente.clave));
  const lente = camara.montura && compatibles.has(equipo?.lente) ? equipo.lente : null;
  const soportes = new Set(soportesDe(catalogo, camara).map((soporte) => soporte.clave));
  const soporte = soportes.has(equipo?.soporte) ? equipo.soporte : "";
  const equipoBase = equipoPorDefecto(catalogo, camara.clave);
  // Si la lente guardada ya no existe, se descarta su clave pero la focal se
  // acota con la recomendada para no conservar un valor absurdo u obsoleto.
  const rango = rangoFocal(catalogo, camara, lente)
    || rangoFocal(catalogo, camara, equipoBase?.lente);
  const respaldo = equipoBase?.focal ?? 35;
  return {
    camara: camara.clave,
    lente,
    focal: acotarAlRango(equipo?.focal, rango, respaldo),
    soporte,
  };
}

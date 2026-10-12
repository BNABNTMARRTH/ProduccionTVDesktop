import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cambiarCamara,
  cambiarFocal,
  cambiarLente,
  camarasPorTipo,
  equipoPorDefecto,
  lentesCompatibles,
  modeloDe,
  rangoFocal,
  soportesDe,
} from "../web-sources/generador-tv/src/equipoCamara.js";
import {
  distanciaFocalDeCamara,
  fovVerticalDesdeFocal,
} from "../web-sources/generador-tv/src/setGeometria.js";
import { normalizeCfg } from "../web-sources/generador-tv/src/proyecto.js";

const catalogo = {
  version: 1,
  tipos: [
    { clave: "cine", nombre: "Cine" },
    { clave: "foto_video", nombre: "Foto y video" },
    { clave: "movil", nombre: "Móvil" },
  ],
  soportes: {
    tripie: { nombre: "Tripié" },
    monopodo: { nombre: "Monópodo" },
    gimbal: { nombre: "Gimbal" },
  },
  camaras: {
    cam_ff: {
      nombre: "Cámara FF", tipo: "cine", montura: "E", sensor: "FF", sensor_mm: [36, 20.25],
      recomendado: "zoom_24_70",
      lentes: [
        { clave: "juego_fijos", via: "Adaptador PL", recorte: false },
        { clave: "zoom_24_70", via: "nativo", recorte: false },
        { clave: "zoom_s35", via: "nativo", recorte: true },
      ],
      focales_fijas: null, soporte: "tripie", soportes_alt: ["monopodo"],
      modelos: { tripie: "cam_ff_tripie", monopodo: "cam_ff_monopodo" },
    },
    cam_s35: {
      nombre: "Cámara S35", tipo: "foto_video", montura: "E", sensor: "S35", sensor_mm: [24, 13.5],
      recomendado: "zoom_s35",
      lentes: [
        { clave: "zoom_s35", via: "nativo", recorte: false },
        { clave: "juego_fijos", via: "Adaptador PL", recorte: false },
      ],
      focales_fijas: null, soporte: "monopodo", soportes_alt: ["tripie"],
      modelos: { monopodo: "cam_s35_monopodo", tripie: "cam_s35_tripie" },
    },
    cam_cine: {
      nombre: "Cámara de cine", tipo: "cine", montura: "PL", sensor: "S35", sensor_mm: [24.6, 13.8],
      recomendado: "cine_zoom",
      lentes: [{ clave: "cine_zoom", via: "nativo", recorte: false }],
      focales_fijas: null, soporte: "monopodo", soportes_alt: [],
      modelos: { monopodo: "cam_cine_monopodo" },
    },
    movil: {
      nombre: "Móvil", tipo: "movil", montura: null, sensor: "fijo", sensor_mm: [36, 24],
      recomendado: null, lentes: [], focales_fijas: [13, 24, 48, 100],
      soporte: "gimbal", soportes_alt: [], modelos: { gimbal: "cam_movil_gimbal" },
    },
  },
  lentes: {
    zoom_24_70: { nombre: "Zoom 24-70", tipo: "zoom", focal_min: 24, focal_max: 70, focales: null },
    zoom_s35: { nombre: "Zoom S35", tipo: "zoom", focal_min: 18, focal_max: 50, focales: null },
    juego_fijos: { nombre: "Juego de fijos", tipo: "cine", focal_min: 24, focal_max: 85, focales: [24, 35, 50, 85] },
    cine_zoom: { nombre: "Cine zoom", tipo: "cine_zoom", focal_min: 50, focal_max: 100, focales: null },
  },
};

test("el catálogo filtra cámaras por tipo y ordena lentes nativos primero", () => {
  assert.deepEqual(camarasPorTipo(catalogo, "foto_video").map((camara) => camara.clave), ["cam_s35"]);
  const lentes = lentesCompatibles(catalogo, "cam_ff");
  assert.deepEqual(lentes.map((lente) => lente.clave), ["zoom_24_70", "zoom_s35", "juego_fijos"]);
  assert.equal(lentes[0].recomendado, true);
  assert.equal(lentes[1].recorte, true);
  assert.equal(lentes[2].via, "Adaptador PL");
});

test("los rangos distinguen zoom continuo y focales discretas", () => {
  assert.deepEqual(rangoFocal(catalogo, "cam_ff", "zoom_24_70"), { min: 24, max: 70, pasos: null });
  assert.deepEqual(rangoFocal(catalogo, "cam_ff", "juego_fijos"), { min: 24, max: 85, pasos: [24, 35, 50, 85] });
  assert.deepEqual(rangoFocal(catalogo, "movil", null), { min: 13, max: 100, pasos: [13, 24, 48, 100] });
});

test("el equipo por defecto usa lente y soporte recomendados", () => {
  assert.deepEqual(equipoPorDefecto(catalogo, "cam_ff"), {
    camara: "cam_ff", lente: "zoom_24_70", focal: 35, soporte: "tripie",
  });
  assert.equal(soportesDe(catalogo, "cam_s35")[0].clave, "monopodo");
  assert.equal(soportesDe(catalogo, "cam_s35")[0].sugerido, true);
});

test("cambiar de cámara conserva lente y soporte cuando siguen permitidos", () => {
  const anterior = { camara: "cam_ff", lente: "juego_fijos", focal: 55, soporte: "tripie" };
  assert.deepEqual(cambiarCamara(catalogo, anterior, "cam_s35"), {
    camara: "cam_s35", lente: "juego_fijos", focal: 50, soporte: "tripie",
  });
});

test("cambiar de cámara reemplaza lente y soporte incompatibles", () => {
  const anterior = { camara: "cam_ff", lente: "zoom_24_70", focal: 35, soporte: "tripie" };
  assert.deepEqual(cambiarCamara(catalogo, anterior, "cam_cine"), {
    camara: "cam_cine", lente: "cine_zoom", focal: 50, soporte: "monopodo",
  });
});

test("cambiar lente o focal recorta el valor al rango válido", () => {
  const equipo = { camara: "cam_ff", lente: "zoom_24_70", focal: 200, soporte: "tripie" };
  assert.equal(cambiarFocal(catalogo, equipo, 200).focal, 70);
  assert.equal(cambiarLente(catalogo, equipo, "juego_fijos").focal, 85);
});

test("modeloDe usa el modelo del soporte y vuelve a la cámara genérica", () => {
  assert.equal(modeloDe(catalogo, { camara: "cam_ff", soporte: "monopodo" }), "cam_ff_monopodo");
  assert.equal(modeloDe(catalogo, { camara: "cam_ff", soporte: "desconocido" }), "camara");
  assert.equal(modeloDe(catalogo, null), "camara");
});

test("la focal configurada tiene prioridad y la cámara genérica conserva la inferencia", () => {
  assert.equal(distanciaFocalDeCamara({ equipo: { focal: 42 }, nombre: "CAM 1 · 13 mm", plano: "General" }), 42);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM 1 · 13 mm", plano: "General" }), 13);
  assert.equal(distanciaFocalDeCamara({ nombre: "CAM 2", plano: "Plano medio" }), 50);
});

test("el FOV 16:9 usa el ancho del sensor y conserva la fórmula genérica", () => {
  const fovFF = fovVerticalDesdeFocal(35, [36, 20.25]);
  const fovS35 = fovVerticalDesdeFocal(35, [24, 13.5]);
  assert.ok(fovFF > fovS35, "a igual focal, el sensor FF debe cubrir más campo que S35");
  const legado = (2 * Math.atan(24 / (2 * 35)) * 180) / Math.PI;
  assert.equal(fovVerticalDesdeFocal(35), legado);
});

test("normalizeCfg deja intacta una cámara vieja sin equipo", () => {
  const camaraVieja = { id: "c1", nombre: "CAM 1", plano: "Plano General", color: "#123456" };
  const cfg = normalizeCfg({ camaras: [camaraVieja], microfonos: [], escaleta: [] }, catalogo);
  assert.deepEqual(cfg.camaras[0], camaraVieja);
  assert.equal(Object.hasOwn(cfg.camaras[0], "equipo"), false);
});

test("normalizeCfg sanea una ficha corrupta y descarta una cámara desconocida", () => {
  const cfg = normalizeCfg({
    camaras: [
      {
        id: "c1", nombre: "CAM 1", plano: "Plano Medio", color: "#123456",
        equipo: { camara: "cam_ff", lente: "zoom_24_70", focal: 999, soporte: "inexistente", basura: true },
      },
      {
        id: "c2", nombre: "CAM 2", plano: "Plano General", color: "#654321",
        equipo: { camara: "no_existe", lente: "tampoco", focal: -4, soporte: "ninguno" },
      },
      {
        id: "c3", nombre: "CAM 3", plano: "Plano General", color: "#abcdef",
        equipo: { camara: "cam_ff", lente: "descontinuado", focal: 999, soporte: "tripie" },
      },
    ],
    microfonos: [],
    escaleta: [],
  }, catalogo);
  assert.deepEqual(cfg.camaras[0].equipo, {
    camara: "cam_ff", lente: "zoom_24_70", focal: 70, soporte: "",
  });
  assert.equal(Object.hasOwn(cfg.camaras[1], "equipo"), false);
  assert.deepEqual(cfg.camaras[2].equipo, {
    camara: "cam_ff", lente: null, focal: 70, soporte: "tripie",
  });
});

test("computeFuentes conserva la ficha de la cámara para el visor 3D", async () => {
  const { computeFuentes } = await import("../web-sources/generador-tv/src/escaleta.js");
  const equipo = { camara: "sony_fx6", lente: null, focal: 35, soporte: "tripie_video" };
  const [conFicha, generica] = computeFuentes({
    camaras: [{ id: "a", nombre: "CAM 1", equipo }, { id: "b", nombre: "CAM 2" }],
    extras: [],
  });
  assert.deepEqual(conFicha.equipo, equipo);
  assert.equal("equipo" in generica, false);
});

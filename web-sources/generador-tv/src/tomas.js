// Constructores compartidos de planos y cues. Se mantienen puros para que el
// visor 3D, el storyboard y el rundown creen exactamente la misma estructura.
import { esNarrativo } from "./proyecto.js";
import { uid } from "./util.js";

export function nuevoCue(cfg, tipo = "camara", crearId = uid) {
  const cams = cfg.camaras || [];
  const corte = (cfg.extras || []).find((extra) => extra.esCorte);
  const base = {
    id: crearId(),
    tipo,
    dur: 8,
    alAire: cams[0]?.id || "",
    previo: cams[1]?.id || "",
    transicion: "Corte",
    audio: "",
    grafico: "",
    texto: "",
    plano: "",
    estado: "borrador",
  };
  if (tipo === "grafico") return { ...base, grafico: "Lower third", texto: "Lanzar gráfico" };
  if (tipo === "comercial") return { ...base, alAire: corte?.id || base.alAire, dur: 30, texto: "Corte a comercial" };
  if (tipo === "cortinilla") return { ...base, dur: 10, texto: "Cortinilla" };
  if (tipo === "audio") return { ...base, texto: "Abrir micrófono" };
  if (tipo === "vtr") return { ...base, dur: 30, texto: "Lanzar VTR" };
  if (tipo === "instruccion") return { ...base, texto: "Instrucción del director" };
  return base;
}

export function crearPlanoNuevoPorModo(cfg, camaraId, crearId = uid) {
  const idCamara = camaraId || cfg.camaras?.[0]?.id || "";
  if (esNarrativo(cfg)) {
    return {
      id: crearId(),
      camId: idCamara,
      plano: "Plano Medio",
      mov: "Fija",
      audio: "",
      texto: "",
      imagen: "",
    };
  }
  return { ...nuevoCue(cfg, "camara", crearId), alAire: idCamara };
}

export function camaraAsignadaAlPlano(toma, narrativo) {
  return narrativo ? (toma?.camId || "") : (toma?.alAire || "");
}

/* Guarda una captura de la Vista 3D en el storyboard. Sin tomaId crea un plano
   nuevo en ese segmento con la cámara de la captura; con tomaId reemplaza la
   imagen de ese plano y, si no tenía cámara, le pone la de la captura (si ya
   tenía otra, la respeta). `captura3d` guarda focal, visión, tilt y pan para
   poder volver a ese encuadre algún día. */
export function conCapturaEnStoryboard(cfg, { segmentoId, tomaId, imagen, captura3d }, crearId = uid) {
  const narrativo = esNarrativo(cfg);
  return {
    ...cfg,
    escaleta: (cfg.escaleta || []).map((segmento) => {
      if (segmento.id !== segmentoId) return segmento;
      if (!tomaId) {
        const plano = { ...crearPlanoNuevoPorModo(cfg, captura3d.camId, crearId), imagen, captura3d };
        return { ...segmento, tomas: [...(segmento.tomas || []), plano] };
      }
      return {
        ...segmento,
        tomas: (segmento.tomas || []).map((toma) => {
          if (toma.id !== tomaId) return toma;
          const asignarCamara = camaraAsignadaAlPlano(toma, narrativo)
            ? {}
            : (narrativo ? { camId: captura3d.camId } : { alAire: captura3d.camId });
          return { ...toma, ...asignarCamara, imagen, captura3d };
        }),
      };
    }),
  };
}

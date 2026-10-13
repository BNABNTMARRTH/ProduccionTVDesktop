import React, { useState } from "react";
import { Camera, X } from "lucide-react";
import { nombreCortoCamara } from "./captura3d.js";
import { esNarrativo } from "./proyecto.js";
import { camaraAsignadaAlPlano } from "./tomas.js";

export default function PanelCapturaStoryboard({ cfg, camaraId, imagen, onGuardar, onCerrar }) {
  const narrativo = esNarrativo(cfg);
  const [confirmacion, setConfirmacion] = useState(null);
  const segmentos = cfg.escaleta || [];
  const camarasPorId = Object.fromEntries((cfg.camaras || []).map((camara) => [camara.id, camara]));
  const camaraCaptura = camarasPorId[camaraId];

  const elegirPlano = (segmentoId, toma, numero) => {
    const destino = { segmentoId, tomaId: toma.id, numero };
    if (toma.imagen) setConfirmacion(destino);
    else onGuardar(destino);
  };

  return (
    <div
      className="visor-set-3d__destino-capa"
      onPointerDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar(); }}
    >
      <aside className="visor-set-3d__destino visor-set-3d__vidrio" role="dialog" aria-modal="true" aria-labelledby="destino-captura-titulo">
        <header className="visor-set-3d__destino-cabecera">
          <div>
            <strong id="destino-captura-titulo">¿A qué plano va?</strong>
            <span>{nombreCortoCamara(camaraCaptura, Math.max(0, (cfg.camaras || []).findIndex((camara) => camara.id === camaraId)))}</span>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cancelar captura"><X size={19} /></button>
        </header>
        <div className="visor-set-3d__destino-cuerpo">
          <div className="visor-set-3d__destino-vista-previa">
            <img className="visor-set-3d__captura-previa" src={imagen} alt="Captura que se guardará en el storyboard" />
          </div>
          <div className="visor-set-3d__destino-lista">
            {!segmentos.length && (
              <div className="visor-set-3d__sin-destinos" role="status">
                <strong>Todavía no hay {narrativo ? "escenas" : "segmentos"}.</strong>
                <p>
                  {narrativo
                    ? "Créalas en Guion literario; después podrás volver aquí y agregar un plano."
                    : "Agrégalos en Escaleta editorial; después podrás volver aquí y agregar un plano de cámara."}
                </p>
              </div>
            )}
            {segmentos.map((segmento, indiceSegmento) => {
              const tituloBase = segmento.segmento || (narrativo ? "Escena sin título" : "Segmento sin título");
              const tituloSegmento = String(tituloBase).replace(/^\s*\d+\s*[.·:\-]\s*/, "");
              const tomas = (segmento.tomas || [])
                .map((toma, indiceToma) => ({
                  toma,
                  numero: `${indiceSegmento + 1}.${indiceToma + 1}`,
                  asignada: camaraAsignadaAlPlano(toma, narrativo),
                }))
                .filter(({ toma }) => narrativo || (toma.tipo || "camara") === "camara")
                .sort((a, b) => Number(b.asignada === camaraId) - Number(a.asignada === camaraId));
              const numeroNuevo = `${indiceSegmento + 1}.${(segmento.tomas || []).length + 1}`;
              return (
                <section key={segmento.id} className="visor-set-3d__destino-segmento">
                  <div className="visor-set-3d__destino-segmento-cab">
                    <strong>{indiceSegmento + 1}. {tituloSegmento}</strong>
                    <button
                      type="button"
                      onClick={() => onGuardar({ segmentoId: segmento.id, tomaId: null, numero: numeroNuevo })}
                      aria-label={`Crear el plano ${numeroNuevo} en ${narrativo ? "esta escena" : "este segmento"}`}
                    >
                      <span aria-hidden="true">＋</span> Nuevo
                    </button>
                  </div>
                  {!tomas.length && <p className="visor-set-3d__destino-vacio">Sin planos de cámara todavía.</p>}
                  {tomas.map(({ toma, numero, asignada }) => {
                    const coincide = asignada === camaraId;
                    const distinta = Boolean(asignada && !coincide);
                    const confirmando = confirmacion?.segmentoId === segmento.id && confirmacion?.tomaId === toma.id;
                    const encuadre = String(toma.plano || "").trim();
                    return (
                      <div key={toma.id} className={`visor-set-3d__destino-opcion${coincide ? " coincide" : ""}`}>
                        <button
                          type="button"
                          className="visor-set-3d__destino-plano"
                          onClick={() => elegirPlano(segmento.id, toma, numero)}
                          aria-label={`Guardar captura en el plano ${numero}${encuadre ? `, ${encuadre}` : ""}`}
                        >
                          {toma.imagen
                            ? <img src={toma.imagen} alt="" />
                            : <span className="visor-set-3d__destino-sin-imagen"><Camera size={19} /></span>}
                          <span className="visor-set-3d__destino-detalle">
                            <b>{numero}{encuadre ? ` · ${encuadre}` : ""}</b>
                            <small>{asignada ? (camarasPorId[asignada]?.nombre || "Cámara no disponible") : "Sin cámara asignada"}</small>
                            {distinta && <em>Se conservará esta cámara; la captura es de {camaraCaptura?.nombre || "otra cámara"}.</em>}
                          </span>
                          {coincide && <span className="visor-set-3d__coincide">Esta cámara</span>}
                        </button>
                        {confirmando && (
                          <div className="visor-set-3d__confirmar-reemplazo" role="alert">
                            <span>Este plano ya tiene imagen</span>
                            <button type="button" className="principal" onClick={() => onGuardar(confirmacion)}>Reemplazar</button>
                            <button type="button" onClick={() => setConfirmacion(null)}>Cancelar</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

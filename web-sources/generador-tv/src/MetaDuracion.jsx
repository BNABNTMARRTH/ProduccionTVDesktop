import React from "react";
import { fmt, parseDur } from "./util.js";
import { objetivoSegDe } from "./proyecto.js";

// DURACIÓN OBJETIVO del proyecto: cuánto DEBE durar, contra lo que llevas.
//
// En vivo la duración no se negocia (la señal entra y sale a una hora fija) y en
// narrativo casi siempre hay un tope: la canción del videoclip, el minutaje de
// la tarea, el corte del festival. Sin este dato el asistente no puede avisar
// que te estás pasando, que era justo la sugerencia más útil.
//
// Se guarda en SEGUNDOS, en `cfg.duracionObjetivoSeg`. Vacío = sin objetivo.
// Se escribe en MM:SS, igual que las duraciones de la escaleta, porque muchas
// piezas duran menos de un minuto: un spot de 30", una cápsula de 50". Antes
// el campo era de minutos enteros y esas piezas no se podían escribir.

export function MetaDuracion({ cfg, setCfg, total, editable }) {
  const objetivo = objetivoSegDe(cfg);
  // Lo que se está tecleando. Mientras el usuario escribe "1:" el valor no es
  // una duración válida todavía, así que no se guarda hasta que suelta el campo.
  const [borrador, setBorrador] = React.useState(null);
  const enCampo = borrador !== null;
  const mostrado = enCampo ? borrador : (objetivo ? fmt(objetivo) : "");

  const guardar = (segundos) => setCfg((c) => {
    const next = { ...c };
    if (!segundos) { delete next.duracionObjetivoSeg; delete next.duracionObjetivoMin; return next; }
    next.duracionObjetivoSeg = segundos;
    // El campo viejo en minutos se conserva SOLO si el objetivo cae en minutos
    // exactos, para que una versión anterior de la app lo siga leyendo bien.
    // Si no cae exacto se quita: mejor que no muestre nada a que mienta.
    if (segundos % 60 === 0) next.duracionObjetivoMin = segundos / 60;
    else delete next.duracionObjetivoMin;
    return next;
  }, { commit: true });

  const confirmar = () => {
    if (!enCampo) return;
    const seg = parseDur(borrador);
    setBorrador(null);
    guardar(!seg || seg < 0 ? 0 : Math.round(seg));
  };
  const dif = total - objetivo;
  const cerca = Math.abs(dif) < 30;

  const estado = !objetivo
    ? { texto: "Sin objetivo definido", color: "#5A6672", fondo: "#F1F5F9" }
    : cerca
      ? { texto: "En tiempo", color: "#1B7A44", fondo: "#E2F3E8" }
      : dif > 0
        ? { texto: `Te pasas ${fmt(dif)}`, color: "#B03030", fondo: "#FDE8E8" }
        : { texto: `Faltan ${fmt(-dif)}`, color: "#8A5A00", fondo: "#FEF6E6" };

  const avance = objetivo ? Math.min(1, total / objetivo) : 0;

  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
      style={{ borderColor: "var(--ui-linea)", background: "var(--ui-franja)" }}>
      <span className="text-xs font-bold uppercase" style={{ color: "var(--ui-tinta-media)", letterSpacing: 1 }}>
        Duración objetivo
      </span>

      {editable ? (
        <span className="flex items-center gap-1.5">
          <input
            type="text" inputMode="numeric" value={mostrado} placeholder="—"
            onChange={(e) => setBorrador(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmar(); e.currentTarget.blur(); }
              if (e.key === "Escape") { e.preventDefault(); setBorrador(null); e.currentTarget.blur(); }
            }}
            className="rounded-md border text-sm font-bold"
            style={{ width: 76, padding: "5px 8px", borderColor: "var(--ui-linea)", color: "var(--ui-tinta)", background: "transparent", textAlign: "right" }}
            title={"Cuánto debe durar el proyecto TERMINADO, en minutos:segundos.\n"
              + "1:30 = un minuto y medio · 0:45 o 45 = cuarenta y cinco segundos · 20:00 = veinte minutos.\n"
              + "Déjalo vacío si todavía no lo sabes."} />
          <span className="text-xs font-bold" style={{ color: "var(--ui-tinta-media)" }}>mm:ss</span>
        </span>
      ) : (
        <span className="text-sm font-bold" style={{ color: "var(--ui-tinta)" }}>{objetivo ? fmt(objetivo) : "—"}</span>
      )}

      <span className="text-xs" style={{ color: "var(--ui-tinta-media)" }}>
        Llevas <b style={{ color: "var(--ui-tinta)" }}>{fmt(total)}</b>
        {objetivo ? <> de <b style={{ color: "var(--ui-tinta)" }}>{fmt(objetivo)}</b></> : null}
      </span>

      {objetivo > 0 && (
        <span className="rounded-full" style={{ flex: "1 1 120px", minWidth: 90, height: 6, background: "var(--ui-linea)", overflow: "hidden" }}>
          <span style={{
            display: "block", height: "100%", width: `${avance * 100}%`,
            background: estado.color, transition: "width .2s ease",
          }} />
        </span>
      )}

      <span className="rounded-full px-2 py-0.5 text-xs font-bold"
        style={{ background: estado.fondo, color: estado.color }}>
        {estado.texto}
      </span>
    </div>
  );
}

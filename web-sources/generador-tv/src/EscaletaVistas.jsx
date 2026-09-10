import React, { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { fmt, textOn } from "./util.js";

// Las dos vistas de SOLO LECTURA de la escaleta, compartidas por la infografía
// y por la pestaña Escaleta:
//   · Escaleta  → la tabla (segmento, fuente al aire, entrada/salida, duración).
//   · Timeline  → la línea de tiempo con zoom, proporcional a la duración.
// Salen en DOS superficies (la hoja de la infografía y la mesa de trabajo de
// la pestaña), así que ninguna tinta va clavada: se piden las `--ui-*` y cada
// superficie contesta con las suyas (ver index.css). Antes estaban clavadas en
// papel y en modo oscuro esta tabla quedaba blanca en medio de la hoja apagada.
// Lo que SÍ va clavado es el color de cada fuente: identifica una cámara
// concreta y no cambia con el tema, igual que en el resto de la app.
export function Escaleta({ rows, byId, total }) {
  return (
    <div>
      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--ui-franja)" }}>
            {["#", "IN", "OUT", "DUR.", "SEGMENTO", "AL AIRE"].map((h) => (
              <th key={h} className="cond uppercase" style={{
                border: "1px solid var(--ui-linea)", padding: "3px 5px", fontSize: 11.5,
                color: "var(--ui-tinta)", letterSpacing: 0.5, textAlign: h === "SEGMENTO" ? "left" : "center",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const f = byId[r.fuente];
            return (
              <tr key={r.id} style={{ background: i % 2 ? "var(--ui-fila-alt)" : "var(--ui-fila)" }}>
                <td style={tdC}>{r.idx}</td>
                <td style={tdC}>{fmt(r.tin)}</td>
                <td style={tdC}>{fmt(r.tout)}</td>
                <td style={tdC}>{fmt(r.dur)}</td>
                <td style={{ ...tdC, textAlign: "left", fontWeight: 600, textTransform: "uppercase", fontSize: 10 }}>
                  {r.segmento}
                  {r.nota && <div className="normal-case" style={{ fontWeight: 400, fontSize: 8.5, color: "var(--ui-tinta-media)", marginTop: 1, lineHeight: 1.25 }}>{r.nota}</div>}
                </td>
                <td style={{ ...tdC, padding: "2px 4px" }}>
                  {f ? (
                    <span className="font-bold uppercase" style={{
                      background: f.color, color: textOn(f.color), fontSize: 9.5,
                      padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap",
                    }}>{f.nombre}</span>
                  ) : <span style={{ color: "var(--ui-tinta-media)" }}>—</span>}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan="6" style={{ ...tdC, padding: 14, color: "var(--ui-tinta-media)" }}>Sin segmentos — agrégalos en el editor</td></tr>
          )}
        </tbody>
      </table>
      <div className="cond text-center font-bold uppercase" style={{
        marginTop: 6, background: "var(--ui-franja)", border: "1px solid var(--ui-linea)",
        borderRadius: 6, padding: "3px", fontSize: 13, color: "var(--ui-tinta)", letterSpacing: 1,
      }}>Duración total: {fmt(total)} (min:seg)</div>
    </div>
  );
}
const tdC = { border: "1px solid var(--ui-linea)", padding: "2px 5px", fontSize: 10.5, textAlign: "center", color: "var(--ui-tinta)" };

export function Timeline({ rows, byId, total, bloques }) {
  const [zoom, setZoom] = useState(1);
  const step = total <= 0 ? 60 : total <= 960 ? 60 : total <= 1980 ? 120 : total <= 3900 ? 300 : 600;
  const marks = [];
  for (let t = 0; t <= total; t += step) marks.push(t);
  if (total === 0) return <div className="text-center" style={{ fontSize: 12, padding: 12, color: "var(--ui-tinta-media)" }}>Agrega segmentos a la escaleta para generar la línea de tiempo</div>;

  // Límites de cada segmento (para marcadores de transición). El cambio de bloque (corte) se resalta.
  let acc = 0;
  const cortes = [];
  rows.forEach((r, i) => {
    acc += r.dur || 0;
    if (i < rows.length - 1) {
      const f = byId[r.fuente], fn = byId[rows[i + 1].fuente];
      const esCorte = !!(f && f.esCorte) !== !!(fn && fn.esCorte);
      cortes.push({ at: acc, esCorte });
    }
  });
  const zbtn = "flex items-center justify-center rounded border";

  return (
    <div>
      <div className="no-print flex items-center gap-2" style={{ marginBottom: 8 }}>
        <button className={zbtn} style={{ borderColor: "var(--ui-linea)", width: 26, height: 26, color: "var(--ui-tinta)" }}
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="Alejar"><ZoomOut size={15} /></button>
        <span className="font-bold text-center" style={{ fontSize: 11, color: "var(--ui-tinta)", width: 42 }}>{Math.round(zoom * 100)}%</span>
        <button className={zbtn} style={{ borderColor: "var(--ui-linea)", width: 26, height: 26, color: "var(--ui-tinta)" }}
          onClick={() => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)))} aria-label="Acercar"><ZoomIn size={15} /></button>
        {zoom > 1 && <span style={{ fontSize: 11, color: "var(--ui-tinta-media)" }}>Desliza horizontalmente →</span>}
      </div>

      <div className="overflow-x-auto" style={{ paddingBottom: 4 }}>
        <div style={{ width: `${Math.round(100 * zoom)}%`, minWidth: "100%" }}>
          <div className="relative w-full" style={{ height: 16 }}>
            {marks.map((t) => (
              <span key={t} className="absolute font-semibold" style={{
                left: `${(t / total) * 100}%`, transform: "translateX(-50%)", fontSize: 9, color: "var(--ui-tinta-media)",
              }}>{fmt(t)}</span>
            ))}
          </div>

          {/* Marcadores de transición */}
          <div className="relative w-full" style={{ height: 10 }}>
            {cortes.map((c, i) => (
              <span key={i} className="absolute" title={c.esCorte ? "Entra/sale de corte" : "Cambio de fuente"}
                style={{ left: `${(c.at / total) * 100}%`, transform: "translateX(-50%)", top: 0 }}>
                {c.esCorte
                  ? <span style={{ display: "block", width: 8, height: 8, background: "#E0A100", transform: "rotate(45deg)", borderRadius: 1 }} />
                  : <span style={{ display: "block", width: 2, height: 8, background: "var(--ui-tinta-media)" }} />}
              </span>
            ))}
          </div>

          <div className="flex w-full overflow-hidden rounded-md border-2" style={{ height: 34, borderColor: "var(--ui-tinta)" }}>
            {rows.map((r) => {
              const f = byId[r.fuente];
              const w = (r.dur / total) * 100;
              return (
                <div key={r.id} title={`${r.segmento} · ${fmt(r.dur)}`} className="flex items-center justify-center"
                  style={{ width: `${w}%`, background: f ? f.color : "#9AA7B5", borderRight: "1px solid rgba(255,255,255,.55)" }}>
                  {w * zoom > 2.4 && (
                    <span className="font-bold" style={{ color: textOn(f ? f.color : "#9AA7B5"), fontSize: 11 }}>
                      {f ? (f.tipo === "cam" ? f.num : (f.nombre || "•").slice(0, 1)) : "?"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex w-full" style={{ height: 18, marginTop: 2 }}>
            {bloques.map((b, i) => (
              <div key={i} className="cond flex items-center justify-center font-bold uppercase truncate"
                style={{
                  width: `${(b.dur / total) * 100}%`, fontSize: 10, letterSpacing: 0.5,
                  color: b.corte ? "#8A6D00" : "var(--ui-tinta)", background: b.corte ? "#FBF3D2" : "transparent",
                  borderRight: "1px dashed var(--ui-tinta-media)", borderRadius: 3,
                }}>
                {(b.dur / total) * 100 * zoom > 5 ? b.label : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

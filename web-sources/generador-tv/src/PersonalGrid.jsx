import React from "react";
import { Camera, User } from "lucide-react";
import { ICONS } from "./iconos.jsx";
import { INK, NAVY } from "./theme.js";
import { textOn, trunc } from "./util.js";

// Rejilla del equipo humano: cada rol con su icono y, si el proyecto lo pide,
// un operador por cámara con el número y color de esa cámara.
export function PersonalGrid({ cfg, cams }) {
  return (
    <div className="flex flex-wrap gap-3">
      {cfg.personal.map((p) => {
        const Ic = ICONS[p.icon] || User;
        return (
          <div key={p.id} className="flex flex-col items-center text-center" style={{ width: 92 }}>
            <span className="flex items-center justify-center rounded-full" style={{ width: 42, height: 42, background: NAVY }}>
              <Ic size={20} color="#fff" />
            </span>
            <span className="font-bold uppercase" style={{ fontSize: 9.5, color: INK, marginTop: 4, lineHeight: 1.15 }}>{p.rol}</span>
          </div>
        );
      })}
      {cfg.includeCamOps && cams.map((c) => (
        <div key={c.id} className="flex flex-col items-center text-center" style={{ width: 92 }}>
          <span className="relative flex items-center justify-center rounded-full" style={{ width: 42, height: 42, background: "#22344E" }}>
            <Camera size={20} color="#fff" />
            <span className="absolute flex items-center justify-center rounded-full font-bold"
              style={{ top: -4, right: -4, width: 17, height: 17, background: c.color, color: textOn(c.color), fontSize: 10, border: "2px solid #fff" }}>{c.num}</span>
          </span>
          <span className="font-bold uppercase" style={{ fontSize: 9.5, color: INK, marginTop: 4, lineHeight: 1.15 }}>Cámara {c.num}</span>
          <span style={{ fontSize: 8.5, color: "#5B6B82", lineHeight: 1.1 }}>{trunc(c.plano, 24)}</span>
        </div>
      ))}
    </div>
  );
}

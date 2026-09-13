/**
 * GoF Pattern: Strategy Pattern
 * Estrategias profesionales de distribución física y técnica del set de televisión.
 */

import { reacomodoDe } from "./sets.js";

/**
 * Interfaz de Estrategia de Distribución
 */
export class SetLayoutStrategy {
  constructor(id, label, description) {
    this.id = id;
    this.label = label;
    this.description = description;
  }

  calculateLayout(cfg, set) {
    throw new Error("calculateLayout() debe ser implementado");
  }
}

/**
 * Estrategia 1: Noticiero Broadcast (Estándar de Informativos)
 * Mesa central, arco de 3 cámaras, iluminación 3 puntos y pared de fondo.
 */
export class BroadcastNewsStrategy extends SetLayoutStrategy {
  constructor() {
    super(
      "news",
      "Noticiero Broadcast",
      "Mesa central, arco frontal de 3 cámaras y luz de 3 puntos (Key, Fill, Back)."
    );
  }

  calculateLayout(cfg, set) {
    const W = 980;
    const pos = { mesa: { x: W / 2, y: 240 } };
    const rot = {};

    const cams = (cfg.camaras || []).filter(Boolean);
    const N = cams.length || 1;
    cams.forEach((c, i) => {
      const t = N === 1 ? 0 : -1 + (2 * i) / (N - 1);
      const a = (t * 70 * Math.PI) / 180;
      pos[`cam:${c.id}`] = {
        x: Math.round(W / 2 + Math.sin(a) * 330),
        y: Math.round(250 + Math.cos(a) * 240),
      };
      // rotación automática hacia la mesa
    });

    const talentos = cfg.talentos || [];
    talentos.forEach((t, i) => {
      const k = talentos.length === 1 ? 0 : -1 + (2 * i) / (talentos.length - 1);
      pos[`tal:${t.id}`] = {
        x: Math.round(W / 2 + k * Math.min(170, 50 + talentos.length * 26)),
        y: 168,
      };
    });

    const luces = set.iluminacion?.luces || [];
    luces.forEach((l) => {
      if (l.abrev === "KEY" || l.abrev === "KS") {
        pos[`luz:${l.id}`] = { x: W / 2 - 200, y: 360 };
      } else if (l.abrev === "FILL" || l.abrev === "F") {
        pos[`luz:${l.id}`] = { x: W / 2 + 200, y: 350 };
      } else if (l.abrev === "BACK" || l.abrev === "BL") {
        pos[`luz:${l.id}`] = { x: W / 2 + 160, y: 110 };
      } else if (l.abrev === "BG" || l.abrev === "WALL") {
        pos[`luz:${l.id}`] = { x: W / 2 - 150, y: 85 };
      }
    });

    return { pos, rot };
  }
}

/**
 * Estrategia 2: Entrevista / Talk Show
 * Cámaras cruzadas (A/B) más plano general (Master).
 */
export class InterviewTalkShowStrategy extends SetLayoutStrategy {
  constructor() {
    super(
      "interview",
      "Entrevista / Talk Show",
      "Planos cruzados para conductor e invitado con cámara master central."
    );
  }

  calculateLayout(cfg, set) {
    const W = 980;
    const pos = { mesa: { x: W / 2, y: 230 } };
    const rot = {};

    const cams = (cfg.camaras || []).filter(Boolean);
    if (cams[0]) pos[`cam:${cams[0].id}`] = { x: W / 2 - 240, y: 440 }; // Cruzada a invitado
    if (cams[1]) pos[`cam:${cams[1].id}`] = { x: W / 2, y: 480 };       // Master general
    if (cams[2]) pos[`cam:${cams[2].id}`] = { x: W / 2 + 240, y: 440 }; // Cruzada a conductor

    const talentos = cfg.talentos || [];
    if (talentos[0]) pos[`tal:${talentos[0].id}`] = { x: W / 2 - 120, y: 220 };
    if (talentos[1]) pos[`tal:${talentos[1].id}`] = { x: W / 2 + 120, y: 220 };

    return { pos, rot };
  }
}

/**
 * Estrategia 3: Mesa Redonda / Debate
 * Distribución simétrica perimetral para discusiones grupales.
 */
export class RoundTableDebateStrategy extends SetLayoutStrategy {
  constructor() {
    super(
      "debate",
      "Mesa de Debate",
      "Disposición circular con cobertura perimetral de cámaras."
    );
  }

  calculateLayout(cfg, set) {
    const W = 980;
    const pos = { mesa: { x: W / 2, y: 260 } };
    const rot = {};

    const talentos = cfg.talentos || [];
    const tCount = talentos.length || 1;
    talentos.forEach((t, i) => {
      const ang = (i * 2 * Math.PI) / tCount;
      pos[`tal:${t.id}`] = {
        x: Math.round(W / 2 + Math.cos(ang) * 95),
        y: Math.round(260 + Math.sin(ang) * 95),
      };
    });

    const cams = (cfg.camaras || []).filter(Boolean);
    const cCount = cams.length || 1;
    cams.forEach((c, i) => {
      const ang = (i * 2 * Math.PI) / cCount + Math.PI / 4;
      pos[`cam:${c.id}`] = {
        x: Math.round(W / 2 + Math.cos(ang) * 290),
        y: Math.round(260 + Math.sin(ang) * 220),
      };
    });

    return { pos, rot };
  }
}

/**
 * Estrategia 4: Streaming Unipersonal / Podcast
 * 1 o 2 cámaras frontales, setup compacto de alta proximidad.
 */
export class SoloStreamingStrategy extends SetLayoutStrategy {
  constructor() {
    super(
      "streaming",
      "Streaming / Podcast",
      "Plano principal cerrado con ángulo secundario y luz envolvente."
    );
  }

  calculateLayout(cfg, set) {
    const W = 980;
    const pos = { mesa: { x: W / 2, y: 250 } };
    const rot = {};

    const talentos = cfg.talentos || [];
    if (talentos[0]) pos[`tal:${talentos[0].id}`] = { x: W / 2, y: 220 };

    const cams = (cfg.camaras || []).filter(Boolean);
    if (cams[0]) pos[`cam:${cams[0].id}`] = { x: W / 2, y: 460 };
    if (cams[1]) pos[`cam:${cams[1].id}`] = { x: W / 2 + 180, y: 420 };

    const luces = set.iluminacion?.luces || [];
    if (luces[0]) pos[`luz:${luces[0].id}`] = { x: W / 2 - 120, y: 360 };
    if (luces[1]) pos[`luz:${luces[1].id}`] = { x: W / 2 + 120, y: 360 };
    if (luces[2]) pos[`luz:${luces[2].id}`] = { x: W / 2, y: 130 };

    return { pos, rot };
  }
}

/**
 * Catálogo y Contexto de Estrategias
 */
export const SET_LAYOUT_STRATEGIES = [
  new BroadcastNewsStrategy(),
  new InterviewTalkShowStrategy(),
  new RoundTableDebateStrategy(),
  new SoloStreamingStrategy(),
];

export function applyLayoutStrategy(strategyId, cfg, set) {
  const strategy = SET_LAYOUT_STRATEGIES.find((s) => s.id === strategyId) || SET_LAYOUT_STRATEGIES[0];
  const { pos, rot } = strategy.calculateLayout(cfg, set);

  return {
    ...set,
    setLayout: {
      ...(set.setLayout || {}),
      pos: { ...(set.setLayout?.pos || {}), ...pos },
      rot: { ...(set.setLayout?.rot || {}), ...rot },
    },
  };
}

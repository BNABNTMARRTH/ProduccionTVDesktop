import React, { useMemo, useRef, useState } from "react";
import { SetEntityFactory } from "./setEntities.jsx";
import { MoveEntityCommand, RotateEntityCommand } from "./setCommands.js";
import { posMuebleDefault, upSetPor } from "./sets.js";
import { trunc } from "./util.js";

/**
 * EstudioCenital:
 * Planta física interactiva 2D del set de televisión.
 * Integra Factory Method (GoF) para entidades vectoriales,
 * Command Pattern (GoF) para transformaciones atómicas,
 * y estética Apple Studio CAD de alta precisión.
 */
export function EstudioCenital({
  cfg,
  set,
  cams = [],
  editable = true,
  setCfg,
  showLabels = true,
  showGuides = true,
  selectedKey = null,
  onSelectEntity = null,
  commandManager = null,
}) {
  const W = 980;
  const H = 600;

  const svgRef = useRef(null);
  const liveRef = useRef(null);
  const [live, setLive] = useState(null);
  const liveRotRef = useRef(null);
  const [liveRot, setLiveRot] = useState(null);

  // Zoom y Pan del lienzo
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const talentos = cfg.talentos || [];
  const mics = cfg.microfonos || [];
  const muebles = set.muebles || [];

  const labelsOff = set.setLayout?.labelsOff || {};
  const lab = (key) => showLabels && !labelsOff[key];

  const hideLabel = (key) => (e) => {
    if (!editable) return;
    e.stopPropagation();
    setCfg((c) =>
      upSetPor(c, set.id, (s) => ({
        ...s,
        setLayout: {
          ...s.setLayout,
          labelsOff: { ...(s.setLayout.labelsOff || {}), [key]: true },
        },
      }))
    );
  };

  const labProps = (key) => ({
    onDoubleClick: hideLabel(key),
    style: editable ? { cursor: "pointer" } : undefined,
  });

  const sentados = new Set(muebles.flatMap((m) => m.ocupantes || []));
  const N = cams.length;

  const talIds = new Set(talentos.map((t) => t.id));
  const camIds = new Set(cams.map((c) => c.id));
  const micsDeTal = (tid) => mics.filter((m) => m.micTipo !== "boom" && m.asignadoA === `tal:${tid}`);
  const shotgunDe = (cid) => mics.filter((m) => m.micTipo === "shotgun" && m.asignadoA === `cam:${cid}`);
  const booms = mics.filter((m) => m.micTipo === "boom");
  const sueltos = mics.filter((m) => {
    if (m.micTipo === "boom") return false;
    const a = m.asignadoA || "";
    if (m.micTipo === "shotgun") return !(a.startsWith("cam:") && camIds.has(a.slice(4)));
    return !(a.startsWith("tal:") && talIds.has(a.slice(4)));
  });

  // Posiciones por defecto del set
  const defaults = useMemo(() => {
    const d = { mesa: { x: W / 2, y: 240 } };
    talentos.forEach((t, i) => {
      const k = talentos.length === 1 ? 0 : -1 + (2 * i) / (talentos.length - 1);
      d[`tal:${t.id}`] = { x: W / 2 + k * Math.min(170, 50 + talentos.length * 26), y: 168 };
    });
    booms.forEach((m, i) => {
      d[`mic:${m.id}`] = { x: 645 + i * 58, y: 205 };
    });
    sueltos.forEach((m, i) => {
      d[`mic:${m.id}`] = { x: 215 + i * 54, y: 305 };
    });
    muebles.forEach((m, i) => {
      d[`mue:${m.id}`] = posMuebleDefault(i);
    });
    cams.forEach((c, i) => {
      const t = N === 1 ? 0 : -1 + (2 * i) / (N - 1);
      const a = (t * 70 * Math.PI) / 180;
      d[`cam:${c.id}`] = { x: W / 2 + Math.sin(a) * 330, y: 250 + Math.cos(a) * 240 };
    });
    return d;
  }, [cams, talentos, mics, muebles, N]);

  const saved = set.setLayout?.pos || {};
  const savedRot = set.setLayout?.rot || {};
  const posDe = (key) => live?.[key] || saved[key] || defaults[key] || { x: W / 2, y: 320 };
  const setLiveBoth = (v) => {
    liveRef.current = v;
    setLive(v);
  };
  const setLiveRotBoth = (v) => {
    liveRotRef.current = v;
    setLiveRot(v);
  };

  // Arrastre con Command Pattern
  const startDrag = (key) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const toSvg = (ev) => {
      const r = svg.getBoundingClientRect();
      return {
        x: ((ev.clientX - r.left) / r.width) * W,
        y: ((ev.clientY - r.top) / r.height) * H,
      };
    };

    const origin = toSvg(e);
    const initialPos = posDe(key);

    const move = (ev) => {
      const p = toSvg(ev);
      setLiveBoth({
        ...(liveRef.current || {}),
        [key]: {
          x: Math.round(Math.max(48, Math.min(W - 48, initialPos.x + p.x - origin.x))),
          y: Math.round(Math.max(100, Math.min(H - 44, initialPos.y + p.y - origin.y))),
        },
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const finalPos = liveRef.current?.[key];
      if (finalPos && (finalPos.x !== initialPos.x || finalPos.y !== initialPos.y)) {
        if (commandManager) {
          commandManager.execute(new MoveEntityCommand(set.id, key, initialPos, finalPos));
        } else {
          setCfg((c) =>
            upSetPor(c, set.id, (s) => ({
              ...s,
              setLayout: {
                ...(s.setLayout || {}),
                pos: { ...(s.setLayout?.pos || {}), [key]: finalPos },
              },
            })),
            { commit: true }
          );
        }
      }
      setLiveBoth(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Giro con Command Pattern
  const startRotate = (key) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const toSvg = (ev) => {
      const r = svg.getBoundingClientRect();
      return {
        x: ((ev.clientX - r.left) / r.width) * W,
        y: ((ev.clientY - r.top) / r.height) * H,
      };
    };

    const initialRot = savedRot[key] ?? null;

    const move = (ev) => {
      const p = toSvg(ev);
      const c = posDe(key);
      let angle = Math.round((Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI);
      // Snap magnético suave a ángulos estándar (0, 45, 90, 180) si está a ±4 grados
      [0, 45, 90, 135, 180, -45, -90, -135, -180].forEach((snap) => {
        if (Math.abs(angle - snap) <= 4) angle = snap;
      });
      setLiveRotBoth({
        ...(liveRotRef.current || {}),
        [key]: angle,
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const finalRot = liveRotRef.current?.[key];
      if (typeof finalRot === "number" && finalRot !== initialRot) {
        if (commandManager) {
          commandManager.execute(new RotateEntityCommand(set.id, key, initialRot, finalRot));
        } else {
          setCfg((c) =>
            upSetPor(c, set.id, (s) => ({
              ...s,
              setLayout: {
                ...(s.setLayout || {}),
                rot: { ...(s.setLayout?.rot || {}), [key]: finalRot },
              },
            })),
            { commit: true }
          );
        }
      }
      setLiveRotBoth(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const resetRotate = (key) => (e) => {
    if (!editable) return;
    e.stopPropagation();
    const prevRot = savedRot[key] ?? null;
    if (commandManager) {
      commandManager.execute(new RotateEntityCommand(set.id, key, prevRot, null));
    } else {
      setCfg((c) =>
        upSetPor(c, set.id, (s) => {
          const rot = { ...(s.setLayout?.rot || {}) };
          delete rot[key];
          return { ...s, setLayout: { ...(s.setLayout || {}), rot } };
        }),
        { commit: true }
      );
    }
  };

  const mesa = posDe("mesa");
  const muebleEncima = muebles.some((m) => {
    const p = posDe(`mue:${m.id}`);
    return Math.hypot(p.x - mesa.x, p.y - mesa.y) < 46;
  });

  const grab = editable ? { cursor: "grab" } : undefined;
  const ext = set.locacion === "ext";

  // Colores de estudio estilo Apple Pro
  const piso = ext
    ? { fill: "#152419", stroke: "#23422a", grid: "#1c3321", dot: "#2b4d32" }
    : { fill: "#111827", stroke: "#1f293d", grid: "#1b2434", dot: "#27354d" };

  return (
    <div className="set-studio-canvas-container relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ background: "#0c111c" }}>
      {/* Barra de herramientas flotante de Zoom / Vista (Apple Glass Dock) */}
      <div className="no-print absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 px-2 py-1 shadow-lg backdrop-blur-md">
        <button
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white/80 hover:bg-white/15 hover:text-white transition-colors"
          title="Alejar (Zoom Out)"
        >
          -
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-2 py-0.5 text-[11px] font-semibold text-white/80 hover:bg-white/15 hover:text-white rounded-md transition-colors"
          title="Ajustar a ventana (⌘0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white/80 hover:bg-white/15 hover:text-white transition-colors"
          title="Acercar (Zoom In)"
        >
          +
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        style={{
          display: "block",
          touchAction: "none",
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "center center",
          transition: "transform 0.15s ease-out",
        }}
        onClick={(e) => {
          if (e.target === svgRef.current && onSelectEntity) {
            onSelectEntity(null);
          }
        }}
      >
        <defs>
          <pattern id="studioGridPattern" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M 52 0 L 0 0 0 52" fill="none" stroke={piso.grid} strokeWidth="1" />
            <circle cx="52" cy="52" r="1.5" fill={piso.dot} />
          </pattern>
          <radialGradient id="stageSpotGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Fondo del estudio con retícula CAD */}
        <rect x="20" y="20" width={W - 40} height={H - 40} rx="16" fill={piso.fill} stroke={piso.stroke} strokeWidth="2" />
        <rect x="20" y="20" width={W - 40} height={H - 40} rx="16" fill="url(#studioGridPattern)" />
        <circle cx={W / 2} cy={H / 2} r="280" fill="url(#stageSpotGradient)" pointerEvents="none" />

        {/* Interior: Pantalla/Muro de fondo. Exterior: Locación exterior */}
        {!ext ? (
          <g>
            <rect x="20" y="20" width={W - 40} height="32" rx="14" fill="#182333" stroke="#25354e" strokeWidth="1.5" />
            <rect x="240" y="38" width="500" height="16" rx="5" fill="#0c121c" stroke="#0A84FF" strokeWidth="1.8" filter="drop-shadow(0 2px 6px rgba(10,132,255,0.25))" />
            <text x={W / 2} y="74" textAnchor="middle" fontSize="12" fontWeight="800" fill="#E5EDF7" style={{ letterSpacing: 1.5 }}>
              PANTALLA · {trunc(cfg.pantalla || "NOTICIERO", 42)}
            </text>
          </g>
        ) : (
          <g>
            <g transform={`translate(${W - 75} 68)`}>
              <circle r="15" fill="#FBBF24" stroke="#D97706" strokeWidth="2.5" filter="drop-shadow(0 0 8px rgba(251,191,36,0.4))" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <line key={a} transform={`rotate(${a})`} x1="0" y1="-21" x2="0" y2="-27" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
              ))}
            </g>
            <text x="40" y="74" fontSize="12" fontWeight="800" fill="#34D399" style={{ letterSpacing: 1.5 }}>
              LOCACIÓN EXTERIOR
            </text>
          </g>
        )}

        {/* 1. Luminarias del Set */}
        {(set.iluminacion?.luces || []).map((l) => {
          const key = `luz:${l.id}`;
          const p = posDe(key);
          const manual = liveRot?.[key] ?? savedRot[key];
          const auto = l.dir === "mesa"
            ? (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI
            : l.dir === "muro" ? -90 : null;
          const rot = typeof manual === "number" ? manual : auto;

          const lightEntity = SetEntityFactory.createLight(l, p, rot);
          return lightEntity.renderSVG({
            isSelected: selectedKey === key,
            showGuides,
            showLabels: lab(key),
            isManualRot: typeof manual === "number",
            onSelect: onSelectEntity,
            startDrag,
            startRotate,
            resetRotate,
            grab,
            editable,
            labProps,
          });
        })}

        {/* 2. Punto de Foco o Mesa Central */}
        {(() => {
          const focusEntity = SetEntityFactory.createFocusTarget(
            mesa,
            set.mesaVisible !== false,
            cfg.mesa || "",
            muebleEncima
          );
          return focusEntity.renderSVG({
            isSelected: selectedKey === "mesa",
            onSelect: onSelectEntity,
            startDrag,
            grab,
          });
        })()}

        {/* 3. Mobiliario en Planta */}
        {muebles.map((m) => {
          const key = `mue:${m.id}`;
          const p = posDe(key);
          const manual = liveRot?.[key] ?? savedRot[key];
          const rot = typeof manual === "number" ? manual : 0;
          const occupants = (m.ocupantes || [])
            .map((id) => talentos.find((t) => t.id === id))
            .filter(Boolean);

          const furnitureEntity = SetEntityFactory.createFurniture(m, p, rot, occupants);
          return furnitureEntity.renderSVG({
            isSelected: selectedKey === key,
            showLabels: lab(key),
            isManualRot: typeof manual === "number",
            onSelect: onSelectEntity,
            startDrag,
            startRotate,
            resetRotate,
            grab,
            editable,
            labProps,
            micsDeTal,
          });
        })}

        {/* 4. Talentos libres en piso */}
        {talentos
          .filter((t) => !sentados.has(t.id))
          .map((t) => {
            const key = `tal:${t.id}`;
            const p = posDe(key);
            const micsT = micsDeTal(t.id);
            const talentEntity = SetEntityFactory.createTalent(t, p, micsT);
            return talentEntity.renderSVG({
              isSelected: selectedKey === key,
              showLabels: lab(key),
              onSelect: onSelectEntity,
              startDrag,
              grab,
              labProps,
            });
          })}

        {/* 5. Micrófonos Boom */}
        {booms.map((m) => {
          const key = `mic:${m.id}`;
          const p = posDe(key);
          const manual = liveRot?.[key] ?? savedRot[key];
          const rot = typeof manual === "number" ? manual : (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI;
          const boomEntity = SetEntityFactory.createMicrophone(m, p, rot);
          return boomEntity.renderSVG({
            isSelected: selectedKey === key,
            showGuides,
            showLabels: lab(key),
            isManualRot: typeof manual === "number",
            onSelect: onSelectEntity,
            startDrag,
            startRotate,
            resetRotate,
            grab,
            editable,
            labProps,
          });
        })}

        {/* 6. Micrófonos Sueltos en Piso */}
        {sueltos.map((m) => {
          const key = `mic:${m.id}`;
          const p = posDe(key);
          const micEntity = SetEntityFactory.createMicrophone(m, p, 0);
          return micEntity.renderSVG({
            isSelected: selectedKey === key,
            showGuides,
            showLabels: lab(key),
            isManualRot: false,
            onSelect: onSelectEntity,
            startDrag,
            grab,
            labProps,
          });
        })}

        {/* 7. Cámaras Profesionales */}
        {cams.map((c) => {
          const key = `cam:${c.id}`;
          const p = posDe(key);
          const manual = liveRot?.[key] ?? savedRot[key];
          const rot = typeof manual === "number" ? manual : (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI;
          const shots = shotgunDe(c.id);
          const camEntity = SetEntityFactory.createCamera(c, p, rot, shots);
          return camEntity.renderSVG({
            isSelected: selectedKey === key,
            showGuides,
            showLabels: lab(key),
            isManualRot: typeof manual === "number",
            onSelect: onSelectEntity,
            startDrag,
            startRotate,
            resetRotate,
            grab,
            editable,
            labProps,
          });
        })}

        {/* Leyenda de escala métrica en esquina inferior */}
        <text x="40" y={H - 32} fontSize="10" fill="#64748b" style={{ letterSpacing: 1.2, fontWeight: 600 }}>
          ESTUDIO CAD 2D · {ext ? "EXTERIOR" : "INTERIOR"} · RETÍCULA = 1 METRO
        </text>
      </svg>
    </div>
  );
}

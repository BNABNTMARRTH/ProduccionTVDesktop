import React, { useMemo, useRef, useState } from "react";
import { MIC_TIPO_CORTO, MUEBLES_CATALOGO, MUEBLE_ASIENTOS } from "./catalogos.js";
import { GlyphLuz, GlyphMueble } from "./glifos.jsx";
import { posMuebleDefault, upSetPor } from "./sets.js";
import { textOn, trunc } from "./util.js";

/* DÓNDE VA EL NOMBRE DE QUIEN SE SIENTA.
   En un sofá la gente va en fila y los nombres caben apilados debajo, que es
   como se hizo siempre. En una MESA la gente se sienta ALREDEDOR, y esa pila
   dejaba cuatro nombres uno encima de otro sin decir quién es quién —y encima
   tapando a la persona del asiento de abajo—. Cuando los asientos están
   repartidos en corro, cada nombre se va junto a SU asiento, empujado un poco
   hacia afuera; y la etiqueta del mueble se baja hasta debajo de todos.
   Los nombres no giran con el mueble (se leerían de cabeza), pero su POSICIÓN
   sí: por eso se rota a mano el punto de anclaje. */
function rotulosDe(asientos, rot) {
  const enCorro = asientos.some((a) => Math.abs(a.y) > 8);
  if (!enCorro) {
    return { mueble: 34, de: (i) => ({ x: 0, y: 45 + i * 11, corta: 30 }) };
  }
  const rad = (rot * Math.PI) / 180;
  const gira = (a) => ({
    x: a.x * Math.cos(rad) - a.y * Math.sin(rad),
    y: a.x * Math.sin(rad) + a.y * Math.cos(rad),
  });
  const AFUERA = 1.35;
  const abajo = Math.max(...asientos.map((a) => gira(a).y * AFUERA));
  return {
    mueble: Math.max(34, Math.round(abajo) + 24),
    de: (i) => {
      const p = gira(asientos[i % asientos.length]);
      return { x: Math.round(p.x * AFUERA), y: Math.round(p.y * AFUERA) + 4, corta: 22 };
    },
  };
}

// Planta física de UN set vista desde arriba (interior o exterior). Talentos,
// mesa (o punto de foco), micrófonos, luces y cámaras se arrastran con el
// puntero. Lo direccional (cámaras, luces, booms) apunta a la mesa/foco por
// defecto; su manija fija un ángulo manual (set.setLayout.rot) y con doble
// clic vuelve al seguimiento automático.
export function EstudioCenital({ cfg, set, cams, editable, setCfg, showLabels = true, showGuides = true }) {
  const W = 980, H = 600;
  const svgRef = useRef(null);
  const liveRef = useRef(null); // posiciones durante el arrastre (espejo del estado)
  const [live, setLive] = useState(null);
  const liveRotRef = useRef(null); // ángulos durante el giro (espejo del estado)
  const [liveRot, setLiveRot] = useState(null);
  const talentos = cfg.talentos || [];
  const mics = cfg.microfonos || [];
  const muebles = set.muebles || [];
  // Etiquetas ocultas una por una (doble clic sobre la etiqueta): se guardan
  // por set y también las respetan las hojas impresas (sheets.js).
  const labelsOff = set.setLayout?.labelsOff || {};
  const lab = (key) => showLabels && !labelsOff[key];
  const hideLabel = (key) => (e) => {
    if (!editable) return;
    e.stopPropagation();
    setCfg((c) => upSetPor(c, set.id, (s) => ({
      ...s,
      setLayout: { ...s.setLayout, labelsOff: { ...(s.setLayout.labelsOff || {}), [key]: true } },
    })));
  };
  const labProps = (key) => ({ onDoubleClick: hideLabel(key), style: editable ? { cursor: "pointer" } : undefined });
  // Talentos sentados en un mueble: se dibujan sobre él, no sueltos.
  const sentados = new Set(muebles.flatMap((m) => m.ocupantes || []));
  const N = cams.length;

  // Reparto de micrófonos: en talento (solapa/dinámico), boom con posición
  // propia, shotgun montado en su cámara, o suelto en el piso del set.
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

  // Posiciones por defecto: mesa al centro, talentos tras ella, booms al lado,
  // mics sueltos al frente y cámaras en arco.
  const defaults = useMemo(() => {
    const d = { mesa: { x: 490, y: 240 } };
    talentos.forEach((t, i) => {
      const k = talentos.length === 1 ? 0 : -1 + (2 * i) / (talentos.length - 1);
      d[`tal:${t.id}`] = { x: 490 + k * Math.min(170, 50 + talentos.length * 26), y: 168 };
    });
    booms.forEach((m, i) => { d[`mic:${m.id}`] = { x: 645 + i * 58, y: 205 }; });
    sueltos.forEach((m, i) => { d[`mic:${m.id}`] = { x: 215 + i * 54, y: 305 }; });
    muebles.forEach((m, i) => { d[`mue:${m.id}`] = posMuebleDefault(i); });
    cams.forEach((c, i) => {
      const t = N === 1 ? 0 : -1 + (2 * i) / (N - 1);
      const a = (t * 70 * Math.PI) / 180;
      d[`cam:${c.id}`] = { x: 490 + Math.sin(a) * 330, y: 250 + Math.cos(a) * 240 };
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cams, talentos, mics, muebles, N]);

  const saved = set.setLayout?.pos || {};
  const savedRot = set.setLayout?.rot || {};
  const posDe = (key) => live?.[key] || saved[key] || defaults[key] || { x: 490, y: 320 };
  const setLiveBoth = (v) => { liveRef.current = v; setLive(v); };
  const setLiveRotBoth = (v) => { liveRotRef.current = v; setLiveRot(v); };

  const startDrag = (key) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    const toSvg = (ev) => {
      const r = svg.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    };
    const origin = toSvg(e);
    const base = posDe(key);
    const move = (ev) => {
      const p = toSvg(ev);
      setLiveBoth({
        ...(liveRef.current || {}),
        [key]: {
          x: Math.round(Math.max(48, Math.min(W - 48, base.x + p.x - origin.x))),
          y: Math.round(Math.max(100, Math.min(H - 44, base.y + p.y - origin.y))),
        },
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = liveRef.current;
      if (current) setCfg((c) => upSetPor(c, set.id, (s) => ({ ...s, setLayout: { ...(s.setLayout || {}), pos: { ...(s.setLayout?.pos || {}), ...current } } })), { commit: true });
      setLiveBoth(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Giro manual: arrastrar la manija fija el ángulo de la cámara hacia el puntero.
  const startRotate = (key) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    const toSvg = (ev) => {
      const r = svg.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    };
    const move = (ev) => {
      const p = toSvg(ev);
      const c = posDe(key);
      setLiveRotBoth({
        ...(liveRotRef.current || {}),
        [key]: Math.round((Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = liveRotRef.current;
      if (current) setCfg((c) => upSetPor(c, set.id, (s) => ({ ...s, setLayout: { ...(s.setLayout || {}), rot: { ...(s.setLayout?.rot || {}), ...current } } })), { commit: true });
      setLiveRotBoth(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Doble clic en la manija: borrar el ángulo manual y volver a seguir la mesa.
  const resetRotate = (key) => (e) => {
    if (!editable) return;
    e.stopPropagation();
    setCfg((c) => upSetPor(c, set.id, (s) => {
      const rot = { ...(s.setLayout?.rot || {}) };
      delete rot[key];
      return { ...s, setLayout: { ...(s.setLayout || {}), rot } };
    }), { commit: true });
  };

  const mesa = posDe("mesa");
  // ¿Hay un mueble prácticamente encima del punto de foco? (una mesa puesta
  // justo en el centro, que es lo normal en un panel o una mesa redonda)
  const muebleEncima = muebles.some((m) => {
    const p = posDe(`mue:${m.id}`);
    return Math.hypot(p.x - mesa.x, p.y - mesa.y) < 46;
  });
  const grab = editable ? { cursor: "grab" } : undefined;
  const ext = set.locacion === "ext";
  // Paleta del piso: estudio (gris azulado) o exterior (verde pasto).
  const piso = ext
    ? { fill: "var(--plano-piso-ext)", stroke: "var(--plano-borde-ext)", grid: "var(--plano-rejilla-ext)" }
    : { fill: "var(--plano-piso)", stroke: "var(--plano-borde)", grid: "var(--plano-rejilla)" };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", touchAction: "none" }}>
      {/* Piso con retícula (cada celda ≈ 1 m) */}
      <rect x="20" y="20" width="940" height={H - 40} rx="12" fill={piso.fill} stroke={piso.stroke} strokeWidth="2" />
      {Array.from({ length: 17 }, (_, i) => 20 + (i + 1) * 52).map((x) => (
        <line key={`v${x}`} x1={x} y1="48" x2={x} y2={H - 22} stroke={piso.grid} />
      ))}
      {Array.from({ length: 10 }, (_, i) => 48 + (i + 1) * 52).map((y) => (
        <line key={`h${y}`} x1="22" y1={y} x2="958" y2={y} stroke={piso.grid} />
      ))}

      {/* Interior: muro del set con la pantalla. Exterior: cielo abierto (sol). */}
      {!ext && (
        <>
          <rect x="20" y="20" width="940" height="28" rx="12" fill="var(--plano-barra)" />
          <rect x="250" y="40" width="480" height="14" rx="4" fill="var(--plano-barra-hueco)" stroke="var(--plano-barra-borde)" strokeWidth="2" />
          <text x="490" y="74" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--plano-tinta)" style={{ letterSpacing: 1 }}>
            PANTALLA · {trunc(cfg.pantalla, 42)}
          </text>
        </>
      )}
      {ext && (
        <g>
          <g transform="translate(903 68)">
            <circle r="14" fill="#FCD34D" stroke="#F59E0B" strokeWidth="2" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <line key={a} transform={`rotate(${a})`} x1="0" y1="-19" x2="0" y2="-25" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            ))}
          </g>
          <text x="40" y="74" fontSize="12" fontWeight="800" fill="var(--plano-ext-tinta)" style={{ letterSpacing: 1 }}>LOCACIÓN EXTERIOR</text>
        </g>
      )}

      {/* Luces (arrastrables; las direccionales giran con su manija, doble
          clic en la manija = volver a la dirección automática). Van debajo
          de mesa/talentos/cámaras para que los haces no tapen nada. */}
      {(set.iluminacion?.luces || []).map((l) => {
        const key = `luz:${l.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const auto = l.dir === "mesa"
          ? (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI
          : l.dir === "muro" ? -90 : null;
        const rot = typeof manual === "number" ? manual : auto;
        return (
          <g key={l.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{l.nombre}</title>
            {rot !== null && (
              <g transform={`rotate(${rot})`}>
                {showGuides && <path d="M10 0 L64 -26 L64 26 Z" fill={l.color} opacity="0.12" />}
                {editable && (
                  <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                    <title>Arrastra para girar la luz · doble clic: dirección automática</title>
                    <line x1="16" y1="0" x2="62" y2="0" stroke={l.color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.6" />
                    <circle cx="70" cy="0" r="7" fill={typeof manual === "number" ? l.color : "var(--plano-objeto)"} stroke={l.color} strokeWidth="2" />
                  </g>
                )}
              </g>
            )}
            {l.opcional && <circle r="14" fill="none" stroke={l.color} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8" />}
            <GlyphLuz forma={l.forma} color={l.color} />
            <g transform="translate(0 -18)">
              <rect x="-14" y="-11" width="28" height="12" rx="6" fill={l.color} />
              <text y="-2" textAnchor="middle" fontSize="8" fontWeight="800" fill={textOn(l.color)}>{l.abrev}</text>
            </g>
            {lab(`luz:${l.id}`) && <text {...labProps(`luz:${l.id}`)} y="27" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--plano-tinta)">{trunc(l.nombre, 20)}</text>}
          </g>
        );
      })}

      {/* Mesa (arrastrable). Si el set no tiene mesa, en su lugar hay un punto
          de foco arrastrable: el blanco al que apuntan cámaras y luces. */}
      {set.mesaVisible !== false ? (
        <g transform={`translate(${mesa.x} ${mesa.y})`} onPointerDown={startDrag("mesa")} style={grab}>
          <rect x="-110" y="-34" width="220" height="68" rx="14" fill="var(--plano-objeto)" stroke="var(--plano-objeto-borde)" strokeWidth="2.5" />
          <rect x="-88" y="-12" width="176" height="24" rx="5" fill="var(--plano-barra)" />
          <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" style={{ letterSpacing: 1 }}>{trunc(cfg.mesa, 24)}</text>
        </g>
      ) : (
        <g transform={`translate(${mesa.x} ${mesa.y})`} onPointerDown={startDrag("mesa")} style={grab}>
          <title>Punto de foco: cámaras y luces apuntan aquí</title>
          <circle r="16" fill="none" stroke="var(--plano-tinta-baja)" strokeWidth="1.6" strokeDasharray="4 3" />
          <path d="M-23 0 H23 M0 -23 V23" stroke="var(--plano-tinta-baja)" strokeWidth="1.4" />
          <circle r="3" fill="var(--plano-tinta-baja)" />
          {/* El rótulo se calla si hay un mueble justo encima: ahí el mueble
              YA dice dónde está el centro, y las letras solo lo ensucian. La
              cruz se queda, que es de donde se agarra para moverlo. */}
          {!muebleEncima && <text y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--plano-tinta-baja)">PUNTO DE FOCO</text>}
        </g>
      )}

      {/* Mobiliario (arrastrable y giratorio) con sus ocupantes sentados */}
      {muebles.map((m) => {
        const def = MUEBLES_CATALOGO[m.tipo] || MUEBLES_CATALOGO.sillon1;
        const asientos = MUEBLE_ASIENTOS[m.tipo] || MUEBLE_ASIENTOS.sillon1;
        const key = `mue:${m.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const rot = typeof manual === "number" ? manual : 0;
        const ocupantes = (m.ocupantes || []).map((id) => talentos.find((t) => t.id === id)).filter(Boolean);
        const rotulo = rotulosDe(asientos, rot);
        return (
          <g key={m.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{def.es}{ocupantes.length ? ` · ${ocupantes.map((t) => t.nombre).join(", ")}` : ""}</title>
            <g transform={`rotate(${rot})`}>
              <GlyphMueble tipo={m.tipo} />
              {ocupantes.map((t, i) => {
                const a = asientos[i % asientos.length];
                const col = t.tipo === "invitado" ? "#0E9F9E" : "var(--plano-talento)";
                return (
                  <g key={t.id} transform={`translate(${a.x} ${a.y})`}>
                    <circle r="9" fill="var(--plano-objeto)" stroke={col} strokeWidth="2" />
                    <circle r="3.2" cy="-1.5" fill={col} />
                    <path d="M-4.5 2.5 q4.5 5 9 0 l1 4.5 h-11 z" fill={col} />
                  </g>
                );
              })}
              {editable && (
                <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                  <title>Arrastra para girar el mueble · doble clic: orientación original</title>
                  <line x1={def.mitad + 2} y1="0" x2={def.mitad + 12} y2="0" stroke="var(--plano-linea)" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7" />
                  <circle cx={def.mitad + 18} cy="0" r="6.5" fill={typeof manual === "number" ? "var(--plano-linea)" : "var(--plano-objeto)"} stroke="var(--plano-linea)" strokeWidth="2" />
                </g>
              )}
            </g>
            {lab(`mue:${m.id}`) && <text {...labProps(`mue:${m.id}`)} y={rotulo.mueble} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--plano-linea)">{def.es.toUpperCase()}</text>}
            {ocupantes.map((t, i) => {
              if (!lab(`tal:${t.id}`)) return null;
              const micsT = micsDeTal(t.id);
              const micTxt = micsT.length ? ` · ${micsT.map((x) => MIC_TIPO_CORTO[x.micTipo] || "mic").join(" + ")}` : "";
              const donde = rotulo.de(i);
              return (
                <text key={t.id} {...labProps(`tal:${t.id}`)} x={donde.x} y={donde.y} textAnchor="middle" fontSize="9" fontWeight="700"
                  fill={t.tipo === "invitado" ? "#0E9F9E" : "var(--plano-tinta)"}>
                  {trunc(`${t.nombre}${micTxt}`, donde.corta)}
                </text>
              );
            })}
          </g>
        );
      })}

      {/* Talentos (conductores/invitados, arrastrables) con sus micrófonos
          personales (solapa/dinámico) indicados bajo el nombre. Los sentados
          en un mueble se dibujan sobre él, no aquí. */}
      {talentos.filter((t) => !sentados.has(t.id)).map((t) => {
        const p = posDe(`tal:${t.id}`);
        const micsT = micsDeTal(t.id);
        const col = t.tipo === "invitado" ? "#0E9F9E" : "var(--plano-talento)";
        return (
          <g key={t.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(`tal:${t.id}`)} style={grab}>
            <title>{t.nombre}{micsT.length ? ` · ${micsT.map((m) => MIC_TIPO_CORTO[m.micTipo] || m.micTipo).join(" + ")}` : ""}</title>
            <circle r="17" fill="var(--plano-objeto)" stroke={col} strokeWidth="2.5" />
            <circle r="6" cy="-4" fill={col} />
            <path d="M-8 4 q8 9 16 0 l2 9 h-20 z" fill={col} />
            <circle cx="13" cy="-13" r="7" fill={col} stroke="#fff" strokeWidth="1.5" />
            <text x="13" y="-10" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{t.tipo === "invitado" ? "I" : "C"}</text>
            {micsT.length > 0 && (
              <g transform="translate(-14 9)">
                <circle r="6.5" fill="#1FA14E" stroke="#fff" strokeWidth="1.5" />
                <rect x="-1.6" y="-4" width="3.2" height="5" rx="1.6" fill="#fff" />
                <path d="M-3.2 -0.5 a3.2 3.2 0 0 0 6.4 0 M0 2.7 V4.4" stroke="#fff" strokeWidth="1" fill="none" />
              </g>
            )}
            {lab(`tal:${t.id}`) && <text {...labProps(`tal:${t.id}`)} y="32" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--plano-tinta)">{trunc(t.nombre, 20)}</text>}
            {lab(`tal:${t.id}`) && micsT.length > 0 && (
              <text y="43" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#1FA14E">
                {trunc(micsT.map((m) => MIC_TIPO_CORTO[m.micTipo] || m.micTipo).join(" + "), 26)}
              </text>
            )}
          </g>
        );
      })}

      {/* Booms del set (arrastrables y giratorios: apuntan a la mesa/foco) */}
      {booms.map((m) => {
        const key = `mic:${m.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const rot = typeof manual === "number" ? manual : (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI;
        return (
          <g key={m.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{m.nombre} · boom</title>
            <g transform={`rotate(${rot})`}>
              {showGuides && <path d="M8 0 L46 -12 L46 12 Z" fill="#1FA14E" opacity="0.10" />}
              <line x1="-14" y1="0" x2="26" y2="0" stroke="var(--plano-cuerpo)" strokeWidth="3" strokeLinecap="round" />
              <rect x="26" y="-4" width="14" height="8" rx="4" fill="#1FA14E" stroke="#fff" strokeWidth="1.2" />
              {editable && (
                <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                  <title>Arrastra para girar el boom · doble clic: apuntar a la mesa</title>
                  <circle cx="52" cy="0" r="6.5" fill={typeof manual === "number" ? "#1FA14E" : "var(--plano-objeto)"} stroke="#1FA14E" strokeWidth="2" />
                </g>
              )}
            </g>
            <circle cx="-14" cy="0" r="6" fill="var(--plano-cuerpo)" />
            {lab(`mic:${m.id}`) && <text {...labProps(`mic:${m.id}`)} y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1FA14E">{trunc(m.nombre, 18)} · boom</text>}
          </g>
        );
      })}

      {/* Micrófonos sin asignar (marcador suelto en el piso) */}
      {sueltos.map((m) => {
        const p = posDe(`mic:${m.id}`);
        return (
          <g key={m.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(`mic:${m.id}`)} style={grab}>
            <title>{m.nombre} · {MIC_TIPO_CORTO[m.micTipo] || "mic"}</title>
            <circle r="10" fill="var(--plano-objeto)" stroke="#1FA14E" strokeWidth="2" />
            <rect x="-2.5" y="-6" width="5" height="8" rx="2.5" fill="#1FA14E" />
            <path d="M-5 -1 a5 5 0 0 0 10 0 M0 4 V7" stroke="#1FA14E" strokeWidth="1.4" fill="none" />
            {lab(`mic:${m.id}`) && <text {...labProps(`mic:${m.id}`)} y="24" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1FA14E">{trunc(m.nombre, 16)} · {MIC_TIPO_CORTO[m.micTipo] || "mic"}</text>}
          </g>
        );
      })}

      {/* Cámaras (arrastrables). Sin ángulo manual, el lente sigue a la mesa;
          la manija al frente del cono fija la dirección a mano. */}
      {cams.map((c) => {
        const key = `cam:${c.id}`;
        const p = posDe(key);
        const manual = liveRot?.[key] ?? savedRot[key];
        const rot = typeof manual === "number" ? manual : (Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180) / Math.PI;
        const shots = shotgunDe(c.id);
        return (
          <g key={c.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={startDrag(key)} style={grab}>
            <title>{c.nombre}{c.plano ? ` · ${c.plano}` : ""}</title>
            <g transform={`rotate(${rot})`}>
              {showGuides && <path d="M14 0 L82 -26 L82 26 Z" fill={c.color} opacity="0.15" />}
              <rect x="-18" y="-11" width="30" height="22" rx="4" fill="var(--plano-camara)" />
              <rect x="12" y="-6" width="8" height="12" fill="var(--plano-camara-visor)" />
              <circle cx="-18" cy="0" r="5" fill="var(--plano-camara-lente)" stroke="var(--plano-camara-aro)" strokeWidth="1.5" />
              {shots.length > 0 && (
                <g>
                  <title>{shots.map((m) => m.nombre).join(" · ")} (shotgun montado)</title>
                  <rect x="4" y="-18" width="24" height="5" rx="2.5" fill="#1FA14E" stroke="#fff" strokeWidth="1" />
                </g>
              )}
              {editable && (
                <g className="no-print" onPointerDown={startRotate(key)} onDoubleClick={resetRotate(key)} style={{ cursor: "crosshair" }}>
                  <title>Arrastra para girar la cámara · doble clic: volver a apuntar a la mesa</title>
                  <line x1="20" y1="0" x2="84" y2="0" stroke={c.color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
                  <circle cx="93" cy="0" r="9" fill={typeof manual === "number" ? c.color : "var(--plano-objeto)"} stroke={c.color} strokeWidth="2.5" />
                  <text x="93" y="3.5" textAnchor="middle" fontSize="10" fontWeight="800"
                    fill={typeof manual === "number" ? textOn(c.color) : c.color} style={{ pointerEvents: "none" }}>⟳</text>
                </g>
              )}
            </g>
            <circle cx="0" cy="-27" r="10" fill={c.color} stroke="#fff" strokeWidth="2" />
            <text x="0" y="-23" textAnchor="middle" fontSize="11" fontWeight="800" fill={textOn(c.color)}>{c.num}</text>
            {lab(`cam:${c.id}`) && <g transform="translate(0 22)" {...labProps(`cam:${c.id}`)}>
              <rect x="-56" y="0" width="112" height="30" rx="6" fill="var(--plano-objeto)" stroke={c.color} strokeWidth="2" />
              <text x="0" y="13" textAnchor="middle" fontSize="11" fontWeight="800" fill={c.color}>{trunc(c.nombre, 14)}</text>
              <text x="0" y="25" textAnchor="middle" fontSize="9" fill="var(--plano-tinta)">{trunc(c.plano, 20)}</text>
            </g>}
          </g>
        );
      })}

      <text x="40" y={H - 32} fontSize="10" fill="var(--plano-tinta-baja)" style={{ letterSpacing: 1 }}>
        PLANO CENITAL · {ext ? "EXTERIOR" : "ESTUDIO"} · CADA CELDA ≈ 1 m
      </text>
    </svg>
  );
}

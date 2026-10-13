/**
 * GoF Pattern: Abstract Factory / Factory Method
 * Representación y renderizado vectorial estandarizado de entidades del set 2D.
 */

import React from "react";
import { textOn, trunc } from "./util.js";
import { GlyphLuz, GlyphMueble } from "./glifos.jsx";
import { MUEBLES_CATALOGO, MUEBLE_ASIENTOS, MIC_TIPO_CORTO } from "./catalogos.js";

/**
 * Entidad Base del Set
 */
export class SetEntity {
  constructor(id, type, key, pos, rot = 0) {
    this.id = id;
    this.type = type;
    this.key = key;
    this.pos = pos;
    this.rot = rot;
  }

  renderSVG(context) {
    throw new Error("renderSVG() debe ser implementado por la subclase");
  }
}

/**
 * Entidad de Cámara
 */
export class CameraEntity extends SetEntity {
  constructor(camera, pos, rot, shotgunMics = []) {
    super(camera.id, "camera", `cam:${camera.id}`, pos, rot);
    this.camera = camera;
    this.shotgunMics = shotgunMics;
  }

  renderSVG({ isSelected, showGuides, showLabels, isManualRot, onSelect, startDrag, startRotate, grab, editable, labProps, escalaAnotaciones = 1 }) {
    const { camera, pos, rot, key, shotgunMics } = this;
    const color = camera.color || "#0A84FF";

    return (
      <g
        key={key}
        transform={`translate(${pos.x} ${pos.y})`}
        onPointerDown={(e) => {
          if (onSelect) onSelect(key, "camera", camera);
          if (startDrag) startDrag(key)(e);
        }}
        style={grab}
        className="set-entity set-entity-camera"
      >
        <title>{camera.nombre}{camera.plano ? ` · ${camera.plano}` : ""}</title>

        {/* Cono de visión / Frustum y cuerpo rotado */}
        <g transform={`rotate(${rot})`}>
          {showGuides && (
            <path
              d="M14 0 L92 -32 L92 32 Z"
              fill={color}
              opacity={isSelected ? 0.25 : 0.14}
              stroke={isSelected ? color : "none"}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Cuerpo de cámara profesional (estilo broadcast) */}
          <rect x="-18" y="-11" width="30" height="22" rx="4" fill="var(--plano-camara, #1c2533)" stroke={isSelected ? "#0A84FF" : "var(--plano-camara-aro, #2c384e)"} strokeWidth={isSelected ? 2 : 1} />
          <rect x="12" y="-6" width="8" height="12" rx="1.5" fill="var(--plano-camara-visor, #384864)" />
          <circle cx="-18" cy="0" r="5" fill="var(--plano-camara-lente, #0c121b)" stroke={color} strokeWidth="1.8" />

          {/* Micrófono shotgun montado */}
          {shotgunMics.length > 0 && (
            <g>
              <title>{shotgunMics.map((m) => m.nombre).join(" · ")} (shotgun montado)</title>
              <rect x="2" y="-18" width="26" height="5" rx="2.5" fill="#30D158" stroke="#fff" strokeWidth="1" />
            </g>
          )}

          {/* Manija de rotación Apple Studio */}
          {editable && (
            <g
              className="no-print set-rotate-handle"
              onPointerDown={startRotate(key)}
              transform={`translate(20 0) scale(${escalaAnotaciones})`}
              style={{ cursor: "crosshair" }}
            >
              <title>Arrastra para girar la cámara</title>
              <line x1="0" y1="0" x2="68" y2="0" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.65" />
              <circle
                cx="78"
                cy="0"
                r="9.5"
                fill={isManualRot ? color : "var(--plano-objeto, #161f2d)"}
                stroke={color}
                strokeWidth="2.5"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.35))"
              />
              <text
                x="78"
                y="3.5"
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill={isManualRot ? textOn(color) : color}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                ⟳
              </text>
            </g>
          )}
        </g>

        {/* Tally badge numérico con contraste exacto */}
        <g transform={`translate(0 -27) scale(${escalaAnotaciones})`}>
          <circle r="10.5" fill={color} stroke="#fff" strokeWidth="2" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.4))" />
          <text y="4" textAnchor="middle" fontSize="11" fontWeight="800" fill={textOn(color)} style={{ pointerEvents: "none" }}>
            {camera.num}
          </text>
        </g>

        {/* Etiqueta identificadora */}
        {showLabels && (
          <g transform={`translate(0 22) scale(${escalaAnotaciones})`} {...(labProps ? labProps(key) : {})}>
            <rect x="-56" y="0" width="112" height="30" rx="6" fill="var(--plano-objeto, #161f2d)" stroke={color} strokeWidth="1.5" />
            <text x="0" y="13" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{trunc(camera.nombre, 14)}</text>
            <text x="0" y="25" textAnchor="middle" fontSize="9" fill="var(--plano-tinta, #d5deea)">{trunc(camera.plano, 20)}</text>
          </g>
        )}
      </g>
    );
  }
}

/**
 * Entidad de Luminaria
 */
export class LightEntity extends SetEntity {
  constructor(light, pos, rot) {
    super(light.id, "light", `luz:${light.id}`, pos, rot);
    this.light = light;
  }

  renderSVG({ isSelected, showGuides, showLabels, isManualRot, onSelect, startDrag, startRotate, resetRotate, grab, editable, labProps, escalaAnotaciones = 1 }) {
    const { light, pos, rot, key } = this;
    const color = light.color || "#FF9F0A";

    return (
      <g
        key={key}
        transform={`translate(${pos.x} ${pos.y})`}
        onPointerDown={(e) => {
          if (onSelect) onSelect(key, "light", light);
          if (startDrag) startDrag(key)(e);
        }}
        style={grab}
        className="set-entity set-entity-light"
      >
        <title>{light.nombre}</title>

        {rot !== null && (
          <g transform={`rotate(${rot})`}>
            {/* Cono de iluminación con atenuación volumétrica */}
            {showGuides && (
              <path
                d="M10 0 L72 -28 L72 28 Z"
                fill={color}
                opacity={isSelected ? 0.28 : 0.16}
                stroke={isSelected ? color : "none"}
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* Manija de giro */}
            {editable && (
              <g
                className="no-print set-rotate-handle"
                onPointerDown={startRotate(key)}
                onDoubleClick={resetRotate(key)}
                transform={`translate(16 0) scale(${escalaAnotaciones})`}
                style={{ cursor: "crosshair" }}
              >
                <title>Arrastra para girar la luz · doble clic: volver a automático</title>
                <line x1="0" y1="0" x2="52" y2="0" stroke={color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.65" />
                <circle
                  cx="60"
                  cy="0"
                  r="7.5"
                  fill={isManualRot ? color : "var(--plano-objeto, #161f2d)"}
                  stroke={color}
                  strokeWidth="2"
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.3))"
                />
              </g>
            )}
          </g>
        )}

        {/* Indicador de luz opcional / kicker */}
        {light.opcional && (
          <circle transform={`scale(${escalaAnotaciones})`} r="14" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.85" />
        )}

        {/* Glifo vectorial de la luminaria */}
        <GlyphLuz forma={light.forma} color={color} />

        {/* Badge abreviatura de función (Key, Fill, Back, etc.) */}
        <g transform={`translate(0 -18) scale(${escalaAnotaciones})`}>
          <rect x="-14" y="-11" width="28" height="12" rx="6" fill={color} filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))" />
          <text y="-2" textAnchor="middle" fontSize="8" fontWeight="800" fill={textOn(color)}>
            {light.abrev}
          </text>
        </g>

        {/* Etiqueta identificadora */}
        {showLabels && (
          <g transform={`translate(0 13) scale(${escalaAnotaciones})`}>
            <text
              {...(labProps ? labProps(key) : {})}
              y="14"
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="var(--plano-tinta, #d5deea)"
            >
              {trunc(light.nombre, 20)}
            </text>
          </g>
        )}
      </g>
    );
  }
}

/**
 * Entidad de Mobiliario (Mesa, Sillón, Podio, etc.)
 */
export class FurnitureEntity extends SetEntity {
  constructor(furniture, pos, rot, occupants = []) {
    super(furniture.id, "furniture", `mue:${furniture.id}`, pos, rot);
    this.furniture = furniture;
    this.occupants = occupants;
  }

  renderSVG({ isSelected, showLabels, isManualRot, onSelect, startDrag, startRotate, resetRotate, grab, editable, labProps, micsDeTal, textoPantalla = "", anchoPantalla = 500, escalaAnotaciones = 1 }) {
    const { furniture, pos, rot, key, occupants } = this;
    const def = MUEBLES_CATALOGO[furniture.tipo] || MUEBLES_CATALOGO.sillon1;
    const asientos = MUEBLE_ASIENTOS[furniture.tipo] || MUEBLE_ASIENTOS.sillon1;
    const esPantalla = furniture.tipo === "pantalla";
    const mitad = esPantalla ? anchoPantalla / 2 : def.mitad;

    return (
      <g
        key={key}
        transform={`translate(${pos.x} ${pos.y})`}
        onPointerDown={(e) => {
          if (onSelect) onSelect(key, "furniture", furniture);
          if (startDrag) startDrag(key)(e);
        }}
        style={grab}
        className="set-entity set-entity-furniture"
      >
        <title>{esPantalla ? `${def.es} · ${textoPantalla || "PANTALLA"}` : def.es}{occupants.length ? ` · ${occupants.map((t) => t.nombre).join(", ")}` : ""}</title>

        <g transform={`rotate(${rot})`}>
          <GlyphMueble tipo={furniture.tipo} anchoPantalla={anchoPantalla} />

          {/* Ocupantes sentados sobre el mueble */}
          {occupants.map((t, i) => {
            const a = asientos[i % asientos.length];
            const col = t.tipo === "invitado" ? "#30D158" : "#AF52DE";
            return (
              <g key={t.id} transform={`translate(${a.x} ${a.y})`}>
                <circle r="9.5" fill="var(--plano-objeto, #161f2d)" stroke={col} strokeWidth="2" />
                <circle r="3.4" cy="-1.5" fill={col} />
                <path d="M-4.5 2.5 q4.5 5 9 0 l1 4.5 h-11 z" fill={col} />
              </g>
            );
          })}

          {/* Manija de giro */}
          {editable && (
            <g
              className="no-print set-rotate-handle"
              onPointerDown={startRotate(key)}
              onDoubleClick={resetRotate(key)}
              transform={`translate(${mitad + 2} 0) scale(${escalaAnotaciones})`}
              style={{ cursor: "crosshair" }}
            >
              <title>Arrastra para girar el mueble · doble clic: orientación original</title>
              <line x1="0" y1="0" x2="10" y2="0" stroke="var(--plano-linea, #7d8ea3)" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7" />
              <circle
                cx="16"
                cy="0"
                r="6.5"
                fill={isManualRot ? "var(--plano-linea, #7d8ea3)" : "var(--plano-objeto, #161f2d)"}
                stroke="var(--plano-linea, #7d8ea3)"
                strokeWidth="2"
              />
            </g>
          )}
        </g>

        {/* Rótulo de tipo de mueble */}
        {showLabels && (
          <g transform={`translate(0 ${esPantalla ? 16 : 24}) scale(${escalaAnotaciones})`}>
            <text {...(labProps ? labProps(key) : {})} y="12" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--plano-linea, #7d8ea3)">
              {esPantalla ? `PANTALLA · ${trunc(textoPantalla || "PANTALLA", 42)}` : def.es.toUpperCase()}
            </text>
          </g>
        )}

        {/* Nombres de talentos sentados */}
        {occupants.map((t, i) => {
          const col = t.tipo === "invitado" ? "#30D158" : "#AF52DE";
          const micsT = micsDeTal ? micsDeTal(t.id) : [];
          const micTxt = micsT.length ? ` · ${micsT.map((x) => MIC_TIPO_CORTO[x.micTipo] || "mic").join(" + ")}` : "";
          return (
            <g key={t.id} transform={`translate(0 24) scale(${escalaAnotaciones})`}>
              <text
                {...(labProps ? labProps(`tal:${t.id}`) : {})}
                x="0"
                y={24 + i * 11}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill={col}
              >
                {trunc(`${t.nombre}${micTxt}`, 26)}
              </text>
            </g>
          );
        })}
      </g>
    );
  }
}

/**
 * Entidad de Talento (Conductor o Invitado libre en el piso)
 */
export class TalentEntity extends SetEntity {
  constructor(talent, pos, mics = []) {
    super(talent.id, "talent", `tal:${talent.id}`, pos, 0);
    this.talent = talent;
    this.mics = mics;
  }

  renderSVG({ isSelected, showLabels, onSelect, startDrag, grab, labProps, escalaAnotaciones = 1 }) {
    const { talent, pos, key, mics } = this;
    const col = talent.tipo === "invitado" ? "#30D158" : "#AF52DE";

    return (
      <g
        key={key}
        transform={`translate(${pos.x} ${pos.y})`}
        onPointerDown={(e) => {
          if (onSelect) onSelect(key, "talent", talent);
          if (startDrag) startDrag(key)(e);
        }}
        style={grab}
        className="set-entity set-entity-talent"
      >
        <title>{talent.nombre}{mics.length ? ` · ${mics.map((m) => MIC_TIPO_CORTO[m.micTipo] || m.micTipo).join(" + ")}` : ""}</title>
        <circle r="17" fill="var(--plano-objeto, #161f2d)" stroke={col} strokeWidth="2.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
        <circle r="6" cy="-4" fill={col} />
        <path d="M-8 4 q8 9 16 0 l2 9 h-20 z" fill={col} />

        {/* Badge C (Conductor) o I (Invitado) */}
        <g transform={`translate(13 -13) scale(${escalaAnotaciones})`}>
          <circle r="7" fill={col} stroke="#fff" strokeWidth="1.5" />
          <text y="3" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">
            {talent.tipo === "invitado" ? "I" : "C"}
          </text>
        </g>

        {/* Indicador de micrófono asignado */}
        {mics.length > 0 && (
          <g transform={`translate(-14 9) scale(${escalaAnotaciones})`}>
            <circle r="6.5" fill="#30D158" stroke="#fff" strokeWidth="1.5" />
            <rect x="-1.6" y="-4" width="3.2" height="5" rx="1.6" fill="#fff" />
            <path d="M-3.2 -0.5 a3.2 3.2 0 0 0 6.4 0 M0 2.7 V4.4" stroke="#fff" strokeWidth="1" fill="none" />
          </g>
        )}

        {showLabels && (
          <g transform={`translate(0 17) scale(${escalaAnotaciones})`}>
            <text {...(labProps ? labProps(key) : {})} y="15" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--plano-tinta, #d5deea)">
              {trunc(talent.nombre, 20)}
            </text>
            {mics.length > 0 && (
              <text y="26" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#30D158">
                {trunc(mics.map((m) => MIC_TIPO_CORTO[m.micTipo] || m.micTipo).join(" + "), 26)}
              </text>
            )}
          </g>
        )}
      </g>
    );
  }
}

/**
 * Entidad de Micrófono (Boom o Suelto en piso)
 */
export class MicrophoneEntity extends SetEntity {
  constructor(mic, pos, rot = 0) {
    super(mic.id, "mic", `mic:${mic.id}`, pos, rot);
    this.mic = mic;
    this.isBoom = mic.micTipo === "boom";
  }

  renderSVG({ isSelected, showGuides, showLabels, isManualRot, onSelect, startDrag, startRotate, resetRotate, grab, editable, labProps, escalaAnotaciones = 1 }) {
    const { mic, pos, rot, key, isBoom } = this;
    const col = "#30D158";

    if (isBoom) {
      return (
        <g
          key={key}
          transform={`translate(${pos.x} ${pos.y})`}
          onPointerDown={(e) => {
            if (onSelect) onSelect(key, "mic", mic);
            if (startDrag) startDrag(key)(e);
          }}
          style={grab}
          className="set-entity set-entity-boom"
        >
          <title>{mic.nombre} · boom</title>
          <g transform={`rotate(${rot})`}>
            {showGuides && <path d="M8 0 L52 -14 L52 14 Z" fill={col} opacity="0.12" />}
            <line x1="-14" y1="0" x2="28" y2="0" stroke="var(--plano-cuerpo, #607289)" strokeWidth="3" strokeLinecap="round" />
            <rect x="28" y="-4" width="14" height="8" rx="4" fill={col} stroke="#fff" strokeWidth="1.2" />

            {editable && (
              <g
                className="no-print set-rotate-handle"
                onPointerDown={startRotate(key)}
                onDoubleClick={resetRotate(key)}
                transform={`translate(42 0) scale(${escalaAnotaciones})`}
                style={{ cursor: "crosshair" }}
              >
                <title>Arrastra para girar el boom · doble clic: apuntar a la mesa</title>
                <circle
                  cx="14"
                  cy="0"
                  r="6.5"
                  fill={isManualRot ? col : "var(--plano-objeto, #161f2d)"}
                  stroke={col}
                  strokeWidth="2"
                />
              </g>
            )}
          </g>
          <circle cx="-14" cy="0" r="6" fill="var(--plano-cuerpo, #607289)" />
          {showLabels && (
            <g transform={`translate(0 14) scale(${escalaAnotaciones})`}>
              <text {...(labProps ? labProps(key) : {})} y="12" textAnchor="middle" fontSize="9" fontWeight="700" fill={col}>
                {trunc(mic.nombre, 18)} · boom
              </text>
            </g>
          )}
        </g>
      );
    }

    // Micrófono suelto en piso
    return (
      <g
        key={key}
        transform={`translate(${pos.x} ${pos.y})`}
        onPointerDown={(e) => {
          if (onSelect) onSelect(key, "mic", mic);
          if (startDrag) startDrag(key)(e);
        }}
        style={grab}
        className="set-entity set-entity-mic"
      >
        <title>{mic.nombre} · {MIC_TIPO_CORTO[mic.micTipo] || "mic"}</title>
        <circle r="10" fill="var(--plano-objeto, #161f2d)" stroke={col} strokeWidth="2" />
        <rect x="-2.5" y="-6" width="5" height="8" rx="2.5" fill={col} />
        <path d="M-5 -1 a5 5 0 0 0 10 0 M0 4 V7" stroke={col} strokeWidth="1.4" fill="none" />
        {showLabels && (
          <g transform={`translate(0 12) scale(${escalaAnotaciones})`}>
            <text {...(labProps ? labProps(key) : {})} y="12" textAnchor="middle" fontSize="9" fontWeight="700" fill={col}>
              {trunc(mic.nombre, 16)} · {MIC_TIPO_CORTO[mic.micTipo] || "mic"}
            </text>
          </g>
        )}
      </g>
    );
  }
}

/**
 * Entidad de Blanco de Foco (Punto de Foco Central o Mesa Fija)
 */
export class FocusTargetEntity extends SetEntity {
  constructor(pos, hasMesa, mesaText = "", isCovered = false) {
    super("mesa", "focus", "mesa", pos, 0);
    this.hasMesa = hasMesa;
    this.mesaText = mesaText;
    this.isCovered = isCovered;
  }

  renderSVG({ isSelected, onSelect, startDrag, grab, escalaAnotaciones = 1 }) {
    const { pos, hasMesa, mesaText, isCovered, key } = this;

    if (hasMesa) {
      return (
        <g
          key={key}
          transform={`translate(${pos.x} ${pos.y})`}
          onPointerDown={(e) => {
            if (onSelect) onSelect(key, "focus", null);
            if (startDrag) startDrag(key)(e);
          }}
          style={grab}
          className="set-entity set-entity-focus"
        >
          <rect
            x="-110"
            y="-34"
            width="220"
            height="68"
            rx="14"
            fill="var(--plano-objeto, #161f2d)"
            stroke={isSelected ? "#0A84FF" : "var(--plano-objeto-borde, #30415a)"}
            strokeWidth="2.5"
            filter="drop-shadow(0 4px 10px rgba(0,0,0,0.35))"
          />
          <rect x="-88" y="-12" width="176" height="24" rx="5" fill="var(--plano-barra, #1e2c3f)" />
          <g transform={`scale(${escalaAnotaciones})`}>
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" style={{ letterSpacing: 1 }}>
              {trunc(mesaText, 24)}
            </text>
          </g>
        </g>
      );
    }

    return (
      <g
        key={key}
        transform={`translate(${pos.x} ${pos.y})`}
        onPointerDown={(e) => {
          if (onSelect) onSelect(key, "focus", null);
          if (startDrag) startDrag(key)(e);
        }}
        style={grab}
        className="set-entity set-entity-focus"
      >
        <g transform={`scale(${escalaAnotaciones})`}>
          <title>Punto de foco: cámaras y luces apuntan aquí</title>
          <circle r="16" fill="none" stroke="var(--plano-tinta-baja, #8192a8)" strokeWidth="1.6" strokeDasharray="4 3" />
          <path d="M-23 0 H23 M0 -23 V23" stroke="var(--plano-tinta-baja, #8192a8)" strokeWidth="1.4" />
          <circle r="3.5" fill={isSelected ? "#0A84FF" : "var(--plano-tinta-baja, #8192a8)"} />
          {!isCovered && (
            <text y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--plano-tinta-baja, #8192a8)" style={{ letterSpacing: 1 }}>
              PUNTO DE FOCO
            </text>
          )}
        </g>
      </g>
    );
  }
}

/**
 * Fábrica Abstracta de Entidades del Set
 */
export class SetEntityFactory {
  static createCamera(camera, pos, rot, shotgunMics = []) {
    return new CameraEntity(camera, pos, rot, shotgunMics);
  }

  static createLight(light, pos, rot) {
    return new LightEntity(light, pos, rot);
  }

  static createFurniture(furniture, pos, rot, occupants = []) {
    return new FurnitureEntity(furniture, pos, rot, occupants);
  }

  static createTalent(talent, pos, mics = []) {
    return new TalentEntity(talent, pos, mics);
  }

  static createMicrophone(mic, pos, rot = 0) {
    return new MicrophoneEntity(mic, pos, rot);
  }

  static createFocusTarget(pos, hasMesa, mesaText = "", isCovered = false) {
    return new FocusTargetEntity(pos, hasMesa, mesaText, isCovered);
  }
}

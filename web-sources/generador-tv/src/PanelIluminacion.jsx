import React, { useState } from "react";
import {
  LUZ_CATALOGO, LUZ_GRUPOS, SETUPS_ILUMINACION, SETUPS_EXTERIOR, RECOMENDADAS_POR_PLANTILLA, DIFICULTAD_ES,
  getSetup, instanciarElemento, instanciarSetup,
} from "./iluminacion.js";
import { LuzIcon } from "./glifos.jsx";
import { upSetPor } from "./sets.js";
import { textOn } from "./util.js";

/**
 * PanelIluminacion:
 * Inspector de iluminación profesional estilo macOS Studio.
 * Cero emojis, controles segmentados translúcidos y gestión limpia de esquemas.
 */
export function PanelIluminacion({ cfg, set, setCfg }) {
  const editable = typeof setCfg === "function";
  const aplicada = set.iluminacion?.setup || null;
  const luces = set.iluminacion?.luces || [];
  const ext = set.locacion === "ext";
  const exteriores = ext ? SETUPS_EXTERIOR.filter((id) => getSetup(id)) : [];
  const recomendadas = (RECOMENDADAS_POR_PLANTILLA[cfg.plantilla] || []).filter((id) => getSetup(id));
  const [selId, setSelId] = useState(aplicada || exteriores[0] || recomendadas[0] || SETUPS_ILUMINACION[0].id);
  const [poolSel, setPoolSel] = useState(LUZ_GRUPOS[0].tipos[0]);
  const [confirma, setConfirma] = useState(null); // 'aplicar' | 'quitar'
  const setup = getSetup(selId) || SETUPS_ILUMINACION[0];
  const setupAplicado = getSetup(aplicada);
  const mesaPos = set.setLayout?.pos?.mesa || { x: 490, y: 240 };

  const chipStyle = (borde) => ({
    borderColor: borde || "rgba(255, 255, 255, 0.12)",
    color: "var(--tinta, #d5deea)",
    background: "rgba(255, 255, 255, 0.05)",
  });

  if (!editable) {
    return luces.length ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {setupAplicado && <span className="text-xs font-bold text-white/90">{setupAplicado.name_es} ·</span>}
        {luces.map((l) => (
          <span key={l.id} className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-bold" style={chipStyle(l.color)}>
            <LuzIcon forma={l.forma} color={l.color} /> {l.nombre}
          </span>
        ))}
      </div>
    ) : <p className="text-xs text-white/50 m-0">Sin iluminación configurada.</p>;
  }

  const aplicar = () => {
    setConfirma(null);
    const { luces: nuevas, pos } = instanciarSetup(setup, mesaPos);
    setCfg((c) => upSetPor(c, set.id, (s) => {
      const p = { ...(s.setLayout?.pos || {}) };
      const r = { ...(s.setLayout?.rot || {}) };
      (s.iluminacion?.luces || []).forEach((l) => { delete p[`luz:${l.id}`]; delete r[`luz:${l.id}`]; });
      Object.assign(p, pos);
      return { ...s, iluminacion: { setup: setup.id, luces: nuevas }, setLayout: { ...(s.setLayout || {}), pos: p, rot: r } };
    }), { commit: true });
  };

  const quitarTodo = () => {
    setConfirma(null);
    setCfg((c) => upSetPor(c, set.id, (s) => {
      const p = { ...(s.setLayout?.pos || {}) };
      const r = { ...(s.setLayout?.rot || {}) };
      (s.iluminacion?.luces || []).forEach((l) => { delete p[`luz:${l.id}`]; delete r[`luz:${l.id}`]; });
      return { ...s, iluminacion: null, setLayout: { ...(s.setLayout || {}), pos: p, rot: r } };
    }), { commit: true });
  };

  const quitarLuz = (id) => setCfg((c) => upSetPor(c, set.id, (s) => {
    const p = { ...(s.setLayout?.pos || {}) };
    const r = { ...(s.setLayout?.rot || {}) };
    delete p[`luz:${id}`]; delete r[`luz:${id}`];
    const restantes = (s.iluminacion?.luces || []).filter((l) => l.id !== id);
    return {
      ...s,
      iluminacion: restantes.length ? { ...(s.iluminacion || {}), luces: restantes } : null,
      setLayout: { ...(s.setLayout || {}), pos: p, rot: r },
    };
  }), { commit: true });

  const agregarTipo = (tipo, opcional = true) => {
    const { luces: nuevas, pos } = instanciarElemento(tipo, mesaPos, { opcional });
    setCfg((c) => upSetPor(c, set.id, (s) => ({
      ...s,
      iluminacion: { ...(s.iluminacion || { setup: null }), luces: [...(s.iluminacion?.luces || []), ...nuevas] },
      setLayout: { ...(s.setLayout || {}), pos: { ...(s.setLayout?.pos || {}), ...pos } },
    })), { commit: true });
  };

  const toggleOpcional = (tipo) => {
    const activas = luces.filter((l) => l.tipo === tipo && l.opcional);
    if (activas.length) {
      setCfg((c) => upSetPor(c, set.id, (s) => {
        const p = { ...(s.setLayout?.pos || {}) };
        const r = { ...(s.setLayout?.rot || {}) };
        const restantes = (s.iluminacion?.luces || []).filter((l) => {
          const fuera = l.tipo === tipo && l.opcional;
          if (fuera) { delete p[`luz:${l.id}`]; delete r[`luz:${l.id}`]; }
          return !fuera;
        });
        return { ...s, iluminacion: { ...(s.iluminacion || {}), luces: restantes }, setLayout: { ...(s.setLayout || {}), pos: p, rot: r } };
      }), { commit: true });
    } else {
      agregarTipo(tipo, true);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Selector de esquema de iluminación */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Esquema de iluminación</label>
        <select
          value={selId}
          onChange={(e) => { setSelId(e.target.value); setConfirma(null); }}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90 focus:border-blue-500 focus:outline-none"
        >
          {exteriores.length > 0 && (
            <optgroup label="Locación exterior">
              {exteriores.map((id) => <option key={`ext-${id}`} value={id}>{getSetup(id).name_es}</option>)}
            </optgroup>
          )}
          {recomendadas.length > 0 && (
            <optgroup label="Recomendadas para el proyecto">
              {recomendadas.map((id) => <option key={`rec-${id}`} value={id}>{getSetup(id).name_es}</option>)}
            </optgroup>
          )}
          <optgroup label={recomendadas.length || exteriores.length ? "Todas las configuraciones" : "Configuraciones"}>
            {SETUPS_ILUMINACION.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
          </optgroup>
        </select>
      </div>

      {/* Tarjeta de previsualización del esquema */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-2 shadow-sm">
        <p className="text-[11px] text-white/70 m-0 leading-relaxed">{setup.description}</p>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Incluye:</span>
          {(setup.required_elements || []).map((tipo) => {
            const def = LUZ_CATALOGO[tipo];
            return def ? (
              <span key={tipo} className="flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/85" style={{ borderColor: def.color }}>
                <LuzIcon forma={def.forma} color={def.color} size={12} /> {def.es}{(def.count || 1) > 1 ? " ×2" : ""}
              </span>
            ) : null;
          })}
        </div>

        <button
          onClick={() => (luces.length ? setConfirma("aplicar") : aplicar())}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 transition-colors shadow-md mt-1"
        >
          {aplicada === setup.id && luces.length ? "Reaplicar esquema" : "Aplicar al set"}
        </button>

        {confirma === "aplicar" && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-amber-200">
            <span className="text-[11px] font-semibold">
              Se reemplazarán las {luces.length} luces actuales por las de “{setup.name_es}”.
            </span>
            <div className="flex gap-1.5">
              <button onClick={aplicar} className="flex-1 rounded-md bg-amber-500 text-black font-bold py-1 text-xs hover:bg-amber-400">
                Confirmar
              </button>
              <button onClick={() => setConfirma(null)} className="rounded-md border border-white/15 px-3 py-1 text-xs text-white/80 hover:bg-white/10">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Luces activas en el set */}
      {luces.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
              Luminarias en plano ({luces.length})
            </span>
            <button
              onClick={() => setConfirma("quitar")}
              className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              Quitar todas
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {luces.map((l) => (
              <span key={l.id} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/90" style={{ borderColor: l.color }}>
                <LuzIcon forma={l.forma} color={l.color} size={13} />
                <span>{l.nombre}</span>
                <button
                  onClick={() => quitarLuz(l.id)}
                  className="ml-1 text-white/40 hover:text-red-400 font-bold transition-colors"
                  title="Quitar luz"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          {confirma === "quitar" && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-red-200 mt-1">
              <span className="text-[11px] font-semibold">¿Eliminar todas las luces de este set?</span>
              <div className="flex gap-1.5">
                <button onClick={quitarTodo} className="flex-1 rounded-md bg-red-500 text-white font-bold py-1 text-xs hover:bg-red-400">
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirma(null)} className="rounded-md border border-white/15 px-3 py-1 text-xs text-white/80 hover:bg-white/10">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Opcionales del esquema activo */}
      {setupAplicado && (setupAplicado.optional_elements || []).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Luminarias adicionales</span>
          <div className="flex flex-wrap gap-1">
            {setupAplicado.optional_elements.map((tipo) => {
              const def = LUZ_CATALOGO[tipo];
              if (!def) return null;
              const activa = luces.some((l) => l.tipo === tipo && l.opcional);
              return (
                <button
                  key={tipo}
                  onClick={() => toggleOpcional(tipo)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                    activa
                      ? "bg-white/20 border-white text-white shadow-sm"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  style={activa ? { borderColor: def.color } : {}}
                >
                  <LuzIcon forma={def.forma} color={activa ? def.color : "rgba(255,255,255,0.6)"} size={12} />
                  <span>{activa ? "✓ " : "+ "}{def.es}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Agregar cualquier luminaria del catálogo */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
        <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Añadir luz personalizada</label>
        <div className="flex items-center gap-1.5">
          <select
            value={poolSel}
            onChange={(e) => setPoolSel(e.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90 focus:border-blue-500 focus:outline-none"
          >
            {LUZ_GRUPOS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.tipos.map((t) => LUZ_CATALOGO[t] && (
                  <option key={t} value={t}>{LUZ_CATALOGO[t].es}{(LUZ_CATALOGO[t].count || 1) > 1 ? " (×2)" : ""}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={() => agregarTipo(poolSel, true)}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
          >
            + Añadir
          </button>
        </div>
      </div>
    </div>
  );
}

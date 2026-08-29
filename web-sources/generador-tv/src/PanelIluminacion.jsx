import React, { useState } from "react";
import {
  LUZ_CATALOGO, LUZ_GRUPOS, SETUPS_ILUMINACION, SETUPS_EXTERIOR, RECOMENDADAS_POR_PLANTILLA, DIFICULTAD_ES,
  getSetup, instanciarElemento, instanciarSetup,
} from "./iluminacion.js";
import { LuzIcon } from "./glifos.jsx";
import { SecTitle } from "./ui.jsx";
import { upSetPor } from "./sets.js";
import {} from "./theme.js";
import { textOn } from "./util.js";

// Panel de iluminación: elegir una configuración del catálogo, aplicarla al
// plano (coloca las luces requeridas en posiciones típicas) y agregar o quitar
// elementos opcionales. Las acciones destructivas piden confirmación en dos
// pasos (no hay window.confirm en el WebView de Wails).
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

  const chipStyle = (borde) => ({ borderColor: borde, color: "var(--tinta)", background: "var(--vidrio-a)" });

  if (!editable) {
    return luces.length ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {setupAplicado && <span className="text-xs font-bold" style={{ color: "var(--tinta)" }}>{setupAplicado.name_es} ·</span>}
        {luces.map((l) => (
          <span key={l.id} className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-bold" style={chipStyle(l.color)}>
            <LuzIcon forma={l.forma} color={l.color} /> {l.nombre}
          </span>
        ))}
      </div>
    ) : <p className="text-xs" style={{ color: "var(--tinta-media)", margin: 0 }}>Sin iluminación configurada.</p>;
  }

  // La confirmación de reemplazo/borrado vive en la UI (franjas con botones);
  // estas acciones ya ejecutan directo.
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

  const btn = (activo) => ({
    background: activo ? "var(--gel-f)" : "var(--vidrio-a)", borderColor: activo ? "var(--gel-f)" : "var(--vidrio-borde)", color: activo ? "#fff" : "var(--tinta)",
  });

  return (
    <div className="flex flex-col gap-2.5">
      <SecTitle>Configuración base</SecTitle>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selId}
          onChange={(e) => { setSelId(e.target.value); setConfirma(null); }}
          className="rounded-lg border text-xs font-bold"
          style={{ borderColor: "var(--vidrio-borde)", color: "var(--tinta)", background: "var(--vidrio-a)", padding: "6px 8px", maxWidth: 320 }}>
          {exteriores.length > 0 && (
            <optgroup label="☀ Para locación exterior">
              {exteriores.map((id) => <option key={`ext-${id}`} value={id}>{getSetup(id).name_es}</option>)}
            </optgroup>
          )}
          {recomendadas.length > 0 && (
            <optgroup label="★ Recomendadas para tu producción">
              {recomendadas.map((id) => <option key={`rec-${id}`} value={id}>{getSetup(id).name_es}</option>)}
            </optgroup>
          )}
          <optgroup label={recomendadas.length || exteriores.length ? "Todas las configuraciones" : "Configuraciones"}>
            {SETUPS_ILUMINACION.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
          </optgroup>
        </select>
        <span className="rounded-lg border px-2 py-0.5 text-xs font-bold" style={chipStyle("var(--vidrio-borde)")}>
          Dificultad: {DIFICULTAD_ES[setup.difficulty] || setup.difficulty}
        </span>
        {exteriores.includes(setup.id) && (
          <span className="rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: "color-mix(in srgb, var(--e2) 16%, transparent)", color: "var(--e2-t)" }}>☀ Exterior</span>
        )}
        {recomendadas.includes(setup.id) && (
          <span className="rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: "color-mix(in srgb, var(--e3) 16%, transparent)", color: "var(--e3-t)" }}>★ Recomendada</span>
        )}
      </div>

      {/* Tarjeta de vista previa: qué coloca la configuración ANTES de aplicarla */}
      <div className="rounded-lg border p-2.5 flex flex-col gap-2" style={{ borderColor: "var(--linea)", background: "var(--vidrio-b)" }}>
        <p className="text-xs" style={{ color: "var(--tinta-media)", margin: 0 }}>{setup.description}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold" style={{ color: "var(--tinta)" }}>Coloca en el plano:</span>
          {(setup.required_elements || []).map((tipo) => {
            const def = LUZ_CATALOGO[tipo];
            return def ? (
              <span key={tipo} className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-bold" style={chipStyle(def.color)}>
                <LuzIcon forma={def.forma} color={def.color} /> {def.es}{(def.count || 1) > 1 ? " ×2" : ""}
              </span>
            ) : null;
          })}
        </div>
        {(setup.optional_elements || []).length > 0 && (
          <div className="text-xs" style={{ color: "var(--tinta-media)" }}>
            Opcionales (se agregan después de aplicar): {setup.optional_elements.map((t) => LUZ_CATALOGO[t]?.es).filter(Boolean).join(" · ")}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {(setup.mood || []).map((m) => (
            <span key={m} className="rounded px-1.5 py-0.5" style={{ background: "var(--vidrio-b)", color: "var(--tinta-media)", fontSize: 10, fontWeight: 700 }}>
              {m.replace(/_/g, " ")}
            </span>
          ))}
        </div>
        <div>
          <button onClick={() => (luces.length ? setConfirma("aplicar") : aplicar())}
            className="rounded-lg border px-3 py-1.5 text-xs font-bold" style={btn(true)}>
            {aplicada === setup.id && luces.length ? "↺ Volver a aplicar esta configuración" : "Aplicar esta configuración"}
          </button>
        </div>
        {confirma === "aplicar" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "color-mix(in srgb, var(--e3) 16%, transparent)" }}>
            <span className="text-xs font-bold" style={{ color: "var(--e3-t)" }}>
              Se quitarán las {luces.length} luces actuales y se colocarán las de “{setup.name_es}”.
            </span>
            <button onClick={aplicar} className="rounded-lg px-2.5 py-1 text-xs font-bold"
              style={{ background: "var(--e3-t)", color: "#fff", border: "none" }}>Sí, reemplazar</button>
            <button onClick={() => setConfirma(null)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={btn(false)}>Cancelar</button>
          </div>
        )}
      </div>

      {luces.length > 0 && (
        <>
          <SecTitle>Luces en el plano ({luces.length}){setupAplicado ? ` · ${setupAplicado.name_es}` : ""}</SecTitle>
          <p className="text-xs" style={{ color: "var(--tinta-media)", margin: 0 }}>
            Arrástralas en el plano de arriba y gíralas con su manija; la ✕ quita esa luz.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {luces.map((l) => (
              <span key={l.id} className="flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs font-bold" style={chipStyle(l.color)}>
                <LuzIcon forma={l.forma} color={l.color} /> {l.nombre}{l.opcional ? " · opc." : ""}
                <button onClick={() => quitarLuz(l.id)} title="Quitar esta luz del plano"
                  style={{ border: "none", background: "none", color: "var(--e5-t)", cursor: "pointer", padding: "0 1px 0 3px", fontWeight: 800, fontSize: 13, lineHeight: 1 }}>✕</button>
              </span>
            ))}
          </div>
        </>
      )}

      {setupAplicado && (setupAplicado.optional_elements || []).length > 0 && (
        <>
          <SecTitle>Opcionales de {setupAplicado.name_es}</SecTitle>
          <p className="text-xs" style={{ color: "var(--tinta-media)", margin: 0 }}>Un clic los pone en el plano, otro clic los quita.</p>
          <div className="flex flex-wrap gap-1.5">
            {setupAplicado.optional_elements.map((tipo) => {
              const def = LUZ_CATALOGO[tipo];
              if (!def) return null;
              const activa = luces.some((l) => l.tipo === tipo && l.opcional);
              return (
                <button key={tipo} onClick={() => toggleOpcional(tipo)}
                  className="flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold"
                  style={activa ? { background: def.color, borderColor: def.color, color: textOn(def.color) } : chipStyle("var(--vidrio-borde)")}>
                  <LuzIcon forma={def.forma} color={activa ? textOn(def.color) : def.color} /> {activa ? "✓" : "+"} {def.es}
                </button>
              );
            })}
          </div>
        </>
      )}

      <SecTitle>Catálogo completo</SecTitle>
      <p className="text-xs" style={{ color: "var(--tinta-media)", margin: 0 }}>
        ¿Necesitas algo que el setup no trae? Agrega cualquier elemento suelto al plano.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {LUZ_CATALOGO[poolSel] && <LuzIcon forma={LUZ_CATALOGO[poolSel].forma} color={LUZ_CATALOGO[poolSel].color} size={18} />}
        <select value={poolSel} onChange={(e) => setPoolSel(e.target.value)}
          className="rounded-lg border text-xs font-bold"
          style={{ borderColor: "var(--vidrio-borde)", color: "var(--tinta)", background: "var(--vidrio-a)", padding: "6px 8px", maxWidth: 280 }}>
          {LUZ_GRUPOS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.tipos.map((t) => LUZ_CATALOGO[t] && (
                <option key={t} value={t}>{LUZ_CATALOGO[t].es}{(LUZ_CATALOGO[t].count || 1) > 1 ? " (×2)" : ""}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button onClick={() => agregarTipo(poolSel, true)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={btn(true)}>
          + Agregar al plano
        </button>
      </div>

      {luces.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div>
            <button onClick={() => setConfirma("quitar")} className="rounded-lg border px-2.5 py-1 text-xs font-bold"
              style={{ borderColor: "var(--vidrio-borde)", color: "var(--tinta-media)", background: "var(--vidrio-a)" }}>
              Quitar toda la iluminación
            </button>
          </div>
          {confirma === "quitar" && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "color-mix(in srgb, var(--e5) 14%, transparent)" }}>
              <span className="text-xs font-bold" style={{ color: "var(--e5-t)" }}>Se quitarán las {luces.length} luces del plano de este set.</span>
              <button onClick={quitarTodo} className="rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ background: "var(--e5-t)", color: "#fff", border: "none" }}>Sí, quitar todo</button>
              <button onClick={() => setConfirma(null)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={btn(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

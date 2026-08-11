import React, { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { MUEBLES_CATALOGO } from "./catalogos.js";
import { computeFuentes } from "./escaleta.js";
import { MuebleIcon } from "./glifos.jsx";
import { EstudioCenital } from "./EstudioCenital.jsx";
import { PanelIluminacion } from "./PanelIluminacion.jsx";
import { PersonalGrid } from "./PersonalGrid.jsx";
import { posMuebleDefault, reacomodoDe, setActivoDe, setNuevo, upSetPor } from "./sets.js";
import { NAVY } from "./theme.js";
import { Box, SecTitle, TarjetaAyuda } from "./ui.jsx";
import { trunc, uid } from "./util.js";

// Estado inicial de las ayudas visuales del lienzo (etiquetas y cuadrícula).
const SET_CANVAS_DEFAULTS = {
  showLabels: false,
  showGuides: false,
};

// Pestaña "Set": ¿qué hay en el espacio físico y quién lo opera?
// Solo el plano cenital interactivo y el personal de operación.
export function VistaSet({ cfg, setCfg }) {
  const fuentes = useMemo(() => computeFuentes(cfg), [cfg]);
  const cams = fuentes.filter((f) => f.tipo === "cam");
  const editable = typeof setCfg === "function";
  const sets = cfg.sets || [];
  const activo = setActivoDe(cfg);
  const [confirmaDel, setConfirmaDel] = useState(false);
  const [showLabels, setShowLabels] = useState(SET_CANVAS_DEFAULTS.showLabels);
  const [showGuides, setShowGuides] = useState(SET_CANVAS_DEFAULTS.showGuides);
  const tieneCustom = Object.keys(activo.setLayout?.pos || {}).length > 0 || Object.keys(activo.setLayout?.rot || {}).length > 0;
  const etiquetasOcultas = Object.keys(activo.setLayout?.labelsOff || {}).length;

  const agregarMueble = (tipo) => setCfg((c) => upSetPor(c, activo.id, (s) => {
    const id = uid();
    const n = (s.muebles || []).length;
    return {
      ...s,
      muebles: [...(s.muebles || []), { id, tipo, ocupantes: [] }],
      setLayout: { ...(s.setLayout || {}), pos: { ...(s.setLayout?.pos || {}), [`mue:${id}`]: posMuebleDefault(n) } },
    };
  }), { commit: true });

  const quitarMueble = (id) => setCfg((c) => upSetPor(c, activo.id, (s) => {
    const pos = { ...(s.setLayout?.pos || {}) };
    const rot = { ...(s.setLayout?.rot || {}) };
    delete pos[`mue:${id}`]; delete rot[`mue:${id}`];
    return { ...s, muebles: (s.muebles || []).filter((m) => m.id !== id), setLayout: { ...(s.setLayout || {}), pos, rot } };
  }), { commit: true });

  // Sentar/levantar un talento. Un talento solo ocupa un mueble a la vez.
  const toggleAsiento = (muebleId, talId) => {
    const mueble = (activo.muebles || []).find((m) => m.id === muebleId);
    if (!mueble) return;
    const dentro = (mueble.ocupantes || []).includes(talId);
    const cap = MUEBLES_CATALOGO[mueble.tipo]?.cap || 1;
    if (!dentro && (mueble.ocupantes || []).length >= cap) return; // lleno
    setCfg((c) => upSetPor(c, activo.id, (s) => ({
      ...s,
      muebles: (s.muebles || []).map((m) => {
        if (m.id === muebleId) {
          return dentro
            ? { ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== talId) }
            : { ...m, ocupantes: [...(m.ocupantes || []), talId] };
        }
        // Al sentarse aquí, se levanta de cualquier otro mueble.
        return dentro ? m : { ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== talId) };
      }),
    })), { commit: true });
  };

  const elegirSet = (id) => { setConfirmaDel(false); setCfg((c) => ({ ...c, setActivo: id }), { commit: true }); };
  const agregarSet = () => setCfg((c) => {
    const nuevo = setNuevo((c.sets || []).length + 1);
    return { ...c, sets: [...(c.sets || []), nuevo], setActivo: nuevo.id };
  }, { commit: true });
  const upActivo = (patch, opts) => setCfg((c) => upSetPor(c, activo.id, (s) => ({ ...s, ...patch })), opts);
  const eliminarSet = () => {
    if (!confirmaDel) { setConfirmaDel(true); return; }
    setConfirmaDel(false);
    setCfg((c) => {
      const rest = (c.sets || []).filter((s) => s.id !== activo.id);
      return rest.length ? { ...c, sets: rest, setActivo: rest[0].id } : c;
    }, { commit: true });
  };
  const chip = { borderColor: "#C8D2DE", color: "#33445F", background: "#fff" };

  return (
    <div className="scrollwrap overflow-auto px-2 py-4">
      <div className="vista-foco mx-auto flex flex-col gap-3 bg-white shadow-lg" style={{ width: 1240, maxWidth: "100%", padding: 16, borderRadius: 8 }}>
        <Box title={`Set / Estudio — planta física${sets.length > 1 ? ` (${sets.length} sets)` : ""}`}>
          {editable && (
            <div className="no-print flex flex-wrap items-center gap-1.5" style={{ marginBottom: 8 }}>
              {sets.map((s) => (
                <button key={s.id} onClick={() => elegirSet(s.id)}
                  className="rounded-lg border px-2.5 py-1 text-xs font-bold"
                  style={s.id === activo.id ? { background: NAVY, borderColor: NAVY, color: "#fff" } : chip}>
                  {s.nombre} {s.locacion === "ext" ? "· EXT" : "· INT"}
                </button>
              ))}
              <button onClick={agregarSet} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}>
                + Nuevo set
              </button>
              <span className="ml-auto">
                <TarjetaAyuda id="set" titulo="Cómo montar tu set"
                  pasos={[
                    "<b>Elige o crea un set</b> con los botones de arriba; cada set guarda su propia planta física.",
                    "<b>Agrega mobiliario</b> desde la paleta y arrástralo en el plano para colocarlo donde va.",
                    "Lo direccional (cámaras, luces, boom) <b>gira con su manija</b>; doble clic en la manija vuelve al ángulo automático.",
                    "<b>Doble clic en una etiqueta</b> la oculta; las casillas <b>Mostrar etiquetas / guías</b> controlan todo de golpe.",
                    "Si el plano se enreda, <b>Reacomodar automáticamente</b> reparte todo de nuevo.",
                  ]} />
              </span>
            </div>
          )}
          {editable && (
            <div className="no-print flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
              <input value={activo.nombre}
                onChange={(e) => upActivo({ nombre: e.target.value })}
                className="rounded-lg border px-2 py-1 text-xs font-bold"
                style={{ ...chip, width: 170 }} placeholder="Nombre del set…" />
              <select value={activo.locacion === "ext" ? "ext" : "int"}
                onChange={(e) => upActivo({ locacion: e.target.value }, { commit: true })}
                className="rounded-lg border px-2 py-1 text-xs font-bold" style={chip}>
                <option value="int">Estudio (interior)</option>
                <option value="ext">Locación exterior</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#33445F" }}>
                <input type="checkbox" checked={activo.mesaVisible !== false}
                  onChange={(e) => upActivo({ mesaVisible: e.target.checked }, { commit: true })} />
                Mesa / escritorio en el set
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#33445F" }} title="Muestra u oculta todos los nombres. Doble clic sobre una etiqueta del plano la oculta individualmente. Mantén el puntero encima de un icono para ver su nombre.">
                <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                Mostrar etiquetas
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#33445F" }} title="Muestra u oculta los conos de cámara, luz y boom.">
                <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
                Mostrar guías
              </label>
              {etiquetasOcultas > 0 && (
                <button onClick={() => setCfg((c) => upSetPor(c, activo.id, (s) => ({ ...s, setLayout: { ...s.setLayout, labelsOff: {} } })), { commit: true })}
                  className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}
                  title="Vuelve a mostrar las etiquetas ocultadas con doble clic">
                  ⟲ Restaurar {etiquetasOcultas} etiqueta{etiquetasOcultas === 1 ? "" : "s"}
                </button>
              )}
              {tieneCustom && (
                <button onClick={() => setCfg((c) => upSetPor(c, activo.id, reacomodoDe), { commit: true })}
                  className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}>
                  Reacomodar automáticamente
                </button>
              )}
              {sets.length > 1 && (
                <button onClick={eliminarSet} className="rounded-lg border px-2.5 py-1 text-xs font-bold"
                  style={{ borderColor: confirmaDel ? "#E0312F" : "#C8D2DE", color: confirmaDel ? "#E0312F" : "#8A97A8", background: "#fff" }}>
                  {confirmaDel ? "¿Eliminar este set y sus luces?" : "Eliminar set"}
                </button>
              )}
              {confirmaDel && (
                <button onClick={() => setConfirmaDel(false)} className="rounded-lg border px-2.5 py-1 text-xs font-bold" style={chip}>Cancelar</button>
              )}
            </div>
          )}
          <div className="no-print" style={{ marginBottom: 8 }}>
            <span className="text-xs" style={{ color: "#5B6B82" }}>
              Arrastra talentos, mesa, micrófonos, luces y cámaras; lo direccional gira con su manija (doble clic en la manija: volver al automático).
              {activo.mesaVisible === false ? " Sin mesa, el punto de foco marca a dónde apuntan cámaras y luces." : ""}
            </span>
          </div>
          <EstudioCenital key={activo.id} cfg={cfg} set={activo} cams={cams} editable={editable} setCfg={setCfg}
            showLabels={showLabels} showGuides={showGuides} />
        </Box>
        <Box title={`Mobiliario de ${activo.nombre}${(activo.muebles || []).length ? ` (${activo.muebles.length})` : ""}`}>
          {editable ? (
            <div className="flex flex-col gap-2.5">
              <SecTitle>Agregar mueble — haz clic para ponerlo en el plano</SecTitle>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MUEBLES_CATALOGO).map(([id, d]) => (
                  <button key={id} onClick={() => agregarMueble(id)} title={`Agregar ${d.es} al set`}
                    className="flex flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5"
                    style={{ borderColor: "#C8D2DE", background: "#fff", minWidth: 96, cursor: "pointer" }}>
                    <MuebleIcon tipo={id} />
                    <span className="text-xs font-bold" style={{ color: "#33445F" }}>{d.es}</span>
                    <span style={{ fontSize: 9, color: "#8A97A8", fontWeight: 700 }}>
                      {d.cap > 1 ? `${d.cap} plazas` : "1 plaza"}
                    </span>
                  </button>
                ))}
              </div>
              {(activo.muebles || []).length > 0 && (
                <>
                  <SecTitle>En el set ({(activo.muebles || []).length}) — siéntales talentos</SecTitle>
                  <p className="text-xs" style={{ color: "#8A97A8", margin: 0 }}>
                    El talento sentado se dibuja sobre el mueble y deja de aparecer suelto en el plano; cada quien solo ocupa un lugar.
                  </p>
                </>
              )}
              {(activo.muebles || []).map((m) => {
                const def = MUEBLES_CATALOGO[m.tipo] || { es: m.tipo, cap: 1 };
                const ocupantes = m.ocupantes || [];
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "#DDE4EC" }}>
                    <MuebleIcon tipo={m.tipo} width={48} height={22} />
                    <div className="flex flex-col" style={{ minWidth: 118 }}>
                      <span className="text-xs font-bold" style={{ color: "#33445F" }}>{def.es}</span>
                      <span style={{ fontSize: 11, letterSpacing: 2, color: NAVY }} title={`${ocupantes.length} de ${def.cap} plazas ocupadas`}>
                        {"●".repeat(ocupantes.length)}<span style={{ color: "#C8D2DE" }}>{"○".repeat(Math.max(0, def.cap - ocupantes.length))}</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "#8A97A8" }}>Sentar:</span>
                    {(cfg.talentos || []).map((t) => {
                      const dentro = ocupantes.includes(t.id);
                      const lleno = !dentro && ocupantes.length >= def.cap;
                      const col = t.tipo === "invitado" ? "#0E9F9E" : NAVY;
                      return (
                        <button key={t.id} onClick={() => toggleAsiento(m.id, t.id)} disabled={lleno}
                          title={dentro ? `Levantar a ${t.nombre}` : lleno ? "Sin plazas libres" : `Sentar a ${t.nombre} aquí`}
                          className="rounded-lg border px-2 py-0.5 text-xs font-bold"
                          style={dentro
                            ? { background: col, borderColor: col, color: "#fff" }
                            : { background: "#fff", borderColor: "#C8D2DE", color: "#33445F", opacity: lleno ? 0.4 : 1 }}>
                          {dentro ? "✓" : "+"} {trunc(t.nombre, 16)}
                        </button>
                      );
                    })}
                    {!(cfg.talentos || []).length && (
                      <span className="text-xs" style={{ color: "#8A97A8" }}>No hay talentos: créalos en la pestaña Editar.</span>
                    )}
                    <span className="flex-1" />
                    <button onClick={() => quitarMueble(m.id)} title="Quitar este mueble del set"
                      className="flex items-center justify-center rounded-lg border"
                      style={{ width: 26, height: 26, borderColor: "#E5CACA", color: "#C0392B", background: "#fff", cursor: "pointer" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              {!(activo.muebles || []).length && (
                <p className="text-xs" style={{ color: "#5B6B82", margin: 0 }}>
                  Aún no hay muebles en este set: haz clic en uno de arriba y luego arrástralo en el plano.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "#5B6B82", margin: 0 }}>
              {(activo.muebles || []).map((m) => (MUEBLES_CATALOGO[m.tipo] || { es: m.tipo }).es).join(" · ") || "Sin mobiliario."}
            </p>
          )}
        </Box>
        <Box title={`Iluminación de ${activo.nombre}${(activo.iluminacion?.luces || []).length ? ` (${activo.iluminacion.luces.length} luces)` : ""}`}>
          <PanelIluminacion key={activo.id} cfg={cfg} set={activo} setCfg={setCfg} />
        </Box>
        <Box title={`Personal de operación (${(cfg.personal || []).length}${cfg.includeCamOps ? ` + ${cams.length} cám.` : ""})`}>
          <PersonalGrid cfg={cfg} cams={cams} />
        </Box>
      </div>
    </div>
  );
}

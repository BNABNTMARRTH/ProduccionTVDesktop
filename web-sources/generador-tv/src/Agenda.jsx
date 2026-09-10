/* LA AGENDA DE CREW — la pantalla.
   ---------------------------------------------------------------------------
   Una lista de personas con una pregunta encima: ¿a quién llamo? Los filtros
   se tocan, igual que en la mesa de luz, porque la pregunta rara vez es "quiero
   ver a todos": es "quiero un gaffer, senior, que facture".

   La fila dice lo mínimo para decidir: cara, nombre, puesto y si ya trabajaste
   con esa persona. El resto está a un toque. Y el botón que de verdad importa
   —"Al proyecto"— vive en la fila, no escondido dentro de la ficha: mover a
   alguien de la agenda al equipo es lo que se hace veinte veces por rodaje. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Plus, Search, Star, Trash2, UserPlus, X } from "lucide-react";

import { Box, Btn } from "./ui.jsx";
import { EMBEDDED } from "./puente.js";
import {
  CABELLO, CABELLO_TIPO, COMPLEXION, DEPARTAMENTOS, DISPONIBILIDAD, ETIQUETAS,
  HABILIDADES, IDIOMAS, NIVELES, OJOS, ROLES, TEZ, nombreDepto,
} from "./crew.js";
import {
  borrarContacto, completitud, contactoNuevo, deptoDe, filtrarContactos,
  guardarContacto, leerRetrato, listarContactos, loQueFalta,
} from "./agenda.js";

/* Una fila de pastillas que se tocan. Misma pieza que en la mesa de luz y por
   la misma razón: con un dedo, tocar gana a desplegar. */
const Pastillas = ({ etiqueta, valor, onChange, opciones, corto }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-[10px] font-bold uppercase tracking-wide"
      style={{ color: "var(--tinta-baja)", minWidth: 74 }}>{etiqueta}</span>
    {opciones.map((o) => {
      const id = typeof o === "string" ? o : o.id;
      const texto = typeof o === "string" ? o : (corto ? o.nombre : o.nombre);
      const puesta = valor === id;
      return (
        <button key={id} type="button" aria-pressed={puesta} title={typeof o === "object" ? o.detalle : undefined}
          onClick={() => onChange(puesta ? "" : id)}
          style={{
            minHeight: 32, padding: "0 11px", borderRadius: 9, cursor: "pointer",
            fontSize: 12, fontWeight: 700, fontFamily: "inherit",
            border: puesta ? "2px solid var(--tinta)" : "1px solid var(--vidrio-borde)",
            background: puesta ? "var(--tinta)" : "var(--vidrio-b)",
            color: puesta ? "var(--yeso)" : "var(--tinta-media)",
          }}>{texto}</button>
      );
    })}
  </div>
);

const Campo = ({ etiqueta, ancho, lista, children, ...resto }) => (
  <label className="flex flex-col gap-0.5" style={{ minWidth: ancho }}>
    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--tinta-baja)" }}>
      {etiqueta}
    </span>
    {children || <input className="campo-caja" list={lista} style={{ minHeight: 38, fontSize: 13 }} {...resto} />}
  </label>
);

const Elegir = ({ etiqueta, valor, onChange, opciones }) => (
  <Campo etiqueta={etiqueta}>
    <select className="campo-caja" value={valor} onChange={(e) => onChange(e.target.value)}
      style={{ minHeight: 38, fontSize: 13 }}>
      <option value="">—</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </Campo>
);

/* Marcar varias de una lista corta (idiomas, habilidades, disponibilidad,
   etiquetas). Se toca; no hay nada que desplegar. */
const Marcar = ({ etiqueta, valor = [], onChange, opciones }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--tinta-baja)" }}>
      {etiqueta}
    </span>
    <div className="flex flex-wrap gap-1">
      {opciones.map((o) => {
        const puesta = valor.includes(o);
        return (
          <button key={o} type="button" aria-pressed={puesta}
            onClick={() => onChange(puesta ? valor.filter((x) => x !== o) : [...valor, o])}
            style={{
              minHeight: 30, padding: "0 9px", borderRadius: 8, cursor: "pointer",
              fontSize: 11.5, fontWeight: 600, fontFamily: "inherit",
              border: puesta ? "2px solid var(--tinta)" : "1px solid var(--vidrio-borde)",
              background: puesta ? "var(--tinta)" : "transparent",
              color: puesta ? "var(--yeso)" : "var(--tinta-media)",
            }}>{o}</button>
        );
      })}
    </div>
  </div>
);

const Retrato = ({ foto, nombre, lado = 44 }) => (
  foto
    ? <img src={foto} alt={nombre} style={{ width: lado, height: lado, borderRadius: lado / 2, objectFit: "cover", flex: "none" }} />
    : <div style={{
        width: lado, height: lado, borderRadius: lado / 2, flex: "none",
        display: "grid", placeItems: "center", background: "var(--vidrio-b)",
        border: "1px solid var(--vidrio-borde)", color: "var(--tinta-baja)",
        fontSize: lado * 0.36, fontWeight: 800,
      }}>{(nombre || "?").trim().charAt(0).toUpperCase()}</div>
);

/* ---------------------------- Una persona ---------------------------- */

function Ficha({ contacto, onCambiar, onCerrar, onBorrar, onAlProyecto }) {
  const [c, setC] = useState(contacto);
  const retrato = useRef(null);
  const poner = (parche) => { const nuevo = { ...c, ...parche }; setC(nuevo); onCambiar(nuevo); };
  const falta = loQueFalta(c);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-3"
      style={{ background: "rgba(10,10,14,.72)" }} onClick={onCerrar}>
      <div className="w-full max-w-4xl rounded-xl border" onClick={(e) => e.stopPropagation()}
        style={{ borderColor: "var(--vidrio-borde)", background: "var(--yeso)", marginTop: 8 }}>

        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--vidrio-borde)" }}>
          <Retrato foto={c.foto} nombre={c.nombre} lado={30} />
          <strong className="flex-1 truncate text-sm">{c.nombre || "Sin nombre"}</strong>
          <span className="text-[11px]" style={{ color: "var(--tinta-baja)" }}>{completitud(c)}% de la ficha</span>
          <Btn rango={1} icono={UserPlus} onClick={() => onAlProyecto(c)} titulo="Meter a esta persona en el equipo del proyecto">
            Al proyecto
          </Btn>
          <Btn rango={3} icono={X} onClick={onCerrar} titulo="Cerrar">Cerrar</Btn>
        </div>

        <div className="p-3">
          {/* Lo que impide llamarle va ARRIBA y en su propio renglón. Es lo
              único de esta pantalla que de verdad rompe algo. */}
          {falta.length > 0 && (
            <p className="mb-2 rounded-lg px-2.5 py-1.5 text-xs"
              style={{ background: "var(--vidrio-b)", border: "1px solid var(--vidrio-borde)", color: "var(--tinta-media)" }}>
              Para poder llamarle falta <b>{falta.join(", ")}</b>.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <input ref={retrato} type="file" accept="image/*" hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (f) { try { poner({ foto: await leerRetrato(f) }); } catch { } }
              }} />
            <button type="button" onClick={() => retrato.current?.click()} title="Poner o cambiar el retrato"
              className="border-0 bg-transparent p-0" style={{ cursor: "pointer" }}>
              <Retrato foto={c.foto} nombre={c.nombre} lado={60} />
            </button>
            <Campo etiqueta="Nombre" ancho={190} value={c.nombre} placeholder="Como le dicen en el set"
              onChange={(e) => poner({ nombre: e.target.value })} />
            <Campo etiqueta="Puesto" ancho={200} lista="crew-roles" value={c.rol}
              placeholder="Escribe y aparece…" onChange={(e) => poner({ rol: e.target.value })} />
            <Elegir etiqueta="Nivel" valor={c.nivel} opciones={NIVELES} onChange={(v) => poner({ nivel: v })} />
            <Campo etiqueta="Ciudad" ancho={140} value={c.ciudad} onChange={(e) => poner({ ciudad: e.target.value })} />
            <button type="button" onClick={() => poner({ favorito: !c.favorito })} aria-pressed={c.favorito}
              title={c.favorito ? "Quitar de los de confianza" : "Marcar: ya trabajaste con esta persona y repetirías"}
              className="inline-flex items-center gap-1.5 rounded-lg"
              style={{
                minHeight: 38, padding: "0 11px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                border: c.favorito ? "2px solid #C8912B" : "1px solid var(--vidrio-borde)",
                background: c.favorito ? "#F5B301" : "transparent",
                color: c.favorito ? "#3A2A00" : "var(--tinta-media)",
              }}>
              <Star size={14} fill={c.favorito ? "currentColor" : "none"} /> De confianza
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Campo etiqueta="Teléfono" ancho={140} value={c.telefono} inputMode="tel"
              onChange={(e) => poner({ telefono: e.target.value })} />
            <Campo etiqueta="Correo" ancho={190} value={c.email} inputMode="email"
              onChange={(e) => poner({ email: e.target.value })} />
            <Campo etiqueta="Instagram" ancho={150} value={c.instagram} placeholder="@"
              onChange={(e) => poner({ instagram: e.target.value })} />
            <Campo etiqueta="Portafolio" ancho={190} value={c.web} placeholder="Reel, sitio, Drive…"
              onChange={(e) => poner({ web: e.target.value })} />
            <Campo etiqueta="Tarifa" ancho={150} value={c.tarifa} placeholder="800/día, a convenir…"
              onChange={(e) => poner({ tarifa: e.target.value })} />
          </div>

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Campo etiqueta="Qué trae puesto" ancho={280} value={c.equipo}
              placeholder="Cámara, lentes, luces, transporte…"
              onChange={(e) => poner({ equipo: e.target.value })} />
            <Campo etiqueta="Notas" ancho={320}>
              <textarea className="campo-caja" rows={1} value={c.notas} style={{ fontSize: 13 }}
                placeholder="Cómo trabaja, con quién, qué evitar"
                onChange={(e) => poner({ notas: e.target.value })} />
            </Campo>
          </div>

          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <Marcar etiqueta="Cuándo se le puede llamar" valor={c.disponibilidad} opciones={DISPONIBILIDAD}
              onChange={(v) => poner({ disponibilidad: v })} />
            <Marcar etiqueta="Etiquetas" valor={c.etiquetas} opciones={ETIQUETAS}
              onChange={(v) => poner({ etiquetas: v })} />
          </div>

          {/* CASTING. Plegado y apagado por omisión: a un gaffer no se le
              pregunta el color de ojos, y tener esos campos delante todo el
              tiempo hace que la agenda parezca un formulario de casting. */}
          <div className="mt-3 rounded-lg border p-2" style={{ borderColor: "var(--vidrio-borde)" }}>
            <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={c.esTalento} onChange={(e) => poner({ esTalento: e.target.checked })} />
              <span className="text-xs font-bold">Trabaja frente a cámara</span>
              <span className="text-[11px]" style={{ color: "var(--tinta-baja)" }}>
                — abre los datos que pide un casting
              </span>
            </label>
            {c.esTalento && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-2">
                  <Campo etiqueta="Edad aparente" ancho={80} value={c.edadMin} inputMode="numeric" placeholder="25"
                    onChange={(e) => poner({ edadMin: e.target.value.replace(/\D/g, "") })} />
                  <Campo etiqueta="a" ancho={80} value={c.edadMax} inputMode="numeric" placeholder="35"
                    onChange={(e) => poner({ edadMax: e.target.value.replace(/\D/g, "") })} />
                  <Campo etiqueta="Estatura (cm)" ancho={100} value={c.estaturaCm} inputMode="numeric" placeholder="178"
                    onChange={(e) => poner({ estaturaCm: e.target.value.replace(/\D/g, "") })} />
                  <Elegir etiqueta="Complexión" valor={c.complexion} opciones={COMPLEXION} onChange={(v) => poner({ complexion: v })} />
                  <Elegir etiqueta="Tez" valor={c.tez} opciones={TEZ} onChange={(v) => poner({ tez: v })} />
                  <Elegir etiqueta="Ojos" valor={c.ojos} opciones={OJOS} onChange={(v) => poner({ ojos: v })} />
                  <Elegir etiqueta="Cabello" valor={c.cabello} opciones={CABELLO} onChange={(v) => poner({ cabello: v })} />
                  <Elegir etiqueta="Tipo" valor={c.cabelloTipo} opciones={CABELLO_TIPO} onChange={(v) => poner({ cabelloTipo: v })} />
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  <Marcar etiqueta="Idiomas" valor={c.idiomas} opciones={IDIOMAS} onChange={(v) => poner({ idiomas: v })} />
                  <Marcar etiqueta="Habilidades" valor={c.habilidades} opciones={HABILIDADES} onChange={(v) => poner({ habilidades: v })} />
                </div>
                <p className="text-[11px]" style={{ color: "var(--tinta-baja)" }}>
                  Estos datos son opcionales y sirven para un papel concreto. Descríbelos
                  como los pediría un casting, no como una calificación de la persona.
                </p>
              </div>
            )}
          </div>

          <button type="button" onClick={onBorrar}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border"
            style={{ minHeight: 38, padding: "0 12px", borderColor: "var(--vidrio-borde)",
              background: "transparent", color: "#B03A3A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Trash2 size={15} /> Quitar de la agenda
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- La agenda ---------------------------- */

export function Agenda({ cfg, setCfg }) {
  const editable = !!setCfg;
  const [gente, setGente] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [aviso, setAviso] = useState("");
  const [abierta, setAbierta] = useState(null);
  const [filtro, setFiltro] = useState({ texto: "", depto: "", rol: "", nivel: "", favoritos: false });

  const recargar = useCallback(() => {
    listarContactos()
      .then((l) => { setGente(l); setEstado("lista"); })
      .catch((e) => { setAviso(e.message || ""); setEstado(EMBEDDED ? "error" : "fuera"); });
  }, []);
  useEffect(() => { recargar(); }, [recargar]);

  const guardar = async (c) => {
    setGente((g) => g.map((x) => (x.id === c.id ? c : x)));
    try { await guardarContacto(c); } catch (e) { setAviso(e.message || "No se pudo guardar"); }
  };

  const nueva = async () => {
    const c = contactoNuevo();
    try { await guardarContacto(c); } catch (e) { setAviso(e.message || "No se pudo crear"); return; }
    setGente((g) => [c, ...g]);
    setAbierta(c);
  };

  const borrar = async (id) => {
    try { await borrarContacto(id); } catch (e) { setAviso(e.message || "No se pudo quitar"); return; }
    setAbierta(null);
    setGente((g) => g.filter((x) => x.id !== id));
    setAviso("Se fue a la papelera; el archivo sigue ahí por si te arrepientes");
    setTimeout(() => setAviso(""), 3200);
  };

  /* AL PROYECTO. Aquí es donde la agenda deja de ser una lista y se vuelve
     útil: la persona entra al equipo del proyecto abierto. Va a `talentos` si
     trabaja frente a cámara y a `personal` si no, que es la división que ya
     hace la app. Se guarda el `perfilId` para poder volver a su ficha. */
  const alProyecto = (c) => {
    if (!setCfg) return;
    const falta = loQueFalta(c);
    if (falta.length) {
      setAviso(`Antes de meterle al proyecto, complétale ${falta.join(", ")}.`);
      setTimeout(() => setAviso(""), 4000);
      return;
    }
    setCfg((v) => {
      if (c.esTalento) {
        if ((v.talentos || []).some((t) => t.perfilId === c.id)) return v;
        return { ...v, talentos: [...(v.talentos || []),
          { id: "tal-" + c.id, nombre: c.nombre, tipo: "invitado", perfilId: c.id }] };
      }
      if ((v.personal || []).some((p) => p.perfilId === c.id)) return v;
      return { ...v, personal: [...(v.personal || []),
        { id: "per-" + c.id, rol: c.rol, nombre: c.nombre, icon: "director", perfilId: c.id }] };
    });
    setAviso(`${c.nombre} está en ${c.esTalento ? "Talentos" : "Personal"} del proyecto (Necesidades ▸ Personas y equipo)`);
    setTimeout(() => setAviso(""), 4200);
  };

  const enElProyecto = (id) =>
    (cfg?.personal || []).some((p) => p.perfilId === id)
    || (cfg?.talentos || []).some((t) => t.perfilId === id);

  const visibles = useMemo(() => filtrarContactos(gente, filtro), [gente, filtro]);
  const hayFiltro = Object.values(filtro).some(Boolean);
  // Solo los puestos que de verdad tienes, como el menú de Plano en la mesa.
  const rolesQueHay = useMemo(() => {
    const hay = new Set(gente.map((c) => c.rol).filter(Boolean));
    return [...ROLES.filter((r) => hay.has(r)), ...[...hay].filter((r) => !ROLES.includes(r)).sort()];
  }, [gente]);
  // Solo los departamentos con gente: pastillas de algo que no existe estorban.
  const deptosQueHay = useMemo(() => {
    const hay = new Set(gente.map(deptoDe).filter(Boolean));
    return DEPARTAMENTOS.filter((d) => hay.has(d.id));
  }, [gente]);

  if (estado === "fuera") {
    return (
      <div className="scrollwrap overflow-auto px-3 py-4">
        <Box title="Agenda de crew">
          <p className="text-sm" style={{ color: "var(--tinta-media)" }}>
            La agenda vive en el disco, junto a tus proyectos, así que solo funciona
            dentro de la app de Producción TV.
          </p>
        </Box>
      </div>
    );
  }

  return (
    <div className="scrollwrap overflow-auto px-3 py-3">
      <datalist id="crew-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>

      <div className="mb-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-0.5" style={{ minWidth: 190 }}>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--tinta-baja)" }}>Buscar</span>
          <span className="relative flex items-center">
            <Search size={15} className="pointer-events-none absolute left-2" style={{ color: "var(--tinta-baja)" }} />
            <input className="campo-caja w-full" style={{ minHeight: 40, paddingLeft: 28, fontSize: 13 }}
              value={filtro.texto} placeholder="nombre, puesto, equipo, notas…"
              onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))} />
          </span>
        </label>
        {rolesQueHay.length > 0 && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--tinta-baja)" }}>Puesto</span>
            <select className="campo-caja" value={filtro.rol} style={{ minHeight: 40, minWidth: 180, fontSize: 13 }}
              onChange={(e) => setFiltro((f) => ({ ...f, rol: e.target.value }))}>
              <option value="">Cualquiera</option>
              {rolesQueHay.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        {editable && (
          <Btn rango={1} icono={Plus} onClick={nueva} titulo="Agregar una persona a tu agenda">
            Agregar persona
          </Btn>
        )}
      </div>

      {deptosQueHay.length > 1 && (
        <div className="mb-1.5">
          <Pastillas etiqueta="Área" valor={filtro.depto} opciones={deptosQueHay}
            onChange={(v) => setFiltro((f) => ({ ...f, depto: v }))} />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Pastillas etiqueta="Nivel" valor={filtro.nivel} opciones={NIVELES}
          onChange={(v) => setFiltro((f) => ({ ...f, nivel: v }))} />
        <button type="button" aria-pressed={filtro.favoritos}
          onClick={() => setFiltro((f) => ({ ...f, favoritos: !f.favoritos }))}
          title="Solo con quienes ya trabajaste y repetirías"
          className="inline-flex items-center gap-1.5 rounded-lg"
          style={{
            minHeight: 32, padding: "0 11px", cursor: "pointer", fontSize: 12, fontWeight: 700,
            border: filtro.favoritos ? "2px solid #C8912B" : "1px solid var(--vidrio-borde)",
            background: filtro.favoritos ? "#F5B301" : "var(--vidrio-b)",
            color: filtro.favoritos ? "#3A2A00" : "var(--tinta-media)",
          }}>
          <Star size={13} fill={filtro.favoritos ? "currentColor" : "none"} /> De confianza
        </button>
        {hayFiltro && (
          <button type="button" className="rounded-lg border px-2.5"
            onClick={() => setFiltro({ texto: "", depto: "", rol: "", nivel: "", favoritos: false })}
            style={{ minHeight: 32, borderColor: "var(--vidrio-borde)", background: "transparent",
              color: "var(--tinta-media)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
            Quitar filtros
          </button>
        )}
      </div>

      {aviso && <p className="mb-2 text-xs" style={{ color: "var(--tinta-media)" }}>{aviso}</p>}

      <Box title={`Agenda — ${visibles.length}${hayFiltro ? ` de ${gente.length}` : ""} ${(hayFiltro ? gente.length : visibles.length) === 1 ? "persona" : "personas"}`}>
        {estado === "cargando" && <p className="text-sm" style={{ color: "var(--tinta-baja)" }}>Abriendo la agenda…</p>}
        {estado === "error" && <p className="text-sm" style={{ color: "#B03A3A" }}>{aviso}</p>}
        {estado === "lista" && !gente.length && (
          <p className="text-sm" style={{ color: "var(--tinta-media)" }}>
            Tu agenda está vacía. Con <b>Agregar persona</b> vas guardando a quien ya
            conoces: el camarógrafo que te salvó un rodaje, la maquillista que llega
            temprano, el del foro que renta barato. Es tuya y vive en tu disco — no
            se publica en ningún lado.
          </p>
        )}
        {estado === "lista" && gente.length > 0 && !visibles.length && (
          <p className="text-sm" style={{ color: "var(--tinta-media)" }}>Nadie cumple con todos esos filtros a la vez.</p>
        )}
        {visibles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {visibles.map((c) => {
              const listo = !loQueFalta(c).length;
              return (
                <div key={c.id} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
                  style={{ borderColor: "var(--vidrio-borde)", background: "var(--vidrio-b)" }}>
                  <Retrato foto={c.foto} nombre={c.nombre} />
                  <button type="button" onClick={() => setAbierta(c)}
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left" style={{ cursor: "pointer" }}>
                    <div className="flex items-center gap-1.5">
                      {c.favorito && <Star size={13} fill="#F5B301" color="#C8912B" />}
                      <b className="truncate text-sm">{c.nombre || "Sin nombre"}</b>
                    </div>
                    <div className="truncate text-[11.5px]" style={{ color: "var(--tinta-media)" }}>
                      {[c.rol || "sin puesto", c.nivel, nombreDepto(deptoDe(c)), c.ciudad]
                        .filter(Boolean).join(" · ")}
                    </div>
                    {!listo && (
                      <div className="text-[11px]" style={{ color: "#B07A2B" }}>
                        falta {loQueFalta(c).join(", ")}
                      </div>
                    )}
                  </button>
                  {c.telefono && (
                    <span className="mono hidden text-[11.5px] sm:inline" style={{ color: "var(--tinta-media)" }}>
                      {c.telefono}
                    </span>
                  )}
                  {editable && (
                    <Btn rango={enElProyecto(c.id) ? 3 : 2} icono={UserPlus}
                      onClick={() => alProyecto(c)}
                      titulo={enElProyecto(c.id) ? "Ya está en el equipo del proyecto" : "Meter en el equipo del proyecto"}>
                      {enElProyecto(c.id) ? "En el equipo" : "Al proyecto"}
                    </Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Box>

      {abierta && (
        <Ficha contacto={abierta} onCambiar={guardar} onCerrar={() => setAbierta(null)}
          onBorrar={() => borrar(abierta.id)} onAlProyecto={alProyecto} />
      )}
    </div>
  );
}

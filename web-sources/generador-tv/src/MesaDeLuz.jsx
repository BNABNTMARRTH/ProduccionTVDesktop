/* LA MESA DE LUZ — la pantalla.
   ---------------------------------------------------------------------------
   Dos zonas y una regla: arriba el TABLERO del proyecto ("así se tiene que ver
   esto"), abajo la FOTOTECA entera. La misma imagen puede estar en los dos
   sitios porque no se copia: el tablero solo guarda a qué referencia apunta.

   Por qué el tablero va arriba y no en su propia pestaña: la pregunta que se
   hace uno al abrir esto es "¿qué llevo elegido?" y solo después "¿qué más
   tengo?". Con el tablero escondido detrás de una pestaña había que acordarse
   de ir a verlo, y entonces no sirve de nada tenerlo.

   El vocabulario de las etiquetas NO es nuevo: el tipo de plano, el movimiento
   y el formato salen de los mismos catálogos que usa el guion técnico. Por eso
   una referencia marcada "Primer Plano" se puede cruzar con el plano 4 de la
   escena 2, que dice exactamente lo mismo. Ahí está la diferencia con tener las
   fotos en una carpeta. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Search, Star, Trash2, X } from "lucide-react";

import { Box, Btn } from "./ui.jsx";
import { EMBEDDED } from "./puente.js";
import { PLANOS, MOVIMIENTOS } from "./catalogos.js";
import { FORMATOS } from "./proyecto.js";
import { SETUPS_ILUMINACION } from "./iluminacion.js";
import {
  FAMILIAS, GENTE, LUGARES, MOMENTOS,
  analizarImagen, borrarReferencia, fichaNueva, filtrar, guardarReferencia,
  imagenDeReferencia, leerImagen, listarReferencias, normFicha,
} from "./mesaDeLuz.js";

const LUCES = SETUPS_ILUMINACION.map((s) => ({ id: s.id, nombre: s.name_es || s.name || s.id }));

/* Un selector de etiqueta. Se repite ocho veces y siempre igual, así que vive
   aquí una sola vez: en un iPad los 40 px de alto no son estética, son la
   diferencia entre acertarle y no acertarle. */
const Filtro = ({ etiqueta, valor, onChange, opciones, ancho = 128, auto = false }) => (
  <label className="flex flex-col gap-0.5">
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: "var(--tinta-baja)" }}>
      {etiqueta}
      {/* Una conjetura tiene que VERSE como conjetura. El punto dice "esto lo
          puso la app mirando la foto, no tú" — y por eso se puede cambiar sin
          miedo a estar borrando algo que decidiste. Desaparece en cuanto lo
          tocas: a partir de ahí la etiqueta ya es tuya. */}
      {auto && (
        <span title="Lo propuso la app mirando la imagen; cámbialo si no acertó"
          style={{
            display: "inline-flex", alignItems: "center", gap: 3, padding: "0 5px",
            borderRadius: 6, background: "var(--vidrio-b)", border: "1px solid var(--vidrio-borde)",
            fontSize: 8.5, letterSpacing: 0.3,
          }}>◆ AUTO</span>
      )}
    </span>
    <select className="campo-caja" value={valor} onChange={(e) => onChange(e.target.value)}
      style={{ minHeight: 40, minWidth: ancho, fontSize: 13 }}>
      <option value="">Cualquiera</option>
      {opciones.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const nombre = typeof o === "string" ? o : o.nombre;
        return <option key={id} value={id}>{nombre}</option>;
      })}
    </select>
  </label>
);

/* UNA FILA DE PASTILLAS QUE SE TOCAN, igual que la de colores. Lugar tiene 2
   opciones, Momento 5 y Gente 5: meter eso en un menú desplegable obligaba a
   abrir, apuntar y elegir para algo que cabe entero a la vista. En un iPad la
   diferencia es entre un dedazo y tres. Tocar la que ya está puesta la quita,
   como los colores.

   Plano se queda en menú, y no por descuido: tiene 23 opciones y como fila
   ocuparía media pantalla. Lo que sí hace es ofrecer SOLO los planos que de
   verdad hay en tu fototeca, para no recorrer veintitrés cuando tienes cuatro. */
function Pastillas({ etiqueta, valor, onChange, opciones }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide"
        style={{ color: "var(--tinta-baja)", minWidth: 54 }}>{etiqueta}</span>
      {opciones.map((o) => {
        const puesta = valor === o;
        return (
          <button key={o} type="button" aria-pressed={puesta}
            onClick={() => onChange(puesta ? "" : o)}
            style={{
              minHeight: 32, padding: "0 11px", borderRadius: 9, cursor: "pointer",
              fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              border: puesta ? "2px solid var(--tinta)" : "1px solid var(--vidrio-borde)",
              background: puesta ? "var(--tinta)" : "var(--vidrio-b)",
              color: puesta ? "var(--yeso)" : "var(--tinta-media)",
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* La franja de color bajo cada miniatura. Es la lectura más rápida que existe
   de una imagen: sin abrirla ya sabes si es cálida, fría o apagada, y ese es
   el 80% de por qué buscas una referencia. */
/* width:100% explícito: dentro de la rejilla la franja ya ocupaba todo el
   ancho por ser hija de un bloque, pero en la ficha abierta el padre es flex y
   ahí se encogía a cero — la paleta simplemente no aparecía. */
const Franja = ({ colores = [], alto = 5 }) => (
  <div className="flex" style={{ height: alto, width: "100%" }} aria-hidden="true">
    {(colores.length ? colores : ["#00000000"]).map((c, i) => (
      <div key={i} style={{ flex: 1, background: c }} />
    ))}
  </div>
);

function Cuadro({ ficha, enTablero, onAbrir, onTablero }) {
  return (
    <figure className="relative m-0 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--vidrio-borde)", background: "var(--vidrio-b)" }}>
      <button type="button" onClick={onAbrir} className="block w-full text-left"
        title={ficha.nota || ficha.plano || "Ver en grande"}>
        {ficha.min
          ? <img src={ficha.min} alt={ficha.nota || "Referencia"} loading="lazy"
              className="block w-full" style={{ aspectRatio: "16/9", objectFit: "cover" }} />
          : <div style={{ aspectRatio: "16/9", display: "grid", placeItems: "center",
              color: "var(--tinta-baja)", fontSize: 11 }}>sin imagen</div>}
        <Franja colores={ficha.colores} />
      </button>
      {/* La estrella pone y quita del tablero sin abrir la ficha: elegir es lo
          que más veces se hace y no debe costar dos toques y una vuelta. */}
      <button type="button" onClick={onTablero} aria-pressed={enTablero}
        title={enTablero ? "Quitar del tablero" : "Poner en el tablero del proyecto"}
        className="absolute right-1.5 top-1.5 grid place-items-center rounded-full"
        style={{
          width: 34, height: 34, border: "none", cursor: "pointer",
          background: enTablero ? "#F5B301" : "rgba(15,15,20,.55)",
          color: enTablero ? "#3A2A00" : "#fff",
        }}>
        <Star size={16} fill={enTablero ? "currentColor" : "none"} />
      </button>
      {(ficha.plano || ficha.nota) && (
        <figcaption className="truncate px-2 py-1 text-[11px]" style={{ color: "var(--tinta-media)" }}>
          {ficha.plano || ficha.nota}
        </figcaption>
      )}
    </figure>
  );
}

/* La ficha abierta: la imagen completa y sus etiquetas. Se pide la imagen
   grande al abrir, no antes: en la cuadrícula solo viajan miniaturas y por eso
   la mesa abre igual de rápido con veinte que con trescientas. */
function FichaAbierta({ ficha, editable, onCerrar, onCambiar, onBorrar, enTablero, onTablero }) {
  const [grande, setGrande] = useState("");
  const [pidiendo, setPidiendo] = useState(true);

  useEffect(() => {
    let vivo = true;
    setPidiendo(true);
    imagenDeReferencia(ficha.id)
      .then((d) => { if (vivo) { setGrande(d || ""); setPidiendo(false); } })
      .catch(() => { if (vivo) setPidiendo(false); });
    return () => { vivo = false; };
  }, [ficha.id]);

  const poner = (parche) => onCambiar({ ...ficha, ...parche });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-3"
      style={{ background: "rgba(10,10,14,.72)" }} onClick={onCerrar}>
      <div className="w-full max-w-5xl rounded-xl border" onClick={(e) => e.stopPropagation()}
        /* --yeso, no --vidrio: este panel tapa la mesa entera y tiene que ser
           OPACO. Con el material translúcido de las tarjetas se leían los
           filtros y la rejilla POR DEBAJO de la ficha abierta. */
        style={{ borderColor: "var(--vidrio-borde)", background: "var(--yeso)", marginTop: 8 }}>
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--vidrio-borde)" }}>
          <strong className="flex-1 truncate text-sm">{ficha.nota || ficha.plano || "Referencia"}</strong>
          <Btn rango={2} icono={Star} onClick={onTablero}
            titulo={enTablero ? "Quitar del tablero" : "Poner en el tablero"}>
            {enTablero ? "En el tablero" : "Al tablero"}
          </Btn>
          <Btn rango={3} icono={X} onClick={onCerrar} titulo="Cerrar">Cerrar</Btn>
        </div>

        <div className="grid gap-3 p-3" style={{ gridTemplateColumns: "minmax(0,1.35fr) minmax(260px,.65fr)" }}>
          <div>
            {pidiendo && <div className="grid place-items-center rounded-lg" style={{ aspectRatio: "16/9", background: "var(--vidrio-b)", color: "var(--tinta-baja)", fontSize: 12 }}>Trayendo la imagen…</div>}
            {!pidiendo && (grande
              ? <img src={grande} alt={ficha.nota || "Referencia"} className="block w-full rounded-lg" />
              : <div className="grid place-items-center rounded-lg" style={{ aspectRatio: "16/9", background: "var(--vidrio-b)", color: "var(--tinta-baja)", fontSize: 12 }}>
                  No se encontró el archivo de esta imagen.
                </div>)}
            <div className="mt-2 overflow-hidden rounded" style={{ border: "1px solid var(--vidrio-borde)" }}>
              <Franja colores={ficha.colores} alto={22} />
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--tinta-baja)" }}>
              {ficha.ancho ? `${ficha.ancho}×${ficha.alto} px · ` : ""}
              paleta sacada de la propia imagen
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="campo">
              <span className="campo-et">Nota</span>
              <textarea className="campo-caja" rows={2} value={ficha.nota} disabled={!editable}
                placeholder="Qué te sirve de esta imagen"
                onChange={(e) => poner({ nota: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Filtro etiqueta="Plano" valor={ficha.plano} opciones={PLANOS} ancho={0}
                auto={(ficha.auto || []).includes("plano")}
                onChange={(v) => editable && poner({ plano: v, auto: (ficha.auto || []).filter((x) => x !== "plano") })} />
              <Filtro etiqueta="Movimiento" valor={ficha.movimiento} opciones={MOVIMIENTOS} ancho={0}
                onChange={(v) => editable && poner({ movimiento: v })} />
              <Filtro etiqueta="Lugar" valor={ficha.lugar} opciones={LUGARES} ancho={0}
                auto={(ficha.auto || []).includes("lugar")}
                onChange={(v) => editable && poner({ lugar: v, auto: (ficha.auto || []).filter((x) => x !== "lugar") })} />
              <Filtro etiqueta="Momento" valor={ficha.momento} opciones={MOMENTOS} ancho={0}
                auto={(ficha.auto || []).includes("momento")}
                onChange={(v) => editable && poner({ momento: v, auto: (ficha.auto || []).filter((x) => x !== "momento") })} />
              <Filtro etiqueta="Gente" valor={ficha.gente} opciones={GENTE} ancho={0}
                auto={(ficha.auto || []).includes("gente")}
                onChange={(v) => editable && poner({ gente: v, auto: (ficha.auto || []).filter((x) => x !== "gente") })} />
              <Filtro etiqueta="Formato" valor={ficha.formato} opciones={FORMATOS} ancho={0}
                onChange={(v) => editable && poner({ formato: v })} />
            </div>
            <Filtro etiqueta="Esquema de luz" valor={ficha.luz} opciones={LUCES} ancho={0}
              onChange={(v) => editable && poner({ luz: v })} />
            <label className="campo">
              <span className="campo-et">Palabras tuyas (separadas por coma)</span>
              <input className="campo-caja" value={(ficha.libres || []).join(", ")} disabled={!editable}
                placeholder="pasillo, contraluz, soledad"
                onChange={(e) => poner({ libres: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </label>
            {editable && (
              <button type="button" onClick={onBorrar}
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border"
                style={{ minHeight: 40, borderColor: "var(--vidrio-borde)", background: "transparent",
                  color: "#B03A3A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                <Trash2 size={15} /> Quitar de la fototeca
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- La mesa ------------------------------- */

export function MesaDeLuz({ cfg, setCfg }) {
  const editable = !!setCfg;
  const [fichas, setFichas] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | lista | fuera | error
  const [aviso, setAviso] = useState("");
  const [abierta, setAbierta] = useState(null);
  const [filtro, setFiltro] = useState({ texto: "", plano: "", lugar: "", momento: "", gente: "", familia: "" });
  const entrada = useRef(null);
  const camara = useRef(null);

  const tablero = useMemo(() => cfg?.mesaDeLuz?.tablero || [], [cfg]);

  const recargar = useCallback(() => {
    listarReferencias()
      .then((lista) => { setFichas(lista.map(normFicha)); setEstado("lista"); })
      .catch((e) => { setAviso(e.message || "No se pudo abrir la fototeca"); setEstado(EMBEDDED ? "error" : "fuera"); });
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  const traer = async (archivos) => {
    const lista = [...(archivos || [])].filter((f) => /^image\//.test(f.type || ""));
    if (!lista.length) return;
    setAviso(`Leyendo ${lista.length === 1 ? "una imagen" : lista.length + " imágenes"}…`);
    let puestas = 0;
    for (const archivo of lista) {
      try {
        const leida = await leerImagen(archivo);
        /* El formato del proyecto se hereda como punto de partida: casi siempre
           acierta, y una etiqueta que ya viene puesta es una que nadie tiene
           que llenar a mano trescientas veces. */
        const ficha = fichaNueva(leida, { formato: cfg?.perfil?.formato || "" });

        /* EL OJO DE LA APP (solo iPad). Mira la imagen y propone lo que ve:
           gente, tipo de plano, interior/exterior, día/noche. Solo RELLENA lo
           que venga vacío y nunca pisa nada, porque en este punto la ficha
           acaba de nacer y todo está vacío — pero la regla se escribe igual,
           que es lo que impide que mañana, al reanalizar, se lleve por delante
           lo que alguien corrigió a mano. En el Mac esto devuelve nada y la
           ficha sigue su camino. */
        const visto = await analizarImagen(leida.completa);
        if (visto) {
          const puestas = [];
          for (const campo of ["gente", "plano", "lugar", "momento"]) {
            if (!ficha[campo] && visto[campo]) { ficha[campo] = visto[campo]; puestas.push(campo); }
          }
          ficha.auto = puestas;
        }

        await guardarReferencia(ficha, leida.completa);
        puestas += 1;
      } catch (e) {
        setAviso(e?.message || "Una imagen no se pudo leer");
      }
    }
    if (puestas) {
      setAviso(`${puestas === 1 ? "Una imagen" : puestas + " imágenes"} en la fototeca`);
      recargar();
    }
    setTimeout(() => setAviso(""), 2600);
  };

  const cambiar = async (ficha) => {
    setFichas((f) => f.map((x) => (x.id === ficha.id ? ficha : x)));
    setAbierta((a) => (a && a.id === ficha.id ? ficha : a));
    try { await guardarReferencia(ficha); } catch (e) { setAviso(e.message || "No se pudo guardar"); }
  };

  const borrar = async (id) => {
    try { await borrarReferencia(id); } catch (e) { setAviso(e.message || "No se pudo quitar"); return; }
    setAbierta(null);
    setFichas((f) => f.filter((x) => x.id !== id));
    quitarDelTablero(id);
    setAviso("Se fue a la papelera; el archivo sigue ahí por si te arrepientes");
    setTimeout(() => setAviso(""), 3200);
  };

  const enTablero = (id) => tablero.includes(id);
  const quitarDelTablero = (id) =>
    setCfg?.((c) => ({ ...c, mesaDeLuz: { ...(c.mesaDeLuz || {}), tablero: (c.mesaDeLuz?.tablero || []).filter((x) => x !== id) } }));
  const alternarTablero = (id) => {
    if (!setCfg) return;
    setCfg((c) => {
      const puestas = c.mesaDeLuz?.tablero || [];
      const nueva = puestas.includes(id) ? puestas.filter((x) => x !== id) : [...puestas, id];
      return { ...c, mesaDeLuz: { ...(c.mesaDeLuz || {}), tablero: nueva } };
    });
  };

  const visibles = useMemo(() => filtrar(fichas, filtro), [fichas, filtro]);
  /* Solo los planos que de verdad tienes. Recorrer los 23 del catálogo para
     encontrar los cuatro que hay era buscar en una lista de cosas que no
     existen. Se ordenan como el catálogo, de más abierto a más cerrado, que es
     como los piensa uno. */
  const planosQueHay = useMemo(() => {
    const hay = new Set(fichas.map((f) => f.plano).filter(Boolean));
    const enOrden = PLANOS.filter((p) => hay.has(p));
    const deFuera = [...hay].filter((p) => !PLANOS.includes(p)).sort();
    return [...enOrden, ...deFuera];
  }, [fichas]);
  const delTablero = useMemo(
    () => tablero.map((id) => fichas.find((f) => f.id === id)).filter(Boolean),
    [tablero, fichas]);
  const hayFiltro = Object.values(filtro).some(Boolean);

  if (estado === "fuera") {
    return (
      <div className="scrollwrap overflow-auto px-3 py-4">
        <Box title="Mesa de luz">
          <p className="text-sm" style={{ color: "var(--tinta-media)" }}>
            La fototeca vive en el disco, junto a tus proyectos, así que solo funciona
            dentro de la app de Producción TV — no en esta vista de navegador.
          </p>
        </Box>
      </div>
    );
  }

  return (
    <div className="scrollwrap overflow-auto px-3 py-3">
      {/* Traer imágenes. Dos puertas porque en el iPad son dos gestos
          distintos: el carrete y la cámara. En el Mac la segunda no estorba. */}
      <input ref={entrada} type="file" accept="image/*" multiple hidden
        onChange={(e) => { traer(e.target.files); e.target.value = ""; }} />
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { traer(e.target.files); e.target.value = ""; }} />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-0.5" style={{ minWidth: 190 }}>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--tinta-baja)" }}>
            Buscar
          </span>
          <span className="relative flex items-center">
            <Search size={15} className="pointer-events-none absolute left-2" style={{ color: "var(--tinta-baja)" }} />
            <input className="campo-caja w-full" style={{ minHeight: 40, paddingLeft: 28, fontSize: 13 }}
              value={filtro.texto} placeholder="pasillo, contraluz, soledad…"
              onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))} />
          </span>
        </label>
        <Filtro etiqueta="Plano" valor={filtro.plano} opciones={planosQueHay}
          onChange={(v) => setFiltro((f) => ({ ...f, plano: v }))} ancho={170} />
        {editable && (
          <div className="ml-auto flex gap-1.5">
            <Btn rango={1} icono={ImagePlus} onClick={() => entrada.current?.click()} titulo="Traer imágenes del disco">
              Traer imágenes
            </Btn>
            <Btn rango={2} icono={Camera} onClick={() => camara.current?.click()} titulo="Tomar una foto ahora">
              Foto
            </Btn>
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-col gap-1.5">
        <Pastillas etiqueta="Lugar" valor={filtro.lugar} opciones={LUGARES}
          onChange={(v) => setFiltro((f) => ({ ...f, lugar: v }))} />
        <Pastillas etiqueta="Momento" valor={filtro.momento} opciones={MOMENTOS}
          onChange={(v) => setFiltro((f) => ({ ...f, momento: v }))} />
        <Pastillas etiqueta="Gente" valor={filtro.gente} opciones={GENTE}
          onChange={(v) => setFiltro((f) => ({ ...f, gente: v }))} />
      </div>

      {/* El color se elige tocando igual que los de arriba, pero con la muestra
          en vez del nombre: es la única etiqueta que se reconoce más rápido
          viéndola que leyéndola. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide"
          style={{ color: "var(--tinta-baja)", minWidth: 54 }}>Color</span>
        {FAMILIAS.map((f) => (
          <button key={f.id} type="button" title={f.nombre}
            onClick={() => setFiltro((x) => ({ ...x, familia: x.familia === f.id ? "" : f.id }))}
            aria-pressed={filtro.familia === f.id}
            style={{
              width: 30, height: 30, borderRadius: 8, cursor: "pointer", background: f.muestra,
              border: filtro.familia === f.id ? "3px solid var(--tinta)" : "1px solid var(--vidrio-borde)",
            }} />
        ))}
        {hayFiltro && (
          <button type="button" className="ml-1 rounded-lg border px-2.5"
            onClick={() => setFiltro({ texto: "", plano: "", lugar: "", momento: "", gente: "", familia: "" })}
            style={{ minHeight: 30, borderColor: "var(--vidrio-borde)", background: "transparent",
              color: "var(--tinta-media)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
            Quitar filtros
          </button>
        )}
      </div>

      {aviso && <p className="mb-2 text-xs" style={{ color: "var(--tinta-media)" }}>{aviso}</p>}

      {delTablero.length > 0 && (
        <Box title={`Tablero del proyecto — ${delTablero.length} ${delTablero.length === 1 ? "imagen" : "imágenes"}`}>
          <div className="rejilla-mesa">
            {delTablero.map((f) => (
              <Cuadro key={f.id} ficha={f} enTablero onAbrir={() => setAbierta(f)}
                onTablero={() => alternarTablero(f.id)} />
            ))}
          </div>
        </Box>
      )}

      <div style={{ height: delTablero.length ? 12 : 0 }} />

      <Box title={`Fototeca — ${visibles.length}${hayFiltro ? ` de ${fichas.length}` : ""} ${(hayFiltro ? fichas.length : visibles.length) === 1 ? "imagen" : "imágenes"}`}>
        {estado === "cargando" && <p className="text-sm" style={{ color: "var(--tinta-baja)" }}>Abriendo la fototeca…</p>}
        {estado === "error" && <p className="text-sm" style={{ color: "#B03A3A" }}>{aviso}</p>}
        {estado === "lista" && !fichas.length && (
          <p className="text-sm" style={{ color: "var(--tinta-media)" }}>
            Todavía no hay nada. Trae imágenes con <b>Traer imágenes</b> o toma una foto:
            fotogramas de películas que te sirvan, fotos de locación, cuadros de tus
            propios rodajes. Cada una se guarda con su paleta de color sacada sola.
          </p>
        )}
        {estado === "lista" && fichas.length > 0 && !visibles.length && (
          <p className="text-sm" style={{ color: "var(--tinta-media)" }}>
            Ninguna imagen cumple con todos esos filtros a la vez.
          </p>
        )}
        {visibles.length > 0 && (
          <div className="rejilla-mesa">
            {visibles.map((f) => (
              <Cuadro key={f.id} ficha={f} enTablero={enTablero(f.id)} onAbrir={() => setAbierta(f)}
                onTablero={() => alternarTablero(f.id)} />
            ))}
          </div>
        )}
      </Box>

      {abierta && (
        <FichaAbierta ficha={abierta} editable={editable} enTablero={enTablero(abierta.id)}
          onTablero={() => alternarTablero(abierta.id)}
          onCerrar={() => setAbierta(null)} onCambiar={cambiar} onBorrar={() => borrar(abierta.id)} />
      )}
    </div>
  );
}

/* ------------------- El puente con el guion técnico -------------------
   Lo que sigue es lo que ShotDeck no puede hacer, y no por falta de ganas:
   no conoce tu guion. Aquí una referencia deja de ser una foto suelta y queda
   pegada al plano 4 de la escena 2, de modo que en el storyboard se ven lado a
   lado "a esto me quiero parecer" y "esto vamos a grabar".

   El selector ofrece SOLO el tablero del proyecto, no la fototeca entera. Es a
   propósito: elegir entre trescientas imágenes plano por plano es imposible;
   la idea es que primero cures el look del proyecto —diez o quince imágenes—
   y de ahí repartas. Curar y luego asignar son dos trabajos distintos y no se
   deben hacer en la misma pantalla. */

/** Las fichas del tablero de ESTE proyecto, ya resueltas contra la fototeca. */
export function useFichasDelTablero(cfg) {
  const ids = cfg?.mesaDeLuz?.tablero || [];
  const clave = ids.join(",");
  const [fichas, setFichas] = useState([]);
  useEffect(() => {
    if (!clave) { setFichas([]); return; }
    let vivo = true;
    listarReferencias()
      .then((lista) => { if (vivo) setFichas(lista.map(normFicha).filter((f) => clave.split(",").includes(f.id))); })
      .catch(() => { if (vivo) setFichas([]); });
    return () => { vivo = false; };
  }, [clave]);
  return fichas;
}

/** Elegir cuál de las del tablero le toca a este plano. */
export function SelectorDeReferencia({ fichas, valor, onElegir, onCerrar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-3"
      style={{ background: "rgba(10,10,14,.72)" }} onClick={onCerrar}>
      <div className="w-full max-w-3xl rounded-xl border" onClick={(e) => e.stopPropagation()}
        style={{ borderColor: "var(--vidrio-borde)", background: "var(--yeso)", marginTop: 12 }}>
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--vidrio-borde)" }}>
          <strong className="flex-1 text-sm">¿A cuál se tiene que parecer este plano?</strong>
          <Btn rango={3} icono={X} onClick={onCerrar} titulo="Cerrar">Cerrar</Btn>
        </div>
        <div className="p-3">
          {!fichas.length ? (
            <p className="text-sm" style={{ color: "var(--tinta-media)" }}>
              El tablero de este proyecto está vacío. Ve a <b>Perfil ▸ Mesa de luz</b> y marca
              con la estrella ⭑ las imágenes que definen el look; aquí aparecerán para repartirlas
              plano por plano.
            </p>
          ) : (
            <div className="rejilla-mesa">
              {valor && (
                <button type="button" onClick={() => { onElegir(""); onCerrar(); }}
                  className="rounded-lg border" style={{
                    aspectRatio: "16/9", borderColor: "var(--vidrio-borde)", background: "var(--vidrio-b)",
                    color: "var(--tinta-media)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Sin referencia
                </button>
              )}
              {fichas.map((f) => (
                <button key={f.id} type="button" onClick={() => { onElegir(f.id); onCerrar(); }}
                  className="overflow-hidden rounded-lg border p-0" title={f.nota || f.plano}
                  style={{ borderColor: valor === f.id ? "var(--tinta)" : "var(--vidrio-borde)",
                    borderWidth: valor === f.id ? 3 : 1, background: "var(--vidrio-b)", cursor: "pointer" }}>
                  <img src={f.min} alt={f.nota || "Referencia"} className="block w-full"
                    style={{ aspectRatio: "16/9", objectFit: "cover" }} />
                  <Franja colores={f.colores} />
                  <span className="block truncate px-2 py-1 text-[11px]" style={{ color: "var(--tinta-media)" }}>
                    {f.plano || f.nota || "Referencia"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

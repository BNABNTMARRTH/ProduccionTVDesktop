import React, { useRef } from "react";
import { Check, Upload, X, Calendar, ArrowUp } from "lucide-react";
import { FORMATOS, ALCANCES, CONOCIMIENTOS, MEDIOS, BLOQUES, formatoSugerido, repartoVacio } from "./proyecto.js";
import { IMPACTOS } from "./narrativa.js";

import { BudgetDistributionStrategy } from "./budgetDistributionStrategy.js";
import { BoxInput, TextAreaBox, CurrencyBoxInput, RangeBoxInput } from "./BoxInput.jsx";
import { STRATEGIES } from "./inputValidationPipeline.js";

export { BudgetDistributionStrategy };

// ============================================================================
// GoF COMPOSITE PATTERN: CanvasSection (Componente Seccional Unificado)
// ============================================================================
export function CanvasSection({
  id,
  num,
  numBg = "bg-red-500/10",
  numBorder = "border-red-500/20",
  numText = "text-[#FF3B30]",
  title,
  subtitle,
  badge,
  children,
}) {
  return (
    <section className="p-6 sm:p-9 space-y-6" id={id} data-purpose={`section-${num}`}>
      {/* Encabezado Apple HIG de sección */}
      <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center space-x-3.5">
          <div
            className={`w-8 h-8 rounded-xl ${numBg} border ${numBorder} flex items-center justify-center ${numText} font-bold text-xs shadow-xs select-none`}
          >
            {num}
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] uppercase">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#86868B] dark:text-[#A1A1A6] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {badge && (
          <span className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg border border-black/[0.05] dark:border-white/[0.08] select-none">
            {badge}
          </span>
        )}
      </div>

      {children}
    </section>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL: LienzoPerfilContinuous
// ============================================================================
export function LienzoPerfilContinuous({
  cfg,
  setCfg,
  up,
  upPerfil,
  upNarr,
  importLogo,
}) {
  const perfil = cfg.perfil || {};
  const logoInputRef = useRef(null);

  // Cálculo de distribución mediante BudgetDistributionStrategy
  const distribucion = BudgetDistributionStrategy.calculate(perfil);

  // Manejo de canales de difusión (multi-select)
  const toggleMedio = (medio) => {
    const actuales = Array.isArray(perfil.medios) ? [...perfil.medios] : [];
    const idx = actuales.indexOf(medio);
    if (idx >= 0) {
      actuales.splice(idx, 1);
    } else {
      actuales.push(medio);
    }
    upPerfil({ medios: actuales });
  };

  // Manejo de intención emocional (multi-select)
  const toggleIntencion = (intencion) => {
    const actuales = Array.isArray(perfil.intencion) ? [...perfil.intencion] : [];
    const idx = actuales.indexOf(intencion);
    if (idx >= 0) {
      actuales.splice(idx, 1);
    } else {
      actuales.push(intencion);
    }
    upPerfil({ intencion: actuales });
  };

  // Manejo de porcentaje en reparto (validado con GoF NumericStrategy)
  const setRepartoPct = (bloqueId, val) => {
    const raw = STRATEGIES["numero"].filter(String(val));
    const num = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
    const anterior = { ...repartoVacio(), ...(perfil.reparto || {}) };
    upPerfil({
      reparto: {
        ...anterior,
        [bloqueId]: num,
      },
    });
  };

  // Medida visual proporcional para las tarjetas de Aspect Ratio
  const CAJA_MAX_W = 44, CAJA_MAX_H = 36;
  const calcularMedidaRatio = (f) => {
    const r = f.w / f.h;
    const w = Math.min(CAJA_MAX_W, CAJA_MAX_H * r);
    return { width: Math.round(w), height: Math.round(w / r) };
  };

  const formatoActual = perfil.formato || "16:9";
  const sugerido = formatoSugerido(perfil.medios);

  // Scroll suave al inicio
  const scrollToTop = () => {
    const el = document.getElementById("sec-identidad");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Restablecer valores predeterminados seguros con confirmación
  const handleReset = () => {
    if (window.confirm("¿Deseas restablecer los campos de este perfil a sus valores sugeridos?")) {
      up({
        titulo: "DEMO – CONOCE PRODUCCIÓN TV",
        subtitulo: "Cada sección de este proyecto explica cómo se usa · bórralo cuando quieras",
        organizacion: "FCC · UASLP",
      });
      upPerfil({
        genero: "Documental",
        formato: "16:9",
        emisor: "FCC-UASLP, taller de documental",
        receptor: "Estudiantes de la facultad",
        edad: "18 a 25",
        alcance: "Local",
        conocimiento: CONOCIMIENTOS[0],
        medios: ["YouTube", "Streaming"],
        mensaje: "Aprender las fases de producción televisiva transforma una idea abstracta en un mensaje audiovisual con impacto real y profesional.",
        tono: "Dinámico, pedagógico y motivacional",
        referencias: "Apple Keynotes, Vox Earworm, BBC Studios",
        intencion: ["Emocionar", "Generar reflexión"],
        presupuesto: "180000",
        presupuestoNota: "Fondo institucional de apoyo a la docencia UASLP + Patrocinio en especie de equipo",
        reparto: repartoVacio(),
      });
      if (upNarr) {
        upNarr({
          logline: "Un grupo de estudiantes principiantes asume el reto de realizar su primera transmisión en directo contra reloj, descubriendo el valor de la planeación técnica.",
          cta: "Inscribirse al taller y descargar guía",
        });
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20 select-text font-sans">
      {/* ================================================================== */}
      {/* MASTER CONTINUOUS CANVAS (APPLE HIG GROUPED SINGLE SURFACE)        */}
      {/* ================================================================== */}
      <div className="bg-white/95 dark:bg-[#1E2024]/95 backdrop-blur-xl rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)] divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden transition-colors">
        
        {/* ========================================== */}
        {/* SECCIÓN 01: IDENTIDAD VISUAL Y TÉCNICA   */}
        {/* ========================================== */}
        <CanvasSection
          id="sec-identidad"
          num="01"
          numBg="bg-red-500/10 dark:bg-red-500/20"
          numBorder="border-red-500/20 dark:border-red-500/30"
          numText="text-[#FF3B30] dark:text-[#FF453A]"
          title="Identidad Visual y Técnica"
          subtitle="Parámetros esenciales de producción y formato de captura"
          badge="Ficha Base"
        >
          {/* Título & Subtítulo */}
          <div className="space-y-4">
            <BoxInput
              id="titulo-principal"
              label="Título Principal"
              tipo="titulo"
              value={cfg.titulo || ""}
              placeholder="Título del proyecto o programa"
              onChange={(val) => up({ titulo: val })}
              inputClassName="text-lg sm:text-xl font-bold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]"
            />
            <BoxInput
              id="subtitulo-proyecto"
              label="Subtítulo / Bajada"
              tipo="titulo"
              value={cfg.subtitulo || ""}
              placeholder="Breve explicación o contexto del proyecto"
              onChange={(val) => up({ subtitulo: val })}
              inputClassName="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200"
            />
          </div>

          {/* Fila de Metadatos (4 columnas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BoxInput
              id="organizacion"
              label="Organización"
              tipo="titulo"
              value={cfg.organizacion || ""}
              placeholder="Facultad, productora o canal"
              onChange={(val) => up({ organizacion: val })}
              inputClassName="font-semibold"
            />
            <BoxInput
              id="genero"
              label="Género"
              tipo="texto"
              value={perfil.genero || ""}
              placeholder="Comercial, documental, noticiero…"
              onChange={(val) => upPerfil({ genero: val })}
              suggestions={["Ficción", "Documental", "Comercial de producto", "Videoclip", "Reportaje", "Institucional", "Programa en vivo", "Noticiero", "Mesa de debate"]}
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5" htmlFor="fecha-entrega">
                Fecha de Entrega
              </label>
              <div className="relative">
                <input
                  id="fecha-entrega"
                  type="date"
                  className="w-full text-xs font-semibold text-slate-800 dark:text-slate-100 border border-black/[0.08] dark:border-white/[0.12] rounded-xl pl-3.5 pr-8 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] focus:bg-white dark:focus:bg-[#2C2C2E] focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 transition-all outline-none font-mono"
                  value={perfil.entrega || ""}
                  onChange={(e) => upPerfil({ entrega: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Color de Marca
              </label>
              <div className="flex items-center space-x-2.5 border border-black/[0.08] dark:border-white/[0.12] rounded-xl px-3 py-1.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] focus-within:bg-white dark:focus-within:bg-[#2C2C2E] focus-within:border-[#0071E3] focus-within:ring-4 focus-within:ring-[#0071E3]/15 transition-all">
                <input
                  type="color"
                  className="w-6 h-6 rounded-full border-0 p-0 cursor-pointer shrink-0 bg-transparent"
                  value={cfg.branding?.primaryColor || "#16365F"}
                  onChange={(e) =>
                    setCfg((c) => ({
                      ...c,
                      branding: { ...(c.branding || {}), primaryColor: e.target.value },
                    }))
                  }
                  title="Seleccionar color de marca"
                />
                <input
                  type="text"
                  className="w-full text-xs font-mono font-medium border-0 p-0 focus:ring-0 bg-transparent text-slate-700 dark:text-slate-200 outline-none uppercase"
                  value={cfg.branding?.primaryColor || "#16365F"}
                  onChange={(e) => {
                    const filtered = STRATEGIES["hex"].filter(e.target.value);
                    setCfg((c) => ({
                      ...c,
                      branding: { ...(c.branding || {}), primaryColor: filtered },
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Logotipo y Selector de Aspect Ratio */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
            {/* Minimal Drop Area de Logotipo */}
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Logotipo Oficial
              </label>
              {cfg.branding?.logoDataUrl ? (
                <div className="w-full h-24 border border-black/[0.1] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] rounded-xl flex items-center justify-between p-3.5 relative group">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-14 h-14 rounded-lg bg-white dark:bg-black/40 border border-black/[0.08] dark:border-white/[0.1] flex items-center justify-center p-1 overflow-hidden shrink-0">
                      <img src={cfg.branding.logoDataUrl} alt="Logo de marca" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">Logo cargado</span>
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="text-[11px] text-[#0071E3] hover:underline font-semibold mt-0.5 block text-left"
                      >
                        Cambiar archivo
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCfg((c) => ({
                        ...c,
                        branding: { ...(c.branding || {}), logoDataUrl: "" },
                      }))
                    }
                    className="w-7 h-7 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-red-500 flex items-center justify-center transition"
                    title="Quitar logotipo"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full h-24 border border-dashed border-black/20 dark:border-white/20 hover:border-[#0071E3] hover:bg-[#0071E3]/5 dark:hover:bg-[#0071E3]/10 rounded-xl flex flex-col items-center justify-center p-3 transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-black/[0.03] dark:bg-white/[0.06] flex items-center justify-center mb-1 group-hover:bg-[#0071E3]/10 transition-colors">
                    <Upload size={16} className="text-slate-500 dark:text-slate-400 group-hover:text-[#0071E3] transition-colors" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-[#0071E3] transition-colors">
                    Subir archivo de marca
                  </span>
                  <span className="text-[10px] text-[#86868B] dark:text-[#A1A1A6]">PNG, SVG, WebP o JPG</span>
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => importLogo && importLogo(e.target.files?.[0])}
              />
            </div>

            {/* Aspect Ratio Grid */}
            <div className="lg:col-span-8">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Formato de Cuadro (Aspect Ratio)
                </label>
                <span className="text-[11px] font-semibold text-[#0071E3] dark:text-[#5AC8FA] bg-[#0071E3]/10 dark:bg-[#0071E3]/20 px-2.5 py-0.5 rounded-full border border-[#0071E3]/15">
                  {formatoActual === "16:9"
                    ? "Estándar: 16:9 (DCI / Streaming)"
                    : `Formato activo: ${formatoActual}${sugerido && sugerido !== formatoActual ? ` · Sugerido: ${sugerido}` : ""}`}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {FORMATOS.map((f) => {
                  const isActive = formatoActual === f.id;
                  const dimension = calcularMedidaRatio(f);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => upPerfil({ formato: f.id })}
                      title={`${f.nombre} — ${f.para}`}
                      className={`h-24 rounded-xl p-2.5 flex flex-col items-center justify-between transition-all group cursor-pointer relative ${
                        isActive
                          ? "border-2 border-[#0071E3] bg-[#0071E3]/5 dark:bg-[#0071E3]/15 shadow-xs ring-2 ring-[#0071E3]/15"
                          : "border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.015] dark:bg-white/[0.03] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] hover:border-black/20"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0071E3]" />
                      )}
                      <div className="flex-1 flex items-center justify-center w-full">
                        <div
                          className={`rounded-[2px] transition shadow-2xs flex items-center justify-center ${
                            isActive
                              ? "bg-[#0071E3] text-white"
                              : "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-[#0071E3]"
                          }`}
                          style={dimension}
                        >
                          {isActive && f.id === "16:9" && (
                            <span className="text-[7.5px] font-mono font-bold tracking-tight text-white">HD</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] ${
                          isActive
                            ? "font-bold text-[#0071E3] dark:text-[#5AC8FA]"
                            : "font-medium text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {f.nombre}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CanvasSection>

        {/* ========================================== */}
        {/* SECCIÓN 02: EL ENCARGO & AUDIENCIA       */}
        {/* ========================================== */}
        <CanvasSection
          id="sec-encargo"
          num="02"
          numBg="bg-blue-500/10 dark:bg-blue-500/20"
          numBorder="border-blue-500/20 dark:border-blue-500/30"
          numText="text-[#0071E3] dark:text-[#5AC8FA]"
          title="El Encargo & Audiencia Objetivo"
          subtitle="Definición del público y ecosistema de exhibición"
          badge="Target & Canales"
        >
          {/* Emisor y Receptor en Grid Dual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BoxInput
              id="emisor-input"
              label="Emisor — Quién Produce"
              tipo="texto"
              value={perfil.emisor || ""}
              placeholder="Facultad, agencia o productora"
              onChange={(val) => upPerfil({ emisor: val })}
              suggestions={[
                "FCC-UASLP",
                "Facultad de Ciencias de la Comunicación",
                "Productora Audiovisual Universitaria",
                "Laboratorio de TV y Medios",
                "Colectivo Independiente",
              ]}
              className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]"
              inputClassName="font-semibold bg-white dark:bg-[#2C2C2E]"
            />
            <BoxInput
              id="receptor-input"
              label="Receptor — A Quién Le Hablas"
              tipo="texto"
              value={perfil.receptor || ""}
              placeholder="Tipo de audiencia o perfil específico"
              onChange={(val) => upPerfil({ receptor: val })}
              suggestions={[
                "Estudiantes universitarios",
                "Público general",
                "Profesionales del sector",
                "Comunidad académica",
                "Jóvenes y adolescentes",
                "Familias y audiencia general",
              ]}
              className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]"
              inputClassName="font-semibold bg-white dark:bg-[#2C2C2E]"
            />
          </div>

          {/* Filtros Demográficos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <RangeBoxInput
              id="edad-input"
              label="Rango de Edad"
              value={perfil.edad || ""}
              onChange={(val) => upPerfil({ edad: val })}
              unit="años"
              minPlaceholder="18"
              maxPlaceholder="25"
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5" htmlFor="alcance-select">
                Alcance Geográfico
              </label>
              <select
                id="alcance-select"
                className="w-full text-xs font-medium text-slate-800 dark:text-slate-100 border border-black/[0.08] dark:border-white/[0.12] rounded-xl px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] focus:bg-white dark:focus:bg-[#2C2C2E] focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 transition-all outline-none cursor-pointer"
                value={perfil.alcance || ""}
                onChange={(e) => upPerfil({ alcance: e.target.value })}
              >
                <option value="">Sin definir</option>
                {ALCANCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5" htmlFor="conocimiento-select">
                Nivel de Conocimiento Previo
              </label>
              <select
                id="conocimiento-select"
                className="w-full text-xs font-medium text-slate-800 dark:text-slate-100 border border-black/[0.08] dark:border-white/[0.12] rounded-xl px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] focus:bg-white dark:focus:bg-[#2C2C2E] focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 transition-all outline-none cursor-pointer"
                value={perfil.conocimiento || ""}
                onChange={(e) => upPerfil({ conocimiento: e.target.value })}
              >
                <option value="">Sin definir</option>
                {CONOCIMIENTOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Canales de Difusión - Apple Tag Pills */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Canales de Difusión
              </label>
              <span className="text-[11px] text-[#86868B] dark:text-[#A1A1A6]">
                Define duración de bloques y encuadre primario
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {MEDIOS.map((medio) => {
                const isSelected = Array.isArray(perfil.medios) && perfil.medios.includes(medio);
                return (
                  <button
                    key={medio}
                    type="button"
                    onClick={() => toggleMedio(medio)}
                    className={`px-3.5 py-1.5 rounded-full text-xs transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? "border border-blue-500/30 bg-blue-500/10 text-[#0071E3] dark:text-[#5AC8FA] font-semibold ring-1 ring-blue-500/20"
                        : "border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 font-medium hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                    }`}
                  >
                    {isSelected && <Check size={13} className="text-[#0071E3] dark:text-[#5AC8FA] stroke-[2.5]" />}
                    <span>{medio}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CanvasSection>

        {/* ========================================== */}
        {/* SECCIÓN 03: LA IDEA & NARRATIVA          */}
        {/* ========================================== */}
        <CanvasSection
          id="sec-idea"
          num="03"
          numBg="bg-purple-500/10 dark:bg-purple-500/20"
          numBorder="border-purple-500/20 dark:border-purple-500/30"
          numText="text-[#AF52DE] dark:text-[#BF5AF2]"
          title="La Idea & Narrativa Audiovisual"
          subtitle="Premisa dramática, logline e intención emocional"
          badge="Story & Concepto"
        >
          {/* Bloques Apple Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 rounded-2xl bg-amber-500/[0.04] dark:bg-amber-500/[0.08] border border-amber-500/20 dark:border-amber-500/30">
              <TextAreaBox
                id="mensaje-clave"
                label="Mensaje — La Idea en una Frase"
                rows={3}
                placeholder="Lo que quieres que se lleve en mente y corazón quien lo vea..."
                value={perfil.mensaje || ""}
                onChange={(val) => upPerfil({ mensaje: val })}
              />
            </div>
            <div className="p-4 rounded-2xl bg-blue-500/[0.04] dark:bg-blue-500/[0.08] border border-blue-500/20 dark:border-blue-500/30">
              <TextAreaBox
                id="logline-input"
                label="Logline — La Historia en una Frase"
                rows={3}
                placeholder="Un protagonista quiere lograr un objetivo frente a un obstáculo..."
                value={cfg.narrativa?.logline || ""}
                onChange={(val) => upNarr && upNarr({ logline: val })}
              />
            </div>
          </div>

          {/* CTA, Tono y Referencias */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <BoxInput
              id="llamada-accion"
              label="Llamada a la Acción (CTA)"
              tipo="titulo"
              value={cfg.narrativa?.cta || ""}
              placeholder="Qué debe hacer el espectador al final"
              onChange={(val) => upNarr && upNarr({ cta: val })}
            />
            <BoxInput
              id="tono-input"
              label="Tono Narrativo"
              tipo="texto"
              value={perfil.tono || ""}
              placeholder="Dinámico, pedagógico, solemne…"
              onChange={(val) => upPerfil({ tono: val })}
              suggestions={["Dinámico y pedagógico", "Solemne e informativo", "Dramático e intimista", "Humorístico y fresco", "Motivacional y épico"]}
            />
            <BoxInput
              id="referencias-input"
              label="Referencias Visuales"
              tipo="titulo"
              value={perfil.referencias || ""}
              placeholder="Películas, canales de YouTube, comerciales"
              onChange={(val) => upPerfil({ referencias: val })}
            />
          </div>

          {/* Intención emocional */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              Intención Emocional Primaria
            </label>
            <div className="flex flex-wrap gap-2">
              {IMPACTOS.map((impacto) => {
                const isSelected = Array.isArray(perfil.intencion) && perfil.intencion.includes(impacto);
                return (
                  <button
                    key={impacto}
                    type="button"
                    onClick={() => toggleIntencion(impacto)}
                    className={`px-3.5 py-1.5 rounded-full text-xs transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? "border border-red-500/30 bg-red-500/10 text-[#FF3B30] dark:text-[#FF453A] font-semibold ring-1 ring-red-500/20"
                        : "border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 font-medium hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                    }`}
                  >
                    {isSelected && <Check size={13} className="text-[#FF3B30] dark:text-[#FF453A] stroke-[2.5]" />}
                    <span>{impacto}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CanvasSection>

        {/* ========================================== */}
        {/* SECCIÓN 04: RECURSOS & PRESUPUESTO       */}
        {/* ========================================== */}
        <CanvasSection
          id="sec-recursos"
          num="04"
          numBg="bg-orange-500/10 dark:bg-orange-500/20"
          numBorder="border-orange-500/20 dark:border-orange-500/30"
          numText="text-[#FF9500] dark:text-[#FF9F0A]"
          title="Recursos & Presupuesto de Producción"
          subtitle="Estimación financiera global y desglose técnico de rodaje"
          badge="Financiamiento & Desglose"
        >
          {/* Presupuesto General */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
            <CurrencyBoxInput
              id="presupuesto-total"
              label="Presupuesto Total Estimado"
              value={perfil.presupuesto || ""}
              currency={perfil.divisa || "MXN"}
              onValueChange={(val) => upPerfil({ presupuesto: val })}
              onCurrencyChange={(cur) => upPerfil({ divisa: cur })}
              placeholder="0"
              className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]"
            />
            <div className="sm:col-span-2">
              <BoxInput
                id="origen-fondos"
                label="¿De Dónde Sale el Dinero? (Fuente de Financiamiento)"
                tipo="titulo"
                value={perfil.presupuestoNota || ""}
                placeholder="Fondo institucional, beca, recursos propios, patrocinio…"
                onChange={(val) => upPerfil({ presupuestoNota: val })}
                className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]"
                inputClassName="font-semibold text-[#0071E3] dark:text-[#5AC8FA] bg-[#0071E3]/[0.03] dark:bg-[#0071E3]/[0.08] border-[#0071E3]/25 dark:border-[#0071E3]/35"
              />
            </div>
          </div>

          {/* Balance Track Multi-segmento */}
          <div className="p-5 sm:p-6 rounded-2xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] uppercase tracking-wide">
                  Distribución Pro del Presupuesto
                </h3>
                <p className="text-[11px] text-[#86868B] dark:text-[#A1A1A6] mt-0.5">
                  Estándar industrial cinematográfico y televisivo internacional
                </p>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-[#86868B] dark:text-[#A1A1A6] font-medium">Asignado:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                    distribucion.esBalanceado
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  }`}
                >
                  {distribucion.sumaPct}%
                </span>
              </div>
            </div>

            {/* Barra segmentada */}
            <div className="h-3.5 w-full bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden flex p-0.5 gap-0.5 shadow-inner">
              {distribucion.filas.map((f, i) => (
                <div
                  key={f.id}
                  className={`h-full transition-all duration-300 ${
                    i === 0 ? "rounded-l-full" : i === distribucion.filas.length - 1 ? "rounded-r-full" : ""
                  }`}
                  style={{
                    width: `${Math.max(f.pct, 0)}%`,
                    backgroundColor: f.color,
                  }}
                  title={`${f.nombre}: ${f.pct}%`}
                />
              ))}
            </div>

            {/* Filas interactivas de desglose */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {distribucion.filas.map((f) => (
                <div
                  key={f.id}
                  className={`p-3.5 rounded-xl border bg-white dark:bg-[#2C2C2E] flex items-center justify-between shadow-2xs hover:shadow-xs transition ${
                    f.fueraDeRango
                      ? "border-amber-500/40 dark:border-amber-500/50"
                      : "border-black/[0.06] dark:border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full mt-0.5 shrink-0 ring-2"
                      style={{
                        backgroundColor: f.color,
                        ringColor: `${f.color}33`,
                      }}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] block truncate">
                        {f.nombre}
                      </span>
                      <span className="text-[10.5px] text-[#86868B] dark:text-[#A1A1A6] block truncate">
                        {f.detalle}
                      </span>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          Rango recomendado: {f.min}% – {f.max}%
                        </span>
                        {f.monto > 0 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
                            · {perfil.divisa || "MXN"} ${f.monto.toLocaleString("es-MX")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0 ml-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={f.pct}
                      onChange={(e) => setRepartoPct(f.id, e.target.value)}
                      className="w-14 text-center text-xs font-bold font-mono border border-black/[0.08] dark:border-white/[0.12] rounded-lg py-1 bg-black/[0.02] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-[#F5F5F7] focus:bg-white dark:focus:bg-[#1E2024] focus:border-[#0071E3] outline-none"
                    />
                    <span className="text-xs text-slate-400 font-medium font-mono">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CanvasSection>
      </div>

      {/* ================================================================== */}
      {/* MASTER DOCUMENT END STATUS & ACTIONS BANNER                        */}
      {/* ================================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 px-6 rounded-2xl bg-white/80 dark:bg-[#1E2024]/80 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] text-xs text-[#86868B] dark:text-[#A1A1A6] shadow-xs gap-3">
        <div className="flex items-center space-x-2">
          <Check size={16} className="text-[#34C759] shrink-0 stroke-[2.5]" />
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Todos los parámetros están validados por el motor de producción TV
          </span>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.12] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 font-medium transition active:scale-95 cursor-pointer"
          >
            Restablecer módulo
          </button>
          <button
            type="button"
            onClick={scrollToTop}
            className="px-4 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold transition flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            <span>Subir al inicio</span>
            <ArrowUp size={14} className="stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}

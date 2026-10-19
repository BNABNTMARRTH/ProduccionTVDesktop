import React, { useState, useEffect, useId } from "react";
import {
    STRATEGIES,
    globalInputPipeline,
    RangeAdapter,
    globalCurrencyConverter,
} from "./inputValidationPipeline.js";

/**
 * GoF Composite Pattern: BoxInput universal gobernado por su tipo de valor admitido.
 * Soporta reglas: "texto", "titulo", "oracion", "numero", "decimal", "hex".
 */
export function BoxInput({
    id,
    label,
    tipo = "titulo",
    value = "",
    onChange,
    placeholder = "",
    suggestions = [],
    className = "",
    inputClassName = "",
    disabled = false,
    min,
    max,
    capitalize,
    ...resto
}) {
    const generatedId = useId();
    const inputId = id || generatedId;
    const datalistId = suggestions.length > 0 ? `${inputId}-datalist` : undefined;

    const handleChange = (e) => {
        const raw = e.target.value;
        const strategy = STRATEGIES[tipo] || STRATEGIES["titulo"];
        let filtered = strategy.filter(raw);

        // Si es número acotado
        if (tipo === "numero" || tipo === "numerico") {
            if (min !== undefined && filtered !== "") {
                const n = parseInt(filtered, 10);
                if (!isNaN(n) && n < min) filtered = String(min);
            }
            if (max !== undefined && filtered !== "") {
                const n = parseInt(filtered, 10);
                if (!isNaN(n) && n > max) filtered = String(max);
            }
        }

        if (onChange) {
            onChange(filtered);
        }
    };

    const handleBlur = (e) => {
        const processed = globalInputPipeline.process(e.target.value.trim(), {
            tipo,
            rule: tipo,
            capitalize: capitalize || (tipo === "oracion" ? "sentence" : "none"),
        });
        if (processed !== value && onChange) {
            onChange(processed);
        }
    };

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                >
                    {label}
                </label>
            )}
            <input
                id={inputId}
                type="text"
                list={datalistId}
                disabled={disabled}
                value={value}
                placeholder={placeholder}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full text-xs font-medium text-slate-800 dark:text-slate-100 border border-black/[0.08] dark:border-white/[0.12] rounded-xl px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] focus:bg-white dark:focus:bg-[#2C2C2E] focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 transition-all outline-none ${inputClassName}`}
                {...resto}
            />
            {suggestions.length > 0 && (
                <datalist id={datalistId}>
                    {suggestions.map((s, idx) => (
                        <option key={idx} value={s} />
                    ))}
                </datalist>
            )}
        </div>
    );
}

/**
 * GoF Composite Pattern: TextAreaBox para narrativas y oraciones creativas.
 * Aplica regla 'oracion' y capitalización automática de oraciones.
 */
export function TextAreaBox({
    id,
    label,
    value = "",
    onChange,
    placeholder = "",
    rows = 3,
    className = "",
    textareaClassName = "",
    disabled = false,
    ...resto
}) {
    const generatedId = useId();
    const areaId = id || generatedId;

    const handleChange = (e) => {
        const raw = e.target.value;
        const strategy = STRATEGIES["oracion"];
        const filtered = strategy.filter(raw);
        if (onChange) {
            onChange(filtered);
        }
    };

    const handleBlur = (e) => {
        const processed = globalInputPipeline.process(e.target.value.trim(), {
            rule: "oracion",
            capitalize: "sentence",
        });
        if (processed !== value && onChange) {
            onChange(processed);
        }
    };

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label
                    htmlFor={areaId}
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                >
                    {label}
                </label>
            )}
            <textarea
                id={areaId}
                rows={rows}
                disabled={disabled}
                value={value}
                placeholder={placeholder}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full text-xs text-slate-800 dark:text-slate-100 border border-black/[0.08] dark:border-white/[0.12] rounded-xl p-3 bg-white dark:bg-[#2C2C2E] focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 transition-all outline-none leading-relaxed ${textareaClassName}`}
                {...resto}
            />
        </div>
    );
}

/**
 * GoF Composite & Strategy Pattern: CurrencyBoxInput multidivisa (MXN, USD, EUR)
 * Integra input numérico formateado y selector de divisa con recálculo automático.
 */
export function CurrencyBoxInput({
    id,
    label,
    value = "",
    currency = "MXN",
    onValueChange,
    onCurrencyChange,
    placeholder = "0",
    className = "",
    disabled = false,
}) {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [isFocused, setIsFocused] = useState(false);

    const currencies = [
        { code: "MXN", label: "MXN ($)" },
        { code: "USD", label: "USD ($)" },
        { code: "EUR", label: "EUR (€)" },
    ];

    // Manejar cambio de divisa con conversión automática instantánea
    const handleCurrencySelect = (e) => {
        const nextCurrency = e.target.value;
        if (nextCurrency !== currency) {
            const rawAmount = globalCurrencyConverter.parseRaw(value);
            if (rawAmount && rawAmount !== "0") {
                const converted = globalCurrencyConverter.convert(rawAmount, currency, nextCurrency);
                if (onValueChange) {
                    onValueChange(String(converted));
                }
            }
            if (onCurrencyChange) {
                onCurrencyChange(nextCurrency);
            }
        }
    };

    // Manejar entrada de texto numérico
    const handleInputChange = (e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        const parts = raw.split(".");
        const cleaned = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
        if (onValueChange) {
            onValueChange(cleaned);
        }
    };

    // Al perder foco, aseguramos que el valor base esté guardado limpio
    const handleBlur = () => {
        setIsFocused(false);
        const raw = globalCurrencyConverter.parseRaw(value);
        if (onValueChange && raw !== value) {
            onValueChange(raw);
        }
    };

    // Texto a mostrar: en foco muestra valor crudo editable; fuera de foco muestra separadores de miles
    const displayValue = isFocused
        ? value
        : value
        ? Number(value).toLocaleString("es-MX", { maximumFractionDigits: 2 })
        : "";

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                >
                    {label}
                </label>
            )}
            <div className="flex items-center border border-black/[0.08] dark:border-white/[0.12] rounded-xl bg-white dark:bg-[#2C2C2E] hover:border-slate-300 dark:hover:border-slate-500 focus-within:border-[#0071E3] focus-within:ring-4 focus-within:ring-[#0071E3]/15 transition-all overflow-hidden shadow-2xs">
                {/* Selector de moneda */}
                <select
                    value={currency}
                    onChange={handleCurrencySelect}
                    disabled={disabled}
                    className="bg-black/[0.03] dark:bg-white/[0.06] text-xs font-bold font-mono text-[#0071E3] dark:text-[#5AC8FA] px-2.5 py-2.5 border-r border-black/[0.08] dark:border-white/[0.12] outline-none cursor-pointer hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition-colors select-none"
                    title="Cambiar divisa (convierte automáticamente el valor)"
                >
                    {currencies.map((c) => (
                        <option key={c.code} value={c.code} className="bg-white dark:bg-[#1E2024] text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {c.label}
                        </option>
                    ))}
                </select>

                {/* Caja de entrada de importe */}
                <input
                    id={inputId}
                    type="text"
                    inputMode="decimal"
                    disabled={disabled}
                    value={displayValue}
                    placeholder={placeholder}
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleBlur}
                    onChange={handleInputChange}
                    className="w-full text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] px-3 py-2.5 bg-transparent border-0 outline-none font-mono placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
            </div>
        </div>
    );
}

/**
 * GoF Composite & Adapter Pattern: RangeBoxInput
 * Control dual integrado (Desde [Min] — Hasta [Max] [Unidad]) coordinado con RangeAdapter.
 */
export function RangeBoxInput({
    id,
    label,
    value = "",
    onChange,
    unit = "años",
    minPlaceholder = "18",
    maxPlaceholder = "25",
    className = "",
    disabled = false,
}) {
    const generatedId = useId();
    const rangeId = id || generatedId;

    // Deserializar valor actual usando RangeAdapter
    const { min: currentMin, max: currentMax } = RangeAdapter.parseRange(value);

    const handleMinChange = (e) => {
        const rawMin = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
        const formatted = RangeAdapter.formatRange(rawMin, currentMax, unit);
        if (onChange) {
            onChange(formatted);
        }
    };

    const handleMaxChange = (e) => {
        const rawMax = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
        const formatted = RangeAdapter.formatRange(currentMin, rawMax, unit);
        if (onChange) {
            onChange(formatted);
        }
    };

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label
                    htmlFor={`${rangeId}-min`}
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                >
                    {label}
                </label>
            )}
            <div className="flex items-center space-x-2 border border-black/[0.08] dark:border-white/[0.12] rounded-xl px-3 py-1.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] focus-within:bg-white dark:focus-within:bg-[#2C2C2E] focus-within:border-[#0071E3] focus-within:ring-4 focus-within:ring-[#0071E3]/15 transition-all">
                <input
                    id={`${rangeId}-min`}
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    disabled={disabled}
                    value={currentMin}
                    placeholder={minPlaceholder}
                    onChange={handleMinChange}
                    className="w-12 text-center text-xs font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-0 outline-none p-1 font-mono"
                    aria-label="Edad mínima"
                />
                <span className="text-slate-400 font-bold select-none text-xs">—</span>
                <input
                    id={`${rangeId}-max`}
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    disabled={disabled}
                    value={currentMax}
                    placeholder={maxPlaceholder}
                    onChange={handleMaxChange}
                    className="w-12 text-center text-xs font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-0 outline-none p-1 font-mono"
                    aria-label="Edad máxima"
                />
                {unit && (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 select-none pl-1">
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
}

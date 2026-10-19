/**
 * @file inputValidationPipeline.js
 * @description Implementación de Patrones GoF para validación y gobierno de BoxInputs:
 * 1. STRATEGY (GoF): Familias de algoritmos intercambiables de validación por tipo de valor admitido.
 * 2. CHAIN OF RESPONSIBILITY (GoF): Pipeline secuencial (Filtro en caliente -> Autocorrección y normalización).
 * 3. ADAPTER (GoF): Adaptación bidireccional entre rangos numéricos y cadenas de texto.
 * 4. STRATEGY (GoF - Multidivisa): Conversor de divisas entre MXN, USD y EUR.
 */

// ==========================================
// 1. STRATEGY PATTERN: Reglas de Caracteres
// ==========================================

export class TextOnlyStrategy {
    /**
     * Solo permite letras (con acentos/ñ), espacios y signos gramaticales básicos.
     * BLOQUEA TERMINANTEMENTE números (0-9).
     */
    filter(rawText) {
        if (!rawText) return "";
        return rawText.replace(/[0-9]/g, "");
    }

    isValid(text) {
        return !/[0-9]/.test(text);
    }
}

export class TitleTextStrategy {
    /**
     * Permite letras, números, espacios, guiones y signos seguros.
     * Bloquea caracteres no válidos para nombres de archivos y SO (/ \ : * ? " < > |).
     */
    filter(rawText) {
        if (!rawText) return "";
        return rawText.replace(/[/\\:*?"<>|]/g, "");
    }

    isValid(text) {
        return !/[/\\:*?"<>|]/.test(text);
    }
}

export class SentenceTextStrategy {
    /**
     * Permite texto narrativo libre para oraciones.
     * Filtra caracteres de control invisibles o no válidos.
     */
    filter(rawText) {
        if (!rawText) return "";
        return rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    }

    isValid(text) {
        return !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text);
    }
}

export class NumericStrategy {
    /**
     * Solo permite dígitos enteros (0-9).
     */
    filter(rawText) {
        if (!rawText) return "";
        return rawText.replace(/[^\d]/g, "");
    }

    isValid(text) {
        return /^\d*$/.test(text);
    }
}

export class DecimalStrategy {
    /**
     * Permite dígitos y máximo un punto decimal.
     */
    filter(rawText) {
        if (!rawText) return "";
        let cleaned = rawText.replace(/[^\d.]/g, "");
        const parts = cleaned.split(".");
        if (parts.length > 2) {
            cleaned = parts[0] + "." + parts.slice(1).join("");
        }
        return cleaned;
    }

    isValid(text) {
        return /^\d*(\.\d*)?$/.test(text);
    }
}

export class RangeAgeStrategy {
    /**
     * Permite números, espacios, guiones y caracteres de edad (+, -, a, años).
     */
    filter(rawText) {
        if (!rawText) return "";
        return rawText.replace(/[^0-9\s\-+a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "");
    }

    isValid(text) {
        return /^[\d\s\-+a-zA-ZáéíóúÁÉÍÓÚñÑ]*$/.test(text);
    }
}

export class HexColorStrategy {
    /**
     * Permite código hexadecimal de color (# y 0-9A-Fa-f).
     */
    filter(rawText) {
        if (!rawText) return "";
        let cleaned = rawText.replace(/[^0-9A-Fa-f#]/g, "");
        if (cleaned.length > 0 && !cleaned.startsWith("#")) {
            cleaned = "#" + cleaned.replace(/#/g, "");
        } else if (cleaned.length > 1) {
            cleaned = "#" + cleaned.slice(1).replace(/#/g, "");
        }
        return cleaned.slice(0, 7).toUpperCase();
    }

    isValid(text) {
        return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(text);
    }
}

// Diccionario de estrategias por clave
export const STRATEGIES = {
    texto: new TextOnlyStrategy(),
    text: new TextOnlyStrategy(),
    "solo-texto": new TextOnlyStrategy(),
    titulo: new TitleTextStrategy(),
    title: new TitleTextStrategy(),
    oracion: new SentenceTextStrategy(),
    sentence: new SentenceTextStrategy(),
    numero: new NumericStrategy(),
    numerico: new NumericStrategy(),
    numeric: new NumericStrategy(),
    decimal: new DecimalStrategy(),
    "rango-edad": new RangeAgeStrategy(),
    edad: new RangeAgeStrategy(),
    hex: new HexColorStrategy(),
};

// ==========================================
// 2. CHAIN OF RESPONSIBILITY: Pipeline
// ==========================================

export class AbstractValidationHandler {
    constructor() {
        this.nextHandler = null;
    }

    setNext(handler) {
        this.nextHandler = handler;
        return handler;
    }

    handle(value, options = {}) {
        const processed = this.process(value, options);
        if (this.nextHandler) {
            return this.nextHandler.handle(processed, options);
        }
        return processed;
    }

    process(value) {
        return value;
    }
}

export class CharacterFilterHandler extends AbstractValidationHandler {
    process(value, options = {}) {
        const ruleName = options.rule || options.regla || options.tipo || "titulo";
        const strategy = STRATEGIES[ruleName] || STRATEGIES["titulo"];
        return strategy.filter(value);
    }
}

export class TextCorrectorHandler extends AbstractValidationHandler {
    process(value, options = {}) {
        if (typeof value !== "string" || !value) return value;
        let text = value.trim().replace(/ {2,}/g, " ");

        // 2. Capitalización
        if (options.capitalize === "sentence" || options.rule === "oracion") {
            text = text.replace(/^(\s*)(\S)/, (_, spaces, char) => spaces + char.toUpperCase());
        } else if (options.capitalize === "title") {
            text = text.replace(/(^|\s)\S/g, (l) => l.toUpperCase());
        }

        // 3. Normalizar rango de edad (ej. '18-25' a '18 - 25')
        if (options.rule === "edad" || options.rule === "rango-edad") {
            text = text.replace(/(\d+)\s*-\s*(\d+)/g, "$1 - $2");
        }

        return text;
    }
}

export class InputValidationPipeline {
    constructor() {
        this.filterHandler = new CharacterFilterHandler();
        this.correctorHandler = new TextCorrectorHandler();
        this.filterHandler.setNext(this.correctorHandler);
    }

    process(value, options = {}) {
        return this.filterHandler.handle(value, options);
    }
}

export const globalInputPipeline = new InputValidationPipeline();

// ==========================================
// 3. ADAPTER PATTERN: RangeAdapter
// ==========================================

export class RangeAdapter {
    static formatRange(min, max, unit = "años") {
        const minClean = String(min || "").trim();
        const maxClean = String(max || "").trim();

        if (minClean && maxClean) {
            return `${minClean} - ${maxClean} ${unit}`.trim();
        }
        if (minClean && !maxClean) {
            return `+${minClean} ${unit}`.trim();
        }
        if (!minClean && maxClean) {
            return `Hasta ${maxClean} ${unit}`.trim();
        }
        return "";
    }

    static parseRange(rangeStr) {
        if (!rangeStr) return { min: "", max: "" };
        const clean = String(rangeStr).replace(/[^\d\-+]/g, " ").trim();
        const parts = clean.split(/\s*-\s*|\s+/).filter(Boolean);

        if (parts.length >= 2) {
            return { min: parts[0], max: parts[1] };
        }
        if (parts.length === 1) {
            const val = parts[0].replace("+", "");
            return { min: val, max: "" };
        }
        return { min: "", max: "" };
    }
}

// ==========================================
// 4. STRATEGY PATTERN: CurrencyConverter
// ==========================================

export class CurrencyConverter {
    constructor() {
        // Tasas fijas de referencia offline basadas en MXN
        this.ratesToMXN = {
            MXN: 1.0,
            USD: 18.0,
            EUR: 19.5,
        };
        this.symbols = {
            MXN: "$",
            USD: "$",
            EUR: "€",
        };
    }

    convert(amount, fromCurrency = "MXN", toCurrency = "MXN") {
        const num = parseFloat(String(amount).replace(/[^\d.-]/g, ""));
        if (isNaN(num) || num === 0) return 0;
        if (fromCurrency === toCurrency) return num;

        const rateFrom = this.ratesToMXN[fromCurrency] || 1.0;
        const rateTo = this.ratesToMXN[toCurrency] || 1.0;

        // Convertir a MXN base y luego a la divisa destino
        const inMXN = num * rateFrom;
        const result = inMXN / rateTo;

        return Math.round(result * 100) / 100;
    }

    format(amount, currency = "MXN", includeSymbol = true) {
        if (amount === "" || amount === null || amount === undefined) return "";
        const num = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, ""));
        if (isNaN(num)) return "";

        const sym = includeSymbol ? (this.symbols[currency] || "$") : "";
        const formatted = num.toLocaleString("es-MX", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });

        return sym ? `${sym} ${formatted}` : formatted;
    }

    parseRaw(formattedStr) {
        if (!formattedStr) return "";
        const cleaned = String(formattedStr).replace(/[^\d.]/g, "");
        const parts = cleaned.split(".");
        if (parts.length > 2) {
            return parts[0] + "." + parts.slice(1).join("");
        }
        return cleaned;
    }
}

export const globalCurrencyConverter = new CurrencyConverter();

/**
 * InputValidatorPipeline implementa los patrones del Gang of Four (GoF):
 * 1. CHAIN OF RESPONSIBILITY (Cadena de Responsabilidad): Procesa el texto secuencialmente:
 *    Filtro de Caracteres -> Corrector de Texto -> Formateador / Normalizador.
 * 2. STRATEGY (Estrategia): Familias de reglas intercambiables de tipos de caracteres permitidos.
 * 3. DECORATOR (Decorador): Decora cualquier input con sugerencias de autocompletado y autocorrección.
 */

// ==========================================
// 1. STRATEGY PATTERN: Reglas de Caracteres
// ==========================================

export class TextOnlyStrategy {
    /**
     * Solo permite letras (con acentos/ñ), espacios y signos ortográficos habituales.
     * BLOQUEA TERMINANTEMENTE números (0-9) y símbolos no gramaticales.
     */
    filter(rawText) {
        if (!rawText) return '';
        // Elimina todos los números del 0 al 9
        return rawText.replace(/[0-9]/g, '');
    }

    isValid(text) {
        return !/[0-9]/.test(text);
    }
}

export class NumericStrategy {
    /**
     * Solo permite dígitos enteros (0-9).
     * BLOQUEA letras y símbolos.
     */
    filter(rawText) {
        if (!rawText) return '';
        return rawText.replace(/[^\d]/g, '');
    }

    isValid(text) {
        return /^\d*$/.test(text);
    }
}

export class DecimalStrategy {
    /**
     * Permite dígitos y un solo punto decimal.
     * BLOQUEA letras y signos extra.
     */
    filter(rawText) {
        if (!rawText) return '';
        let cleaned = rawText.replace(/[^\d.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = parts[0] + '.' + parts.slice(1).join('');
        }
        return cleaned;
    }

    isValid(text) {
        return /^\d*(\.\d*)?$/.test(text);
    }
}

export class CurrencyFormatterStrategy {
    /**
     * Da formato monetario profesional en tiempo real (separadores de miles y dos decimales limpios).
     * Ejemplo: 1500 -> $ 1,500.00
     */
    static formatCurrency(amount, currency = 'MXN', includeSymbol = true) {
        if (amount === '' || amount === null || amount === undefined) return '';
        const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, ''));
        if (isNaN(num)) return '';

        const symbols = { 'MXN': '$', 'USD': '$', 'EUR': '€' };
        const sym = includeSymbol ? (symbols[currency?.toUpperCase()] || '$') : '';

        const formattedNumber = num.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        return sym ? `${sym} ${formattedNumber}` : formattedNumber;
    }

    /**
     * Extrae el valor numérico puro para guardar en base de datos o estado.
     */
    static parseRawAmount(formattedStr) {
        if (!formattedStr) return '';
        const cleaned = String(formattedStr).replace(/[^\d.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            return parts[0] + '.' + parts.slice(1).join('');
        }
        return cleaned;
    }
}

export class RangeAgeStrategy {
    /**
     * Permite rangos de edad (ej: '18 - 25', '18 a 25', '+18', '20-30').
     * Permite números, espacios, guión y la palabra 'a' o signos '+' / '-'.
     */
    filter(rawText) {
        if (!rawText) return '';
        // Permite números, espacios, +, -, a, A, ñ, Ñ, años
        return rawText.replace(/[^0-9\s\-+a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '');
    }

    isValid(text) {
        return /^[\d\s\-+a-zA-ZáéíóúÁÉÍÓÚñÑ]*$/.test(text);
    }
}

export class RangeAdapter {
    /**
     * Adapta valores min y max a una cadena legible (ej. '18 - 25 años')
     * @param {string|number} min
     * @param {string|number} max
     * @param {string} unit
     */
    static formatRange(min, max, unit = 'años') {
        const minClean = String(min || '').trim();
        const maxClean = String(max || '').trim();

        if (minClean && maxClean) {
            return `${minClean} - ${maxClean} ${unit}`.trim();
        }
        if (minClean && !maxClean) {
            return `+${minClean} ${unit}`.trim();
        }
        if (!minClean && maxClean) {
            return `Hasta ${maxClean} ${unit}`.trim();
        }
        return '';
    }

    /**
     * Deserializa una cadena guardada (ej: '18 - 25 años') a objeto { min, max }
     * @param {string} rangeStr
     */
    static parseRange(rangeStr) {
        if (!rangeStr) return { min: '', max: '' };
        const clean = String(rangeStr).replace(/[^\d\-+]/g, ' ').trim();
        const parts = clean.split(/\s*-\s*|\s+/).filter(Boolean);

        if (parts.length >= 2) {
            return { min: parts[0], max: parts[1] };
        }
        if (parts.length === 1) {
            const val = parts[0].replace('+', '');
            return { min: val, max: '' };
        }
        return { min: '', max: '' };
    }
}

export class TitleTextStrategy {
    /**
     * Permite letras, números, espacios y guiones/paréntesis limpios.
     * Bloquea caracteres conflictivos para nombres de archivo/carpetas (/ \ : * ? " < > |).
     */
    filter(rawText) {
        if (!rawText) return '';
        return rawText.replace(/[/\\:*?"<>|]/g, '');
    }

    isValid(text) {
        return !/[/\\:*?"<>|]/.test(text);
    }
}

export const STRATEGIES = {
    'texto': new TextOnlyStrategy(),
    'text': new TextOnlyStrategy(),
    'solo-texto': new TextOnlyStrategy(),
    'numerico': new NumericStrategy(),
    'numeric': new NumericStrategy(),
    'decimal': new DecimalStrategy(),
    'edad': new RangeAgeStrategy(),
    'titulo': new TitleTextStrategy(),
};

// ====================================================
// 2. CHAIN OF RESPONSIBILITY: Eslabones del Pipeline
// ====================================================

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

/** Eslabón 1: Filtro de Caracteres no permitidos según la estrategia */
export class CharacterFilterHandler extends AbstractValidationHandler {
    process(value, options = {}) {
        const ruleName = options.rule || options.regla || 'titulo';
        const strategy = STRATEGIES[ruleName] || STRATEGIES['titulo'];
        return strategy.filter(value);
    }
}

/** Eslabón 2: Corrector y Formateador de texto */
export class TextCorrectorHandler extends AbstractValidationHandler {
    process(value, options = {}) {
        if (typeof value !== 'string' || !value) return value;
        let text = value;

        // 1. Elimina espacios duplicados internos
        text = text.replace(/ {2,}/g, ' ');

        // 2. Si es solo texto o título, corregir capitalización inicial si se solicita
        if (options.capitalize === 'sentence' && text.length > 0) {
            // Capitaliza la primera letra no espacial
            text = text.replace(/^(\s*)(\S)/, (_, spaces, char) => spaces + char.toUpperCase());
        } else if (options.capitalize === 'title' && text.length > 0) {
            // Capitaliza cada palabra relevante
            text = text.replace(/(^|\s)\S/g, (l) => l.toUpperCase());
        }

        // 3. Normalizar formato de rangos de edad (ej. '18-25' a '18 - 25')
        if (options.rule === 'edad') {
            text = text.replace(/(\d+)\s*-\s*(\d+)/g, '$1 - $2');
        }

        // 4. Formateo de moneda profesional si la regla es moneda o decimal monetario
        if (options.rule === 'moneda' || options.isCurrency) {
            text = CurrencyFormatterStrategy.formatCurrency(text, options.currency || 'MXN', options.includeSymbol ?? true);
        }

        return text;
    }
}

// Pipeline ensamblado
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

// =======================================================
// 3. DECORATOR PATTERN: Autocompletado y Asistente en DOM
// =======================================================

export const AUTOCOMPLETE_CATALOG = {
    receptor: [
        'Estudiantes universitarios',
        'Público general',
        'Profesionales del sector',
        'Comunidad académica',
        'Jóvenes y adolescentes',
        'Familias y audiencia general',
    ],
    emisor: [
        'FCC-UASLP',
        'Facultad de Ciencias de la Comunicación',
        'Productora Audiovisual Universitaria',
        'Laboratorio de TV y Medios',
        'Colectivo Independiente',
    ],
    mensaje: [
        'Informar con veracidad y dinamismo a la comunidad.',
        'Explorar historias humanas que inspiran y transforman.',
        'Analizar la actualidad universitaria y social con mirada crítica.',
        'Entretener con creatividad y rigor audiovisual.',
    ],
    edad: [
        '18 - 25',
        '25 - 40',
        '15 - 20',
        'Todo público (+12)',
        'Audiencia adulta (+18)',
    ],
};

/**
 * Decora un BoxInput agregando validación reactiva en tiempo real y sugerencias de autocompletado
 * @param {HTMLInputElement} inputEl Elemento input a decorar
 * @param {Object} options Configuración del input
 * @param {string} options.rule Regla de caracteres ('texto', 'numerico', 'edad', 'titulo', 'decimal')
 * @param {string} [options.capitalize] Tipo de capitalización ('sentence', 'title', 'none')
 * @param {Array<string>} [options.suggestions] Sugerencias para autocompletado
 */
export function decorateBoxInput(inputEl, options = {}) {
    if (!inputEl) return;

    const rule = options.rule || inputEl.dataset.regla || 'titulo';
    const capitalize = options.capitalize || inputEl.dataset.capitalize || (rule === 'texto' ? 'sentence' : 'none');

    // 1. Filtrado en tiempo real en cada pulsación (evento input)
    inputEl.addEventListener('input', () => {
        const cursor = inputEl.selectionStart;
        const oldVal = inputEl.value;
        const strategy = STRATEGIES[rule] || STRATEGIES['titulo'];
        const filtered = strategy.filter(oldVal);

        if (filtered !== oldVal) {
            inputEl.value = filtered;
            const diff = oldVal.length - filtered.length;
            const newCursor = Math.max(0, (cursor || 0) - diff);
            inputEl.setSelectionRange(newCursor, newCursor);
        }
    });

    // 2. Si es campo de moneda, al hacer foco mostrar el valor numérico puro para edición cómoda
    if (options.isCurrency || rule === 'moneda' || inputEl.dataset.campo === 'presupuesto') {
        inputEl.addEventListener('focus', () => {
            const raw = CurrencyFormatterStrategy.parseRawAmount(inputEl.value);
            if (raw !== '') {
                inputEl.value = raw;
            }
        });
    }

    // 3. Corrección y formateo fino al salir del campo (evento blur)
    inputEl.addEventListener('blur', () => {
        const isCurr = options.isCurrency || rule === 'moneda' || inputEl.dataset.campo === 'presupuesto';
        const targetCurrency = inputEl.closest('.currency-input-wrap')?.querySelector('.currency-picker')?.value || 'MXN';

        const corrected = globalInputPipeline.process(inputEl.value.trim(), {
            rule,
            capitalize,
            isCurrency: isCurr,
            currency: targetCurrency,
            includeSymbol: false, // El select ya muestra el símbolo al lado
        });
        if (corrected !== inputEl.value) {
            inputEl.value = corrected;
            // Disparar evento change si cambió
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // 3. Decorador de Autocompletado si hay sugerencias asociadas
    const suggestionsKey = options.suggestionsKey || inputEl.dataset.campo;
    const suggestions = options.suggestions || (suggestionsKey ? AUTOCOMPLETE_CATALOG[suggestionsKey] : null);

    if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
        const listId = `dl-${inputEl.id || Math.random().toString(36).slice(2, 7)}`;
        let dataList = document.getElementById(listId);
        if (!dataList) {
            dataList = document.createElement('datalist');
            dataList.id = listId;
            dataList.innerHTML = suggestions.map((s) => `<option value="${s}"></option>`).join('');
            document.body.appendChild(dataList);
        }
        inputEl.setAttribute('list', listId);
    }
}

/**
 * Escanea un contenedor y decora automáticamente todos los inputs que tengan data-regla o data-campo
 * @param {HTMLElement} container Contenedor DOM
 */
export function attachInputControlsToContainer(container) {
    if (!container) return;

    // Reglas semánticas por defecto según data-campo
    const campoRules = {
        'nombre': { rule: 'titulo', capitalize: 'title' },
        'mensaje': { rule: 'texto', capitalize: 'sentence' },
        'receptor': { rule: 'texto', capitalize: 'sentence' },
        'edad': { rule: 'edad', capitalize: 'none' },
        'emisor': { rule: 'titulo', capitalize: 'title' },
        'presupuesto': { rule: 'decimal', capitalize: 'none' },
    };

    container.querySelectorAll('input').forEach((input) => {
        const campo = input.dataset.campo || (input.id === 'np-nombre' ? 'nombre' : '');
        const config = campoRules[campo] || { rule: input.dataset.regla || 'titulo' };
        decorateBoxInput(input, config);
    });
}

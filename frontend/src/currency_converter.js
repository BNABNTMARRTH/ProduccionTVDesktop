/**
 * CurrencyConverter implementa el patrón STRATEGY (GoF).
 * Permite realizar conversiones de divisas en tiempo real entre MXN, USD y EUR
 * de forma desacoplada, con tasas configurables y soporte para cualquier componente UI.
 */

export class CurrencyConversionStrategy {
    /**
     * @param {string} code Código ISO de la moneda (MXN, USD, EUR)
     * @param {number} rateToMXN Factor de conversión respecto a la moneda base (MXN)
     * @param {string} symbol Símbolo monetario
     */
    constructor(code, rateToMXN, symbol = '$') {
        this.code = code;
        this.rateToMXN = rateToMXN;
        this.symbol = symbol;
    }

    toBase(amount) {
        return amount * this.rateToMXN;
    }

    fromBase(amountInBase) {
        if (!this.rateToMXN || this.rateToMXN === 0) return 0;
        return amountInBase / this.rateToMXN;
    }
}

export class CurrencyConverter {
    constructor() {
        // Estrategias de divisa registradas
        this.strategies = new Map([
            ['MXN', new CurrencyConversionStrategy('MXN', 1.0, '$')],
            ['USD', new CurrencyConversionStrategy('USD', 18.0, '$')],
            ['EUR', new CurrencyConversionStrategy('EUR', 19.5, '€')],
        ]);
    }

    /**
     * Registra o actualiza una estrategia de moneda
     */
    registerStrategy(code, rateToMXN, symbol = '$') {
        this.strategies.set(code.toUpperCase(), new CurrencyConversionStrategy(code.toUpperCase(), rateToMXN, symbol));
    }

    /**
     * Realiza la conversión entre dos divisas
     * @param {number|string} amount Monto a convertir
     * @param {string} fromCurrency Divisa origen ('MXN', 'USD', 'EUR')
     * @param {string} toCurrency Divisa destino ('MXN', 'USD', 'EUR')
     * @param {number} decimals Número de decimales para redondear (default: 2)
     * @returns {number} Monto convertido
     */
    convert(amount, fromCurrency = 'MXN', toCurrency = 'MXN', decimals = 2) {
        const num = parseFloat(amount);
        if (isNaN(num) || num === 0) return 0;
        if (fromCurrency === toCurrency) return Number(num.toFixed(decimals));

        const fromStrategy = this.strategies.get(fromCurrency.toUpperCase());
        const toStrategy = this.strategies.get(toCurrency.toUpperCase());

        if (!fromStrategy || !toStrategy) {
            console.warn(`[CurrencyConverter] Estrategia no encontrada para: ${fromCurrency} -> ${toCurrency}`);
            return Number(num.toFixed(decimals));
        }

        const inBase = fromStrategy.toBase(num);
        const result = toStrategy.fromBase(inBase);
        return Number(result.toFixed(decimals));
    }

    getSymbol(currencyCode) {
        return this.strategies.get(currencyCode?.toUpperCase())?.symbol || '$';
    }

    getSupportedCurrencies() {
        return Array.from(this.strategies.keys());
    }
}

// Instancia única (Singleton auxiliar opcional para uso rápido en toda la app)
export const globalCurrencyConverter = new CurrencyConverter();

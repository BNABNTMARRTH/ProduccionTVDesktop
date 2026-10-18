import test from "node:test";
import assert from "node:assert/strict";

import { CurrencyConverter, CurrencyConversionStrategy } from "../frontend/src/currency_converter.js";

test("GoF Strategy Pattern: CurrencyConverter convierte correctamente entre MXN, USD y EUR", () => {
    const converter = new CurrencyConverter();

    // 1800 MXN a USD (18.00 MXN/USD) -> 100 USD
    const usd = converter.convert(1800, "MXN", "USD");
    assert.equal(usd, 100);

    // 100 USD a MXN -> 1800 MXN
    const mxn = converter.convert(100, "USD", "MXN");
    assert.equal(mxn, 1800);

    // 1950 MXN a EUR (19.50 MXN/EUR) -> 100 EUR
    const eur = converter.convert(1950, "MXN", "EUR");
    assert.equal(eur, 100);

    // Misma moneda no debe alterarse
    assert.equal(converter.convert(500, "USD", "USD"), 500);

    // 0 o valores nulos deben retornar 0
    assert.equal(converter.convert(0, "MXN", "USD"), 0);
    assert.equal(converter.convert("", "MXN", "USD"), 0);
});

test("GoF Strategy Pattern: Permite registrar o actualizar estrategias dinámicamente", () => {
    const converter = new CurrencyConverter();
    converter.registerStrategy("GBP", 23.5, "£");

    assert.ok(converter.getSupportedCurrencies().includes("GBP"));
    assert.equal(converter.getSymbol("GBP"), "£");

    // 235 MXN -> 10 GBP
    assert.equal(converter.convert(235, "MXN", "GBP"), 10);
});

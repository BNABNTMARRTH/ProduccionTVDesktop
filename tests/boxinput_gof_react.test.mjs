import test from "node:test";
import assert from "node:assert/strict";

import {
    TextOnlyStrategy,
    TitleTextStrategy,
    SentenceTextStrategy,
    NumericStrategy,
    DecimalStrategy,
    RangeAgeStrategy,
    HexColorStrategy,
    STRATEGIES,
    RangeAdapter,
    CurrencyConverter,
    globalCurrencyConverter,
    InputValidationPipeline,
    globalInputPipeline,
} from "../web-sources/generador-tv/src/inputValidationPipeline.js";

test("GoF Strategy Pattern: TextOnlyStrategy en React bloquea dígitos (0-9)", () => {
    const textStrategy = new TextOnlyStrategy();
    assert.equal(textStrategy.filter("Estudiantes 123 y docentes 456"), "Estudiantes  y docentes ");
    assert.equal(textStrategy.isValid("UASLP 2026"), false);
    assert.equal(textStrategy.isValid("Facultad de Comunicación"), true);
});

test("GoF Strategy Pattern: TitleTextStrategy bloquea caracteres de archivo no seguros", () => {
    const titleStrategy = new TitleTextStrategy();
    assert.equal(titleStrategy.filter("Proyecto: Temporada 1 / Final? <Draft>"), "Proyecto Temporada 1  Final Draft");
    assert.equal(titleStrategy.isValid("Proyecto 18/10/2026"), false);
    assert.equal(titleStrategy.isValid("Proyecto 18-10-2026"), true);
});

test("GoF Strategy Pattern: HexColorStrategy normaliza colores hexadecimales", () => {
    const hexStrategy = new HexColorStrategy();
    assert.equal(hexStrategy.filter("#16365F"), "#16365F");
    assert.equal(hexStrategy.filter("16365F"), "#16365F");
    assert.equal(hexStrategy.filter("#16365FXYZ"), "#16365F");
    assert.equal(hexStrategy.isValid("#16365F"), true);
    assert.equal(hexStrategy.isValid("rojo"), false);
});

test("GoF Adapter Pattern: RangeAdapter en React serializa y deserializa rangos", () => {
    const formatted = RangeAdapter.formatRange("18", "25", "años");
    assert.equal(formatted, "18 - 25 años");

    const parsed = RangeAdapter.parseRange(formatted);
    assert.equal(parsed.min, "18");
    assert.equal(parsed.max, "25");

    const singlePlus = RangeAdapter.formatRange("18", "", "años");
    assert.equal(singlePlus, "+18 años");
    const parsedPlus = RangeAdapter.parseRange(singlePlus);
    assert.equal(parsedPlus.min, "18");
    assert.equal(parsedPlus.max, "");
});

test("GoF Strategy Pattern: CurrencyConverter convierte correctamente entre MXN, USD y EUR", () => {
    const converter = new CurrencyConverter();

    // 180,000 MXN a USD (18 MXN/USD) -> 10,000 USD
    const usd = converter.convert(180000, "MXN", "USD");
    assert.equal(usd, 10000);

    // 10,000 USD a MXN -> 180,000 MXN
    const mxn = converter.convert(10000, "USD", "MXN");
    assert.equal(mxn, 180000);

    // 195,000 MXN a EUR (19.5 MXN/EUR) -> 10,000 EUR
    const eur = converter.convert(195000, "MXN", "EUR");
    assert.equal(eur, 10000);

    // Formateo y parseo raw
    const formatted = converter.format(180000, "MXN", true);
    assert.ok(formatted.includes("180,000"));
    assert.equal(converter.parseRaw("$ 180,000.50"), "180000.50");
});

test("GoF Chain of Responsibility: InputValidationPipeline procesa filtrado y corrección", () => {
    const pipeline = new InputValidationPipeline();

    // Oración con dobles espacios y minúscula inicial
    const cleanSentence = pipeline.process("  el mensaje   principal de la  obra", {
        rule: "oracion",
    });
    assert.equal(cleanSentence, "El mensaje principal de la obra");

    // Texto con números infiltrados
    const cleanText = pipeline.process("Audiencia 123 estudiantil", {
        tipo: "texto",
    });
    assert.equal(cleanText, "Audiencia estudiantil");
});

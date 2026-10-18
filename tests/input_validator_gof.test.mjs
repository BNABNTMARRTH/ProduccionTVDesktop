import test from "node:test";
import assert from "node:assert/strict";

import {
    TextOnlyStrategy,
    NumericStrategy,
    DecimalStrategy,
    RangeAgeStrategy,
    TitleTextStrategy,
    InputValidationPipeline,
    globalInputPipeline,
} from "../frontend/src/input_validator_pipeline.js";

test("GoF Strategy Pattern: TextOnlyStrategy bloquea terminantemente números (0-9)", () => {
    const strategy = new TextOnlyStrategy();

    // Texto normal con tildes y caracteres válidos
    assert.equal(strategy.filter("Audiencia universitaria"), "Audiencia universitaria");
    assert.equal(strategy.filter("Comunicación y Medios"), "Comunicación y Medios");

    // Elimina números infiltrados
    assert.equal(strategy.filter("Estudiantes 123 de la 456 facultad"), "Estudiantes  de la  facultad");
    assert.equal(strategy.isValid("Estudiantes 123"), false);
    assert.equal(strategy.isValid("Estudiantes"), true);
});

test("GoF Strategy Pattern: NumericStrategy y DecimalStrategy bloquean letras y caracteres extra", () => {
    const numStrategy = new NumericStrategy();
    assert.equal(numStrategy.filter("abc123xyz"), "123");
    assert.equal(numStrategy.isValid("123"), true);
    assert.equal(numStrategy.isValid("123a"), false);

    const decStrategy = new DecimalStrategy();
    assert.equal(decStrategy.filter("12.50.99"), "12.5099");
    assert.equal(decStrategy.filter("$1,500.50"), "1500.50");
});

test("GoF Strategy Pattern: RangeAgeStrategy permite rangos numéricos con guión y palabras de edad", () => {
    const ageStrategy = new RangeAgeStrategy();
    assert.equal(ageStrategy.filter("18 - 25 años"), "18 - 25 años");
    assert.equal(ageStrategy.filter("+18"), "+18");
    assert.equal(ageStrategy.filter("18-25 $$$"), "18-25 ");
});

test("GoF Chain of Responsibility: InputValidationPipeline ejecuta filtrado, autocorrección y normalización secuencial", () => {
    const pipeline = new InputValidationPipeline();

    // Caso 1: Oración con números infiltrados, espacios dobles y minúscula inicial
    const result1 = pipeline.process("si tu  123 proyecto solo   pudiera decir algo", {
        rule: "texto",
        capitalize: "sentence",
    });
    // Debe bloquear números, quitar dobles espacios y capitalizar inicial
    assert.equal(result1, "Si tu proyecto solo pudiera decir algo");

    // Caso 2: Título con capitalización de palabras
    const result2 = pipeline.process("noticiero de la facultad", {
        rule: "titulo",
        capitalize: "title",
    });
    assert.equal(result2, "Noticiero De La Facultad");

    // Caso 3: Formato de rango de edad
    const result3 = pipeline.process("18-25", {
        rule: "edad",
    });
    assert.equal(result3, "18 - 25");

    // Caso 4: Formato de moneda en tiempo real
    const result4 = pipeline.process("1500", {
        rule: "moneda",
        currency: "MXN",
        includeSymbol: true,
    });
    assert.equal(result4, "$ 1,500.00");
});

test("GoF Strategy Pattern: CurrencyFormatterStrategy formatea montos y extrae raw value", () => {
    import("../frontend/src/input_validator_pipeline.js").then(({ CurrencyFormatterStrategy }) => {
        assert.equal(CurrencyFormatterStrategy.formatCurrency(50000, "MXN", true), "$ 50,000.00");
        assert.equal(CurrencyFormatterStrategy.formatCurrency(1250.5, "USD", false), "1,250.50");
        assert.equal(CurrencyFormatterStrategy.formatCurrency(980.25, "EUR", true), "€ 980.25");
        assert.equal(CurrencyFormatterStrategy.parseRawAmount("$ 50,000.00"), "50000.00");
    });
});


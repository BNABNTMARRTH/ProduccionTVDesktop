import test from "node:test";
import assert from "node:assert/strict";

import { RangeAdapter } from "../frontend/src/input_validator_pipeline.js";
import { UIComponentFactory } from "../frontend/src/ui_component_factory.js";

test("GoF Adapter Pattern: RangeAdapter adapta y deserializa rangos numéricos correctamente", () => {
    // Caso 1: Rango cerrado estándar (min y max)
    const formatted1 = RangeAdapter.formatRange("18", "25", "años");
    assert.equal(formatted1, "18 - 25 años");

    const parsed1 = RangeAdapter.parseRange(formatted1);
    assert.equal(parsed1.min, "18");
    assert.equal(parsed1.max, "25");

    // Caso 2: Rango abierto solo min (+18)
    const formatted2 = RangeAdapter.formatRange("18", "", "años");
    assert.equal(formatted2, "+18 años");

    const parsed2 = RangeAdapter.parseRange(formatted2);
    assert.equal(parsed2.min, "18");
    assert.equal(parsed2.max, "");

    // Caso 3: Rango abierto solo max (Hasta 60)
    const formatted3 = RangeAdapter.formatRange("", "60", "años");
    assert.equal(formatted3, "Hasta 60 años");

    // Caso 4: Valores vacíos retornan cadena vacía
    assert.equal(RangeAdapter.formatRange("", "", "años"), "");
    assert.deepEqual(RangeAdapter.parseRange(""), { min: "", max: "" });
});

test("GoF Composite + Abstract Factory: UIComponentFactory genera RangeInput con dos entradas y semántica ARIA", () => {
    const rangeHtml = UIComponentFactory.createRangeInput({
        id: "np-edad",
        minVal: "18",
        maxVal: "25",
        minPlaceholder: "18",
        maxPlaceholder: "25",
        unit: "años",
    });

    assert.ok(rangeHtml.includes('class="range-input-wrap"'));
    assert.ok(rangeHtml.includes('id="np-edad-min"'));
    assert.ok(rangeHtml.includes('id="np-edad-max"'));
    assert.ok(rangeHtml.includes('value="18"'));
    assert.ok(rangeHtml.includes('value="25"'));
    assert.ok(rangeHtml.includes('data-regla="numerico"'));
    assert.ok(rangeHtml.includes('class="range-sep"'));
    assert.ok(rangeHtml.includes('años'));
});

import test from "node:test";
import assert from "node:assert/strict";

import { BudgetDistributionStrategy } from "../web-sources/generador-tv/src/budgetDistributionStrategy.js";

test("GoF Strategy Pattern: BudgetDistributionStrategy calcula balances proporcionales de presupuesto de TV", () => {
  const perfil = {
    presupuesto: "180000",
    reparto: {
      atl: 30,
      btl: 45,
      pos: 15,
      imprev: 10,
    },
  };

  const resultado = BudgetDistributionStrategy.calculate(perfil);

  assert.equal(resultado.totalPresupuesto, 180000);
  assert.equal(resultado.sumaPct, 100);
  assert.equal(resultado.esBalanceado, true);

  // Comprobar montos derivados
  const atl = resultado.filas.find((f) => f.id === "atl");
  const btl = resultado.filas.find((f) => f.id === "btl");
  const pos = resultado.filas.find((f) => f.id === "pos");
  const imprev = resultado.filas.find((f) => f.id === "imprev");

  assert.equal(atl.monto, 54000); // 30% de 180,000
  assert.equal(btl.monto, 81000); // 45% de 180,000
  assert.equal(pos.monto, 27000); // 15% de 180,000
  assert.equal(imprev.monto, 18000); // 10% de 180,000

  assert.equal(atl.fueraDeRango, false);
  assert.equal(btl.fueraDeRango, false);
});

test("GoF Strategy Pattern: BudgetDistributionStrategy detecta desbalances y anomalías de rango", () => {
  const perfilDesbalanceado = {
    presupuesto: "200000",
    reparto: {
      atl: 50, // Rango recomendado es 25-35%
      btl: 30, // Rango recomendado es 40-50%
      pos: 15,
      imprev: 15,
    },
  };

  const resultado = BudgetDistributionStrategy.calculate(perfilDesbalanceado);

  assert.equal(resultado.sumaPct, 110);
  assert.equal(resultado.esBalanceado, false);

  const atl = resultado.filas.find((f) => f.id === "atl");
  const btl = resultado.filas.find((f) => f.id === "btl");

  assert.equal(atl.fueraDeRango, true); // 50% > 35%
  assert.equal(btl.fueraDeRango, true); // 30% < 40%
});

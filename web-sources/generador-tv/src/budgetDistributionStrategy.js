import { BLOQUES, repartoVacio } from "./proyecto.js";

// ============================================================================
// GoF STRATEGY PATTERN: BudgetDistributionStrategy
// Calcula y valida la distribución industrial del presupuesto televisivo/cine
// ============================================================================
export const BudgetDistributionStrategy = {
  calculate(perfil) {
    const reparto = { ...repartoVacio(), ...(perfil?.reparto || {}) };
    const totalPresupuesto = Number(String(perfil?.presupuesto || "").replace(/[^\d.]/g, "")) || 0;

    const filas = BLOQUES.map((b) => {
      const pct = Number(reparto[b.id]) || 0;
      const monto = Math.round((totalPresupuesto * pct) / 100);
      const fueraDeRango = pct < b.min || pct > b.max;
      return {
        ...b,
        pct,
        monto,
        fueraDeRango,
      };
    });

    const sumaPct = filas.reduce((acc, f) => acc + f.pct, 0);
    const esBalanceado = sumaPct === 100;

    return {
      filas,
      sumaPct,
      esBalanceado,
      totalPresupuesto,
    };
  },
};

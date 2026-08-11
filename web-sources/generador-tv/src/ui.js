// Átomos de interfaz compartidos (clases de Tailwind y estilos reutilizados por
// varios componentes): la caja de texto y el botón. Viven aparte para que los
// componentes separados a otros archivos usen los mismos sin duplicarlos.
import { INK } from "./theme.js";

export const inp = "w-full rounded-md border px-2 py-1.5 text-sm";
export const inpStyle = { borderColor: "#C8D2DE", color: INK };
export const btn = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold";

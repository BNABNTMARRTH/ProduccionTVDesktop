// Comportamientos reutilizables de la interfaz ("hooks" de React): trozos de
// lógica con memoria propia que varios componentes comparten sin duplicarla.
import { useState } from "react";

// Reordenar listas arrastrando y soltando (HTML5 drag & drop).
// `source(i)` se aplica al "asa" que se arrastra; `target(i)` a la zona donde
// se suelta; `onReorder(desde, hasta)` recibe el movimiento ya resuelto.
export function useReorder(onReorder) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const source = (i) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragIdx(i);
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", String(i)); } catch {}
    },
    onDragEnd: () => { setDragIdx(null); setOverIdx(null); },
  });
  const target = (i) => ({
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overIdx !== i) setOverIdx(i); },
    onDrop: (e) => {
      e.preventDefault();
      if (dragIdx != null && dragIdx !== i) onReorder(dragIdx, i);
      setDragIdx(null); setOverIdx(null);
    },
  });
  return { dragIdx, overIdx, source, target };
}

// Datos de texto de una captura 3D. Este archivo no toca DOM ni Three.js para
// poder verificar por separado lo que queda impreso en el storyboard.
export function nombreCortoCamara(camara, indice = 0) {
  const nombre = String(camara?.nombre || "");
  const sinAcentos = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const encontrada = sinAcentos.match(/CAM(?:ARA)?\s+[A-Z0-9]+/i);
  return encontrada
    ? encontrada[0].toUpperCase().replace("CAMARA", "CAM")
    : `CAM ${String.fromCharCode(65 + indice)}`;
}

export function gradosConSigno(valor) {
  const entero = Object.is(valor, -0) ? 0 : Math.round(Number(valor) || 0);
  if (entero === 0) return "0°";
  return `${entero > 0 ? "+" : "−"}${Math.abs(entero)}°`;
}

// En producción se anota el lente que se usó, no el ángulo de visión: el
// letrero dice cámara · lente · focal · tilt. El ángulo queda en los
// metadatos de la captura, no impreso.
export function nombreCortoLente(nombre) {
  return String(nombre || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function armarTextoEtiquetaCaptura({ camara, indiceCamara = 0, lente, focal, tilt }) {
  const nombreLente = nombreCortoLente(lente);
  return `${nombreCortoCamara(camara, indiceCamara)}`
    + (nombreLente ? ` · ${nombreLente}` : "")
    + ` · ${Math.round(Number(focal) || 0)} mm`
    + ` · Tilt ${gradosConSigno(tilt)}`;
}

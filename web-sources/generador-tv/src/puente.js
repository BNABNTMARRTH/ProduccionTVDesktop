// Puente con la app de escritorio: el generador corre dentro de un iframe del
// shell de Producción TV (Wails/WebView), donde las descargas normales del
// navegador NO funcionan. Aquí vive cómo detectarlo y cómo pedirle al shell que
// guarde un archivo con el diálogo nativo del sistema.

// ¿Corre dentro de la app de escritorio (iframe del shell de Producción TV)?
export const EMBEDDED = typeof window !== "undefined" && window.parent !== window;

if (typeof document !== "undefined" && EMBEDDED) {
  document.documentElement.classList.add("embedded");
  if (document.body) {
    document.body.classList.add("embedded");
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      document.body?.classList.add("embedded");
    });
  }
}

// Descarga un archivo de texto generado en el navegador
export function descargarArchivo(nombre, contenido, mime = "text/plain") {
  try {
    if (EMBEDDED) {
      // Las descargas blob no funcionan en el WebView: el shell guarda con diálogo nativo.
      window.parent.postMessage({ type: "producciontv:save-file", filename: nombre, content: contenido, mime }, "*");
      return;
    }
    if (window.webkit?.messageHandlers?.download) {
      window.webkit.messageHandlers.download.postMessage({ nombre, contenido, mime });
      return;
    }
    const blob = new Blob([contenido], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) { console.error("No se pudo descargar:", e); }
}

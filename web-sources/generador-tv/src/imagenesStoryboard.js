const cargarImagen = (src) => new Promise((resolve, reject) => {
  const imagen = new Image();
  imagen.onload = () => resolve(imagen);
  imagen.onerror = () => reject(new Error("No se pudo leer la imagen"));
  imagen.src = src;
});

function reducirImagenStoryboard(imagen) {
  const ancho = 480;
  const alto = Math.max(1, Math.round((imagen.height / imagen.width) * ancho) || 270);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext("2d").drawImage(imagen, 0, 0, ancho, alto);
  return lienzo.toDataURL("image/jpeg", 0.8);
}

// Las imágenes viven en base64 dentro del proyecto. Toda entrada al storyboard
// pasa por este límite para no inflar localStorage ni los archivos .ptv.
export async function leerImagenStoryboard(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    return reducirImagenStoryboard(await cargarImagen(url));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rectanguloRedondeado(ctx, x, y, ancho, alto, radio) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.lineTo(x + ancho - radio, y);
  ctx.quadraticCurveTo(x + ancho, y, x + ancho, y + radio);
  ctx.lineTo(x + ancho, y + alto - radio);
  ctx.quadraticCurveTo(x + ancho, y + alto, x + ancho - radio, y + alto);
  ctx.lineTo(x + radio, y + alto);
  ctx.quadraticCurveTo(x, y + alto, x, y + alto - radio);
  ctx.lineTo(x, y + radio);
  ctx.quadraticCurveTo(x, y, x + radio, y);
  ctx.closePath();
}

// Imprime primero la etiqueta sobre el cuadro 960×540 y sólo después crea el
// JPEG de 480×270. Así el texto sigue siendo parte de la imagen reducida.
export async function prepararCapturaParaStoryboard(dataUrl, textoEtiqueta) {
  const imagen = await cargarImagen(dataUrl);
  const captura = document.createElement("canvas");
  captura.width = 960;
  captura.height = 540;
  const ctx = captura.getContext("2d");
  ctx.drawImage(imagen, 0, 0, captura.width, captura.height);

  const margen = 18;
  const rellenoX = 14;
  const alto = 56;
  const anchoMaximo = captura.width - margen * 2;
  let tamano = 28;
  ctx.font = `700 ${tamano}px -apple-system, BlinkMacSystemFont, sans-serif`;
  while (ctx.measureText(textoEtiqueta).width + rellenoX * 2 > anchoMaximo && tamano > 20) {
    tamano -= 1;
    ctx.font = `700 ${tamano}px -apple-system, BlinkMacSystemFont, sans-serif`;
  }
  const ancho = Math.min(anchoMaximo, Math.ceil(ctx.measureText(textoEtiqueta).width + rellenoX * 2));
  const y = captura.height - margen - alto;
  rectanguloRedondeado(ctx, margen, y, ancho, alto, 10);
  ctx.fillStyle = "rgba(5, 9, 16, .76)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(textoEtiqueta, margen + rellenoX, y + alto / 2, anchoMaximo - rellenoX * 2);

  return reducirImagenStoryboard(captura);
}

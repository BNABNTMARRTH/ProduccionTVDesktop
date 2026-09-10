#!/bin/bash
# ---------------------------------------------------------------------------
# La app del iPad NO tiene su propia copia del frontend: usa la MISMA que se
# compila para el escritorio. Este guion trae frontend/dist a ios/ProduccionTV/
# Web, que es lo que Xcode mete en el paquete.
#
# Se corre después de cambiar algo del frontend, y antes de compilar en Xcode:
#
#     npm --prefix frontend run build      (o build/compilar.sh, que ya lo hace)
#     ios/sincronizar-web.sh
#
# Así no existe una "versión para iPad" del frontend que se separe de la del
# Mac a la primera corrección: hay una sola, y esto la copia.
# ---------------------------------------------------------------------------
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$AQUI")"
ORIGEN="$RAIZ/frontend/dist"
DESTINO="$AQUI/ProduccionTV/Web"

if [ ! -f "$ORIGEN/index.html" ]; then
  echo "✗ No encuentro $ORIGEN/index.html"
  echo "  Compila primero el frontend:  npm --prefix \"$RAIZ/frontend\" run build"
  exit 1
fi

rm -rf "$DESTINO"
cp -R "$ORIGEN" "$DESTINO"
find "$DESTINO" -name ".DS_Store" -delete

echo "✓ Web actualizada desde frontend/dist"
echo "  $(find "$DESTINO" -type f | wc -l | tr -d ' ') archivos · $(du -sh "$DESTINO" | cut -f1)"
echo "  Ahora compila en Xcode (⌘R)."

#!/bin/bash
# Compila Producción TV dejando la versión metida en el nombre y en la firma.
#
# Por qué existe: macOS reconoce una app por su "identificador de paquete", no
# por el nombre del archivo. Hasta el 24-ago-2026 todas las versiones usaban el
# mismo identificador, así que al pedir una copia concreta el sistema abría
# cualquiera de las registradas. Ahora el identificador lleva la versión
# (com.aldomaster.producciontv.desktop.v0.7.0) y este script deja el .app
# nombrado igual, para que también se distingan en el Finder.
#
# Uso:   bash build/compilar.sh            → universal (Intel + Apple)
#        bash build/compilar.sh amd64      → solo Intel
set -e
cd "$(dirname "$0")/.."

PLATAFORMA="darwin/${1:-universal}"
VERSION=$(python3 -c "import json;print(json.load(open('wails.json'))['info']['productVersion'])")
NOMBRE=$(python3 -c "import json;print(json.load(open('wails.json'))['info']['productName'])")
DESTINO="build/bin/${NOMBRE} ${VERSION}.app"

export PATH="$PATH:$HOME/go/bin"
command -v wails >/dev/null || { echo "✗ falta wails en el PATH"; exit 1; }

# LAS COPIAS DE ANTES SE PONEN A SALVO. `wails build -clean` no limpia solo lo
# suyo: BORRA build/bin ENTERO, y ahí viven todas las versiones compiladas hasta
# hoy. Compilar sin esto se llevaba por delante el historial de la app en un
# comando y sin preguntar. Se apartan, se compila, y vuelven a su sitio pase lo
# que pase (el trap las devuelve aunque la compilación truene a la mitad).
GUARDA="build/_copias-a-salvo"
devolver() {
  [ -d "$GUARDA" ] || return 0
  mkdir -p build/bin
  for app in "$GUARDA"/*.app; do
    if [ -e "$app" ]; then mv -f "$app" build/bin/; fi
  done
  rmdir "$GUARDA" 2>/dev/null || true
}
trap devolver EXIT
GUARDADAS=0
mkdir -p build/bin "$GUARDA"
for app in build/bin/*.app; do
  if [ -e "$app" ]; then mv -f "$app" "$GUARDA"/; GUARDADAS=$((GUARDADAS + 1)); fi
done
if [ "$GUARDADAS" -gt 0 ]; then echo "▸ $GUARDADAS copias anteriores puestas a salvo en $GUARDA"; fi

echo "▸ Compilando ${NOMBRE} ${VERSION} para ${PLATAFORMA}…"
wails build -platform "$PLATAFORMA" -clean

devolver
trap - EXIT
rm -rf "$DESTINO"
mv "build/bin/${NOMBRE}.app" "$DESTINO"

# Firma adhoc otra vez: mover el paquete no la invalida, pero sí cualquier
# retoque posterior del Info.plist.
codesign --force --deep -s - "$DESTINO" 2>/dev/null || true

echo
echo "▸ Comprobación:"
P="$DESTINO/Contents/Info.plist"
printf "   identificador  %s\n" "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$P")"
printf "   nombre         %s\n" "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$P")"
printf "   versión        %s\n" "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$P")"
printf "   procesadores   %s\n" "$(lipo -archs "$DESTINO/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$P")")"
printf "   carpeta        %s\n" "$DESTINO"
echo
echo "▸ Para abrir ESTA copia y ninguna otra:"
echo "   open -n \"$(pwd)/$DESTINO\""

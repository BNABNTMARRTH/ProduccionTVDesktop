# Banco de retratos — probar una herramienta sin compilar la app

Wails usa **WKWebView** en macOS, así que una herramienta se puede ver tal como
saldrá en la app cargándola en un WKWebView suelto. No hace falta Chrome (esta
Mac no lo tiene) ni compilar el binario entero.

```sh
swiftc -O retrato.swift -o retrato
swiftc -O comparar.swift -o comparar

# servir el frontend (desde frontend/public)
python3 -m http.server 8731

# un retrato, con JS opcional para dejar la herramienta en un estado concreto
./retrato "http://127.0.0.1:8731/tools/escuela/index.html" salida.png 1280 860 \
          "estado.dia=0;pintar();"

# dos retratos lado a lado, recortados al visor
./comparar a.png b.png "rótulo A" "rótulo B" comparacion.png
```

`retrato` espera a que la página diga `listo === true` antes de disparar: las
herramientas que precargan imágenes tardan, y sin esa espera se retrataba el
lienzo en blanco. Si una herramienta no define `listo`, hay que ajustar la
espera en `esperarMotor`.

**Ojo con `file://`**: bajo ese esquema el lienzo se contamina y `getImageData`
truena. Hay que servir por HTTP, como arriba.

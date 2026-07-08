# Producción TV — Desktop

Aplicación de escritorio (Wails v2 + Go) con herramientas offline para producción
audiovisual: generador de infografías, diagrama de señal y modo producción en vivo.

## Estructura

```
main.go / app.go          Backend Go: ventanas, diálogos de guardado, impresión
main_test.go              Pruebas del arranque de ventanas de proyecto
frontend/
  src/main.js             Shell: navegación, proyectos, exportación, mensajes
  src/templates.js        Plantillas de proyecto y sincronía infografía⇄diagrama
  src/production.js       Modo producción (cronómetro + checklist técnico)
  src/style.css           Estilos del shell
  public/tools/diagrama/  Diagrama de señal (HTML autónomo, SIN build)
  public/tools/guias/     Guías de set imprimibles (HTML autónomo, SIN build)
  public/tools/exportar/  Centro de exportación (HTML autónomo, SIN build)
  public/tools/shared/    Renderizadores de hojas compartidos por guias y exportar
  public/tools/infografias/  Build compilado del generador (NO editar a mano)
web-sources/generador-tv/ Código fuente React del generador de infografías
```

## Cómo funciona la comunicación

Las herramientas corren en un `iframe` y hablan con el shell por `postMessage`:

- `producciontv:load-infografia` / `hydrate-diagram` — el shell envía el estado.
- `producciontv:infografia-state` / `diagram-state` — la herramienta reporta cambios.
- `producciontv:request-project` / `project-data` — exportación de proyecto.
- `producciontv:save-file` — la herramienta pide guardar un archivo (EDL, CSV,
  JSON) con el diálogo nativo, porque las descargas blob no funcionan en el WebView.
- `producciontv:load-guias` / `producciontv:print` — el shell envía el estado a las
  guías imprimibles y estas piden el panel nativo de impresión.
- `producciontv:load-exportar` / `producciontv:export-pngs` — estado completo para el
  centro de exportación; el shell captura cada `.export-page` como PNG con html2canvas.
- `producciontv:print-document` — impresión multipágina: la herramienta manda HTML+CSS
  y el shell lo monta en `#print-host` antes de abrir el panel nativo (imprimir el
  iframe directamente solo saca la parte visible).

Cada proyecto se abre en un proceso independiente (`OpenProjectWindow`) porque
Wails v2 solo permite una ventana nativa por proceso.

## Desarrollo

```bash
wails dev        # desarrollo con hot reload
wails build      # binario de producción
go test ./...    # pruebas del backend
```

Si cambias el generador de infografías, recompílalo primero
(ver `web-sources/README.md`).

Nota (macOS con SDK reciente): si el enlazado falla con `_OBJC_CLASS_$_UTType`,
exporta `CGO_LDFLAGS="-framework UniformTypeIdentifiers"` antes de compilar.

## Limitaciones del WebView (Wails v2 en macOS)

`window.alert/confirm/prompt` y las descargas de enlaces blob **no funcionan**.
Toda confirmación se hace con UI propia (botones de dos pasos) y todo guardado
de archivo pasa por el backend Go (`SaveTextFile` / `SaveBase64File`).

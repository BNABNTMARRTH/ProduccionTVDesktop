# Auditoría de deficiencias — Producción TV Desktop v0.7.0-dev

Fecha: 2026-07-07 · Alcance: arquitectura, datos, UX, exportación y plataforma.

## 🔴 Críticas (riesgo de pérdida de datos o bloqueo del usuario)

1. **localStorage como única persistencia.** Los 60 proyectos viven en el
   almacenamiento del WebView (con logos en base64 inflando la cuota). macOS
   puede purgarlo, y no hay respaldo automático a disco. El `.ptv` exportado es
   el único salvavidas y depende de que el usuario lo haga a mano.
   → Migrar a archivos en disco vía Go (p. ej. `~/Documents/ProduccionTV/`)
   con autoguardado, o al menos un respaldo automático periódico.
2. **Escrituras concurrentes sin coordinación.** El lanzador y cada ventana de
   proyecto (procesos separados) escriben la misma lista de proyectos en
   localStorage; el último en guardar pisa al resto. Con dos proyectos abiertos
   se pueden perder cambios.
3. **Sin firma ni notarización de Apple.** Gatekeeper marca la app como de
   "desarrollador no identificado": cada alumno debe hacer clic derecho →
   Abrir. Para distribución en la FCC conviene al menos notarizar.
4. **Sin control de versiones (git).** El código se versiona con zips manuales;
   un error de edición sin zip reciente no tiene vuelta atrás. Iniciar un repo
   git local cuesta un comando y elimina el riesgo.

## 🟠 Importantes (deuda que ya estorba o se paga pronto)

5. **Duplicación React ↔ vanilla del plano cenital.** `EstudioCenital` (JSX) y
   `planoSvg` (sheets.js) dibujan lo mismo por separado; luces, muebles,
   talentos y glifos ya están duplicados. Cada feature nueva se implementa dos
   veces y pueden divergir visualmente.
6. **Archivos gigantes.** `GeneradorInfografiaTV.jsx` (~2,400 líneas) y
   `main.js` del shell siguen creciendo; falta partirlos en módulos (canvas,
   paneles, editor, catálogos).
7. **Sin versión de esquema en el proyecto.** `normalizeCfg` migra por
   heurísticas (¿existe `talentos`? ¿existe `sets`?). Un campo `schema: N`
   haría las migraciones explícitas y seguras.
8. **El diagrama ignora el modelo nuevo.** Sincroniza cámaras/mics/fuentes,
   pero no distingue micrófonos inalámbricos que requieren receptor RX, ni
   conoce talentos o sets múltiples.
9. **Cero pruebas del frontend.** Solo hay tests de Go (launch/filtros). Los
   candidatos ideales: `normalizeCfg` (migraciones), `instanciarSetup`,
   `importProjectFromText`, `autoConnect` del diagrama.
10. **Sin reconciliación multi-ventana.** El mismo proyecto abierto en dos
    ventanas no sincroniza cambios entre ellas (solo el lanzador escucha el
    evento `storage`).
11. **Eliminar proyecto es irreversible.** La confirmación de dos pasos ayuda,
    pero no hay papelera ni deshacer tras confirmar.

## 🟡 Mejoras de experiencia (fricción diaria)

12. **Teleprompter real inexistente.** El prompter de Producción muestra la
    nota estática del segmento; falta un teleprompter con guion por segmento,
    auto-scroll con velocidad regulable y modo espejo (TeleprompterView se
    eliminó en v0.6; recuperable del zip v0.5.0 como base).
13. **Sin búsqueda ni filtros de proyectos** en Inicio (la lista muestra 8 de
    hasta 60), y sin aviso al acercarse al tope de 60.
14. **Sin arrastrar y soltar `.ptv`** sobre la ventana para importar (hoy:
    botón o doble clic en Finder).
15. **El wizard no sugiere iluminación ni mobiliario** según el tipo de
    producción (la recomendación existe solo dentro del panel de Set).
16. **⌘S no hace nada.** El autoguardado es silencioso; un atajo que fuerce
    guardado + exporte respaldo daría tranquilidad.
17. **Accesibilidad limitada.** Sin navegación por teclado en los canvas, pocos
    roles/etiquetas ARIA, y contrastes bajos en textos secundarios del tema
    oscuro.
18. **Idioma único (es-MX) hardcodeado.** Correcto para el público actual, pero
    sin capa de textos centralizada, traducir después será costoso.

## 🔵 Exportación e impresión

19. **PDF depende del diálogo de impresión del SO** (no hay "guardar PDF como
    archivo" directo con nombre sugerido).
20. **PNG vía html2canvas a escala 1x.** SVGs grandes pueden salir borrosos y
    algunas tipografías/emoji se rasterizan feo; falta factor de escala (2x/3x).
21. **Impresión de la infografía con zoom fijo (0.6).** Contenidos largos se
    cortan o desperdician página; falta ajuste automático por contenido.

## Cosas que ya se pagaron (resueltas en v0.7.0-dev)

- ✅ Formato propio `.ptv` con asociación de archivos (doble clic importa) e
  importador en Inicio — antes NO existía ninguna vía de importación.
- ✅ Migración de datos legados (sets, talentos, mics tipados) vía normalizeCfg.
- ✅ "Reacomodar automáticamente" ya no apila luces/muebles al centro.
- ✅ Diagrama: clic para editar, arrastre desde paleta, autoconexión, ayuda.
- ✅ Confirmaciones de dos pasos en acciones destructivas (sin window.confirm).

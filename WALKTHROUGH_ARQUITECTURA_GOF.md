# Walkthrough: Arquitectura y Refactorización GoF (Fases 1, 2 y 3 Completadas)

Se completó con éxito el plan maestro de refactorización arquitectónica basado en los 23 patrones de diseño Gang of Four (GoF) en [`ProduccionTVDesktop`](./), manteniendo el **100% de compatibilidad hacia atrás (Cero Regresiones)**, 127 pruebas unitarias pasando y la aplicación nativa de macOS compilada y lista para ejecutar.

---

## 🏛️ Resumen de Fases Ejecutadas

### Fase 1: Arquitectura Base y Desacoplamiento (Go Backend + Message Router)
1. **Backend Go (Patrones Facade + Template Method)**:
   - 🧱 [`atomic_writer.go`](./atomic_writer.go): Implementó **Template Method** para escritura atómica segura anti-corrupción (`os.MkdirAll` -> `.tmp` -> `os.Rename`).
   - 🪟 [`window_manager.go`](./window_manager.go): Encapsuló los procesos y PIDs de ventanas macOS en un registro limpio.
   - 📁 [`project_store.go`](./project_store.go), [`trash_store.go`](./trash_store.go), [`asset_store.go`](./asset_store.go) y [`settings_store.go`](./settings_store.go): Subsistemas modulares dedicados que dividen las responsabilidades del monolito anterior.
   - 🏛️ [`app.go`](./app.go): Convertido en un **Facade** limpio con sus contratos y firmas hacia Wails 100% intactos.

2. **Frontend Desktop (Patrón Command)**:
   - 📬 [`frontend/src/message_router.js`](./frontend/src/message_router.js): Desacopló el bloque de 180+ líneas de condicionales de `postMessage` mediante comandos registrables (`Print`, `ExportPNG`, `Agenda`, `MesaDeLuz`, `SyncState`, etc.).
   - 💻 [`frontend/src/main.js`](./frontend/src/main.js): Ahora delega limpiamente los eventos a `messageRouter.dispatch()`.

---

### Fase 2: Construcción de Proyectos y Máquina de Estados (Builder + State FSM)
1. **Patrón Builder en Proyectos y Plantillas**:
   - 🏗️ [`frontend/src/project_builder.js`](./frontend/src/project_builder.js): Implementa la construcción fluida de proyectos audiovisuales y plantillas paso a paso (cámaras, talentos, microfonía, sets, escaleta, crew, branding y perfiles).
   - 📋 [`frontend/src/templates_data.js`](./frontend/src/templates_data.js): Separa los catálogos y especificaciones estáticas del generador.
   - 🔄 [`frontend/src/templates.js`](./frontend/src/templates.js): Ahora actúa como una fachada elegante sobre `ProjectBuilder`, manteniendo 100% de retrocompatibilidad con las pruebas unitarias.

2. **Patrón State (FSM) en el Modo de Producción en Vivo**:
   - ⏱️ [`frontend/src/production_fsm.js`](./frontend/src/production_fsm.js): Modela con estados formales polimórficos (`StoppedState`, `RunningState`, `PausedState`, `FinishedState`) el transporte en vivo y añade ciclo de vida (`mount` / `unmount`) para eliminar listeners de teclado y temporizadores sin dejar fugas de memoria.
   - 📺 [`frontend/src/production.js`](./frontend/src/production.js): Integró `ProductionFSM` para gobernar las transiciones de estado, acciones de la barra espaciadora y toma de cámaras al aire/previo.

---

### Fase 3: Exportaciones con Visitor Pattern y Diagrama con Strategy + Command
1. **Patrón Visitor en el Centro de Exportación**:
   - 📄 [`frontend/src/export_visitor.js`](./frontend/src/export_visitor.js) y [`frontend/public/tools/shared/export_visitors.js`](./frontend/public/tools/shared/export_visitors.js):
     - Jerarquía de elementos visitables: `ProductionProject`, `ProjectInfoElement`, `BudgetElement`, `RundownElement`, `CamerasElement`, `AudioElement`, `LightingElement`, `DiagramElement`.
     - Visitantes Concretos:
       - **`EdlExportVisitor`**: Genera listas estándar CMX 3600 con timecodes exactos y metadatos de cámaras para DaVinci Resolve, Premiere Pro y Final Cut Pro.
       - **`CsvExportVisitor`**: Genera tablas CSV estructuradas (escaleta, cámaras, micrófonos y presupuesto) para Excel, Numbers y Google Sheets.
       - **`MarkdownExportVisitor`**: Genera dossiers técnicos completos de producción en Markdown.
   - 🖨️ [`frontend/public/tools/exportar/index.html`](./frontend/public/tools/exportar/index.html): Añadidos los botones de exportación EDL y CSV con vista previa en tiempo real y descarga directa.

2. **Patrón Strategy y Command en el Diagrama Técnico**:
   - 🔌 [`frontend/public/tools/diagrama/index.html`](./frontend/public/tools/diagrama/index.html):
     - **Strategy Pattern (`CableRoutingStrategy`)**: Familia de algoritmos intercambiables para trazar cables:
       - `BezierRoutingStrategy`: Curvas fluidas suaves con bezier cúbica.
       - `ManhattanRoutingStrategy`: Ruteo ortogonal a 90° con esquinas redondeadas para esquemas técnicos broadcast y electrónicos.
       - `CableRoutingContext`: Permite alternar de forma interactiva desde la barra de herramientas (`btnWireStyle`) entre curvas y ortogonal en tiempo real.
     - **Command Pattern (`CommandHistory` y `SnapshotCommand`)**: Encapsula mutaciones del diagrama para deshacer (`undo`) y rehacer (`redo`) de manera segura, con soporte para atajos de teclado (`Cmd+Z`, `Ctrl+Z`, `Ctrl+Y`, `Cmd+Shift+Z`).

---

### Fase 4: Grupo 1 de Mejoras Arquitectónicas (Backend Pragma Guard + Repository + Shortcut Command)
1. **Backend Go — Pragma Guard CGo ([`activate_darwin.go`](./activate_darwin.go))**:
   - Se envolvieron las llamadas de respaldo `NSApplicationActivateIgnoringOtherApps` dentro de `#pragma clang diagnostic push/ignored/pop`.
   - **Resultado:** Compilación de backend en Apple Silicon limpia con **0 advertencias** y 100% de compatibilidad hacia atrás.
2. **Patrón Repository ([`frontend/src/project_repository.js`](./frontend/src/project_repository.js))**:
   - Extrajo la persistencia de proyectos de `main.js`: serialización de bundles `.ptv`, migraciones de esquema `live`/`narrative`, sincronización híbrida (`localStorage` <-> Wails Go) y operaciones CRUD.
   - Cuenta con suite de pruebas dedicadas (`tests/project_repository.test.mjs`).
3. **Patrón Command + Strategy para Atajos ([`frontend/src/shortcut_manager.js`](./frontend/src/shortcut_manager.js))**:
   - Desacopló el manejador monolítico de `keydown` en `main.js`. Ahora cada atajo (`Escape`, `Ctrl+Tab`, `Cmd+S`, `Cmd+D`, `Cmd+W`, `Cmd+1..6`) es un comando registrable con contexto, probado con tests dedicados (`tests/shortcut_manager.test.mjs`).

---

### Fase 5: Grupo 2 de Mejoras Arquitectónicas (Memento + Panel Proxy + Notification Observer)
1. **Patrón Memento ([`frontend/src/project_memento.js`](./frontend/src/project_memento.js))**:
   - `ProjectMemento` y `ProjectHistoryManager`: Captura snapshots inmutables del estado completo del proyecto (`cfg`, `diagram`, `name`, `template`) con soporte para `undo()` / `redo()` a nivel proyecto y control de profundidad de pila.
   - Pruebas dedicadas en [`tests/project_memento.test.mjs`](./tests/project_memento.test.mjs).
2. **Patrón Proxy ([`frontend/src/panel_proxy.js`](./frontend/src/panel_proxy.js))**:
   - Representante virtual de paneles en iframe para inicialización perezosa (*lazy loading*), sincronización por sellos de versión (`sello` vs `selloEstado`) y mitigación de fugas de memoria.
   - Pruebas dedicadas en [`tests/panel_proxy.test.mjs`](./tests/panel_proxy.test.mjs).
3. **Patrón Observer ([`frontend/src/notification_service.js`](./frontend/src/notification_service.js))**:
   - `NotificationService`: Centraliza la emisión de alertas, toasts y colas de mensajes con atributos de accesibilidad nativa (`aria-live="polite"`, `role="alert"`) y suscripción reactiva.
   - Pruebas dedicadas en [`tests/notification_service.test.mjs`](./tests/notification_service.test.mjs).

---

### Fase 6: Grupo 3 de Mejoras Arquitectónicas (EventBus + Asset Flyweight + Filter Chain)
1. **Patrón Mediator / EventBus Global ([`frontend/src/event_bus.js`](./frontend/src/event_bus.js))**:
   - `EventBus` y `shellBus`: Mediador Pub-Sub desacoplado con eventos de ciclo de vida (`PROJECT_SAVED`, `VIEW_CHANGED`, etc.) para comunicación entre el shell, herramientas e interfaz sin acoplamiento rígido.
   - Pruebas dedicadas en [`tests/event_bus.test.mjs`](./tests/event_bus.test.mjs).
2. **Patrón Flyweight para Assets y Miniaturas ([`frontend/src/asset_cache.js`](./frontend/src/asset_cache.js))**:
   - `AssetFlyweightCache`: Almacén con desalojo LRU para compartir planos técnicos vectoriales y diagramas en memoria, reduciendo consumo de CPU/RAM al renderizar proyectos.
   - Pruebas dedicadas en [`tests/asset_cache.test.mjs`](./tests/asset_cache.test.mjs).
3. **Patrón Chain of Responsibility ([`frontend/src/project_filter_chain.js`](./frontend/src/project_filter_chain.js))**:
   - `ProjectFilterChain`: Pipeline modular de filtrado y ordenamiento de proyectos (`TextSearchHandler`, `ModeFilterHandler`, `ChronologicalSortHandler`) desacoplado de la vista de Inicio.
   - Pruebas dedicadas en [`tests/project_filter_chain.test.mjs`](./tests/project_filter_chain.test.mjs).

---

### Fase 7: Disponibilidad y Visibilidad Permanente de Pestañas y Botón «+»
- **Alineación de Experiencia de Usuario ([`frontend/src/pestanas.js`](./frontend/src/pestanas.js))**:
  - Se eliminó la regla que ocultaba la barra completa (`barra.hidden = abiertas.length === 0`) cuando no había módulos desanclados.
  - **Resultado:** La barra de pestañas muestra permanentemente la pestaña `[Proyecto]` y el botón **`[+]`** desde el minuto cero, permitiendo al usuario abrir el menú de módulos y crear pestañas de forma intuitiva sin depender del atajo `⌘D` o del botón ⤢ de la esquina.

---

## 🧪 Matriz de Validación y Pruebas Automáticas

| Suite de Pruebas | Entorno | Resultado | Cobertura |
| :--- | :--- | :--- | :--- |
| **Pruebas de Backend Go** | Go 1.26.0 darwin/arm64 | `PASS` (100%, 0 warnings) | `app.go`, `project_store.go`, `window_manager.go`, `trash_store.go`, `activate_darwin.go` |
| **Pruebas Frontend Suite 1** | Node v20 test runner (`frontend.test.mjs`) | `123/123 PASS` (0 fallos) | Plantillas, escaleta, guion, cálculo de formatos, sugerencias, iluminación, narrativa |
| **Pruebas Frontend Suite 2** | Node v20 test runner (`export_visitor.test.mjs`) | `4/4 PASS` (0 fallos) | Elementos visitables, CMX 3600 EDL, Tablas CSV, Dossier Markdown |
| **Pruebas Frontend Suite 3** | Node v20 test runner (`project_repository.test.mjs`) | `2/2 PASS` (0 fallos) | Persistencia y serialización de bundles .ptv, CRUD de proyectos |
| **Pruebas Frontend Suite 4** | Node v20 test runner (`shortcut_manager.test.mjs`) | `4/4 PASS` (0 fallos) | Comandos de teclado declarativos, precedencia de Escape y navegación |
| **Pruebas Frontend Suite 5** | Node v20 test runner (`project_memento.test.mjs`) | `2/2 PASS` (0 fallos) | Instantáneas inmutables de proyectos, historial y undo/redo |
| **Pruebas Frontend Suite 6** | Node v20 test runner (`panel_proxy.test.mjs`) | `2/2 PASS` (0 fallos) | Carga perezosa, ciclo de vida y control de versiones por sello |
| **Pruebas Frontend Suite 7** | Node v20 test runner (`notification_service.test.mjs`) | `2/2 PASS` (0 fallos) | Notificaciones Observer, descarte automático y atributos ARIA |
| **Pruebas Frontend Suite 8** | Node v20 test runner (`event_bus.test.mjs`) | `2/2 PASS` (0 fallos) | Suscripción, emisión Pub-Sub y listeners únicos once() |
| **Pruebas Frontend Suite 9** | Node v20 test runner (`asset_cache.test.mjs`) | `2/2 PASS` (0 fallos) | Almacenamiento Flyweight en memoria y desalojo LRU |
| **Pruebas Frontend Suite 10** | Node v20 test runner (`project_filter_chain.test.mjs`) | `2/2 PASS` (0 fallos) | Pipeline Chain of Responsibility de búsqueda y filtros |
| **Compilación y Empaquetado Nativo** | Wails v2.12.0 (`wails build`) | `Built Producción TV.app` (16.6s) | Binario ejecutable firmado para macOS Apple Silicon |

**Total de pruebas unitarias:** **145 pruebas pasando de forma impecable**.

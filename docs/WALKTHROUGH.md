# Walkthrough: Arquitectura GoF y Corrección del Sistema de Pestañas

Este documento detalla la arquitectura implementada en [`ProduccionTVDesktop`](file:///Volumes/HDEXTERNO/ABIUD%20APP/ProduccionTVDesktop), cubriendo la refactorización basada en los 23 patrones de diseño Gang of Four (GoF) y la solución integral al problema del botón «+» (`#pestana-mas`) en la barra de navegación de pestañas.

---

## 1. 🗂️ Corrección del Botón «+» en la Barra de Pestañas

### 1.1 Diagnóstico del Problema
Al desanclar múltiples módulos (ej. Guion, Mesa de luz, Escaleta, Teleprompter, Audio, etc.):
1. Las pestañas aumentaban el ancho total de `.pestanas`.
2. `.header-nav` posee `overflow-x: auto; scrollbar-width: none;` pero no contaba con soporte para rueda vertical del ratón (`wheel`).
3. Las pestañas tenían un ancho mínimo rígido, empujando el botón `+` (`#pestana-mas`) fuera del marco visible hacia la derecha.
4. Una vez fuera de la vista, al estar en una pestaña desanclada el botón `⌘D` del encabezado se oculta intencionalmente, dejando al usuario sin forma de abrir más pestañas.

### 1.2 Solución Arquitectónica con Patrones de Diseño
1. **Patrón Decorator / Sticky Pinning (`frontend/src/style.css`)**:
   - El botón `.pestana-mas` se convirtió en un elemento con `position: sticky; right: 0; z-index: 6;`.
   - Incorpora fondo con vidrio esmerilado (`backdrop-filter: blur(14px)`) y sombra lateral sutil (`box-shadow: -4px 0 10px -2px rgba(0,0,0,.18)`).
   - **Resultado:** Permanece permanentemente clavado y visible en el borde derecho del viewport de navegación sin importar cuántas pestañas se abran.
2. **Patrón Strategy de Flexibilidad Elástica (`frontend/src/style.css`)**:
   - `.pestanas` pasó a `flex: 0 1 auto; min-width: 0; position: relative`.
   - `.pestana` pasó a `flex: 0 1 auto; min-width: 44px`.
   - `.pestana-txt` cuenta con truncado elíptico suave (`max-width: 132px; text-overflow: ellipsis`) que encoge el texto elegantemente cuando el espacio es reducido, estilo Safari / Chrome.
3. **Patrón Adapter de Eventos de Rueda (`frontend/src/main.js`)**:
   - Adaptador sobre `#header-nav` que intercepta eventos `wheel` (`deltaY`) y los convierte en desplazamiento horizontal (`scrollLeft += deltaY`), permitiendo deslizar las pestañas fluidamente con el ratón.
4. **Patrón Observer / Auto-Scroll (`frontend/src/pestanas.js`)**:
   - Al abrir o activar una pestaña, se ejecuta `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })` para enfocar la pestaña activa y garantizar la visibilidad del botón `+`.
5. **Corrección de Límite en Menú de Módulos (`frontend/src/main.js`)**:
   - Se añadió protección con `Math.max(12, ...)` para asegurar que el popup de módulos disponibles nunca quede fuera del borde izquierdo en ventanas compactas.

---

## 2. 🏛️ Resumen de Fases de Arquitectura GoF

### Fase 1: Arquitectura Base y Desacoplamiento (Go Backend + Message Router)
- **Patrón Facade (`app.go`)**: Unifica la API expuesta a Wails delegando a subsistemas especializados.
- **Patrón Template Method (`atomic_writer.go`)**: Escritura atómica a disco previniendo archivos corruptos ante cortes o cierres inesperados.
- **Patrón Command (`message_router.js`)**: Enrutamiento declarativo de mensajes `postMessage` entre las herramientas iframe y la ventana anfitriona.

### Fase 2: Construcción de Proyectos y Máquina de Estados (Builder + State FSM)
- **Patrón Builder (`project_builder.js` + `templates.js`)**: Construcción paso a paso y validada de proyectos audiovisuales y plantillas.
- **Patrón State FSM (`production_fsm.js` + `production.js`)**: Máquina de estados formal (`Stopped`, `Running`, `Paused`, `Finished`) para el modo de producción en vivo con limpieza de listeners de memoria.

### Fase 3: Exportaciones con Visitor y Diagrama con Strategy + Command
- **Patrón Visitor (`export_visitor.js` + `export_visitors.js`)**:
  - Exportación CMX 3600 EDL para DaVinci Resolve / Premiere Pro.
  - Exportación CSV estructurado para Excel / Google Sheets.
  - Dossier técnico completo en Markdown.
- **Patrón Strategy en Diagrama (`CableRoutingStrategy`)**: Alternancia en vivo entre curvas suaves Bézier y ruteo ortogonal a 90° (Manhattan).
- **Patrón Command en Diagrama (`CommandHistory`)**: Deshacer (`Cmd+Z`) y rehacer (`Cmd+Shift+Z`) para conexiones de cables y nodos.

### Fase 4: Grupo 1 de Refactorización GoF
- **Backend Go Pragma Guard (`activate_darwin.go`)**: Compilación 100% limpia sin advertencias de Clang para macOS Apple Silicon.
- **Patrón Repository (`project_repository.js`)**: Persistencia híbrida disco/localStorage desacoplada con pruebas unitarias dedicadas.
- **Patrón Command + Strategy (`shortcut_manager.js`)**: Gestor declarativo de atajos de teclado con validación de contexto y desacoplamiento de eventos.

### Fase 5: Grupo 2 de Refactorización GoF
- **Patrón Memento (`project_memento.js`)**: Instantáneas inmutables y gestión de historial a nivel proyecto para Deshacer/Rehacer.
- **Patrón Proxy (`panel_proxy.js`)**: Representante virtual de paneles en iframe para lazy loading y sincronización controlada por sellos de versión.
- **Patrón Observer (`notification_service.js`)**: Servicio centralizado de avisos toast y diálogos accesibles (`aria-live="polite"`).

### Fase 6: Grupo 3 de Refactorización GoF
- **Patrón Mediator / EventBus (`event_bus.js`)**: Mediador Pub-Sub desacoplado con eventos de ciclo de vida del shell desktop.
- **Patrón Flyweight (`asset_cache.js`)**: Caché LRU para compartir planos vectoriales y diagramas en memoria con mínimo uso de recursos.
- **Patrón Chain of Responsibility (`project_filter_chain.js`)**: Pipeline desacoplado de búsqueda, filtrado por modo y ordenamiento cronológico.

### Fase 7: Visibilidad Permanente del Botón «+»
- **Barra de Pestañas Siempre Activa (`pestanas.js`)**: El botón `[+]` y la pestaña `[Proyecto]` permanecen visibles desde el primer instante en la ventana de cualquier proyecto, permitiendo abrir módulos con un solo clic sin depender del atajo `⌘D`.

---

## 3. 🧪 Matriz de Validación

- **Pruebas de Backend Go:** 100% pasando (`go test ./...`, 0 warnings).
- **Pruebas Unitarias Frontend:** **145/145 pasando** (`npm test`, 0 fallos).
- **Compilación Nativa macOS:** Generación exitosa y limpia de `Producción TV.app` con Wails v2.12.0 en Apple Silicon (darwin/arm64).

# Guía Oficial del Sistema de Diseño: Apple Liquid Glass & Patrones GoF
**Producción TV Desktop (macOS HIG)**

---

## 1. Visión y Filosofía del Sistema

El sistema visual de **Producción TV** está basado en las directrices de diseño de **Apple Human Interface Guidelines (macOS Big Sur, Sonoma, Sequoia y visionOS)**, combinadas con los estándares de **Vidrio Líquido (Liquid Glass)** y una arquitectura de software sustentada en los **23 Patrones de Diseño Gang of Four (GoF)**.

### Principios Fundamentales:
1. **Materiales Vivos y Translucidez Óptica**: La interfaz nunca utiliza muros opacos planos que desarticulen las secciones. Cada panel, tarjeta y barra es un material translúcido esmerilado que deja traslucir sutilmente la iluminación ambiental del foro (`.pared`) y las tonalidades de etapa (*gels*).
2. **Jerarquía Visual y Contraste (WCAG 2.1 AA/AAA)**: Los textos primarios siempre garantizan legibilidad absoluta (`#F2EFE9` sobre oscuro, `#171512` sobre claro). Los elementos interactivos activos destacan mediante acentos del sistema (*Apple System Blue* `#0A84FF` o el gel de la etapa) con halos de luz concentrados.
3. **Física de Resorte Apple (Spring Physics)**: Toda micro-interacción responde con aceleraciones naturales mediante funciones de resorte `cubic-bezier(.16, 1, .3, 1)` para apertura/hover y `cubic-bezier(.2, .8, .2, 1)` para toques táctiles (*touch-down*).

---

## 2. Patrones de Diseño GoF Implementados

| Patrón GoF | Clasificación | Componente en el Proyecto | Propósito y Responsabilidad |
| :--- | :--- | :--- | :--- |
| **Abstract Factory** | Creacional | `UIComponentFactory` (`frontend/src/ui_component_factory.js`) | Centraliza la fabricación desacoplada y accesible de controles Apple HIG (botones de barra lateral, chips de filtro, controles segmentados, barras de búsqueda, headers de modal, etc.). |
| **Builder** | Creacional | `ProjectCardBuilder`, `TemplateCardBuilder` | Ensambla progresivamente tarjetas complejas de proyectos y plantillas (vistas cuadrícula, lista y hero) con micro-chips de hardware y badges de vidrio. |
| **Prototype** | Creacional | `cloneTemplate` (`frontend/src/plantillas.js`) | Clona configuraciones complejas de sets y escenarios garantizando copias profundas sin mutaciones colaterales. |
| **Composite** | Estructural | `UIComponentFactory.createSidebarGroup`, `PreflightChecklistComposite` | Modela estructuras jerárquicas como árboles uniformes (grupos de barra lateral conteniendo botones y divisores; checklists técnicos compuestos). |
| **Flyweight** | Estructural | `globalAssetCache`, Tokens CSS (`--vidrio-a`, `--vidrio-b`) | Comparte de forma inmutable texturas SVG, iconos y variables de color en GPU para evitar fugas de memoria y repintados innecesarios. |
| **Proxy** | Estructural | `PanelProxy` (`frontend/src/panel_proxy.js`) | Controla el acceso, inicialización diferida y sincronización de sellos de versión de las herramientas dentro de iframes. |
| **Strategy** | Comportamiento | `ProjectViewStrategy`, `TemplateViewStrategy`, `LayoutStrategies` | Permite intercambiar en tiempo de ejecución las estrategias de presentación (Cuadrícula / Lista tipo Finder) y distribución física de cámaras en el set. |
| **State** | Comportamiento | `ProductionFSM`, `CanvasStateMachine` | Gestiona las transiciones formales de estado (ensayo, grabación, corte, aire) y estados de interacción del lienzo (selección, desplazamiento). |
| **Command** | Comportamiento | `SetCommandManager`, `ProductionCommandManager` | Encapsula cada acción de usuario como un objeto ejecutable con soporte completo para Deshacer/Rehacer (Undo/Redo ⌘Z / ⌘⇧Z). |
| **Memento** | Comportamiento | `ProjectMemento`, `ProjectHistoryManager` | Guarda y restaura instantáneas inmutables del estado del proyecto para auditoría y recuperación segura. |
| **Observer** | Comportamiento | `NotificationService`, `shellBus` (EventBus) | Comunicación reactiva desacoplada entre vistas, herramientas iframe y barra lateral. |
| **Chain of Responsibility**| Comportamiento | `ProjectFilterChain`, `TemplateFilterChain` | Filtra y procesa consultas de búsqueda y categorías secuencialmente por prioridad. |

---

## 3. Catálogo Maestro de Tokens (Liquid Glass Tokens)

### 3.1 Materiales y Transparencias
```css
/* Color de fondo base homologado para toda la ventana */
background-color: #091423;

/* Fondos de Vidrio Líquido de Alta Translucidez */
--vidrio-a: rgba(255, 255, 255, 0.04);    /* Superficie primaria de tarjetas y paneles */
--vidrio-b: rgba(255, 255, 255, 0.015);   /* Superficie secundaria / contenedores internos */
--vidrio-borde: rgba(255, 255, 255, 0.08); /* Delimitador cristalino de 1px */
--vidrio-filo: rgba(255, 255, 255, 0.11);  /* Reflejo especular superior de luz */

/* Efecto de Desenfocado y Saturación (Backdrop Filter) */
-webkit-backdrop-filter: blur(28px) saturate(190%);
backdrop-filter: blur(28px) saturate(190%);
```

### 3.2 Iluminación y Reflejo Especular
Para dar profundidad óptica auténtica a los materiales flotantes, cada tarjeta y contenedor incorpora un reflejo especular en el borde superior:
```css
box-shadow: inset 0 1px 0 var(--vidrio-filo), var(--lg-shadow-sm);
```

### 3.3 Sombras y Elevación Concéntrica
```css
--lg-shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.25);
--lg-shadow-md: 0 12px 28px -10px rgba(0, 0, 0, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.15);
--lg-shadow-lg: 0 24px 50px -16px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.25);
```

### 3.4 Tipografía Oficial Apple HIG
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif;
-webkit-font-smoothing: antialiased;

/* Escala Semántica */
--heading-1: 700 32px/1.2 var(--font-family);  /* Título de sección */
--heading-2: 700 22px/1.25 var(--font-family); /* Título de tarjeta hero */
--heading-3: 600 15px/1.3 var(--font-family);  /* Nombre de proyecto / plantilla */
--body-text: 400 13px/1.45 var(--font-family); /* Metadatos y descripciones */
--caption:   700 10.5px/1.2 var(--font-family);/* Eyebrows y tags técnicos */
```

---

## 4. Anatomía de Componentes y Estándares

### 4.1 Barra Lateral Flotante (`.rail`)
- **Estructura Flotante**:
  - `width: 92px;`
  - `margin: 14px 0 14px 14px;`
  - `border-radius: 20px;`
  - `background: linear-gradient(175deg, rgba(255,255,255,.075), rgba(255,255,255,.022));`
  - `backdrop-filter: blur(36px) saturate(200%);`
  - `border: 1px solid var(--vidrio-borde);`
- **Botones Internos**:
  - Anchura unificada: `width: 76px;`
  - Curvatura ergonómica: `border-radius: 14px;`
  - Estado activo (Inicio): Fondo `rgba(10, 132, 255, 0.18)` con borde `rgba(10, 132, 255, 0.4)`, texto `#ffffff` nítido e icono azul `#0A84FF`.
  - Estado activo (Etapas): Halo del gel correspondiente con insignia numérica SF Pro Tabular.
- **Logo Viajero (`.rail-logo`)**:
  - Dimensiones: `34px × 34px`, centrado a `left: 43px; top: 27px;`.
  - Viaje GPU en 3D (`translate3d(-20px, -3px, 0) scale(.882)`) al plegarse la barra, integrándose en el encabezado.

### 4.2 Encabezado Unificado (`.workspace-header`)
- `min-height: 54px; margin: 14px 14px 0; border-radius: 18px;`
- Material: `linear-gradient(165deg, rgba(255,255,255,.07), rgba(255,255,255,.022))`, con `blur(34px) saturate(190%)`.
- Pestañas elásticas tipo Xcode / Safari (`.pestana`) con micro-animaciones de hover y compresión inteligente.

### 4.3 Tarjetas Hero y Proyectos (`.continue-card`, `.quick-launch-card`, `.proj-card`)
- **Fondo Translúcido**: `linear-gradient(165deg, rgba(255,255,255,.065), rgba(255,255,255,.018))` con `blur(24px) saturate(190%)`.
- **Borde de luz**: `border: 1px solid var(--vidrio-borde)` con realce superior `inset 0 1px 0 var(--vidrio-filo)`.
- **Hover**: Elevación `translateY(-3px)` con acento sutil azul Apple `rgba(10, 132, 255, 0.45)` y sombra `var(--lg-shadow-md)`.

### 4.4 Controles de Filtro y Búsqueda
- **Segmented Control Apple HIG**: Altura fija `32px`, fondo `rgba(255, 255, 255, 0.04)`, botones redondeados `7px`.
- **Search Bar con Lupa**: Lupa integrada, fondo `rgba(255, 255, 255, 0.035)`, expansión elástica en foco `width: 230px` con anillo `box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.22)`.

---

## 5. Reglas Maestras para Pulir las Demás Secciones

Al extender o rediseñar las secciones de **1. Perfil**, **2. Guion**, **3. Necesidades**, **4. Planeación** y **5. Producción**:

1. **PROHIBIDO Usar Fondos Sólidos Superpuestos**:
   - Nunca apliques `background: var(--yeso)` o colores sólidos `#1C1A18` sobre vistas secundarias (`.workspace`, `.frame-wrap`, modales). Mantén el fondo general transparente para que la luz ambiental de `.pared` fluya libremente.
2. **Utilizar Siempre `UIComponentFactory` (GoF Abstract Factory)**:
   - Todo botón de acción, control segmentado, chip de selección o encabezado de diálogo debe ser instanciado a través de `UIComponentFactory` para garantizar consistencia en atributos ARIA y clases CSS.
3. **Aplicar la Tríada Liquid Glass en Contenedores**:
   - Toda tarjeta o caja de contenido debe poseer:
     1. Fondo degradado translúcido (`linear-gradient(165deg, rgba(255,255,255,0.065), rgba(255,255,255,0.02))`).
     2. `backdrop-filter: blur(24px) saturate(190%)`.
     3. Reflejo especular superior `box-shadow: inset 0 1px 0 var(--vidrio-filo)`.
4. **Respetar la Paleta Semántica de Etapas**:
   - Etapa 1 (Perfil / Hora azul): `--e1: #3C8FE0`
   - Etapa 2 (Guion / Croma): `--e2: #0FA05E`
   - Etapa 3 (Necesidades / Tungsteno): `--e3: #E08A12`
   - Etapa 4 (Planeación / 2400 K): `--e4: #D9602B`
   - Etapa 5 (Producción / Tally): `--e5: #D53238`
5. **Micro-interacciones Táctiles**:
   - Todo botón interactivo debe tener `:active { transform: scale(0.965); }` con transición rápida de resorte.

/**
 * @file help_strategy.js
 * @description Implementación del Patrón GoF Strategy para el sistema de ayuda contextual.
 * Provee la interfaz HelpStrategy y las familias de algoritmos/contenidos concretos
 * adaptados a cada etapa del flujo de producción audiovisual.
 */

/**
 * Interfaz base de Estrategia de Ayuda (GoF Strategy).
 */
export class HelpStrategy {
    /**
     * @param {Object} config
     * @param {string} config.id - Identificador único de la estrategia
     * @param {string} config.title - Título descriptivo de la sección
     * @param {string} config.stageBadge - Insignia o número de etapa (ej. "Inicio", "Etapa 1", "En vivo")
     * @param {string} config.summary - Resumen breve del propósito de la sección
     * @param {Array<{titulo: string, descripcion: string}>} [config.tips=[]] - Consejos prácticos
     * @param {Array<{teclas: string[], accion: string}>} [config.shortcuts=[]] - Atajos de teclado relevantes
     */
    constructor({ id, title, stageBadge, summary, tips = [], shortcuts = [] }) {
        this.id = id;
        this.title = title;
        this.stageBadge = stageBadge;
        this.summary = summary;
        this.tips = tips;
        this.shortcuts = shortcuts;
    }

    /**
     * Obtiene los consejos contextuales adaptados al estado dinámico del proyecto.
     * @param {Object} context - Estado actual { activeProject, activeView, etapa, ... }
     * @returns {Array<{titulo: string, descripcion: string}>}
     */
    getTips(context = {}) {
        return this.tips;
    }

    /**
     * Obtiene los atajos de teclado prioritarios para la sección.
     * @param {Object} context
     * @returns {Array<{teclas: string[], accion: string}>}
     */
    getShortcuts(context = {}) {
        return this.shortcuts;
    }

    /**
     * Título resuelto para el encabezado de ayuda.
     * @param {Object} context
     * @returns {string}
     */
    getTitle(context = {}) {
        return this.title;
    }
}

/**
 * Estrategia Concreta: Inicio y Plantillas de Proyecto.
 */
export class HomeHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'home',
            title: 'Inicio y Gestión de Proyectos',
            stageBadge: 'Inicio',
            summary: 'Gestiona tu catálogo de proyectos guardados, explora plantillas preconfiguradas o importa paquetes de trabajo.',
            tips: [
                {
                    titulo: 'Nuevo proyecto',
                    descripcion: 'Crea un proyecto en blanco o basado en plantillas con ⌘N. Elige entre modo «En vivo» (multicámara/noticiero) o «Narrativo» (ficción/cortometraje).'
                },
                {
                    titulo: 'Importar y respaldar',
                    descripcion: 'Puedes arrastrar archivos .ptv o .json directamente para abrirlos o usar el botón Importar proyecto.'
                },
                {
                    titulo: 'Vistas del catálogo',
                    descripcion: 'Alterna entre la vista de Mosaico visual y la vista en Lista compacta estilo Finder desde los botones de la esquina superior derecha.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', 'N'], accion: 'Crear nuevo proyecto' },
                { teclas: ['⌘', 'F'], accion: 'Buscar en la lista de proyectos' },
                { teclas: ['⌘', '1..6'], accion: 'Abrir etapa directa si hay proyecto activo' }
            ]
        });
    }
}

/**
 * Estrategia Concreta: Etapa 1 · Perfil y Mesa de Luz.
 */
export class ProfileHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'perfil',
            title: 'Perfil del Proyecto y Mesa de Luz',
            stageBadge: 'Etapa 1',
            summary: 'Establece las bases conceptuales: quién habla, a qué audiencia se dirige, mensaje clave y referencias visuales.',
            tips: [
                {
                    titulo: 'Datos y Mensaje',
                    descripcion: 'Define el título, la premisa y el llamado a la acción. Estos datos alimentan automáticamente los cintillos de infografía y la portada de exportación.'
                },
                {
                    titulo: 'Mesa de Luz (Moodboard)',
                    descripcion: 'Arrastra imágenes de referencia, paletas de color y estilos de iluminación para inspirar la dirección de arte.'
                },
                {
                    titulo: 'Selector nativo de color',
                    descripcion: 'En macOS puedes abrir el panel de color nativo del sistema haciendo clic en las muestras de color del proyecto.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', '1'], accion: 'Ir a Perfil' },
                { teclas: ['⌘', 'S'], accion: 'Guardar cambios del proyecto' },
                { teclas: ['⌘', 'D'], accion: 'Desanclar sección en pestaña independiente' }
            ]
        });
    }
}

/**
 * Estrategia Concreta: Etapa 2 · Guion, Escaleta y Tiempos.
 */
export class ScriptHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'guion',
            title: 'Guion, Escaleta y Tiempos',
            stageBadge: 'Etapa 2',
            summary: 'Estructura el contenido cronológico del rodaje: parlamentos, bloques temáticos, llamadas de cámara y cálculo de duraciones.',
            tips: [
                {
                    titulo: 'Escaleta editorial vs Rundown técnico',
                    descripcion: 'En la Escaleta editorial defines qué contenido va en cada bloque (objetivo, participantes y recursos). En el Rundown técnico desglosas la operación en cues (cámara al aire, audio y gráficos).'
                },
                {
                    titulo: 'Storyboard y planos visuales',
                    descripcion: 'El Storyboard organiza la vista visual plano a plano. Puedes capturar encuadres directamente con su óptica y focal real desde el Visor 3D del set.'
                },
                {
                    titulo: 'Cálculo de tiempos en tiempo real',
                    descripcion: 'Las duraciones totales, puntos IN y OUT se recalculan solos mientras editas cada segmento o bloque.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', '2'], accion: 'Ir a Guion y Escaleta' },
                { teclas: ['⌘', 'Z'], accion: 'Deshacer último cambio de texto' },
                { teclas: ['⌘', '⇧', 'Z'], accion: 'Rehacer cambio' }
            ]
        });
    }
}

/**
 * Estrategia Concreta: Etapa 3 · Necesidades, Agenda y Ruta de Señal.
 */
export class NeedsHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'necesidades',
            title: 'Personas, Equipos y Diagrama de Señal',
            stageBadge: 'Etapa 3',
            summary: 'Organiza los recursos humanos y técnicos necesarios: elenco, crew, inventario de cámaras y la ingeniería de ruteo de video/audio.',
            tips: [
                {
                    titulo: 'Lista de Equipo y Crew',
                    descripcion: 'Registra los roles del equipo técnico y las especificaciones de cámaras, lentes, micrófonos y luces.'
                },
                {
                    titulo: 'Diagrama de Flujo de Señal',
                    descripcion: 'Conecta salidas de cámaras, consolas y switchers arrastrando cables entre puertos. El imán automático facilita el enganche.'
                },
                {
                    titulo: 'Ruteo Ortogonal vs Curvas',
                    descripcion: 'Usa el botón de estilo de cable para alternar entre curvas Bézier suaves y ruteo técnico Manhattan a 90° con esquinas redondeadas.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', '3'], accion: 'Ir a Necesidades y Diagrama' },
                { teclas: ['⌘', 'Z'], accion: 'Deshacer conexión o movimiento en diagrama' },
                { teclas: ['⌘', 'P'], accion: 'Imprimir esquema de conexiones' }
            ]
        });
    }
}

/**
 * Estrategia Concreta: Etapa 4 · Plano del Set, Visor 3D e Infografías.
 */
export class PlanningHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'planeacion',
            title: 'Plano del Set, Visor 3D e Infografías',
            stageBadge: 'Etapa 4',
            summary: 'Diseña la espacialidad física del foro en 2D, previsualiza tiros de cámara en el Visor 3D y genera cintillos broadcast.',
            tips: [
                {
                    titulo: 'Plano del Set 2D',
                    descripcion: 'Arrastra cámaras, muebles y luces en el lienzo a escala. Puedes girar las cámaras con la manija para orientar su ángulo de tiro.'
                },
                {
                    titulo: 'Visor 3D en Tiempo Real',
                    descripcion: 'Entra a la vista 3D para caminar por el set. Alterna entre vista de Planta, Perspectiva y Cámara individual con cálculo real de focal y sensor.'
                },
                {
                    titulo: 'Capturar al Storyboard',
                    descripcion: 'En la vista de cámara 3D, presiona el botón «Capturar» para enviar el encuadre exacto con datos de focal y tilt al guion o storyboard.'
                },
                {
                    titulo: 'Ciclorama Virtual',
                    descripcion: 'Puedes cambiar el color del fondo del set entre Verde Chroma, Azul o Blanco neutro con contraste en el piso.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', '4'], accion: 'Ir a Planeación y Set' },
                { teclas: ['Espacio'], accion: 'En 3D: alternar modo órbita / inspección' },
                { teclas: ['Esc'], accion: 'Salir de la vista de cámara 3D o cerrar panel' }
            ]
        });
    }
}

/**
 * Estrategia Concreta: Documentos y Centro de Exportación.
 */
export class DocumentsHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'salida',
            title: 'Centro de Exportación y Guías de Set',
            stageBadge: 'Documentos',
            summary: 'Genera el paquete de entrega profesional: listas de edición EDL, hojas de llamado, desglose de cámaras e informes técnicos.',
            tips: [
                {
                    titulo: 'Exportación EDL CMX 3600',
                    descripcion: 'Descarga la lista EDL estándar compatible con DaVinci Resolve, Adobe Premiere Pro y Apple Final Cut Pro con timecodes calculados.'
                },
                {
                    titulo: 'Exportación CSV / Hojas de cálculo',
                    descripcion: 'Exporta la escaleta técnica, lista de equipamiento y contactos en formato CSV para Excel o Google Sheets.'
                },
                {
                    titulo: 'Guías de Set Imprimibles',
                    descripcion: 'Genera carpetas de producción de alta calidad en PDF con planos cenitales, notas del director y lista de tiros.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', '5'], accion: 'Ir a Documentos y Exportación' },
                { teclas: ['⌘', 'P'], accion: 'Abrir diálogo de impresión nativo' }
            ]
        });
    }
}

/**
 * Estrategia Concreta: Ensayo, Sala de Control y Conexión OBS / ATEM.
 */
export class LiveProductionHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'ensayo',
            title: 'Sala de Control en Vivo (OBS & ATEM)',
            stageBadge: 'En vivo',
            summary: 'Conduce el rodaje en tiempo real con cronómetro regresivo de bloques, luces Tally, teleprompter y control remoto de switchers.',
            tips: [
                {
                    titulo: 'Conexión con OBS Studio',
                    descripcion: 'Pulsa el botón «Switcher externo» para conectar con OBS WebSocket v5. Puedes usar «Buscar OBS en la red» para detección automática local o remota.'
                },
                {
                    titulo: 'Conexión con Blackmagic ATEM',
                    descripcion: 'Permite enlazar switchers ATEM mediante protocolo UDP en la red local para cambiar cámaras al aire y previo.'
                },
                {
                    titulo: 'Control de Transporte (FSM)',
                    descripcion: 'Presiona la Barra espaciadora para Iniciar, Pausar o Reanudar el ensayo. El reloj calculará el desvío de tiempo respecto a la escaleta.'
                },
                {
                    titulo: 'Luces Tally y Teclado',
                    descripcion: 'Usa las teclas 1..9 para conmutar cámaras al aire (Rojo) y previo (Verde). Se reflejan automáticamente en el switcher conectado.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', '6'], accion: 'Ir a Sala de Control (Modo En vivo)' },
                { teclas: ['Espacio'], accion: 'Iniciar / Pausar cronómetro en vivo' },
                { teclas: ['1..9'], accion: 'Seleccionar cámara activa al aire' },
                { teclas: ['⌘', 'T'], accion: 'Alternar visualización de Teleprompter' }
            ]
        });
    }
}

/**
 * Estrategia por defecto (Fallback para vistas generales).
 */
export class DefaultHelpStrategy extends HelpStrategy {
    constructor() {
        super({
            id: 'default',
            title: 'Ayuda de Producción TV',
            stageBadge: 'General',
            summary: 'Suite offline de producción audiovisual con herramientas para diseño de sets, diagramas broadcast y control en vivo.',
            tips: [
                {
                    titulo: 'Navegación rápida',
                    descripcion: 'Usa la barra lateral izquierda o los atajos ⌘1 a ⌘6 para moverte entre las diferentes etapas de la producción.'
                },
                {
                    titulo: 'Guardado continuo',
                    descripcion: 'Los cambios se guardan localmente de forma automática y segura en tu disco para evitar pérdidas de datos.'
                },
                {
                    titulo: 'Recorrido guiado paso a paso',
                    descripcion: 'Puedes iniciar un recorrido visual interactivo en cualquier momento con el botón al final de esta ventana.'
                }
            ],
            shortcuts: [
                { teclas: ['⌘', '1..6'], accion: 'Navegar entre etapas' },
                { teclas: ['⌘', 'S'], accion: 'Guardar proyecto' },
                { teclas: ['Esc'], accion: 'Cerrar ventanas y menús emergentes' }
            ]
        });
    }
}

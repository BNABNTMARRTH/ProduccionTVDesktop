// Catálogo de plantillas y conversión entre la infografía y el diagrama de señal.

// Versión del esquema de proyecto. Se estampa en cada cfg nuevo y el
// normalizeCfg del generador la usa para migrar de forma explícita.
// 1 = un solo set en cfg.setLayout · 2 = sets[] + talentos/mics tipados ·
// 3 = sugerencias del asistente (iluminación/mobiliario) aplicadas al crear.
export const SCHEMA_VERSION = 3;

export const NAVY = '#16365F';
const COLORS = ['#1D6FD1', '#1FA14E', '#F07F13', '#8B5CF6', '#E0312F', '#0E9F9E', '#D1268F', '#4F46E5'];

// Secciones visibles de la hoja de Infografía. (flujo/monitores/leyenda quedaron
// deprecadas: el generador las ignora al renderizar, pero siguen siendo ids
// válidos en proyectos viejos.)
const SECTION_DEFAULTS = ['estudio', 'escaleta', 'personal', 'timeline']
    .map((id) => ({ id, abierto: true }));

export const templateCatalog = [
    { id: 'vacio', icon: '＋', name: 'Proyecto vacío', detail: 'Comienza sin cámaras ni equipos' },
    { id: 'podcast', icon: '◉', name: 'Podcast', detail: '2 cámaras · 4 micrófonos · conversación' },
    { id: 'noticiero', icon: '▤', name: 'Noticiero', detail: '3 cámaras · VTR · gráficos · cortes' },
    { id: 'entrevista', icon: '◌', name: 'Entrevista', detail: '3 cámaras · 3 micrófonos · invitado' },
    { id: 'streaming', icon: '⌁', name: 'Streaming', detail: '2 cámaras · presentación · plataforma' },
    { id: 'multicamara', icon: '▦', name: 'Evento multicámara', detail: '5 cámaras · 4 micrófonos · cobertura' },
];

// Roles de crew disponibles en el asistente. Los `icon` deben existir en el
// catálogo ICONS del generador de infografías (React compilado).
export const CREW_CATALOG = [
    { id: 'director', rol: 'Director de cámaras', icon: 'director' },
    { id: 'switcher', rol: 'Operador de switcher', icon: 'switcher' },
    { id: 'audio', rol: 'Operador de audio', icon: 'audio' },
    { id: 'graficos', rol: 'Operador de gráficos', icon: 'graficos' },
    { id: 'playback', rol: 'Operador de playback', icon: 'playback' },
    { id: 'floor', rol: 'Floor manager', icon: 'floor' },
    { id: 'luces', rol: 'Iluminador', icon: 'luces' },
    { id: 'productor', rol: 'Productor', icon: 'productor' },
    { id: 'script', rol: 'Continuista / Script', icon: 'script' },
];
export const DEFAULT_CREW = ['director', 'switcher', 'audio'];

const LOCATION_LABELS = { int: 'Locación interior (estudio)', ext: 'Locación exterior', mixta: 'Locación mixta (int/ext)' };

// Sugerencias por plantilla: el generador las aplica UNA vez al primer set
// del proyecto (normalizeCfg) y borra las banderas. Los ids de iluminación
// existen en SETUPS_ILUMINACION; los de muebles en MUEBLES_CATALOGO.
const ILUMINACION_SUGERIDA = {
    podcast: 'podcast_practical_setup',
    noticiero: 'news_desk_lighting_setup',
    entrevista: 'three_point_lighting',
    streaming: 'solo_host_streaming_setup',
    multicamara: 'stage_wash_setup',
};
const MUEBLES_SUGERIDOS = {
    podcast: ['sillon1', 'sillon1'],
    entrevista: ['sillon1', 'sillon2'],
    streaming: ['sillon1'],
};

export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const source = (nombre, color, esCorte = false) => ({ id: uid('src'), nombre, color, esCorte });
const camera = (index, plano = 'Plano Medio') => ({ id: uid('cam'), nombre: `CAM ${index}`, plano, color: COLORS[(index - 1) % COLORS.length] });
const mic = (index, conexion = 'XLR') => ({ id: uid('mic'), nombre: `Mic ${index}`, conexion });
const segment = (name, dur, fuente, nota = '') => ({ id: uid('seg'), segmento: name, dur, fuente, nota });

const TEMPLATE_SPECS = {
    vacio: { cams: 0, mics: 0, title: 'NUEVO PROYECTO', extras: () => [], segments: [] },
    podcast: {
        cams: 2, mics: 4, title: 'PODCAST',
        extras: () => [source('PLAYBACK / MÚSICA', '#D1268F')],
        segments: [['Open', 20], ['Presentación', 60], ['Conversación', 600], ['Cierre', 40]],
    },
    noticiero: {
        cams: 3, mics: 2, title: 'NOTICIERO',
        extras: () => [source('VTR / VIDEO', '#64748B'), source('GRÁFICOS / GFX', '#0E9F9E'), source('COMERCIALES', '#F3C513', true)],
        segments: [['Open Show', 20], ['Titulares', 60], ['Nota principal', 150], ['Comerciales', 30], ['Cierre', 30]],
    },
    entrevista: {
        cams: 3, mics: 3, title: 'ENTREVISTA',
        extras: () => [source('GRÁFICOS / GFX', '#0E9F9E')],
        segments: [['Presentación', 45], ['Pregunta inicial', 120], ['Conversación', 480], ['Despedida', 45]],
    },
    streaming: {
        cams: 2, mics: 1, title: 'STREAMING EN VIVO',
        extras: () => [source('PRESENTACIÓN / SLIDES', '#F07F13'), source('PLAYBACK / MÚSICA', '#D1268F')],
        segments: [['Cuenta regresiva', 30], ['Bienvenida', 60], ['Contenido principal', 600], ['Preguntas', 300], ['Cierre', 45]],
    },
    multicamara: {
        cams: 5, mics: 4, title: 'EVENTO MULTICÁMARA',
        extras: () => [source('VTR / VIDEO', '#64748B'), source('GRÁFICOS / GFX', '#0E9F9E')],
        segments: [['Pre-show', 120], ['Apertura', 90], ['Bloque principal', 1200], ['Intermedio', 300], ['Cierre', 90]],
    },
};

// Valores por defecto de cada plantilla, para pre-llenar el asistente.
export const templateDefaults = (kind) => {
    const spec = TEMPLATE_SPECS[kind] || TEMPLATE_SPECS.streaming;
    return { cams: spec.cams, mics: spec.mics };
};

// `profile` admite, además de la identidad (projectName, company, color, logoDataUrl),
// las respuestas del asistente: cams, location ('int'|'ext'|'mixta'),
// talents [{name, tipo:'conductor'|'invitado'}] y crew [ids de CREW_CATALOG].
export function makeTemplate(kind, profile = {}) {
    const spec = TEMPLATE_SPECS[kind] || TEMPLATE_SPECS.streaming;
    const camCount = Number.isInteger(profile.cams) ? profile.cams : spec.cams;
    const exterior = profile.location === 'ext';
    const talents = (profile.talents || []).map((t) => ({ ...t, name: (t.name || '').trim() })).filter((t) => t.name);
    const camaras = Array.from({ length: camCount }, (_, i) => camera(i + 1, i === 0 ? 'Plano General' : 'Plano Medio'));
    // Talentos como entes propios (conductores/invitados en el plano del set).
    const talentos = (talents.length ? talents : [{ name: 'Conductor(a)', tipo: 'conductor' }])
        .map((t) => ({ id: uid('tal'), nombre: t.name, tipo: t.tipo === 'invitado' ? 'invitado' : 'conductor' }));
    // Un micrófono de solapa asignado a cada talento; si la plantilla pide más
    // micrófonos, los extra quedan dinámicos sin asignar. En exteriores todos
    // los micrófonos son inalámbricos.
    const microfonos = [
        ...talentos.map((t, i) => ({
            ...mic(i + 1, exterior || i > 0 ? 'Inalámbrico' : 'XLR'),
            nombre: `Mic ${i + 1} · ${t.nombre}`,
            micTipo: 'solapa',
            asignadoA: `tal:${t.id}`,
        })),
        ...Array.from({ length: Math.max(0, spec.mics - talentos.length) }, (_, i) => ({
            ...mic(talentos.length + i + 1, 'Inalámbrico'),
            micTipo: 'dinamico',
            asignadoA: '',
        })),
    ];
    // Sets del proyecto: interior, exterior, o ambos si la locación es mixta.
    const sets = (profile.location === 'mixta'
        ? [['Set estudio', 'int'], ['Locación exterior', 'ext']]
        : exterior ? [['Locación exterior', 'ext']] : [['Set principal', 'int']]
    ).map(([nombre, locacion]) => ({
        id: uid('set'), nombre, locacion, mesaVisible: locacion === 'int',
        setLayout: { pos: {}, rot: {} }, iluminacion: null, muebles: [],
    }));
    const extras = spec.extras();
    const fallback = camaras[0]?.id || extras[0]?.id || '';
    const escaleta = spec.segments.map(([name, dur], i) => {
        const esComercial = name.toLowerCase().includes('comercial');
        const fuente = esComercial
            ? (extras.find((x) => x.esCorte)?.id || fallback)
            : (camaras.length ? camaras[i % camaras.length].id : fallback);
        return segment(name, dur, fuente);
    });
    // Crew elegido en el asistente (o el básico) + talentos con nombre propio.
    const crewIds = profile.crew?.length ? profile.crew : DEFAULT_CREW;
    const personal = crewIds
        .map((id) => CREW_CATALOG.find((r) => r.id === id))
        .filter(Boolean)
        .map((r) => ({ id: uid('role'), rol: r.rol, icon: r.icon }));
    if (talents.length) {
        personal.push(...talents.map((t) => ({
            id: uid('role'),
            rol: `${t.name} · ${t.tipo === 'invitado' ? 'Invitado(a)' : 'Conductor(a)'}`,
            icon: 'conductor',
        })));
    } else {
        personal.push({ id: uid('role'), rol: 'Conductor(a)', icon: 'conductor' });
    }
    const subtitulo = profile.subtitle
        || (profile.location ? `Plan de producción · ${LOCATION_LABELS[profile.location] || ''}` : 'Plan de producción audiovisual');
    return {
        schema: SCHEMA_VERSION,
        // Plantilla de origen: la usa el panel de iluminación del generador
        // para recomendar configuraciones según el tipo de producción.
        plantilla: kind,
        iluminacionSugerida: ILUMINACION_SUGERIDA[kind] || null,
        mueblesSugeridos: MUEBLES_SUGERIDOS[kind] || null,
        // Marcado desde el asistente de Inicio: el proyecto abre en Escaleta
        // con el Asistente narrativo desplegado (la bandera se consume ahí).
        ...(profile.abrirAsistente ? { abrirAsistente: true } : {}),
        titulo: `${spec.title} – ${profile.projectName || 'NUEVO PROYECTO'}`,
        subtitulo,
        organizacion: profile.company || 'ATJ PRODUCCIONES',
        pantalla: spec.title,
        mesa: profile.projectName || spec.title,
        camaras, talentos, microfonos, extras, escaleta,
        sets, setActivo: sets[0].id,
        flujo: { preview: true, playback: extras.length > 0 },
        personal,
        includeCamOps: profile.includeCamOps ?? true,
        branding: { primaryColor: profile.color || NAVY, logoDataUrl: profile.logoDataUrl || '' },
        secciones: SECTION_DEFAULTS,
    };
}

// Genera los nodos iniciales del diagrama a partir de la configuración de la infografía.
export function diagramFromConfig(cfg) {
    let seq = 1;
    const nodes = [];
    cfg.camaras.forEach((c, i) => nodes.push({
        id: `n${seq++}`, type: 'camara', x: 50, y: 70 + i * 145,
        label: c.nombre, props: { connector: 'HDMI' }, chan: {}, syncKey: `cam:${c.id}`,
    }));
    (cfg.microfonos || []).forEach((m, i) => nodes.push({
        id: `n${seq++}`, type: 'microfono', x: 50, y: 560 + i * 135,
        label: m.nombre, props: { conexion: m.conexion }, chan: {}, syncKey: `mic:${m.id}`,
    }));
    (cfg.extras || []).filter((x) => !x.esCorte).forEach((x, i) => nodes.push({
        id: `n${seq++}`, type: 'fuente', x: 350, y: 70 + i * 135,
        label: x.nombre, props: {}, chan: {}, syncKey: `src:${x.id}`,
    }));
    return { nodes, edges: [], zones: [], notes: [], seq };
}

// Sincroniza cámaras/micrófonos/fuentes de la infografía con los nodos del diagrama.
// Devuelve el mismo objeto `cfg` si no hubo cambios (para evitar renders innecesarios).
export function infografiaFromDiagram(diagram, cfg) {
    if (!diagram?.nodes || !cfg) return cfg;
    const reconcile = (type, prefix, current, make) => {
        const previous = new Map((current || []).map((item) => [item.id, item]));
        return diagram.nodes.filter((node) => node.type === type).map((node, index) => {
            const id = node.syncKey?.startsWith(prefix) ? node.syncKey.slice(prefix.length) : `diagram-${node.id}`;
            return make(node, id, previous.get(id) || null, index);
        });
    };
    const camaras = reconcile('camara', 'cam:', cfg.camaras, (node, id, old, index) => ({
        id,
        nombre: node.label || old?.nombre || `CAM ${index + 1}`,
        plano: old?.plano || 'Plano Medio',
        color: old?.color || COLORS[index % COLORS.length],
    }));
    const microfonos = reconcile('microfono', 'mic:', cfg.microfonos, (node, id, old, index) => ({
        id,
        nombre: node.label || old?.nombre || `Mic ${index + 1}`,
        conexion: node.props?.conexion || old?.conexion || 'XLR',
        // El tipo y la asignación viven solo en la infografía; el diagrama no
        // los conoce y no debe borrarlos al sincronizar.
        micTipo: old?.micTipo || 'dinamico',
        asignadoA: old?.asignadoA || '',
    }));
    const sources = reconcile('fuente', 'src:', (cfg.extras || []).filter((item) => !item.esCorte), (node, id, old) => ({
        id,
        nombre: node.label || old?.nombre || 'Fuente',
        color: old?.color || '#64748B',
        esCorte: old?.esCorte || false,
    }));
    const extras = [...sources, ...(cfg.extras || []).filter((item) => item.esCorte)];
    const changed = JSON.stringify(camaras) !== JSON.stringify(cfg.camaras || [])
        || JSON.stringify(microfonos) !== JSON.stringify(cfg.microfonos || [])
        || JSON.stringify(extras) !== JSON.stringify(cfg.extras || []);
    return changed ? { ...cfg, camaras, microfonos, extras } : cfg;
}

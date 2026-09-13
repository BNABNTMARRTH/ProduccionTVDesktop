// Constantes, esquemas y especificaciones de plantillas audiovisuales.

export const SCHEMA_VERSION = 3;
export const NAVY = '#16365F';
export const COLORS = ['#1D6FD1', '#1FA14E', '#F07F13', '#8B5CF6', '#E0312F', '#0E9F9E', '#D1268F', '#4F46E5'];

export const SECTION_DEFAULTS = ['estudio', 'escaleta', 'personal', 'timeline']
    .map((id) => ({ id, abierto: true }));

export const PROJECT_MODES = {
    live: { label: 'Programa en vivo', chip: 'MODO · PROGRAMA EN VIVO', corto: 'EN VIVO' },
    narrative: { label: 'Producción narrativa', chip: 'MODO · PRODUCCIÓN NARRATIVA', corto: 'NARRATIVA' },
};

export const INTENCIONES = ['Informar', 'Emocionar', 'Persuadir', 'Entretener', 'Denunciar', 'Enseñar', 'Generar reflexión', 'Promover una acción'];
export const MEDIOS = ['TikTok', 'Instagram / Reels', 'YouTube', 'Facebook', 'WhatsApp', 'TV abierta', 'TV de paga', 'Streaming', 'Cine', 'Radio', 'Podcast', 'Prensa impresa', 'Pantallas en la calle', 'Evento en vivo'];

export const perfilVacio = () => ({
    emisor: '', mensaje: '', intencion: [], receptor: '', edad: '',
    medios: [], presupuesto: '', presupuestoNota: '',
});

export const normalizeMode = (modo) => (modo === 'narrative' ? 'narrative' : 'live');

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

export const LOCATION_LABELS = { int: 'Locación interior (estudio)', ext: 'Locación exterior', mixta: 'Locación mixta (int/ext)' };

export const ILUMINACION_SUGERIDA = {
    podcast: 'podcast_practical_setup',
    noticiero: 'news_desk_lighting_setup',
    entrevista: 'three_point_lighting',
    streaming: 'solo_host_streaming_setup',
    multicamara: 'stage_wash_setup',
};

export const MUEBLES_SUGERIDOS = {
    podcast: ['sillon1', 'sillon1'],
    entrevista: ['sillon1', 'sillon2'],
    streaming: ['sillon1'],
};

export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const source = (nombre, color, esCorte = false) => ({ id: uid('src'), nombre, color, esCorte });

export const TEMPLATE_SPECS = {
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

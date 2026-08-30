// Proyecto demo precargado: cada sección contiene instrucciones de uso, de modo
// que quien abre la app por primera vez aprende explorando un proyecto real.
// Los ids son fijos para que el diagrama y la infografía queden sincronizados.
import { NAVY } from './templates.js';

export const DEMO_PROJECT_ID = 'project-demo-guia';

const CAMS = [
    { id: 'demo-cam-1', nombre: 'CAM 1 · edítame', plano: 'Plano General', color: '#1D6FD1' },
    { id: 'demo-cam-2', nombre: 'CAM 2 · cambia mi plano', plano: 'Plano Medio', color: '#1FA14E' },
    { id: 'demo-cam-3', nombre: 'CAM 3 · muéveme en Set', plano: 'Close-Up', color: '#F07F13' },
];
const TALENTOS = [
    { id: 'demo-tal-1', nombre: 'Conductor(a) · muéveme', tipo: 'conductor' },
    { id: 'demo-tal-2', nombre: 'Invitado(a)', tipo: 'invitado' },
];
const MICS = [
    { id: 'demo-mic-1', nombre: 'Mic 1 · Conductor(a)', conexion: 'XLR', micTipo: 'solapa', asignadoA: 'tal:demo-tal-1' },
    { id: 'demo-mic-2', nombre: 'Mic 2 · Invitado(a)', conexion: 'Inalámbrico', micTipo: 'dinamico', asignadoA: 'tal:demo-tal-2' },
    { id: 'demo-mic-3', nombre: 'Boom del set · gírame', conexion: 'XLR', micTipo: 'boom', asignadoA: 'set' },
];
const GFX = { id: 'demo-src-gfx', nombre: 'GRÁFICOS · fuente extra', color: '#0E9F9E', esCorte: false };
const CORTE = { id: 'demo-src-corte', nombre: 'CORTE · agrupa bloques', color: '#F3C513', esCorte: true };

function demoCfg() {
    return {
        titulo: 'DEMO – CONOCE PRODUCCIÓN TV',
        subtitulo: 'Cada sección de este proyecto explica cómo se usa · bórralo cuando quieras',
        organizacion: 'FCC · UASLP',
        pantalla: 'ESTA ES LA PANTALLA DEL SET · CÁMBIAME EN PERFIL (⌘1)',
        mesa: 'MESA · ARRÁSTRAME EN SET',
        camaras: CAMS.map((c) => ({ ...c })),
        talentos: TALENTOS.map((t) => ({ ...t })),
        microfonos: MICS.map((m) => ({ ...m })),
        extras: [{ ...GFX }, { ...CORTE }],
        escaleta: [
            { id: 'demo-seg-1', segmento: '1. Lee la escaleta de arriba a abajo', dur: 30, fuente: 'demo-cam-1', nota: 'Cada fila es un segmento del programa. Se edita en la etapa Guion (⌘2), en Escaleta y guion técnico.' },
            { id: 'demo-seg-2', segmento: '2. La fuente dice qué sale al aire', dur: 45, fuente: 'demo-cam-2', nota: 'El color de la fuente coincide con su cámara. Cámbiala y mira cómo se actualiza todo.' },
            { id: 'demo-seg-3', segmento: '3. La duración alimenta la Línea de tiempo', dur: 60, fuente: 'demo-cam-3', nota: 'Cambia mi duración y abre Guion → Tiempos (⌘2) para ver el efecto.' },
            { id: 'demo-seg-4', segmento: '4. Los cortes agrupan bloques', dur: 20, fuente: 'demo-src-corte', nota: 'Una fuente marcada como corte parte la línea de tiempo en bloques.' },
            { id: 'demo-seg-5', segmento: '5. Prueba el Ensayo ▶ (⌘6)', dur: 45, fuente: 'demo-cam-1', nota: 'Ahí la escaleta corre con reloj: dice qué cámara va al aire, cuál en previo y qué toca ejecutar en cada momento.' },
        ],
        flujo: { preview: true, playback: false },
        personal: [
            { id: 'demo-rol-1', rol: 'Director de cámaras', icon: 'director' },
            { id: 'demo-rol-2', rol: 'Operador de switcher', icon: 'switcher' },
            { id: 'demo-rol-3', rol: 'Operador de audio', icon: 'audio' },
            { id: 'demo-rol-4', rol: 'Tú · Conductor(a)', icon: 'conductor' },
        ],
        includeCamOps: true,
        branding: { primaryColor: NAVY, logoDataUrl: '' },
        secciones: ['estudio', 'escaleta', 'personal', 'timeline'].map((id) => ({ id, abierto: true })),
        // Set único ya acomodado (agrega más sets en la pestaña Set), con
        // iluminación de tres puntos aplicada (instancias autocontenidas,
        // mismo formato que genera el catálogo del generador).
        sets: [{
            id: 'demo-set-1',
            nombre: 'Set principal',
            locacion: 'int',
            mesaVisible: true,
            iluminacion: {
                setup: 'three_point_lighting',
                luces: [
                    { id: 'demo-luz-key', tipo: 'key_light', nombre: 'Luz principal', abrev: 'K', color: '#F59E0B', forma: 'fresnel', dir: 'mesa', opcional: false },
                    { id: 'demo-luz-fill', tipo: 'fill_light', nombre: 'Relleno', abrev: 'F', color: '#38BDF8', forma: 'panel', dir: 'mesa', opcional: false },
                    { id: 'demo-luz-back', tipo: 'back_light', nombre: 'Contraluz', abrev: 'BL', color: '#8B5CF6', forma: 'fresnel', dir: 'mesa', opcional: false },
                ],
            },
            setLayout: {
                pos: {
                    'mesa': { x: 490, y: 225 },
                    'tal:demo-tal-1': { x: 425, y: 160 },
                    'tal:demo-tal-2': { x: 555, y: 160 },
                    'mic:demo-mic-3': { x: 640, y: 210 },
                    'cam:demo-cam-1': { x: 490, y: 520 },
                    'cam:demo-cam-2': { x: 205, y: 400 },
                    'cam:demo-cam-3': { x: 775, y: 400 },
                    'luz:demo-luz-key': { x: 320, y: 375 },
                    'luz:demo-luz-fill': { x: 665, y: 355 },
                    'luz:demo-luz-back': { x: 585, y: 110 },
                },
                rot: {},
            },
        }],
        setActivo: 'demo-set-1',
    };
}

// Diagrama ya conectado (cámaras → switcher → encoder → plataforma; mics →
// mezcladora → encoder) para que el checklist técnico salga en verde y se vea
// cómo debe quedar una ruta de señal completa.
function demoDiagram() {
    const node = (id, type, x, y, label, props, syncKey) => ({ id, type, x, y, label, props, chan: {}, ...(syncKey ? { syncKey } : {}) });
    const edge = (id, fn, fp, tn, tp) => ({ id, from: { node: fn, port: fp }, to: { node: tn, port: tp } });
    return {
        nodes: [
            node('n1', 'camara', 60, 60, CAMS[0].nombre, { connector: 'HDMI' }, 'cam:demo-cam-1'),
            node('n2', 'camara', 60, 210, CAMS[1].nombre, { connector: 'HDMI' }, 'cam:demo-cam-2'),
            node('n3', 'camara', 60, 360, CAMS[2].nombre, { connector: 'SDI' }, 'cam:demo-cam-3'),
            node('n4', 'microfono', 60, 530, MICS[0].nombre, { conexion: 'XLR' }, 'mic:demo-mic-1'),
            node('n5', 'microfono', 60, 670, MICS[1].nombre, { conexion: 'Inalámbrico' }, 'mic:demo-mic-2'),
            node('n6', 'fuente', 330, 40, GFX.nombre, {}, 'src:demo-src-gfx'),
            node('n7', 'switcher', 400, 190, 'Switcher · mezcla el video', { inputs: 4 }),
            node('n8', 'audio', 400, 560, 'Mezcladora · mezcla el audio', { inputs: 2 }),
            node('n9', 'encoder', 690, 340, 'Encoder / PC · une todo', {}),
            node('n10', 'plataforma', 930, 340, 'Plataforma · tu stream', { plataforma: 'YouTube' }),
        ],
        edges: [
            edge('e1', 'n1', 'v', 'n7', 'i1'),
            edge('e2', 'n2', 'v', 'n7', 'i2'),
            edge('e3', 'n3', 'v', 'n7', 'i3'),
            edge('e4', 'n6', 'v', 'n7', 'i4'),
            edge('e5', 'n4', 'a', 'n8', 'i1'),
            edge('e6', 'n5', 'a', 'n8', 'i2'),
            edge('e7', 'n7', 'pgm', 'n9', 'v'),
            edge('e8', 'n8', 'mix', 'n9', 'a'),
            edge('e9', 'n9', 'out', 'n10', 'in'),
        ],
        zones: [],
        notes: [],
        seq: 30,
    };
}

export function makeDemoProject() {
    const now = new Date().toISOString();
    return {
        id: DEMO_PROJECT_ID,
        name: '🎓 Demo — Aprende Producción TV',
        template: 'demo',
        createdAt: now,
        updatedAt: now,
        cfg: demoCfg(),
        diagram: demoDiagram(),
    };
}

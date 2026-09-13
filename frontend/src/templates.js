// Catálogo de plantillas y conversión entre la infografía y el diagrama de señal.

export * from './templates_data.js';
import {
    TEMPLATE_SPECS,
    COLORS,
    uid,
} from './templates_data.js';
import { ProjectBuilder } from './project_builder.js';

export { ProjectBuilder };

// Valores por defecto de cada plantilla, para pre-llenar el asistente.
export const templateDefaults = (kind) => {
    const spec = TEMPLATE_SPECS[kind] || TEMPLATE_SPECS.streaming;
    return { cams: spec.cams, mics: spec.mics };
};

// makeTemplate actúa como fachada hacia ProjectBuilder para preservar 100% de retrocompatibilidad.
export function makeTemplate(kind, profile = {}) {
    return new ProjectBuilder(kind).withProfile(profile).build();
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

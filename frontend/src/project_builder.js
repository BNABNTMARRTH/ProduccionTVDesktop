/**
 * ProjectBuilder implementa el patrón de diseño BUILDER (GoF).
 * Separa la construcción paso a paso de un proyecto audiovisual
 * (cámaras, talentos, microfonía, sets, escaleta, crew, branding y perfiles)
 * de su representación final conforme al SCHEMA_VERSION 3.
 */

import {
    SCHEMA_VERSION,
    NAVY,
    COLORS,
    SECTION_DEFAULTS,
    CREW_CATALOG,
    DEFAULT_CREW,
    LOCATION_LABELS,
    ILUMINACION_SUGERIDA,
    MUEBLES_SUGERIDOS,
    TEMPLATE_SPECS,
    perfilVacio,
    uid,
} from './templates_data.js';

const source = (nombre, color, esCorte = false) => ({ id: uid('src'), nombre, color, esCorte });
const camera = (index, plano = 'Plano Medio') => ({
    id: uid('cam'),
    nombre: `CAM ${index}`,
    plano,
    color: COLORS[(index - 1) % COLORS.length],
});
const mic = (index, conexion = 'XLR') => ({ id: uid('mic'), nombre: `Mic ${index}`, conexion });
const segment = (name, dur, fuente, nota = '') => ({ id: uid('seg'), segmento: name, dur, fuente, nota });

export class ProjectBuilder {
    constructor(kind = 'streaming') {
        this.kind = kind;
        this.spec = TEMPLATE_SPECS[kind] || TEMPLATE_SPECS.streaming;
        this.profile = {};
    }

    withProfile(profile = {}) {
        this.profile = profile || {};
        return this;
    }

    build() {
        const { kind, spec, profile } = this;
        const camCount = Number.isInteger(profile.cams) ? profile.cams : spec.cams;
        const exterior = profile.location === 'ext';
        const talents = (profile.talents || []).map((t) => ({ ...t, name: (t.name || '').trim() })).filter((t) => t.name);
        const camaras = Array.from({ length: camCount }, (_, i) => camera(i + 1, i === 0 ? 'Plano General' : 'Plano Medio'));

        // PROYECTO VACÍO = VACÍO DE VERDAD
        const vacio = kind === 'vacio' && !talents.length && !profile.crew?.length;

        // Talentos como entes propios
        const talentos = (talents.length ? talents : vacio ? [] : [{ name: 'Conductor(a)', tipo: 'conductor' }])
            .map((t) => ({ id: uid('tal'), nombre: t.name, tipo: t.tipo === 'invitado' ? 'invitado' : 'conductor' }));

        // Microfonía asignada a talentos y extra
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

        // Sets del proyecto
        const sets = (profile.location === 'mixta'
            ? [['Set estudio', 'int'], ['Locación exterior', 'ext']]
            : exterior ? [['Locación exterior', 'ext']] : [['Set principal', 'int']]
        ).map(([nombre, locacion]) => ({
            id: uid('set'),
            nombre,
            locacion,
            mesaVisible: false,
            setLayout: { pos: {}, rot: {} },
            iluminacion: null,
            muebles: [],
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

        // Personal / Crew
        const crewIds = profile.crew?.length ? profile.crew : vacio ? [] : DEFAULT_CREW;
        const personal = crewIds
            .map((id) => CREW_CATALOG.find((r) => r.id === id))
            .filter(Boolean)
            .map((r) => ({ id: uid('role'), rol: r.rol, icon: r.icon }));

        if (talents.length) {
            personal.push(...talents.map((t) => {
                const papel = t.tipo === 'invitado' ? 'Invitado(a)' : 'Conductor(a)';
                return { id: uid('role'), rol: t.name === papel ? papel : `${t.name} · ${papel}`, icon: 'conductor' };
            }));
        } else if (!vacio) {
            personal.push({ id: uid('role'), rol: 'Conductor(a)', icon: 'conductor' });
        }

        const subtitulo = profile.subtitle
            || (profile.location ? `Plan de producción · ${LOCATION_LABELS[profile.location] || ''}` : 'Plan de producción audiovisual');
        const modo = profile.modo === 'narrative' ? 'narrative' : 'live';

        return {
            schema: SCHEMA_VERSION,
            modo,
            ...(modo === 'narrative' && profile.narrativeTipo ? { narrativa: { tipo: profile.narrativeTipo } } : {}),
            plantilla: kind,
            iluminacionSugerida: ILUMINACION_SUGERIDA[kind] || null,
            mueblesSugeridos: MUEBLES_SUGERIDOS[kind] || null,
            titulo: `${spec.title} – ${profile.projectName || 'NUEVO PROYECTO'}`,
            subtitulo,
            organizacion: profile.company || 'ATJ PRODUCCIONES',
            pantalla: spec.title,
            mesa: profile.projectName || spec.title,
            camaras,
            talentos,
            microfonos,
            extras,
            escaleta,
            sets,
            setActivo: sets[0].id,
            flujo: { preview: true, playback: extras.length > 0 },
            personal,
            includeCamOps: profile.includeCamOps ?? true,
            perfil: { ...perfilVacio(), ...(profile.perfil || {}) },
            branding: { primaryColor: profile.color || NAVY, logoDataUrl: profile.logoDataUrl || '' },
            secciones: SECTION_DEFAULTS,
        };
    }
}

/* PLANTILLAS DE SET: el catálogo de espacios ya armados (2026-08-28).
 *
 * Qué son: un proyecto nuevo nace VACÍO —el lienzo en blanco, sin cámaras ni
 * gente— y eso es lo correcto cuando ya sabes lo que vas a hacer. Pero cuando
 * NO lo sabes, una hoja en blanco no enseña nada. Estas plantillas son el
 * atajo: un podcast, una entrevista, un noticiero… con sus cámaras en arco,
 * su gente sentada, sus micrófonos asignados y su iluminación puesta.
 *
 * Lo importante es que la tarjeta enseña EL PLANO DE VERDAD, no un dibujito:
 * se arma el proyecto completo y se dibuja con el mismo renderizador que usan
 * las hojas impresas (window.PTVSheets.planoSvg). Lo que ves en la tarjeta es
 * exactamente lo que te llevas al crear el proyecto.
 *
 * De dónde salen las piezas (sin copiar nada, para que no haya dos verdades):
 *   · el proyecto base .......... makeTemplate() de templates.js
 *   · la iluminación ............ getSetup/instanciarSetup del generador
 *   · el acomodo del mobiliario . posMuebleDefault del generador
 */

import { makeTemplate, uid } from './templates.js';
import { getSetup, instanciarSetup } from '../../web-sources/generador-tv/src/iluminacion.js';
import { posMuebleDefault } from '../../web-sources/generador-tv/src/sets.js';

// El centro del plano: la mesa (o el punto de foco) al que apuntan cámaras y
// luces. Es el mismo valor que usan el lienzo del generador y normalizeCfg.
const MESA = { x: 490, y: 240 };

const conductor = (nombre) => ({ name: nombre, tipo: 'conductor' });
const invitado = (nombre) => ({ name: nombre, tipo: 'invitado' });

/* Cada plantilla dice:
     kind ....... plantilla base de templates.js (de ahí salen mics y escaleta)
     cams ....... cuántas cámaras (manda sobre la de la plantilla base)
     talentos ... quién habla, en orden; el primero se sienta en el primer mueble
     muebles .... tipos de MUEBLES_CATALOGO, en el orden en que se acomodan
     asientos ... quién se sienta en cada mueble: índice del talento, una lista
                  de índices (una mesa redonda lleva varios) o null si nadie
     setup ...... id de SETUPS_ILUMINACION
     mesa ....... true solo para proyectos heredados; las plantillas nuevas
                  ponen la mesa como MUEBLE, que se mueve y se gira
     locacion ... 'int' (estudio) o 'ext' (exterior)
     plano ...... dónde va cada cosa en el lienzo de 980×600: mesa, muebles,
                  talentos de pie, micrófonos sin dueño y el ajuste fino de
                  alguna luz suelta (ver abajo)

   EL ACOMODO (`plano`) NO ES UN LUJO. Sin él todo cae en su posición por
   omisión —los muebles en fila abajo a la izquierda, uno encima del otro con
   sus etiquetas— y la tarjeta enseñaría un montón, no un set. Aquí se dice
   dónde va la mesa (o el punto de foco), en qué lugar se sienta cada quien y
   dónde queda cada mueble. Las cámaras NO se tocan: el lienzo las reparte
   solas en arco alrededor del foco, que es exactamente lo que uno haría.

   El lienzo mide 980 de ancho × 600 de alto. Arriba (y≈30) está el muro con
   la pantalla del set; abajo y a los lados, las cámaras. O sea: lo que mira
   a cámara se pone ARRIBA del centro, y el público estaría abajo.            */
export const PLANTILLAS_SET = [
    {
        id: 'podcast', kind: 'podcast', nombre: 'Podcast', category: 'dialogue',
        resumen: 'Dos sillones, mesa baja y luz práctica',
        detalle: 'La conversación de siempre: dos personas frente a frente, cámaras cruzadas y una luz cálida que no parece estudio.',
        cams: 2, mesa: false, locacion: 'int',
        talentos: [conductor('Conductor(a)'), invitado('Invitado(a)')],
        muebles: ['mesa', 'sillon1', 'sillon1'],
        asientos: [null, 0, 1],
        setup: 'podcast_practical_setup',
        // Dos sillones flanqueando la mesa baja: se hablan de frente.
        plano: {
            mesa: { x: 490, y: 262 },
            muebles: [{ x: 490, y: 300 }, { x: 366, y: 250 }, { x: 614, y: 250 }],
            mics: [{ x: 430, y: 356 }, { x: 550, y: 356 }],
        },
    },
    {
        id: 'entrevista', kind: 'entrevista', nombre: 'Entrevista', category: 'dialogue',
        resumen: 'Tres cámaras y luz de tres puntos',
        detalle: 'Quien pregunta y quien responde, cada uno con su cámara y una tercera abierta para el plano que ubica.',
        cams: 3, mesa: false, locacion: 'int',
        talentos: [conductor('Entrevistador(a)'), invitado('Entrevistado(a)')],
        muebles: ['sillon1', 'sillon2'],
        asientos: [0, 1],
        setup: 'three_point_lighting',
        // Sin mesa de por medio: la butaca de quien pregunta y el sofá de
        // quien responde, con el punto de foco entre los dos.
        plano: {
            mesa: { x: 490, y: 250 },
            muebles: [{ x: 360, y: 250 }, { x: 630, y: 250 }],
            mics: [{ x: 490, y: 340 }],
        },
    },
    {
        id: 'noticiero', kind: 'noticiero', nombre: 'Noticiero', category: 'multicam',
        resumen: 'Escritorio al centro y luz de estudio',
        detalle: 'La mesa de noticias: conductor(a) al frente, tres cámaras (general, medio y detalle) y la pantalla del set al fondo.',
        cams: 3, mesa: false, locacion: 'int',
        talentos: [conductor('Conductor(a)')],
        muebles: ['mesa'],
        asientos: [0],
        setup: 'news_desk_lighting_setup',
        // El escritorio de noticias, con quien conduce sentado detrás.
        plano: { mesa: { x: 490, y: 250 }, muebles: [{ x: 490, y: 258 }], mics: [{ x: 690, y: 340 }] },
    },
    {
        id: 'streaming', kind: 'streaming', nombre: 'Streaming en vivo', category: 'dialogue',
        resumen: 'Una persona, dos cámaras y fondo RGB',
        detalle: 'El set de una sola persona para YouTube o Twitch: principal suave, recorte y un tubo de color en el fondo.',
        cams: 2, mesa: false, locacion: 'int',
        talentos: [conductor('Host')],
        muebles: ['mesa', 'sillon1'],
        asientos: [null, 0],
        setup: 'solo_host_streaming_setup',
        // Escritorio al frente, silla detrás: el encuadre de siempre en YouTube.
        plano: { mesa: { x: 490, y: 262 }, muebles: [{ x: 490, y: 290 }, { x: 490, y: 212 }] },
    },
    {
        id: 'panel', kind: 'multicamara', nombre: 'Mesa redonda / Panel', category: 'multicam',
        resumen: 'Mesa redonda, luz cruzada y baño de set',
        detalle: 'La mesa de debate: cuatro participantes en corro alrededor de la mesa redonda, luz cruzada para que nadie quede en sombra y cámaras que abren y cierran.',
        cams: 4, mesa: false, locacion: 'int',
        talentos: [conductor('Moderador(a)'), invitado('Panelista 1'), invitado('Panelista 2'), invitado('Panelista 3')],
        muebles: ['mesaRedonda'],
        // Los cuatro en corro alrededor de la MESA REDONDA: es literalmente
        // la plantilla que le da nombre.
        asientos: [[0, 1, 2, 3]],
        setup: 'panel_show_lighting_setup',
        // La mesa Y el punto de foco en el mismo sitio: es el centro del
        // debate y es a donde apuntan las cuatro cámaras. Un poco abajo del
        // medio, para que los contraluces del muro no caigan sobre los nombres.
        plano: {
            mesa: { x: 490, y: 292 },
            muebles: [{ x: 490, y: 292 }],
            // La cenital caía justo sobre el nombre de un panelista.
            luces: { top_light: [{ x: 646, y: 214 }] },
        },
    },
    {
        id: 'evento', kind: 'multicamara', nombre: 'Evento multicámara', category: 'multicam',
        resumen: 'Cinco cámaras alrededor del escenario',
        detalle: 'Un concierto, una ceremonia o una obra: sin mesa, con punto de foco al centro y las cámaras rodeando el escenario.',
        cams: 5, mesa: false, locacion: 'int',
        talentos: [conductor('Presentador(a)'), invitado('Elenco')],
        muebles: [],
        setup: 'stage_wash_setup',
        // El escenario al centro: el punto de foco es el blanco de las cinco
        // cámaras, que el lienzo reparte solo en arco alrededor.
        plano: {
            mesa: { x: 490, y: 250 },
            talentos: [{ x: 404, y: 196 }, { x: 576, y: 196 }],
            mics: [{ x: 400, y: 320 }, { x: 580, y: 320 }],
        },
    },
    {
        id: 'croma', kind: 'streaming', nombre: 'Pantalla verde (croma)', category: 'special',
        resumen: 'Fondo verde parejo y sujeto separado',
        detalle: 'Para recortar la figura y meterla en cualquier fondo: el verde se ilumina aparte y la persona lleva su propio contraluz.',
        cams: 2, mesa: false, locacion: 'int',
        talentos: [conductor('Presentador(a)')],
        muebles: [],
        setup: 'chroma_key_lighting_setup',
        // La persona SEPARADA del fondo: por eso está adelantada respecto al
        // muro verde, no pegada a él. Es la regla de oro del croma.
        plano: { mesa: { x: 490, y: 264 }, talentos: [{ x: 490, y: 214 }] },
    },
    {
        id: 'exterior', kind: 'entrevista', nombre: 'Locación exterior', category: 'special',
        resumen: 'A cielo abierto, con rebote y bandera',
        detalle: 'La entrevista en la calle o en el campus: el sol es la luz principal, el rebote llena la cara y la bandera corta lo que sobra.',
        cams: 2, mesa: false, locacion: 'ext',
        talentos: [conductor('Reportero(a)'), invitado('Entrevistado(a)')],
        muebles: [],
        setup: 'exterior_sun_bounce_setup',
        // De pie y de frente, como se graba en la calle.
        plano: {
            mesa: { x: 490, y: 250 },
            talentos: [{ x: 410, y: 206 }, { x: 570, y: 206 }],
            mics: [{ x: 490, y: 330 }],
        },
    },
];

export const plantillaPorId = (id) => PLANTILLAS_SET.find((p) => p.id === id) || null;

/**
 * Prototype Pattern (GoF):
 * Clona profundamente una plantilla para garantizar inmutabilidad en el catálogo.
 */
export function cloneTemplate(templateOrId) {
    const tpl = typeof templateOrId === 'string' ? plantillaPorId(templateOrId) : templateOrId;
    if (!tpl) return null;
    return JSON.parse(JSON.stringify(tpl));
}

/* Arma el proyecto COMPLETO de una plantilla, con el set ya puesto.
 *
 * La iluminación y el mobiliario se dejan YA APLICADOS (no como sugerencia):
 * así el plano que se dibuja en la tarjeta es idéntico al que abre el proyecto.
 * Por eso se retiran las banderas `iluminacionSugerida`/`mueblesSugeridos`, que
 * el generador aplicaría otra vez —y encima ya no tendrían efecto, porque solo
 * actúan cuando el primer set viene sin luces y sin muebles. */
export function cfgDePlantilla(plantilla, nombre = '') {
    const cfg = makeTemplate(plantilla.kind, {
        projectName: nombre || plantilla.nombre,
        cams: plantilla.cams,
        location: plantilla.locacion,
        talents: plantilla.talentos,
        modo: 'live',
    });
    const set = cfg.sets[0];
    set.nombre = plantilla.nombre;
    set.mesaVisible = plantilla.mesa !== false;
    const plano = plantilla.plano || {};
    // La mesa (o el punto de foco) es el centro de todo: las luces se colocan
    // respecto a ella y las cámaras la apuntan. Por eso se decide primero.
    const mesa = plano.mesa || MESA;
    const pos = { ...(set.setLayout?.pos || {}), mesa };

    const setup = getSetup(plantilla.setup);
    if (setup) {
        const { luces, pos: posLuces } = instanciarSetup(setup, mesa);
        set.iluminacion = { setup: setup.id, luces };
        Object.assign(pos, posLuces);
        // Ajuste fino de una luz concreta, por tipo. El catálogo la coloca en
        // su sitio típico respecto a la mesa, y casi siempre está bien; cuando
        // el mobiliario de ESTA plantilla la deja encima de un nombre, aquí se
        // corre. (Se indica el tipo y, si hay varias, van en orden.)
        Object.entries(plano.luces || {}).forEach(([tipo, puntos]) => {
            const suyas = luces.filter((l) => l.tipo === tipo);
            [].concat(puntos).forEach((punto, i) => {
                if (suyas[i]) pos[`luz:${suyas[i].id}`] = punto;
            });
        });
    }

    // Quién se sienta en cada mueble. `asientos` lo dice explícitamente porque
    // ya no vale el "uno por mueble en orden": una mesa no lleva a nadie encima
    // y una mesa redonda lleva a todos.
    const quienes = (i) => {
        const a = plantilla.asientos ? plantilla.asientos[i] : i;
        const idx = a === null || a === undefined ? [] : [].concat(a);
        return idx.map((n) => cfg.talentos[n]?.id).filter(Boolean);
    };
    set.muebles = (plantilla.muebles || []).map((tipo, i) => {
        const id = uid('mue');
        pos[`mue:${id}`] = plano.muebles?.[i] || posMuebleDefault(i);
        return { id, tipo, ocupantes: quienes(i) };
    });

    // Quien no se sienta en un mueble se para donde diga la plantilla; si no
    // lo dice, el lienzo lo reparte solo detrás de la mesa.
    (plano.talentos || []).forEach((p, i) => {
        if (cfg.talentos[i]) pos[`tal:${cfg.talentos[i].id}`] = p;
    });

    // Los micrófonos SIN DUEÑO (los de mano, que quedan sobre la mesa). Su
    // posición por omisión es la esquina de abajo a la izquierda, justo donde
    // el lienzo pone la primera cámara: se encimaban uno sobre otra.
    const sinDuenno = cfg.microfonos.filter((m) => !m.asignadoA);
    (plano.mics || []).forEach((p, i) => {
        if (sinDuenno[i]) pos[`mic:${sinDuenno[i].id}`] = p;
    });

    set.setLayout = { ...(set.setLayout || {}), pos, rot: set.setLayout?.rot || {} };
    cfg.plantillaSet = plantilla.id;
    delete cfg.iluminacionSugerida;
    delete cfg.mueblesSugeridos;
    return cfg;
}

// Cuántas piezas trae la plantilla, para el pie de la tarjeta.
export function resumenDePlantilla(cfg) {
    const set = cfg.sets?.[0] || {};
    const partes = [
        `${(cfg.camaras || []).length} cámaras`,
        `${(cfg.microfonos || []).length} micrófonos`,
        `${(set.iluminacion?.luces || []).length} luces`,
    ];
    return partes.join(' · ');
}

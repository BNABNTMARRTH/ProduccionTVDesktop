// Catálogo de iluminación televisiva: elementos (luces y modificadores, cada
// uno con su icono para el plano cenital) y configuraciones completas (setups)
// listas para aplicar en la pestaña Set.
//
// Las instancias que se guardan en cfg.iluminacion.luces son AUTOCONTENIDAS
// (nombre, abreviatura, color, forma del icono y regla de dirección), de modo
// que los renderizadores vanilla (frontend/public/tools/shared/sheets.js:
// guías, exportar y tally) pueden dibujarlas sin conocer este catálogo.

export const DIFICULTAD_ES = { easy: 'Fácil', medium: 'Media', high: 'Alta' };

// Familias de color por función (para leer el plano de un vistazo).
const C = {
  key: '#F59E0B',      // principales — ámbar
  fill: '#38BDF8',     // rellenos — celeste
  back: '#8B5CF6',     // contras / recortes — violeta
  fondo: '#0E9F9E',    // luces de fondo — teal
  wash: '#6366F1',     // baños / cenitales — índigo
  practica: '#FB923C', // prácticas — naranja cálido
  rgb: '#D1268F',      // color / RGB — magenta
  chroma: '#1FA14E',   // pantalla verde — verde
  mod: '#475569',      // banderas / negativos / difusión — gris tinta
  rebote: '#94A3B8',   // reflectores / rebotes — plata
  tech: '#64748B',     // control y medición — gris técnico
};

// forma → glifo dibujado en el canvas (y su gemelo vanilla en sheets.js):
// fresnel · softbox · panel · wash · tube · top · practical · flag · difusor ·
// reflector · control · fx · movil
//
// dir: 'mesa' = auto-apunta a la mesa · 'muro' = apunta al fondo del set ·
// null = marcador sin dirección. off = desplazamiento respecto a la mesa;
// abs = posición fija en el lienzo (980×600). count = instancias que coloca
// el setup (la segunda se refleja horizontalmente).
export const LUZ_CATALOGO = {
  // — Principales —
  key_light:            { es: 'Luz principal',       abrev: 'K',   forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-170, 150] },
  soft_key_light:       { es: 'Principal suave',     abrev: 'KS',  forma: 'softbox',   color: C.key,      dir: 'mesa', off: [-170, 150] },
  hard_key_light:       { es: 'Principal dura',      abrev: 'KH',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-170, 150] },
  subject_key_light:    { es: 'Principal del sujeto', abrev: 'SK', forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-170, 150] },
  large_soft_key_light: { es: 'Principal ventana',   abrev: 'KV',  forma: 'softbox',   color: C.key,      dir: 'mesa', off: [-250, 110] },
  top_soft_key_light:   { es: 'Principal superior',  abrev: 'KT',  forma: 'softbox',   color: C.key,      dir: 'mesa', off: [0, 185] },
  key_light_a:          { es: 'Principal A',         abrev: 'KA',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-160, 145] },
  key_light_b:          { es: 'Principal B',         abrev: 'KB',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [160, 145] },
  key_light_left:       { es: 'Principal izquierda', abrev: 'KL',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-270, 80] },
  key_light_right:      { es: 'Principal derecha',   abrev: 'KR',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [270, 80] },
  cross_lights:         { es: 'Luz cruzada',         abrev: 'KX',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-240, 120], count: 2 },
  light_source:         { es: 'Fuente p/ rebote',    abrev: 'LS',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-280, 215] },
  spotlight:            { es: 'Seguidor / spot',     abrev: 'SP',  forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [0, 265] },
  hmi_key_light:        { es: 'HMI (luz día)',       abrev: 'HMI', forma: 'fresnel',   color: C.key,      dir: 'mesa', off: [-205, 160] },
  // — Rellenos —
  fill_light:           { es: 'Relleno',             abrev: 'F',   forma: 'panel',     color: C.fill,     dir: 'mesa', off: [175, 130] },
  soft_fill:            { es: 'Relleno suave',       abrev: 'FS',  forma: 'softbox',   color: C.fill,     dir: 'mesa', off: [155, 120] },
  bottom_fill_light:    { es: 'Relleno inferior',    abrev: 'FB',  forma: 'panel',     color: C.fill,     dir: 'mesa', off: [45, 120] },
  side_light:           { es: 'Luz lateral',         abrev: 'SL',  forma: 'panel',     color: C.fill,     dir: 'mesa', off: [-295, -10] },
  eye_light:            { es: 'Luz de ojos',         abrev: 'EY',  forma: 'panel',     color: C.fill,     dir: 'mesa', off: [-15, 155] },
  // — Contras y recortes —
  back_light:           { es: 'Contraluz',           abrev: 'BL',  forma: 'fresnel',   color: C.back,     dir: 'mesa', off: [95, -115] },
  back_lights:          { es: 'Contraluz',           abrev: 'BL',  forma: 'fresnel',   color: C.back,     dir: 'mesa', off: [115, -115], count: 2 },
  rim_light:            { es: 'Luz de recorte',      abrev: 'RM',  forma: 'fresnel',   color: C.back,     dir: 'mesa', off: [-95, -115] },
  edge_light:           { es: 'Luz de borde',        abrev: 'EG',  forma: 'tube',      color: C.back,     dir: 'mesa', off: [155, -90] },
  // — Fondo —
  background_light:     { es: 'Luz de fondo',        abrev: 'BG',  forma: 'wash',      color: C.fondo,    dir: 'muro', abs: [400, 105] },
  background_lights:    { es: 'Luz de fondo',        abrev: 'BG',  forma: 'wash',      color: C.fondo,    dir: 'muro', abs: [350, 105], count: 2 },
  background_accent:    { es: 'Acento de fondo',     abrev: 'BA',  forma: 'wash',      color: C.fondo,    dir: 'muro', abs: [615, 105] },
  color_background_light:{ es: 'Fondo de color',     abrev: 'BGC', forma: 'wash',      color: C.rgb,      dir: 'muro', abs: [455, 105] },
  rgb_background_light: { es: 'Fondo RGB',           abrev: 'RGB', forma: 'tube',      color: C.rgb,      dir: 'muro', abs: [535, 105] },
  green_screen_lights:  { es: 'Luz chroma',          abrev: 'GS',  forma: 'wash',      color: C.chroma,   dir: 'muro', abs: [345, 105], count: 2 },
  // — Baños y cenitales —
  set_wash:             { es: 'Baño de luz',         abrev: 'W',   forma: 'wash',      color: C.wash,     dir: null,   abs: [255, 300] },
  wash_lights:          { es: 'Baño de luz',         abrev: 'W',   forma: 'wash',      color: C.wash,     dir: null,   abs: [250, 300], count: 2 },
  top_light:            { es: 'Cenital',             abrev: 'T',   forma: 'top',       color: C.wash,     dir: null,   off: [45, -45] },
  top_lights:           { es: 'Cenital',             abrev: 'T',   forma: 'top',       color: C.wash,     dir: null,   off: [65, -45], count: 2 },
  // — Ambiente y color —
  practical_light:      { es: 'Práctica',            abrev: 'PR',  forma: 'practical', color: C.practica, dir: null,   off: [275, -55] },
  accent_light:         { es: 'Acento',              abrev: 'AC',  forma: 'fresnel',   color: C.rgb,      dir: 'mesa', off: [250, -30] },
  color_accent_lights:  { es: 'Acento de color',     abrev: 'AC',  forma: 'wash',      color: C.rgb,      dir: 'muro', abs: [235, 140], count: 2 },
  rgb_light:            { es: 'Tubo RGB',            abrev: 'RGB', forma: 'tube',      color: C.rgb,      dir: null,   abs: [835, 295] },
  moving_lights:        { es: 'Cabeza móvil',        abrev: 'MV',  forma: 'movil',     color: C.rgb,      dir: 'mesa', abs: [195, 110], count: 2 },
  // — Modificadores —
  negative_fill:        { es: 'Relleno negativo',    abrev: 'NF',  forma: 'flag',      color: C.mod,      dir: 'mesa', off: [230, 55] },
  flag:                 { es: 'Bandera',             abrev: 'FL',  forma: 'flag',      color: C.mod,      dir: 'mesa', off: [-235, 55] },
  fill_control:         { es: 'Control de relleno',  abrev: 'FC',  forma: 'flag',      color: C.mod,      dir: 'mesa', off: [210, 95] },
  diffusion_frame:      { es: 'Marco difusor',       abrev: 'DF',  forma: 'difusor',   color: C.mod,      dir: 'mesa', off: [-125, 120] },
  curtain_shadow:       { es: 'Gobo cortina',        abrev: 'GB',  forma: 'difusor',   color: C.mod,      dir: 'mesa', off: [-265, 125] },
  sun_scrim:            { es: 'Seda / difusor solar', abrev: 'SD', forma: 'difusor',   color: C.mod,      dir: null,   off: [35, -55] },
  reflector:            { es: 'Reflector',           abrev: 'RF',  forma: 'reflector', color: C.rebote,   dir: 'mesa', off: [120, 175] },
  bounce_surface:       { es: 'Rebote',              abrev: 'RB',  forma: 'reflector', color: C.rebote,   dir: 'mesa', off: [-195, 160] },
  // — Técnicos —
  screen_control:       { es: 'Control pantalla',    abrev: 'SC',  forma: 'control',   color: C.tech,     dir: null,   abs: [790, 120] },
  light_meter:          { es: 'Fotómetro',           abrev: 'FM',  forma: 'control',   color: C.tech,     dir: null,   off: [60, 90] },
  dimmer:               { es: 'Dimmer',              abrev: 'DM',  forma: 'control',   color: C.tech,     dir: null,   abs: [125, 480] },
  fog:                  { es: 'Humo / niebla',       abrev: 'FX',  forma: 'fx',        color: C.tech,     dir: null,   abs: [845, 150] },
};

// Configuraciones de iluminación para estudio de TV. Las 19 primeras vienen del
// catálogo docente original (en inglés con nombre_es); las marcadas con
// origen 'ptv' se diseñaron para los flujos propios de la app (FCC-UASLP).
export const SETUPS_ILUMINACION = [
  {
    id: 'three_point_lighting',
    name: 'Three-Point Lighting',
    name_es: 'Iluminación de tres puntos',
    category: 'basic_studio_setup',
    description: 'Configuración clásica con luz principal, luz de relleno y contraluz para iluminar al sujeto y separarlo del fondo.',
    best_for: ['interview', 'news', 'talk_show', 'corporate', 'podcast_video'],
    mood: ['professional', 'clean', 'balanced', 'formal'],
    required_elements: ['key_light', 'fill_light', 'back_light'],
    optional_elements: ['background_light', 'practical_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['desk_set', 'chairs_set', 'panel_set', 'small_studio'],
  },
  {
    id: 'four_point_lighting',
    name: 'Four-Point Lighting',
    name_es: 'Iluminación de cuatro puntos',
    category: 'studio_setup',
    description: 'Versión extendida de la iluminación de tres puntos que añade una luz de fondo para dar más profundidad al set.',
    best_for: ['interview', 'news', 'talk_show', 'corporate', 'commercial'],
    mood: ['professional', 'dimensional', 'clean', 'controlled'],
    required_elements: ['key_light', 'fill_light', 'back_light', 'background_light'],
    optional_elements: ['practical_light', 'accent_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['desk_set', 'chairs_set', 'corporate_set', 'small_studio'],
  },
  {
    id: 'high_key_studio_setup',
    name: 'High-Key Studio Setup',
    name_es: 'Configuración de iluminación alta',
    category: 'bright_studio_setup',
    description: 'Configuración brillante y uniforme con varias luces suaves para reducir sombras y crear una imagen limpia.',
    best_for: ['news', 'morning_show', 'commercial', 'education', 'talk_show'],
    mood: ['bright', 'friendly', 'clean', 'optimistic'],
    required_elements: ['soft_key_light', 'fill_light', 'background_light', 'set_wash'],
    optional_elements: ['top_light', 'reflector', 'eye_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['news_desk', 'white_background', 'commercial_set', 'educational_set'],
  },
  {
    id: 'low_key_interview_setup',
    name: 'Low-Key Interview Setup',
    name_es: 'Configuración de entrevista en clave baja',
    category: 'dramatic_studio_setup',
    description: 'Configuración con una luz principal dominante, poco relleno y separación de fondo para crear una imagen dramática.',
    best_for: ['serious_interview', 'documentary', 'drama', 'mystery', 'cinematic_interview'],
    mood: ['dramatic', 'serious', 'mysterious', 'intense'],
    required_elements: ['hard_key_light', 'negative_fill', 'rim_light'],
    optional_elements: ['practical_light', 'background_accent', 'flag'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['dark_background', 'dramatic_set', 'night_scene', 'cinematic_interview'],
  },
  {
    id: 'two_person_interview_setup',
    name: 'Two-Person Interview Lighting',
    name_es: 'Iluminación para entrevista de dos personas',
    category: 'interview_setup',
    description: 'Configuración pensada para iluminar a dos personas sentadas frente a frente o en ángulo, manteniendo continuidad visual entre cámaras.',
    best_for: ['interview', 'podcast_video', 'talk_show', 'corporate', 'documentary'],
    mood: ['professional', 'balanced', 'natural', 'conversational'],
    required_elements: ['key_light_a', 'key_light_b', 'fill_light', 'back_light'],
    optional_elements: ['background_light', 'practical_light', 'rim_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['chairs_set', 'podcast_set', 'interview_set', 'small_studio'],
  },
  {
    id: 'cross_key_lighting',
    name: 'Cross Key Lighting',
    name_es: 'Iluminación cruzada con luces principales',
    category: 'multi_subject_setup',
    description: 'Configuración donde dos luces principales cruzadas iluminan a sujetos desde lados opuestos, útil para conversaciones o paneles.',
    best_for: ['talk_show', 'panel_show', 'debate', 'round_table', 'multi_camera_show'],
    mood: ['balanced', 'formal', 'professional', 'studio'],
    required_elements: ['key_light_left', 'key_light_right'],
    optional_elements: ['top_light', 'fill_light', 'background_light', 'rim_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['panel_set', 'round_table_set', 'debate_set', 'large_studio'],
  },
  {
    id: 'news_desk_lighting_setup',
    name: 'News Desk Lighting Setup',
    name_es: 'Configuración de iluminación para escritorio de noticias',
    category: 'news_setup',
    description: 'Configuración uniforme y frontal-controlada para conductores sentados en escritorio, con fondo iluminado y apariencia formal.',
    best_for: ['news', 'weather_report', 'morning_show', 'studio_show', 'corporate_news'],
    mood: ['formal', 'clean', 'trustworthy', 'bright'],
    required_elements: ['soft_key_light', 'fill_light', 'back_light', 'background_light', 'top_light'],
    optional_elements: ['eye_light', 'set_wash', 'accent_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['news_desk', 'desk_set', 'broadcast_set', 'large_studio'],
  },
  {
    id: 'panel_show_lighting_setup',
    name: 'Panel Show Lighting Setup',
    name_es: 'Configuración de iluminación para panel',
    category: 'multi_subject_setup',
    description: 'Configuración diseñada para iluminar a varios participantes en una mesa o panel sin que una persona quede más favorecida que otra.',
    best_for: ['panel_show', 'debate', 'talk_show', 'round_table', 'live_show'],
    mood: ['balanced', 'formal', 'professional', 'even'],
    required_elements: ['cross_lights', 'top_light', 'set_wash', 'back_lights'],
    optional_elements: ['background_light', 'accent_light', 'practical_light'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['panel_set', 'round_table_set', 'debate_set', 'large_studio'],
  },
  {
    id: 'podcast_practical_setup',
    name: 'Podcast Practical Lighting Setup',
    name_es: 'Configuración de iluminación práctica para podcast',
    category: 'podcast_setup',
    description: 'Configuración que combina luz suave en los sujetos con lámparas, pantallas o luces visibles dentro del set para crear ambiente.',
    best_for: ['podcast_video', 'interview', 'lifestyle', 'talk_show', 'youtube_show'],
    mood: ['warm', 'modern', 'intimate', 'conversational'],
    required_elements: ['soft_key_light', 'practical_light', 'background_light'],
    optional_elements: ['rgb_light', 'rim_light', 'dimmer', 'accent_light'],
    camera_friendly: true,
    difficulty: 'easy',
    recommended_for_sets: ['podcast_set', 'living_room_set', 'decorated_background', 'small_studio'],
  },
  {
    id: 'chroma_key_lighting_setup',
    name: 'Chroma Key Lighting Setup',
    name_es: 'Configuración de iluminación para pantalla verde',
    category: 'technical_setup',
    description: 'Configuración que separa la iluminación del fondo verde y del sujeto para facilitar el recorte digital limpio.',
    best_for: ['green_screen', 'virtual_set', 'weather_report', 'vfx', 'educational_virtual'],
    mood: ['technical', 'clean', 'neutral', 'controlled'],
    required_elements: ['green_screen_lights', 'subject_key_light', 'fill_light', 'back_light'],
    optional_elements: ['edge_light', 'soft_fill', 'light_meter'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['green_screen_set', 'virtual_studio', 'weather_set', 'vfx_set'],
  },
  {
    id: 'book_light_setup',
    name: 'Book Light Setup',
    name_es: 'Configuración de luz rebotada y difusa',
    category: 'soft_cinematic_setup',
    description: 'Configuración donde la luz se rebota primero y luego pasa por difusión para crear una iluminación muy suave y envolvente.',
    best_for: ['interview', 'beauty', 'corporate', 'cinematic_interview', 'commercial'],
    mood: ['soft', 'premium', 'natural', 'cinematic'],
    required_elements: ['light_source', 'bounce_surface', 'diffusion_frame'],
    optional_elements: ['negative_fill', 'rim_light', 'background_light'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['chairs_set', 'beauty_set', 'corporate_set', 'cinematic_set'],
  },
  {
    id: 'clamshell_lighting_setup',
    name: 'Clamshell Lighting Setup',
    name_es: 'Configuración tipo concha',
    category: 'beauty_setup',
    description: 'Configuración con una luz suave superior y relleno inferior para iluminar el rostro de forma favorecedora.',
    best_for: ['beauty', 'close_up', 'host_intro', 'commercial', 'social_video'],
    mood: ['clean', 'soft', 'glamorous', 'friendly'],
    required_elements: ['top_soft_key_light', 'bottom_fill_light'],
    optional_elements: ['eye_light', 'reflector', 'background_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['beauty_set', 'close_up_set', 'host_set', 'small_studio'],
  },
  {
    id: 'silhouette_backlight_setup',
    name: 'Silhouette Backlight Setup',
    name_es: 'Configuración de silueta con contraluz',
    category: 'dramatic_setup',
    description: 'Configuración donde el fondo o la parte trasera del sujeto se ilumina más que el frente para crear una silueta marcada.',
    best_for: ['intro_sequence', 'drama', 'music_show', 'mystery', 'cinematic_scene'],
    mood: ['mysterious', 'dramatic', 'artistic', 'intense'],
    required_elements: ['background_light', 'back_light'],
    optional_elements: ['fog', 'color_background_light', 'rim_light'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['dark_background', 'dramatic_set', 'music_stage', 'cinematic_set'],
  },
  {
    id: 'product_showcase_lighting_setup',
    name: 'Product Showcase Lighting Setup',
    name_es: 'Configuración de iluminación para producto',
    category: 'commercial_setup',
    description: 'Configuración que combina luz principal, acentos y fondo para destacar un producto o elemento visual dentro del set.',
    best_for: ['commercial', 'product_showcase', 'brand_video', 'tutorial', 'shopping_show'],
    mood: ['premium', 'clean', 'focused', 'commercial'],
    required_elements: ['soft_key_light', 'accent_light', 'background_light'],
    optional_elements: ['rim_light', 'reflector', 'top_light', 'rgb_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['product_set', 'commercial_set', 'brand_set', 'tabletop_set'],
  },
  {
    id: 'tabletop_lighting_setup',
    name: 'Tabletop Lighting Setup',
    name_es: 'Configuración de iluminación para mesa',
    category: 'tabletop_setup',
    description: 'Configuración pensada para iluminar superficies, objetos o actividades realizadas sobre una mesa.',
    best_for: ['cooking_show', 'craft_show', 'tutorial', 'product_demo', 'tabletop'],
    mood: ['clear', 'instructional', 'clean', 'controlled'],
    required_elements: ['top_light', 'soft_key_light', 'fill_light'],
    optional_elements: ['side_light', 'reflector', 'background_light'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['table_set', 'kitchen_set', 'product_set', 'tutorial_set'],
  },
  {
    id: 'host_and_screen_setup',
    name: 'Host and Screen Lighting Setup',
    name_es: 'Configuración para conductor y pantalla',
    category: 'broadcast_setup',
    description: 'Configuración diseñada para iluminar a un conductor junto a una pantalla, monitor o gráfico sin generar reflejos excesivos.',
    best_for: ['news', 'weather_report', 'presentation', 'educational_video', 'corporate'],
    mood: ['professional', 'clear', 'technical', 'modern'],
    required_elements: ['subject_key_light', 'fill_light', 'back_light', 'screen_control'],
    optional_elements: ['background_light', 'top_light', 'eye_light'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['presentation_set', 'weather_set', 'news_set', 'virtual_studio'],
  },
  {
    id: 'rgb_background_setup',
    name: 'RGB Background Lighting Setup',
    name_es: 'Configuración de fondo con luces RGB',
    category: 'stylized_setup',
    description: 'Configuración que mantiene al sujeto iluminado de forma limpia mientras el fondo usa color para crear identidad visual o ambiente.',
    best_for: ['podcast_video', 'music_show', 'streaming', 'youth_show', 'entertainment'],
    mood: ['modern', 'energetic', 'stylized', 'creative'],
    required_elements: ['soft_key_light', 'rgb_background_light', 'back_light'],
    optional_elements: ['practical_light', 'accent_light', 'fog', 'dimmer'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['podcast_set', 'music_stage', 'streaming_set', 'entertainment_set'],
  },
  {
    id: 'motivated_window_light_setup',
    name: 'Motivated Window Light Setup',
    name_es: 'Configuración de luz motivada por ventana',
    category: 'realistic_setup',
    description: 'Configuración que simula una fuente natural como una ventana, manteniendo una apariencia realista y suave.',
    best_for: ['interview', 'documentary', 'lifestyle', 'corporate', 'cinematic_interview'],
    mood: ['natural', 'realistic', 'soft', 'calm'],
    required_elements: ['large_soft_key_light', 'fill_control', 'background_light'],
    optional_elements: ['negative_fill', 'practical_light', 'curtain_shadow', 'reflector'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['living_room_set', 'office_set', 'chairs_set', 'documentary_set'],
  },
  {
    id: 'stage_wash_setup',
    name: 'Stage Wash Lighting Setup',
    name_es: 'Configuración de baño de luz para escenario',
    category: 'large_studio_setup',
    description: 'Configuración que distribuye luz amplia sobre un escenario o set grande para mantener cobertura uniforme en cámara.',
    best_for: ['variety_show', 'game_show', 'live_show', 'music_show', 'large_studio'],
    mood: ['bright', 'even', 'studio', 'energetic'],
    required_elements: ['wash_lights', 'top_lights', 'background_lights'],
    optional_elements: ['color_accent_lights', 'moving_lights', 'spotlight'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['large_studio', 'stage_set', 'game_show_set', 'music_stage'],
  },
  // — Diseñadas para los flujos de la app (FCC-UASLP) —
  {
    id: 'educational_classroom_setup',
    name: 'Educational Classroom Setup',
    name_es: 'Aula / clase grabada',
    category: 'educational_setup',
    origen: 'ptv',
    description: 'Configuración sencilla y uniforme para grabar clases o cápsulas educativas: docente bien iluminado, pizarrón o pantalla legible y sombras mínimas.',
    best_for: ['education', 'educational_video', 'tutorial', 'presentation', 'corporate'],
    mood: ['clear', 'friendly', 'clean', 'instructional'],
    required_elements: ['soft_key_light', 'fill_light', 'background_light', 'screen_control'],
    optional_elements: ['top_light', 'eye_light', 'practical_light'],
    camera_friendly: true,
    difficulty: 'easy',
    recommended_for_sets: ['educational_set', 'presentation_set', 'small_studio', 'desk_set'],
  },
  {
    id: 'solo_host_streaming_setup',
    name: 'Solo Host Streaming Setup',
    name_es: 'Host solo (streaming / YouTube)',
    category: 'streaming_setup',
    origen: 'ptv',
    description: 'Configuración compacta para una sola persona frente a cámara: principal suave, recorte para separar del fondo y color RGB de identidad.',
    best_for: ['streaming', 'youtube_show', 'podcast_video', 'social_video', 'host_intro'],
    mood: ['modern', 'energetic', 'intimate', 'stylized'],
    required_elements: ['soft_key_light', 'rim_light', 'rgb_background_light'],
    optional_elements: ['practical_light', 'accent_light', 'eye_light', 'dimmer'],
    camera_friendly: true,
    difficulty: 'easy',
    recommended_for_sets: ['streaming_set', 'podcast_set', 'small_studio', 'decorated_background'],
  },
  {
    id: 'exterior_sun_bounce_setup',
    name: 'Exterior Sun Bounce Setup',
    name_es: 'Exterior: sol con rebote',
    category: 'exterior_setup',
    origen: 'ptv',
    description: 'Para locación exterior de día: el sol actúa como luz principal, el rebote lo devuelve al rostro del sujeto, el negativo modela y la seda suaviza la luz dura del mediodía.',
    best_for: ['documentary', 'vox_pop', 'campus_report', 'interview', 'lifestyle'],
    mood: ['natural', 'bright', 'realistic', 'fresh'],
    required_elements: ['reflector', 'negative_fill'],
    optional_elements: ['sun_scrim', 'flag', 'hmi_key_light'],
    camera_friendly: true,
    difficulty: 'easy',
    recommended_for_sets: ['exterior_set', 'campus_set', 'street_set', 'garden_set'],
  },
  {
    id: 'exterior_hmi_backlit_setup',
    name: 'Exterior HMI Backlit Setup',
    name_es: 'Exterior: contraluz solar + HMI',
    category: 'exterior_setup',
    origen: 'ptv',
    description: 'El sol queda detrás del sujeto como contraluz natural y un HMI balanceado a luz día recupera el rostro; seda y bandera controlan destellos y contrastes.',
    best_for: ['interview', 'documentary', 'sports', 'corporate', 'cinematic_interview'],
    mood: ['premium', 'natural', 'controlled', 'cinematic'],
    required_elements: ['hmi_key_light', 'sun_scrim'],
    optional_elements: ['reflector', 'negative_fill', 'flag'],
    camera_friendly: true,
    difficulty: 'medium',
    recommended_for_sets: ['exterior_set', 'street_set', 'stadium_set', 'rooftop_set'],
  },
  {
    id: 'exterior_night_setup',
    name: 'Exterior Night Setup',
    name_es: 'Exterior nocturno',
    category: 'exterior_setup',
    origen: 'ptv',
    description: 'Para grabar de noche en exteriores: principal dirigida al sujeto, recorte para separarlo del fondo oscuro y prácticas o RGB para dar vida al entorno urbano.',
    best_for: ['news_live', 'events', 'music_show', 'drama', 'urban_report'],
    mood: ['dramatic', 'urban', 'energetic', 'night'],
    required_elements: ['key_light', 'rim_light', 'practical_light'],
    optional_elements: ['rgb_light', 'fog', 'background_light', 'moving_lights'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['exterior_set', 'street_set', 'night_scene', 'urban_set'],
  },
  {
    id: 'music_performance_setup',
    name: 'Music Performance Setup',
    name_es: 'Presentación musical en vivo',
    category: 'large_studio_setup',
    origen: 'ptv',
    description: 'Configuración de espectáculo para números musicales: baño de luz general, contraluces intensos, color en el fondo y atmósfera con humo.',
    best_for: ['music_show', 'live_show', 'variety_show', 'entertainment', 'concert'],
    mood: ['energetic', 'dramatic', 'colorful', 'show'],
    required_elements: ['wash_lights', 'back_lights', 'color_accent_lights'],
    optional_elements: ['moving_lights', 'fog', 'spotlight', 'rgb_light'],
    camera_friendly: true,
    difficulty: 'high',
    recommended_for_sets: ['music_stage', 'stage_set', 'large_studio', 'entertainment_set'],
  },
];

export const getSetup = (id) => SETUPS_ILUMINACION.find((s) => s.id === id) || null;

// Pool completo del catálogo, agrupado por familia, para agregar elementos
// sueltos al plano sin depender de los opcionales de un setup.
export const LUZ_GRUPOS = [
  { label: 'Principales', tipos: ['key_light', 'soft_key_light', 'hard_key_light', 'subject_key_light', 'large_soft_key_light', 'top_soft_key_light', 'key_light_a', 'key_light_b', 'key_light_left', 'key_light_right', 'cross_lights', 'light_source', 'spotlight', 'hmi_key_light'] },
  { label: 'Rellenos', tipos: ['fill_light', 'soft_fill', 'bottom_fill_light', 'side_light', 'eye_light'] },
  { label: 'Contras y recortes', tipos: ['back_light', 'back_lights', 'rim_light', 'edge_light'] },
  { label: 'Fondo', tipos: ['background_light', 'background_lights', 'background_accent', 'color_background_light', 'rgb_background_light', 'green_screen_lights'] },
  { label: 'Baños y cenitales', tipos: ['set_wash', 'wash_lights', 'top_light', 'top_lights'] },
  { label: 'Ambiente y color', tipos: ['practical_light', 'accent_light', 'color_accent_lights', 'rgb_light', 'moving_lights'] },
  { label: 'Modificadores', tipos: ['negative_fill', 'flag', 'fill_control', 'diffusion_frame', 'curtain_shadow', 'sun_scrim', 'reflector', 'bounce_surface'] },
  { label: 'Técnicos', tipos: ['screen_control', 'light_meter', 'dimmer', 'fog'] },
];

// Configuraciones pensadas para sets en locación exterior (el panel las
// destaca cuando el set activo tiene locacion 'ext').
export const SETUPS_EXTERIOR = ['exterior_sun_bounce_setup', 'exterior_hmi_backlit_setup', 'exterior_night_setup'];

// Recomendaciones por plantilla del asistente (cfg.plantilla).
export const RECOMENDADAS_POR_PLANTILLA = {
  podcast: ['podcast_practical_setup', 'two_person_interview_setup', 'rgb_background_setup', 'three_point_lighting'],
  noticiero: ['news_desk_lighting_setup', 'high_key_studio_setup', 'four_point_lighting', 'host_and_screen_setup', 'chroma_key_lighting_setup'],
  entrevista: ['three_point_lighting', 'two_person_interview_setup', 'low_key_interview_setup', 'motivated_window_light_setup', 'book_light_setup'],
  streaming: ['solo_host_streaming_setup', 'rgb_background_setup', 'podcast_practical_setup', 'host_and_screen_setup'],
  multicamara: ['stage_wash_setup', 'panel_show_lighting_setup', 'cross_key_lighting', 'music_performance_setup'],
};

/* ------------------------- Instanciación en el plano ------------------------- */

let seq = 0;
const uid = () => `luz-${Date.now().toString(36)}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// El lienzo mide 980×600 y el arrastre acota a x∈[48,932], y∈[100,556].
const clamp = (p) => ({ x: Math.round(Math.max(48, Math.min(932, p.x))), y: Math.round(Math.max(100, Math.min(556, p.y))) });

// Posiciones iniciales de un elemento: offset respecto a la mesa o absolutas;
// la segunda instancia (count 2) se refleja horizontalmente.
function posicionesDe(tipo, mesaPos) {
  const def = LUZ_CATALOGO[tipo];
  const n = def.count || 1;
  return Array.from({ length: n }, (_, i) => {
    let p = def.abs
      ? { x: def.abs[0], y: def.abs[1] }
      : { x: mesaPos.x + def.off[0], y: mesaPos.y + def.off[1] };
    if (i === 1) p = def.abs ? { x: 980 - p.x, y: p.y } : { x: mesaPos.x - def.off[0], y: p.y };
    return clamp(p);
  });
}

// Crea las instancias autocontenidas de un elemento + sus posiciones iniciales
// (claves `luz:<id>` listas para mezclar en cfg.setLayout.pos).
export function instanciarElemento(tipo, mesaPos, { opcional = false } = {}) {
  const def = LUZ_CATALOGO[tipo];
  if (!def) return { luces: [], pos: {} };
  const puntos = posicionesDe(tipo, mesaPos);
  const luces = puntos.map((_, i) => ({
    id: uid(),
    tipo,
    nombre: puntos.length > 1 ? `${def.es} ${i + 1}` : def.es,
    abrev: def.abrev,
    color: def.color,
    forma: def.forma,
    dir: def.dir,
    opcional,
  }));
  const pos = {};
  luces.forEach((l, i) => { pos[`luz:${l.id}`] = puntos[i]; });
  return { luces, pos };
}

// Instancia todos los elementos requeridos de un setup.
export function instanciarSetup(setup, mesaPos) {
  const luces = [];
  const pos = {};
  (setup.required_elements || []).forEach((tipo) => {
    const r = instanciarElemento(tipo, mesaPos, { opcional: false });
    luces.push(...r.luces);
    Object.assign(pos, r.pos);
  });
  return { luces, pos };
}

// Recoloca luces EXISTENTES en sus posiciones típicas de catálogo (lo usa
// "Reacomodar automáticamente": sin esto caerían todas al centro del plano,
// porque las luces no tienen posición por defecto en el lienzo).
export function posicionesParaLuces(luces, mesaPos = { x: 490, y: 240 }) {
  const pos = {};
  const idxPorTipo = {};
  (luces || []).forEach((l) => {
    const def = LUZ_CATALOGO[l.tipo];
    if (!def) { pos[`luz:${l.id}`] = clamp({ x: 490, y: 320 }); return; }
    const puntos = posicionesDe(l.tipo, mesaPos);
    const i = (idxPorTipo[l.tipo] = (idxPorTipo[l.tipo] ?? -1) + 1);
    const base = puntos[i % puntos.length];
    const extra = Math.floor(i / puntos.length); // repetidos del mismo tipo: escalonar
    pos[`luz:${l.id}`] = clamp({ x: base.x + extra * 42, y: base.y + extra * 16 });
  });
  return pos;
}

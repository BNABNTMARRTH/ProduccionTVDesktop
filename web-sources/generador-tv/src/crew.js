/* EL VOCABULARIO DE LA AGENDA — quién es quién en un rodaje.
   ---------------------------------------------------------------------------
   Son solo DATOS, como catalogos.js: listas y etiquetas, sin lógica. Para
   agregar un puesto se edita aquí y no hace falta tocar la interfaz.

   Sale del catálogo de crew de San Luis Potosí (documento del 2 de septiembre
   de 2026), con los acentos repuestos: el documento venía sin ellos y una app
   en español que escribe "produccion" se ve descuidada — y además rompe las
   búsquedas de quien sí los escribe.

   POR QUÉ SON TANTOS (384). Porque el problema real no es elegir de una lista
   corta, es que el puesto que buscas TENGA nombre. Un productor que necesita
   un "focus puller" no lo encuentra en una lista de diez oficios genéricos. Se
   navegan escribiendo, no bajando: el campo es un `datalist`, igual que los
   planos del guion técnico, así que tecleas tres letras y aparece el tuyo — y
   si tu oficio no está, lo escribes y ya.

   Los departamentos existen para FILTRAR, no para elegir: en la agenda son
   doce pastillas que se tocan, y cada persona hereda el suyo de su rol. */


// Cada departamento con sus puestos. El `id` es el que se guarda en la ficha.
export const DEPARTAMENTOS = [
  {
    id: "talento", nombre: "Talento",
    detalle: "Frente a cámara: actores, modelos, conducción, voz",
    roles: [
      "Actor", "Actriz", "Actor infantil", "Actriz infantil", "Actor juvenil",
      "Actriz juvenil", "Actor adulto", "Actriz adulta", "Actor adulto mayor",
      "Actriz adulta mayor", "Extra", "Extra con experiencia", "Figurante", "Stand-in",
      "Doble de acción", "Doble de cuerpo", "Doble de luces", "Modelo", "Modelo fotografico",
      "Modelo de pasarela", "Modelo comercial", "Modelo de manos", "Modelo fitness",
      "Modelo plus size", "Modelo infantil", "Edecán", "Host", "Conductor", "Conductora",
      "Presentador", "Presentadora", "Maestro de ceremonias", "Animador", "Entrevistador",
      "Reportero", "Corresponsal", "Locutor", "Locutora", "Voz en off", "Doblajista",
      "Narrador", "Narradora", "Cantante", "Músico", "Bailarín", "Bailarina", "Performer",
      "Influencer", "Creador de contenido", "Tiktoker", "Streamer", "Podcaster",
      "Especialista en improvisación", "Talento bilingüe", "Talento con acento regional",
      "Talento con habilidades deportivas", "Talento con habilidades de manejo",
      "Talento con habilidades musicales"
    ],
  },
  {
    id: "direccion", nombre: "Dirección",
    detalle: "Dirección, producción, AD, casting y locaciones",
    roles: [
      "Productor ejecutivo", "Productor", "Productor general", "Productor de línea",
      "Productor de campo", "Productor asociado", "Coordinador de producción",
      "Jefe de producción", "Gerente de producción", "Asistente de producción", "Runner",
      "Director", "Directora", "Director creativo", "Director de escena",
      "Director de actores", "Primer asistente de dirección", "Segundo asistente de dirección",
      "Tercer asistente de dirección", "Floor manager", "Regidor", "Continuista",
      "Script supervisor", "Supervisor de producción", "Coordinador de llamados",
      "Coordinador de locaciones", "Scout de locaciones", "Casting director",
      "Asistente de casting", "Coordinador de talento", "Coordinador de extras",
      "Coordinador de transporte", "Coordinador de hospedaje", "Coordinador de catering",
      "Coordinador de permisos"
    ],
  },
  {
    id: "guion", nombre: "Guion",
    detalle: "Escritura, investigación y desarrollo de contenido",
    roles: [
      "Guionista", "Co-guionista", "Script doctor", "Investigador", "Investigador documental",
      "Redactor", "Copywriter", "Editor de guion", "Story editor", "Showrunner",
      "Creador de formato", "Desarrollador de contenido", "Dramaturgo", "Consultor narrativo",
      "Escaletista", "Guionista de comerciales", "Guionista de ficción",
      "Guionista documental", "Guionista para redes sociales", "Guionista de podcast",
      "Guionista de noticiero", "Traductor", "Adaptador", "Corrector de estilo",
      "Supervisor de continuidad narrativa"
    ],
  },
  {
    id: "camara", nombre: "Cámara",
    detalle: "Fotografía, operación, asistencia, drone y movimiento",
    roles: [
      "Director de fotografía", "Cinematógrafo", "Operador de cámara", "Camarógrafo",
      "Fotógrafo", "Fotógrafo de stills", "Fotógrafo BTS", "Fotógrafo de producto",
      "Fotógrafo de eventos", "Fotógrafo de moda", "Fotógrafo documental",
      "Primer asistente de cámara", "Segundo asistente de cámara", "Focus puller",
      "Clapper loader", "Loader", "DIT", "Data wrangler", "Video assist",
      "Operador de monitor", "Operador de gimbal", "Operador de steadicam",
      "Operador de drone", "Piloto de drone", "Operador de grúa", "Operador de slider",
      "Operador de dolly", "Operador de teleprompter", "Técnico de cámara", "Lens technician",
      "Colorista en set", "Fotometrista"
    ],
  },
  {
    id: "luz", nombre: "Luz y grip",
    detalle: "Iluminación, eléctrico, tramoya y rigging",
    roles: [
      "Gaffer", "Jefe de iluminación", "Técnico de iluminación", "Iluminador",
      "Best boy electric", "Eléctrico", "Auxiliar eléctrico", "Key grip", "Grip",
      "Best boy grip", "Maquinista", "Tramoyista", "Rigging grip", "Rigger",
      "Operador de planta", "Técnico de planta eléctrica", "Jefe de tramoya",
      "Operador de dimmer", "Programador de luces", "Operador DMX",
      "Técnico de consola de iluminación", "Técnico de LED", "Técnico de pantallas",
      "Técnico de efectos prácticos", "Técnico de humo", "Técnico de seguridad eléctrica"
    ],
  },
  {
    id: "audio", nombre: "Audio",
    detalle: "Sonido directo, música, diseño sonoro y mezcla",
    roles: [
      "Sonidista", "Microfonista", "Production sound mixer", "Boom operator",
      "Asistente de sonido", "A1", "A2", "Operador de audio", "Ingeniero de audio",
      "Técnico RF", "Técnico de micrófonos", "Técnico de intercom", "Operador de playback",
      "Operador de música", "Compositor", "Productor musical", "Músico de sesión",
      "Supervisor musical", "Diseñador sonoro", "Editor de diálogos", "Editor de sonido",
      "Mezclador", "Re-recording mixer", "Foley artist", "Foley recordist",
      "Ingeniero de mezcla", "Ingeniero de mastering", "Locutor comercial"
    ],
  },
  {
    id: "arte", nombre: "Arte",
    detalle: "Escenografía, utilería, vestuario y maquillaje",
    roles: [
      "Director de arte", "Diseñador de producción", "Escenógrafo", "Ambientador",
      "Decorador de set", "Utilero", "Props master", "Asistente de arte",
      "Carpintero escénico", "Pintor escénico", "Constructor de sets", "Vestuarista",
      "Diseñador de vestuario", "Asistente de vestuario", "Sastre", "Costurera", "Stylist",
      "Coordinador de guardarropa", "Maquillista", "Maquillista de efectos", "Peinador",
      "Barbero", "Caracterizador", "Prosthetics artist", "Coordinador de producto",
      "Food stylist", "Animal wrangler", "Jardinero escénico", "Florista"
    ],
  },
  {
    id: "vivo", nombre: "Live",
    detalle: "Switcher, streaming, gráficos, ingeniería y piso",
    roles: [
      "Director de cámaras", "Realizador", "Technical director", "Operador de switcher",
      "Operador ATEM", "Operador Tricaster", "Operador vMix", "Operador OBS",
      "Ingeniero de video", "Video shader", "CCU operator", "Broadcast engineer",
      "Ingeniero de streaming", "Técnico de encoder", "Técnico de red", "Técnico NDI",
      "Técnico SRT", "Técnico RTMP", "Operador de gráficos", "Operador de lower thirds",
      "Operador de CG", "Operador de playback", "Operador de replay", "Operador de VTR",
      "Operador de prompter", "Coordinador de piso", "Stage manager", "Productor de live",
      "Moderador de chat", "Community manager en vivo", "Técnico de intercom",
      "Técnico de tally", "Técnico de grabación ISO", "Jefe técnico"
    ],
  },
  {
    id: "post", nombre: "Post",
    detalle: "Edición, color, VFX, gráficos y entregables",
    roles: [
      "Editor", "Editora", "Asistente de edición", "Postproductor",
      "Coordinador de postproducción", "Supervisor de postproducción", "Colorista",
      "Conform artist", "Online editor", "Offline editor", "Motion designer", "Animador 2D",
      "Animador 3D", "Artista VFX", "Compositor VFX", "Supervisor VFX", "Rotoscopista",
      "Matte painter", "Editor de trailer", "Editor de redes sociales", "Editor de reels",
      "Editor de podcast", "Editor multicámara", "Subtitulador", "Captioner",
      "Traductor audiovisual", "Diseñador gráfico", "Diseñador de títulos", "Infografista",
      "Data wrangler de post", "Técnico de ingest", "Técnico de proxies", "Archivista digital",
      "QC operator", "Mastering operator", "DCP technician"
    ],
  },
  {
    id: "digital", nombre: "Digital",
    detalle: "Redes, estrategia, difusión y pauta",
    roles: [
      "Social media manager", "Community manager", "Estratega de contenido", "Content manager",
      "Copy de redes", "Diseñador para redes", "Editor vertical", "Thumbnail designer",
      "Especialista YouTube", "Especialista TikTok", "Especialista Instagram",
      "Especialista SEO video", "Media buyer", "Trafficker", "Publicista", "PR",
      "Coordinador de prensa", "Fotógrafo de evento para redes", "Creador UGC",
      "Productor de contenido de marca", "Analista de métricas", "Distribuidor digital",
      "Programador de publicaciones"
    ],
  },
  {
    id: "logistica", nombre: "Logística",
    detalle: "Locación, transporte, permisos, renta y soporte",
    roles: [
      "Jefe de locación", "Asistente de locación", "Seguridad", "Paramédico",
      "Coordinador de riesgos", "Chofer", "Transportista", "Rentador de vans",
      "Coordinador de alimentos", "Catering", "Craft services", "Hospedaje",
      "Runner de compras", "Mensajero", "Bodeguero", "Encargado de equipo",
      "Técnico de mantenimiento", "Rentador de equipo", "Rentador de cámaras",
      "Rentador de luces", "Rentador de audio", "Rentador de grip", "Rentador de foro",
      "Rentador de estudio", "Rentador de locación", "Permisos municipales",
      "Gestor de permisos", "Abogado de producción", "Contador de producción", "Facturación",
      "Seguro de producción"
    ],
  },
  {
    id: "nicho", nombre: "Especialidad",
    detalle: "Nichos: bodas, deportes, producto, FPV, timelapse…",
    roles: [
      "Videógrafo de bodas", "Videógrafo corporativo", "Videógrafo de eventos",
      "Videógrafo musical", "Videógrafo deportivo", "Videógrafo inmobiliario",
      "Videógrafo de producto", "Documentalista", "Realizador documental",
      "Periodista audiovisual", "Operador multicámara", "Especialista en podcast",
      "Especialista en cursos online", "Especialista en teatro grabado",
      "Especialista en conciertos", "Especialista en deportes", "Especialista en drone FPV",
      "Especialista en stop motion", "Especialista en timelapse",
      "Especialista en fotografía analógica", "Especialista en underwater",
      "Especialista en automotriz", "Especialista en alimentos", "Especialista en moda",
      "Especialista en producto", "Especialista en arquitectura", "Especialista en social ads"
    ],
  },
];

// Todos los puestos en una sola lista, para el `datalist` del campo Rol.
export const ROLES = DEPARTAMENTOS.flatMap((d) => d.roles);

// De un puesto a su departamento (se calcula una vez). Así la ficha solo guarda
// el rol y el departamento se deduce: dos campos que pueden contradecirse son
// un campo de más.
export const DEPTO_DE_ROL = Object.fromEntries(
  DEPARTAMENTOS.flatMap((d) => d.roles.map((r) => [r, d.id])),
);
export const departamentoDe = (rol) => DEPTO_DE_ROL[rol] || "";
export const nombreDepto = (id) => DEPARTAMENTOS.find((d) => d.id === id)?.nombre || "";

// Etiquetas que valen para cualquier oficio: lo que cambia si puedes llamarle o no.
export const ETIQUETAS = [
  "Tiene equipo propio", "Tiene transporte", "Puede viajar", "Factura",
  "Disponible fines de semana", "Disponible noches", "Disponible urgente", "Bilingüe",
  "Inglés", "Lengua de señas", "Experiencia con niños", "Experiencia con adultos mayores",
  "Experiencia en set grande", "Experiencia en bajo presupuesto", "Experiencia estudiantil",
  "Experiencia profesional", "Experiencia en vivo", "Experiencia en exterior",
  "Experiencia en estudio", "Trabajo remoto", "Trabajo presencial", "Trabajo híbrido",
  "Crew femenino", "Crew universitario", "Crew senior", "Portafolio verificado",
  "Contacto verificado"
];

// Qué tan hecho está alguien. Sirve para no mandar a un estudiante a un rodaje
// que no aguanta, y para no encarecer uno que sí aguanta un estudiante.
export const NIVELES = ["Estudiante", "Junior", "Medio", "Senior"];

// Cuándo se le puede llamar. Es la pregunta que sigue a "¿quién?".
// "Puede viajar" NO va aquí aunque suene a disponibilidad: ya vive en las
// etiquetas, y repetida en dos filas obliga a marcarla dos veces o —peor— a
// dudar de cuál de las dos mira el filtro.
export const DISPONIBILIDAD = ["Entre semana", "Fines de semana", "Noches", "Por proyecto"];

/* RASGOS DE CASTING. Solo aparecen si la ficha está marcada como talento frente
   a cámara: a un gaffer no se le pregunta el color de ojos.

   Se guardan porque un casting real los pide ("actor de 25 a 35, tez clara,
   1.80") y sin ellos la agenda no sirve para eso. Van con dos cuidados: son
   opcionales siempre, y describen a la persona para un papel concreto — no son
   una calificación ni un orden de mérito. */
export const TEZ = ["Muy clara", "Clara", "Media", "Morena", "Morena oscura", "Oscura"];
export const OJOS = ["Café", "Café claro", "Negro", "Verde", "Azul", "Gris", "Miel"];
export const CABELLO = ["Negro", "Castaño", "Castaño claro", "Rubio", "Pelirrojo", "Canoso", "Teñido", "Rapado", "Calvo"];
export const CABELLO_TIPO = ["Lacio", "Ondulado", "Rizado", "Afro", "Corto", "Media melena", "Largo"];
export const COMPLEXION = ["Delgada", "Atlética", "Media", "Robusta", "Plus size"];
export const HABILIDADES = [
  "Baile", "Canto", "Instrumento", "Actuación teatral", "Improvisación", "Doblaje",
  "Deportes", "Artes marciales", "Nado", "Equitación", "Manejo de auto", "Manejo de moto",
  "Bicicleta", "Patinaje", "Acrobacia", "Escenas de riesgo", "Lengua de señas",
];
export const IDIOMAS = ["Español", "Inglés", "Francés", "Alemán", "Italiano", "Portugués", "Náhuatl", "Lengua de señas"];

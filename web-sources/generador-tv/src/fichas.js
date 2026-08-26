// Fichas de "cómo se hace" cada tipo de pieza. NO se edita a mano: se genera
// a partir de las respuestas de los cuadernos de NotebookLM del proyecto
// (ver web-sources/README.md).
//
// La ficha que se muestra NO se busca: se deduce de lo que el proyecto ya dice
// ser — cfg.narrativa.tipo (videoclip, publicidad…) y cfg.perfil.medios
// (TikTok, Instagram/Reels…). Ver `fichasDe()` más abajo.

export const FICHAS = [
  {
    "id": "narrativo",
    "titulo": "Guion narrativo",
    "resumen": "Ficción: corto, serie o pieza con historia",
    "fuente": "2. Guion y narrativa",
    "empezar": "Antes de escribir una sola línea de acción, debes decidir con precisión quién es tu protagonista y qué es lo que quiere lograr. Esta decisión inicial definirá la necesidad dramática del personaje y servirá de motor para estructurar todo el conflicto de la historia.",
    "pasos": [
      "Definir la premisa dramática, la necesidad del protagonista y el conflicto central.",
      "Desarrollar la estructura en tres actos marcando los puntos de giro principales.",
      "Crear una escaleta detallada escena por escena para organizar la progresión de la trama.",
      "Redactar el borrador en tiempo presente absoluto usando acciones físicas y diálogos breves.",
      "Revisar y pulir el texto para recortar redundancias y optimizar el ritmo dramático."
    ],
    "estructura": [
      "Planteamiento (Acto I): Presenta al personaje, sus circunstancias iniciales y el incidente detonante.",
      "Confrontación (Acto II): Muestra la lucha del protagonista frente a obstáculos y conflictos crecientes.",
      "Resolución (Acto III): Lleva la historia a su clímax irreversible y definitivo, seguido del desenlace."
    ],
    "duracion": "Un guion suele durar lo equivalente a sus páginas escritas debido a la regla estándar de que una página de formato profesional equivale a un minuto de tiempo real en pantalla.",
    "errores": [
      "Abusar del diálogo puramente expositivo para explicar el trasfondo en lugar de sugerir subtexto.",
      "Diseñar escenas planas que no contienen un conflicto activo ni cambian los valores de los personajes.",
      "Crear un protagonista pasivo que carece de una necesidad dramática fuerte que impulse la acción.",
      "Escribir descripciones de acción redundantes y con verbos pasivos en vez de acciones físicas presentes."
    ],
    "revisa": [
      "¿Tiene el protagonista una necesidad dramática clara que guía sus decisiones y empuja la trama?",
      "¿Cada una de las escenas contiene un conflicto efectivo o un punto de giro real?",
      "¿Está todo el guion escrito en tiempo presente absoluto con verbos de acción dinámicos?",
      "¿Los diálogos son breves y evitan explicar de manera directa lo que el espectador debería deducir?"
    ]
  },
  {
    "id": "comercial",
    "titulo": "Comercial o spot",
    "resumen": "Publicidad: vender una idea en poco tiempo",
    "fuente": "3. Comerciales, spots y videoclips",
    "empezar": "La primera decisión indispensable antes de escribir es segmentar el mercado para definir con precisión el público objetivo o target group de la pieza. A partir de esta definición, se debe determinar el eje axiológico o propuesta de valor central que guiará la estrategia persuasiva de todo el relato.",
    "pasos": [
      "Definir con precisión el target group y establecer la propuesta axiológica o mensaje central de la campaña.",
      "Desarrollar una idea narrativa (storytelling) atractiva que estructure las emociones y capte la atención de la audiencia.",
      "Elaborar el guion multimodal planificando con rigor la sincronía entre imagen, diálogos, textos y música.",
      "Realizar la producción y el montaje audiovisual cuidando que el ritmo visual y el pulso sonoro mantengan la cohesión.",
      "Evaluar la eficacia de la pieza midiendo las respuestas cognitivas, afectivas y conativas del público antes de difundirla."
    ],
    "estructura": [
      "Exposición: Presentación de los personajes y del contexto inicial en un entorno reconocible para enganchar al espectador.",
      "Acción ascendente: Desarrollo de la tensión dramática, mostrando el conflicto o necesidad que moviliza el relato.",
      "Clímax: Momento de máxima intensidad emocional donde se introduce el giro inesperado o elemento de sorpresa.",
      "Resolución: Desenlace del conflicto donde se presenta la marca o eslogan final de forma orgánica como solución."
    ],
    "duracion": "Suele durar menos de 30 segundos. Este tiempo es ideal porque permite narrar una historia dramática completa con gran dinamismo y fuerza persuasiva, adaptándose con precisión a los hábitos de consumo y a los formatos comerciales estándar de emisión.",
    "errores": [
      "No desarrollar un arco dramático completo, limitándose a mostrar el producto sin contar una historia real que genere empatía.",
      "Diseñar narrativas con una inclusión superficial o inauténtica, lo que arruina la credibilidad y provoca rechazo en la audiencia.",
      "Descuidar la sincronización entre imagen y música, rompiendo el flujo rítmico y la cohesión semántica de la pieza multimodal.",
      "Desconectar el clímax dramático de la marca anunciada, haciendo que el espectador recuerde la historia pero olvide qué se ofrecía."
    ],
    "revisa": [
      "¿El borrador posee un desarrollo narrativo completo que incluye exposición, desarrollo del conflicto y resolución clara?",
      "¿Se ha integrado un elemento de sorpresa o giro inesperado que incremente la preferencia por la pieza publicitaria?",
      "¿La marca y su logotipo aparecen asociados de manera orgánica y oportuna en el momento del desenlace del relato?",
      "¿Los recursos visuales, la voz y la música cooperan rítmicamente en armonía para construir una sola unidad de sentido?"
    ]
  },
  {
    "id": "videoclip",
    "titulo": "Videoclip musical",
    "resumen": "Imagen al servicio de una canción",
    "fuente": "3. Comerciales, spots y videoclips",
    "empezar": "La primera decisión indispensable antes de escribir nada es analizar minuciosamente la canción para entenderla como el texto subyacente que guiará toda la construcción audiovisual. A partir de ella, se debe elegir si el video tendrá un enfoque de actuación (performance), conceptual o narrativo para consolidar el personaje o star-text del artista.",
    "pasos": [
      "Analizar la letra, el ritmo y la estructura de la canción para definir el concepto estético central y el personaje del artista.",
      "Redactar el guion estructurando minuciosamente la alternancia entre secuencias de actuación musical y secuencias narrativas.",
      "Planificar la producción detallando los desgloses de planos, las localizaciones, el vestuario y la paleta de colores.",
      "Realizar el rodaje registrando múltiples tomas de sincronía labial (playback) y las escenas de ficción o dramáticas.",
      "Editar la pieza en el montaje utilizando técnicas de síncresis para que el ritmo visual y el pulso musical coincidan."
    ],
    "estructura": [
      "Secuencias de actuación: Escenas de performance donde el músico interpreta o baila el tema ante la cámara.",
      "Secuencias narrativas: Hilo argumental o ficcional que relata una historia inspirada en la temática del tema musical.",
      "Interludios y transiciones: Momentos de atmósfera visual que conectan el universo narrativo con el musical."
    ],
    "duracion": "Suele durar entre 3 y 5 minutos. Esta duración está supeditada estrictamente a la extensión de la propia canción, ya que el video musical nace, se desarrolla y se edita para complementar y promocionar esa pista de audio específica.",
    "errores": [
      "Desarrollar una narrativa visual que ignore la estructura métrica, los cambios de ritmo y la atmósfera de la música.",
      "Olvidar grabar suficientes planos de cobertura o playbacks, lo que limita gravemente el dinamismo del montaje final.",
      "Desatender la puesta en escena del artista principal, perjudicando la construcción de su identidad pública o star-text.",
      "Cometer fallas de sincronía labial entre los movimientos de los cantantes en el rodaje y la pista de audio original."
    ],
    "revisa": [
      "¿El montaje visual responde de manera orgánica y coherente al pulso, los acentos y las dinámicas del audio?",
      "¿Se mantiene un equilibrio dinámico y fluido entre las secuencias de actuación y las partes dramáticas o de ficción?",
      "¿La puesta en escena y la estética elegida potencian la imagen pública y el universo del artista musical?",
      "¿El playback del cantante se encuentra perfectamente sincronizado con el sonido del tema en todo momento?"
    ]
  },
  {
    "id": "tiktok",
    "titulo": "Video para TikTok",
    "resumen": "Vertical, corto y pensado para el algoritmo",
    "fuente": "4. TikTok, formato vertical y algoritmo",
    "empezar": "Decide antes de escribir si tu video buscará la persuasión a través del humor y la emoción, o si aportará utilidad práctica directa. Esta elección definirá el tono espontáneo y cotidiano que exige la plataforma frente a la estética rígida de otras redes.",
    "pasos": [
      "Define un gancho visual o auditivo potente en los primeros 3 segundos para evitar que el usuario deslice el video de inmediato.",
      "Graba en formato vertical nativo (9:16) y en entornos cotidianos y naturales para proyectar autenticidad y cercanía.",
      "Edita la pieza con un montaje dinámico de ritmo rápido, priorizando transiciones sencillas y cortes limpios sobre la producción compleja.",
      "Integra música popular o efectos de sonido en tendencia para estimular la reproducción completa y favorecer la recomendación algorítmica.",
      "Diseña superposiciones de texto claro y escribe un título descriptivo enfocado en los beneficios del contenido para enganchar a la audiencia."
    ],
    "estructura": [
      "Gancho (primeros 3 segundos): Un elemento de gran impacto visual, pregunta intrigante o sonido viral.",
      "Desarrollo (cuerpo): Explicación concisa dividida en fragmentos breves o demostración práctica espontánea.",
      "Cierre (últimos segundos): Llamado a la acción rápido e informal que invite a interactuar con un \"me gusta\" o comentario."
    ],
    "duracion": "Suele durar entre 15 y 50 segundos, manteniéndose preferiblemente por debajo de los 100 segundos. La brevedad es el factor más determinante para la retención, ya que los videos cortos consiguen tasas de finalización significativamente mayores y atraen a un público más amplio.",
    "errores": [
      "Crear videos de larga duración que superen los 100 segundos, provocando un abandono constante antes de la mitad de la pieza.",
      "Buscar una producción excesivamente pulida y artificial en lugar de la espontaneidad cotidiana que demanda la audiencia de la plataforma.",
      "Omitir el uso de música en tendencia o efectos sonoros que facilitan la indexación algorítmica y estimulan el visionado.",
      "Desaprovechar el inicio del video, permitiendo que más de la mitad de los usuarios pasen de largo en los primeros segundos."
    ],
    "revisa": [
      "¿El gancho de los primeros 3 segundos es lo suficientemente fuerte para que el usuario no deslice?",
      "¿El video dura menos de un minuto para maximizar la probabilidad de que lo vean completo?",
      "¿Se siente espontáneo, natural y grabado en un contexto real en lugar de parecer un anuncio rígido?",
      "¿He añadido textos superpuestos y música en tendencia para potenciar la interacción y la recomendación?"
    ]
  },
  {
    "id": "reel",
    "titulo": "Reel de Instagram",
    "resumen": "Vertical de marca o creador",
    "fuente": "5. Instagram, influencers y marca",
    "empezar": "La primera decisión es definir el objetivo estratégico del Reel y el público específico al que se dirige, alineándolos con la identidad de la marca o creador. A partir de esto, se determina si el enfoque principal de la pieza será entretener, educar o narrar una historia original que conecte emocionalmente.",
    "pasos": [
      "Investigar tendencias visuales, audios populares y formatos que resuenen con la personalidad del creador o marca.",
      "Escribir un guion estructurado centrado en una sola idea original y relevante para el espectador.",
      "Grabar tomas dinámicas y bien iluminadas utilizando encuadres exclusivamente verticales y estables.",
      "Editar el video sincronizando los cortes con el ritmo de la música y añadiendo subtítulos para mejorar la accesibilidad.",
      "Redactar la descripción del Reel con un texto conciso, etiquetas temáticas y una llamada a la acción clara."
    ],
    "estructura": [
      "Gancho (primeros 3 segundos): Un elemento visual, pregunta o texto disruptivo para evitar que el usuario deslice.",
      "Desarrollo (cuerpo): Explicación de la idea de forma dinámica, creativa y con contenido altamente personalizado.",
      "Cierre (llamada a la acción): Una indicación explícita para motivar la interacción, como comentar o guardar el video.",
      "Leyenda y hashtags: Texto de apoyo breve que complementa el mensaje del video y hashtags específicos del nicho."
    ],
    "duracion": "Suele durar entre 15 y 30 segundos porque los formatos cortos y dinámicos maximizan la tasa de retención del espectador, lo que incrementa las posibilidades de que el Reel sea visualizado por completo y beneficiado por el algoritmo.",
    "errores": [
      "No enganchar al espectador de inmediato, perdiendo el interés del usuario en los primeros tres segundos de reproducción.",
      "Hacer contenido demasiado comercial o genérico que sature a la audiencia y carezca de originalidad y valor real.",
      "Desuidar la calidad del sonido o no incluir subtítulos, limitando la visualización en entornos donde se consume sin audio.",
      "Omitir una llamada a la acción que guíe claramente al usuario sobre qué paso o interacción realizar al finalizar."
    ],
    "revisa": [
      "¿El gancho visual o textual del Reel logra atrapar al espectador en los primeros tres segundos?",
      "¿El contenido se presenta de forma original, auténtica y adaptada a los intereses del público objetivo?",
      "¿Se incluye una llamada a la acción clara que anime a comentar, compartir o guardar el Reel?",
      "¿La pieza es comprensible y mantiene su valor comunicativo aun si el usuario la reproduce sin audio?"
    ]
  },
  {
    "id": "envivo",
    "titulo": "Transmisión en vivo",
    "resumen": "Programa que sale al aire sin edición",
    "fuente": "6. Twitch y transmisión en vivo",
    "empezar": "Antes de escribir cualquier guion o pauta, la primera decisión fundamental es elegir la actividad o tema de tu transmisión y establecer un horario constante. Definir este calendario regular es clave para que tus espectadores habituales sepan exactamente cuándo sintonizarte y comience a formarse una comunidad sólida.",
    "pasos": [
      "Calibración técnica: Configurar y realizar pruebas de sonido, video y conexión para asegurar una transmisión estable y de calidad.",
      "Definición del contenido: Estructurar los temas de discusión específicos y la actividad principal que mantendrán el ritmo de la emisión.",
      "Inicio y bienvenida: Comenzar el directo prestando atención inmediata al chat para medir la retroalimentación instantánea de la audiencia.",
      "Interacción activa: Leer en voz alta y responder a los comentarios en tiempo real para construir un vínculo de reciprocidad con los espectadores.",
      "Moderación comunitaria: Coordinar con tu equipo de moderadores para aplicar normas de comportamiento claras y evitar conductas tóxicas en el chat."
    ],
    "estructura": [
      "Cuerpo central: Espacio principal donde se desarrolla la actividad, juego o debate que genera el interés común de la transmisión.",
      "Cámara web: Recuadro visual del presentador que muestra sus emociones y expresiones en vivo para generar empatía.",
      "Caja de chat síncrona: Canal de texto interactivo donde la audiencia conversa, influye en el directo y recibe respuestas directas.",
      "Alertas flotantes: Notificaciones gráficas que celebran de inmediato las suscripciones, donaciones y regalos del público."
    ],
    "duracion": "Una transmisión en vivo suele durar cuatro horas o más por sesión (e incluso de seis a siete para profesionales) debido a que las plataformas están diseñadas para un consumo de visualización continua (similar a una maratón de series) y la audiencia requiere largos periodos de interacción directa para integrarse verdaderamente en la comunidad [13-15].",
    "errores": [
      "Falta de consistencia: No respetar un calendario de transmisiones, lo que confunde a la audiencia y dificulta la fidelización.",
      "Desatender los comentarios: Ignorar el chat en tiempo real y desaprovechar el valor de la comunicación recíproca inmediata.",
      "No establecer límites personales: Permitir que los espectadores descarguen problemas íntimos excesivos en el chat público, incomodando al canal.",
      "Ignorar la moderación: Transmitir sin moderadores de apoyo, exponiendo la comunidad a la toxicidad y ataques coordinados de spam."
    ],
    "revisa": [
      "¿Tienes definido el tema central de tu directo y una lista de tópicos de discusión para evitar silencios incómodos?",
      "¿Has verificado y calibrado técnicamente la cámara, el audio y el software de video antes de dar el \"en vivo\"?",
      "¿Cuentas con moderadores asignados o herramientas de chat automáticas preparadas para gestionar el comportamiento de los usuarios?",
      "¿El plan de transmisión fomenta la interacción de doble vía y otorga un rol activo a la audiencia para que no sea solo observadora pasiva?"
    ]
  },
  {
    "id": "rodaje",
    "titulo": "Preparar el rodaje",
    "resumen": "Equipo, set y organización antes de grabar",
    "fuente": "1. Producción audiovisual",
    "empezar": "La primera decisión indispensable es definir el modo de representación eligiendo claramente entre el formato documental o de ficción. También debes decidir el asunto, tema o matriz dramática que guiará la producción antes de desarrollar cualquier guion.",
    "pasos": [
      "Previsualización: Planificar técnicamente y previsualizar los entornos digitales y personajes antes de comenzar el rodaje.",
      "Organización del equipo: Coordinar los roles técnicos del productor de fabricación y la dirección artística del realizador o director.",
      "Preparación del set: Explorar locaciones físicas o configurar pantallas y tecnología de iluminación LED en el set.",
      "Fase de rodaje: Capturar las actuaciones de los actores y los movimientos de cámara dentro de la puesta en escena.",
      "Comercialización: Realizar la postproducción final, la promoción del producto y su posterior distribución o exhibición."
    ],
    "estructura": [
      "Apertura: Presentación del entorno espacial y el conflicto o tema dramático de la pieza.",
      "Desarrollo: Progresión de la acción narrativa combinando planos, ángulos de cámara y montaje para dar ritmo.",
      "Cierre: Resolución del conflicto dramático y conclusión del mensaje simbólico o estético para los públicos."
    ],
    "duracion": "La duración depende del formato y mercado: los largometrajes buscan durar de 90 a 120 minutos para rentabilizar la venta de boletos en salas de exhibición, mientras que formatos web como los videoensayos duran pocos minutos buscando captar la atención de las audiencias digitales.",
    "errores": [
      "Tratar de corregir fallas en postproducción que pudieron anticiparse y resolverse de manera eficiente durante la fase de preproducción.",
      "Sufrir problemas de comunicación interna debido a las diferencias de terminología entre el personal técnico de programación y el artístico.",
      "Descuidar el diseño y registro de sonido en una planificación centrada casi por completo en los componentes visuales.",
      "Evitar la experimentación creativa refugiándose únicamente en la repetición constante de fórmulas o prototipos temáticos ya probados."
    ],
    "revisa": [
      "¿La obra respeta el modo de representación formal (ficción o documental) elegido desde el inicio?",
      "¿Se diseñó una estrategia clara de preproducción para evitar retrasos costosos durante el rodaje?",
      "¿Existe un equilibrio real entre el diseño de la imagen y los requerimientos del audio o sonido?",
      "¿La estructura dramática propuesta cumple el \"contrato\" o posición que se espera del género?"
    ]
  }
];


// Qué ficha corresponde a cada tipo de proyecto del generador (TIPOS_PROYECTO).
const POR_TIPO = {
  ficcion: 'narrativo', documental: 'narrativo', experimental: 'narrativo',
  stopmotion: 'narrativo', transmedia: 'narrativo',
  videoclip: 'videoclip', publicidad: 'comercial',
  estudio: 'envivo', entrevista: 'envivo', podcast: 'envivo',
};

// Medios del perfil que además tienen ficha propia de formato.
const POR_MEDIO = [
  [/tiktok/i, 'tiktok'],
  [/instagram|reels/i, 'reel'],
];

const porId = (id) => FICHAS.find((f) => f.id === id);

// Devuelve las fichas que le tocan a ESTE proyecto, en orden: primero la del
// tipo de pieza, después las del formato donde se va a publicar, y al final la
// de preparación de rodaje (que aplica a cualquier grabación).
export function fichasDe(cfg) {
  const salida = [];
  const tipo = cfg?.narrativa?.tipo;
  const esVivo = cfg?.modo !== 'narrative';
  const principal = POR_TIPO[tipo] || (esVivo ? 'envivo' : 'narrativo');
  const p = porId(principal);
  if (p) salida.push(p);

  const medios = Array.isArray(cfg?.perfil?.medios) ? cfg.perfil.medios : [];
  POR_MEDIO.forEach(([re, id]) => {
    if (medios.some((m) => re.test(String(m))) && id !== principal) {
      const f = porId(id);
      if (f && !salida.includes(f)) salida.push(f);
    }
  });

  const rodaje = porId('rodaje');
  if (rodaje && !salida.includes(rodaje)) salida.push(rodaje);
  return salida;
}

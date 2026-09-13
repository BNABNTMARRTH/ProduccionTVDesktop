# Manual Maestro: Los 23 Patrones de Diseño GoF & Prompts de Alta Ingeniería para IAs

Guía definitiva de referencia rápida, arquitectura y prompts ejecutables para diagnosticar, auditar y refactorizar cualquier proyecto de software utilizando los **23 Patrones de Diseño clásicos del Gang of Four (GoF)** junto con la Skill oficial `gof-23-design-patterns-architect`.

---

## 🧭 ¿Cómo Funciona la Skill `gof-23-design-patterns-architect`?

Cualquier modelo de IA (Antigravity, Gemini, Claude, GPT, etc.) equipado con este Skill es capaz de:
1. **Auditar**: Escanear archivos fuente en busca de *Code Smells* (clases gigantes, condicionales interminables, acoplamiento alto, fugas de memoria).
2. **Diagnosticar**: Cruzar los síntomas encontrados con la **Matriz Clínica de Patrones**.
3. **Prescribir**: Seleccionar con rigor matemático el patrón exacto que resuelve el cuello de botella.
4. **Refactorizar sin Romper**: Guiar o generar el código paso a paso aplicando *Facades* o *Adapters* para garantizar 100% de compatibilidad hacia atrás (Cero Regresiones).

---

## 🩺 Matriz Clínica de Diagnóstico Rápido ("Síntoma → Patrón GoF")

Usa esta tabla para saber qué patrón pedirle a la IA según el dolor que tenga tu aplicación:

| Síntoma o Dolor en el Código | Causa Raíz / Anti-patrón | Patrón GoF a Implementar | Familia |
| :--- | :--- | :--- | :--- |
| **"Tengo un `switch/if-else` gigante para instanciar clases según un string"** | Creación dispersa y frágil | **Factory Method** o **Abstract Factory** | Creacional |
| **"Construir un objeto requiere 10 argumentos o configuraciones opcionales"** | *Telescoping Constructor* | **Builder** | Creacional |
| **"Un recurso pesado (DB, Socket, WebGLRenderer, EventBus) se duplica en memoria"** | Recursos duplicados / Memory Leak | **Singleton** | Creacional |
| **"Crear un objeto desde cero es muy lento, pero clonar uno configurado es rápido"** | Creación costosa | **Prototype** | Creacional |
| **"Dos librerías o clases tienen métodos incompatibles que deben trabajar juntas"** | Incompatibilidad de interfaces | **Adapter (Wrapper)** | Estructural |
| **"Una abstracción y su motor gráfico/plataforma cambian independientemente"** | Jerarquías cruzadas $N \times M$ | **Bridge** | Estructural |
| **"Tengo jerarquías de partes y conjuntos (árboles, carpetas, ensambles 3D)"** | Tratamiento dispar de elementos | **Composite** | Estructural |
| **"Quiero agregar capacidades (logging, sombras, bordes) sin heredar ni romper"** | Explosión de subclases | **Decorator** | Estructural |
| **"Un subsistema complejo tiene demasiadas clases y asusta al programador"** | API interna inmanejable | **Facade** | Estructural |
| **"Millones de objetos pequeños saturan la memoria RAM o el Garbage Collector"** | Desperdicio masivo de memoria | **Flyweight (Zero-GC)** | Estructural |
| **"Quiero controlar el acceso, cargar bajo demanda (Lazy Load) o cachear datos"** | Carga prematura / Sin control | **Proxy** | Estructural |
| **"Múltiples manejadores pueden procesar una petición en cadena secuencial"** | Manejador monolítico | **Chain of Responsibility** | Comportamiento |
| **"Necesito Deshacer/Rehacer (Undo/Redo), transacciones o colas de acciones"** | Operaciones destructivas sin vuelta | **Command** | Comportamiento |
| **"Tengo que parsear un mini-lenguaje, reglas de negocio o fórmulas matemáticas"** | Regex inmanejables | **Interpreter** | Comportamiento |
| **"Quiero recorrer colecciones complejas sin exponer su estructura interna"** | Exposición de arrays internos | **Iterator** | Comportamiento |
| **"Muchos objetos se comunican todos contra todos en una maraña incomprensible"** | Acoplamiento en telaraña | **Mediator** | Comportamiento |
| **"Necesito guardar y restaurar puntos de guardado sin violar el encapsulamiento"** | Violación de propiedades privadas | **Memento** | Comportamiento |
| **"Cuando un dato cambia, varios componentes visuales deben enterarse al instante"** | Polling repetitivo o acoplamiento | **Observer (Pub-Sub)** | Comportamiento |
| **"Un objeto cambia drásticamente de comportamiento según su estado actual"** | Banderas booleanas (`isIdle`, `isRun`) | **State (FSM)** | Comportamiento |
| **"Tengo varios algoritmos intercambiables (físicas, ordenamiento, cálculos, IA)"** | Código rígido no extensible | **Strategy** | Comportamiento |
| **"Varios procesos siguen el mismo esqueleto pero difieren en pasos específicos"** | Duplicación de flujo de trabajo | **Template Method** | Comportamiento |
| **"Quiero agregar nuevas operaciones a una estructura de datos sin tocar sus clases"** | Contaminación de modelos base | **Visitor** | Comportamiento |

---

## 🏛️ Explicación de los 23 Patrones de Diseño GoF

### 1. Patrones Creacionales (5)
Mecanismos de creación de objetos que aumentan la flexibilidad y la reutilización de código existente.

1. **Factory Method**: Define un método para crear objetos en lugar de usar `new` directamente, permitiendo a las subclases o métodos alterar el tipo de objeto que se creará.
2. **Abstract Factory**: Produce familias de objetos relacionados (ej. Botón + Ventana + Checkbox estilo Oscuro vs estilo Claro) sin acoplarse a sus clases concretas.
3. **Builder**: Permite construir objetos complejos paso a paso (`.setChassis().setEngine().build()`). Útil para evitar constructores con decenas de parámetros nulos.
4. **Prototype**: Permite copiar objetos existentes (clonación profunda o superficial) sin que tu código dependa de sus clases concretas.
5. **Singleton**: Garantiza que una clase tenga una única instancia en toda la vida de la app y proporciona un punto de acceso global a ella.

---

### 2. Patrones Estructurales (7)
Explican cómo ensamblar objetos y clases en estructuras más grandes a la vez que se mantienen flexibles y eficientes.

6. **Adapter (Adaptador / Wrapper)**: Permite que interactúen objetos con interfaces incompatibles, traduciendo llamadas de un formato a otro.
7. **Bridge (Puente)**: Divide una clase grande o un conjunto de clases estrechamente relacionadas en dos jerarquías separadas (abstracción e implementación) que pueden evolucionar independientemente.
8. **Composite (Objeto Compuesto)**: Permite componer objetos en estructuras de árbol y luego trabajar con estas estructuras como si fueran objetos individuales (ej. Scene Graph 3D, directorios de archivos).
9. **Decorator (Decorador)**: Permite añadir dinámicamente nuevos comportamientos a objetos colocándolos dentro de objetos envoltorios especiales.
10. **Facade (Fachada)**: Proporciona una interfaz simplificada a una biblioteca, framework o conjunto complejo de clases.
11. **Flyweight (Peso Ligero / Zero-GC)**: Permite mantener más objetos dentro de la cantidad disponible de memoria RAM compartiendo las partes comunes del estado entre varios objetos en lugar de mantener todos los datos en cada objeto.
12. **Proxy**: Proporciona un sustituto o marcador de posición para otro objeto. Controla el acceso al objeto original, permitiendo hacer algo antes o después de que la solicitud llegue al objeto original (Lazy Loading, Caché, Seguridad).

---

### 3. Patrones de Comportamiento (11)
Se ocupan de los algoritmos y la asignación de responsabilidades entre objetos.

13. **Chain of Responsibility**: Pasa solicitudes a lo largo de una cadena de manejadores. Al recibir una solicitud, cada manejador decide si la procesa o si la pasa al siguiente manejador de la cadena.
14. **Command (Comando)**: Convierte una solicitud en un objeto independiente que contiene toda la información sobre la solicitud. Esta transformación permite parametrizar métodos, retrasar o poner en cola la ejecución de una solicitud y soportar operaciones que no se pueden deshacer (**Undo / Redo**).
15. **Interpreter**: Define una representación gramatical para un lenguaje junto con un intérprete para oraciones en dicho lenguaje.
16. **Iterator**: Permite recorrer elementos de una colección sin exponer su representación subyacente (lista, pila, árbol, etc.).
17. **Mediator (Mediador)**: Reduce las dependencias caóticas entre objetos. El patrón restringe las comunicaciones directas entre los objetos y los fuerza a colaborar únicamente a través de un objeto mediador.
18. **Memento**: Permite guardar y restaurar el estado previo de un objeto sin revelar los detalles de su implementación.
19. **Observer (Pub-Sub)**: Define un mecanismo de suscripción para notificar a múltiples objetos sobre cualquier evento que le suceda al objeto que están observando.
20. **State (Máquina de Estados / FSM)**: Permite a un objeto alterar su comportamiento cuando su estado interno cambia. Parece como si el objeto cambiara de clase.
21. **Strategy (Estrategia)**: Define una familia de algoritmos, coloca cada uno de ellos en una clase separada y hace sus objetos intercambiables en tiempo de ejecución.
22. **Template Method**: Define el esqueleto de un algoritmo en la superclase pero permite que las subclases sobrescriban pasos específicos del algoritmo sin cambiar su estructura.
23. **Visitor (Visitante)**: Permite separar algoritmos de los objetos sobre los que operan, añadiendo nuevas operaciones sin modificar las clases originales.

---

## 🔥 Suite de Prompts de Alta Ingeniería para Usar con la Skill

Copia y pega cualquiera de estos prompts en tu chat con la IA:

### Prompt 1: Auditoría Completa y Diagnóstico Clínico
```text
Activa el skill "gof-23-design-patterns-architect" y realiza una auditoría arquitectónica profunda de este proyecto:
1. Escanea el repositorio buscando Code Smells: God Objects, condicionales gigantes (If/Switch hell), acoplamiento fuerte y fugas de memoria.
2. Utiliza la Matriz de Diagnóstico Clínico para clasificar los dolores detectados.
3. Determina con precisión qué patrones de los 23 de GoF deberían implementarse para resolver esos dolores, justificando el impacto en rendimiento y mantenibilidad.
4. Preséntame un reporte con tabla comparativa de "Problema actual vs Patrón propuesto" y un plan de acción priorizado de menor a mayor impacto, sin romper código existente.
```

### Prompt 2: Refactorización Quirúrgica sin Regresiones
```text
Usando el skill "gof-23-design-patterns-architect", vamos a refactorizar el módulo [NOMBRE_O_RUTA_DEL_ARCHIVO]:
1. Diagnostica las violaciones a los principios SOLID que tiene actualmente este archivo.
2. Selecciona el patrón GoF óptimo para resolverlo (ej. Factory, State, Strategy o Command).
3. Aplica la Regla de Oro de No-Regresión: utiliza un Facade o Adapter para que cualquier archivo que dependa de este módulo siga funcionando al 100% sin romperse.
4. Implementa el patrón paso a paso, asegurando Zero-GC (cero recolección de basura innecesaria) y ejecuta la compilación para verificar que todo funcione limpio.
```

### Prompt 3: Rendimiento Crítico, 60 FPS y Fugas de Memoria
```text
Activa el skill "gof-23-design-patterns-architect" para auditar el rendimiento en tiempo real y el consumo de memoria:
1. Identifica asignaciones repetitivas de memoria dentro de los bucles de render o eventos frecuentes y propón la implementación de Flyweight / Object Pooling para lograr Zero-GC.
2. Audita el ciclo de vida de los recursos pesados: verifica que los Singleton se respeten y que todo objeto destruido aplique el patrón de liberación limpia (Disposal Pattern).
3. Revisa si hay controladores o escuchadores de eventos compitiendo por el cursor o la entrada del usuario y propone un Mediator para coordinarlos limpiamente.
```

### Prompt 4: Diseño de Nueva Feature Desde Cero
```text
Voy a crear una nueva funcionalidad en el proyecto: [DESCRIBE_TU_FUNCIONALIDAD_AQUÍ].
Activa el skill "gof-23-design-patterns-architect" y actúa como Arquitecto de Software:
1. Recomiéndame la combinación exacta de patrones de diseño GoF que mejor resuelva esta funcionalidad de forma modular y desacoplada.
2. Diseña un diagrama Mermaid de la arquitectura propuesta.
3. Proporcióname los esqueletos de las clases con sus contratos e interfaces antes de escribir la implementación concreta.
```

### Prompt 5: Modo "Entrevista Técnica / Interrogatorio" (/grill-me)
```text
Activa el skill "gof-23-design-patterns-architect" en conjunto con el comando /grill-me.
Quiero resolver [PROBLEMA_QUE_TIENES].
Hazme una serie de preguntas técnicas agudas sobre los requerimientos, la concurrencia, el rendimiento y la escalabilidad de mi proyecto para ayudarme a elegir el patrón de diseño GoF exacto que debemos implementar, advirtiéndome de posibles trampas o sobre-ingeniería innecesaria.
```

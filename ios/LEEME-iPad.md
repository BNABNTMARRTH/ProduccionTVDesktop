# Producción TV para iPad

La misma app que corre en el Mac, dentro de una app nativa de iPadOS. Se instala
en tu iPad desde Xcode con tu **Apple ID gratuito** — sin App Store, sin
TestFlight y sin pagar la membresía de desarrollador.

---

## 1 · Qué abrir en Xcode

Abre **este archivo**:

```
ios/ProduccionTV.xcodeproj
```

Ruta completa:

```
/Users/aldomaster666/Documents/Codex/2026-06-30/build-ios-apps-plugin-build-ios/work/ProduccionTVDesktop/ios/ProduccionTV.xcodeproj
```

Desde el Finder: doble clic al icono azul `ProduccionTV.xcodeproj`.
No hay `.xcworkspace` ni CocoaPods ni nada que instalar: el proyecto no usa
ninguna librería externa.

---

## 2 · Poner tu Apple ID (esto es lo único que falta)

Xcode va a marcar en rojo *“Signing for ProduccionTV requires a development
team”*. Es lo esperado: el equipo no se puede dejar guardado en el proyecto,
tiene que ser el tuyo.

1. En la columna azul de la izquierda, clic en **ProduccionTV** (el de hasta
   arriba, con el icono de proyecto).
2. En la lista **TARGETS**, elige **ProduccionTV**.
3. Pestaña **Signing & Capabilities**.
4. Deja palomeado **Automatically manage signing**.
5. En **Team** abre el menú y elige **`Abiud … (Personal Team)`**.

   · ¿No aparece ninguno? Elige **Add an Account…**, entra con tu Apple ID
     (el mismo del iPad) y vuelve a abrir el menú de **Team**.

6. **Bundle Identifier** ya viene puesto: `com.abiudtt.ProduccionTV`.
   Solo cámbialo si Xcode dice que ya está ocupado — por ejemplo a
   `com.abiudtt.ProduccionTV2`.

Cuando el rojo desaparezca, ya está firmado.

---

## 3 · Instalarla en tu iPad

1. Conecta el iPad al Mac con cable y desbloquéalo. Si sale *“¿Confiar en esta
   computadora?”*, di que sí.
2. Arriba, junto al nombre del proyecto, abre el menú de destinos (donde dice
   *iPhone 17 Pro* o similar) y elige **tu iPad** por su nombre.
3. Botón **▶︎ Run** (o `⌘R`).
4. La primera vez el iPad va a decir *“Desarrollador no confiable”*. En el iPad:
   **Ajustes ▸ General ▸ VPN y gestión de dispositivos ▸ Apps de desarrollador ▸
   [tu Apple ID] ▸ Confiar**.
5. Vuelve a darle **▶︎ Run**. La app queda instalada en la pantalla de inicio.

### Lo que hay que saber de la cuenta gratuita

Un Apple ID gratuito firma la app por **7 días**. Al octavo día la app deja de
abrir (no se borra nada, tus proyectos siguen ahí). Para revivirla: conecta el
iPad, abre el proyecto y dale **▶︎ Run** otra vez. Con una cuenta de pago serían
365 días; es la única diferencia.

---

## 4 · Dónde quedan tus proyectos

En el Mac viven en `~/Documents/ProduccionTV`. En el iPad viven en la carpeta
de la app, y **se ven desde la app Archivos**:

> **Archivos ▸ En mi iPad ▸ Producción TV ▸ ProduccionTV**

Ahí está un `.ptv` por proyecto y la carpeta `Papelera` con lo que borraste.
Son los MISMOS archivos que en el Mac: puedes copiar un `.ptv` del Mac a esa
carpeta (por AirDrop, cable o iCloud Drive) y aparece en la app.

También funciona al revés: dale doble toque a un `.ptv` en Archivos y la app lo
abre, igual que el doble clic en Finder.

Los ajustes (tamaño, tema, contraste) quedan en la carpeta interna de la app,
igual que en el Mac.

---

## 5 · Qué cambió respecto al Mac

**Nada de lo que se ve ni de lo que se hace.** Son las mismas siete etapas, el
mismo generador de infografías, el mismo diagrama de señal, el mismo modo
producción, las mismas exportaciones. El frontend es *literalmente* el mismo:
la carpeta `Web/` de la app es una copia de `frontend/dist`, sin una línea
cambiada.

Lo único distinto es lo que un iPad no puede hacer igual:

| En el Mac | En el iPad |
|---|---|
| Cada proyecto y cada módulo desanclado abren **otra ventana de macOS** | Hay **una sola pantalla**. Sacar un módulo a “su ventana” lo pone solo a pantalla completa, sin barra lateral ni pestañas, con su botón ⇲ para volver al proyecto. Volver a Inicio hace lo mismo. |
| Dos ventanas sobre el mismo `.ptv` se avisan entre ellas (`WatchProject`) | No hace falta: no hay una segunda ventana que avisar. |
| Guardar/Exportar abre el diálogo de macOS | Abre el selector de **Archivos**: eliges dónde queda el CSV, el EDL, el `.ptv` o el PNG. |
| Imprimir abre el panel de macOS (y ahí el menú PDF) | Abre el panel de impresión de iPadOS. Para PDF: **Compartir ▸ Guardar en Archivos**. |
| Arrastrar un `.ptv` sobre la ventana lo importa | En iPadOS no llega ese gesto al WebView. En su lugar: el botón **Importar** de Inicio, o doble toque al `.ptv` en Archivos. |
| Atajos ⌘1–⌘6, ⌘D, ⌘S | Funcionan igual **si tienes teclado** conectado al iPad. Sin teclado, todo se alcanza tocando. |

**Ninguna función se eliminó.** Las tres de la tabla que no existen en iPadOS
(ventanas múltiples, aviso entre ventanas, soltar archivos) tienen su
equivalente en la misma columna.

---

## 6 · Si cambias el frontend

La app del iPad no tiene copia propia del frontend: usa la misma. Después de
cambiar algo en `frontend/`:

```bash
npm --prefix frontend run build     # o build/compilar.sh, que ya lo hace
ios/sincronizar-web.sh              # copia frontend/dist → ios/ProduccionTV/Web
```

Y vuelve a darle **▶︎ Run** en Xcode.

---

## 7 · Cómo está armado (para cuando haya que meterle mano)

```
ios/
├── ProduccionTV.xcodeproj      ← esto es lo que se abre
├── sincronizar-web.sh          ← trae frontend/dist a Web/
└── ProduccionTV/
    ├── AppProduccionTV.swift   · el arranque (SwiftUI) y los .ptv que llegan de Archivos
    ├── VistaPrincipal.swift    · el marco: fondo completo, contenido en el área segura
    ├── ContenedorWeb.swift     · el WKWebView y sus reglas (enlaces, diálogos, tacto)
    ├── ServidorDeRecursos.swift· sirve Web/ bajo ptv://app — el suelo de la app web
    ├── PuenteNativo.swift      · las 24 funciones que antes daba Go (app.go)
    ├── AlmacenEnDisco.swift    · los .ptv, la Papelera y ajustes.json
    ├── EstadoDeArranque.swift  · qué muestra la pantalla: Inicio, proyecto o módulo
    ├── Exportador.swift        · guardar archivos e imprimir
    ├── Recursos/
    │   ├── puente-ios.js       · deja puestos window.go y window.runtime
    │   └── adaptacion-ipad.js  · área segura, tacto, tamaño de la letra y color de la hora
    ├── Assets.xcassets         · icono y colores
    ├── Info.plist              · permisos, tipo .ptv, orientaciones
    └── Web/                    · COPIA de frontend/dist (no editar a mano)
```

La idea de fondo: **el frontend no sabe que cambió de sistema.** Buscaba
`window.go.main.App.…` y `window.runtime.…`, que en el Mac los ponía Wails; aquí
los pone `puente-ios.js` antes de que arranque una sola línea de la app, y del
otro lado contesta Swift en vez de Go. Por eso `frontend/dist` se copia tal cual
y no hay una segunda versión del frontend que mantener.

**Requisitos:** Xcode 16 o posterior · iPadOS 17 o posterior (probado contra el
SDK de iPadOS 26.5) · solo iPad.

---

## 8 · Arreglos del 1 de septiembre de 2026

Cinco cosas que salieron al usarla de verdad en el iPad.

**1. La cámara tumbaba la app.** En el storyboard, el botón «Hacer foto» cerraba
Producción TV de golpe. No era un fallo del botón: iOS **mata** cualquier app que
pida la cámara sin haber declarado para qué la quiere. Faltaban esas frases en
`Info.plist`. Ya están las tres (cámara, fototeca, micrófono), así que la primera
vez el iPad te preguntará si le das permiso y a partir de ahí funciona.

**2. Un parpadeo al entrar a un proyecto.** Durante un segundo se veía la hoja
completa del proyecto y luego saltaba a Perfil. Es que perfil, set, escaleta y
guion son **el mismo documento**: lo que los distingue es un aviso que manda el
caparazón después de cargarlo, y hasta que llega la herramienta se pinta en su
modo por omisión. En el Mac no se alcanza a ver; el iPad tarda más. Ahora la
herramienta no se enseña hasta que el aviso llegó y ya se pintó.

**3. El tamaño de la Configuración solo agrandaba las cajas.** Éste costó.

La app agranda con `zoom` de CSS en la raíz, que en un Mac multiplica todo. En el
WebView del iPad **no**: medido dentro de la app a tamaño Máximo, una caja de
100 px se dibujaba de 175 px y una letra de 14 px se seguía dibujando de 14. Por
eso crecían los botones y el texto se quedaba chico y se salía de su sitio.

Dos caminos que **no** funcionan, para que nadie los vuelva a intentar:

- `-webkit-text-size-adjust`, que es la perilla con la que WebKit recalcula la
  letra: se le puso `175%`, `getComputedStyle` confirmaba que estaba en efecto,
  y la letra no se movió. En este WebView esa perilla está desconectada.
- `pageZoom` de WKWebView (el ⌘+ de Safari): sí agranda, pero como la etiqueta
  de vista dice `width=device-width`, la página se seguía maquetando con los
  834 px del iPad y se salía por la derecha.

Lo que sí funciona es pedir el tamaño **como lo pide una página para móvil**:
`initial-scale`. `adaptacion-ipad.js` le quita el `zoom` de CSS a la raíz y pone
`initial-scale=1.75` en la etiqueta de vista; la página se maqueta en un lienzo
más chico (834 ÷ 1.75 = 476 px) y iPadOS lo dibuja 1.75 veces más grande, letra
incluida. Quitar el `zoom` además deja bien las cuentas de `enPxCss()`.

**4. El contenido se descuadraba a veces.** Era lo mismo que el punto 3: con las
cajas 1.75 veces más grandes dentro de una maquetación que seguía creyéndose de
834 px, las cosas se encimaban. Con el tamaño hecho por `initial-scale` ya no hay
dos medidas peleándose.

**5. Dos de la app, no del iPad** (también arreglados en el Mac, porque el
frontend es el mismo):

- En **Guion literario**, la tarjeta con los datos de la escena era
  `hidden 2xl:block`: Tailwind solo la enseñaba a partir de 1536 px de ancho, así
  que en un iPad no se veía nunca. Ahora, cuando no cabe al lado, baja debajo de
  la hoja. Y decía «son los mismos campos de la escaleta», que en un proyecto
  narrativo no es verdad porque ahí no hay pestaña de escaleta; ahora dice dónde
  se ve cada dato de verdad.
- En **modo En vivo** el storyboard no servía: dibujaba un cuadro por cada cue
  —gráficos, comerciales, audio, instrucciones— casi todos vacíos, y el encuadre
  estaba escondido dentro del editor lateral del cue. Ahora el storyboard dibuja
  **solo los cues de cámara**, que son los que se pueden dibujar, y el plano se
  escribe en el propio cuadro, en los dos modos.

> Después del punto 5 hay que recompilar el generador:
> `cd web-sources/generador-tv && npm run build`, copiar `dist` a
> `frontend/public/tools/infografias`, `npm --prefix frontend run build` y
> `ios/sincronizar-web.sh`. Ya está hecho.

---

## 9 · Arreglos del 1 de septiembre (segunda tanda)

**6. El tamaño se perdía al entrar a un proyecto y al cambiar de módulo.** Fallo
mío, heredado del arreglo nº 3. `adaptacion-ipad.js` vigila la raíz del
documento para enterarse de cuándo la app cambia el tamaño, y estaba mirando
**todos** los atributos de `<html>`. Resulta que `main.js` escribe ahí
`data-etapa` cada vez que cambias de etapa o de módulo (es lo que le da su color
a cada etapa, de azul a rojo). Como el `zoom` de CSS ya estaba borrado a esas
alturas, cada navegación se leía como «la escala volvió a Normal» y el tamaño se
caía solo.

Ahora el vigilante mira solo tres atributos: `style` —donde la app escribe el
zoom— y `data-contraste` / `data-movimiento`, que son la firma de que acaba de
pasar `ajustes.aplicar()`. Los dos últimos hacen falta porque volver de «Enorme»
a «Normal» deja el zoom vacío y escribir vacío sobre vacío no mueve el atributo
`style`: sin esa segunda señal la app se quedaría agrandada para siempre.

**7. El teclado saltaba al elegir En vivo / Narrativo.** Al tocar uno de los dos
botones se abría el teclado encima del diálogo. La caja de «Nuevo proyecto» se
redibujaba entera al cambiar de modo, y como redibujar se lleva por delante el
cursor, el código se lo devolvía al campo del nombre a mano. Devolver el foco a
un campo de texto **dentro del gesto del dedo** es exactamente lo que hace subir
el teclado en iPadOS.

El modo solo cambia qué botón va marcado, así que ahora se marca y ya: sin
redibujar no se pierde el cursor y no hay a quién devolvérselo. Se le añadió un
`preventDefault` al `mousedown` del botón para que en el Mac tampoco le robe el
foco al nombre y puedas seguir escribiendo donde ibas.

> Este último toca `frontend/src/nuevo-proyecto.js`, o sea que **también cambia
> en el Mac** (allí para mejor: ya no se pierde la posición del cursor).

---

## 10 · Arreglos del 1 de septiembre (tercera tanda)

**8. Guion literario: los datos de la escena, escena por escena.** Eran UNA
tarjeta al costado que seguía al cursor. En una pantalla que no da para una
tercera columna acababa debajo de la hoja, y ahí ya no se entiende que «siga» a
nadie: parecía un formulario suelto que solo servía para la primera escena. Y
aun entendiéndolo, obligaba a bajar, llenar, subir, poner el cursor en la
siguiente escena y volver a bajar.

Ahora cada escena lleva los suyos, plegados bajo su encabezado (**▸ Datos de la
escena**): nombre del bloque, duración, función en la historia, qué cambia y
personajes. Van `no-print`, así que la hoja se sigue imprimiendo limpia. La
duración se guarda al salir del campo y no en cada tecla — escribiendo «1:30»,
el primer carácter ya sería una duración válida y el campo se reescribía debajo
de los dedos.

**8-bis. …y que se vean.** Se reportó que los datos por escena «no estaban» en
el build. Sí estaban: el control era una línea de 10 px en gris claro sobre el
papel, con el triangulito por omisión del navegador. Estaba ahí y nadie lo
registraba como algo que se pudiera tocar. Ahora es una pastilla con borde,
fondo y 34 px de alto —el mismo peso visual que «＋ Escena nueva aquí»— con su
propia flecha, que gira al abrir.

> Si tras un ▶︎ Run sigues sin ver algo que debería estar, en Xcode haz
> **Product ▸ Clean Build Folder** (⇧⌘K) y vuelve a correr: a veces no se entera
> de que la carpeta `Web/` cambió por dentro.

**9. «Escaleta editorial» y «Tiempos» ya no hacen lo mismo.** Eran dos listas de
segmentos casi idénticas: se editaba en una, se volvía a la otra y no quedaba
claro cuál mandaba. El reparto ahora:

- La escaleta se **arma** en su pestaña. Recibe las dos cosas que solo existían
  en Tiempos: la **fuente al aire** de cada bloque y su **nota**.
- **Tiempos y salida a edición** solo **mira y exporta**: el resumen de tiempos
  (no editable, con IN/OUT y total), el análisis de tiempos y el EDL/CSV.

No se perdió ningún campo; cambió de sitio.

**10. Fuera «sacar a su propia ventana» en el iPad.** En el Mac eso abre otro
proceso, que es lo que le da sentido: dos cosas a la vez en dos monitores. En un
iPad la app es una sola ventana, así que «sacar» solo tapaba la pantalla con el
módulo — lo mismo que navegar a él, pero con un rodeo. `puente-ios.js` levanta
`window.__ptvSinVentanas` antes de que arranque la app, y con esa bandera el
frontend no pinta el botón ⧉ de las pestañas ni acepta el arrastre hacia fuera.
**Las pestañas se quedan**: ésas viven dentro de la misma ventana y funcionan
igual que en el Mac (⌘D, o el botón de desanclar).

**11. La tarjeta de Exportar se pliega.** La hoja mide 816 px de ancho —es una
carta— y el panel se llevaba 340 px fijos: en una tableta la hoja quedaba
espachurrada justo cuando lo que quieres es mirarla. Ahora el panel tiene un
botón **‹ Plegar**; plegado, la vista previa se queda con todo el ancho y una
pastilla flotante **⇩ Exportar ›** lo devuelve. La app recuerda cómo lo dejaste.

> Los puntos 8, 9, 11 y 12 tocan la app compartida, o sea que **también cambian
> en el Mac**. El 10 solo se nota en el iPad, y el 13 va partido: los filtros
> que se tocan son compartidos, el ojo de la app es solo del iPad.

---

## 12 · La mesa de luz (2 de septiembre de 2026)

Una fototeca de referencias visuales dentro de la app: lo que hace ShotDeck,
pero conectado a tu guion. Está en **Perfil ▸ Mesa de luz** y funciona igual en
el Mac y en el iPad.

### Por qué las imágenes NO viven dentro del proyecto

Viven en `~/Documents/ProduccionTV/Referencias` (en el iPad, la carpeta gemela
dentro de la app), y son dos razones distintas:

* **Una fototeca es de quien la junta, no de un proyecto.** La imagen que te
  sirvió para el noticiero te sirve para el documental del año que viene.
  Guardarla dentro de un `.ptv` la encerraría en uno solo y la duplicaría en
  cada proyecto que la usara.
* **Un `.ptv` tiene que seguir siendo texto.** Con cientos de cuadros adentro
  pesaría cientos de megas, y el iPad —que abre el proyecto entero en memoria—
  no lo levantaría.

El proyecto solo guarda **a qué referencia apunta**, nunca la imagen.

### Dos archivos por referencia, y no es capricho

```
Referencias/
├── ref-a91b2c.json   etiquetas + MINIATURA  ← se lee siempre, al abrir la mesa
└── ref-a91b2c.jpg    la imagen completa     ← se lee solo al abrirla en grande
```

Leer trescientas miniaturas de 10 KB es instantáneo; leer trescientas imágenes
completas no lo sería. Y como la miniatura viaja dentro de la ficha, la
cuadrícula aparece de un jalón en vez de a pedazos. El otro efecto de partirlo:
**retocar una etiqueta escribe 10 KB, no 300** — hay una prueba que lo vigila.

### El color se saca solo

Al meter una imagen, la app le saca la paleta sin que etiquetes nada: agrupa los
píxeles en cubos de color y se queda con los cubos más poblados, **saltándose
los que se parecen demasiado** a uno ya elegido. Sin ese filtro una imagen azul
devolvía cinco azules casi idénticos y la paleta no decía nada.

Después cada color cae en una **familia** (rojo, naranja, cian, azul, neutro,
oscuro, claro…), que es lo que permite buscar "lo azul" sin acertarle al tono
exacto. Dos decisiones que costaron una segunda vuelta:

* Los cortes miran luz **y** saturación a la vez. Un crema `#E7DCC0` salía
  clasificado como "naranja" porque su matiz cae en 43°, y un azul de noche
  cerrado `#0D1B2A` salía como "oscuro", perdiendo lo único que importa de él.
  Ahora: muy claro y poco saturado = crema; muy oscuro **pero saturado** sigue
  siendo su color.
* La frontera cian/azul va en **195°**, no en 200: el *teal* del cine
  (180-190) se queda del lado cian, y un cielo —que ronda los 197— cae en azul,
  que es donde alguien lo va a buscar.

### El vocabulario ya lo hablaba la app

El tipo de plano, el movimiento, el formato y el esquema de luz salen de
`catalogos.js`, `proyecto.js` e `iluminacion.js` — los mismos catálogos del
guion técnico. Por eso una referencia marcada "Primer Plano" se puede **cruzar**
con el plano 4 de la escena 2, que dice exactamente lo mismo. Solo cuatro
etiquetas son nuevas (lugar, momento, gente y la familia de color): las de
ShotDeck que no existían.

### El tablero y el storyboard

La estrella ⭑ de cada imagen la pone en el **tablero del proyecto**: el look de
esta pieza, diez o quince imágenes curadas. En **Guion ▸ Escaleta ▸ Storyboard**
cada cuadro se parte en dos, `REFERENCIA | TU CUADRO`, y al tocar el lado de la
referencia se elige **solo entre las del tablero**, no entre las trescientas de
la fototeca. Curar y repartir son dos trabajos distintos y no se hacen en la
misma pantalla.

Si el tablero está vacío, el storyboard se ve **exactamente como antes**: la
columna de referencia no aparece, para no cobrarle una casilla vacía a quien
todavía no usa la mesa. Y lo que se ve, se imprime: los dos paneles sobreviven
al modo impresión.

### Lo que se probó

* **Go** — tres pruebas nuevas en `main_test.go`: los dos archivos por
  separado, que cambiar una etiqueta no reescriba el `.jpg`, que borrar mande a
  la papelera y no destruya, y que un id con `../` no escriba fuera de la
  carpeta.
* **Swift** — `AlmacenEnDisco.swift` compila suelto con `swiftc` (solo depende
  de Foundation), así que las mismas diez comprobaciones se le corrieron al
  archivo real. La primera vez esto escribió en la carpeta REAL del usuario: en
  macOS, `HOME` no cambia a dónde apunta la carpeta Documentos. **La variable
  que sí funciona es `CFFIXED_USER_HOME`** (ver punto 14); con ella la prueba
  queda aislada de verdad.
* **La pantalla** — la app real en un Chromium del tamaño de un iPad, con el
  puente devolviendo fichas reales: la cuadrícula, las franjas de color, los
  filtros combinados, el tablero, la ficha en grande y el enlace al storyboard.

### Dos errores que se cazaron probando

* La ficha abierta salía **transparente** —se leían los filtros y la rejilla por
  debajo— porque usé un `var(--papel)` que no existe. El opaco de la casa es
  `--yeso`.
* La franja de color no aparecía en la ficha abierta: dentro de un contenedor
  flex se encogía a cero. Lleva `width:100%` explícito.

> Este punto toca la app compartida: **también está en el Mac**.

---

## 13 · Los filtros se tocan, y el iPad rellena solo (2 de septiembre de 2026)

Dos cambios sobre la mesa de luz.

### Los filtros ahora se tocan, como los colores

Lugar tiene 2 opciones, Momento 5 y Gente 5. Meterlas en un menú desplegable
—como estaban— obligaba a abrir, apuntar y elegir para algo que cabe entero a la
vista: tres gestos donde bastaba uno, y en un iPad se nota. Ahora son pastillas
que se tocan, igual que la fila de colores; tocar la que ya está puesta la quita.

**Plano se queda en menú**, y no por descuido: tiene 23 opciones y como fila
ocuparía media pantalla. Lo que sí hace es ofrecer **solo los planos que de
verdad hay en tu fototeca** — recorrer los 23 del catálogo para encontrar los
cuatro que tienes era buscar entre cosas que no existen.

Esto es código compartido, así que **también cambia en el Mac** en cuanto se
recompile.

### El ojo de la app (solo iPad)

Al meter una imagen, el iPad la mira y propone lo que ve: **cuánta gente sale,
qué tan cerrado es el plano, si es interior o exterior y si es de día o de
noche** — igual que ya sacaba la paleta de color sin que etiquetaras nada.

Usa **Vision**, el detector que viene dentro de iPadOS: no hay modelo que
descargar, no pesa, no manda nada a internet y no hay licencia que leer. Vive en
`AnalizadorDeImagen.swift` y entra por `AnalizarImagen`, que **no existe en
app.go**: es la primera función solo-iPad de la mesa, y por eso `puente-ios.js`
la lleva en una lista aparte (`SOLO_IPAD`) para que `FUNCIONES` siga siendo un
espejo exacto de Go y se note si alguna se queda sin puente. En el Mac la puerta
devuelve vacío y la mesa funciona igual, etiquetando a mano.

**Propone, no decide.** Solo rellena casillas vacías, nunca pisa lo que
escribiste, y lo que puso lleva una marca **◆ AUTO** que desaparece en cuanto lo
corriges. Una conjetura tiene que verse como conjetura: una etiqueta equivocada
que se pone sola es peor que ninguna, porque la encuentras meses después
buscando otra cosa.

### Lo que se midió, y lo que se quitó por no poder medirlo

`AnalizadorDeImagen.swift` no importa UIKit —descifra con ImageIO— justo para
poder compilarlo suelto con `swiftc` y probarlo **contra fotos de verdad** en el
Mac, en vez de solo comprobar que compila.

* **Las dos tablas de conversión** (de la altura de la cara al tipo de plano, y
  del número de personas a la etiqueta) pasan sus 18 casos.
* **Día y noche** salieron de MEDIR, no de suponer. Sobre la misma foto a tres
  exposiciones el brillo medio daba 0.435 / 0.295 / 0.115 —tres números pegados,
  y el del día se quedaba por debajo del corte que yo había puesto a ojo—
  mientras que la parte del cuadro en sombra profunda daba 0.076 / 0.163 /
  0.875: tres mundos distintos. Manda la sombra. Tiene sentido, porque la noche
  no es "menos luz repartida" sino casi todo negro con algún punto encendido.
* **Amanecer y atardecer se quitaron.** Los tenía por calidez de color y al
  medirlo no se sostiene: la foto de prueba, una aérea de mar, da calidez
  negativa hasta cuando se la fuerza hacia el naranja, porque el azul del agua
  manda sobre todo lo demás. Sin poder distinguir un atardecer de una tarde
  azulada —o de una lámpara cálida en un cuarto— era una moneda al aire. Siguen
  en la lista para ponerlos a mano, que es donde funcionan.
* **Sin cara no se inventa el plano**, y **no detectar a nadie no se traduce en
  "Nadie"**: alguien de espaldas existe igual.

> El analizador no escribe nada en disco, así que se puede correr tranquilo.
> Para lo que sí escribe, ver el aislamiento con `CFFIXED_USER_HOME` en el
> punto 14.

---

## 14 · La agenda de crew (2 de septiembre de 2026)

Está en **Necesidades ▸ Agenda de crew**, junto a "Personas y equipo", y
funciona igual en el Mac y en el iPad.

La app ya sabía **qué** hace falta: la etapa Necesidades lista los puestos de un
rodaje. Lo que no sabía es **a quién llamas** para cubrirlos. Los puestos eran
cajas vacías (`personal[].rol` un texto, `talentos[].nombre` otro); la agenda es
lo que les pone una persona real detrás, con el botón **Al proyecto**.

### Lo que NO es, y por qué importa

No es un directorio público. La diferencia no es de tamaño, es de naturaleza:
un directorio publica datos de terceros, y eso arrastra consentimiento, aviso de
privacidad, derecho de baja y un servidor que mantener **para siempre**. En el
momento en que guardas en un servidor tuyo el teléfono, la foto y la estatura de
otras personas, eres responsable de esos datos ante la ley, y si alguien te pide
en un año que lo borres, tienes que poder hacerlo.

Esto es **tu agenda**: la gente con la que ya trabajaste o a la que ya le
llamaste, en tu disco, como los contactos del teléfono. No se publica, no se
sube y no sale de ahí. Si algún día el directorio público tiene sentido, será
otro producto — pero esto sirve desde el primer contacto que guardes.

### Dónde vive

`~/Documents/ProduccionTV/Contactos`, al lado de los proyectos y de la fototeca,
por la misma razón que ella: tu camarógrafo de marzo te sirve en noviembre.

A diferencia de las referencias, aquí es **un archivo por persona y no dos**: el
retrato son 480 px y cabe dentro de la propia ficha. Una cara se reconoce a ese
tamaño y pesa como una página de texto; un fotograma de referencia, en cambio,
hay que poder abrirlo en grande, y por eso allá sí se parte.

### El vocabulario

`crew.js` trae **384 puestos en 12 áreas**, sacados del catálogo de crew de San
Luis Potosí y con los acentos repuestos (el documento venía sin ellos). Son
tantos a propósito: el problema no es elegir de una lista corta, es que el
puesto que buscas **tenga nombre** — quien necesita un *focus puller* no lo
encuentra entre diez oficios genéricos. Se navegan escribiendo, no bajando: el
campo es un `datalist`, igual que los planos del guion técnico.

El **departamento no se guarda**: se deduce del puesto (`departamentoDe`). Dos
campos que pueden contradecirse son un campo de más.

La búsqueda quita los acentos antes de comparar: quien escribe "camarografo"
tiene que encontrar al "Camarógrafo".

### Decisiones de la pantalla

* **Lo que impide llamarle va arriba y con nombre**: *"Para poder llamarle falta
  el nombre, el puesto, alguna forma de contactarle"*. Es lo único de la ficha
  que de verdad rompe algo, y conviene verlo antes de necesitarlo un martes a
  las siete de la mañana. El porcentaje de la ficha no es una nota: es un
  empujón.
* **Los datos de casting van plegados** y solo aparecen si marcas "trabaja
  frente a cámara". A un gaffer no se le pregunta el color de ojos, y tenerlos
  siempre delante hace que la agenda parezca un formulario de casting.
* **"De confianza"** (la estrella) es el filtro que más se va a usar: no es
  "favorito", es *ya trabajé con esta persona y repetiría*.
* Las pastillas de **Área** solo aparecen si tienes gente de más de un área, y
  el menú de **Puesto** solo ofrece los puestos que de verdad tienes.

### Lo que se probó

* **Go** — dos pruebas: guardar/leer/reemplazar sin duplicar, borrar a la
  papelera sin destruir, un id con `../` que no escribe fuera, y que la agenda y
  la fototeca no se mezclen aunque vivan al lado.
* **Swift** — once comprobaciones sobre el `AlmacenEnDisco.swift` real,
  **aisladas de verdad esta vez**. En macOS `HOME` no cambia a dónde apunta la
  carpeta Documentos (por eso la primera vez escribí en la carpeta del usuario),
  pero **`CFFIXED_USER_HOME` sí**:

  ```
  CFFIXED_USER_HOME="$(mktemp -d)" ./prueba
  ```

* **La pantalla** — crear a alguien, ver el aviso de lo que falta, llenarlo, ver
  cómo desaparece el aviso, encontrarlo en la lista con su área deducida del
  puesto, y meterlo al proyecto: el botón pasa a "En el equipo" y avisa dónde
  quedó.

> Este punto toca la app compartida: **también está en el Mac**.

---

## 15 · La hoja técnica y la escritura a mano (2 de septiembre de 2026)

### La hoja técnica ya no tira lo que el módulo sabía

La hoja del **Diagrama técnico** dibujaba las cajas y los cables, y ya. Bonita de
ver y de poco servir en el set, porque ahí la pregunta no es "cómo se ve la ruta"
sino **"¿la Cámara 2 va en la entrada 3 o en la 4?"**.

Lo llamativo es que el módulo **ya sabía la respuesta**: el diagrama guarda a qué
puerto llega cada cable (`edge.to.port`) y el nombre del canal físico que
escribiste en cada uno (`node.chan[puerto]`) — ese campo existe desde antes, en
la barra lateral del módulo, bajo **Canales físicos**. La hoja lo tiraba a la
basura y volvía a dibujar cajas sin números.

Ahora la hoja lleva:

* **Números de entrada sobre los cables** del dibujo. Ver un cable ya no obliga a
  adivinar en cuál de las cuatro entradas termina.
* **Tabla de patcheo del switcher**: una fila por entrada — qué entra, canal
  físico, por dónde sale (SDI/HDMI) y una casilla ☐ para verificar cable por
  cable antes de empezar.
* **Tabla de patcheo de la mezcladora**, igual, con la conexión (XLR /
  inalámbrico) de cada micrófono.
* **A dónde va Programa y a dónde va Mezcla**, con su canal.
* **Resto de la cadena** (encoder, plataforma, monitores), donde la pregunta es
  de dónde a dónde y no en qué entrada.
* **Notas del montaje** con renglones.

Y lo que no esté capturado **no se esconde**: sale su renglón punteado. Las
entradas libres aparecen igual, porque el patcheo se acaba de decidir en el piso
con un plumón.

### Escribir a mano sobre las hojas

Firmar una hoja de llamado, rayar el diagrama en el set, tachar un bloque que no
se grabó. Se hace con el **Apple Pencil**, dentro de la app, y la tinta se
imprime con la hoja.

**La regla que lo hace sentir bien en un iPad:** el lápiz escribe SIEMPRE y el
dedo nunca. No hay modo que encender ni botón que recordar — tocas con el lápiz y
escribes, tocas con el dedo y la hoja se desplaza, como en un cuaderno. WebKit lo
permite porque cada evento dice con qué se hizo (`pointerType`), y de paso trae
el rechazo de palma: con el lápiz apoyado, el toque de la mano no llega.

En el Mac no hay lápiz, así que ahí sí hay que encender **Modo escritura** para
dibujar con el ratón. Misma capa, misma tinta, mismo archivo.

Detalles que importan:

* **La presión cambia el grosor.** El trazo se parte en tramos y cada uno lleva
  el suyo; es lo que hace que una firma parezca una firma y no un alambre.
  Medido: de 2.23 a 4.29 en un solo trazo.
* **Los eventos fundidos** (`getCoalescedEvents`): el iPad muestrea el lápiz
  mucho más rápido de lo que dibuja la pantalla. Sin recogerlos, una línea rápida
  sale como una escalera de segmentos rectos. WebKit los soporta desde Safari
  18.2, y el iPad de este proyecto va muy por encima.
* **Se guarda en el proyecto** (`cfg.anotaciones`), no en el navegador: la firma
  de una hoja es parte del proyecto, tiene que viajar con el `.ptv` y verse en el
  iPad aunque se hiciera en el Mac. Se avisa al caparazón al levantar el lápiz y
  con un respiro de 700 ms — un trazo son cientos de eventos y guardar en cada
  uno dejaría el disco trabajando toda la sesión.
* La tinta es **SVG dentro de la propia hoja**, así que entra sola en lo que se
  imprime (el `outerHTML` de `.export-page`) y sale vectorial, no pixelada.

### Dos errores que se cazaron probando

* **La barra de herramientas se armaba antes que el motor.** `TINTA_COLORES` aún
  no existía, la barra reventaba y se llevaba por delante el resto del script —
  incluida la carga del proyecto. La página quedaba en blanco. Ahora el motor va
  primero y la barra lleva un cinturón por si acaso.
* **La capa de tinta tenía `pointer-events:none` hasta encender el modo**, lo que
  contradecía la regla principal: el Apple Pencil nunca alcanzaba la capa. Ahora
  recibe todos los eventos y decide en el código; cuando no toca escribir no hace
  `preventDefault` y `touch-action:pan-y` deja que el dedo desplace la hoja como
  si la capa no existiera.

> Ambas cosas tocan la app compartida: **también están en el Mac** (la escritura,
> con Modo escritura encendido).

---

## 16 · El zoom y las luces apagadas (2 de septiembre de 2026)

Dos quejas que parecían una sola: *"el contenido dentro de infografía se disocia
del contenido a su alrededor"*, *"en hojas imprimibles cuando mueves el zoom se
descuadran las hojas"*, y *"el modo oscuro no está bien implementado en
infografía ni en guion, y se nota más en modo en vivo"*.

### El zoom: una hoja no puede tener un ancho clavado

La infografía se dibujaba en un `<div>` de **1240 px fijos**. Medido en una
ventana de 922 px: se salía **318 px**. Y al subir el tamaño de la app en Ajustes
la ventana se hace *más angosta* en píxeles CSS, así que se salía más todavía —
por eso parecía que la hoja flotaba aparte de su marco y que los bordes se le
montaban encima.

La referencia buena era el **plano del set**: ese dibujo es un SVG con `viewBox`
y ancho 100 %, así que se acomoda solo a cualquier hueco. Una hoja de HTML no
puede tener `viewBox`, pero sí puede hacer lo mismo a mano:

1. Se mide el hueco con `ResizeObserver`.
2. Se calcula `factor = min(1, hueco / 1240)`.
3. Se escribe en la variable `--encaje` y el CSS hace `zoom:var(--encaje)`.

**`zoom` y no `transform:scale`**, a propósito: `zoom` encoge la caja de verdad,
así que debajo no queda el hueco fantasma de la altura original que deja `scale`.
Nunca crece por encima de 1 — estirar la hoja en una pantalla ancha solo la haría
borrosa. Al imprimir se quita (`@media print{zoom:1}`), porque ahí manda el zoom
de la impresora.

Medido después: hueco 906 px → `--encaje` 0.731 → la hoja ocupa 906 px. Cabe
exacta.

**La trampa del `ResizeObserver`:** escribir el factor cambia el alto de la hoja,
eso puede hacer aparecer la barra de desplazamiento, eso cambia el ancho, y el
observador se vuelve a disparar — un ciclo que no para y calienta el iPad. La
salida es una línea: *si el factor no cambió, no se escribe*.

Las **hojas imprimibles** llevan el mismo tratamiento (`--encaje-hoja`). Medido en
el iPad: hueco 567 px → encaje 0.656 → la hoja ocupa 535 px y cabe entera. Al
plegar el panel, encaje 1.0 y la hoja sale a sus 816 px.

**Un intento que hubo que deshacer el mismo día.** También se probó *apilar* el
panel encima de la vista previa cuando la ventana baja de 1180 px, con la idea de
darle a la hoja todo el ancho. En el iPad salió al revés: el panel mide
893 × 1280 y se come la pantalla entera, y la primera hoja empieza en **y = 1367**
— fuera de la vista. Reportado por el usuario y confirmado midiendo. La columna se
queda **siempre en dos**, y lo que da todo el ancho es el botón de **Plegar**, que
ya existía y recuerda tu elección.

### Las luces apagadas: el componente no debe saber en qué superficie está

La causa de fondo era una sola. Hay componentes que salen en **dos superficies**:
la escaleta y la línea de tiempo se dibujan dentro de la hoja de la infografía Y
dentro de la mesa de trabajo de la pestaña Guion; el cuadro de personal, igual.
Cada uno llevaba sus colores de papel clavados en el código, así que con las
luces apagadas quedaba una **tabla blanca en medio de una hoja apagada**.

La regla nueva: **el componente no sabe en qué superficie está**. Pide `--ui-*` y
la superficie contesta:

| quien lo contiene | qué contesta |
|---|---|
| nadie | papel — que es lo que sale de la impresora |
| `.hoja-tema` | la hoja, que en oscuro se apaga y al imprimir vuelve a papel |
| `.vista-foco` | la mesa de trabajo, que sigue al tema de la app |

Los fondos y las rayas no son valores fijos: se **mezclan** la tinta de la
superficie con su propio fondo (`color-mix`). Una sola línea sirve para claro y
para oscuro, y no hay cuatro listas que mantener sincronizadas. Los porcentajes
están medidos contra el papel de antes: 25 % de tinta sobre blanco da `#C7CCD1`,
que es la misma raya `#C8D2DE` que ya tenían las tablas.

**El color de marca.** El usuario elige el color de su organización y ese color
pinta el título y los marcos de la infografía. El azul de la casa sobre la hoja
apagada mide **1.05:1** — invisible. No se le sustituye su color: se le sube la
luz conservando el tono, un 64 % hacia la tinta crema. El 64 % está medido, no
elegido a ojo:

| marca | en oscuro | contraste |
|---|---|---|
| azul de la casa `#16365F` | `#9AA4B1` | 5.06:1 |
| rojo `#B4232A` | `#DFA69C` | 6.12:1 |
| verde `#2E7D5B` | `#AAC0AD` | 6.60:1 |
| morado `#6D28D9` | `#B8ABE3` | 6.06:1 |

Por debajo de 58 % el azul no llega a 4.5:1. En claro y al imprimir la mezcla es
de 0 %, es decir, su color tal cual — la hoja impresa no cambió ni un píxel.

**Los grises de Tailwind.** `text-slate-400/500/600` pintan un gris fijo. En esta
app siempre quieren decir lo mismo — *esto es secundario* — pero con las luces
apagadas ese gris se queda en 3:1 o menos. Se reescriben una sola vez con la
tinta que toque en cada superficie, ganando por especificidad y sin un solo
`!important`.

**El color de dato no se pone de letra.** El amarillo de "Gráfico" como texto
medía **1.79:1 sobre el papel** y 3.26:1 con las luces apagadas — o sea, estaba
mal en los dos temas. Los colores que identifican una cosa (una cámara, un tipo
de cue) siguen sin cambiar con el tema, pero ahora van en el **punto y el borde**
de la pastilla, y la letra va en tinta. Es el mismo patrón que ya usaban las
fuentes en Necesidades.

### Cómo se comprobó

Un detector que recorre todo lo que tiene texto propio, busca el primer fondo de
verdad debajo (subiendo por el árbol y mezclando lo translúcido) y mide el
contraste, en el caparazón y dentro de cada iframe. Resultado, en los dos temas:

| vista | antes (oscuro) | después |
|---|---|---|
| Necesidades | 26 tintas bajo 4.5:1 | 0 |
| Guion en vivo · escaleta editorial | varias | 0 |
| Guion en vivo · rundown técnico | 15 | 0 |
| Guion en vivo · storyboard | 3 | 0 |
| Infografía | 4 | 0 |

Sorpresa del camino: **Necesidades era la referencia buena del usuario y tenía
tres etiquetas invisibles** — "Incluir operadores de cámara automáticamente",
"Incluir monitor PREVIEW" y "Incluir playback" medían **1.11:1**, azul marino
sobre panel oscuro. Estaban ahí desde antes; se arreglaron de paso.

Y un error propio, cazado el mismo día: la primera versión del panel de sección
de la infografía llevaba **dos atributos `style` en la misma etiqueta**. JSX se
queda con el último, así que el fondo se perdía y el panel se veía transparente.

> Todo esto vive en la app compartida: **está igual en el Mac y en el iPad.**

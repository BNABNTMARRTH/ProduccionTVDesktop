import * as THREE from "three";

// Planta en vivo: con la pantalla vertical, debajo de la imagen de la cámara
// se dibuja el set visto desde arriba, con la cámara activa y lo que abarca su
// lente (un abanico que llega hasta las paredes). Usa la MISMA escena que la
// imagen de arriba; solo cambia la cámara (ortográfica, mirando al piso).

const RAYOS_ABANICO = 24;
const ALCANCE_SIN_PAREDES = 9;
const FONDO_PLANTA = new THREE.Color("#10161e");

// Distancia desde `origen` (x, z) hasta el borde del cuarto en la dirección
// (dx, dz). El origen está dentro del cuarto.
export function distanciaAlBorde(origen, dx, dz, limites) {
  if (!limites) return ALCANCE_SIN_PAREDES;
  const candidatos = [];
  if (dx > 1e-6) candidatos.push((limites.xMax - origen.x) / dx);
  if (dx < -1e-6) candidatos.push((limites.xMin - origen.x) / dx);
  if (dz > 1e-6) candidatos.push((limites.zMax - origen.z) / dz);
  if (dz < -1e-6) candidatos.push((limites.zMin - origen.z) / dz);
  const positivos = candidatos.filter((valor) => valor > 0);
  return positivos.length ? Math.min(...positivos) : ALCANCE_SIN_PAREDES;
}

// Puntos (x, z) del abanico: el vértice en la cámara y el borde lejano
// pegado a las paredes, de yaw − fov/2 a yaw + fov/2.
export function puntosAbanico(origen, yaw, fovHorizontal, limites) {
  const puntos = [{ x: origen.x, z: origen.z }];
  for (let i = 0; i <= RAYOS_ABANICO; i += 1) {
    const angulo = yaw - fovHorizontal / 2 + (fovHorizontal * i) / RAYOS_ABANICO;
    const dx = Math.cos(angulo);
    const dz = Math.sin(angulo);
    const largo = distanciaAlBorde(origen, dx, dz, limites);
    puntos.push({ x: origen.x + dx * largo, z: origen.z + dz * largo });
  }
  return puntos;
}

// Hacia dónde queda "arriba" en la planta. Se gira en múltiplos de 90° para
// que el cuarto llene el hueco (un set ancho en un hueco alto se acuesta) y,
// entre los giros que llenan igual, gana el que deja a la cámara mirando
// hacia arriba de la pantalla.
export function elegirArribaPlanta(limites, aspecto, yaw) {
  const ancho = limites.xMax - limites.xMin;
  const fondo = limites.zMax - limites.zMin;
  const direccion = { x: Math.cos(yaw), z: Math.sin(yaw) };
  const opciones = [
    { x: 0, z: -1, acostado: false },
    { x: 0, z: 1, acostado: false },
    { x: -1, z: 0, acostado: true },
    { x: 1, z: 0, acostado: true },
  ];
  let mejor = null;
  opciones.forEach((opcion) => {
    const anchoPantalla = opcion.acostado ? fondo : ancho;
    const altoPantalla = opcion.acostado ? ancho : fondo;
    const llenado = Math.min(aspecto / (anchoPantalla / altoPantalla), (anchoPantalla / altoPantalla) / aspecto);
    const mira = direccion.x * opcion.x + direccion.z * opcion.z;
    const puntaje = Math.round(llenado * 100) * 10 + mira;
    if (!mejor || puntaje > mejor.puntaje) mejor = { ...opcion, puntaje };
  });
  return mejor;
}

function limitesDeCaja(caja) {
  if (!caja || caja.isEmpty()) return null;
  return { xMin: caja.min.x, xMax: caja.max.x, zMin: caja.min.z, zMax: caja.max.z };
}

export function crearPlantaEnVivo(escena) {
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 20);
  const totalPuntos = RAYOS_ABANICO + 2;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(new Array(totalPuntos * 3).fill(0), 3));
  const indices = [];
  for (let i = 1; i < totalPuntos - 1; i += 1) indices.push(0, i, i + 1);
  geometria.setIndex(indices);
  const relleno = new THREE.MeshBasicMaterial({
    color: "#0A84FF",
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const abanico = new THREE.Mesh(geometria, relleno);
  const bordes = new THREE.BufferGeometry();
  bordes.setAttribute("position", new THREE.Float32BufferAttribute(new Array(4 * 3).fill(0), 3));
  const lineas = new THREE.LineSegments(
    bordes,
    new THREE.LineBasicMaterial({ color: "#0A84FF", transparent: true, opacity: 0.95, depthWrite: false })
  );
  const grupo = new THREE.Group();
  grupo.add(abanico, lineas);
  grupo.visible = false;
  grupo.renderOrder = 5;
  escena.add(grupo);

  const actualizarAbanico = (puntos, color) => {
    const y = 0.03;
    const posiciones = geometria.attributes.position;
    puntos.forEach((punto, i) => posiciones.setXYZ(i, punto.x, y, punto.z));
    posiciones.needsUpdate = true;
    geometria.computeBoundingSphere();
    const extremos = bordes.attributes.position;
    const inicio = puntos[0];
    const primero = puntos[1];
    const ultimo = puntos[puntos.length - 1];
    extremos.setXYZ(0, inicio.x, y, inicio.z);
    extremos.setXYZ(1, primero.x, y, primero.z);
    extremos.setXYZ(2, inicio.x, y, inicio.z);
    extremos.setXYZ(3, ultimo.x, y, ultimo.z);
    extremos.needsUpdate = true;
    bordes.computeBoundingSphere();
    relleno.color.set(color);
    lineas.material.color.set(color);
  };

  // rect = { x, y, ancho, alto } en px CSS desde arriba a la izquierda.
  const dibujar = ({ renderer, motor, contenido, rect, altoTotal, color }) => {
    const vista = motor?.vistaCamara;
    if (!vista) return;
    const limites = contenido.ciclorama?.userData?.limites || limitesDeCaja(motor.cajaEncuadre);
    if (!limites) return;
    const altoForo = Number(contenido.ciclorama?.userData?.alto) || 4;
    const margen = 0.4;
    const centroX = (limites.xMin + limites.xMax) / 2;
    const centroZ = (limites.zMin + limites.zMax) / 2;
    const aspecto = rect.ancho / Math.max(1, rect.alto);
    const yaw = vista.yawBase + vista.pan;
    // El giro de la planta se decide con la dirección guardada, no con la del
    // momento: si no, el cuarto daría vueltas mientras se panea.
    const arriba = elegirArribaPlanta(limites, aspecto, vista.yawBase);
    let medioAncho = (arriba.acostado ? limites.zMax - limites.zMin : limites.xMax - limites.xMin) / 2 + margen;
    let medioAlto = (arriba.acostado ? limites.xMax - limites.xMin : limites.zMax - limites.zMin) / 2 + margen;
    if (medioAncho / medioAlto > aspecto) medioAlto = medioAncho / aspecto;
    else medioAncho = medioAlto * aspecto;
    camara.left = -medioAncho;
    camara.right = medioAncho;
    camara.top = medioAlto;
    camara.bottom = -medioAlto;
    // Por debajo de la parrilla de luces, para que el techo no tape el set.
    camara.position.set(centroX, altoForo - 0.35, centroZ);
    camara.up.set(arriba.x, 0, arriba.z);
    camara.lookAt(centroX, 0, centroZ);
    camara.near = 0.05;
    camara.far = altoForo + 2;
    camara.updateProjectionMatrix();

    const fovVertical = THREE.MathUtils.degToRad(motor.camara.fov);
    const fovHorizontal = 2 * Math.atan(Math.tan(fovVertical / 2) * motor.camara.aspect);
    const origen = { x: motor.camara.position.x, z: motor.camara.position.z };
    actualizarAbanico(puntosAbanico(origen, yaw, fovHorizontal, limites), color);

    // La cámara activa no se ve en su propia imagen, pero aquí sí, girada a
    // donde apunta ahora mismo.
    const modelo = motor.objetosCamara?.get(vista.camaraId);
    const giroGuardado = modelo?.rotation.y;
    if (modelo) {
      modelo.visible = true;
      modelo.rotation.y = Math.PI / 2 - yaw;
    }
    grupo.visible = true;
    const fondoEscena = escena.background;
    escena.background = FONDO_PLANTA;
    const abajo = altoTotal - rect.y - rect.alto;
    renderer.setViewport(rect.x, abajo, rect.ancho, rect.alto);
    renderer.setScissor(rect.x, abajo, rect.ancho, rect.alto);
    renderer.setScissorTest(true);
    renderer.render(escena, camara);
    renderer.setScissorTest(false);
    escena.background = fondoEscena;
    grupo.visible = false;
    if (modelo) {
      modelo.visible = false;
      modelo.rotation.y = giroGuardado;
    }
  };

  return { dibujar };
}

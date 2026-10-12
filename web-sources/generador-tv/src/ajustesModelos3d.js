export const GIRO_Y_FRENTE_X_A_Z = -90;

export function crearAjustesModelos3D(manifiesto) {
  return Object.freeze(Object.fromEntries(
    Object.entries(manifiesto).map(([clave, datos]) => [
      clave,
      Object.freeze({
        ...datos,
        modoEscala: "real",
        giroY: GIRO_Y_FRENTE_X_A_Z,
      }),
    ])
  ));
}

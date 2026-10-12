import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ID_MANIFIESTO_MODELOS_3D = "virtual:modelos3d-manifiesto";
const ID_RESUELTO_MANIFIESTO_MODELOS_3D = `\0${ID_MANIFIESTO_MODELOS_3D}`;
const RUTA_MANIFIESTO_MODELOS_3D = fileURLToPath(
  new URL("./public/modelos3d/modelos.json", import.meta.url)
);
const ID_CATALOGO_CAMARAS = "virtual:catalogo-camaras";
const ID_RESUELTO_CATALOGO_CAMARAS = `\0${ID_CATALOGO_CAMARAS}`;
const RUTA_CATALOGO_CAMARAS = fileURLToPath(
  new URL("./public/modelos3d/catalogo_camaras.json", import.meta.url)
);

function manifiestoModelos3D() {
  return {
    name: "manifiesto-modelos-3d",
    resolveId(id) {
      return id === ID_MANIFIESTO_MODELOS_3D ? ID_RESUELTO_MANIFIESTO_MODELOS_3D : null;
    },
    load(id) {
      if (id !== ID_RESUELTO_MANIFIESTO_MODELOS_3D) return null;
      this.addWatchFile(RUTA_MANIFIESTO_MODELOS_3D);
      const manifiesto = JSON.parse(readFileSync(RUTA_MANIFIESTO_MODELOS_3D, "utf8"));
      return `export default ${JSON.stringify(manifiesto)};`;
    },
  };
}

function catalogoCamaras() {
  return {
    name: "catalogo-camaras",
    resolveId(id) {
      return id === ID_CATALOGO_CAMARAS ? ID_RESUELTO_CATALOGO_CAMARAS : null;
    },
    load(id) {
      if (id !== ID_RESUELTO_CATALOGO_CAMARAS) return null;
      this.addWatchFile(RUTA_CATALOGO_CAMARAS);
      const catalogo = JSON.parse(readFileSync(RUTA_CATALOGO_CAMARAS, "utf8"));
      return `export default ${JSON.stringify(catalogo)};`;
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [manifiestoModelos3D(), catalogoCamaras(), react()],
});

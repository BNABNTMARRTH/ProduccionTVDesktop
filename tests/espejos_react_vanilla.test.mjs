/* LOS ESPEJOS REACT ↔ VANILLA.
   El plano del set se dibuja dos veces: en React (el generador, catalogos.js y
   glifos.jsx) y en texto SVG (frontend/public/tools/shared/sheets.js, que usan
   las hojas impresas, el tally y Exportar). Se compilan por separado, así que
   hoy no pueden compartir el mismo archivo. El riesgo es que alguien agregue un
   mueble o retoque un glifo en un lado y olvide el otro: el plano y la hoja
   impresa empiezan a decir cosas distintas sin que nada truene.
   Esta prueba compara las dos copias pieza por pieza. Si falla, el mensaje dice
   cuál mueble o cuál luz se desincronizó. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { MUEBLES_CATALOGO, MUEBLE_ASIENTOS } from '../web-sources/generador-tv/src/catalogos.js';
import { LUZ_CATALOGO } from '../web-sources/generador-tv/src/iluminacion.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const generador = join(raiz, 'web-sources/generador-tv');

const espejos = (() => {
  const src = readFileSync(join(raiz, 'frontend/public/tools/shared/sheets.js'), 'utf8');
  const ventana = { PTVSheets: null };
  new Function('window', src)(ventana);
  return ventana.PTVSheets._espejos;
})();

/* glifos.jsx es JSX: Node no lo lee directo. Se empaqueta al vuelo con el
   esbuild que ya trae el generador y se pinta a texto con react-dom/server. */
const react = await (async () => {
  const requerirDelGenerador = createRequire(join(generador, 'package.json'));
  const esbuild = requerirDelGenerador('esbuild');
  const carpeta = mkdtempSync(join(tmpdir(), 'ptv-espejos-'));
  const salida = join(carpeta, 'glifos.cjs');
  try {
    await esbuild.build({
      stdin: {
        contents: `
          import { renderToStaticMarkup } from "react-dom/server";
          import { createElement } from "react";
          import { GlyphLuz, GlyphMueble } from "./src/glifos.jsx";
          export const luz = (forma, color) => renderToStaticMarkup(createElement("svg", null, createElement(GlyphLuz, { forma, color })));
          export const mueble = (tipo, anchoPantalla) => renderToStaticMarkup(createElement("svg", null, createElement(GlyphMueble, { tipo, anchoPantalla })));
        `,
        resolveDir: generador,
        loader: 'jsx',
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      jsx: 'automatic',
      outfile: salida,
      logLevel: 'silent',
    });
    return createRequire(import.meta.url)(salida);
  } finally {
    // El módulo ya quedó en memoria; la carpeta temporal sobra.
    process.on('exit', () => rmSync(carpeta, { recursive: true, force: true }));
  }
})();

/* Reduce un SVG a la lista de figuras con sus atributos ordenados. Así no
   importan los <g> que React agrega para envolver, ni si la etiqueta se cierra
   con "/>" o con "</rect>", ni el orden en que se escribieron los atributos. */
function figuras(svg) {
  const lista = [];
  for (const [, etiqueta, resto] of svg.matchAll(/<([a-z]+)([^>]*?)\/?>/g)) {
    if (etiqueta === 'svg' || etiqueta === 'g' && !resto.trim()) continue;
    const atributos = [...resto.matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(([, nombre, valor]) => `${nombre}=${valor}`)
      .sort();
    lista.push(`${etiqueta}[${atributos.join(' ')}]`);
  }
  return lista;
}

test('el catálogo de muebles tiene los mismos tipos en React y en las hojas', () => {
  assert.deepEqual(
    Object.keys(espejos.MUEBLES).sort(),
    Object.keys(MUEBLES_CATALOGO).sort(),
    'agrega o quita el mueble en catalogos.js Y en sheets.js (const MUEBLES)'
  );
});

test('cada mueble se llama igual y tiene los mismos asientos en los dos lados', () => {
  for (const [tipo, def] of Object.entries(MUEBLES_CATALOGO)) {
    assert.equal(espejos.MUEBLES[tipo].es, def.es, `nombre de "${tipo}"`);
    assert.deepEqual(espejos.MUEBLES[tipo].asientos, MUEBLE_ASIENTOS[tipo], `asientos de "${tipo}"`);
  }
});

test('cada mueble se dibuja igual en el plano y en la hoja impresa', () => {
  for (const tipo of Object.keys(MUEBLES_CATALOGO)) {
    assert.deepEqual(
      figuras(espejos.muebleGlyph(tipo, 500)),
      figuras(react.mueble(tipo, 500)),
      `glifo de "${tipo}": GlyphMueble (glifos.jsx) ≠ muebleGlyph (sheets.js)`
    );
  }
});

test('cada forma de luz del catálogo se dibuja igual en el plano y en la hoja', () => {
  const formas = [...new Set(Object.values(LUZ_CATALOGO).map((luz) => luz.forma).filter(Boolean))];
  assert.ok(formas.length > 5, 'el catálogo de luces trae formas');
  for (const forma of formas) {
    assert.deepEqual(
      figuras(espejos.luzGlyph(forma, '#E8A33D')),
      figuras(react.luz(forma, '#E8A33D')),
      `glifo de luz "${forma}": GlyphLuz (glifos.jsx) ≠ luzGlyph (sheets.js)`
    );
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (ruta) => fs.readFileSync(path.join(aqui, ruta), 'utf8');
const EXPORTAR = leer('../frontend/public/tools/exportar/index.html');
const MAIN = leer('../frontend/src/main.js');

test('Documentos escala la hoja completa con transform y reserva su geometría visual', () => {
  assert.doesNotMatch(EXPORTAR, /\.export-page\s*\{\s*zoom:/);
  assert.match(EXPORTAR, /transform:scale\(var\(--encaje-hoja,1\)\)/);
  assert.match(EXPORTAR, /marco\.style\.width\s*=\s*`\$\{pagina\.offsetWidth \* factor\}px`/);
  assert.match(EXPORTAR, /marco\.style\.height\s*=\s*`\$\{pagina\.offsetHeight \* factor\}px`/);
  assert.match(EXPORTAR, /new ResizeObserver\(\(entradas\) => entradas\.forEach/);
});

test('Hoja, Mosaico, impresión y PNG neutralizan la escala en el momento correcto', () => {
  assert.match(EXPORTAR, /\.preview\.single-view \.export-page-frame\.current-page-frame/);
  assert.match(EXPORTAR, /@media print[\s\S]*?\.export-page\{position:relative!important;transform:none!important/);
  assert.match(EXPORTAR, /const visual = target\.closest\('\.export-page-frame'\) \|\| target/);
  assert.match(MAIN, /element\.style\.setProperty\('transform', 'none', 'important'\)/);
  assert.match(MAIN, /finally \{[\s\S]*?style\.removeProperty\('transform'\)/);
});

test('la tinta conserva coordenadas editoriales y compacto prioriza el documento', () => {
  assert.match(EXPORTAR, /getScreenCTM\(\)/);
  assert.match(EXPORTAR, /matrixTransform\(ctm\.inverse\(\)\)/);
  assert.match(EXPORTAR, /guardado === null && compacto/);
  assert.match(EXPORTAR, /\.doc-header-main\{[\s\S]*?height:60px;min-height:60px;flex-direction:row/);
  assert.match(EXPORTAR, /ponerEstadoAnotar\(!tactil\)/);
});

test('Documentos abre táctil en navegación y separa dedo de Apple Pencil', () => {
  assert.match(EXPORTAR, /let modoManual = !entradaTactil\(\)/);
  assert.match(EXPORTAR, /const puedeEscribir = \(e\) => e\.pointerType === 'pen' \|\| modoEscritura/);
  assert.match(EXPORTAR, /window\.tintaModoDedo = ponerModoManual/);
  assert.match(EXPORTAR, /tactil && activo \? 'Listo' : 'Anotar'/);
  assert.match(EXPORTAR, /ptv:cancelar-tinta-tactil/);
});

test('Documentos admite pellizco, trackpad y zoom hasta 300 por ciento sin perder el ancla', () => {
  assert.match(EXPORTAR, /addEventListener\('gesturechange'/);
  assert.match(EXPORTAR, /addEventListener\('touchmove'/);
  assert.match(EXPORTAR, /event\.ctrlKey.*event\.metaKey/s);
  assert.match(EXPORTAR, /Math\.min\(3,/);
  assert.match(EXPORTAR, /scrollArea\.scrollLeft \+= rect\.left \+ ancla\.x \* limpio - ancla\.clienteX/);
  assert.match(EXPORTAR, /new ResizeObserver\(\(\) => window\.aplicarEncajeAutomatico\(\)\)/);
});

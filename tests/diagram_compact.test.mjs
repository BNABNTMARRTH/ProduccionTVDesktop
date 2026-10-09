import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DIAGRAMA = fs.readFileSync(new URL('../frontend/public/tools/diagrama/index.html', import.meta.url), 'utf8');
const EXPORTAR = fs.readFileSync(new URL('../frontend/public/tools/exportar/index.html', import.meta.url), 'utf8');
const GLIFOS = fs.readFileSync(new URL('../frontend/public/tools/shared/equipment_glyphs.js', import.meta.url), 'utf8');

test('pantalla y papel consumen el mismo catálogo de glifos de equipo', () => {
  assert.match(DIAGRAMA, /shared\/equipment_glyphs\.js/);
  assert.match(EXPORTAR, /shared\/equipment_glyphs\.js/);
  for (const tipo of ['camara', 'microfono', 'switcher', 'audio', 'encoder', 'plataforma', 'monitor', 'fuente', 'grabador', 'graficos']) {
    assert.match(GLIFOS, new RegExp(`\\b${tipo}:`));
  }
});

test('la hoja técnica centra pocos nodos sin ampliarlos', () => {
  assert.match(EXPORTAR, /const escala = Math\.min\(1,/);
  assert.match(EXPORTAR, /class="diagrama-papel" data-diagram-scale=/);
  assert.match(EXPORTAR, /class="diagrama-nodo-papel"/);
});

test('el diagnóstico compacto nace como chip y tiene cierre táctil', () => {
  assert.match(DIAGRAMA, /<aside class="checks" id="checks"/);
  assert.match(DIAGRAMA, /id="checkChip"/);
  assert.match(DIAGRAMA, /\.checks-close\{display:grid;place-items:center;width:44px;height:44px/);
  assert.match(DIAGRAMA, /setChecklistOpen\(!esCompacto\(\)\)/);
});

test('los gestos táctiles distinguen toque, arrastre, pulsación larga y pellizco', () => {
  assert.match(DIAGRAMA, /UMBRAL_TOQUE=9,MAX_TOQUE_MS=500,PULSACION_LARGA_MS=350/);
  assert.match(DIAGRAMA, /function arrastreTactil/);
  assert.match(DIAGRAMA, /wrap\.addEventListener\('touchstart'/);
  assert.match(DIAGRAMA, /pinch\.actual=next/);
  assert.match(DIAGRAMA, /view=pinch\.actual;pinch=null;applyView\(\);save\(\)/);
});

test('los puertos conservan al menos 44 pt aun con el lienzo alejado', () => {
  assert.match(DIAGRAMA, /width:calc\(46px \* var\(--view-inverse,1\)\)/);
  assert.match(DIAGRAMA, /--view-inverse/);
});

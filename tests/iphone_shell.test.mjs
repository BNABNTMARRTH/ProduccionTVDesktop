import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const PBX = leer('../ios/ProduccionTV.xcodeproj/project.pbxproj');
const PLIST = leer('../ios/ProduccionTV/Info.plist');
const ADAPTACION = leer('../ios/ProduccionTV/Recursos/adaptacion-ipad.js');
const MAIN = leer('../frontend/src/main.js');
const STYLE = leer('../frontend/src/style.css');

test('el target nativo admite iPhone y iPad en Debug y Release', () => {
  assert.equal([...PBX.matchAll(/TARGETED_DEVICE_FAMILY = "1,2";/g)].length, 2);
});

test('iPhone admite retrato y ambos paisajes, mientras iPad conserva su bloque propio', () => {
  const inicio = PLIST.indexOf('<key>UISupportedInterfaceOrientations</key>');
  const fin = PLIST.indexOf('</array>', inicio);
  const iphone = PLIST.slice(inicio, fin);
  assert.ok(inicio >= 0, 'falta el bloque de orientaciones sin sufijo para iPhone');
  assert.match(iphone, /UIInterfaceOrientationPortrait/);
  assert.match(iphone, /UIInterfaceOrientationLandscapeLeft/);
  assert.match(iphone, /UIInterfaceOrientationLandscapeRight/);
  assert.doesNotMatch(iphone, /PortraitUpsideDown/);
  assert.match(PLIST, /UISupportedInterfaceOrientations~ipad/);
});

test('el puente iOS conserva las cuatro áreas seguras y limita la escala del iPhone', () => {
  for (const lado of ['top', 'right', 'bottom', 'left']) {
    assert.match(ADAPTACION, new RegExp(`env\\(safe-area-inset-${lado}\\)`));
  }
  assert.match(ADAPTACION, /viewport-fit=cover/);
  assert.match(ADAPTACION, /ANCHO_MINIMO_IPHONE\s*=\s*320/);
  assert.match(ADAPTACION, /Math\.min\(escala, Math\.max\(1, ladoCorto \/ ANCHO_MINIMO_IPHONE\)\)/);
});

test('el modo compacto pliega el rail al entrar y deja el logo como salida', () => {
  assert.ok(MAIN.indexOf('function plegarRailSinAnimacion()') < MAIN.indexOf('globalResponsiveManager.subscribe'));
  assert.match(MAIN, /if \(layoutState\.isCompact\) plegarRailSinAnimacion\(\);/);
  assert.match(STYLE, /data-layout="compact"/);
  assert.match(STYLE, /rail-plegado \.rail/);
  assert.match(STYLE, /width:\s*0\s*!important/);
  assert.match(STYLE, /\.rail-logo\s*\{[^}]*width:\s*44px\s*!important[^}]*height:\s*44px\s*!important/s);
});

test('Inicio y Plantillas usan una columna, controles táctiles y desborde desplazable', () => {
  const compacto = STYLE.slice(STYLE.indexOf('1. ESTRATEGIA COMPACTA'), STYLE.indexOf('2. ESTRATEGIA TABLET'));
  assert.match(compacto, /\.proj-grid,/);
  assert.match(compacto, /\.tpl-grid\s*\{/);
  assert.match(compacto, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(compacto, /\.apple-segmented\s*\{[^}]*overflow-x:\s*auto\s*!important/s);
  assert.match(compacto, /\.tpl-table-wrap\s*\{[^}]*overflow-x:\s*auto\s*!important/s);
  assert.match(compacto, /\.header-actions button\s*\{[^}]*width:\s*44px\s*!important[^}]*height:\s*44px\s*!important/s);
});

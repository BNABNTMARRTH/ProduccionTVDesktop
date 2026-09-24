import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const PBX = leer('../ios/ProduccionTV.xcodeproj/project.pbxproj');
const PLIST = leer('../ios/ProduccionTV/Info.plist');
const ADAPTACION = leer('../ios/ProduccionTV/Recursos/adaptacion-ipad.js');
const MAIN = leer('../frontend/src/main.js');
const STYLE = leer('../frontend/src/style.css');
const EDITOR_GUION = leer('../web-sources/generador-tv/src/EditorGuion.jsx');
const MESA_LUZ = leer('../web-sources/generador-tv/src/MesaDeLuz.jsx');
const GENERADOR_STYLE = leer('../web-sources/generador-tv/src/index.css');
const SHEETS = leer('../frontend/public/tools/shared/sheets.js');

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
  assert.match(ADAPTACION, /:root:not\(\[data-layout=\"compact\"\]\) body/);
  assert.match(ADAPTACION, /:root\[data-layout=\"compact\"\] body\{box-sizing:border-box;padding:0\}/);
});

test('el modo compacto pliega el rail al entrar y deja el logo como salida', () => {
  assert.ok(MAIN.indexOf('function plegarRailSinAnimacion()') < MAIN.indexOf('globalResponsiveManager.subscribe'));
  assert.match(MAIN, /if \(layoutState\.isCompact\)\s*\{\s*plegarRailSinAnimacion\(\);/);
  assert.match(STYLE, /data-layout="compact"/);
  assert.match(STYLE, /rail-plegado \.rail/);
  assert.match(STYLE, /width:\s*0\s*!important/);
  assert.match(STYLE, /data-layout="compact"\] \.rail-logo\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
  assert.match(STYLE, /data-layout="compact"\] \.rail-logo,[\s\S]*data-layout="tablet"\] \.rail-logo\s*\{\s*z-index:\s*51\s*!important/);
});

test('Inicio y Plantillas usan tarjetas de una columna y controles táctiles', () => {
  const compacto = STYLE.slice(STYLE.indexOf('1. ESTRATEGIA COMPACTA'), STYLE.indexOf('2. ESTRATEGIA TABLET'));
  assert.match(compacto, /\.proj-grid,/);
  assert.match(compacto, /\.tpl-grid\s*\{/);
  assert.match(compacto, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(compacto, /\.apple-segmented\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(compacto, /\.view-switcher\s*\{\s*display:\s*none/s);
  assert.match(compacto, /\.tpl-table-wrap\s*\{\s*display:\s*none/s);
  assert.match(MAIN, /projectViewContext\.setStrategy\(new GridViewStrategy\(\), 'grid'\)/);
});

test('el encabezado compacto reserva Proyecto y mueve lo secundario a una hoja', () => {
  const compacto = STYLE.slice(STYLE.indexOf('1. ESTRATEGIA COMPACTA'), STYLE.indexOf('2. ESTRATEGIA TABLET'));
  assert.match(MAIN, /id="compact-actions-btn"/);
  assert.match(MAIN, /id="compact-actions-sheet"/);
  assert.match(compacto, /grid-template-columns:\s*44px 44px minmax\(0,1fr\) 44px/);
  assert.match(compacto, /min-height:calc\(var\(--ptv-safe-top,env\(safe-area-inset-top\)\) \+ 88px\)/);
  assert.match(compacto, /\.pestana\.fija \.pestana-txt\s*\{[^}]*overflow:\s*visible/s);
  assert.match(compacto, /\.compact-actions-btn\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
  assert.match(compacto, /\.compact-sheet-list button\s*\{[^}]*min-height:\s*56px/s);
  assert.match(compacto, /\.compact-sheet-list button\[hidden\]\s*\{\s*display:\s*none/s);
  assert.match(MAIN, /data-compact-source="reanclar-btn"/);
});

test('al salir de compacto se restaura también el indicador de lista o mosaico', () => {
  assert.match(MAIN, /reflejarModoDeVista\('#view-grid-btn', '#view-list-btn', modoProyectoAntesDeCompacto\)/);
  assert.match(MAIN, /reflejarModoDeVista\('#tpl-view-grid-btn', '#tpl-view-list-btn', modoPlantillasAntesDeCompacto\)/);
});

test('Escape deja cerrar primero diálogos y menús antes de plegar el rail', () => {
  assert.match(MAIN, /function hayCapaConEscapePropio\(\)/);
  assert.match(MAIN, /\.aj-overlay:not\(\[hidden\]\)/);
  assert.match(MAIN, /\.tour-overlay/);
  assert.match(MAIN, /\.menu-modulos/);
  assert.match(MAIN, /!railPlegado\(\) && !hayCapaConEscapePropio\(\)/);
});

test('Guion literario ofrece selector táctil de tipos sobre visualViewport', () => {
  assert.match(EDITOR_GUION, /window\.visualViewport/);
  assert.match(EDITOR_GUION, /className="guion-tipos-barra no-print"/);
  assert.match(EDITOR_GUION, /onPointerDown=\{\(e\) => \{ e\.preventDefault\(\); cambiarTipoEnfocado\(tipo\); \}\}/);
  assert.match(GENERADOR_STYLE, /\.guion-tipos-scroll button\s*\{[^}]*min-height:44px!important/s);
  assert.match(GENERADOR_STYLE, /\.guion-bloque-texto\s*\{\s*min-height:44px!important/s);
  assert.doesNotMatch(GENERADOR_STYLE, /\.guion-tipo-etiqueta:not\(\.activa\)\s*\{\s*display:none/);
  assert.match(GENERADOR_STYLE, /\.guion-tipo-etiqueta\s*\{[^}]*min-width:44px!important[^}]*min-height:44px/s);
  assert.match(EDITOR_GUION, /id="mostrar-tipos-impresion"/);
  assert.match(SHEETS, /cfg\?\.impresion\?\.mostrarTiposGuion !== false/);
  assert.match(SHEETS, /class="gl-tipo"/);
});

test('el compacto horizontal pinta a los bordes y concentra el encabezado en una fila', () => {
  assert.match(STYLE, /\.rail-logo\s*\{[^}]*left:max\(12px,var\(--ptv-safe-left/s);
  assert.match(STYLE, /@media \(orientation:landscape\) and \(max-height:499px\)/);
  assert.match(STYLE, /\.workspace-header:has\(\.secciones:not\(\[hidden\]\)\)\s*\{[^}]*grid-template-rows:44px/s);
  assert.match(STYLE, /\.header-nav\s*\{[^}]*overflow-x:auto/s);
});

test('la ficha compacta de Mesa de luz apila imagen, metadatos y campos', () => {
  assert.match(MESA_LUZ, /className="mesa-luz-ficha-cuerpo grid gap-3 p-3"/);
  assert.match(MESA_LUZ, /className="mesa-luz-ficha-titulo flex-1 truncate text-sm"/);
  assert.match(GENERADOR_STYLE, /\.mesa-luz-ficha-cuerpo\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)!important/s);
  assert.match(GENERADOR_STYLE, /\.mesa-luz-ficha-acciones button\s*\{[^}]*min-height:44px!important/s);
  assert.match(EDITOR_GUION, /className="guion-encabezado/);
});

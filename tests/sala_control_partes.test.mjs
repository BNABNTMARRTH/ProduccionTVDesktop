/* La Sala de Control (production.js) se partió en piezas: el HTML
   (sala_control_html.js), el teleprompter (teleprompter.js) y los atajos de
   teclado (accionDeTecla). Estas pruebas cuidan las piezas que no necesitan
   navegador. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accionDeTecla, buildPreflightChecklist, construirPrograma, formatTime } from '../frontend/src/production.js';
import { htmlChecklist, htmlSalaDeControl, htmlSalaVacia } from '../frontend/src/sala_control_html.js';

const tecla = (key, extra = {}) => ({ key, target: { tagName: 'DIV' }, ...extra });

test('los atajos de la sala: CUT, transporte, inspector y cámaras', () => {
  assert.deepEqual(accionDeTecla(tecla('Enter'), 3), { tipo: 'cut' });
  assert.deepEqual(accionDeTecla(tecla('R'), 3), { tipo: 'resetTransport' });
  assert.deepEqual(accionDeTecla(tecla('j'), 3), { tipo: 'prevStep' });
  assert.deepEqual(accionDeTecla(tecla('ArrowRight'), 3), { tipo: 'nextStep' });
  assert.deepEqual(accionDeTecla(tecla('i'), 3), { tipo: 'inspector' });
  assert.deepEqual(accionDeTecla(tecla('2'), 3), { tipo: 'camara', indice: 1 });
});

test('un número sin cámara, una tecla con ⌘ o escribir en un campo no hacen nada', () => {
  assert.equal(accionDeTecla(tecla('4'), 3), null);
  assert.equal(accionDeTecla(tecla('r', { metaKey: true }), 3), null);
  assert.equal(accionDeTecla(tecla('r', { target: { tagName: 'INPUT' } }), 3), null);
  assert.equal(accionDeTecla(tecla('x'), 3), null);
});

test('el HTML de la sala trae el nombre escapado, una tecla por cámara y el reloj', () => {
  const cfg = {
    camaras: [{ id: 'c1', nombre: 'CAM 1', plano: 'PM' }, { id: 'c2', nombre: 'CAM 2' }],
    escaleta: [{ id: 's', segmento: 'Intro', dur: 90, fuente: 'c1', tomas: [] }],
    extras: [],
  };
  const checklist = buildPreflightChecklist(cfg, { nodes: [], edges: [] });
  const programa = construirPrograma(cfg);
  const html = htmlSalaDeControl({
    project: { name: 'Demo <x>' }, programa, hayPrograma: true, hayEscaleta: true, cams: cfg.camaras,
    checklist, listo: checklist.isReady, alistamientoPct: checklist.readinessPercentage,
    totalItems: checklist.items.length, diagCount: 0, runCount: 0, inspectorVisible: false, filtroActivo: 'all',
  });
  assert.ok(html.includes('Demo &lt;x&gt;'));
  assert.equal((html.match(/data-cam="/g) || []).length, 2);
  assert.ok(html.includes(`Total: ${formatTime(programa.total)}`));
  assert.ok(!html.includes('undefined'));
  assert.equal((html.match(/<div\b/g) || []).length, (html.match(/<\/div>/g) || []).length, 'divs balanceados');
});

test('sin proyecto, la sala invita a volver a Inicio; checklist vacío dice que todo está verificado', () => {
  assert.ok(htmlSalaVacia().includes('id="go-home"'));
  assert.ok(htmlChecklist([]).includes('verificados'));
  assert.ok(htmlChecklist([{ type: 'error', text: 'Falta cable' }]).includes('Falta cable'));
});

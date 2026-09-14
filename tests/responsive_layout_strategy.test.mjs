import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompactLayoutStrategy,
  TabletLayoutStrategy,
  ExpandedLayoutStrategy,
  ResponsiveLayoutManager
} from '../frontend/src/responsive_layout_strategy.js';

test('GoF Strategy: Cada estrategia responde al rango de anchos correcto', () => {
  const compact = new CompactLayoutStrategy();
  const tablet = new TabletLayoutStrategy();
  const expanded = new ExpandedLayoutStrategy();

  // Mobile / Split View (< 768px)
  assert.equal(compact.matches(360), true);
  assert.equal(compact.matches(767), true);
  assert.equal(compact.matches(768), false);

  // Tablet / iPad (768px - 1099px)
  assert.equal(tablet.matches(767), false);
  assert.equal(tablet.matches(768), true);
  assert.equal(tablet.matches(1024), true);
  assert.equal(tablet.matches(1099), true);
  assert.equal(tablet.matches(1100), false);

  // Expanded / Studio Monitor (>= 1100px)
  assert.equal(expanded.matches(1099), false);
  assert.equal(expanded.matches(1100), true);
  assert.equal(expanded.matches(1920), true);
  assert.equal(expanded.matches(2560), true);
});

test('GoF Strategy: apply() muta atributos y estilos en el elemento raíz', () => {
  const mockElement = {
    attributes: {},
    classes: new Set(),
    styles: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    classList: {
      toggle(cls, val) {
        if (val) mockElement.classes.add(cls);
        else mockElement.classes.delete(cls);
      }
    },
    style: {
      setProperty(k, v) { mockElement.styles[k] = v; }
    }
  };

  const compact = new CompactLayoutStrategy();
  compact.apply(mockElement, { width: 500, height: 800 });

  assert.equal(mockElement.attributes['data-layout'], 'compact');
  assert.equal(mockElement.classes.has('layout-compact'), true);
  assert.equal(mockElement.classes.has('layout-expanded'), false);
  assert.equal(mockElement.styles['--responsive-columns'], '1');
  assert.equal(mockElement.styles['--responsive-rail-width'], '0px');
});

test('GoF Inversión de Control (IoC): El GoF es quien LLAMA a los componentes registrados', () => {
  const mockElement = {
    clientWidth: 1200,
    clientHeight: 800,
    setAttribute() {},
    classList: { toggle() {} },
    style: { setProperty() {} }
  };

  const manager = new ResponsiveLayoutManager({ rootElement: mockElement });

  const llamadasAComponente = [];
  const componenteUI = {
    id: 'WorkspaceHeader',
    onLayoutChange(state) {
      // ESTE MÉTODO ES LLAMADO POR EL GOF
      llamadasAComponente.push(state.name);
    }
  };

  // 1. Registramos el componente
  manager.registerComponent(componenteUI);

  // 2. Evaluamos en modo escritorio (1400px)
  manager.evaluate(1400);
  assert.equal(llamadasAComponente.length, 1);
  assert.equal(llamadasAComponente[0], 'expanded');

  // 3. Redimensionamos a modo Split View / Mobile (600px)
  // El GoF evalúa y LLAMA inmediatamente a onLayoutChange
  manager.evaluate(600);
  assert.equal(llamadasAComponente.length, 2);
  assert.equal(llamadasAComponente[1], 'compact');

  // 4. Redimensionamos a modo Tablet (850px)
  manager.evaluate(850);
  assert.equal(llamadasAComponente.length, 3);
  assert.equal(llamadasAComponente[2], 'tablet');
});

test('GoF Observer: Notifica a los suscriptores y permite desuscripción sin fugas', () => {
  const mockElement = {
    clientWidth: 1200,
    clientHeight: 800,
    setAttribute() {},
    classList: { toggle() {} },
    style: { setProperty() {} }
  };

  const manager = new ResponsiveLayoutManager({ rootElement: mockElement });
  let notificaciones = 0;
  let ultimoEstado = null;

  const unsubscribe = manager.subscribe((state) => {
    notificaciones++;
    ultimoEstado = state;
  });

  manager.evaluate(500);
  assert.equal(notificaciones, 1);
  assert.equal(ultimoEstado.name, 'compact');
  assert.equal(ultimoEstado.isCompact, true);

  // Desuscribirse
  unsubscribe();
  manager.evaluate(1200);
  // Las notificaciones no deben aumentar después de desuscribirse
  assert.equal(notificaciones, 1);
});

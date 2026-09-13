import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProductionProject,
  ProjectInfoElement,
  BudgetElement,
  RundownElement,
  CamerasElement,
  AudioElement,
  LightingElement,
  DiagramElement,
  ProjectVisitor,
  EdlExportVisitor,
  CsvExportVisitor,
  MarkdownExportVisitor,
  DossierComposite,
  SectionComposite,
  PageLeaf,
  ExportStrategyManager
} from '../frontend/src/export_visitor.js';

test('Visitor Pattern: ProductionProject acepta visitantes y despacha a todos sus elementos', () => {
  const visited = [];

  class TraceVisitor extends ProjectVisitor {
    visitProjectInfo(el) { visited.push('info:' + el.name); }
    visitBudget(el) { visited.push('budget:' + el.presupuesto); }
    visitRundown(el) { visited.push('rundown:' + el.items.length); }
    visitCameras(el) { visited.push('cameras:' + el.items.length); }
    visitAudio(el) { visited.push('audio:' + el.items.length); }
    visitLighting(el) { visited.push('lighting:' + el.items.length); }
    visitDiagram(el) { visited.push('diagram:' + el.nodes.length); }
    getResult() { return visited; }
  }

  const project = new ProductionProject({
    projectName: 'Noticiero Estelar',
    cfg: {
      titulo: 'Noticiero Estelar',
      perfil: { presupuesto: 150000 },
      escaleta: [{ bloque: 'Intro', dur: 30 }, { bloque: 'Noticias', dur: 120 }],
      camaras: [{ num: 1, modelo: 'Sony FX6' }],
      microfonos: [{ canal: 1, talento: 'Presentador' }],
      luces: [{ id: 1, tipo: 'Panel LED' }],
      diagram: { nodes: [{ id: 'n1' }, { id: 'n2' }] }
    }
  });

  const result = project.accept(new TraceVisitor());
  assert.equal(result.length, 7);
  assert.deepEqual(result, [
    'info:Noticiero Estelar',
    'budget:150000',
    'rundown:2',
    'cameras:1',
    'audio:1',
    'lighting:1',
    'diagram:2'
  ]);
});

test('EdlExportVisitor: Genera lista CMX 3600 estándar con timecodes y metadatos de cámara', () => {
  const project = new ProductionProject({
    projectName: 'Mesa de Debate',
    cfg: {
      fps: 30,
      escaleta: [
        { bloque: 'Apertura y Saludo', dur: 60, cam: '1', audio: 'Lav 1' },
        { bloque: 'Debate Central', dur: 180, cam: '2' },
        { bloque: 'Conclusiones y Cierre', dur: 60, cam: '1' }
      ]
    }
  });

  const edl = project.accept(new EdlExportVisitor(30));
  assert.match(edl, /^TITLE: MESA_DE_DEBATE/m);
  assert.match(edl, /^FCM: NON-DROP FRAME/m);

  // Evento 1: 60 seg -> 00:00:00:00 a 00:01:00:00
  assert.match(edl, /001\s+AX\s+V\s+C\s+00:00:00:00 00:01:00:00 00:00:00:00 00:01:00:00/);
  assert.match(edl, /\* FROM CLIP NAME: APERTURA Y SALUDO/);
  assert.match(edl, /\* COMMENT: CAMARA 1/);

  // Evento 2: 180 seg -> 00:01:00:00 a 00:04:00:00
  assert.match(edl, /002\s+AX\s+V\s+C\s+00:00:00:00 00:03:00:00 00:01:00:00 00:04:00:00/);
  assert.match(edl, /\* FROM CLIP NAME: DEBATE CENTRAL/);
  assert.match(edl, /\* COMMENT: CAMARA 2/);

  // Evento 3: 60 seg -> 00:04:00:00 a 00:05:00:00
  assert.match(edl, /003\s+AX\s+V\s+C\s+00:00:00:00 00:01:00:00 00:04:00:00 00:05:00:00/);
});

test('CsvExportVisitor: Genera exportación tabular CSV con escaping seguro', () => {
  const project = new ProductionProject({
    projectName: 'Show "En Vivo"',
    cfg: {
      perfil: {
        presupuesto: 50000,
        genero: 'Entretenimiento',
        formato: 'Magazine'
      },
      escaleta: [
        { bloque: 'Bloque con "comillas"', dur: 45, cam: '1', notas: 'Entrada con música' }
      ],
      camaras: [
        { num: 1, modelo: 'Blackmagic URSA', lente: '24-70mm', operador: 'Carlos' }
      ],
      microfonos: [
        { canal: 1, tipo: 'Lavalier', talento: 'Host' }
      ]
    }
  });

  const csv = project.accept(new CsvExportVisitor());
  assert.match(csv, /# PROYECTO/);
  assert.match(csv, /# ESCALETA/);
  assert.match(csv, /"Bloque con ""comillas"""/);
  assert.match(csv, /# CAMARAS/);
  assert.match(csv, /"Blackmagic URSA"/);
  assert.match(csv, /# AUDIO/);
  assert.match(csv, /"Lavalier"/);
});

test('MarkdownExportVisitor: Genera reporte markdown técnico estructurado', () => {
  const project = new ProductionProject({
    projectName: 'Docuserie Historia',
    cfg: {
      titulo: 'Docuserie Historia',
      perfil: { presupuesto: 80000, genero: 'Documental' },
      escaleta: [
        { bloque: 'Prólogo', dur: 90, cam: 'A' },
        { bloque: 'Entrevista', dur: 210, cam: 'B' }
      ],
      camaras: [{ num: 1, modelo: 'FX3', operador: 'Lucía' }],
      microfonos: [{ canal: 1, talento: 'Historiador' }]
    }
  });

  const md = project.accept(new MarkdownExportVisitor());
  assert.match(md, /# Dossier Técnico de Producción: Docuserie Historia/);
  assert.match(md, /## 1\. Perfil y Presupuesto/);
  assert.match(md, /## 2\. Escaleta de Transmisión/);
  assert.match(md, /\| 1 \| Prólogo \| 90s \|/);
  assert.match(md, /\*\*Duración total estimada:\*\* 5m 0s \(300 segundos\)/);
  assert.match(md, /## 3\. Despliegue de Cámaras/);
  assert.match(md, /\*\*Cámara 1:\*\* FX3/);
});

test('GoF Composite Pattern: DossierComposite y SectionComposite agregan y calculan páginas jerárquicamente', () => {
  const dossier = new DossierComposite();
  
  const secSets = new SectionComposite('sets', 'Sets', true);
  secSets.addChild(new PageLeaf('set-a', '<div>Set A</div>'));
  secSets.addChild(new PageLeaf('set-b', '<div>Set B</div>'));
  
  const secGuion = new SectionComposite('guion', 'Guion', false); // Desactivada
  secGuion.addChild(new PageLeaf('guion-p1', '<div>Guion 1</div>'));
  
  const secEscaleta = new SectionComposite('escaleta', 'Escaleta', true);
  secEscaleta.addChild(new PageLeaf('escaleta-p1', '<div>Escaleta</div>'));

  dossier.addSection(secSets);
  dossier.addSection(secGuion);
  dossier.addSection(secEscaleta);

  assert.equal(dossier.getPageCount(), 3);
  const pages = dossier.getPages();
  assert.equal(pages.length, 3);
  assert.equal(pages[0].name, 'set-a');
  assert.equal(pages[1].name, 'set-b');
  assert.equal(pages[2].name, 'escaleta-p1');

  // Reactivar sección Guion
  secGuion.on = true;
  assert.equal(dossier.getPageCount(), 4);
});

test('GoF Strategy Pattern: ExportStrategyManager despacha hacia la estrategia seleccionada', () => {
  const manager = new ExportStrategyManager();
  
  assert.equal(manager.getCurrent().getLabel(5), 'Exportar Dossier PDF (5 págs)');

  let executed = null;
  const dummyContext = {
    printDocument() { executed = 'pdf'; },
    exportEdl() { executed = 'edl'; },
    exportCsv() { executed = 'csv'; },
    exportPng() { executed = 'png'; },
    exportPtv() { executed = 'ptv'; }
  };

  manager.execute(dummyContext);
  assert.equal(executed, 'pdf');

  manager.setFormat('edl');
  assert.equal(manager.getCurrent().getLabel(), 'Exportar EDL CMX 3600');
  manager.execute(dummyContext);
  assert.equal(executed, 'edl');

  manager.setFormat('csv');
  manager.execute(dummyContext);
  assert.equal(executed, 'csv');

  manager.setFormat('png');
  assert.equal(manager.getCurrent().getLabel(3), 'Exportar 3 Imágenes PNG');
  manager.execute(dummyContext);
  assert.equal(executed, 'png');

  manager.setFormat('proyecto');
  manager.execute(dummyContext);
  assert.equal(executed, 'ptv');
});

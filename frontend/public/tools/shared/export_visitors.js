/**
 * export_visitors.js (Navegador / UMD / IIFE)
 * GoF Visitor Pattern para Exportación de Proyectos TV
 */
(() => {
  'use strict';

  class ProjectInfoElement {
    constructor(info = {}) {
      this.name = info.name || info.projectName || info.titulo || 'Proyecto Sin Título';
      this.titulo = info.titulo || this.name;
      this.descripcion = info.descripcion || '';
      this.fps = info.fps || 30;
      this.creador = info.creador || '';
      this.fecha = info.fecha || new Date().toISOString().slice(0, 10);
    }
    accept(visitor) { return visitor.visitProjectInfo(this); }
  }

  class BudgetElement {
    constructor(perfil = {}) {
      this.perfil = perfil;
      this.presupuesto = perfil.presupuesto || 0;
      this.reparto = perfil.reparto || {};
      this.genero = perfil.genero || '';
      this.formato = perfil.formato || '';
      this.emisor = perfil.emisor || '';
      this.receptor = perfil.receptor || '';
    }
    accept(visitor) { return visitor.visitBudget(this); }
  }

  class RundownElement {
    constructor(escaleta = []) {
      this.items = Array.isArray(escaleta) ? escaleta : [];
    }
    accept(visitor) { return visitor.visitRundown(this); }
  }

  class CamerasElement {
    constructor(camaras = []) {
      this.items = Array.isArray(camaras) ? camaras : [];
    }
    accept(visitor) { return visitor.visitCameras(this); }
  }

  class AudioElement {
    constructor(microfonos = []) {
      this.items = Array.isArray(microfonos) ? microfonos : [];
    }
    accept(visitor) { return visitor.visitAudio(this); }
  }

  class LightingElement {
    constructor(iluminacion = []) {
      this.items = Array.isArray(iluminacion) ? iluminacion : [];
    }
    accept(visitor) { return visitor.visitLighting(this); }
  }

  class DiagramElement {
    constructor(diagram = {}) {
      this.nodes = diagram?.nodes || [];
      this.edges = diagram?.edges || [];
      this.zones = diagram?.zones || [];
    }
    accept(visitor) { return visitor.visitDiagram(this); }
  }

  class ProductionProject {
    constructor(data = {}) {
      const cfg = data.cfg || data.infographic || data;
      const diagramData = data.diagram || cfg.diagram || {};

      this.projectInfo = new ProjectInfoElement({
        name: data.projectName || cfg.titulo || 'Proyecto TV',
        titulo: cfg.titulo,
        fps: cfg.fps || 30,
        descripcion: cfg.descripcion,
      });

      this.budget = new BudgetElement(cfg.perfil || {});
      this.rundown = new RundownElement(cfg.escaleta || []);
      this.cameras = new CamerasElement(cfg.camaras || []);
      this.audio = new AudioElement(cfg.microfonos || []);
      this.lighting = new LightingElement(cfg.luces || cfg.iluminacion || []);
      this.diagram = new DiagramElement(diagramData);
    }

    accept(visitor) {
      this.projectInfo.accept(visitor);
      this.budget.accept(visitor);
      this.rundown.accept(visitor);
      this.cameras.accept(visitor);
      this.audio.accept(visitor);
      this.lighting.accept(visitor);
      this.diagram.accept(visitor);
      return visitor.getResult();
    }
  }

  class ProjectVisitor {
    visitProjectInfo(element) {}
    visitBudget(element) {}
    visitRundown(element) {}
    visitCameras(element) {}
    visitAudio(element) {}
    visitLighting(element) {}
    visitDiagram(element) {}
    getResult() { return null; }
  }

  class EdlExportVisitor extends ProjectVisitor {
    constructor(fps = 30) {
      super();
      this.fps = Math.round(fps) || 30;
      this.lines = [];
      this.currentTimeSeconds = 0;
    }

    _formatTimecode(totalSeconds) {
      const s = Math.max(0, Math.floor(totalSeconds));
      const hours = Math.floor(s / 3600);
      const minutes = Math.floor((s % 3600) / 60);
      const seconds = s % 60;
      const frames = Math.floor((totalSeconds - s) * this.fps);

      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
    }

    visitProjectInfo(element) {
      const title = (element.name || 'PRODUCCION_TV').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      this.lines.push(`TITLE: ${title}`);
      this.lines.push('FCM: NON-DROP FRAME');
      this.lines.push('');
    }

    visitRundown(element) {
      let eventIndex = 1;
      let timelineSeconds = 0;

      element.items.forEach((item) => {
        const dur = Number(item.dur) || 10;
        const srcIn = '00:00:00:00';
        const srcOut = this._formatTimecode(dur);
        const recIn = this._formatTimecode(timelineSeconds);
        const recOut = this._formatTimecode(timelineSeconds + dur);

        const numStr = String(eventIndex).padStart(3, '0');
        this.lines.push(`${numStr}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);

        const clipName = (item.bloque || item.titulo || `BLOQUE_${eventIndex}`).toUpperCase();
        this.lines.push(`* FROM CLIP NAME: ${clipName}`);
        if (item.cam) {
          this.lines.push(`* COMMENT: CAMARA ${item.cam}`);
        }
        if (item.audio) {
          this.lines.push(`* COMMENT: AUDIO ${item.audio}`);
        }
        this.lines.push('');

        timelineSeconds += dur;
        eventIndex++;
      });

      this.currentTimeSeconds = timelineSeconds;
    }

    getResult() {
      return this.lines.join('\r\n');
    }
  }

  class CsvExportVisitor extends ProjectVisitor {
    constructor() {
      super();
      this.sections = [];
      this.currentProjectName = '';
    }

    _escapeCsv(str) {
      if (str == null) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    }

    visitProjectInfo(element) {
      this.currentProjectName = element.name;
      this.sections.push([
        '# PROYECTO',
        `Nombre: ${element.name}`,
        `Fecha: ${element.fecha}`,
        ''
      ].join('\n'));
    }

    visitBudget(element) {
      const p = element.perfil || {};
      const rows = [
        ['SECCION', 'PRESUPUESTO Y PERFIL'].map(this._escapeCsv).join(','),
        ['Presupuesto Total', p.presupuesto || 0].map(this._escapeCsv).join(','),
        ['Género', p.genero || ''].map(this._escapeCsv).join(','),
        ['Formato', p.formato || ''].map(this._escapeCsv).join(','),
        ['Emisor', p.emisor || ''].map(this._escapeCsv).join(','),
        ['Receptor', p.receptor || ''].map(this._escapeCsv).join(','),
        ['Alcance', p.alcance || ''].map(this._escapeCsv).join(','),
      ];
      this.sections.push(rows.join('\n') + '\n');
    }

    visitRundown(element) {
      const headers = ['Paso', 'Bloque / Segmento', 'Duracion (s)', 'Camara', 'Audio', 'Notas'];
      const rows = [headers.map(this._escapeCsv).join(',')];

      element.items.forEach((item, index) => {
        rows.push([
          index + 1,
          item.bloque || item.titulo || '',
          item.dur || 0,
          item.cam || '',
          item.audio || '',
          item.notas || ''
        ].map(this._escapeCsv).join(','));
      });

      this.sections.push('# ESCALETA\n' + rows.join('\n') + '\n');
    }

    visitCameras(element) {
      if (!element.items.length) return;
      const headers = ['Camara', 'Tipo / Modelo', 'Lente', 'Operador', 'Posicion'];
      const rows = [headers.map(this._escapeCsv).join(',')];

      element.items.forEach((cam, i) => {
        rows.push([
          cam.num || (i + 1),
          cam.modelo || cam.tipo || '',
          cam.lente || '',
          cam.operador || '',
          cam.posicion || ''
        ].map(this._escapeCsv).join(','));
      });

      this.sections.push('# CAMARAS\n' + rows.join('\n') + '\n');
    }

    visitAudio(element) {
      if (!element.items.length) return;
      const headers = ['Canal', 'Tipo', 'Talento / Asignacion', 'Frecuencia / Cable'];
      const rows = [headers.map(this._escapeCsv).join(',')];

      element.items.forEach((mic, i) => {
        rows.push([
          mic.canal || (i + 1),
          mic.tipo || '',
          mic.talento || mic.asignacion || '',
          mic.frecuencia || mic.cable || ''
        ].map(this._escapeCsv).join(','));
      });

      this.sections.push('# AUDIO\n' + rows.join('\n') + '\n');
    }

    getResult() {
      return this.sections.join('\n');
    }
  }

  class MarkdownExportVisitor extends ProjectVisitor {
    constructor() {
      super();
      this.md = [];
    }

    visitProjectInfo(element) {
      this.md.push(`# Dossier Técnico de Producción: ${element.name}`);
      this.md.push(`*Fecha: ${element.fecha} | Velocidad base: ${element.fps} fps*\n`);
    }

    visitBudget(element) {
      const p = element.perfil;
      if (!p || Object.keys(p).length === 0) return;
      this.md.push(`## 1. Perfil y Presupuesto`);
      this.md.push(`- **Presupuesto:** $${Number(p.presupuesto || 0).toLocaleString()} MXN`);
      this.md.push(`- **Formato / Género:** ${p.formato || '—'} / ${p.genero || '—'}`);
      this.md.push(`- **Emisor:** ${p.emisor || '—'} | **Receptor:** ${p.receptor || '—'}\n`);
    }

    visitRundown(element) {
      this.md.push(`## 2. Escaleta de Transmisión`);
      this.md.push(`| # | Segmento | Duración | Cámara | Audio |`);
      this.md.push(`|---|---|---|---|---|`);
      let totalDur = 0;
      element.items.forEach((item, i) => {
        const dur = Number(item.dur) || 0;
        totalDur += dur;
        this.md.push(`| ${i + 1} | ${item.bloque || '—'} | ${dur}s | ${item.cam || '—'} | ${item.audio || '—'} |`);
      });
      this.md.push(`\n**Duración total estimada:** ${Math.floor(totalDur / 60)}m ${totalDur % 60}s (${totalDur} segundos)\n`);
    }

    visitCameras(element) {
      if (!element.items.length) return;
      this.md.push(`## 3. Despliegue de Cámaras`);
      element.items.forEach((c, idx) => {
        this.md.push(`- **Cámara ${c.num || idx + 1}:** ${c.modelo || c.tipo || 'General'} | Lente: ${c.lente || '—'} | Operador: ${c.operador || '—'}`);
      });
      this.md.push('');
    }

    visitAudio(element) {
      if (!element.items.length) return;
      this.md.push(`## 4. Asignación de Microfonía`);
      element.items.forEach((m, idx) => {
        this.md.push(`- **Canal ${m.canal || idx + 1}:** ${m.tipo || 'Micrófono'} → ${m.talento || 'Mesa'}`);
      });
      this.md.push('');
    }

    visitDiagram(element) {
      if (!element.nodes.length) return;
      this.md.push(`## 5. Arquitectura Técnica de Señal`);
      this.md.push(`- **Nodos totales:** ${element.nodes.length}`);
      this.md.push(`- **Conexiones de cableado (Edges):** ${element.edges.length}`);
      this.md.push('');
    }

    getResult() {
      return this.md.join('\n');
    }
  }

  // GoF Composite
  class DossierNode {
    getPages() { return []; }
    getPageCount() { return this.getPages().length; }
  }

  class PageLeaf extends DossierNode {
    constructor(name, html = '', fillable = false) {
      super();
      this.name = name;
      this.html = html;
      this.fillable = fillable;
    }
    getPages() { return [{ name: this.name, html: this.html, fillable: this.fillable }]; }
  }

  class SectionComposite extends DossierNode {
    constructor(id, label, on = true) {
      super();
      this.id = id;
      this.label = label;
      this.on = on;
      this.children = [];
    }
    addChild(child) { this.children.push(child); return this; }
    getPages() {
      if (!this.on) return [];
      return this.children.flatMap((c) => c.getPages());
    }
  }

  class DossierComposite extends DossierNode {
    constructor() {
      super();
      this.sections = [];
    }
    addSection(section) { this.sections.push(section); return this; }
    getPages() { return this.sections.flatMap((s) => s.getPages()); }
  }

  // GoF Strategy
  class ExportStrategy {
    getLabel(pageCount) { return 'Exportar'; }
    execute(ctx) {}
  }

  class PdfExportStrategy extends ExportStrategy {
    getLabel(n) { return `Exportar Dossier PDF (${n} pág${n === 1 ? '' : 's'})`; }
    execute(ctx) { ctx.printDocument?.(); }
  }

  class EdlExportStrategy extends ExportStrategy {
    getLabel() { return 'Exportar EDL CMX 3600'; }
    execute(ctx) { ctx.exportEdl?.(); }
  }

  class CsvExportStrategy extends ExportStrategy {
    getLabel() { return 'Exportar Tablas CSV'; }
    execute(ctx) { ctx.exportCsv?.(); }
  }

  class PngExportStrategy extends ExportStrategy {
    getLabel(n) { return n === 1 ? 'Exportar 1 Imagen PNG' : `Exportar ${n} Imágenes PNG`; }
    execute(ctx) { ctx.exportPng?.(); }
  }

  class PtvExportStrategy extends ExportStrategy {
    getLabel() { return 'Exportar Proyecto (.ptv)'; }
    execute(ctx) { ctx.exportPtv?.(); }
  }

  class ExportStrategyManager {
    constructor() {
      this.strategies = {
        pdf: new PdfExportStrategy(),
        edl: new EdlExportStrategy(),
        csv: new CsvExportStrategy(),
        png: new PngExportStrategy(),
        proyecto: new PtvExportStrategy(),
      };
      this.currentType = 'pdf';
    }
    setFormat(type) {
      if (this.strategies[type]) this.currentType = type;
    }
    getCurrent() {
      return this.strategies[this.currentType] || this.strategies.pdf;
    }
    execute(ctx) {
      return this.getCurrent().execute(ctx);
    }
  }

  window.PTVVisitors = {
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
    DossierNode,
    PageLeaf,
    SectionComposite,
    DossierComposite,
    ExportStrategy,
    PdfExportStrategy,
    EdlExportStrategy,
    CsvExportStrategy,
    PngExportStrategy,
    PtvExportStrategy,
    ExportStrategyManager,
  };
})();

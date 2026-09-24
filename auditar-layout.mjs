#!/usr/bin/env node

/* Banco reproducible para medir la interfaz real servida desde frontend/dist.
   No forma parte de la aplicación: deja sus JSON y capturas fuera del repo. */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PTV_PLAYWRIGHT
  || '/private/tmp/claude-501/-Users-aldomaster666/c175b2a4-d865-4e2a-a46b-5a035a46a804/scratchpad/pw/node_modules/playwright';
const { chromium } = require(playwrightPath);

const repo = path.resolve(process.argv[2] || '.');
const dist = path.resolve(process.env.PTV_DIST || path.join(repo, 'frontend', 'dist'));
const outDir = path.resolve(process.env.OUT || '/private/tmp/ptv-audit');
const mode = process.env.AUDIT_MODE || 'compact';
const safeArea = {
  top: Number(process.env.SAFE_TOP || 0),
  right: Number(process.env.SAFE_RIGHT || 0),
  bottom: Number(process.env.SAFE_BOTTOM || 0),
  left: Number(process.env.SAFE_LEFT || 0),
  legacyBodyPadding: process.env.SAFE_LEGACY === '1',
};
const auditNow = process.env.AUDIT_NOW ? Number(process.env.AUDIT_NOW) : null;
const liveProject = process.env.PTV_LIVE
  || path.join(process.env.HOME, 'Documents/ProduccionTV/project-mtf1u2jv-966xe.ptv');
const narrativeProject = process.env.PTV_NARRATIVE
  || path.join(process.env.HOME, 'Documents/ProduccionTV/project-mtdno9bk-idliz.ptv');
const projectFiles = fs.readdirSync(path.dirname(liveProject))
  .filter((name) => /^project-m.*\.ptv$/.test(name))
  .map((name) => path.join(path.dirname(liveProject), name));

fs.mkdirSync(outDir, { recursive: true });

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

/* El sandbox de automatización de macOS bloquea el puerto Mach que Chromium
   usa entre procesos. single-process conserva el mismo motor de layout y hace
   el banco ejecutable sin pedir privilegios fuera del repositorio. */
const browsers = new Set();
const pageBrowsers = new WeakMap();
async function launchAuditBrowser() {
  const browser = await chromium.launch({
    chromiumSandbox: false,
    args: [
      '--no-sandbox', '--single-process', '--no-zygote', '--disable-gpu',
      '--disable-breakpad', '--disable-crash-reporter', '--disable-crashpad',
    ],
  });
  browsers.add(browser);
  return browser;
}

async function closeSurface(page) {
  const browser = pageBrowsers.get(page);
  if (!browser) return;
  browsers.delete(browser);
  await browser.close();
}

const bridge = fs.readFileSync(path.join(repo, 'ios/ProduccionTV/Recursos/puente-ios.js'), 'utf8');
const ipad = (process.env.PTV_BASELINE_COMMIT
  ? execFileSync('git', [
      'show', `${process.env.PTV_BASELINE_COMMIT}:ios/ProduccionTV/Recursos/adaptacion-ipad.js`,
    ], { cwd: repo, encoding: 'utf8' })
  : fs.readFileSync(path.join(repo, 'ios/ProduccionTV/Recursos/adaptacion-ipad.js'), 'utf8'))
  .replace(/\u2028/g, '');

function bundleInfo(file) {
  const text = fs.readFileSync(file, 'utf8');
  const bundle = JSON.parse(text);
  return { text, bundle, project: bundle.project || bundle };
}

async function makePage(width, height, projectFile = null) {
  /* single-process admite una superficie estable por proceso. Separar Inicio,
     proyecto vivo y narrativo evita que un cierre derribe al siguiente caso. */
  const browser = await launchAuditBrowser();
  const page = await browser.newPage({
    viewport: { width, height }, hasTouch: true, isMobile: width < 768, deviceScaleFactor: width < 768 ? 3 : 1,
    colorScheme: 'dark',
  });
  await page.route('http://ptv.local/**', async (route) => {
    const url = new URL(route.request().url());
    let requestPath = decodeURIComponent(url.pathname);
    if (requestPath.endsWith('/')) requestPath += 'index.html';
    const file = path.join(dist, requestPath);
    try {
      await route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
    } catch {
      if (process.env.DEBUG_AUDIT) console.error('404', file);
      await route.fulfill({ status: 404, body: '' });
    }
  });
  const bundles = projectFiles.map((file) => fs.readFileSync(file, 'utf8'));
  let context = { mode: 'launcher' };
  let currentText = '';
  if (projectFile) {
    const info = bundleInfo(projectFile);
    currentText = info.text;
    context = { mode: 'project', projectID: info.project.id, projectJSON: info.text };
  }
  await page.addInitScript({ content: `
    if (${JSON.stringify(auditNow)} !== null) {
      const FechaReal = Date;
      const instanteAuditoria = ${JSON.stringify(auditNow)};
      window.Date = class extends FechaReal {
        constructor(...args) { super(...(args.length ? args : [instanteAuditoria])); }
        static now() { return instanteAuditoria; }
      };
    }
    window.__ctx=${JSON.stringify(context)};
    window.__archivos=${JSON.stringify(bundles)};
    window.__proyectoActual=${JSON.stringify(currentText)};
    window.__ptvAuditSafeArea=${JSON.stringify(safeArea)};
    const aplicarSafeAreaDeAuditoria = () => {
      const a = window.__ptvAuditSafeArea;
      for (const [lado, valor] of Object.entries(a)) {
        if (lado === 'legacyBodyPadding') continue;
        document.documentElement.style.setProperty('--ptv-safe-' + lado, valor + 'px');
      }
      /* Reproduce el contrato anterior: el documento exterior perdía esos
         puntos porque el relleno estaba fuera del shell. */
      if (a.legacyBodyPadding && window.top === window) {
        document.body.style.setProperty('padding-top', a.top + 'px', 'important');
        document.body.style.setProperty('padding-right', a.right + 'px', 'important');
        document.body.style.setProperty('padding-bottom', a.bottom + 'px', 'important');
        document.body.style.setProperty('padding-left', a.left + 'px', 'important');
      }
    };
    if (document.documentElement && document.body) aplicarSafeAreaDeAuditoria();
    else document.addEventListener('DOMContentLoaded', aplicarSafeAreaDeAuditoria, { once: true });
  ` });
  await page.addInitScript({ content: `
    window.webkit={messageHandlers:{producciontv:{postMessage:(m)=>{
      if(m.fn==='GetLaunchContext') return Promise.resolve(window.__ctx);
      if(m.fn==='LoadAllProjects') return Promise.resolve(window.__archivos||[]);
      if(m.fn==='LoadProjectFile') return Promise.resolve(window.__proyectoActual||null);
      if(m.fn==='ListProjects'||m.fn==='ListTemplates'||m.fn==='ListOpenProjects'||m.fn==='ListOpenTools') return Promise.resolve([]);
      if(m.fn==='ClaimProject') return Promise.resolve(true);
      return Promise.resolve(null);
    }}}};
    ${bridge}
    localStorage.setItem('producciontv:desktop:welcome-seen','1');
    localStorage.setItem('producciontv:desktop:tour-hecho','1');
  ` });
  await page.addInitScript({ content: `document.addEventListener('DOMContentLoaded',()=>{${ipad}})` });
  page.on('pageerror', (error) => console.error('PAGEERROR', width, height, error.message));
  page.on('console', (message) => {
    if (process.env.DEBUG_AUDIT && ['error', 'warning'].includes(message.type())) {
      console.error('CONSOLE', width, height, message.type(), message.text());
    }
  });
  await page.goto('http://ptv.local/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.layout);
  await page.evaluate(() => document.fonts?.ready);
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}' });
  if (projectFile) await page.waitForSelector('.desktop-shell.project-window');
  else await page.waitForSelector('.desktop-shell.launcher-window');
  if (!projectFile) {
    await page.evaluate(() => document.querySelector('.np-cancel-btn')?.click());
  }
  if (projectFile) {
    await page.waitForFunction(() => {
      const panel = document.querySelector('#tool-frame');
      return !panel || panel.hidden || !panel.classList.contains('cargando');
    }, { timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
  pageBrowsers.set(page, browser);
  return page;
}

async function auditFrame(frame, documentName) {
  return frame.evaluate((name) => {
    const visible = (element) => {
      if (!(element instanceof Element) || element.closest('[hidden],details:not([open])')) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0
        && rect.width > 0.5 && rect.height > 0.5;
    };
    /* Los rangos de texto ignoran el recorte de sus ancestros. Intersectarlos
       con cada zona scrollable evita denunciar texto que existe debajo del
       pliegue, pero que todavía no está pintado en pantalla. */
    const visibleRect = (source, owner) => {
      let left = Math.max(0, source.left);
      let top = Math.max(0, source.top);
      let right = Math.min(document.documentElement.clientWidth, source.right);
      let bottom = Math.min(document.documentElement.clientHeight, source.bottom);
      for (let parent = owner.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const box = parent.getBoundingClientRect();
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) {
          left = Math.max(left, box.left);
          right = Math.min(right, box.right);
        }
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) {
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
        }
      }
      return right - left > 1 && bottom - top > 1
        ? { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top }
        : null;
    };
    const activeLayer = [
      ...document.querySelectorAll('[aria-modal="true"],.help-card.show,.checks.open'),
    ].filter(visible).sort((a, b) => Number(getComputedStyle(a).zIndex || 0) - Number(getComputedStyle(b).zIndex || 0)).at(-1);
    const inActiveLayer = (element) => !activeLayer || activeLayer.contains(element);
    const text = (element) => String(
      element.getAttribute('aria-label') || element.getAttribute('title')
      || element.getAttribute('placeholder') || element.textContent || '',
    ).replace(/\s+/g, ' ').trim().slice(0, 90);
    const describe = (element) => {
      const id = element.id ? `#${element.id}` : '';
      const classes = [...element.classList].slice(0, 3).map((item) => `.${item}`).join('');
      const role = element.getAttribute('role') ? `[role=${element.getAttribute('role')}]` : '';
      return `${element.tagName.toLowerCase()}${id}${classes}${role}${text(element) ? ` “${text(element)}”` : ''}`;
    };
    const roundRect = (rect) => ({
      x: Math.round(rect.x * 10) / 10, y: Math.round(rect.y * 10) / 10,
      width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10,
    });

    const interactiveSelector = [
      'button', 'a[href]', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
      '[role=button]', '[role=tab]', '[role=menuitem]', '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const interactive = [...new Set([...document.querySelectorAll(interactiveSelector)])]
      .filter((element) => visible(element) && inActiveLayer(element) && !element.matches(':disabled'));
    const touchSmall = interactive.flatMap((element) => {
      let target = element;
      const label = element.closest('label');
      if (label && visible(label)) {
        const own = element.getBoundingClientRect();
        const parent = label.getBoundingClientRect();
        if (parent.width * parent.height > own.width * own.height) target = label;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width >= 43.5 && rect.height >= 43.5) return [];
      return [{ element: describe(element), target: target === element ? null : describe(target), rect: roundRect(rect) }];
    });

    const textElements = [...document.querySelectorAll('body *')].filter((element) => {
      if (!visible(element) || !inActiveLayer(element) || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(element.tagName)) return false;
      /* El texto de un SVG no usa clientWidth/clientHeight como una caja HTML.
         Medirlo aquí lo marca como recortado aunque sea plenamente visible. */
      if (element.closest('svg')) return false;
      return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    });
    const clippedText = textElements.flatMap((element) => {
      const horizontal = element.scrollWidth > element.clientWidth + 1;
      const vertical = element.scrollHeight > element.clientHeight + 1;
      if (!horizontal && !vertical) return [];
      const style = getComputedStyle(element);
      return [{
        element: describe(element), horizontal, vertical,
        client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight],
        overflow: [style.overflowX, style.overflowY],
      }];
    });

    const runs = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.textContent.replace(/\s+/g, ' ').trim();
      const owner = node.parentElement;
      if (!value || !owner || !visible(owner) || !inActiveLayer(owner) || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(owner.tagName)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const painted = visibleRect(rect, owner);
        if (painted) runs.push({ owner, value: value.slice(0, 64), rect: painted });
      }
    }
    const overlaps = [];
    const seen = new Set();
    for (let i = 0; i < runs.length; i += 1) {
      const a = runs[i];
      for (let j = i + 1; j < runs.length; j += 1) {
        const b = runs[j];
        if (a.owner === b.owner || a.owner.contains(b.owner) || b.owner.contains(a.owner)) continue;
        const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (width <= 1 || height <= 1 || width * height < 4) continue;
        const key = [describe(a.owner), describe(b.owner)].sort().join(' <> ');
        if (seen.has(key)) continue;
        seen.add(key);
        overlaps.push({ first: describe(a.owner), second: describe(b.owner), intersection: roundRect({ x: 0, y: 0, width, height }) });
      }
    }

    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = root.clientWidth;
    const overflowWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0) - viewportWidth;
    const horizontalOffenders = [...document.querySelectorAll('body *')].flatMap((element) => {
      if (!visible(element) || ['SCRIPT', 'STYLE'].includes(element.tagName)) return [];
      const rect = element.getBoundingClientRect();
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) return [];
      const style = getComputedStyle(element);
      if (style.position === 'fixed') return [];
      return [{ element: describe(element), rect: roundRect(rect) }];
    }).slice(0, 60);

    return {
      document: name,
      viewport: [root.clientWidth, root.clientHeight],
      layout: root.dataset.layout || body?.dataset.layout || '',
      bodyPaddingBottom: body ? getComputedStyle(body).paddingBottom : '',
      safeAreaBottom: getComputedStyle(root).getPropertyValue('--ptv-safe-bottom').trim(),
      interactive: interactive.length,
      touchSmall,
      clippedText,
      overlaps,
      horizontalOverflow: Math.max(0, Math.round(overflowWidth * 10) / 10),
      horizontalOffenders,
    };
  }, documentName);
}

async function auditScreen(page, label, screenshot = false) {
  await page.waitForTimeout(350);
  const geometry = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element || element.hidden || getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
    };
    const style = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    return {
      bodyPadding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
      safeArea: ['top', 'right', 'bottom', 'left'].map((lado) => root.getPropertyValue(`--ptv-safe-${lado}`).trim()),
      header: box('#workspace-header'), logo: box('#logo-btn'), content: box('#frame-wrap'),
    };
  });
  const documents = [await auditFrame(page.mainFrame(), 'shell')];
  for (const frame of page.frames().filter((item) => item !== page.mainFrame())) {
    try {
      const element = await frame.frameElement();
      const shown = await element.evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
      });
      if (shown) documents.push(await auditFrame(frame, `iframe:${path.basename(new URL(frame.url()).pathname)}`));
    } catch { /* el iframe cambió de documento mientras se medía */ }
  }
  if (screenshot) await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: false });
  const totals = documents.reduce((sum, document) => ({
    interactive: sum.interactive + document.interactive,
    touchSmall: sum.touchSmall + document.touchSmall.length,
    clippedText: sum.clippedText + document.clippedText.length,
    overlaps: sum.overlaps + document.overlaps.length,
    horizontalOverflowDocuments: sum.horizontalOverflowDocuments + (document.horizontalOverflow > 0 ? 1 : 0),
  }), { interactive: 0, touchSmall: 0, clippedText: 0, overlaps: 0, horizontalOverflowDocuments: 0 });
  return { label, totals, geometry, documents };
}

async function selectProjectView(page, stage, section) {
  await page.evaluate(({ stageId }) => document.querySelector(`[data-etapa="${stageId}"]`)?.click(), { stageId: stage });
  await page.waitForTimeout(250);
  if (section) {
    await page.waitForFunction((sectionId) => document.querySelector(`[data-seccion="${sectionId}"]`) || document.querySelector('#tool-frame')?.src.includes(`modo=${sectionId}`), section);
    await page.evaluate((sectionId) => document.querySelector(`[data-seccion="${sectionId}"]`)?.click(), section);
  }
  await page.waitForTimeout(700);
  await page.waitForFunction(() => {
    const panel = document.querySelector('#tool-frame');
    return !panel || panel.hidden || !panel.classList.contains('cargando');
  }, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        document.fonts?.ready;
        /* La primera visita enseña ayudas modales. Se comprueban por separado
           visualmente; para medir el módulo hay que cerrar esa capa y recorrer
           sus controles, no contar el texto inaccesible que queda detrás. */
        const cerrar = [...document.querySelectorAll('button')].find((button) => {
          const label = button.textContent.replace(/\s+/g, ' ').trim();
          return button.offsetParent && (label === 'Entendido' || label === 'Entendido, a cablear');
        });
        cerrar?.click();
      });
    } catch { /* navegación intermedia */ }
  }
  await page.waitForTimeout(120);
}

async function compactAudit() {
  const sizes = [[402, 874], [375, 667]];
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  const liveViews = [
    ['perfil', 'perfil', null], ['referencias', 'perfil', 'referencias'],
    ['escaleta', 'guion', null], ['tiempos', 'guion', 'tiempos'],
    ['necesidades', 'necesidades', null], ['agenda', 'necesidades', 'agenda'],
    ['diagrama', 'necesidades', 'diagrama'], ['set', 'planeacion', null],
    ['infografias', 'planeacion', 'infografias'], ['exportar', 'salida', null],
    ['ensayo', 'ensayo', null],
  ];
  for (const [width, height] of sizes) {
    const suffix = `${width}x${height}`;
    const launcher = await makePage(width, height);
    report.screens.push(await auditScreen(launcher, `${suffix}-inicio`, true));
    await launcher.evaluate(() => document.querySelector('[data-accion="plantillas"]')?.click());
    await launcher.waitForTimeout(400);
    report.screens.push(await auditScreen(launcher, `${suffix}-plantillas`, true));
    await closeSurface(launcher);

    const live = await makePage(width, height, liveProject);
    for (const [label, stage, section] of liveViews) {
      await selectProjectView(live, stage, section);
      report.screens.push(await auditScreen(live, `${suffix}-${label}`, true));
    }
    await closeSurface(live);

    const narrative = await makePage(width, height, narrativeProject);
    await selectProjectView(narrative, 'guion', 'guionLiterario');
    report.screens.push(await auditScreen(narrative, `${suffix}-guion-literario`, true));
    await closeSurface(narrative);
  }
  return report;
}

async function visualAudit() {
  const sizes = [[1440, 900], [820, 1180], [1180, 820]];
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  for (const [width, height] of sizes) {
    const suffix = `${width}x${height}`;
    const launcher = await makePage(width, height);
    report.screens.push(await auditScreen(launcher, `${suffix}-inicio`, true));
    await closeSurface(launcher);
    const project = await makePage(width, height, liveProject);
    await selectProjectView(project, 'perfil', null);
    report.screens.push(await auditScreen(project, `${suffix}-perfil`, true));
    await closeSurface(project);
  }
  return report;
}

async function reviewAudit() {
  const report = { generatedAt: new Date().toISOString(), mode, checks: {} };

  const launcher = await makePage(402, 874);
  await launcher.evaluate(() => document.querySelector('#compact-actions-btn')?.click());
  report.checks.homeSheetActions = await launcher.locator('.compact-sheet-list button:not([hidden]) span')
    .allTextContents();
  await launcher.evaluate(() => document.querySelector('#compact-actions-close')?.click());

  await launcher.locator('#logo-btn').click();
  await launcher.locator('#rail-ajustes-btn').click();
  await launcher.locator('.menu-ajustes [data-accion="configuracion"]').click();
  await launcher.keyboard.press('Escape');
  report.checks.escapePrecedence = await launcher.evaluate(() => ({
    settingsClosed: !!document.querySelector('.aj-overlay')?.hidden,
    railRemainsOpen: !document.querySelector('#app-shell')?.classList.contains('rail-plegado'),
  }));
  await closeSurface(launcher);

  const restoration = await makePage(820, 900);
  await restoration.evaluate(() => {
    document.querySelector('#view-list-btn')?.click();
    document.querySelector('#tpl-view-list-btn')?.click();
  });
  await restoration.setViewportSize({ width: 402, height: 874 });
  await restoration.waitForTimeout(250);
  await restoration.setViewportSize({ width: 820, height: 900 });
  await restoration.waitForTimeout(250);
  report.checks.restoredViewIndicators = await restoration.evaluate(() => ({
    projectsGrid: document.querySelector('#view-grid-btn')?.classList.contains('active'),
    projectsList: document.querySelector('#view-list-btn')?.classList.contains('active'),
    templatesGrid: document.querySelector('#tpl-view-grid-btn')?.classList.contains('active'),
    templatesList: document.querySelector('#tpl-view-list-btn')?.classList.contains('active'),
  }));
  await closeSurface(restoration);

  const project = await makePage(402, 874, narrativeProject);
  await selectProjectView(project, 'guion', 'guionLiterario');
  await project.locator('#compact-actions-btn').click({ force: true });
  report.checks.projectSheetActions = await project.locator('.compact-sheet-list button:not([hidden]) span')
    .allTextContents();
  await closeSurface(project);

  return report;
}

async function focusedGuionAudit() {
  const width = Number(process.env.FOCUS_W || 402);
  const height = Number(process.env.FOCUS_H || 874);
  const report = { generatedAt: new Date().toISOString(), mode, safeArea, screens: [] };
  const page = await makePage(width, height, narrativeProject);
  await selectProjectView(page, 'guion', 'guionLiterario');
  const tool = page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/infografias/'));
  let typeInteraction = null;
  if (tool) {
    await tool.locator('textarea').first().focus();
    await tool.evaluate(() => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const alto = Math.max(260, viewport.height - 300);
      try {
        Object.defineProperty(viewport, 'height', { configurable: true, get: () => alto });
        Object.defineProperty(viewport, 'offsetTop', { configurable: true, get: () => 0 });
      } catch { /* WebKit/Chromium puede no permitir redefinir el objeto nativo. */ }
      viewport.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(200);
    const personButton = tool.locator('.guion-tipos-scroll button').filter({ hasText: 'Personaje' });
    if (await personButton.count()) {
      const focusedBefore = await tool.evaluate(() => document.activeElement?.tagName || '');
      await personButton.click();
      await page.waitForTimeout(80);
      typeInteraction = await tool.evaluate((before) => ({
        focusedBefore: before,
        focusedAfter: document.activeElement?.tagName || '',
        selectedType: document.querySelector('.guion-tipos-scroll button[aria-pressed="true"]')?.textContent?.trim() || '',
      }), focusedBefore);
    }
  }
  const screen = await auditScreen(page, `${width}x${height}-guion-teclado`, true);
  if (tool) {
    screen.editor = await tool.evaluate(() => {
      const active = document.activeElement;
      const bar = document.querySelector('.guion-tipos-barra');
      const labels = [...document.querySelectorAll('textarea + span.no-print, .guion-tipo-etiqueta')]
        .filter((el) => el.offsetParent);
      const barRect = bar?.getBoundingClientRect();
      return {
        focused: active?.tagName || '',
        typeBarVisible: !!bar && getComputedStyle(bar).display !== 'none' && barRect.width > 0 && barRect.height > 0,
        typeBarRect: barRect ? barRect.toJSON() : null,
        visibleTypeLabels: labels.length,
        activeBlockHeight: active?.closest('.guion-bloque')?.getBoundingClientRect().height
          || active?.getBoundingClientRect().height
          || null,
      };
    });
    screen.editor.typeInteraction = typeInteraction;
  }
  report.screens.push(screen);
  await closeSurface(page);
  return report;
}

try {
  const report = mode === 'visual' ? await visualAudit()
    : mode === 'review' ? await reviewAudit()
    : mode === 'guion-focus' ? await focusedGuionAudit()
      : await compactAudit();
  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.screens) {
    console.log(JSON.stringify(report.screens.map(({ label, totals }) => ({ label, ...totals })), null, 2));
  } else {
    console.log(JSON.stringify(report.checks, null, 2));
  }
  console.log(`Reporte: ${reportPath}`);
} finally {
  await Promise.all([...browsers].map((browser) => browser.close().catch(() => {})));
}

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
const mesaImage = `data:image/svg+xml;base64,${Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="432" height="540" viewBox="0 0 432 540">
    <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18283f"/><stop offset=".55" stop-color="#d58b52"/><stop offset="1" stop-color="#131820"/></linearGradient></defs>
    <rect width="432" height="540" fill="url(#f)"/><circle cx="312" cy="156" r="92" fill="#f4c987" opacity=".7"/>
    <path d="M0 410L155 255l88 96 64-72 125 137v124H0z" fill="#1b2531"/><rect x="42" y="52" width="128" height="250" rx="6" fill="#3f7f8e" opacity=".68"/>
  </svg>`).toString('base64')}`;
const mesaReference = JSON.stringify({
  id: 'ref-auditoria-iphone', creada: '2026-09-20T12:00:00.000Z',
  nota: 'Plano Entero · Pasillo nocturno', plano: 'Plano Entero', movimiento: 'Travelling',
  formato: 'Vertical 9:16', luz: 'claroscuro', lugar: 'Interior', momento: 'Noche',
  gente: '1 persona', libres: ['pasillo', 'contraluz', 'soledad'], auto: [],
  colores: ['#18283F', '#D58B52', '#F4C987', '#3F7F8E', '#131820'],
  familias: ['azul', 'naranja', 'oscuro'], ancho: 2160, alto: 2700, min: mesaImage,
});

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

async function makePage(width, height, projectFile = null, safeOverride = null) {
  /* single-process admite una superficie estable por proceso. Separar Inicio,
     proyecto vivo y narrativo evita que un cierre derribe al siguiente caso. */
  const browser = await launchAuditBrowser();
  const phoneViewport = width < 768 || height < 500;
  const pageSafeArea = safeOverride || safeArea;
  const page = await browser.newPage({
    viewport: { width, height }, hasTouch: true, isMobile: phoneViewport, deviceScaleFactor: phoneViewport ? 3 : 1,
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
    window.__referencias=${JSON.stringify([mesaReference])};
    window.__referenciaImagen=${JSON.stringify(mesaImage)};
    window.__ptvAuditSafeArea=${JSON.stringify(pageSafeArea)};
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
      if(m.fn==='ListReferences') return Promise.resolve(window.__referencias||[]);
      if(m.fn==='LoadReferenceImage') return Promise.resolve(window.__referenciaImagen||'');
      if(m.fn==='SaveBase64File') { window.__savedBase64=m.args||[]; return Promise.resolve(null); }
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
      ...document.querySelectorAll('[aria-modal="true"],.help-card.show,.checks.open,.fixed.inset-0.z-50'),
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
      safeAreaHorizontal: ['left', 'right'].map((side) => getComputedStyle(root).getPropertyValue(`--ptv-safe-${side}`).trim()),
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
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    const style = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    const surface = box('.desktop-shell');
    const edgeBands = surface ? {
      top: Math.max(0, surface.y),
      right: Math.max(0, window.innerWidth - surface.right),
      bottom: Math.max(0, window.innerHeight - surface.bottom),
      left: Math.max(0, surface.x),
    } : null;
    return {
      bodyPadding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
      safeArea: ['top', 'right', 'bottom', 'left'].map((lado) => root.getPropertyValue(`--ptv-safe-${lado}`).trim()),
      surface, edgeBands, header: box('#workspace-header'), logo: box('#logo-btn'),
      actions: box('#compact-actions-btn'), content: box('#frame-wrap'),
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
  const sizes = [
    [402, 874, safeArea],
    [375, 667, safeArea],
    [874, 402, { top: 0, right: 62, bottom: 21, left: 62, legacyBodyPadding: false }],
  ];
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  const liveViews = [
    ['perfil', 'perfil', null], ['referencias', 'perfil', 'referencias'],
    ['escaleta', 'guion', null], ['tiempos', 'guion', 'tiempos'],
    ['necesidades', 'necesidades', null], ['agenda', 'necesidades', 'agenda'],
    ['diagrama', 'necesidades', 'diagrama'], ['set', 'planeacion', null],
    ['infografias', 'planeacion', 'infografias'], ['exportar', 'salida', null],
    ['ensayo', 'ensayo', null],
  ];
  for (const [width, height, viewportSafeArea] of sizes) {
    const suffix = `${width}x${height}`;
    const launcher = await makePage(width, height, null, viewportSafeArea);
    report.screens.push(await auditScreen(launcher, `${suffix}-inicio`, true));
    await launcher.evaluate(() => document.querySelector('[data-accion="plantillas"]')?.click());
    await launcher.waitForTimeout(400);
    report.screens.push(await auditScreen(launcher, `${suffix}-plantillas`, true));
    await closeSurface(launcher);

    const live = await makePage(width, height, liveProject, viewportSafeArea);
    for (const [label, stage, section] of liveViews) {
      await selectProjectView(live, stage, section);
      report.screens.push(await auditScreen(live, `${suffix}-${label}`, true));
    }
    await closeSurface(live);

    const narrative = await makePage(width, height, narrativeProject, viewportSafeArea);
    await selectProjectView(narrative, 'guion', 'guionLiterario');
    report.screens.push(await auditScreen(narrative, `${suffix}-guion-literario`, true));
    await closeSurface(narrative);
  }
  return report;
}

async function mesaAudit() {
  const sizes = [
    [402, 874, { top: 62, right: 0, bottom: 34, left: 0, legacyBodyPadding: false }],
    [375, 667, { top: 20, right: 0, bottom: 21, left: 0, legacyBodyPadding: false }],
    [874, 402, { top: 0, right: 62, bottom: 21, left: 62, legacyBodyPadding: false }],
  ];
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  for (const [width, height, viewportSafeArea] of sizes) {
    const page = await makePage(width, height, liveProject, viewportSafeArea);
    await selectProjectView(page, 'perfil', 'referencias');
    const tool = page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/infografias/'));
    if (tool) await tool.waitForSelector('.rejilla-mesa figure', { timeout: 8000 });
    report.screens.push(await auditScreen(page, `${width}x${height}-mesa-rejilla`, true));
    if (tool) {
      await tool.locator('.rejilla-mesa figure > button').first().click();
      await tool.waitForSelector('.fixed.inset-0.z-50');
    }
    const detail = await auditScreen(page, `${width}x${height}-mesa-detalle`, true);
    if (tool) {
      detail.mesaDetail = await tool.evaluate(() => {
        const panel = document.querySelector('.mesa-luz-ficha') || document.querySelector('.fixed.inset-0.z-50 > div');
        const header = document.querySelector('.mesa-luz-ficha-cab') || panel?.firstElementChild;
        const body = document.querySelector('.mesa-luz-ficha-cuerpo') || panel?.children?.[1];
        const title = document.querySelector('.mesa-luz-ficha-titulo') || header?.querySelector('strong');
        const image = document.querySelector('.mesa-luz-ficha-imagen img') || body?.querySelector('img');
        const meta = document.querySelector('.mesa-luz-ficha-meta') || [...(body?.querySelectorAll('p') || [])]
          .find((node) => node.textContent.includes('paleta sacada'));
        const fields = document.querySelector('.mesa-luz-ficha-campos') || body?.lastElementChild;
        const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
        const lineCount = (element) => {
          if (!element) return 0;
          const range = document.createRange();
          range.selectNodeContents(element);
          return new Set([...range.getClientRects()].map((item) => Math.round(item.top))).size;
        };
        return {
          panel: rect(panel), header: rect(header), body: rect(body), image: rect(image), fields: rect(fields),
          columns: body ? getComputedStyle(body).gridTemplateColumns : '',
          title: title ? { text: title.textContent.trim(), clientWidth: title.clientWidth, scrollWidth: title.scrollWidth, rect: rect(title) } : null,
          meta: meta ? { text: meta.textContent.replace(/\s+/g, ' ').trim(), lines: lineCount(meta), rect: rect(meta) } : null,
          actionRects: [...(header?.querySelectorAll('button') || [])].map((button) => ({ text: button.textContent.trim(), rect: rect(button) })),
        };
      });
    }
    report.screens.push(detail);
    await closeSurface(page);
  }
  return report;
}

/* WKWebView encoge la caja con `zoom`, pero puede dejar la tipografía a su
   tamaño original. Chromium no reproduce ese fallo; esta medición proyecta
   cada rango de texto sin el factor de zoom y lo cruza con su celda visual.
   Con transform no hay corrección artificial: rango y caja comparten matriz. */
async function exportTypographyAudit(frame, selector) {
  return frame.evaluate((pageSelector) => {
    const page = document.querySelector(pageSelector);
    if (!page) return null;
    const pageStyle = getComputedStyle(page);
    const pageRect = page.getBoundingClientRect();
    const zoom = Number.parseFloat(pageStyle.zoom) || 1;
    const boxScale = page.offsetWidth ? pageRect.width / page.offsetWidth : 1;
    const webkitProjection = zoom < 0.999 ? 1 / zoom : 1;
    const logicalSelector = [
      '.kv > span', '.kv > b', 'td', 'th', '.pg-foot > *',
      '.pg-head h1', '.pg-head .sub', '.pg-head .org', '.person',
      '.cat2', 'p', 'li', '.sheet-head > *', '.sheet-foot > *',
    ].join(',');
    const records = [];
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const content = node.textContent.replace(/\s+/g, ' ').trim();
      const owner = node.parentElement;
      if (!content || !owner || owner.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      const style = getComputedStyle(owner);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0.2 && rect.height > 0.2);
      if (!rects.length) continue;
      const cell = owner.closest(logicalSelector) || owner;
      const cellRect = cell.getBoundingClientRect();
      const projected = rects.map((rect) => ({
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width * webkitProjection,
        bottom: rect.top + rect.height * webkitProjection,
      }));
      const bounds = projected.reduce((sum, rect) => ({
        left: Math.min(sum.left, rect.left), top: Math.min(sum.top, rect.top),
        right: Math.max(sum.right, rect.right), bottom: Math.max(sum.bottom, rect.bottom),
      }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      const escapes = bounds.left < cellRect.left - 1 || bounds.top < cellRect.top - 1
        || bounds.right > cellRect.right + 1 || bounds.bottom > cellRect.bottom + 1;
      records.push({ content: content.slice(0, 90), cell, cellRect, bounds, escapes });
    }

    const byCell = new Map();
    for (const record of records) {
      const current = byCell.get(record.cell);
      if (!current) byCell.set(record.cell, { ...record, texts: [record.content] });
      else {
        current.bounds.left = Math.min(current.bounds.left, record.bounds.left);
        current.bounds.top = Math.min(current.bounds.top, record.bounds.top);
        current.bounds.right = Math.max(current.bounds.right, record.bounds.right);
        current.bounds.bottom = Math.max(current.bounds.bottom, record.bounds.bottom);
        current.escapes ||= record.escapes;
        current.texts.push(record.content);
      }
    }
    const cells = [...byCell.values()];
    const intersections = [];
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const a = cells[i], b = cells[j];
        if (a.cell.contains(b.cell) || b.cell.contains(a.cell)) continue;
        const width = Math.min(a.bounds.right, b.bounds.right) - Math.max(a.bounds.left, b.bounds.left);
        const height = Math.min(a.bounds.bottom, b.bounds.bottom) - Math.max(a.bounds.top, b.bounds.top);
        if (width > 1 && height > 1) intersections.push([a.texts.join(' '), b.texts.join(' ')]);
      }
    }
    const escaped = cells.filter((record) => record.escapes);
    return {
      selector: pageSelector,
      scaleMechanism: zoom < 0.999 ? 'zoom' : (boxScale < 0.999 ? 'transform' : 'none'),
      cssZoom: zoom,
      boxScale: Number(boxScale.toFixed(3)),
      pageRect: pageRect.toJSON(),
      pageOffset: { width: page.offsetWidth, height: page.offsetHeight },
      overflowingText: escaped.length,
      overlaps: intersections.length,
      overflowExamples: escaped.slice(0, 12).map((record) => record.texts.join(' ').slice(0, 120)),
      overlapExamples: intersections.slice(0, 8),
    };
  }, selector);
}

async function showExportPage(frame, selector) {
  await frame.evaluate(async (pageSelector) => {
    const pages = [...document.querySelectorAll('.export-page')];
    const wanted = document.querySelector(pageSelector);
    const wantedIndex = pages.indexOf(wanted);
    if (wantedIndex < 0) return;
    document.querySelector('#view-mode-single')?.click();
    let current = pages.findIndex((page) => page.classList.contains('current-page'));
    if (current < 0) current = 0;
    const button = wantedIndex > current ? '#pager-next' : '#pager-prev';
    for (let i = 0; i < Math.abs(wantedIndex - current); i += 1) document.querySelector(button)?.click();
    const scroll = document.querySelector('#preview-scroll-area');
    if (scroll) { scroll.scrollTop = 0; scroll.scrollLeft = 0; }
  }, selector);
  await frame.waitForTimeout(280);
}

/* Sólo sirve para que la captura base haga visible la anomalía ya confirmada
   en hardware: duplica la tinta tipográfica fuera del árbol con tamaño sin
   zoom. Las métricas se calculan antes y no dependen de este overlay. */
async function addWebkitZoomOverlay(frame, selector) {
  return frame.evaluate((pageSelector) => {
    document.querySelector('#webkit-zoom-simulation')?.remove();
    const page = document.querySelector(pageSelector);
    const zoom = Number.parseFloat(page ? getComputedStyle(page).zoom : '1') || 1;
    if (!page || zoom >= 0.999) return false;
    const overlay = document.createElement('div');
    overlay.id = 'webkit-zoom-simulation';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden';
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const content = node.textContent.replace(/\s+/g, ' ').trim();
      const owner = node.parentElement;
      if (!content || !owner || owner.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getClientRects()[0];
      if (!rect || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
      const style = getComputedStyle(owner);
      const copy = document.createElement('span');
      copy.textContent = content;
      copy.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.top}px;white-space:nowrap;`
        + `font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight};`
        + `font-style:${style.fontStyle};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing};color:${style.color}`;
      overlay.appendChild(copy);
    }
    document.body.appendChild(overlay);
    return true;
  }, selector);
}

async function exportInkAudit(page, frame, selector) {
  await showExportPage(frame, selector);
  await frame.evaluate(() => {
    const bar = document.querySelector('#doc-markup-bar');
    if (bar?.classList.contains('collapsed')) document.querySelector('#markup-toggle')?.click();
    const draw = document.querySelector('#markup-draw-mode');
    if (draw && !draw.classList.contains('active')) draw.click();
  });
  const dispatched = await frame.evaluate((pageSelector) => {
    const svg = document.querySelector(`${pageSelector}.current-page .tinta`);
    if (!svg) return false;
    const rect = svg.getBoundingClientRect();
    /* Un PointerEvent sintético no pertenece al registro nativo de captura;
       anular sólo esa llamada deja probar la misma conversión CTM del motor. */
    svg.setPointerCapture = () => {};
    const send = (type, ratioX, ratioY, buttons) => svg.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 41, pointerType: 'mouse', buttons,
      pressure: buttons ? 0.5 : 0,
      clientX: rect.left + rect.width * ratioX,
      clientY: rect.top + rect.height * ratioY,
    }));
    send('pointerdown', 0.34, 0.28, 1);
    for (let i = 1; i <= 8; i += 1) send('pointermove', 0.34 + 0.17 * i / 8, 0.28 + 0.09 * i / 8, 1);
    send('pointerup', 0.51, 0.37, 0);
    return true;
  }, selector);
  if (!dispatched) return { available: false };
  const atFit = await frame.evaluate((pageSelector) => {
    const pageNode = document.querySelector(pageSelector);
    const svgNode = pageNode?.querySelector('.tinta');
    const trace = pageNode?._tinta?.trazos().at(-1);
    const rect = svgNode?.getBoundingClientRect();
    const view = svgNode?.viewBox?.baseVal;
    return {
      points: trace?.t || [],
      rect: rect?.toJSON() || null,
      viewBox: view ? { width: view.width, height: view.height } : null,
    };
  }, selector);
  await frame.locator('#zoom-100').click();
  await frame.waitForTimeout(280);
  const at100 = await frame.evaluate((pageSelector) => {
    const pageNode = document.querySelector(pageSelector);
    const svgNode = pageNode?.querySelector('.tinta');
    const trace = pageNode?._tinta?.trazos().at(-1);
    return {
      points: trace?.t || [],
      pageRect: pageNode?.getBoundingClientRect().toJSON() || null,
      pathBox: (() => {
        const box = svgNode?.querySelector('path')?.getBBox?.();
        return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
      })(),
    };
  }, selector);
  await frame.locator('#zoom-out').click();
  await frame.waitForTimeout(280);
  const afterMinus = await frame.evaluate((pageSelector) => {
    const pageNode = document.querySelector(pageSelector);
    const wrapper = pageNode?.closest('.export-page-frame');
    return {
      pageWidth: pageNode?.getBoundingClientRect().width || 0,
      wrapperHeight: wrapper?.getBoundingClientRect().height || 0,
    };
  }, selector);
  await frame.locator('#zoom-in').click();
  await frame.waitForTimeout(280);
  const afterPlus = await frame.evaluate((pageSelector) => {
    const pageNode = document.querySelector(pageSelector);
    return pageNode?.getBoundingClientRect().width || 0;
  }, selector);
  const first = atFit.points[0] || [];
  const expected = [atFit.viewBox.width * 0.34, atFit.viewBox.height * 0.28];
  const error = Math.hypot((first[0] || 0) - expected[0], (first[1] || 0) - expected[1]);
  await frame.locator('#zoom-fit').click();
  return {
    available: true,
    fitRect: atFit.rect,
    viewBox: atFit.viewBox,
    savedStart: first.slice(0, 2),
    expectedStart: expected.map((value) => Number(value.toFixed(1))),
    error: Number(error.toFixed(2)),
    pointsStableAt100: JSON.stringify(atFit.points) === JSON.stringify(at100.points),
    pageWidthAt100: at100.pageRect?.width || 0,
    pageWidthAfterMinus: afterMinus.pageWidth,
    wrapperHeightAfterMinus: afterMinus.wrapperHeight,
    pageWidthAfterPlus: afterPlus,
    pathBoxAt100: at100.pathBox,
  };
}

async function exportTouchZoomAudit(frame, selector) {
  await showExportPage(frame, selector);
  const initial = await frame.evaluate((pageSelector) => {
    const page = document.querySelector(pageSelector);
    return {
      traces: page?._tinta?.trazos().length || 0,
      markupCollapsed: document.querySelector('#doc-markup-bar')?.classList.contains('collapsed'),
      toggleActive: document.querySelector('#markup-toggle')?.classList.contains('active'),
      toggleLabel: document.querySelector('#markup-toggle span')?.textContent.trim() || '',
      drawModeActive: document.querySelector('#markup-draw-mode')?.classList.contains('active'),
      inkWritingClass: page?.querySelector('.tinta')?.classList.contains('escribiendo') || false,
    };
  }, selector);

  const stroke = async (pointerType, ratioX, ratioY) => frame.evaluate(({ pageSelector, pointerType, ratioX, ratioY }) => {
    const page = document.querySelector(pageSelector);
    const svg = page?.querySelector('.tinta');
    if (!svg) return null;
    svg.setPointerCapture = () => {};
    const rect = svg.getBoundingClientRect();
    const fire = (type, x, y, buttons) => svg.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: pointerType === 'pen' ? 71 : 72,
      pointerType, buttons, pressure: buttons ? (pointerType === 'pen' ? .72 : .5) : 0,
      clientX: rect.left + rect.width * x, clientY: rect.top + rect.height * y,
    }));
    fire('pointerdown', ratioX, ratioY, 1);
    for (let i = 1; i <= 6; i += 1) fire('pointermove', ratioX + .08 * i / 6, ratioY + .05 * i / 6, 1);
    fire('pointerup', ratioX + .08, ratioY + .05, 0);
    const trace = page._tinta?.trazos().at(-1);
    return { traces: page._tinta?.trazos().length || 0, points: trace?.t || [],
      viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height } };
  }, { pageSelector: selector, pointerType, ratioX, ratioY });

  const fingerDefault = await stroke('touch', .19, .18);
  await frame.locator('#markup-toggle').click();
  const annotationOn = await frame.evaluate(() => ({
    label: document.querySelector('#markup-toggle span')?.textContent.trim() || '',
    active: document.querySelector('#markup-toggle')?.classList.contains('active'),
    drawMode: document.querySelector('#markup-draw-mode')?.classList.contains('active'),
  }));
  const fingerExplicit = await stroke('touch', .24, .23);

  const beforePinch = await frame.evaluate((pageSelector) => document.querySelector(pageSelector)?._tinta?.trazos().length || 0, selector);
  await frame.evaluate(async (pageSelector) => {
    const page = document.querySelector(pageSelector);
    const svg = page?.querySelector('.tinta');
    const scroll = document.querySelector('#preview-scroll-area');
    if (!svg || !scroll) return;
    svg.setPointerCapture = () => {};
    const rect = svg.getBoundingClientRect();
    const center = { x: rect.left + rect.width * .56, y: rect.top + Math.min(rect.height * .42, 220) };
    svg.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', buttons: 1, pressure: .5,
      clientX: center.x - 22, clientY: center.y,
    }));
    window.__ptvGestureAudit = [];
    const snap = (step) => window.__ptvGestureAudit.push({
      step,
      scale: document.querySelector('#preview')?.style.getPropertyValue('--encaje-hoja') || '',
      active: !!window._ptvZoomGestureActive,
      installed: scroll.dataset.zoomGestures || '',
    });
    const makeGesture = (type, scale) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        scale: { value: scale }, clientX: { value: center.x }, clientY: { value: center.y },
      });
      scroll.dispatchEvent(event);
      snap(type);
    };
    const current = parseFloat(document.querySelector('#preview')?.style.getPropertyValue('--encaje-hoja')) || 1;
    makeGesture('gesturestart', 1);
    makeGesture('gesturechange', 2 / current);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    makeGesture('gestureend', 2 / current);
    svg.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', buttons: 0,
      clientX: center.x - 22, clientY: center.y,
    }));
  }, selector);
  await frame.waitForTimeout(180);
  const pinch = await frame.evaluate((pageSelector) => {
    const page = document.querySelector(pageSelector);
    const scroll = document.querySelector('#preview-scroll-area');
    const scale = page?.offsetWidth ? page.getBoundingClientRect().width / page.offsetWidth : 0;
    const before = { left: scroll.scrollLeft, top: scroll.scrollTop };
    scroll.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    const topLeft = page?.getBoundingClientRect().toJSON() || null;
    scroll.scrollTo({ left: scroll.scrollWidth, top: scroll.scrollHeight, behavior: 'instant' });
    const bottomRight = page?.getBoundingClientRect().toJSON() || null;
    const viewport = scroll.getBoundingClientRect();
    return {
      traces: page?._tinta?.trazos().length || 0,
      scale: Number(scale.toFixed(3)),
      zoomLabel: document.querySelector('#zoom-label')?.textContent.trim() || '',
      gestureAudit: window.__ptvGestureAudit || [],
      scrollSize: [scroll.scrollWidth, scroll.scrollHeight],
      clientSize: [scroll.clientWidth, scroll.clientHeight],
      scrollMax: [scroll.scrollLeft, scroll.scrollTop],
      topLeft, bottomRight, viewport: viewport.toJSON(), before,
      reachesTopLeft: !!topLeft && topLeft.left >= viewport.left - 1 && topLeft.top >= viewport.top - 1,
      reachesBottomRight: !!bottomRight && bottomRight.right <= viewport.right + 1 && bottomRight.bottom <= viewport.bottom + 1,
    };
  }, selector);

  const zoomLimit = await frame.evaluate(async (pageSelector) => {
    const scroll = document.querySelector('#preview-scroll-area');
    const page = document.querySelector(pageSelector);
    if (!scroll || !page) return null;
    const fire = (type, scale) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        scale: { value: scale }, clientX: { value: scroll.clientWidth / 2 }, clientY: { value: scroll.clientHeight / 2 },
      });
      scroll.dispatchEvent(event);
    };
    fire('gesturestart', 1);
    fire('gesturechange', 10);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    fire('gestureend', 10);
    const maximum = page.getBoundingClientRect().width / page.offsetWidth;
    const maximumLabel = document.querySelector('#zoom-label')?.textContent.trim() || '';
    fire('gesturestart', 1);
    fire('gesturechange', 2 / maximum);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    fire('gestureend', 2 / maximum);
    return {
      maximum: Number(maximum.toFixed(3)), maximumLabel,
      restoredForPen: Number((page.getBoundingClientRect().width / page.offsetWidth).toFixed(3)),
    };
  }, selector);

  const penAt2x = await stroke('pen', .68, .61);
  const penExpected = penAt2x ? [penAt2x.viewBox.width * .68, penAt2x.viewBox.height * .61] : [];
  const penStart = penAt2x?.points?.[0] || [];
  const penError = penAt2x
    ? Math.hypot((penStart[0] || 0) - penExpected[0], (penStart[1] || 0) - penExpected[1])
    : null;
  await frame.locator('#markup-toggle').click();
  const annotationOff = await frame.evaluate(() => ({
    label: document.querySelector('#markup-toggle span')?.textContent.trim() || '',
    active: document.querySelector('#markup-toggle')?.classList.contains('active'),
    drawMode: document.querySelector('#markup-draw-mode')?.classList.contains('active'),
  }));
  await frame.locator('#zoom-fit').click();
  await frame.waitForTimeout(100);
  return {
    initial,
    fingerDefaultAdded: (fingerDefault?.traces || 0) - initial.traces,
    annotationOn,
    fingerExplicitAdded: (fingerExplicit?.traces || 0) - (fingerDefault?.traces || 0),
    pinch: { ...pinch, tracesAdded: pinch.traces - beforePinch },
    zoomLimit,
    penAt2x: {
      added: (penAt2x?.traces || 0) - pinch.traces,
      savedStart: penStart.slice(0, 2),
      expectedStart: penExpected.map((value) => Number(value.toFixed(1))),
      error: penError == null ? null : Number(penError.toFixed(2)),
    },
    annotationOff,
  };
}

async function exportAudit() {
  const sizes = [
    [402, 874, { top: 62, right: 0, bottom: 34, left: 0, legacyBodyPadding: false }],
    [375, 667, { top: 20, right: 0, bottom: 21, left: 0, legacyBodyPadding: false }],
    [874, 402, { top: 0, right: 62, bottom: 21, left: 62, legacyBodyPadding: false }],
  ];
  const report = { generatedAt: new Date().toISOString(), mode, webkitBinaryAvailable: false, screens: [] };
  for (const [width, height, viewportSafeArea] of sizes) {
    const page = await makePage(width, height, liveProject, viewportSafeArea);
    await selectProjectView(page, 'salida', null);
    const frame = page.frames().find((item) => item !== page.mainFrame() && item.url().includes('/exportar/'));
    if (!frame) throw new Error(`No se encontró Documentos en ${width}x${height}`);
    await frame.waitForSelector('[data-name$="-resumen"] .tinta', { timeout: 8000 });
    await frame.waitForTimeout(350);
    const initialLayout = await frame.evaluate(() => {
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null;
      return {
        folded: document.querySelector('.layout')?.classList.contains('plegado'),
        rows: getComputedStyle(document.querySelector('.layout')).gridTemplateRows,
        config: rect('.config'), header: rect('.doc-header'), preview: rect('.preview-scroll-area'),
        markupCollapsed: document.querySelector('#doc-markup-bar')?.classList.contains('collapsed'),
      };
    });
    await page.screenshot({ path: path.join(outDir, `${width}x${height}-documentos-interfaz.png`) });
    await frame.evaluate(() => {
      if (!document.querySelector('.layout')?.classList.contains('plegado')) document.querySelector('#plegar')?.click();
    });
    await frame.waitForTimeout(280);

    const pages = [];
    for (const [name, selector] of [
      ['resumen', '[data-name$="-resumen"]'],
      ['hoja-de-llamado', '[data-name$="-hoja-de-llamado"]'],
    ]) {
      await showExportPage(frame, selector);
      const typography = await exportTypographyAudit(frame, selector);
      const simulated = await addWebkitZoomOverlay(frame, selector);
      await page.screenshot({ path: path.join(outDir, `${width}x${height}-${name}${simulated ? '-webkit-sim' : ''}.png`) });
      await frame.evaluate(() => document.querySelector('#webkit-zoom-simulation')?.remove());
      pages.push({ name, ...typography });
    }
    await frame.locator('#view-mode-grid').click();
    await frame.waitForTimeout(280);
    const layoutModes = await frame.evaluate(() => {
      const frames = [...document.querySelectorAll('.export-page-frame')].filter((item) => item.offsetParent);
      const rects = frames.map((item) => item.getBoundingClientRect());
      const sized = frames.every((item) => {
        const page = item.querySelector('.export-page');
        const factor = page?.offsetWidth ? page.getBoundingClientRect().width / page.offsetWidth : 1;
        return Math.abs(item.getBoundingClientRect().height - page.offsetHeight * factor) < 1;
      });
      const scroll = document.querySelector('#preview-scroll-area');
      return {
        gridPages: frames.length,
        wrappersReserveScaledHeight: sized,
        firstGap: rects.length > 1 ? Number((rects[1].top - rects[0].bottom).toFixed(2)) : null,
        scrollHeight: scroll?.scrollHeight || 0,
        clientHeight: scroll?.clientHeight || 0,
      };
    });
    await frame.locator('#view-mode-single').click();
    await frame.waitForTimeout(280);
    const touchZoom = await exportTouchZoomAudit(frame, '[data-name$="-resumen"]');
    const ink = await exportInkAudit(page, frame, '[data-name$="-resumen"]');
    await frame.waitForTimeout(280);
    await page.screenshot({ path: path.join(outDir, `${width}x${height}-tinta-escalada.png`) });
    await page.emulateMedia({ media: 'print' });
    const print = await frame.evaluate(() => {
      const page = document.querySelector('.export-page');
      const wrapper = page?.closest('.export-page-frame');
      return {
        transform: page ? getComputedStyle(page).transform : '',
        wrapperDisplay: wrapper ? getComputedStyle(wrapper).display : '',
        serializedPageHasTransform: page?.outerHTML.includes('transform') || false,
      };
    });
    await page.emulateMedia({ media: 'screen' });
    let pngCapture = null;
    if (width === 402 && height === 874) {
      await page.evaluate(() => { window.__savedBase64 = null; });
      await frame.evaluate(() => {
        document.querySelector('[data-type="png"]')?.click();
        document.querySelector('#quick-export-btn')?.click();
      });
      await page.waitForFunction(() => Array.isArray(window.__savedBase64), null, { timeout: 12000 });
      pngCapture = await page.evaluate(() => {
        const [filename, dataUrl] = window.__savedBase64 || [];
        const encoded = String(dataUrl || '').split(',')[1] || '';
        const raw = encoded ? atob(encoded) : '';
        const read32 = (offset) => ((raw.charCodeAt(offset) << 24) >>> 0)
          + (raw.charCodeAt(offset + 1) << 16) + (raw.charCodeAt(offset + 2) << 8) + raw.charCodeAt(offset + 3);
        return {
          filename,
          width: raw.length >= 24 ? read32(16) : 0,
          height: raw.length >= 24 ? read32(20) : 0,
          bytes: raw.length,
        };
      });
    }
    const totals = pages.reduce((sum, item) => ({
      overflowingText: sum.overflowingText + item.overflowingText,
      overlaps: sum.overlaps + item.overlaps,
    }), { overflowingText: 0, overlaps: 0 });
    report.screens.push({ label: `${width}x${height}-documentos`, totals, initialLayout, pages, layoutModes, touchZoom, ink, print, pngCapture });
    await closeSurface(page);
  }
  return report;
}

async function exportVisualAudit() {
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  for (const [width, height] of [[1440, 900], [820, 1180], [1180, 820]]) {
    const page = await makePage(width, height, liveProject);
    await selectProjectView(page, 'salida', null);
    const frame = page.frames().find((item) => item !== page.mainFrame() && item.url().includes('/exportar/'));
    if (!frame) throw new Error(`No se encontró Documentos en ${width}x${height}`);
    await frame.waitForSelector('[data-name$="-resumen"]', { timeout: 8000 });
    await frame.waitForTimeout(350);
    const geometry = await frame.evaluate(() => {
      const page = document.querySelector('[data-name$="-resumen"]');
      const rect = page?.getBoundingClientRect();
      return {
        layout: document.documentElement.dataset.layout,
        page: rect?.toJSON() || null,
        offset: page ? { width: page.offsetWidth, height: page.offsetHeight } : null,
        zoom: page ? Number.parseFloat(getComputedStyle(page).zoom) || 1 : null,
        transform: page ? getComputedStyle(page).transform : null,
      };
    });
    await page.screenshot({ path: path.join(outDir, `${width}x${height}-exportar.png`) });
    report.screens.push({ label: `${width}x${height}-exportar`, geometry });
    await closeSurface(page);
  }
  return report;
}

const diagramFixtures = {
  one: {
    nodes: [{ id: 'cam1', type: 'camara', x: 80, y: 70, label: 'Cámara / CAMARA', props: { connector: 'SDI' }, chan: {} }],
    edges: [], zones: [], notes: [], seq: 2,
  },
  eight: {
    nodes: [
      { id: 'cam1', type: 'camara', x: 40, y: 40, label: 'Cámara 1', props: { connector: 'SDI' }, chan: {}, syncKey: 'cam:cam1' },
      { id: 'cam2', type: 'camara', x: 40, y: 200, label: 'Cámara 2', props: { connector: 'SDI' }, chan: {}, syncKey: 'cam:cam2' },
      { id: 'mic1', type: 'microfono', x: 40, y: 360, label: 'Micrófono solapa', props: { conexion: 'Inalámbrico', micTipo: 'solapa' }, chan: {}, syncKey: 'mic:mic1' },
      { id: 'sw1', type: 'switcher', x: 350, y: 90, label: 'Switcher', props: { inputs: 4 }, chan: {} },
      { id: 'mix1', type: 'audio', x: 350, y: 330, label: 'Mezcladora', props: { inputs: 4 }, chan: {} },
      { id: 'enc1', type: 'encoder', x: 670, y: 190, label: 'Encoder principal', props: {}, chan: {} },
      { id: 'mon1', type: 'monitor', x: 670, y: 20, label: 'Monitor programa', props: {}, chan: {} },
      { id: 'yt1', type: 'plataforma', x: 970, y: 190, label: 'Destino', props: { plataforma: 'YouTube' }, chan: {} },
    ],
    edges: [
      { id: 'e1', from: { node: 'cam1', port: 'v' }, to: { node: 'sw1', port: 'i1' } },
      { id: 'e2', from: { node: 'cam2', port: 'v' }, to: { node: 'sw1', port: 'i2' } },
      { id: 'e3', from: { node: 'mic1', port: 'a' }, to: { node: 'mix1', port: 'i1' } },
      { id: 'e4', from: { node: 'sw1', port: 'pgm' }, to: { node: 'enc1', port: 'v' } },
      { id: 'e5', from: { node: 'sw1', port: 'pgm' }, to: { node: 'mon1', port: 'in' } },
      { id: 'e6', from: { node: 'mix1', port: 'mix' }, to: { node: 'enc1', port: 'a' } },
      { id: 'e7', from: { node: 'enc1', port: 'out' }, to: { node: 'yt1', port: 'in' } },
    ], zones: [], notes: [], seq: 20,
  },
};
const diagramFixtureCfg = {
  camaras: [{ id: 'cam1', nombre: 'Cámara 1' }, { id: 'cam2', nombre: 'Cámara 2' }],
  microfonos: [{ id: 'mic1', nombre: 'Micrófono solapa', conexion: 'Inalámbrico', micTipo: 'solapa' }],
  extras: [],
};

async function diagramPaperCase(page, frame, info, name, fixture, label) {
  await frame.evaluate(({ cfg, project, projectName, diagram }) => {
    window.postMessage({ type: 'producciontv:load-exportar', cfg, project, projectName, diagram }, '*');
  }, { cfg: info.bundle.infographic, project: info.bundle.project, projectName: info.bundle.project?.name || '', diagram: fixture });
  await frame.waitForSelector('[data-name$="-diagrama-tecnico"]', { state: 'attached' });
  await showExportPage(frame, '[data-name$="-diagrama-tecnico"]');
  const metrics = await frame.evaluate(() => {
    const pageNode = document.querySelector('[data-name$="-diagrama-tecnico"]');
    const svg = pageNode?.querySelector('.diagrama-papel')
      || [...(pageNode?.querySelectorAll('svg') || [])].find((item) => item.style.background || item.getAttribute('style')?.includes('background'));
    if (!svg) return { available: false };
    let nodes = [...svg.querySelectorAll('.diagrama-nodo-papel')];
    if (!nodes.length) nodes = [...svg.querySelectorAll('g')].filter((group) => {
      const rect = group.querySelector(':scope > rect');
      return rect && Number(rect.getAttribute('width')) >= 100 && group.querySelectorAll(':scope > text').length >= 2;
    });
    const sr = svg.getBoundingClientRect();
    const rects = nodes.map((node) => node.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const unionCenter = rects.length ? (left + right) / 2 : 0;
    return {
      available: true,
      nodes: nodes.length,
      scale: Number(svg.dataset.diagramScale || 0) || null,
      maxNodeWidthRatio: Number((Math.max(0, ...rects.map((rect) => rect.width)) / Math.max(1, sr.width)).toFixed(3)),
      centeredErrorPx: Number(Math.abs(unionCenter - (sr.left + sr.width / 2)).toFixed(2)),
      glyphNodes: nodes.filter((node) => node.querySelector('path,circle,line,polyline,polygon')).length,
      diagramRect: sr.toJSON(),
    };
  });
  await page.screenshot({ path: path.join(outDir, `${label}-papel-${name}.png`) });
  return metrics;
}

async function dispatchTouchPointer(frame, selector, points, hold = 20) {
  return frame.evaluate(async ({ selector: targetSelector, points: route, holdMs }) => {
    const target = document.querySelector(targetSelector);if (!target) return false;
    const rect = target.getBoundingClientRect();
    const at = (point) => ({ clientX: rect.left + point[0], clientY: rect.top + point[1] });
    const send = (owner, type, point, buttons) => owner.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 71, pointerType: 'touch', isPrimary: true, buttons,
      ...at(point),
    }));
    send(target, 'pointerdown', route[0], 1);
    await new Promise((resolve) => setTimeout(resolve, holdMs));
    for (const point of route.slice(1, -1)) send(document, 'pointermove', point, 1);
    send(document, 'pointerup', route.at(-1), 0);
    return true;
  }, { selector, points, holdMs: hold });
}

async function diagramGestureAudit(page, frame, fixture) {
  const hydrate = async () => {
    await frame.evaluate(({ state, cfg }) => window.postMessage({ type: 'producciontv:hydrate-diagram', state, cfg }, '*'), { state: fixture, cfg: diagramFixtureCfg });
    await frame.waitForTimeout(120);
  };
  await hydrate();
  const hasCheckChip = await frame.locator('#checkChip').count();
  let checklistSheet;
  if (hasCheckChip) {
    await frame.locator('#checkChip').click();
    checklistSheet = await frame.evaluate(() => {
      const close = document.querySelector('.checks-close')?.getBoundingClientRect();
      return { available: true, opened: document.querySelector('#checks')?.classList.contains('open') || false, closeTarget: close ? { width: close.width, height: close.height } : null };
    });
    await frame.locator('.checks-close').click();
  } else {
    checklistSheet = await frame.evaluate(() => ({ available: false, startsOpen: document.querySelector('#checks')?.classList.contains('open') || false }));
    await frame.evaluate(() => { if (document.querySelector('#checks')?.classList.contains('open')) document.querySelector('#btnChecks')?.click(); });
  }
  await frame.evaluate(() => {
    window.__diagramPointerTrace = [];
    document.addEventListener('pointerdown', (event) => window.__diagramPointerTrace.push({ type: event.type, pointerType: event.pointerType, button: event.button, target: event.target.className }), { once: true, capture: true });
  });
  await dispatchTouchPointer(frame, '.node[data-id="sw1"]', [[40, 30], [40, 30]], 30);
  const shortTap = await frame.evaluate(() => ({
    inspectorOpened: document.querySelector('#inspector')?.classList.contains('open') || false,
    trace: window.__diagramPointerTrace || [],
  }));

  await hydrate();
  const beforeDrag = await frame.evaluate(() => ({ left: document.querySelector('.node[data-id="sw1"]')?.style.left, transform: document.querySelector('#world')?.style.transform }));
  await dispatchTouchPointer(frame, '.node[data-id="sw1"]', [[40, 30], [140, 30], [140, 30]], 20);
  const drag = await frame.evaluate((before) => ({
    nodeStayed: document.querySelector('.node[data-id="sw1"]')?.style.left === before.left,
    canvasMoved: document.querySelector('#world')?.style.transform !== before.transform,
    inspectorOpened: document.querySelector('#inspector')?.classList.contains('open') || false,
  }), beforeDrag);

  await hydrate();
  const beforeLong = await frame.evaluate(() => document.querySelector('.node[data-id="sw1"]')?.style.left);
  await dispatchTouchPointer(frame, '.node[data-id="sw1"]', [[40, 30], [140, 30], [140, 30]], 390);
  const longPress = await frame.evaluate((left) => ({
    nodeMoved: document.querySelector('.node[data-id="sw1"]')?.style.left !== left,
    left: document.querySelector('.node[data-id="sw1"]')?.style.left,
  }), beforeLong);

  await hydrate();
  await dispatchTouchPointer(frame, '#mobileActions', [[20, 20], [120, 20], [120, 20]], 20);
  await frame.evaluate(() => document.querySelector('#mobileActions')?.click());
  const buttonDrag = await frame.evaluate(() => ({ opened: document.querySelector('#topActions')?.classList.contains('open') || false }));
  await frame.evaluate(() => document.querySelector('#mobileActionsScrim')?.click());
  await frame.waitForTimeout(920);
  await dispatchTouchPointer(frame, '#mobileActions', [[20, 20], [20, 20]], 20);
  await frame.evaluate(() => document.querySelector('#mobileActions')?.click());
  const buttonTap = await frame.evaluate(() => ({ opened: document.querySelector('#topActions')?.classList.contains('open') || false }));
  await frame.evaluate(() => document.querySelector('#mobileActionsScrim')?.click());

  await hydrate();
  const edgesBeforePort = await frame.evaluate(() => document.querySelectorAll('#wires path:not(.hit)').length);
  await dispatchTouchPointer(frame, '.node[data-id="sw1"] .port[data-port="i3"]', [[22, 22], [22, 22]], 20);
  await dispatchTouchPointer(frame, '.node[data-id="sw1"] .port[data-port="i3"]', [[22, 22], [122, 22], [122, 22]], 20);
  const portThreshold = await frame.evaluate((before) => ({
    edgesUnchanged: document.querySelectorAll('#wires path:not(.hit)').length === before,
    temporaryWireGone: ![...document.querySelectorAll('#wires path')].some((path) => path.getAttribute('stroke-dasharray') === '4 5'),
  }), edgesBeforePort);

  await hydrate();
  const pinch = await frame.evaluate(async () => {
    const wrap = document.querySelector('#wrap'),node=document.querySelector('.node[data-id="sw1"]');
    if (!wrap || typeof Touch !== 'function') return { available: false };
    const r=wrap.getBoundingClientRect(),make=(id,x,y)=>new Touch({ identifier:id,target:wrap,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y });
    const fire=(type,touches,changed)=>wrap.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:changed}));
    const a=make(1,r.left+r.width*.42,r.top+r.height*.48),b=make(2,r.left+r.width*.58,r.top+r.height*.48);
    fire('touchstart',[a,b],[a,b]);
    const c=make(1,r.left+r.width*.28,r.top+r.height*.48),d=make(2,r.left+r.width*.72,r.top+r.height*.48);
    fire('touchmove',[c,d],[c,d]);fire('touchend',[],[c,d]);
    await new Promise((resolve)=>setTimeout(resolve,40));
    return { available:true,zoom:document.querySelector('#zPct')?.textContent,inspectorOpened:document.querySelector('#inspector')?.classList.contains('open')||false,nodeLeft:node?.style.left,temporaryWireGone:![...document.querySelectorAll('#wires path')].some((path)=>path.getAttribute('stroke-dasharray')==='4 5') };
  });
  await hydrate();
  let cdpPinch;
  try {
    const box = await frame.locator('#wrap').boundingBox();
    const session = await page.context().newCDPSession(page);
    const before = await frame.evaluate(() => ({ zoom: document.querySelector('#zPct')?.textContent, edges: document.querySelectorAll('#wires path.hit').length }));
    await session.send('Input.synthesizePinchGesture', {
      x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2),
      scaleFactor: 1.45, relativeSpeed: 700, gestureSourceType: 'touch',
    });
    await frame.waitForTimeout(160);
    cdpPinch = await frame.evaluate((initial) => ({
      available: true, beforeZoom: initial.zoom, afterZoom: document.querySelector('#zPct')?.textContent,
      edgesUnchanged: document.querySelectorAll('#wires path.hit').length === initial.edges,
      inspectorOpened: document.querySelector('#inspector')?.classList.contains('open') || false,
    }), before);
    await session.detach();
  } catch (error) {
    cdpPinch = { available: false, error: String(error.message || error) };
  }
  return { checklistSheet, shortTap, drag, longPress, buttonDrag, buttonTap, portThreshold, pinch, cdpPinch };
}

async function diagramRoundAudit() {
  const sizes = [
    [402, 874, { top: 62, right: 0, bottom: 34, left: 0, legacyBodyPadding: false }],
    [874, 402, { top: 0, right: 62, bottom: 21, left: 62, legacyBodyPadding: false }],
  ];
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  const info = bundleInfo(liveProject);
  for (const [width, height, viewportSafeArea] of sizes) {
    const label = `${width}x${height}`;
    const page = await makePage(width, height, liveProject, viewportSafeArea);
    await selectProjectView(page, 'necesidades', 'diagrama');
    const frame = page.frames().find((item) => item !== page.mainFrame() && item.url().includes('/diagrama/'));
    if (!frame) throw new Error(`No se encontró Diagrama en ${label}`);
    await frame.evaluate(({ state, cfg }) => window.postMessage({ type: 'producciontv:hydrate-diagram', state, cfg }, '*'), { state: diagramFixtures.eight, cfg: diagramFixtureCfg });
    await frame.waitForTimeout(300);
    const layout = await frame.evaluate(() => {
      const wrap = document.querySelector('#wrap')?.getBoundingClientRect();
      const nodes = [...document.querySelectorAll('.node')].map((node) => node.getBoundingClientRect());
      const visible = (el) => el && el.getBoundingClientRect().width > .5 && getComputedStyle(el).display !== 'none';
      const small = [...document.querySelectorAll('button,.port,.chip')].filter(visible).filter((el) => {
        const r=el.getBoundingClientRect();return r.width < 44 || r.height < 44;
      });
      return {
        layout: document.documentElement.dataset.layout,
        checksOpen: document.querySelector('#checks')?.classList.contains('open') || false,
        chip: document.querySelector('#checkChip')?.textContent.trim() || null,
        cutNodes: nodes.filter((r) => r.left < wrap.left - .5 || r.top < wrap.top - .5 || r.right > wrap.right + .5 || r.bottom > wrap.bottom + .5).length,
        touchTargetsBelow44: small.length,
        smallTargets: small.slice(0, 24).map((el) => ({ tag: el.tagName, id: el.id, className: el.className, text: el.textContent.trim().slice(0, 30), rect: el.getBoundingClientRect().toJSON() })),
        scale: document.querySelector('#zPct')?.textContent || '',
      };
    });
    const gestures = await diagramGestureAudit(page, frame, diagramFixtures.eight);
    await frame.evaluate(({ state, cfg }) => window.postMessage({ type: 'producciontv:hydrate-diagram', state, cfg }, '*'), { state: diagramFixtures.eight, cfg: diagramFixtureCfg });
    await frame.waitForTimeout(180);
    await page.screenshot({ path: path.join(outDir, `${label}-diagrama-interactivo.png`) });
    report.screens.push({ label: `${label}-diagrama`, totals: { cutNodes: layout.cutNodes, touchTargetsBelow44: layout.touchTargetsBelow44 }, layout, gestures });
    await closeSurface(page);

    const exportPage = await makePage(width, height, liveProject, viewportSafeArea);
    await selectProjectView(exportPage, 'salida', null);
    const exportFrame = exportPage.frames().find((item) => item !== exportPage.mainFrame() && item.url().includes('/exportar/'));
    if (!exportFrame) throw new Error(`No se encontró Documentos en ${label}`);
    const one = await diagramPaperCase(exportPage, exportFrame, info, 'un-nodo', diagramFixtures.one, label);
    const eight = await diagramPaperCase(exportPage, exportFrame, info, 'ocho-nodos', diagramFixtures.eight, label);
    report.screens.push({ label: `${label}-diagrama-papel`, totals: { oversizedNodes: one.maxNodeWidthRatio > .3 ? 1 : 0, missingGlyphs: Math.max(0, one.nodes - one.glyphNodes) + Math.max(0, eight.nodes - eight.glyphNodes) }, one, eight });
    await closeSurface(exportPage);
  }
  return report;
}

async function diagramVisualAudit() {
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  for (const [width, height] of [[1440, 900], [820, 1180], [1180, 820]]) {
    const page = await makePage(width, height, liveProject);
    await selectProjectView(page, 'necesidades', 'diagrama');
    const frame = page.frames().find((item) => item !== page.mainFrame() && item.url().includes('/diagrama/'));
    if (!frame) throw new Error(`No se encontró Diagrama en ${width}x${height}`);
    const geometry = await frame.evaluate(() => {
      const box = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null;
      return {
        layout: document.documentElement.dataset.layout,
        top: box('.top'), palette: box('.palette'), canvas: box('#wrap'), checks: box('#checks'),
        checksOpen: document.querySelector('#checks')?.classList.contains('open') || false,
        chipVisible: !!document.querySelector('#checkChip')?.offsetParent,
        nodeCount: document.querySelectorAll('.node').length,
      };
    });
    await page.screenshot({ path: path.join(outDir, `${width}x${height}-diagrama.png`) });
    report.screens.push({ label: `${width}x${height}-diagrama`, geometry });
    await closeSurface(page);
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

/* Contraste efectivo sobre superficies translúcidas. Se componen los fondos
   de todos los ancestros: tomar sólo `backgroundColor` del texto falsea justo
   las tarjetas de vidrio que necesitamos vigilar en oscuro. */
async function contrastAudit(frame) {
  return frame.evaluate(() => {
    const rgba = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
      const cssColor = String(value || '').match(/color\(srgb\s+([^)]+)\)/i);
      if (!match && !cssColor) return [0, 0, 0, 0];
      const parts = (match?.[1] || cssColor[1]).split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (cssColor) parts.splice(0, 3, ...parts.slice(0, 3).map((part) => part * 255));
      return [parts[0] || 0, parts[1] || 0, parts[2] || 0, Number.isFinite(parts[3]) ? parts[3] : 1];
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha)
        .concat(alpha);
    };
    const fondo = (element) => {
      const chain = [];
      for (let node = element; node instanceof Element; node = node.parentElement) chain.push(node);
      let color = document.documentElement.dataset.tema === 'oscuro' ? [9, 20, 35, 1] : [242, 242, 247, 1];
      chain.reverse().forEach((node) => {
        const bg = rgba(getComputedStyle(node).backgroundColor);
        if (bg[3]) color = over(bg, color);
      });
      return color;
    };
    const luminance = (color) => {
      const linear = color.slice(0, 3).map((value) => {
        const part = value / 255;
        return part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0
        && rect.width > 1 && rect.height > 1 && !element.closest('[hidden]');
    };
    const seen = new Set();
    const records = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const content = node.textContent.replace(/\s+/g, ' ').trim();
      const owner = node.parentElement;
      if (!content || !owner || !visible(owner) || owner.closest('svg')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (![...range.getClientRects()].some((rect) => rect.width > 1 && rect.height > 1)) continue;
      const style = getComputedStyle(owner);
      const bg = fondo(owner);
      const fg = over(rgba(style.color), bg);
      const l1 = luminance(fg), l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = Number.parseFloat(style.fontSize) || 16;
      const weight = Number.parseInt(style.fontWeight, 10) || (/bold/i.test(style.fontWeight) ? 700 : 400);
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const required = large ? 3 : 4.5;
      const key = `${owner.tagName}.${owner.className || ''}:${content}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        element: `${owner.tagName.toLowerCase()}${owner.id ? `#${owner.id}` : ''}${owner.className ? `.${String(owner.className).trim().replace(/\s+/g, '.')}` : ''}`,
        text: content.slice(0, 100), ratio: Number(ratio.toFixed(2)), required, size, weight,
        backgroundCss: style.backgroundColor,
        foreground: fg.slice(0, 3).map(Math.round), background: bg.slice(0, 3).map(Math.round),
      });
    }
    /* Lucide y los demás pictogramas no tienen nodos de texto. Se toma el
       trazo/relleno realmente calculado de cada figura y se aplica el umbral
       WCAG de 3:1 para componentes gráficos. */
    for (const svg of document.querySelectorAll('svg')) {
      if (!visible(svg)) continue;
      const bg = fondo(svg);
      const shapes = [...svg.querySelectorAll('path,line,polyline,polygon,circle,ellipse,rect')];
      const colors = [];
      for (const shape of shapes.length ? shapes : [svg]) {
        const shapeStyle = getComputedStyle(shape);
        const painted = [shapeStyle.stroke, shapeStyle.fill]
          .map(rgba).filter((color) => color[3]);
        if (!painted.length) painted.push(rgba(shapeStyle.color));
        for (const parsed of painted) {
          if (parsed[3] && !colors.some((item) => item.slice(0, 3).every((part, i) => Math.abs(part - parsed[i]) < .5))) colors.push(parsed);
        }
      }
      for (const color of colors) {
        const fg = over(color, bg);
        const l1 = luminance(fg), l2 = luminance(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        records.push({
          element: `svg${svg.className?.baseVal ? `.${svg.className.baseVal.trim().replace(/\s+/g, '.')}` : ''}`,
          text: svg.closest('button,label')?.getAttribute('title') || svg.getAttribute('aria-label') || 'icono',
          ratio: Number(ratio.toFixed(2)), required: 3, size: svg.getBoundingClientRect().width, weight: 0,
          backgroundCss: getComputedStyle(svg).backgroundColor,
          foreground: fg.slice(0, 3).map(Math.round), background: bg.slice(0, 3).map(Math.round), kind: 'icon',
        });
      }
    }
    const failures = records.filter((item) => item.ratio + 0.005 < item.required);
    return { textElements: records.length, failures: failures.length, examples: failures.slice(0, 30) };
  });
}

async function guionRoundAudit() {
  const sizes = [
    [402, 874, { top: 62, right: 0, bottom: 34, left: 0, legacyBodyPadding: false }],
    [375, 667, { top: 20, right: 0, bottom: 21, left: 0, legacyBodyPadding: false }],
    [874, 402, { top: 0, right: 62, bottom: 21, left: 62, legacyBodyPadding: false }],
  ];
  const report = { generatedAt: new Date().toISOString(), mode, screens: [] };
  const narrative = bundleInfo(narrativeProject).bundle.infographic;
  for (const [width, height, viewportSafeArea] of sizes) {
    const page = await makePage(width, height, narrativeProject, viewportSafeArea);
    await selectProjectView(page, 'guion', 'guionLiterario');
    const tool = page.frames().find((item) => item !== page.mainFrame() && item.url().includes('/infografias/'));
    if (!tool) throw new Error(`No se encontró Guion literario en ${width}x${height}`);
    await tool.waitForSelector('.guion-bloque-texto');
    const literaryBeforeFocus = await tool.evaluate(() => ({
      blocks: document.querySelectorAll('.guion-bloque').length,
      visibleLabels: [...document.querySelectorAll('.guion-tipo-etiqueta')].filter((element) => {
        const rect = element.getBoundingClientRect();
        return getComputedStyle(element).display !== 'none' && rect.width > 1 && rect.height > 1;
      }).length,
      printOption: document.querySelector('#mostrar-tipos-impresion')?.checked ?? null,
    }));
    await tool.locator('.guion-bloque-texto').first().focus();
    await tool.waitForTimeout(100);
    const literaryFocused = await tool.evaluate(() => {
      const bar = document.querySelector('.guion-tipos-barra');
      const rect = bar?.getBoundingClientRect();
      return {
        visibleLabels: [...document.querySelectorAll('.guion-tipo-etiqueta')].filter((element) => {
          const box = element.getBoundingClientRect();
          return getComputedStyle(element).display !== 'none' && box.width > 1 && box.height > 1;
        }).length,
        typeBarVisible: !!bar && rect.width > 1 && rect.height > 1,
      };
    });
    const printed = await tool.evaluate((cfg) => {
      const html = window.PTVSheets?.guion?.(cfg, cfg.titulo || 'Guion') || '';
      const hiddenHtml = window.PTVSheets?.guion?.({
        ...cfg, impresion: { ...(cfg.impresion || {}), mostrarTiposGuion: false },
      }, cfg.titulo || 'Guion') || '';
      const host = document.createElement('div');
      host.innerHTML = html;
      const hiddenHost = document.createElement('div');
      hiddenHost.innerHTML = hiddenHtml;
      return {
        labels: host.querySelectorAll('.gl-tipo').length,
        text: [...host.querySelectorAll('.gl-tipo')].map((item) => item.textContent.trim()),
        labelsWhenDisabled: hiddenHost.querySelectorAll('.gl-tipo').length,
      };
    }, narrative);
    await page.screenshot({ path: path.join(outDir, `${width}x${height}-guion-literario.png`) });
    report.screens.push({
      label: `${width}x${height}-guion-literario`, totals: { lowContrast: 0 },
      literary: { beforeFocus: literaryBeforeFocus, focused: literaryFocused, printed },
    });

    await selectProjectView(page, 'guion', 'escaleta');
    for (const [view, buttonText] of [['tecnico', 'Guion técnico'], ['storyboard', 'Storyboard']]) {
      const button = tool.getByRole('button', { name: new RegExp(buttonText, 'i') }).first();
      if (await button.count()) await button.click();
      await tool.waitForTimeout(120);
      for (const theme of ['claro', 'oscuro']) {
        await page.evaluate((value) => { document.documentElement.dataset.tema = value; }, theme);
        await tool.evaluate((value) => { document.documentElement.dataset.tema = value; }, theme);
        /* La interfaz interpola fondo y tinta durante 180 ms al cambiar tema.
           Medir en mitad de esa transición produce combinaciones que nunca
           quedan estáticas en pantalla y falsos positivos de contraste. */
        await tool.waitForTimeout(240);
        const contrast = await contrastAudit(tool);
        const label = `${width}x${height}-${view}-${theme}`;
        await page.screenshot({ path: path.join(outDir, `${label}.png`) });
        report.screens.push({ label, totals: { lowContrast: contrast.failures }, contrast });
      }
    }
    await closeSurface(page);
  }
  return report;
}

try {
  const report = mode === 'visual' ? await visualAudit()
    : mode === 'mesa' ? await mesaAudit()
    : mode === 'export-webkit' ? await exportAudit()
    : mode === 'export-visual' ? await exportVisualAudit()
    : mode === 'review' ? await reviewAudit()
    : mode === 'guion-focus' ? await focusedGuionAudit()
    : mode === 'guion-round' ? await guionRoundAudit()
    : mode === 'diagram-round' ? await diagramRoundAudit()
    : mode === 'diagram-visual' ? await diagramVisualAudit()
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

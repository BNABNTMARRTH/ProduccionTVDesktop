// Renderizadores compartidos de hojas rellenables (usados por Guías y Exportar).
// Cada función recibe (cfg, projectName, opts) y devuelve el HTML interno de una
// hoja; el consumidor la envuelve en su propio contenedor .sheet.
(() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

  const head = (cfg, projectName, titulo, sub) => `
    <span class="manual-tag">PARA LLENAR A MANO</span>
    <div class="sh-head">
      <div><h1>${esc(titulo)}</h1><p class="sub">${esc(sub)}</p></div>
      <div class="org">${esc(cfg.organizacion || '')}<br>${esc(trunc(cfg.titulo || projectName, 42))}</div>
    </div>
    <div class="sh-meta">
      <span>Fecha de grabación:</span>
      <span>Llenado por:</span>
      <span>Versión / toma:</span>
    </div>`;

  const foot = (n, total) => `<div class="foot"><span>Producción TV · Guía de set</span><span>Al terminar, captura los cambios en la app</span><span>Hoja ${n} / ${total}</span></div>`;

  const sigs = (labels) => `<div class="sig-row">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;

  function escaleta(cfg, projectName, opts = {}) {
    const extra = opts.extraRows ?? 4;
    const byId = {};
    (cfg.camaras || []).forEach((c, i) => { byId[c.id] = c.nombre || ('CAM ' + (i + 1)); });
    (cfg.extras || []).forEach((x) => { byId[x.id] = x.nombre; });
    const rows = (cfg.escaleta || []).map((r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(r.segmento)}</td>
        <td>${esc(trunc(byId[r.fuente] || '—', 18))}</td>
        <td style="text-align:center">${fmt(r.dur)}</td>
        <td class="blank"></td>
        <td class="blank"></td>
      </tr>`).join('');
    const blanks = Array.from({ length: extra }, (_, i) => `
      <tr>
        <td class="num">${(cfg.escaleta || []).length + i + 1}</td>
        <td class="blank"></td><td class="blank"></td><td class="blank"></td><td class="blank"></td><td class="blank"></td>
      </tr>`).join('');
    const total = (cfg.escaleta || []).reduce((a, r) => a + (r.dur || 0), 0);
    return `
      ${head(cfg, projectName, 'Escaleta / Rundown', 'Marca duraciones reales y correcciones durante la grabación')}
      <table>
        <tr><th>#</th><th>Segmento</th><th>Fuente plan</th><th style="width:62px">Dur plan</th><th style="width:70px">Dur real</th><th style="width:36%">Cambios / notas de set</th></tr>
        ${rows}${blanks}
      </table>
      <p class="plan-note">Duración planeada total: <b>${fmt(total)}</b> · Duración real: ________ · Tacha lo que se cayó, agrega segmentos en las filas libres.</p>
      ${sigs(['Director(a)', 'Switcher', 'Continuidad / Script'])}`;
  }

  function camaras(cfg, projectName) {
    const blocks = (cfg.camaras || []).map((c, i) => `
      <div class="cam-block">
        <div class="cam-id">
          <span class="cam-chip" style="background:${esc(c.color || '#16365F')}">${esc(c.nombre || ('CAM ' + (i + 1)))}</span>
          <small>Plano base: ${esc(c.plano || '—')}</small>
          <span class="op">Operador(a):</span>
        </div>
        <div class="writezone" data-label="Encuadres · movimientos · correcciones"><div class="lines"></div></div>
      </div>`).join('');
    return `
      ${head(cfg, projectName, 'Tarjetas de cámara', 'Una tarjeta por cámara: apunta encuadres y ajustes acordados en piso')}
      ${blocks || '<p class="plan-note">Este proyecto no tiene cámaras.</p>'}
      <div class="writezone" data-label="Acuerdos generales de fotografía / iluminación"><div class="lines" style="min-height:108px"></div></div>
      ${sigs(['Director(a) de cámaras', 'Floor manager'])}`;
  }

  // Hoja del PERFIL: el brief del proyecto en una página. Lo capturado se
  // imprime como dato; lo que falte sale como línea en blanco para llenarlo a
  // mano en clase o en junta de producción. Así sirve igual con el proyecto a
  // medias que terminado.
  function perfil(cfg, projectName) {
    const p = cfg.perfil || {};
    const val = (v) => (Array.isArray(v) ? v.join(' · ') : String(v || '').trim());
    const dato = (etiqueta, v, alto) => `
      <div class="writezone" data-label="${esc(etiqueta)}">
        ${val(v)
          ? `<p style="margin:6px 2px;font-size:13px;line-height:1.5">${esc(val(v))}</p>`
          : `<div class="lines"${alto ? ` style="min-height:${alto}px"` : ''}></div>`}
      </div>`;
    const dinero = val(p.presupuesto)
      ? '$' + Number(p.presupuesto).toLocaleString('es-MX') + ' MXN' + (val(p.presupuestoNota) ? ' · ' + val(p.presupuestoNota) : '')
      : '';
    return `
      ${head(cfg, projectName, 'Perfil del proyecto', 'Quién habla, qué dice, a quién y con cuánto')}
      <div class="cat">Quién habla</div>
      ${dato('Emisor — quién produce y firma', p.emisor)}
      <div class="cat">Qué dice</div>
      ${dato('Mensaje — la idea en una frase', p.mensaje, 46)}
      ${dato('Intención — qué quieres que pase en quien lo vea', p.intencion)}
      <div class="cat">A quién</div>
      ${dato('Receptor', p.receptor)}
      ${dato('Edad', p.edad)}
      ${dato('Medios que usa el receptor', p.medios)}
      <div class="cat">Con cuánto</div>
      ${dato('Presupuesto estimado y de dónde sale', dinero)}
      ${sigs(['Productor(a)', 'Director(a)'])}`;
  }

  function checklist(cfg, projectName) {
    const item = (t, extra) => `<div class="check-item"><i></i>${esc(t)}${extra ? `<small>${esc(extra)}</small>` : ''}</div>`;
    const cams = (cfg.camaras || []).map((c, i) => item(`${c.nombre || 'CAM ' + (i + 1)} conectada, balance y foco`, c.plano || ''));
    const mics = (cfg.microfonos || []).map((m) => item(`${m.nombre} probado · pilas`, m.conexion || ''));
    const extras = (cfg.extras || []).filter((x) => !x.esCorte).map((x) => item(`${x.nombre} cargado y probado`));
    const generales = [
      item('Intercom con cabina funcionando'),
      item('Grabación / ISO corriendo'),
      item('Teleprompter con guion actualizado'),
      item('Retornos y monitores en piso'),
      item('Iluminación medida y encendida'),
      item('Set limpio: cables asegurados (gaffer)'),
      item('Talento con mic colocado y probado'),
      item('Claqueta / identificación de toma lista'),
    ];
    return `
      ${head(cfg, projectName, 'Checklist técnico de set', 'Verifica en sitio antes de grabar; marca cada casilla')}
      <div class="cat">Video · ${(cfg.camaras || []).length} cámaras</div><div class="check-grid">${cams.join('')}</div>
      <div class="cat">Audio · ${(cfg.microfonos || []).length} micrófonos</div><div class="check-grid">${mics.join('')}</div>
      ${extras.length ? `<div class="cat">Fuentes y playback</div><div class="check-grid">${extras.join('')}</div>` : ''}
      <div class="cat">Generales</div><div class="check-grid">${generales.join('')}</div>
      <div class="writezone" data-label="Pendientes detectados"><div class="lines"></div></div>
      ${sigs(['Responsable técnico', 'Productor(a)'])}`;
  }

  // Dibuja la planta cenital del set (posiciones guardadas o acomodo automático).
  // `opts.display` la pinta con tinta completa (para el documento final) en vez
  // de la versión ligera para rayar encima.
  // Modo en vivo (tally): `opts.air` = id de la cámara al aire (círculo rojo
  // pulsante, las demás se atenúan), `opts.preview` = id de la siguiente
  // (círculo verde), `opts.badge` = {text,color} cuando la fuente al aire no
  // es una cámara (VTR/corte).
  // Sets del proyecto. Fallback para proyectos viejos donde el único layout
  // vivía en cfg.setLayout/cfg.iluminacion (raíz).
  function setsDe(cfg) {
    if (Array.isArray(cfg.sets) && cfg.sets.length) return cfg.sets;
    return [{
      id: 'set-legado', nombre: 'Set principal',
      locacion: cfg.locacion === 'ext' ? 'ext' : 'int', mesaVisible: true,
      setLayout: cfg.setLayout || {}, iluminacion: cfg.iluminacion || null,
    }];
  }
  function setActivo(cfg) {
    const ss = setsDe(cfg);
    return ss.find((s) => s.id === cfg.setActivo) || ss[0];
  }

  // Talentos. Fallback para proyectos viejos donde los micrófonos hacían de
  // talentos en el plano (se deriva uno por micrófono, con su posición mic:).
  function talentosDe(cfg) {
    if (Array.isArray(cfg.talentos)) return cfg.talentos;
    return (cfg.microfonos || []).map((m, i) => ({
      id: 'tal-' + m.id,
      nombre: String(m.nombre || 'Talento ' + (i + 1)).replace(/^Mic\s*\d*\s*·\s*/i, ''),
      tipo: i === 0 ? 'conductor' : 'invitado',
      _legacyPosKey: 'mic:' + m.id,
    }));
  }

  const MIC_CORTO = { dinamico: 'dinámico', solapa: 'solapa', shotgun: 'shotgun', boom: 'boom' };

  // Mobiliario (espejo del catálogo del generador React).
  const MUEBLES = {
    podio: { es: 'Atril / podio', asientos: [{ x: 0, y: -26 }] },
    sillon1: { es: 'Sillón individual', asientos: [{ x: 0, y: 0 }] },
    sillon2: { es: 'Sofá de 2 plazas', asientos: [{ x: -19, y: 0 }, { x: 19, y: 0 }] },
    sillon3: { es: 'Sofá de 3 plazas', asientos: [{ x: -33, y: 0 }, { x: 0, y: 0 }, { x: 33, y: 0 }] },
    silla: { es: 'Silla', asientos: [{ x: 0, y: 0 }] },
    banco: { es: 'Banco alto', asientos: [{ x: 0, y: 0 }] },
  };
  function muebleGlyph(tipo) {
    const tela = '#93A5BC', asiento = '#C9D4E2', borde = '#5F7189';
    switch (tipo) {
      case 'podio':
        return `<path d="M-17 -12 L17 -12 L12 12 L-12 12 Z" fill="#B4845C" stroke="#8A6543" stroke-width="2"/><rect x="-13" y="-17" width="26" height="7" rx="2.5" fill="#8A6543"/>`;
      case 'sillon2':
        return `<rect x="-38" y="-16" width="76" height="10" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="-38" y="-16" width="9" height="32" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="29" y="-16" width="9" height="32" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="-29" y="-7" width="58" height="22" rx="4" fill="${asiento}" stroke="${borde}" stroke-width="1.5"/><line x1="0" y1="-7" x2="0" y2="15" stroke="${borde}" stroke-width="1" opacity="0.6"/>`;
      case 'sillon3':
        return `<rect x="-52" y="-16" width="104" height="10" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="-52" y="-16" width="9" height="32" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="43" y="-16" width="9" height="32" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="-43" y="-7" width="86" height="22" rx="4" fill="${asiento}" stroke="${borde}" stroke-width="1.5"/><line x1="-17" y1="-7" x2="-17" y2="15" stroke="${borde}" stroke-width="1" opacity="0.6"/><line x1="17" y1="-7" x2="17" y2="15" stroke="${borde}" stroke-width="1" opacity="0.6"/>`;
      case 'silla':
        return `<rect x="-12" y="-14" width="24" height="5" rx="2" fill="${tela}" stroke="${borde}" stroke-width="1.3"/><rect x="-11" y="-8" width="22" height="20" rx="4" fill="${asiento}" stroke="${borde}" stroke-width="1.5"/>`;
      case 'banco':
        return `<circle r="11" fill="${asiento}" stroke="${borde}" stroke-width="1.8"/><circle r="6.5" fill="none" stroke="${borde}" stroke-width="1" opacity="0.6"/>`;
      default: // sillon1
        return `<rect x="-24" y="-16" width="48" height="10" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="-24" y="-16" width="9" height="32" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="15" y="-16" width="9" height="32" rx="4" fill="${tela}" stroke="${borde}" stroke-width="1.5"/><rect x="-15" y="-7" width="30" height="22" rx="4" fill="${asiento}" stroke="${borde}" stroke-width="1.5"/>`;
    }
  }

  // Glifo de un elemento de iluminación, centrado en (0,0). Mismo lenguaje
  // visual que GlyphLuz en el generador React (GeneradorInfografiaTV.jsx).
  function luzGlyph(forma, color) {
    switch (forma) {
      case 'softbox':
        return `<rect x="-10" y="-10" width="20" height="20" rx="3" fill="${color}" stroke="#fff" stroke-width="1.5"/><path d="M-10 -10 L10 10 M10 -10 L-10 10" stroke="#fff" stroke-width="1.2" opacity="0.85"/>`;
      case 'panel':
        return `<rect x="-11" y="-8" width="22" height="16" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/><path d="M-11 -2.5 H11 M-11 2.5 H11 M-5.5 -8 V8 M0 -8 V8 M5.5 -8 V8" stroke="#fff" stroke-width="0.8" opacity="0.7"/>`;
      case 'wash':
        return [0, 60, 120, 180, 240, 300].map((a) => `<line transform="rotate(${a})" x1="0" y1="-13" x2="0" y2="-9.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`).join('')
          + `<circle r="8" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
      case 'tube':
        return `<rect x="-13" y="-4" width="26" height="8" rx="4" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
      case 'top':
        return `<circle r="9" fill="none" stroke="${color}" stroke-width="2.5"/><circle r="3.5" fill="${color}"/>`;
      case 'practical':
        return `<path d="M-8 -2 L8 -2 L4 -11 L-4 -11 Z" fill="${color}" stroke="#fff" stroke-width="1"/><line x1="0" y1="-2" x2="0" y2="8" stroke="${color}" stroke-width="2.5"/><line x1="-5" y1="9" x2="5" y2="9" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
      case 'flag':
        return `<rect x="-9" y="-7" width="18" height="14" rx="2" fill="#1F2937" stroke="${color}" stroke-width="1.5"/>`;
      case 'difusor':
        return `<rect x="-10" y="-8" width="20" height="16" fill="#fff" stroke="${color}" stroke-width="1.8"/><path d="M-6 -8 V8 M-2 -8 V8 M2 -8 V8 M6 -8 V8" stroke="${color}" stroke-width="0.9" opacity="0.7"/>`;
      case 'reflector':
        return `<circle r="9" fill="#fff" stroke="${color}" stroke-width="2"/><path d="M0 -9 A9 9 0 0 1 0 9 Z" fill="${color}" opacity="0.85"/>`;
      case 'control':
        return `<rect x="-8" y="-8" width="16" height="16" rx="3" fill="#fff" stroke="${color}" stroke-width="2"/><circle r="3.5" fill="${color}"/><line x1="0" y1="0" x2="2.6" y2="-2.6" stroke="#fff" stroke-width="1.3"/>`;
      case 'fx':
        return `<path d="M-10 4 a4.5 4.5 0 0 1 0.5 -8.5 a6 6 0 0 1 11.5 -1.5 a4.5 4.5 0 0 1 6.5 4.5 a4 4 0 0 1 -1.5 7.5 h-14.5 a4 4 0 0 1 -2.5 -2" fill="${color}" opacity="0.85" stroke="#fff" stroke-width="1"/>`;
      case 'movil':
        return `<circle r="8" fill="${color}" stroke="#fff" stroke-width="1.5"/><path d="M-1 -12.5 A12.5 12.5 0 0 1 11 -3.5" fill="none" stroke="${color}" stroke-width="1.8"/><path d="M11 -3.5 L7.5 -4.5 M11 -3.5 L11.5 -7.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
      default: // fresnel
        return `<circle r="9" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle r="4" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.9"/>`;
    }
  }

  function planoSvg(cfg, opts = {}) {
    const W = 980, H = 600;
    // Set a dibujar: el indicado en opts.set, o el activo del proyecto.
    const set = opts.set || setActivo(cfg);
    const ext = set.locacion === 'ext';
    const ink = opts.display ? '#16365F' : '#5b6b82';
    const layout = set.setLayout || {};
    const pos = layout.pos || {};
    const rots = layout.rot || {};
    // Etiquetas ocultas individualmente en el editor (doble clic): las hojas
    // impresas las respetan para mantener el plano limpio.
    const labelsOff = layout.labelsOff || {};
    const labOk = (key) => !labelsOff[key];
    const cams = cfg.camaras || [];
    const mics = cfg.microfonos || [];
    const talentos = talentosDe(cfg);
    // En cfgs viejos (sin cfg.talentos) los micrófonos no traen tipo/asignación:
    // se dibujan solo los talentos derivados, sin booms ni sueltos.
    const esLegacy = !Array.isArray(cfg.talentos);
    const camIds = {};
    cams.forEach((c) => { camIds[c.id] = true; });
    const talIds = {};
    talentos.forEach((t) => { talIds[t.id] = true; });
    const booms = esLegacy ? [] : mics.filter((m) => m.micTipo === 'boom');
    const sueltos = esLegacy ? [] : mics.filter((m) => {
      if (m.micTipo === 'boom') return false;
      const a = m.asignadoA || '';
      if (m.micTipo === 'shotgun') return !(a.indexOf('cam:') === 0 && camIds[a.slice(4)]);
      return !(a.indexOf('tal:') === 0 && talIds[a.slice(4)]);
    });
    const micsDeTal = (tid) => esLegacy ? [] : mics.filter((m) => m.micTipo !== 'boom' && m.asignadoA === 'tal:' + tid);
    const shotgunDe = (cid) => esLegacy ? [] : mics.filter((m) => m.micTipo === 'shotgun' && m.asignadoA === 'cam:' + cid);

    const defaults = { mesa: { x: 490, y: 240 } };
    talentos.forEach((t, i) => {
      const k = talentos.length === 1 ? 0 : -1 + (2 * i) / (talentos.length - 1);
      defaults['tal:' + t.id] = { x: 490 + k * Math.min(170, 50 + talentos.length * 26), y: 168 };
    });
    booms.forEach((m, i) => { defaults['mic:' + m.id] = { x: 645 + i * 58, y: 205 }; });
    sueltos.forEach((m, i) => { defaults['mic:' + m.id] = { x: 215 + i * 54, y: 305 }; });
    cams.forEach((c, i) => {
      const t = cams.length === 1 ? 0 : -1 + (2 * i) / (cams.length - 1);
      const a = (t * 70 * Math.PI) / 180;
      defaults['cam:' + c.id] = { x: 490 + Math.sin(a) * 330, y: 250 + Math.cos(a) * 240 };
    });
    const at = (k) => pos[k] || defaults[k] || { x: 490, y: 320 };
    const atTal = (t) => pos['tal:' + t.id] || (t._legacyPosKey && pos[t._legacyPosKey]) || defaults['tal:' + t.id] || { x: 490, y: 320 };
    const mesa = at('mesa');
    const gridColor = ext ? '#DFEBDD' : '#E2E8EF';
    const grid = [];
    for (let i = 1; i <= 17; i++) grid.push(`<line x1="${20 + i * 52}" y1="48" x2="${20 + i * 52}" y2="${H - 22}" stroke="${gridColor}"/>`);
    for (let i = 1; i <= 10; i++) grid.push(`<line x1="22" y1="${48 + i * 52}" x2="958" y2="${48 + i * 52}" stroke="${gridColor}"/>`);

    // Mobiliario con sus ocupantes; los talentos sentados no se dibujan sueltos.
    const muebles = set.muebles || [];
    const sentados = {};
    muebles.forEach((m) => (m.ocupantes || []).forEach((id) => { sentados[id] = true; }));
    const porId = {};
    talentos.forEach((t) => { porId[t.id] = t; });
    const mueblesSvg = muebles.map((m) => {
      const def = MUEBLES[m.tipo] || MUEBLES.sillon1;
      const p = at('mue:' + m.id);
      const manual = rots['mue:' + m.id];
      const rot = typeof manual === 'number' ? manual : 0;
      const ocupantes = (m.ocupantes || []).map((id) => porId[id]).filter(Boolean);
      const gente = ocupantes.map((t, i) => {
        const a = def.asientos[i % def.asientos.length];
        const col = t.tipo === 'invitado' ? '#0E9F9E' : '#16365F';
        return `<g transform="translate(${a.x} ${a.y})">
          <circle r="9" fill="#fff" stroke="${col}" stroke-width="2"/>
          <circle r="3.2" cy="-1.5" fill="${col}"/>
          <path d="M-4.5 2.5 q4.5 5 9 0 l1 4.5 h-11 z" fill="${col}"/>
        </g>`;
      }).join('');
      const nombres = ocupantes.map((t, i) => {
        if (!labOk('tal:' + t.id)) return '';
        const micsT = (esLegacy ? [] : mics.filter((x) => x.micTipo !== 'boom' && x.asignadoA === 'tal:' + t.id));
        const micTxt = micsT.length ? ' · ' + micsT.map((x) => MIC_CORTO[x.micTipo] || 'mic').join(' + ') : '';
        return `<text y="${45 + i * 11}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.tipo === 'invitado' ? '#0E9F9E' : '#33445f'}">${esc(trunc(t.nombre + micTxt, 30))}</text>`;
      }).join('');
      return `<g transform="translate(${p.x} ${p.y})">
        <g transform="rotate(${rot})">${muebleGlyph(m.tipo)}${gente}</g>
        ${labOk('mue:' + m.id) ? `<text y="34" text-anchor="middle" font-size="9" font-weight="700" fill="#5F7189">${esc(def.es.toUpperCase())}</text>` : ''}
        ${nombres}
      </g>`;
    }).join('');

    // Talentos (con tipo C/I y sus micrófonos personales bajo el nombre)
    const talSvg = talentos.filter((t) => !sentados[t.id]).map((t) => {
      const p = atTal(t);
      const col = t.tipo === 'invitado' ? '#0E9F9E' : ink;
      const micsT = micsDeTal(t.id);
      const micTxt = micsT.length && labOk('tal:' + t.id)
        ? `<text y="41" text-anchor="middle" font-size="8.5" font-weight="600" fill="#1FA14E">${esc(trunc(micsT.map((m) => MIC_CORTO[m.micTipo] || 'mic').join(' + '), 26))}</text>`
        : '';
      return `<g transform="translate(${p.x} ${p.y})">
        <circle r="15" fill="${opts.display ? '#fff' : 'none'}" stroke="${col}" stroke-width="2"/>
        <circle r="5" cy="-3" fill="${col}"/>
        <path d="M-7 3 q7 8 14 0 l2 8 h-18 z" fill="${col}"/>
        <circle cx="11.5" cy="-11.5" r="6" fill="${col}"/>
        <text x="11.5" y="-9" text-anchor="middle" font-size="7.5" font-weight="800" fill="#fff">${t.tipo === 'invitado' ? 'I' : 'C'}</text>
        ${labOk('tal:' + t.id) ? `<text y="30" text-anchor="middle" font-size="10" font-weight="700" fill="#33445f">${esc(trunc(t.nombre, 20))}</text>` : ''}
        ${micTxt}
      </g>`;
    }).join('');

    // Booms perchados (giran hacia la mesa/foco o con ángulo manual)
    const boomsSvg = booms.map((m) => {
      const manual = rots['mic:' + m.id];
      const p = at('mic:' + m.id);
      const rot = typeof manual === 'number' ? manual : Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180 / Math.PI;
      return `<g transform="translate(${p.x} ${p.y})">
        <g transform="rotate(${rot})">
          <path d="M8 0 L46 -12 L46 12 Z" fill="#1FA14E" opacity="0.10"/>
          <line x1="-14" y1="0" x2="26" y2="0" stroke="#3C4654" stroke-width="3" stroke-linecap="round"/>
          <rect x="26" y="-4" width="14" height="8" rx="4" fill="#1FA14E" stroke="#fff" stroke-width="1.2"/>
        </g>
        <circle cx="-14" cy="0" r="6" fill="#3C4654"/>
        ${labOk('mic:' + m.id) ? `<text y="24" text-anchor="middle" font-size="9" font-weight="700" fill="#1FA14E">${esc(trunc(m.nombre, 18))} · boom</text>` : ''}
      </g>`;
    }).join('');

    // Micrófonos sueltos (sin asignar)
    const sueltosSvg = sueltos.map((m) => {
      const p = at('mic:' + m.id);
      return `<g transform="translate(${p.x} ${p.y})">
        <circle r="10" fill="${opts.display ? '#fff' : 'none'}" stroke="#1FA14E" stroke-width="2"/>
        <rect x="-2.5" y="-6" width="5" height="8" rx="2.5" fill="#1FA14E"/>
        <path d="M-5 -1 a5 5 0 0 0 10 0 M0 4 V7" stroke="#1FA14E" stroke-width="1.4" fill="none"/>
        ${labOk('mic:' + m.id) ? `<text y="23" text-anchor="middle" font-size="9" font-weight="700" fill="#1FA14E">${esc(trunc(m.nombre, 16))} · ${MIC_CORTO[m.micTipo] || 'mic'}</text>` : ''}
      </g>`;
    }).join('');

    const liveMode = !!(opts.air || opts.preview || opts.badge);
    // Luces del plan de iluminación (instancias autocontenidas en
    // set.iluminacion.luces; dirección: manual > mesa/muro automática).
    // En modo tally se atenúan para que las cámaras dominen la vista.
    const lucesSvg = ((set.iluminacion && set.iluminacion.luces) || []).map((l) => {
      const p = at('luz:' + l.id);
      const manual = rots['luz:' + l.id];
      const auto = l.dir === 'mesa'
        ? Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180 / Math.PI
        : l.dir === 'muro' ? -90 : null;
      const rot = typeof manual === 'number' ? manual : auto;
      const color = esc(l.color || '#F59E0B');
      const beam = rot === null ? '' : `<g transform="rotate(${rot})"><path d="M10 0 L64 -26 L64 26 Z" fill="${color}" opacity="${opts.display ? 0.12 : 0.08}"/></g>`;
      const anillo = l.opcional ? `<circle r="14" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8"/>` : '';
      return `<g transform="translate(${p.x} ${p.y})"${liveMode ? ' opacity="0.3"' : ''}>
        ${beam}${anillo}<g>${luzGlyph(l.forma, color)}</g>
        <rect x="-14" y="-29" width="28" height="12" rx="6" fill="${color}"/>
        <text y="-20" text-anchor="middle" font-size="8" font-weight="800" fill="#fff">${esc(l.abrev || 'LUZ')}</text>
        ${labOk('luz:' + l.id) ? `<text y="27" text-anchor="middle" font-size="9" font-weight="700" fill="#33445f">${esc(trunc(l.nombre, 20))}</text>` : ''}
      </g>`;
    }).join('');
    const camsSvg = cams.map((c, i) => {
      const p = at('cam:' + c.id);
      // Ángulo manual (fijado con la manija en el editor) o seguimiento de la mesa.
      const manual = rots['cam:' + c.id];
      const rot = typeof manual === 'number' ? manual : Math.atan2(mesa.y - p.y, mesa.x - p.x) * 180 / Math.PI;
      const color = esc(c.color || '#16365F');
      const isAir = opts.air === c.id;
      const isPreview = !isAir && opts.preview === c.id;
      const dim = liveMode && !isAir && !isPreview;
      // Tally: rojo pulsante = al aire (programa), verde = siguiente (preview).
      const tally = isAir
        ? `<circle cx="0" cy="-48" r="9" fill="#E0312F" stroke="#fff" stroke-width="2">
             <animate attributeName="opacity" values="1;0.3;1" dur="1.1s" repeatCount="indefinite"/>
           </circle>
           <text x="0" y="-62" text-anchor="middle" font-size="10" font-weight="800" fill="#E0312F">AL AIRE</text>`
        : isPreview
          ? `<circle cx="0" cy="-46" r="7" fill="#1FA14E" stroke="#fff" stroke-width="2"/>
             <text x="0" y="-58" text-anchor="middle" font-size="9" font-weight="800" fill="#1FA14E">SIGUE</text>`
          : '';
      const shot = shotgunDe(c.id).length
        ? `<rect x="4" y="-17" width="22" height="5" rx="2.5" fill="#1FA14E" stroke="#fff" stroke-width="1"/>`
        : '';
      return `<g transform="translate(${p.x} ${p.y})"${dim ? ' opacity="0.4"' : ''}>
        <g transform="rotate(${rot})">
          <path d="M14 0 L78 -24 L78 24 Z" fill="${color}" opacity="${isAir ? 0.32 : opts.display ? 0.16 : 0.12}"/>
          <rect x="-16" y="-10" width="28" height="20" rx="4" fill="${opts.display ? '#1B1F26' : 'none'}" stroke="#33445f" stroke-width="2"/>
          <rect x="12" y="-5" width="7" height="10" fill="#33445f"/>
          ${shot}
        </g>
        <circle cx="0" cy="-24" r="10" fill="${color}"/>
        <text x="0" y="-20" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${i + 1}</text>
        ${labOk('cam:' + c.id) ? `<text x="0" y="34" text-anchor="middle" font-size="10" font-weight="700" fill="#33445f">${esc(trunc(c.nombre, 14))}</text>` : ''}
        ${tally}
      </g>`;
    }).join('');
    // Cuando la fuente al aire no es cámara (VTR, corte…): letrero con su color.
    const badgeSvg = opts.badge
      ? `<g transform="translate(490 110)">
           <rect x="-160" y="-16" width="320" height="32" rx="16" fill="${esc(opts.badge.color || '#64748B')}"/>
           <text y="5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" letter-spacing="1">AL AIRE · ${esc(trunc(opts.badge.text || '', 28))}</text>
         </g>`
      : '';
    // Interior: muro con pantalla. Exterior: sol y etiqueta de locación.
    const cabecera = ext
      ? `<g transform="translate(903 68)">
           <circle r="14" fill="#FCD34D" stroke="#F59E0B" stroke-width="2"/>
           ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line transform="rotate(${a})" x1="0" y1="-19" x2="0" y2="-25" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
         </g>
         <text x="40" y="74" font-size="12" font-weight="800" fill="#4C7C54" letter-spacing="1">LOCACIÓN EXTERIOR</text>`
      : `<rect x="20" y="20" width="940" height="26" rx="12" fill="${opts.display ? '#16365F' : '#33445f'}"/>
         <text x="490" y="72" text-anchor="middle" font-size="12" font-weight="800" fill="#33445f" letter-spacing="1">PANTALLA · ${esc(trunc(cfg.pantalla || '', 42))}</text>`;
    // Mesa del set, o punto de foco cuando el set no tiene mesa.
    const mesaSvg = set.mesaVisible !== false
      ? `<g transform="translate(${mesa.x} ${mesa.y})">
           <rect x="-105" y="-32" width="210" height="64" rx="14" fill="${opts.display ? '#fff' : 'none'}" stroke="${ink}" stroke-width="2.5"/>
           <text y="5" text-anchor="middle" font-size="12" font-weight="800" fill="#33445f">${esc(trunc(cfg.mesa || '', 24))}</text>
         </g>`
      : `<g transform="translate(${mesa.x} ${mesa.y})">
           <circle r="16" fill="none" stroke="#8A97A8" stroke-width="1.6" stroke-dasharray="4 3"/>
           <path d="M-23 0 H23 M0 -23 V23" stroke="#8A97A8" stroke-width="1.4"/>
           <circle r="3" fill="#8A97A8"/>
           <text y="36" text-anchor="middle" font-size="9" font-weight="700" fill="#8A97A8">PUNTO DE FOCO</text>
         </g>`;
    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;border:1px solid #C8D2DE;border-radius:8px">
        <rect x="20" y="20" width="940" height="${H - 40}" rx="12" fill="${ext ? '#F5FAF3' : '#fff'}" stroke="${ext ? '#C4D9C6' : '#C8D2DE'}" stroke-width="2"/>
        ${grid.join('')}
        ${cabecera}
        ${lucesSvg}
        ${mesaSvg}
        ${mueblesSvg}${talSvg}${boomsSvg}${sueltosSvg}${camsSvg}${badgeSvg}
        <text x="40" y="${H - 32}" font-size="10" fill="#8A97A8" letter-spacing="1">${ext ? 'EXTERIOR' : 'ESTUDIO'} · CADA CELDA ≈ 1 m</text>
      </svg>`;
  }

  function plano(cfg, projectName) {
    const sets = setsDe(cfg);
    const planos = sets.map((s) => `
      ${sets.length > 1 ? `<p class="plan-note" style="margin:8px 0 4px"><b>${esc(s.nombre)}</b> · ${s.locacion === 'ext' ? 'Locación exterior' : 'Estudio'}</p>` : ''}
      ${planoSvg(cfg, { set: s })}`).join('');
    return `
      ${head(cfg, projectName, 'Plano del set (cenital)', 'Raya encima: marca movimientos, tiros de cable, luces y zonas')}
      ${planos}
      <div class="writezone" data-label="Anotaciones del plano"><div class="lines"></div></div>
      ${sigs(['Floor manager', 'Director(a)'])}`;
  }

  function iluminacion(cfg, projectName) {
    const sets = setsDe(cfg);
    const bloques = sets.map((s) => {
      const luces = (s.iluminacion && s.iluminacion.luces) || [];
      const filas = luces.map((l, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td><span class="cam-chip" style="background:${esc(l.color || '#16365F')}">${esc(l.abrev || 'LUZ')}</span> ${esc(l.nombre)}</td>
          <td style="text-align:center">${l.opcional ? 'Opcional' : 'Requerida'}</td>
          <td class="blank"></td>
          <td class="blank"></td>
        </tr>`).join('');
      const blanks = Array.from({ length: luces.length ? 3 : 8 }, (_, i) => `
        <tr>
          <td class="num">${luces.length + i + 1}</td>
          <td class="blank"></td><td class="blank"></td><td class="blank"></td><td class="blank"></td>
        </tr>`).join('');
      return `
        ${sets.length > 1 ? `<p class="plan-note" style="margin:8px 0 4px"><b>${esc(s.nombre)}</b> · ${s.locacion === 'ext' ? 'Locación exterior' : 'Estudio'} · ${luces.length} luces</p>` : ''}
        <div style="width:82%;margin:0 auto 8px">${planoSvg(cfg, { set: s })}</div>
        <table>
          <tr><th>#</th><th>Luz</th><th style="width:76px">Tipo</th><th style="width:20%">Potencia / intensidad</th><th style="width:28%">Notas (temperatura, difusión, gelatinas)</th></tr>
          ${filas}${blanks}
        </table>`;
    }).join('');
    return `
      ${head(cfg, projectName, 'Plan de iluminación', 'Posiciones en el plano; anota potencia, temperatura y ajustes reales')}
      ${bloques}
      ${sigs(['Iluminador(a)', 'Director(a) de cámaras'])}`;
  }

  // Hoja de llamado: horarios, locaciones, talento con su micrófono, crew y
  // contactos del día de grabación. Se pre-llena con el proyecto y el resto
  // se captura a mano en producción.
  function llamado(cfg, projectName) {
    const sets = setsDe(cfg);
    const tals = talentosDe(cfg);
    const mics = cfg.microfonos || [];
    const cams = cfg.camaras || [];
    const esLegacy = !Array.isArray(cfg.talentos);
    const micDe = (t) => esLegacy ? '' : mics
      .filter((m) => m.micTipo !== 'boom' && m.asignadoA === 'tal:' + t.id)
      .map((m) => MIC_CORTO[m.micTipo] || 'mic').join(' + ');
    const locaciones = sets.map((s) => `
      <tr>
        <td><b>${esc(s.nombre)}</b> <small style="color:#5b6b82">· ${s.locacion === 'ext' ? 'Exterior' : 'Estudio'}</small></td>
        <td class="blank" style="width:44%"></td>
        <td class="blank" style="width:16%"></td>
      </tr>`).join('');
    const talRows = tals.map((t, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td><b>${esc(t.nombre)}</b></td>
        <td>${t.tipo === 'invitado' ? 'Invitado(a)' : 'Conductor(a)'}</td>
        <td>${esc(micDe(t) || '—')}</td>
        <td class="blank"></td>
        <td class="blank"></td>
      </tr>`).join('');
    const crew = [
      ...(cfg.personal || []).map((p) => p.rol),
      ...(cfg.includeCamOps ? cams.map((c, i) => 'Operador(a) ' + (c.nombre || 'CAM ' + (i + 1))) : []),
    ];
    const crewRows = crew.map((rol, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(rol)}</td>
        <td class="blank"></td>
        <td class="blank"></td>
        <td class="blank"></td>
      </tr>`).join('');
    const contactos = Array.from({ length: 4 }, () => `
      <tr><td class="blank" style="width:34%"></td><td class="blank" style="width:30%"></td><td class="blank"></td></tr>`).join('');
    return `
      ${head(cfg, projectName, 'Hoja de llamado', 'Horarios, locaciones y contactos del día de grabación')}
      <div class="cat">Horarios generales (a llenar)</div>
      <div class="sh-meta">
        <span>Llamado general:</span>
        <span>Inicio de grabación:</span>
        <span>Fin estimado:</span>
      </div>
      <div class="cat">Locaciones / sets (${sets.length})</div>
      <table>
        <tr><th>Set</th><th>Dirección / sala</th><th>Hora en set</th></tr>
        ${locaciones}
      </table>
      <div class="cat">Talento (${tals.length})</div>
      <table>
        <tr><th>#</th><th>Nombre</th><th style="width:104px">Rol</th><th style="width:118px">Micrófono</th><th style="width:86px">Llamado</th><th style="width:86px">Confirmado</th></tr>
        ${talRows || '<tr><td colspan="6">Sin talentos definidos.</td></tr>'}
      </table>
      <div class="cat">Crew (${crew.length})</div>
      <table>
        <tr><th>#</th><th>Rol</th><th style="width:30%">Nombre</th><th style="width:86px">Llamado</th><th style="width:86px">Confirmado</th></tr>
        ${crewRows || '<tr><td colspan="5">Sin crew definido.</td></tr>'}
      </table>
      <div class="cat">Contactos de producción</div>
      <table>
        <tr><th>Nombre</th><th>Rol</th><th>Teléfono</th></tr>
        ${contactos}
      </table>
      <div class="writezone" data-label="Notas: transporte, seguridad, clima, vestuario"><div class="lines"></div></div>
      ${sigs(['Productor(a)', 'Director(a)'])}`;
  }

  function cambios(cfg, projectName) {
    const rows = Array.from({ length: 11 }, () => `
      <tr>
        <td class="blank" style="width:19%"></td>
        <td class="blank" style="width:23%"></td>
        <td class="blank"></td>
        <td style="width:66px;text-align:center"><i style="display:inline-block;width:14px;height:14px;border:2px solid #15233D;border-radius:3px"></i></td>
      </tr>`).join('');
    return `
      ${head(cfg, projectName, 'Registro de cambios', 'El puente de regreso: todo lo corregido a mano se captura después en la app')}
      <p class="plan-note">Anota cada cambio hecho en set con su sección de la app (Escaleta, Cámaras, Audio, Set/Plano, Personal, Diagrama).
      Al volver, ábrelo junto a la app, aplica cada fila y marca <b>“Capturado”</b>. Así la versión digital vuelve a ser la verdad.</p>
      <table>
        <tr><th>Sección de la app</th><th>Elemento</th><th>Cambio realizado en set</th><th>Capturado</th></tr>
        ${rows}
      </table>
      ${sigs(['Continuidad / Script', 'Responsable de captura', 'Fecha de captura'])}`;
  }

  window.PTVSheets = { esc, fmt, trunc, head, foot, sigs, setsDe, perfil, escaleta, camaras, checklist, plano, planoSvg, iluminacion, llamado, cambios };
})();

/* Glifos de equipo compartidos por el diagrama interactivo y su hoja impresa.
   Mantener una sola geometría evita que el plano de papel prometa un equipo
   distinto del que la persona acaba de cablear en pantalla. */
(function (global) {
  'use strict';

  const PATHS = {
    camara: '<path d="M3 7.5h12.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><path d="m17.5 11 5-3v10l-5-3Z"/><path d="M5 7.5 7 4h5l2 3.5"/>',
    microfono: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22M8.5 22h7"/>',
    microfono_inalambrico: '<rect x="8" y="3" width="6" height="11" rx="3"/><path d="M5 11a6 6 0 0 0 12 0M11 17v4M8 21h6M18 6a4 4 0 0 1 0 6M20.5 3.5a7.5 7.5 0 0 1 0 11"/>',
    microfono_solapa: '<circle cx="9" cy="7" r="3.5"/><path d="M9 10.5v3.5a5 5 0 0 0 5 5h1M5.5 16.5h7M15 16v6M12.5 22h5"/>',
    microfono_shotgun: '<path d="M2 11h14a3 3 0 0 1 0 6H2z"/><path d="M5 11V8h9v3M10 17v4M7 21h6M19 10l3-2M20 13h3"/>',
    receptor: '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M7 8V4m10 4V2M7 13h.01M11 13h6M11 16h6"/>',
    switcher: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M6 8h3v3H6zM12 8h3v3h-3zM18 8h.01M6 15h12M9 13v4m6-4v4"/>',
    audio: '<path d="M4 20V9m0-4V2M12 20v-3m0-4V2M20 20v-8m0-4V2"/><path d="M1 9h6M9 17h6M17 8h6"/>',
    encoder: '<rect x="2" y="3" width="16" height="14" rx="2"/><path d="M7 21h6M10 17v4M21 8a4 4 0 0 1 0 6M19 10a2 2 0 0 1 0 2"/>',
    plataforma: '<path d="M6 19h12a4 4 0 0 0 .8-7.9A7 7 0 0 0 5.4 9.2 5 5 0 0 0 6 19Z"/><path d="m10 10 5 3-5 3Z"/>',
    monitor: '<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8M12 18v4"/>',
    fuente: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m9 8 7 4-7 4Z"/>',
    grabador: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    graficos: '<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M6 8h12M6 12h7M8 22h8M12 18v4"/>',
  };

  const LABELS = {
    camara: 'Cámara', microfono: 'Micrófono', receptor: 'Receptor RX',
    switcher: 'Switcher de video', audio: 'Mezcladora de audio',
    encoder: 'Encoder / PC', plataforma: 'Destino / nube', monitor: 'Monitor / TV',
    fuente: 'Playback', grabador: 'Grabador', graficos: 'Gráficos / CG',
  };

  function varianteMicrofono(props) {
    const valor = String((props && (props.micTipo || props.tipo || props.variante || props.conexion)) || '').toLowerCase();
    if (/solapa|lavalier/.test(valor)) return 'microfono_solapa';
    if (/shotgun|boom|ca.n/.test(valor)) return 'microfono_shotgun';
    if (/inal.mbr|wireless|rf/.test(valor)) return 'microfono_inalambrico';
    return 'microfono';
  }

  function clave(type, props) {
    return type === 'microfono' ? varianteMicrofono(props) : type;
  }

  function inner(type, props) {
    return PATHS[clave(type, props)] || PATHS.monitor;
  }

  function svg(type, options) {
    const opts = options || {};
    const size = Number(opts.size) || 24;
    const stroke = opts.stroke || 'currentColor';
    const className = opts.className ? ` class="${String(opts.className).replace(/"/g, '&quot;')}"` : '';
    const hidden = opts.label ? ` role="img" aria-label="${String(opts.label).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
    return `<svg${className}${hidden} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner(type, opts.props)}</svg>`;
  }

  global.PTVEquipmentGlyphs = {
    inner,
    svg,
    label: function (type) { return LABELS[type] || String(type || 'Equipo'); },
    types: Object.keys(LABELS),
  };
})(window);

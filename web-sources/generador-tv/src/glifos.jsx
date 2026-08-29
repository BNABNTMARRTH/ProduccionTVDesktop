// Glifos: los DIBUJOS compartidos de la app (luces y mobiliario en planta).
// Cada glifo se dibuja centrado en (0,0) dentro de un <svg>, así sirve igual
// para el plano cenital grande y para los iconos chicos de los paneles.
// Ojo: existe una copia vanilla de estos mismos dibujos en
// frontend/public/tools/shared/sheets.js (hojas imprimibles); si cambias un
// glifo aquí, cámbialo allá para que el plano y la hoja se vean iguales.

// Glifos de los elementos de iluminación (mismo lenguaje visual que la copia
// vanilla en tools/shared/sheets.js). Se dibujan centrados en (0,0), ~24px.
export function GlyphLuz({ forma, color }) {
  switch (forma) {
    case "softbox":
      return (<g><rect x="-10" y="-10" width="20" height="20" rx="3" fill={color} stroke="#fff" strokeWidth="1.5" /><path d="M-10 -10 L10 10 M10 -10 L-10 10" stroke="#fff" strokeWidth="1.2" opacity="0.85" /></g>);
    case "panel":
      return (<g><rect x="-11" y="-8" width="22" height="16" rx="2" fill={color} stroke="#fff" strokeWidth="1.5" /><path d="M-11 -2.5 H11 M-11 2.5 H11 M-5.5 -8 V8 M0 -8 V8 M5.5 -8 V8" stroke="#fff" strokeWidth="0.8" opacity="0.7" /></g>);
    case "wash":
      return (<g>{[0, 60, 120, 180, 240, 300].map((a) => (<line key={a} transform={`rotate(${a})`} x1="0" y1="-13" x2="0" y2="-9.5" stroke={color} strokeWidth="2" strokeLinecap="round" />))}<circle r="8" fill={color} stroke="#fff" strokeWidth="1.5" /></g>);
    case "tube":
      return (<rect x="-13" y="-4" width="26" height="8" rx="4" fill={color} stroke="#fff" strokeWidth="1.5" />);
    case "top":
      return (<g><circle r="9" fill="none" stroke={color} strokeWidth="2.5" /><circle r="3.5" fill={color} /></g>);
    case "practical":
      return (<g><path d="M-8 -2 L8 -2 L4 -11 L-4 -11 Z" fill={color} stroke="#fff" strokeWidth="1" /><line x1="0" y1="-2" x2="0" y2="8" stroke={color} strokeWidth="2.5" /><line x1="-5" y1="9" x2="5" y2="9" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></g>);
    case "flag":
      return (<rect x="-9" y="-7" width="18" height="14" rx="2" fill="#1F2937" stroke={color} strokeWidth="1.5" />);
    case "difusor":
      return (<g><rect x="-10" y="-8" width="20" height="16" fill="#fff" stroke={color} strokeWidth="1.8" /><path d="M-6 -8 V8 M-2 -8 V8 M2 -8 V8 M6 -8 V8" stroke={color} strokeWidth="0.9" opacity="0.7" /></g>);
    case "reflector":
      return (<g><circle r="9" fill="#fff" stroke={color} strokeWidth="2" /><path d="M0 -9 A9 9 0 0 1 0 9 Z" fill={color} opacity="0.85" /></g>);
    case "control":
      return (<g><rect x="-8" y="-8" width="16" height="16" rx="3" fill="#fff" stroke={color} strokeWidth="2" /><circle r="3.5" fill={color} /><line x1="0" y1="0" x2="2.6" y2="-2.6" stroke="#fff" strokeWidth="1.3" /></g>);
    case "fx":
      return (<path d="M-10 4 a4.5 4.5 0 0 1 0.5 -8.5 a6 6 0 0 1 11.5 -1.5 a4.5 4.5 0 0 1 6.5 4.5 a4 4 0 0 1 -1.5 7.5 h-14.5 a4 4 0 0 1 -2.5 -2" fill={color} opacity="0.85" stroke="#fff" strokeWidth="1" />);
    case "movil":
      return (<g><circle r="8" fill={color} stroke="#fff" strokeWidth="1.5" /><path d="M-1 -12.5 A12.5 12.5 0 0 1 11 -3.5" fill="none" stroke={color} strokeWidth="1.8" /><path d="M11 -3.5 L7.5 -4.5 M11 -3.5 L11.5 -7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></g>);
    case "fresnel":
    default:
      return (<g><circle r="9" fill={color} stroke="#fff" strokeWidth="1.5" /><circle r="4" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.9" /></g>);
  }
}

// Icono chico de una luz para chips y listas del panel de iluminación.
export const LuzIcon = ({ forma, color, size = 15 }) => (
  <svg width={size} height={size} viewBox="-14 -14 28 28" style={{ flex: "0 0 auto", display: "block" }}>
    <GlyphLuz forma={forma} color={color} />
  </svg>
);

// Icono de un mueble para la galería y las tarjetas (escala compartida: un
// sofá se ve más ancho que una silla, como en el plano).
export const MuebleIcon = ({ tipo, width = 58, height = 26 }) => (
  <svg width={width} height={height} viewBox="-56 -24 112 48" style={{ display: "block", flex: "0 0 auto" }}>
    <GlyphMueble tipo={tipo} />
  </svg>
);

// Glifos de mobiliario en planta (frente del mueble hacia abajo; giran con su
// manija). Mismo lenguaje visual que muebleGlyph en tools/shared/sheets.js.
export function GlyphMueble({ tipo }) {
  const tela = "#93A5BC", asiento = "#C9D4E2", borde = "#5F7189";
  switch (tipo) {
    // Las mesas usan las tintas del PLANO (no las de la tela) porque son la
    // superficie de trabajo del set: así se apagan con el tema, igual que la
    // mesa fija a la que sustituyen.
    case "mesa":
      return (<g><rect x="-56" y="-23" width="112" height="46" rx="6" fill="var(--plano-objeto)" stroke="var(--plano-objeto-borde)" strokeWidth="2" /><rect x="-47" y="-14" width="94" height="28" rx="4" fill="none" stroke="var(--plano-objeto-borde)" strokeWidth="1.2" opacity="0.5" /></g>);
    case "mesaRedonda":
      return (<g><circle r="34" fill="var(--plano-objeto)" stroke="var(--plano-objeto-borde)" strokeWidth="2" /><circle r="24" fill="none" stroke="var(--plano-objeto-borde)" strokeWidth="1.2" opacity="0.5" /></g>);
    case "podio":
      return (<g><path d="M-17 -12 L17 -12 L12 12 L-12 12 Z" fill="#B4845C" stroke="#8A6543" strokeWidth="2" /><rect x="-13" y="-17" width="26" height="7" rx="2.5" fill="#8A6543" /></g>);
    case "sillon2":
      return (<g><rect x="-38" y="-16" width="76" height="10" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-38" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="29" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-29" y="-7" width="58" height="22" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /><line x1="0" y1="-7" x2="0" y2="15" stroke={borde} strokeWidth="1" opacity="0.6" /></g>);
    case "sillon3":
      return (<g><rect x="-52" y="-16" width="104" height="10" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-52" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="43" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-43" y="-7" width="86" height="22" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /><line x1="-17" y1="-7" x2="-17" y2="15" stroke={borde} strokeWidth="1" opacity="0.6" /><line x1="17" y1="-7" x2="17" y2="15" stroke={borde} strokeWidth="1" opacity="0.6" /></g>);
    case "silla":
      return (<g><rect x="-12" y="-14" width="24" height="5" rx="2" fill={tela} stroke={borde} strokeWidth="1.3" /><rect x="-11" y="-8" width="22" height="20" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /></g>);
    case "banco":
      return (<g><circle r="11" fill={asiento} stroke={borde} strokeWidth="1.8" /><circle r="6.5" fill="none" stroke={borde} strokeWidth="1" opacity="0.6" /></g>);
    case "sillon1":
    default:
      return (<g><rect x="-24" y="-16" width="48" height="10" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-24" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="15" y="-16" width="9" height="32" rx="4" fill={tela} stroke={borde} strokeWidth="1.5" /><rect x="-15" y="-7" width="30" height="22" rx="4" fill={asiento} stroke={borde} strokeWidth="1.5" /></g>);
  }
}

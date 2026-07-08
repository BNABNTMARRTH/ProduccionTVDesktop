# Generador de infografías de producción TV

App en React + Vite + Tailwind para crear infografías profesionales de producción
de TV: cámaras y planos, escaleta/rundown, flujo de producción, línea de tiempo,
monitores de cabina y personal de operación.

## Funciones

**Infografía**
- Secciones reordenables (arrastrar) y que se abren/cierran como acordeón.
- Lo que dejas cerrado no aparece al imprimir el PDF.
- Exportación a PDF (botón "Imprimir / PDF", horizontal A4).

**Editor**
- Escaleta con arrastrar y soltar + notas por segmento (guion, cues de audio, efectos).
- Buscador en la escaleta (por nombre, fuente, duración o nota).
- Cámaras reordenables, 23 tipos de plano y catálogo de fuentes comunes.
- Deshacer / rehacer (Ctrl+Z / Ctrl+Shift+Z), con autoguardado en el navegador.

**Análisis de tiempos**
- Resumen automático: duración total, contenido neto, cortes y nº de segmentos.
- Avisos: segmentos sin fuente, muy cortos, muy largos o en 00:00.

**Modos extra**
- Teleprompter: pantalla grande con el segmento actual + el siguiente, cronómetro
  por segmento con cuenta regresiva y autoavance.
- Switcher: PGM/PVW, botones de fuente y TAKE/CUT; clic en la escaleta para mandar al aire.
- Línea de tiempo con zoom, desplazamiento horizontal y marcadores de transición.

**Compartir**
- Botón "Compartir" genera un enlace (solo lectura) con el proyecto comprimido en la
  propia URL (sin servidor). Quien lo abra ve la infografía en vivo, sin instalar nada.

**Exportar para edición**
- EDL (CMX 3600) para crear cortes en DaVinci Resolve / Premiere / Avid.
- CSV para Excel/Sheets o como lista de marcadores. Nombres y notas viajan como comentarios.

## Probar en local

```bash
npm install
npm run dev
```

Abre la URL que aparece (normalmente http://localhost:5173).

## Compilar para producción

```bash
npm run build      # genera la carpeta dist/
npm run preview    # previsualiza el build
```

## Desplegar en Vercel

### Opción A - Vercel CLI

```bash
npm i -g vercel
vercel             # primera vez: te pide login y crear el proyecto
vercel --prod      # versión de producción
```

### Opción B - GitHub + Vercel

1. Sube esta carpeta a un repositorio en GitHub.
2. En https://vercel.com entra a Add New -> Project e importa el repo.
3. Vercel detecta Vite solo. Deja la configuración por defecto y pulsa Deploy.

## Notas técnicas

- Proyectos guardados, autoguardado e historial usan localStorage del navegador.
- El enlace para compartir comprime el proyecto con lz-string y lo guarda en el
  hash de la URL (#s=...); no se sube nada a ningún servidor.
- Build de Vercel (autodetectado): comando npm run build, salida dist.

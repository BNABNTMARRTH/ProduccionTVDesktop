# Fuentes de las herramientas

## generador-tv (Infografías)
Aplicación React (Vite + Tailwind). El código fuente vive aquí; la app de escritorio
usa el **build compilado** en `frontend/public/tools/infografias/`.

Para publicar cambios:

```bash
cd web-sources/generador-tv
npm install
npm run build
rm -rf ../../frontend/public/tools/infografias
cp -R dist ../../frontend/public/tools/infografias
```

## Diagrama de señal
Es un HTML autónomo **sin paso de build**. Su única copia canónica está en
`frontend/public/tools/diagrama/index.html` — edítalo directamente ahí.
(Antes existía una copia duplicada en esta carpeta; se eliminó para evitar
que las dos versiones se desincronizaran.)

## Biblioteca (fichas de "cómo se hace")
Herramienta autónoma en `frontend/public/tools/biblioteca/` — el `index.html` se
edita directamente ahí, **pero `datos.js` no**: se genera.

Las fichas salen de preguntarle a los cuadernos de NotebookLM del proyecto (uno
por tema: guion, spots, TikTok, Instagram, Twitch, producción). A cada cuaderno
se le pide el mismo formato — por dónde empezar, pasos, estructura, duración,
errores y checklist — y el script convierte esas respuestas en `datos.js`.

Para regenerarlas, con las respuestas guardadas en `<carpeta>/saber/*.txt`:

```bash
python3 web-sources/armar-biblioteca.py <carpeta>
```

Cada ficha guarda en `fuente` el cuaderno del que salió, y la app lo muestra:
así se puede rastrear de dónde viene cada recomendación.

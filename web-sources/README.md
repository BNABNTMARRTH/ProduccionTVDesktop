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

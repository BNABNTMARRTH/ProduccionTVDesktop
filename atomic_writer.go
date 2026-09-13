package main

import (
	"os"
	"path/filepath"
)

// AtomicFileWriter implementa el patrón Template Method para garantizar
// que las operaciones de escritura en disco nunca dejen archivos a medio
// escribir o corrompidos en caso de cierres abruptos o fallos de energía.
type AtomicFileWriter struct{}

// Write ejecuta el algoritmo de guardado atómico:
// 1. Asegura que el directorio contenedor exista.
// 2. Escribe los datos en un archivo temporal con sufijo '.tmp'.
// 3. Renombra atómicamente el archivo temporal al destino definitivo.
func (w *AtomicFileWriter) Write(path string, data []byte, perm os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, perm); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

var defaultAtomicWriter = &AtomicFileWriter{}

// writeAtomic mantiene compatibilidad con las llamadas existentes en el proyecto.
func writeAtomic(path string, data []byte) error {
	return defaultAtomicWriter.Write(path, data, 0o644)
}

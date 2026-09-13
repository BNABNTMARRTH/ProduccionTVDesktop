package main

import (
	"os"
	"path/filepath"
)

/* --------------------------- Ajustes de la app ---------------------------
Tamaño de la interfaz, contraste, movimiento y tema. Viven en un ARCHIVO en
Application Support para que todas las ventanas (procesos) compartan la misma
configuración sin sobreescribirse con datos desactualizados. */

// SettingsStore gestiona la persistencia de los ajustes de la aplicación.
type SettingsStore struct{}

var defaultSettingsStore = &SettingsStore{}

// ajustesPath es la ruta del archivo de ajustes (creando su carpeta).
func ajustesPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "ProduccionTV")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "ajustes.json"), nil
}

// LoadSettings devuelve los ajustes guardados ("" si todavía no hay).
func (ss *SettingsStore) LoadSettings() (string, error) {
	path, err := ajustesPath()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", nil
	}
	return string(data), nil
}

// SaveSettings escribe los ajustes de forma atómica.
func (ss *SettingsStore) SaveSettings(content string) error {
	path, err := ajustesPath()
	if err != nil {
		return err
	}
	return writeAtomic(path, []byte(content))
}

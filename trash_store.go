package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

/* ----------------------------- Papelera interna ----------------------------- */

// TrashEntry describe un .ptv de la papelera para la UI del lanzador.
type TrashEntry struct {
	Name      string `json:"name"`      // nombre del archivo dentro de Papelera
	Title     string `json:"title"`     // nombre del proyecto guardado (si es legible)
	DeletedAt string `json:"deletedAt"` // fecha de eliminación (hora local)
}

// TrashStore gestiona el almacenamiento seguro y la recuperación de elementos descartados.
type TrashStore struct{}

var defaultTrashStore = &TrashStore{}

// trashDir devuelve (creándola si hace falta) la papelera interna.
func trashDir() (string, error) {
	dir, err := projectsDir()
	if err != nil {
		return "", err
	}
	trash := filepath.Join(dir, "Papelera")
	if err := os.MkdirAll(trash, 0o755); err != nil {
		return "", err
	}
	return trash, nil
}

// sanitizeTrashName acota el nombre a un .ptv plano dentro de la papelera
// (sin rutas), para que el frontend no pueda leer ni borrar otros archivos.
func sanitizeTrashName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	if name == "." || name == ".." || strings.HasPrefix(name, ".") || !strings.HasSuffix(strings.ToLower(name), ".ptv") {
		return ""
	}
	return name
}

// trashTitle lee el nombre del proyecto dentro de un .ptv (acepta el paquete
// {project, infographic, diagram} o un cfg suelto del generador).
func trashTitle(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	var bundle struct {
		Project struct {
			Name string `json:"name"`
		} `json:"project"`
		Infographic struct {
			Titulo string `json:"titulo"`
		} `json:"infographic"`
		Titulo string `json:"titulo"`
	}
	if json.Unmarshal(data, &bundle) != nil {
		return ""
	}
	if bundle.Project.Name != "" {
		return bundle.Project.Name
	}
	if bundle.Infographic.Titulo != "" {
		return bundle.Infographic.Titulo
	}
	return bundle.Titulo
}

// ListTrashFiles enumera la papelera, lo más reciente primero.
func (ts *TrashStore) ListTrashFiles() ([]TrashEntry, error) {
	trash, err := trashDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(trash)
	if err != nil {
		return nil, err
	}
	out := []TrashEntry{}
	for _, e := range entries {
		if e.IsDir() || sanitizeTrashName(e.Name()) == "" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, TrashEntry{
			Name:      e.Name(),
			Title:     trashTitle(filepath.Join(trash, e.Name())),
			DeletedAt: info.ModTime().Format("2006-01-02 15:04"),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DeletedAt > out[j].DeletedAt })
	return out, nil
}

// ReadTrashFile devuelve el contenido de un .ptv de la papelera (vacío si no existe).
func (ts *TrashStore) ReadTrashFile(name string) (string, error) {
	name = sanitizeTrashName(name)
	if name == "" {
		return "", nil
	}
	trash, err := trashDir()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(trash, name))
	if err != nil {
		return "", nil
	}
	return string(data), nil
}

// DeleteTrashFile elimina definitivamente un .ptv de la papelera.
func (ts *TrashStore) DeleteTrashFile(name string) error {
	name = sanitizeTrashName(name)
	if name == "" {
		return nil
	}
	trash, err := trashDir()
	if err != nil {
		return err
	}
	if err := os.Remove(filepath.Join(trash, name)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

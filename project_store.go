package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

/* ------------------- Persistencia de proyectos en disco -------------------
La fuente de verdad de los proyectos es ~/Documents/ProduccionTV: un archivo
.ptv por proyecto (mismo paquete que exporta la app, compartible tal cual).
localStorage del WebView queda solo como caché de arranque. */

// ProjectStore gestiona la lectura, guardado atómico y vigilancia de archivos .ptv.
type ProjectStore struct {
	watchStop chan struct{}
}

var defaultProjectStore = &ProjectStore{}

// projectsDir devuelve (creándola si hace falta) la carpeta de proyectos.
func projectsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, "Documents", "ProduccionTV")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// sanitizeProjectID limita el id a caracteres seguros para nombre de archivo.
func sanitizeProjectID(id string) string {
	var b strings.Builder
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// LoadAllProjects lee todos los .ptv de la carpeta de proyectos.
func (ps *ProjectStore) LoadAllProjects() ([]string, error) {
	dir, err := projectsDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".ptv") {
			continue
		}
		if data, err := os.ReadFile(filepath.Join(dir, e.Name())); err == nil {
			out = append(out, string(data))
		}
	}
	return out, nil
}

// SaveProjectFile escribe el proyecto como <id>.ptv de forma atómica.
func (ps *ProjectStore) SaveProjectFile(id string, content string) error {
	id = sanitizeProjectID(id)
	if id == "" {
		return nil
	}
	dir, err := projectsDir()
	if err != nil {
		return err
	}
	return writeAtomic(filepath.Join(dir, id+".ptv"), []byte(content))
}

// LoadProjectFile lee el .ptv de UN proyecto (cadena vacía si no existe).
func (ps *ProjectStore) LoadProjectFile(id string) (string, error) {
	id = sanitizeProjectID(id)
	if id == "" {
		return "", nil
	}
	dir, err := projectsDir()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(dir, id+".ptv"))
	if err != nil {
		return "", nil
	}
	return string(data), nil
}

// DeleteProjectFile mueve el .ptv a la papelera interna con marca de tiempo.
func (ps *ProjectStore) DeleteProjectFile(id string) error {
	id = sanitizeProjectID(id)
	if id == "" {
		return nil
	}
	dir, err := projectsDir()
	if err != nil {
		return err
	}
	src := filepath.Join(dir, id+".ptv")
	if _, err := os.Stat(src); err != nil {
		return nil
	}
	trash, err := trashDir()
	if err != nil {
		return err
	}
	return os.Rename(src, filepath.Join(trash, id+"-"+time.Now().Format("20060102-150405")+".ptv"))
}

// WatchProject empieza a vigilar el .ptv del proyecto para avisar si otra ventana lo modifica.
func (ps *ProjectStore) WatchProject(ctx context.Context, projectID string) {
	ps.StopWatch()
	id := sanitizeProjectID(projectID)
	if id == "" || ctx == nil {
		return
	}
	dir, err := projectsDir()
	if err != nil {
		return
	}
	path := filepath.Join(dir, id+".ptv")
	parar := make(chan struct{})
	ps.watchStop = parar
	go func() {
		ultima := time.Time{}
		if info, err := os.Stat(path); err == nil {
			ultima = info.ModTime()
		}
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-parar:
				return
			case <-ticker.C:
				info, err := os.Stat(path)
				if err != nil || !info.ModTime().After(ultima) {
					continue
				}
				ultima = info.ModTime()
				data, err := os.ReadFile(path)
				if err != nil {
					continue
				}
				runtime.EventsEmit(ctx, "producciontv:proyecto-en-disco", string(data))
			}
		}
	}()
}

// StopWatch detiene la vigilancia del proyecto.
func (ps *ProjectStore) StopWatch() {
	if ps.watchStop != nil {
		close(ps.watchStop)
		ps.watchStop = nil
	}
}

package main

import (
	"context"
	"encoding/base64"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	projectID    string
	projectJSON  string
	openFileJSON string // contenido de un .ptv abierto con doble clic antes de que el frontend arranque
}

// NewApp creates a new App application struct
func NewApp(projectID string, projectJSON string, openFileJSON string) *App {
	return &App{projectID: projectID, projectJSON: projectJSON, openFileJSON: openFileJSON}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// handleFileOpen recibe la ruta de un proyecto .ptv abierto desde Finder
// (asociación de archivos de macOS). Si el frontend ya corre se le avisa por
// evento; si todavía no, el contenido queda pendiente en GetLaunchContext.
func (a *App) handleFileOpen(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "producciontv:open-file", string(data))
		return
	}
	a.openFileJSON = string(data)
}

// GetLaunchContext lets the frontend distinguish the project launcher from a
// project workspace opened in a separate application window. openedFile trae
// el contenido de un .ptv abierto con doble clic (se entrega una sola vez).
func (a *App) GetLaunchContext() map[string]string {
	mode := "launcher"
	if a.projectID != "" {
		mode = "project"
	}
	opened := a.openFileJSON
	a.openFileJSON = ""
	return map[string]string{"mode": mode, "projectID": a.projectID, "projectJSON": a.projectJSON, "openedFile": opened}
}

// OpenProjectWindow launches a second app process. Wails v2 has one native
// window per process, so this gives every project a genuinely independent
// macOS window while the launcher remains open.
func (a *App) OpenProjectWindow(projectID string, projectJSON string) error {
	if strings.TrimSpace(projectID) == "" {
		return nil
	}
	projectFile, err := os.CreateTemp("", "producciontv-project-*.json")
	if err != nil {
		return err
	}
	projectPath := projectFile.Name()
	if _, err := projectFile.WriteString(projectJSON); err != nil {
		_ = projectFile.Close()
		_ = os.Remove(projectPath)
		return err
	}
	if err := projectFile.Close(); err != nil {
		_ = os.Remove(projectPath)
		return err
	}
	executable, err := os.Executable()
	if err != nil {
		_ = os.Remove(projectPath)
		return err
	}
	cmd := exec.Command(executable, "--project="+projectID, "--project-file="+projectPath)
	cmd.Env = os.Environ()
	if err := cmd.Start(); err != nil {
		_ = os.Remove(projectPath)
		return err
	}
	go func() { _ = cmd.Wait() }()
	return nil
}

// Print opens the native print panel. On macOS, the PDF menu in that panel
// lets the user save the current tool directly as a PDF file.
func (a *App) Print() {
	runtime.WindowPrint(a.ctx)
}

/* ------------------- Persistencia de proyectos en disco -------------------
La fuente de verdad de los proyectos es ~/Documents/ProduccionTV: un archivo
.ptv por proyecto (mismo paquete que exporta la app, compartible tal cual).
localStorage del WebView queda solo como caché de arranque. */

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
func (a *App) LoadAllProjects() ([]string, error) {
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

// SaveProjectFile escribe el proyecto como <id>.ptv (escritura atómica:
// primero a .tmp y luego rename, para no corromper el archivo si algo falla).
func (a *App) SaveProjectFile(id string, content string) error {
	id = sanitizeProjectID(id)
	if id == "" {
		return nil
	}
	dir, err := projectsDir()
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, id+".ptv.tmp")
	if err := os.WriteFile(tmp, []byte(content), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, id+".ptv"))
}

// LoadProjectFile lee el .ptv de UN proyecto (cadena vacía si no existe).
// Lo usan las ventanas para recargar su proyecto si otra ventana lo cambió.
func (a *App) LoadProjectFile(id string) (string, error) {
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

// DeleteProjectFile no borra: mueve el .ptv a la papelera interna
// (~/Documents/ProduccionTV/Papelera) con marca de tiempo, recuperable a mano.
func (a *App) DeleteProjectFile(id string) error {
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
	trash := filepath.Join(dir, "Papelera")
	if err := os.MkdirAll(trash, 0o755); err != nil {
		return err
	}
	return os.Rename(src, filepath.Join(trash, id+"-"+time.Now().Format("20060102-150405")+".ptv"))
}

// fileFilter deduce el filtro del diálogo a partir de la extensión, para que
// guardar CSV/EDL/TXT desde las herramientas no fuerce el filtro JSON.
func fileFilter(filename string) []runtime.FileFilter {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))
	names := map[string]string{
		"ptv":  "Proyecto Producción TV",
		"json": "Proyecto JSON",
		"csv":  "Tabla CSV",
		"edl":  "Lista de edición EDL",
		"txt":  "Archivo de texto",
	}
	name, ok := names[ext]
	if !ok {
		return nil // sin filtro: se respeta el nombre sugerido tal cual
	}
	return []runtime.FileFilter{{DisplayName: name + " (*." + ext + ")", Pattern: "*." + ext}}
}

// SaveTextFile asks for a destination and writes a UTF-8 text file.
func (a *App) SaveTextFile(defaultFilename string, content string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:                "Exportar archivo",
		DefaultFilename:      defaultFilename,
		CanCreateDirectories: true,
		Filters:              fileFilter(defaultFilename),
	})
	if err != nil || path == "" {
		return path, err
	}
	return path, os.WriteFile(path, []byte(content), 0o644)
}

// SaveBase64File asks for a destination and writes a PNG data URL.
func (a *App) SaveBase64File(defaultFilename string, dataURL string) (string, error) {
	if comma := strings.IndexByte(dataURL, ','); comma >= 0 {
		dataURL = dataURL[comma+1:]
	}
	data, err := base64.StdEncoding.DecodeString(dataURL)
	if err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:                "Exportar imagen PNG",
		DefaultFilename:      defaultFilename,
		CanCreateDirectories: true,
		Filters:              []runtime.FileFilter{{DisplayName: "Imagen PNG (*.png)", Pattern: "*.png"}},
	})
	if err != nil || path == "" {
		return path, err
	}
	return path, os.WriteFile(path, data, 0o644)
}

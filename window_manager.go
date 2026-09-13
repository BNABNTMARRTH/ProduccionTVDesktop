package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
)

/* ------------- Una sola ventana por proyecto (registro de PIDs) -------------
Cada ventana es un PROCESO aparte: Wails v2 tiene una ventana nativa por
proceso, y así cada proyecto vive de verdad en su propia ventana de macOS.
El costo es que los procesos no se conocen entre sí, y por eso picarle otra
vez a la tarjeta abría una COPIA del proyecto que ya estaba abierto.

La solución es un buzón compartido: al arrancar, cada ventana de proyecto deja
su PID en un archivito con el nombre del proyecto. Antes de abrir, el lanzador
lo lee: si ese proceso sigue vivo lo trae al frente; si ya no existe, la marca
está vieja, se tira y se abre una ventana nueva. */

const claveInicio = "_inicio"

/* Indirección para poder PROBAR la decisión de arriba sin AppKit: las pruebas
   sustituyen estas dos y simulan una ventana viva que no se deja enfocar. */
var (
	procesoVivo   = processAlive
	traerAlFrente = activateProcess
)

// WindowManager gestiona el registro y foco de ventanas multiproceso en el sistema.
type WindowManager struct{}

var defaultWindowManager = &WindowManager{}

// windowsDir devuelve (creándola si hace falta) la carpeta del registro.
func windowsDir() (string, error) {
	base, err := os.UserCacheDir()
	if err != nil {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "ProduccionTV", "ventanas")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func claveVentana(projectID, toolView string) string {
	id := sanitizeProjectID(projectID)
	if id == "" {
		return claveInicio
	}
	if toolView == "" {
		return id
	}
	return id + "__" + sanitizeProjectID(toolView)
}

// windowMarkPath es la ruta de la marca de una ventana ("" si la clave no sirve).
func windowMarkPath(clave string) string {
	id := sanitizeProjectID(clave)
	if id == "" {
		return ""
	}
	dir, err := windowsDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, id+".pid")
}

// RegisterWindow anota que una ventana tiene abierto su proyecto.
func (wm *WindowManager) RegisterWindow(projectID, toolView string) {
	path := windowMarkPath(claveVentana(projectID, toolView))
	if path == "" {
		return
	}
	_ = os.WriteFile(path, []byte(strconv.Itoa(os.Getpid())), 0o644)
}

// ReleaseWindow borra la marca al cerrarse. Solo borra la SUYA: si otra
// ventana ya reclamó el proyecto, la marca es de esa y no se toca.
func (wm *WindowManager) ReleaseWindow(projectID, toolView string) {
	path := windowMarkPath(claveVentana(projectID, toolView))
	if path == "" {
		return
	}
	if data, err := os.ReadFile(path); err == nil {
		if pid, err := strconv.Atoi(strings.TrimSpace(string(data))); err == nil && pid != os.Getpid() {
			return
		}
	}
	_ = os.Remove(path)
}

// FocusWindow intenta traer al frente la ventana correspondiente a la clave.
func (wm *WindowManager) FocusWindow(clave string) bool {
	path := windowMarkPath(clave)
	if path == "" {
		return false
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 {
		_ = os.Remove(path)
		return false
	}
	if pid == os.Getpid() {
		return false
	}
	if !procesoVivo(pid) {
		_ = os.Remove(path)
		return false
	}
	traerAlFrente(pid)
	return true
}

// FocusProjectWindow trae al frente la ventana que ya tiene abierto el proyecto.
func (wm *WindowManager) FocusProjectWindow(projectID string) bool {
	return wm.FocusWindow(claveVentana(projectID, ""))
}

// FocusToolWindow trae al frente la ventana suelta de un módulo, si existe.
func (wm *WindowManager) FocusToolWindow(projectID string, toolView string) bool {
	return wm.FocusWindow(claveVentana(projectID, toolView))
}

// ListOpenProjects devuelve los ids de los proyectos que ya tienen una ventana abierta.
func (wm *WindowManager) ListOpenProjects() []string {
	out := []string{}
	dir, err := windowsDir()
	if err != nil {
		return out
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return out
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".pid") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
		if err != nil || pid <= 0 || !procesoVivo(pid) {
			_ = os.Remove(path)
			continue
		}
		clave := strings.TrimSuffix(e.Name(), ".pid")
		if strings.HasPrefix(clave, "_") {
			continue
		}
		if corte := strings.Index(clave, "__"); corte >= 0 {
			clave = clave[:corte]
		}
		if !slices.Contains(out, clave) {
			out = append(out, clave)
		}
	}
	sort.Strings(out)
	return out
}

// ListOpenTools dice qué módulos de un proyecto están abiertos en su propia ventana.
func (wm *WindowManager) ListOpenTools(projectID string) []string {
	out := []string{}
	id := sanitizeProjectID(projectID)
	if id == "" {
		return out
	}
	dir, err := windowsDir()
	if err != nil {
		return out
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return out
	}
	prefijo := id + "__"
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".pid") {
			continue
		}
		clave := strings.TrimSuffix(e.Name(), ".pid")
		if !strings.HasPrefix(clave, prefijo) {
			continue
		}
		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
		if err != nil || pid <= 0 || !procesoVivo(pid) {
			_ = os.Remove(path)
			continue
		}
		if vista := strings.TrimPrefix(clave, prefijo); vista != "" && !slices.Contains(out, vista) {
			out = append(out, vista)
		}
	}
	sort.Strings(out)
	return out
}

// OpenProjectWindow abre el proyecto en su propia ventana o trae al frente la existente.
func (wm *WindowManager) OpenProjectWindow(projectID string, projectJSON string) (bool, error) {
	if strings.TrimSpace(projectID) == "" {
		return false, nil
	}
	if wm.FocusProjectWindow(projectID) {
		return false, nil
	}
	projectFile, err := os.CreateTemp("", "producciontv-project-*.json")
	if err != nil {
		return false, err
	}
	projectPath := projectFile.Name()
	if _, err := projectFile.WriteString(projectJSON); err != nil {
		_ = projectFile.Close()
		_ = os.Remove(projectPath)
		return false, err
	}
	if err := projectFile.Close(); err != nil {
		_ = os.Remove(projectPath)
		return false, err
	}
	executable, err := os.Executable()
	if err != nil {
		_ = os.Remove(projectPath)
		return false, err
	}
	cmd := exec.Command(executable, "--project="+projectID, "--project-file="+projectPath)
	cmd.Env = os.Environ()
	if err := cmd.Start(); err != nil {
		_ = os.Remove(projectPath)
		return false, err
	}
	go func() { _ = cmd.Wait() }()
	return true, nil
}

// OpenToolWindow despega un módulo del proyecto y lo abre en su propia ventana.
func (wm *WindowManager) OpenToolWindow(projectID string, toolView string, projectJSON string) (bool, error) {
	if strings.TrimSpace(projectID) == "" || strings.TrimSpace(toolView) == "" {
		return false, nil
	}
	if wm.FocusToolWindow(projectID, toolView) {
		return false, nil
	}
	projectFile, err := os.CreateTemp("", "producciontv-project-*.json")
	if err != nil {
		return false, err
	}
	projectPath := projectFile.Name()
	if _, err := projectFile.WriteString(projectJSON); err != nil {
		_ = projectFile.Close()
		_ = os.Remove(projectPath)
		return false, err
	}
	if err := projectFile.Close(); err != nil {
		_ = os.Remove(projectPath)
		return false, err
	}
	executable, err := os.Executable()
	if err != nil {
		_ = os.Remove(projectPath)
		return false, err
	}
	cmd := exec.Command(executable, "--project="+projectID, "--project-file="+projectPath, "--tool="+toolView)
	cmd.Env = os.Environ()
	if err := cmd.Start(); err != nil {
		_ = os.Remove(projectPath)
		return false, err
	}
	go func() { _ = cmd.Wait() }()
	return true, nil
}

// FocusLauncher trae al frente una ventana de Inicio, y si no hay ninguna abre una nueva.
func (wm *WindowManager) FocusLauncher() error {
	if wm.FocusWindow(claveInicio) {
		return nil
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(executable)
	cmd.Env = os.Environ()
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() { _ = cmd.Wait() }()
	return nil
}

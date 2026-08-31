package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
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
	toolView     string // módulo desanclado que vive solo en esta ventana ("" = ventana de proyecto completa)
	watchStop    chan struct{}
}

// NewApp creates a new App application struct
func NewApp(projectID string, projectJSON string, openFileJSON string, toolView string) *App {
	return &App{projectID: projectID, projectJSON: projectJSON, openFileJSON: openFileJSON, toolView: toolView}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.registerWindow()
}

// shutdown corre al cerrarse la ventana: suelta la marca de "proyecto abierto"
// para que la próxima vez que se pique la tarjeta se abra una ventana nueva.
func (a *App) shutdown(ctx context.Context) {
	a.StopWatch()
	a.releaseWindow()
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
	if a.toolView != "" {
		mode = "tool"
	}
	return map[string]string{"mode": mode, "projectID": a.projectID, "projectJSON": a.projectJSON, "openedFile": opened, "tool": a.toolView}
}

/* ------------- Una sola ventana por proyecto (registro de PIDs) -------------
Cada ventana es un PROCESO aparte: Wails v2 tiene una ventana nativa por
proceso, y así cada proyecto vive de verdad en su propia ventana de macOS.
El costo es que los procesos no se conocen entre sí, y por eso picarle otra
vez a la tarjeta abría una COPIA del proyecto que ya estaba abierto.

La solución es un buzón compartido: al arrancar, cada ventana de proyecto deja
su PID en un archivito con el nombre del proyecto. Antes de abrir, el lanzador
lo lee: si ese proceso sigue vivo lo trae al frente; si ya no existe, la marca
está vieja, se tira y se abre una ventana nueva. Vive en la carpeta de caché
del sistema porque es estado de ejecución, no trabajo del usuario: si se borra
no se pierde nada, y lo peor que pasa es abrir una ventana de más. */

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

// claveVentana identifica lo que ESTA ventana tiene abierto: el proyecto
// entero, o un módulo suelto de ese proyecto. Los ids de proyecto los genera
// uid() y nunca traen guiones bajos, así que "__" separa sin ambigüedad.
func claveVentana(projectID, toolView string) string {
	id := sanitizeProjectID(projectID)
	if id == "" || toolView == "" {
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

// registerWindow anota que ESTA ventana tiene abierto su proyecto.
func (a *App) registerWindow() {
	path := windowMarkPath(claveVentana(a.projectID, a.toolView))
	if path == "" {
		return
	}
	_ = os.WriteFile(path, []byte(strconv.Itoa(os.Getpid())), 0o644)
}

// releaseWindow borra la marca al cerrarse. Solo borra la SUYA: si otra
// ventana ya reclamó el proyecto, la marca es de esa y no se toca.
func (a *App) releaseWindow() {
	path := windowMarkPath(claveVentana(a.projectID, a.toolView))
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

// FocusProjectWindow trae al frente la ventana que ya tiene abierto el
// proyecto y devuelve true. Devuelve false si no hay ninguna — y de paso
// limpia la marca si el proceso anotado ya se cerró.
func (a *App) FocusProjectWindow(projectID string) bool {
	return a.focusWindow(claveVentana(projectID, ""))
}

// FocusToolWindow trae al frente la ventana suelta de un módulo, si existe.
func (a *App) FocusToolWindow(projectID string, toolView string) bool {
	return a.focusWindow(claveVentana(projectID, toolView))
}

/* Indirección para poder PROBAR la decisión de arriba sin AppKit: las pruebas
   sustituyen estas dos y simulan una ventana viva que no se deja enfocar. */
var (
	procesoVivo   = processAlive
	traerAlFrente = activateProcess
)

func (a *App) focusWindow(clave string) bool {
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
	// La propia ventana no se "trae al frente" a sí misma desde el lanzador.
	if pid == os.Getpid() {
		return false
	}
	/* ¿SIGUE VIVA? Esa es la única pregunta que decide si hay que abrir otra
	   ventana — y NO es la misma que "¿pude traerla al frente?".

	   Hasta 2026-08-28 se usaban como si fueran lo mismo: si activateProcess
	   devolvía false se borraba la marca y se abría una ventana NUEVA. Pero
	   desde macOS 14 la activación es cooperativa y falla con la ventana
	   perfectamente viva (lo dice el propio activate_darwin.go). El resultado
	   era una SEGUNDA ventana del mismo módulo o del mismo proyecto: las dos
	   escribiendo el mismo .ptv y pisándose el trabajo entre ellas. Es lo que
	   hacía que arrastrar pestañas a ventanas "se rompiera a los pocos usos".

	   Ahora la marca solo se tira cuando el proceso de verdad ya no está. Si
	   está vivo pero no se deja enfocar, la ventana EXISTE: no se duplica. */
	if !procesoVivo(pid) {
		_ = os.Remove(path)
		return false
	}
	traerAlFrente(pid)
	return true
}

// ListOpenProjects devuelve los ids de los proyectos que ya tienen una
// ventana abierta, para que el lanzador los marque en su tarjeta. De paso
// barre las marcas viejas que dejó una ventana que se cerró de golpe.
func (a *App) ListOpenProjects() []string {
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
		if err != nil || pid <= 0 || !processAlive(pid) {
			_ = os.Remove(path)
			continue
		}
		// Un módulo suelto (proyecto__modulo) cuenta como que el proyecto
		// está abierto: para el lanzador, la tarjeta se marca igual.
		clave := strings.TrimSuffix(e.Name(), ".pid")
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

// OpenProjectWindow abre el proyecto en su propia ventana. Si YA está abierto
// en otra ventana no abre una copia: trae esa al frente. Devuelve true cuando
// abrió una ventana nueva y false cuando reutilizó la que ya estaba, para que
// la interfaz pueda decir cuál de las dos cosas pasó.
func (a *App) OpenProjectWindow(projectID string, projectJSON string) (bool, error) {
	if strings.TrimSpace(projectID) == "" {
		return false, nil
	}
	if a.FocusProjectWindow(projectID) {
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

// OpenToolWindow despega un módulo del proyecto y lo abre en su propia ventana
// de macOS (la pestaña que arrastraste fuera de la barra). Es el mismo truco
// que OpenProjectWindow —un proceso nuevo— pero arrancado en modo módulo, así
// que esa ventana muestra SOLO esa herramienta. Si ese módulo ya tenía ventana,
// se trae al frente en lugar de abrir otra.
func (a *App) OpenToolWindow(projectID string, toolView string, projectJSON string) (bool, error) {
	if strings.TrimSpace(projectID) == "" || strings.TrimSpace(toolView) == "" {
		return false, nil
	}
	if a.FocusToolWindow(projectID, toolView) {
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

// CloseWindow cierra ESTA ventana. La usa el botón "volver a la pestaña" de
// una ventana de módulo suelto: guarda, trae al frente la del proyecto y se va.
func (a *App) CloseWindow() {
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
}

/* ---------------- Aviso de cambios entre ventanas ----------------
Con un módulo desanclado en su propia ventana hay DOS ventanas escribiendo el
mismo proyecto. La fuente de verdad es el .ptv del disco y gana el último
guardado; lo que faltaba era que la otra ventana se enterara sin tener que
hacerle clic. Esto vigila el archivo y avisa al frontend en cuanto cambia.
Es un vistazo a la fecha del archivo cada segundo: no lee ni parsea nada
mientras no haya cambiado. */

// WatchProject empieza a vigilar el .ptv del proyecto de esta ventana.
func (a *App) WatchProject(projectID string) {
	a.StopWatch()
	id := sanitizeProjectID(projectID)
	if id == "" || a.ctx == nil {
		return
	}
	dir, err := projectsDir()
	if err != nil {
		return
	}
	path := filepath.Join(dir, id+".ptv")
	parar := make(chan struct{})
	a.watchStop = parar
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
				runtime.EventsEmit(a.ctx, "producciontv:proyecto-en-disco", string(data))
			}
		}
	}()
}

// StopWatch apaga el vigilante (al cerrar la ventana o cambiar de proyecto).
func (a *App) StopWatch() {
	if a.watchStop != nil {
		close(a.watchStop)
		a.watchStop = nil
	}
}

// SetWindowTitle pone el nombre del proyecto en la barra de la ventana. Con
// varias ventanas abiertas, el título es lo ÚNICO que las distingue en
// Mission Control y en el menú Ventana, así que lo manda el frontend, que es
// quien sabe de verdad qué proyecto terminó cargando.
func (a *App) SetWindowTitle(title string) {
	title = strings.TrimSpace(title)
	if title == "" || a.ctx == nil {
		return
	}
	runtime.WindowSetTitle(a.ctx, title)
}

// Print opens the native print panel. On macOS, the PDF menu in that panel
// lets the user save the current tool directly as a PDF file.
func (a *App) Print() {
	runtime.WindowPrint(a.ctx)
}

// FocusLauncher trae al frente la ventana ORIGINAL de inicio, como la
// pantalla de inicio de Word: el lanzador es el proceso padre que abrió esta
// ventana de proyecto. Si el lanzador ya se cerró, se abre uno nuevo.
// (En desarrollo, si la ventana se lanzó a mano desde una terminal, el padre
// es el shell y se activaría la terminal; en el flujo real siempre es el
// lanzador o la instancia que importó el .ptv.)
func (a *App) FocusLauncher() error {
	// Mismo criterio que focusWindow: si el lanzador sigue vivo NO se abre
	// otro, aunque macOS no nos deje traerlo al frente. Duplicarlo dejaba dos
	// ventanas de Inicio compitiendo por la misma lista de proyectos.
	if padre := os.Getppid(); procesoVivo(padre) {
		traerAlFrente(padre)
		return nil
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(executable)
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() { _ = cmd.Wait() }()
	return nil
}

/* --------------------------- Ajustes de la app ---------------------------
Tamaño de la interfaz, contraste, movimiento y tema. Viven en un ARCHIVO y no
en el localStorage del WebView, y la razón es la de siempre en esta app: CADA
VENTANA ES UN PROCESO. Lo que una guarda en su almacenamiento, las otras no lo
ven — y peor, la siguiente que guarde escribe encima con lo suyo, que está
viejo. Era justo lo que pasaba: cambiabas el tamaño en Inicio, la ventana del
proyecto seguía como estaba, y en cuanto tocabas cualquier ajuste ahí, el
tamaño nuevo se perdía.

El disco es la única verdad que comparten, igual que con los proyectos. Va en
Application Support y no en la caché: la caché se puede vaciar sola, y perder
el tamaño de letra que alguien necesita para poder leer no es un detalle. */

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
func (a *App) LoadSettings() (string, error) {
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

// SaveSettings los escribe (primero a .tmp y luego rename, para que otra
// ventana nunca lea un archivo a medio escribir).
func (a *App) SaveSettings(content string) error {
	path, err := ajustesPath()
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(content), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
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
	trash, err := trashDir()
	if err != nil {
		return err
	}
	return os.Rename(src, filepath.Join(trash, id+"-"+time.Now().Format("20060102-150405")+".ptv"))
}

/* ----------------------------- Papelera interna ----------------------------- */

// TrashEntry describe un .ptv de la papelera para la UI del lanzador.
type TrashEntry struct {
	Name      string `json:"name"`      // nombre del archivo dentro de Papelera
	Title     string `json:"title"`     // nombre del proyecto guardado (si es legible)
	DeletedAt string `json:"deletedAt"` // fecha de eliminación (hora local)
}

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
func (a *App) ListTrashFiles() ([]TrashEntry, error) {
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
func (a *App) ReadTrashFile(name string) (string, error) {
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
func (a *App) DeleteTrashFile(name string) error {
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

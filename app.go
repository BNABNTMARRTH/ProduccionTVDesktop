package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App actúa como el patrón FACADE (Fachada) unificado para el frontend en Wails v2.
// Expone un único punto de entrada limpio mientras delega las responsabilidades
// a subsistemas modulares (WindowManager, ProjectStore, TrashStore, AssetStore, SettingsStore).
type App struct {
	ctx          context.Context
	projectID    string
	projectJSON  string
	openFileJSON string // contenido de un .ptv abierto con doble clic antes de que el frontend arranque
	toolView     string // módulo desanclado que vive solo en esta ventana ("" = ventana de proyecto completa)

	windowMgr     *WindowManager
	projectStore  *ProjectStore
	trashStore    *TrashStore
	assetStore    *AssetStore
	settingsStore *SettingsStore
}

// NewApp creates a new App application struct
func NewApp(projectID string, projectJSON string, openFileJSON string, toolView string) *App {
	return &App{
		projectID:     projectID,
		projectJSON:   projectJSON,
		openFileJSON:  openFileJSON,
		toolView:      toolView,
		windowMgr:     defaultWindowManager,
		projectStore:  defaultProjectStore,
		trashStore:    defaultTrashStore,
		assetStore:    defaultAssetStore,
		settingsStore: defaultSettingsStore,
	}
}

// startup se ejecuta al arrancar la ventana y registra el proceso en el WindowManager.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.registerWindow()
	initColorPanelBackend(ctx)

	// Garantía de seguridad: si OnDomReady tarda más de 600ms por cualquier motivo,
	// asegurar que la ventana sea visible.
	go func() {
		time.Sleep(600 * time.Millisecond)
		if a.ctx != nil {
			runtime.WindowShow(a.ctx)
		}
	}()
}

// domReady se ejecuta cuando el frontend terminó de cargar el DOM y los estilos.
// Muestra la ventana una vez que la interfaz está lista para prevenir el flash blanco inicial.
func (a *App) domReady(ctx context.Context) {
	runtime.WindowShow(ctx)
}

// shutdown se ejecuta al cerrar la ventana y libera la marca en el WindowManager.
func (a *App) shutdown(ctx context.Context) {
	a.StopWatch()
	a.releaseWindow()
}

// handleFileOpen recibe la ruta de un proyecto .ptv abierto desde Finder (asociación de archivos de macOS).
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

// GetLaunchContext permite al frontend distinguir entre el lanzador de proyectos y una ventana de proyecto.
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
	return map[string]string{
		"mode":        mode,
		"projectID":   a.projectID,
		"projectJSON": a.projectJSON,
		"openedFile":  opened,
		"tool":        a.toolView,
	}
}

/* ---------------- Delegación a WindowManager ---------------- */

func (a *App) registerWindow() {
	a.windowMgr.RegisterWindow(a.projectID, a.toolView)
}

func (a *App) releaseWindow() {
	a.windowMgr.ReleaseWindow(a.projectID, a.toolView)
}

func (a *App) FocusProjectWindow(projectID string) bool {
	return a.windowMgr.FocusProjectWindow(projectID)
}

func (a *App) FocusToolWindow(projectID string, toolView string) bool {
	return a.windowMgr.FocusToolWindow(projectID, toolView)
}

func (a *App) focusWindow(clave string) bool {
	return a.windowMgr.FocusWindow(clave)
}

func (a *App) ListOpenProjects() []string {
	return a.windowMgr.ListOpenProjects()
}

func (a *App) ReleaseCurrentProject() {
	a.releaseWindow()
	a.projectID = ""
	a.projectJSON = ""
	a.toolView = ""
}

func (a *App) ClaimProject(projectID string, projectJSON string) bool {
	id := sanitizeProjectID(projectID)
	if id == "" {
		return false
	}
	if a.projectID != id && a.FocusProjectWindow(id) {
		return false
	}
	a.releaseWindow()
	a.projectID = id
	a.projectJSON = projectJSON
	a.toolView = ""
	a.registerWindow()
	return true
}

func (a *App) ListOpenTools(projectID string) []string {
	return a.windowMgr.ListOpenTools(projectID)
}

func (a *App) OpenProjectWindow(projectID string, projectJSON string) (bool, error) {
	return a.windowMgr.OpenProjectWindow(projectID, projectJSON)
}

func (a *App) OpenToolWindow(projectID string, toolView string, projectJSON string) (bool, error) {
	return a.windowMgr.OpenToolWindow(projectID, toolView, projectJSON)
}

func (a *App) CloseWindow() {
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
}

func (a *App) FocusLauncher() error {
	return a.windowMgr.FocusLauncher()
}

func (a *App) SetWindowTitle(title string) {
	title = strings.TrimSpace(title)
	if title == "" || a.ctx == nil {
		return
	}
	runtime.WindowSetTitle(a.ctx, title)
}

func (a *App) Print() {
	if a.ctx != nil {
		runtime.WindowPrint(a.ctx)
	}
}

/* ---------------- Delegación a ProjectStore ---------------- */

func (a *App) WatchProject(projectID string) {
	a.projectStore.WatchProject(a.ctx, projectID)
}

func (a *App) StopWatch() {
	a.projectStore.StopWatch()
}

func (a *App) LoadAllProjects() ([]string, error) {
	return a.projectStore.LoadAllProjects()
}

func (a *App) SaveProjectFile(id string, content string) error {
	return a.projectStore.SaveProjectFile(id, content)
}

func (a *App) LoadProjectFile(id string) (string, error) {
	return a.projectStore.LoadProjectFile(id)
}

func (a *App) DeleteProjectFile(id string) error {
	return a.projectStore.DeleteProjectFile(id)
}

/* ---------------- Delegación a TrashStore ---------------- */

func (a *App) ListTrashFiles() ([]TrashEntry, error) {
	return a.trashStore.ListTrashFiles()
}

func (a *App) ReadTrashFile(name string) (string, error) {
	return a.trashStore.ReadTrashFile(name)
}

func (a *App) DeleteTrashFile(name string) error {
	return a.trashStore.DeleteTrashFile(name)
}

/* ---------------- Delegación a AssetStore ---------------- */

func (a *App) ListReferences() ([]string, error) {
	return a.assetStore.ListReferences()
}

func (a *App) SaveReference(id string, meta string, imageDataURL string) error {
	return a.assetStore.SaveReference(id, meta, imageDataURL)
}

func (a *App) LoadReferenceImage(id string) (string, error) {
	return a.assetStore.LoadReferenceImage(id)
}

func (a *App) DeleteReference(id string) error {
	return a.assetStore.DeleteReference(id)
}

func (a *App) ListContacts() ([]string, error) {
	return a.assetStore.ListContacts()
}

func (a *App) SaveContact(id string, meta string) error {
	return a.assetStore.SaveContact(id, meta)
}

func (a *App) DeleteContact(id string) error {
	return a.assetStore.DeleteContact(id)
}

/* ---------------- Delegación a SettingsStore ---------------- */

func (a *App) LoadSettings() (string, error) {
	return a.settingsStore.LoadSettings()
}

func (a *App) SaveSettings(content string) error {
	return a.settingsStore.SaveSettings(content)
}

/* ---------------- Diálogos Nativos de Guardado ---------------- */

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
		return nil
	}
	return []runtime.FileFilter{{DisplayName: name + " (*." + ext + ")", Pattern: "*." + ext}}
}

// SaveTextFile abre un diálogo nativo para guardar un archivo de texto UTF-8.
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

// SaveBase64File abre un diálogo nativo para guardar una imagen PNG desde un Data URL.
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

// OpenNativeColorPicker abre la ventana nativa de colores de macOS (NSColorPanel)
// semitransparente, en modo de lápices de color, justo debajo de donde se solicita.
func (a *App) OpenNativeColorPicker(elemLeft, elemBottom float64, initialHex string) {
	if a.ctx == nil {
		return
	}
	println("[PTV] OpenNativeColorPicker invoked:", elemLeft, elemBottom, initialHex)
	x, y := runtime.WindowGetPosition(a.ctx)
	openMacColorPanel(float64(x), float64(y), elemLeft, elemBottom, initialHex)
}

// CloseNativeColorPicker cierra el selector de color nativo si está visible.
func (a *App) CloseNativeColorPicker() {
	closeMacColorPanel()
}

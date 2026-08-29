package main

import (
	"embed"
	"encoding/json"
	"log"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	projectID, projectJSON, openFileJSON, toolView := launchData(os.Args[1:])

	// Create an instance of the app structure
	app := NewApp(projectID, projectJSON, openFileJSON, toolView)
	// El TÍTULO de la ventana es el nombre del proyecto: con varias abiertas es
	// lo único que las distingue en Mission Control y en el menú Ventana (antes
	// todas decían "Proyecto" y no se sabía cuál era cuál). Se saca aquí mismo
	// del paquete que trae la ventana para que nazca ya con el nombre puesto;
	// el frontend lo vuelve a mandar por SetWindowTitle cuando termina de
	// cargar, que es cuando sabe de verdad qué proyecto quedó abierto.
	title := "Producción TV — Inicio"
	if projectID != "" {
		title = "Producción TV — Proyecto"
		if name := projectName(projectJSON); name != "" {
			title = name
		}
		// Una ventana de módulo suelto dice de qué módulo es y de qué proyecto:
		// "Guion — Noticiero FCC". Con varias abiertas, es lo que las distingue.
		if toolView != "" {
			title = toolView + " — " + title
		}
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:     title,
		Width:     1440,
		Height:    900,
		MinWidth:  960,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 9, G: 20, B: 35, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Mac: &mac.Options{
			// Doble clic a un .ptv en Finder: macOS entrega la ruta aquí.
			OnFileOpen: app.handleFileOpen,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Fatalf("no se pudo iniciar la aplicación: %v", err)
	}
}

// projectName lee el nombre del proyecto del paquete .ptv que recibe la
// ventana. Acepta el paquete completo {project:{name}} y el cfg suelto del
// generador ({titulo}); si no entiende el contenido devuelve "".
func projectName(projectJSON string) string {
	if strings.TrimSpace(projectJSON) == "" {
		return ""
	}
	var bundle struct {
		Name    string `json:"name"`
		Titulo  string `json:"titulo"`
		Project struct {
			Name string `json:"name"`
		} `json:"project"`
		Infographic struct {
			Titulo string `json:"titulo"`
		} `json:"infographic"`
	}
	if json.Unmarshal([]byte(projectJSON), &bundle) != nil {
		return ""
	}
	for _, candidate := range []string{bundle.Name, bundle.Project.Name, bundle.Infographic.Titulo, bundle.Titulo} {
		if name := strings.TrimSpace(candidate); name != "" {
			return name
		}
	}
	return ""
}

func launchData(args []string) (string, string, string, string) {
	projectID := ""
	projectFile := ""
	openFile := ""
	toolView := ""
	for _, arg := range args {
		if strings.HasPrefix(arg, "--project=") {
			projectID = strings.TrimSpace(strings.TrimPrefix(arg, "--project="))
		}
		if strings.HasPrefix(arg, "--project-file=") {
			projectFile = strings.TrimSpace(strings.TrimPrefix(arg, "--project-file="))
		}
		// Ventana de un módulo desanclado: solo esa herramienta, sin el rail.
		if strings.HasPrefix(arg, "--tool=") {
			toolView = strings.TrimSpace(strings.TrimPrefix(arg, "--tool="))
		}
		// Doble clic a un .ptv en Windows/Linux: la ruta llega como argumento.
		lower := strings.ToLower(arg)
		if !strings.HasPrefix(arg, "--") && (strings.HasSuffix(lower, ".ptv") || strings.HasSuffix(lower, ".json")) {
			openFile = arg
		}
	}
	projectJSON := ""
	if projectFile != "" {
		if data, err := os.ReadFile(projectFile); err == nil {
			projectJSON = string(data)
		}
		_ = os.Remove(projectFile)
	}
	openFileJSON := ""
	if openFile != "" {
		if data, err := os.ReadFile(openFile); err == nil {
			openFileJSON = string(data)
		}
	}
	return projectID, projectJSON, openFileJSON, toolView
}

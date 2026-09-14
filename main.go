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
		/* Una ventana de módulo suelto termina diciendo de qué módulo es y de
		qué proyecto: "Escaleta y guion técnico — Noticiero FCC". Ese nombre lo
		pone el FRONTEND con SetWindowTitle en cuanto carga, porque es el único
		que tiene la tabla de nombres de los módulos.

		Aquí NO se arma: lo que Go tiene a mano es el id interno de la vista
		("escaleta", "production"), y ponerlo en la barra de la ventana dejaba a
		la vista un pedazo del código de la app hasta que el frontend lo
		corregía. Copiar la tabla de nombres a Go sería tener dos verdades que
		se separan a la primera. Así que la ventana nace con el nombre del
		proyecto —que ya es suficiente para distinguirla— y se completa sola. */
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:       title,
		Width:       1440,
		Height:      900,
		MinWidth:    480,
		MinHeight:   500,
		StartHidden: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 242, G: 242, B: 247, A: 0},
		OnStartup:        app.startup,
		OnDomReady:       app.domReady,
		OnShutdown:       app.shutdown,
		Mac: &mac.Options{
			Appearance:           mac.DefaultAppearance,
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
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

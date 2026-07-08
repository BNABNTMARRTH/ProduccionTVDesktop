package main

import (
	"embed"
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
	projectID, projectJSON, openFileJSON := launchData(os.Args[1:])

	// Create an instance of the app structure
	app := NewApp(projectID, projectJSON, openFileJSON)
	title := "Producción TV — Inicio"
	if projectID != "" {
		title = "Producción TV — Proyecto"
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

func launchData(args []string) (string, string, string) {
	projectID := ""
	projectFile := ""
	openFile := ""
	for _, arg := range args {
		if strings.HasPrefix(arg, "--project=") {
			projectID = strings.TrimSpace(strings.TrimPrefix(arg, "--project="))
		}
		if strings.HasPrefix(arg, "--project-file=") {
			projectFile = strings.TrimSpace(strings.TrimPrefix(arg, "--project-file="))
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
	return projectID, projectJSON, openFileJSON
}

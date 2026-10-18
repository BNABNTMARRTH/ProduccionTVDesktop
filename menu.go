package main

import (
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// AppMenuBuilder implementa el patrón BUILDER (GoF) para construir la jerarquía
// completa del menú nativo de macOS (Apple Menu Bar) al estilo OBS Studio / Final Cut Pro.
// Cada acción se conecta con el frontend mediante el patrón COMMAND emitiendo eventos desacoplados.
type AppMenuBuilder struct {
	app *App
}

func NewAppMenuBuilder(app *App) *AppMenuBuilder {
	return &AppMenuBuilder{app: app}
}

// emitMenuAction envía un comando al frontend mediante Wails runtime events.
func (b *AppMenuBuilder) emitMenuAction(actionID string) {
	if b.app != nil && b.app.ctx != nil {
		runtime.EventsEmit(b.app.ctx, "ptv:menu-action", actionID)
	}
}

// Build construye el árbol completo de menú (GoF Composite) para la aplicación.
func (b *AppMenuBuilder) Build() *menu.Menu {
	appMenu := menu.NewMenu()

	//  Menú de la aplicación (About, Services, Preferences, Hide, Quit)
	appSubmenuItem := menu.AppMenu()
	if appSubmenuItem.SubMenu != nil {
		// Insertar "Ajustes..." (⌘,) al inicio del menú de la app
		settingsItem := menu.Text("Ajustes…", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
			b.emitMenuAction("open-settings")
		})
		appSubmenuItem.SubMenu.Prepend(menu.Separator())
		appSubmenuItem.SubMenu.Prepend(settingsItem)
	}
	appMenu.Append(appSubmenuItem)

	// Archivo
	appMenu.Append(b.buildFileSubmenu())

	// Editar (Personalizado 100% en español y limpio)
	appMenu.Append(b.buildEditSubmenu())

	// Vista
	appMenu.Append(b.buildViewSubmenu())

	// Etapas (1 a 5)
	appMenu.Append(b.buildStagesSubmenu())

	// Ventana (Personalizado 100% en español)
	appMenu.Append(b.buildWindowSubmenu())

	// Ayuda
	appMenu.Append(b.buildHelpSubmenu())

	return appMenu
}

// Menú "Archivo" (File)
func (b *AppMenuBuilder) buildFileSubmenu() *menu.MenuItem {
	submenu := menu.NewMenu()

	// Nuevo proyecto (⌘N)
	submenu.AddText("Nuevo proyecto…", keys.CmdOrCtrl("n"), func(_ *menu.CallbackData) {
		b.emitMenuAction("new-project")
	})

	// Guardar proyecto (⌘S)
	submenu.AddText("Guardar proyecto", keys.CmdOrCtrl("s"), func(_ *menu.CallbackData) {
		b.emitMenuAction("save")
	})

	submenu.AddSeparator()

	// Ir a Inicio (⇧⌘H)
	submenu.AddText("Ir a Inicio / Proyectos", keys.Combo("h", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		b.emitMenuAction("goto-home")
	})

	// Desanclar módulo actual (⌘D)
	submenu.AddText("Desanclar módulo en ventana", keys.CmdOrCtrl("d"), func(_ *menu.CallbackData) {
		b.emitMenuAction("unpin")
	})

	// Cerrar pestaña / ventana (⌘W)
	submenu.AddText("Cerrar pestaña", keys.CmdOrCtrl("w"), func(_ *menu.CallbackData) {
		b.emitMenuAction("close-tab")
	})

	return menu.SubMenu("Archivo", submenu)
}

// Menú "Vista" (View)
func (b *AppMenuBuilder) buildViewSubmenu() *menu.MenuItem {
	submenu := menu.NewMenu()

	// Rotar pestañas (⌃Tab)
	submenu.AddText("Siguiente pestaña", keys.Control("Tab"), func(_ *menu.CallbackData) {
		b.emitMenuAction("rotate-tabs")
	})

	return menu.SubMenu("Vista", submenu)
}

// Menú "Etapas" (Específico de Producción TV - Etapas 1 a 5)
func (b *AppMenuBuilder) buildStagesSubmenu() *menu.MenuItem {
	submenu := menu.NewMenu()

	submenu.AddText("1. Pre-producción y Brief", keys.CmdOrCtrl("1"), func(_ *menu.CallbackData) {
		b.emitMenuAction("stage-1")
	})

	submenu.AddText("2. Diseño de Set y Cámaras", keys.CmdOrCtrl("2"), func(_ *menu.CallbackData) {
		b.emitMenuAction("stage-2")
	})

	submenu.AddText("3. Escaleta y Guion Técnico", keys.CmdOrCtrl("3"), func(_ *menu.CallbackData) {
		b.emitMenuAction("stage-3")
	})

	submenu.AddText("4. Sala de Control y Switcher", keys.CmdOrCtrl("4"), func(_ *menu.CallbackData) {
		b.emitMenuAction("stage-4")
	})

	submenu.AddText("5. Post-producción y Archivo", keys.CmdOrCtrl("5"), func(_ *menu.CallbackData) {
		b.emitMenuAction("stage-5")
	})

	return menu.SubMenu("Etapas", submenu)
}

// Menú "Editar" (100% en español, limpio y sin opciones innecesarias en inglés)
func (b *AppMenuBuilder) buildEditSubmenu() *menu.MenuItem {
	submenu := menu.NewMenu()

	// Deshacer (⌘Z)
	submenu.AddText("Deshacer", keys.CmdOrCtrl("z"), func(_ *menu.CallbackData) {
		b.emitMenuAction("undo")
	})

	// Rehacer (⇧⌘Z)
	submenu.AddText("Rehacer", keys.Combo("z", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		b.emitMenuAction("redo")
	})

	submenu.AddSeparator()

	// Cortar (⌘X)
	submenu.AddText("Cortar", keys.CmdOrCtrl("x"), func(_ *menu.CallbackData) {
		b.emitMenuAction("cut")
	})

	// Copiar (⌘C)
	submenu.AddText("Copiar", keys.CmdOrCtrl("c"), func(_ *menu.CallbackData) {
		b.emitMenuAction("copy")
	})

	// Pegar (⌘V)
	submenu.AddText("Pegar", keys.CmdOrCtrl("v"), func(_ *menu.CallbackData) {
		b.emitMenuAction("paste")
	})

	submenu.AddSeparator()

	// Seleccionar todo (⌘A)
	submenu.AddText("Seleccionar todo", keys.CmdOrCtrl("a"), func(_ *menu.CallbackData) {
		b.emitMenuAction("select-all")
	})

	return menu.SubMenu("Editar", submenu)
}

// Menú "Ventana" (100% en español)
func (b *AppMenuBuilder) buildWindowSubmenu() *menu.MenuItem {
	submenu := menu.NewMenu()

	// Minimizar (⌘M)
	submenu.AddText("Minimizar", keys.CmdOrCtrl("m"), func(_ *menu.CallbackData) {
		if b.app != nil && b.app.ctx != nil {
			runtime.WindowMinimise(b.app.ctx)
		}
	})

	// Zoom / Maximizar
	submenu.AddText("Zoom", nil, func(_ *menu.CallbackData) {
		if b.app != nil && b.app.ctx != nil {
			runtime.WindowToggleMaximise(b.app.ctx)
		}
	})

	submenu.AddSeparator()

	// Pantalla completa (⌃⌘F)
	submenu.AddText("Pantalla completa", keys.Combo("f", keys.CmdOrCtrlKey, keys.ControlKey), func(_ *menu.CallbackData) {
		if b.app != nil && b.app.ctx != nil {
			if runtime.WindowIsFullscreen(b.app.ctx) {
				runtime.WindowUnfullscreen(b.app.ctx)
			} else {
				runtime.WindowFullscreen(b.app.ctx)
			}
		}
	})

	return menu.SubMenu("Ventana", submenu)
}

// Menú "Ayuda" (Help)
func (b *AppMenuBuilder) buildHelpSubmenu() *menu.MenuItem {
	submenu := menu.NewMenu()

	submenu.AddText("Ayuda de Producción TV", keys.Key("F1"), func(_ *menu.CallbackData) {
		b.emitMenuAction("open-help")
	})

	submenu.AddText("Guía de bienvenida y atajos", nil, func(_ *menu.CallbackData) {
		b.emitMenuAction("open-welcome")
	})

	return menu.SubMenu("Ayuda", submenu)
}


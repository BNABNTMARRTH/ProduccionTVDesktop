package main

import (
	"os"
	"strconv"
	"strings"
	"testing"
)

func TestLaunchDataTransfersNewProject(t *testing.T) {
	file, err := os.CreateTemp("", "producciontv-launch-test-*.json")
	if err != nil {
		t.Fatal(err)
	}
	path := file.Name()
	payload := `{"id":"project-new","template":"vacio"}`
	if _, err := file.WriteString(payload); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	id, data, opened, tool := launchData([]string{"--project=project-new", "--project-file=" + path})
	if id != "project-new" || data != payload {
		t.Fatalf("unexpected launch data: id=%q data=%q", id, data)
	}
	if opened != "" {
		t.Fatalf("no file open expected, got %q", opened)
	}
	if tool != "" {
		t.Fatalf("no tool window expected, got %q", tool)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("temporary transfer file was not removed: %v", err)
	}

	context := NewApp(id, data, "", "").GetLaunchContext()
	if context["mode"] != "project" || context["projectJSON"] != payload {
		t.Fatalf("unexpected launch context: %#v", context)
	}
}

func TestLaunchDataOpensPtvFile(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "proyecto-*.ptv")
	if err != nil {
		t.Fatal(err)
	}
	payload := `{"project":{"name":"Demo"},"infographic":{"camaras":[]}}`
	if _, err := file.WriteString(payload); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	_, _, opened, _ := launchData([]string{file.Name()})
	if opened != payload {
		t.Fatalf("expected opened file payload, got %q", opened)
	}
	// El archivo del usuario NO debe borrarse (a diferencia del transfer temporal).
	if _, err := os.Stat(file.Name()); err != nil {
		t.Fatalf("user file should still exist: %v", err)
	}

	context := NewApp("", "", opened, "").GetLaunchContext()
	if context["mode"] != "launcher" || context["openedFile"] != payload {
		t.Fatalf("unexpected launch context: %#v", context)
	}
	// openedFile se entrega una sola vez por contexto.
	if again := NewApp("", "", "", "").GetLaunchContext(); again["openedFile"] != "" {
		t.Fatalf("openedFile should default to empty, got %#v", again)
	}
}

func TestSanitizeTrashNameRejectsPaths(t *testing.T) {
	cases := map[string]string{
		"proyecto-20260712-101500.ptv":  "proyecto-20260712-101500.ptv",
		"  demo.PTV ":                   "demo.PTV",
		"../fuera.ptv":                  "fuera.ptv", // Base() recorta la ruta
		"/etc/passwd":                   "",
		"sin-extension":                 "",
		".oculto.ptv":                   "",
		"..":                            "",
		"sub/carpeta/../../../algo.ptv": "algo.ptv",
	}
	for input, expected := range cases {
		if got := sanitizeTrashName(input); got != expected {
			t.Fatalf("sanitizeTrashName(%q) = %q, expected %q", input, got, expected)
		}
	}
}

func TestTrashTitleReadsBundleAndLooseCfg(t *testing.T) {
	dir := t.TempDir()
	write := func(name, content string) string {
		path := dir + "/" + name
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		return path
	}
	cases := map[string]string{
		write("bundle.ptv", `{"project":{"name":"Noticiero 7"},"infographic":{"titulo":"otro"}}`): "Noticiero 7",
		write("solo-info.ptv", `{"infographic":{"titulo":"Matutino"},"diagram":{}}`):              "Matutino",
		write("cfg.ptv", `{"titulo":"Cfg suelto","camaras":[]}`):                                  "Cfg suelto",
		write("roto.ptv", `esto no es json`):                                                      "",
	}
	for path, expected := range cases {
		if got := trashTitle(path); got != expected {
			t.Fatalf("trashTitle(%q) = %q, expected %q", path, got, expected)
		}
	}
}

func TestTrashLifecycle(t *testing.T) {
	t.Setenv("HOME", t.TempDir()) // aísla ~/Documents/ProduccionTV del usuario real
	app := NewApp("", "", "", "")
	payload := `{"project":{"name":"Mi Noticiero","id":"project-x"},"infographic":{"camaras":[]}}`
	if err := app.SaveProjectFile("project-x", payload); err != nil {
		t.Fatal(err)
	}
	if err := app.DeleteProjectFile("project-x"); err != nil {
		t.Fatal(err)
	}
	entries, err := app.ListTrashFiles()
	if err != nil || len(entries) != 1 {
		t.Fatalf("expected 1 trash entry, got %#v (err %v)", entries, err)
	}
	if entries[0].Title != "Mi Noticiero" {
		t.Fatalf("unexpected trash title %q", entries[0].Title)
	}
	content, err := app.ReadTrashFile(entries[0].Name)
	if err != nil || !strings.Contains(content, "Mi Noticiero") {
		t.Fatalf("unexpected trash content %q (err %v)", content, err)
	}
	if err := app.DeleteTrashFile(entries[0].Name); err != nil {
		t.Fatal(err)
	}
	if again, _ := app.ListTrashFiles(); len(again) != 0 {
		t.Fatalf("trash should be empty after purge, got %#v", again)
	}
}

func TestFileFilterMatchesExtension(t *testing.T) {
	cases := map[string]string{
		"proyecto.ptv":  "*.ptv",
		"proyecto.json": "*.json",
		"escaleta.CSV":  "*.csv",
		"cortes.edl":    "*.edl",
		"notas.txt":     "*.txt",
	}
	for filename, pattern := range cases {
		filters := fileFilter(filename)
		if len(filters) != 1 || filters[0].Pattern != pattern {
			t.Fatalf("fileFilter(%q) = %#v, expected pattern %q", filename, filters, pattern)
		}
	}
	if filters := fileFilter("desconocido.xyz"); filters != nil {
		t.Fatalf("fileFilter should be nil for unknown extensions, got %#v", filters)
	}
}

/* --------- Una sola ventana por proyecto ---------
Las pruebas mueven HOME a una carpeta temporal: windowsDir() cuelga de la
carpeta de caché del usuario y así no tocan el registro real de la máquina. */

func TestProjectNameSacaElNombreDelPaquete(t *testing.T) {
	casos := []struct {
		json     string
		esperado string
	}{
		{`{"project":{"name":"Noticiero FCC"},"infographic":{"titulo":"otro"}}`, "Noticiero FCC"},
		{`{"id":"p1","name":"Cortometraje"}`, "Cortometraje"},
		{`{"camaras":[],"titulo":"Cápsula BUAP"}`, "Cápsula BUAP"},
		{`{"project":{"name":"   "}}`, ""},
		{`no es json`, ""},
		{``, ""},
	}
	for _, c := range casos {
		if got := projectName(c.json); got != c.esperado {
			t.Errorf("projectName(%q) = %q, se esperaba %q", c.json, got, c.esperado)
		}
	}
}

func TestVentanaSeRegistraYSeSuelta(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := NewApp("project-abc", "", "", "")
	app.registerWindow()

	path := windowMarkPath("project-abc")
	if path == "" {
		t.Fatal("no se pudo calcular la ruta de la marca")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("la marca no se escribió: %v", err)
	}
	if strings.TrimSpace(string(data)) != strconv.Itoa(os.Getpid()) {
		t.Fatalf("la marca guardó %q, se esperaba el PID propio", string(data))
	}

	app.releaseWindow()
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("la marca debería desaparecer al cerrarse la ventana")
	}
}

func TestVentanaAjenaNoBorraLaMarca(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	path := windowMarkPath("project-abc")
	if err := os.WriteFile(path, []byte("999999"), 0o644); err != nil {
		t.Fatal(err)
	}
	// Esta ventana no es la dueña de la marca: al cerrarse no debe tirarla.
	NewApp("project-abc", "", "", "").releaseWindow()
	if _, err := os.Stat(path); err != nil {
		t.Fatal("una ventana no debe borrar la marca de otra")
	}
}

func TestMarcaViejaNoEnfocaYSeLimpia(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	path := windowMarkPath("project-abc")
	// PID de un proceso que ya no existe: la marca quedó de una ventana que
	// se cerró de golpe y hay que tirarla para poder abrir una nueva.
	if err := os.WriteFile(path, []byte("999999"), 0o644); err != nil {
		t.Fatal(err)
	}
	app := NewApp("", "", "", "")
	if app.FocusProjectWindow("project-abc") {
		t.Fatal("no debería enfocar: ese proceso ya no existe")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("la marca vieja debería quedar limpia")
	}
	if abiertos := app.ListOpenProjects(); len(abiertos) != 0 {
		t.Fatalf("ListOpenProjects debería venir vacío, trajo %v", abiertos)
	}
}

func TestFocusProjectWindowSinMarca(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := NewApp("", "", "", "")
	if app.FocusProjectWindow("project-sin-ventana") {
		t.Fatal("sin marca no hay ventana que enfocar")
	}
	if app.FocusProjectWindow("") {
		t.Fatal("un id vacío no debe enfocar nada")
	}
}

func TestLaunchDataLeeLaVentanaDeModulo(t *testing.T) {
	id, _, _, tool := launchData([]string{"--project=project-x", "--tool=guionLiterario"})
	if id != "project-x" || tool != "guionLiterario" {
		t.Fatalf("id=%q tool=%q", id, tool)
	}
}

func TestClaveVentanaSeparaProyectoDeModulo(t *testing.T) {
	if got := claveVentana("project-x", ""); got != "project-x" {
		t.Fatalf("ventana de proyecto: %q", got)
	}
	if got := claveVentana("project-x", "guionLiterario"); got != "project-x__guionLiterario" {
		t.Fatalf("ventana de módulo: %q", got)
	}
	if got := claveVentana("", "guionLiterario"); got != "" {
		t.Fatalf("sin proyecto no hay clave: %q", got)
	}
}

func TestModuloSueltoCuentaComoProyectoAbierto(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	// Marca viva imposible de verificar aquí (no hay proceso real), así que se
	// comprueba lo contrario: dos marcas MUERTAS del mismo proyecto (la del
	// proyecto y la de un módulo suelto) se barren y no dejan duplicados.
	for _, clave := range []string{"project-x", "project-x__guionLiterario"} {
		if err := os.WriteFile(windowMarkPath(clave), []byte("999999"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if abiertos := NewApp("", "", "", "").ListOpenProjects(); len(abiertos) != 0 {
		t.Fatalf("las marcas muertas deberían barrerse, quedó %v", abiertos)
	}
}


/* ---- La ventana viva que no se deja enfocar (el fallo de las pestañas) ----
macOS 14 puede negar la activación de una ventana que está perfectamente
abierta. Antes eso se interpretaba como "ya no existe": se borraba su marca y
se abría una SEGUNDA ventana del mismo módulo, y las dos escribían el mismo
.ptv. Estas pruebas fijan que vivir y dejarse enfocar son cosas distintas. */

func conProcesos(t *testing.T, vivo func(int) bool, frente func(int) bool) {
	t.Helper()
	vOrig, fOrig := procesoVivo, traerAlFrente
	procesoVivo, traerAlFrente = vivo, frente
	t.Cleanup(func() { procesoVivo, traerAlFrente = vOrig, fOrig })
}

func TestVentanaVivaQueNoSeDejaEnfocarNoSeDuplica(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	// Viva, pero la activación falla (el caso de macOS 14).
	conProcesos(t, func(int) bool { return true }, func(int) bool { return false })
	path := windowMarkPath("project-abc__set")
	if err := os.WriteFile(path, []byte("4242"), 0o644); err != nil {
		t.Fatal(err)
	}
	app := NewApp("", "", "", "")
	if !app.FocusToolWindow("project-abc", "set") {
		t.Fatal("la ventana existe: hay que decir que sí, para no abrir otra")
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal("la marca de una ventana VIVA no se debe borrar")
	}
}

func TestVentanaMuertaSiSeLimpiaAunqueLaActivacionMienta(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	// Muerta; si alguien dijera que se activó, no hay que creerle.
	conProcesos(t, func(int) bool { return false }, func(int) bool { return true })
	path := windowMarkPath("project-abc__set")
	if err := os.WriteFile(path, []byte("4242"), 0o644); err != nil {
		t.Fatal(err)
	}
	app := NewApp("", "", "", "")
	if app.FocusToolWindow("project-abc", "set") {
		t.Fatal("ese proceso ya no existe: no se puede enfocar")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("la marca muerta debería quedar limpia")
	}
}

func TestSeIntentaTraerAlFrenteLaVentanaViva(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	pedido := 0
	conProcesos(t, func(int) bool { return true }, func(pid int) bool { pedido = pid; return true })
	if err := os.WriteFile(windowMarkPath("project-abc"), []byte("777"), 0o644); err != nil {
		t.Fatal(err)
	}
	app := NewApp("", "", "", "")
	if !app.FocusProjectWindow("project-abc") {
		t.Fatal("debería enfocar")
	}
	if pedido != 777 {
		t.Fatalf("se pidió traer al frente el proceso %d y no el 777", pedido)
	}
}

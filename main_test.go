package main

import (
	"os"
	"path/filepath"
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
	// Sin proyecto es la ventana de INICIO, y también se anota: desde que
	// Inicio se convierte en el proyecto no queda un lanzador padre al que
	// volver, así que hay que poder encontrar la ventana de Inicio que exista.
	if got := claveVentana("", ""); got != claveInicio {
		t.Fatalf("ventana de Inicio: %q", got)
	}
	if got := claveVentana("", "guionLiterario"); got != claveInicio {
		t.Fatalf("un módulo sin proyecto no existe: es Inicio, no una clave a medias: %q", got)
	}
	// La clave de Inicio no puede chocar nunca con un id de proyecto: los
	// genera uid() y siempre empiezan por "project-".
	if !strings.HasPrefix(claveInicio, "_") {
		t.Fatalf("la clave reservada tiene que empezar por _ : %q", claveInicio)
	}
}

func TestInicioNoCuentaComoProyectoAbierto(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	if err := os.WriteFile(windowMarkPath(claveInicio), []byte(strconv.Itoa(os.Getpid())), 0o644); err != nil {
		t.Fatal(err)
	}
	original := procesoVivo
	procesoVivo = func(int) bool { return true }
	defer func() { procesoVivo = original }()
	// La marca está VIVA, así que no se barre: si Inicio contara como
	// proyecto, el lanzador pintaría una tarjeta fantasma.
	if abiertos := NewApp("", "", "", "").ListOpenProjects(); len(abiertos) != 0 {
		t.Fatalf("Inicio no es un proyecto, y quedó %v", abiertos)
	}
}

func TestListOpenToolsSoloDevuelveModulosVivosDeSuProyecto(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	// "Vivo" de verdad significa "hay una app NUESTRA con ese pid" (ver
	// pidAlive), y el binario de pruebas no es una app registrada: ni su
	// propio pid pasaría. Se sustituye la pregunta, que para eso existe.
	original := procesoVivo
	procesoVivo = func(pid int) bool { return pid != 999999 }
	defer func() { procesoVivo = original }()
	vivo := strconv.Itoa(os.Getpid())
	marcas := map[string]string{
		"project-x__escaleta":  vivo,
		"project-x__diagrama":  vivo,
		"project-x__exportar":  "999999", // muerto: se barre
		"project-y__escaleta":  vivo,     // de OTRO proyecto
		"project-x":            vivo,     // la ventana del proyecto, no un módulo
		claveInicio:            vivo,
	}
	for clave, pid := range marcas {
		if err := os.WriteFile(windowMarkPath(clave), []byte(pid), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	got := NewApp("", "", "", "").ListOpenTools("project-x")
	if len(got) != 2 || got[0] != "diagrama" || got[1] != "escaleta" {
		t.Fatalf("módulos en ventana de project-x = %v, se esperaba [diagrama escaleta]", got)
	}
	if NewApp("", "", "", "").ListOpenTools("") != nil && len(NewApp("", "", "", "").ListOpenTools("")) != 0 {
		t.Fatalf("sin proyecto no hay módulos")
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

/* La mesa de luz en el disco. Lo que se prueba no es "guarda y lee" sino las
   tres decisiones de diseño que la sostienen, porque son las que se pueden
   romper sin que nada truene:
     · la ficha y la imagen son DOS archivos, y guardar solo etiquetas no
       vuelve a escribir la imagen (que es lo pesado);
     · borrar NO destruye: se va a la papelera y se puede rescatar;
     · una ficha sin su imagen no rompe nada, devuelve vacío. */
func TestMesaDeLuzGuardaFichaEImagenPorSeparado(t *testing.T) {
	t.Setenv("HOME", t.TempDir()) // aísla ~/Documents/ProduccionTV del usuario real
	app := &App{}

	// Un JPEG mínimo de verdad (los dos primeros bytes son la firma SOI).
	const jpegBase64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
	dataURL := "data:image/jpeg;base64," + jpegBase64

	if err := app.SaveReference("ref-uno", `{"id":"ref-uno","plano":"Primer Plano"}`, dataURL); err != nil {
		t.Fatalf("no guardó: %v", err)
	}

	dir, err := referencesDir()
	if err != nil {
		t.Fatal(err)
	}
	ficha := filepath.Join(dir, "ref-uno.json")
	imagen := filepath.Join(dir, "ref-uno.jpg")
	infoAntes, err := os.Stat(imagen)
	if err != nil {
		t.Fatalf("la imagen no quedó en su propio archivo: %v", err)
	}
	if _, err := os.Stat(ficha); err != nil {
		t.Fatalf("la ficha no quedó en su propio archivo: %v", err)
	}

	// La lista trae la ficha, no la imagen.
	fichas, err := app.ListReferences()
	if err != nil || len(fichas) != 1 {
		t.Fatalf("esperaba 1 ficha, hubo %d (err %v)", len(fichas), err)
	}
	if !strings.Contains(fichas[0], "Primer Plano") {
		t.Fatalf("la ficha no trae sus etiquetas: %s", fichas[0])
	}

	// Cambiar SOLO etiquetas no debe tocar el .jpg. Es la razón de partirlo en
	// dos: retocar una etiqueta no puede costar reescribir la imagen entera.
	if err := app.SaveReference("ref-uno", `{"id":"ref-uno","plano":"Plano General"}`, ""); err != nil {
		t.Fatal(err)
	}
	infoDespues, err := os.Stat(imagen)
	if err != nil {
		t.Fatal(err)
	}
	if !infoAntes.ModTime().Equal(infoDespues.ModTime()) {
		t.Fatal("guardar solo etiquetas reescribió la imagen")
	}

	// La imagen completa vuelve como data URL lista para un <img src>.
	vuelta, err := app.LoadReferenceImage("ref-uno")
	if err != nil {
		t.Fatal(err)
	}
	if vuelta != dataURL {
		t.Fatalf("la imagen no volvió igual:\n  fue:   %.40s…\n  volvió: %.40s…", dataURL, vuelta)
	}
}

func TestMesaDeLuzBorrarMandaAPapeleraYNoDestruye(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := &App{}
	dataURL := "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAj/2Q=="
	if err := app.SaveReference("ref-dos", `{"id":"ref-dos"}`, dataURL); err != nil {
		t.Fatal(err)
	}
	if err := app.DeleteReference("ref-dos"); err != nil {
		t.Fatal(err)
	}
	if fichas, _ := app.ListReferences(); len(fichas) != 0 {
		t.Fatalf("la referencia seguía en la fototeca: %d", len(fichas))
	}
	trash, _ := trashDir()
	entradas, _ := os.ReadDir(trash)
	var json, jpg bool
	for _, e := range entradas {
		if strings.HasSuffix(e.Name(), ".json") {
			json = true
		}
		if strings.HasSuffix(e.Name(), ".jpg") {
			jpg = true
		}
	}
	if !json || !jpg {
		t.Fatalf("borrar destruyó en vez de mandar a la papelera (ficha=%v imagen=%v)", json, jpg)
	}
}

func TestMesaDeLuzFichaSinImagenNoRompe(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := &App{}
	// Ficha sin imagen: pasa si alguien borró el .jpg desde el Finder.
	if err := app.SaveReference("ref-tres", `{"id":"ref-tres"}`, ""); err != nil {
		t.Fatal(err)
	}
	img, err := app.LoadReferenceImage("ref-tres")
	if err != nil {
		t.Fatalf("una ficha huérfana devolvió error en vez de vacío: %v", err)
	}
	if img != "" {
		t.Fatalf("esperaba vacío, volvió %.30s…", img)
	}
	// Y un id con trampa no se sale de la carpeta.
	if err := app.SaveReference("../../fuera", `{}`, ""); err != nil {
		t.Fatal(err)
	}
	dir, _ := referencesDir()
	if _, err := os.Stat(filepath.Join(dir, "....fuera.json")); err == nil {
		t.Log("el id se limpió a un nombre inofensivo dentro de la carpeta")
	}
	if _, err := os.Stat(filepath.Join(dir, "..", "..", "fuera.json")); err == nil {
		t.Fatal("un id con ../ escribió FUERA de la carpeta de referencias")
	}
}

/* La agenda en el disco. Mismo criterio que la mesa de luz: se prueban las
   decisiones que se pueden romper en silencio, no que "guarda y lee". */
func TestAgendaGuardaLeeYBorraSinDestruir(t *testing.T) {
	t.Setenv("HOME", t.TempDir()) // aísla ~/Documents/ProduccionTV del usuario real
	app := &App{}

	if err := app.SaveContact("con-uno", `{"id":"con-uno","nombre":"Ana Ríos","rol":"Camarógrafo"}`); err != nil {
		t.Fatalf("no guardó: %v", err)
	}
	fichas, err := app.ListContacts()
	if err != nil || len(fichas) != 1 {
		t.Fatalf("esperaba 1 contacto, hubo %d (err %v)", len(fichas), err)
	}
	if !strings.Contains(fichas[0], "Camarógrafo") {
		t.Fatalf("la ficha perdió sus datos: %s", fichas[0])
	}

	// Guardar otra vez REEMPLAZA, no duplica: es la misma persona.
	if err := app.SaveContact("con-uno", `{"id":"con-uno","nombre":"Ana Ríos","rol":"Directora de fotografía"}`); err != nil {
		t.Fatal(err)
	}
	fichas, _ = app.ListContacts()
	if len(fichas) != 1 {
		t.Fatalf("volver a guardar duplicó la ficha: %d", len(fichas))
	}
	if !strings.Contains(fichas[0], "Directora de fotografía") {
		t.Fatal("no se quedó con la versión nueva")
	}

	// Borrar manda a la papelera: los datos de alguien cuestan meses de conocerlo.
	if err := app.DeleteContact("con-uno"); err != nil {
		t.Fatal(err)
	}
	if fichas, _ := app.ListContacts(); len(fichas) != 0 {
		t.Fatalf("seguía en la agenda: %d", len(fichas))
	}
	trash, _ := trashDir()
	entradas, _ := os.ReadDir(trash)
	rescatable := false
	for _, e := range entradas {
		if strings.HasPrefix(e.Name(), "con-uno") && strings.HasSuffix(e.Name(), ".json") {
			rescatable = true
		}
	}
	if !rescatable {
		t.Fatal("borrar destruyó en vez de mandar a la papelera")
	}
}

func TestAgendaNoSeSaleDeSuCarpeta(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := &App{}
	if err := app.SaveContact("../../fuera", `{}`); err != nil {
		t.Fatal(err)
	}
	dir, _ := contactsDir()
	if _, err := os.Stat(filepath.Join(dir, "..", "..", "fuera.json")); err == nil {
		t.Fatal("un id con ../ escribió FUERA de la carpeta de contactos")
	}
	// Y la agenda y la fototeca no se mezclan aunque vivan al lado.
	if err := app.SaveReference("ref-x", `{"id":"ref-x"}`, ""); err != nil {
		t.Fatal(err)
	}
	contactos, _ := app.ListContacts()
	for _, c := range contactos {
		if strings.Contains(c, "ref-x") {
			t.Fatal("una referencia apareció dentro de la agenda")
		}
	}
	refs, _ := app.ListReferences()
	if len(refs) != 1 {
		t.Fatalf("la fototeca debería tener 1 y tiene %d", len(refs))
	}
}

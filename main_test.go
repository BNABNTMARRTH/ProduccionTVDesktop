package main

import (
	"os"
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

	id, data, opened := launchData([]string{"--project=project-new", "--project-file=" + path})
	if id != "project-new" || data != payload {
		t.Fatalf("unexpected launch data: id=%q data=%q", id, data)
	}
	if opened != "" {
		t.Fatalf("no file open expected, got %q", opened)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("temporary transfer file was not removed: %v", err)
	}

	context := NewApp(id, data, "").GetLaunchContext()
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

	_, _, opened := launchData([]string{file.Name()})
	if opened != payload {
		t.Fatalf("expected opened file payload, got %q", opened)
	}
	// El archivo del usuario NO debe borrarse (a diferencia del transfer temporal).
	if _, err := os.Stat(file.Name()); err != nil {
		t.Fatalf("user file should still exist: %v", err)
	}

	context := NewApp("", "", opened).GetLaunchContext()
	if context["mode"] != "launcher" || context["openedFile"] != payload {
		t.Fatalf("unexpected launch context: %#v", context)
	}
	// openedFile se entrega una sola vez por contexto.
	if again := NewApp("", "", "").GetLaunchContext(); again["openedFile"] != "" {
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
	app := NewApp("", "", "")
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

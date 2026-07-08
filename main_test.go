package main

import (
	"os"
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

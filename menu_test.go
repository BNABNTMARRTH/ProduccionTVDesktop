package main

import (
	"testing"
)

func TestAppMenuBuilder_Build(t *testing.T) {
	app := &App{}
	builder := NewAppMenuBuilder(app)
	m := builder.Build()

	if m == nil {
		t.Fatal("El menú generado no debe ser nil")
	}

	// Debe contener 7 menús de primer nivel:
	// AppMenu (Role 1), Archivo, EditMenu (Role 2), Vista, Etapas, WindowMenu (Role 3), Ayuda
	if len(m.Items) < 7 {
		t.Fatalf("Se esperaban al menos 7 menús principales, se obtuvieron %d", len(m.Items))
	}

	// Menús de primer nivel 100% en español y limpios
	if m.Items[0].Role != 1 { // AppMenuRole
		t.Errorf("Ítem 0 debe tener AppMenuRole (1), tiene %v", m.Items[0].Role)
	}
	if m.Items[1].Label != "Archivo" {
		t.Errorf("Ítem 1 debe ser 'Archivo', tiene '%s'", m.Items[1].Label)
	}
	if m.Items[2].Label != "Editar" {
		t.Errorf("Ítem 2 debe ser 'Editar', tiene '%s'", m.Items[2].Label)
	}
	if m.Items[3].Label != "Vista" {
		t.Errorf("Ítem 3 debe ser 'Vista', tiene '%s'", m.Items[3].Label)
	}
	if m.Items[4].Label != "Etapas" {
		t.Errorf("Ítem 4 debe ser 'Etapas', tiene '%s'", m.Items[4].Label)
	}
	if m.Items[5].Label != "Ventana" {
		t.Errorf("Ítem 5 debe ser 'Ventana', tiene '%s'", m.Items[5].Label)
	}
	if m.Items[6].Label != "Ayuda" {
		t.Errorf("Ítem 6 debe ser 'Ayuda', tiene '%s'", m.Items[6].Label)
	}
}

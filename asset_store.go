package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"time"
)

/* ------------------------------ Mesa de luz y Agenda ------------------------------ */

// AssetStore administra los recursos que viven fuera de los proyectos:
// las referencias visuales de la Mesa de Luz y los contactos de la Agenda.
type AssetStore struct{}

var defaultAssetStore = &AssetStore{}

// referencesDir devuelve (creándola si hace falta) la carpeta de la mesa de luz.
func referencesDir() (string, error) {
	dir, err := projectsDir()
	if err != nil {
		return "", err
	}
	ref := filepath.Join(dir, "Referencias")
	if err := os.MkdirAll(ref, 0o755); err != nil {
		return "", err
	}
	return ref, nil
}

// ListReferences lee la ficha (.json) de todas las referencias.
func (as *AssetStore) ListReferences() ([]string, error) {
	dir, err := referencesDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".json") {
			continue
		}
		if data, err := os.ReadFile(filepath.Join(dir, e.Name())); err == nil {
			out = append(out, string(data))
		}
	}
	return out, nil
}

// SaveReference guarda la ficha y, si viene, la imagen completa de forma atómica.
func (as *AssetStore) SaveReference(id string, meta string, imageDataURL string) error {
	id = sanitizeProjectID(id)
	if id == "" {
		return nil
	}
	dir, err := referencesDir()
	if err != nil {
		return err
	}
	if imageDataURL != "" {
		if comma := strings.IndexByte(imageDataURL, ','); comma >= 0 {
			imageDataURL = imageDataURL[comma+1:]
		}
		data, err := base64.StdEncoding.DecodeString(imageDataURL)
		if err != nil {
			return err
		}
		if err := writeAtomic(filepath.Join(dir, id+".jpg"), data); err != nil {
			return err
		}
	}
	return writeAtomic(filepath.Join(dir, id+".json"), []byte(meta))
}

// LoadReferenceImage devuelve la imagen completa como data URL, lista para un <img src>.
func (as *AssetStore) LoadReferenceImage(id string) (string, error) {
	id = sanitizeProjectID(id)
	if id == "" {
		return "", nil
	}
	dir, err := referencesDir()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(dir, id+".jpg"))
	if err != nil {
		return "", nil
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(data), nil
}

// DeleteReference mueve ficha e imagen a la papelera interna con marca de tiempo.
func (as *AssetStore) DeleteReference(id string) error {
	id = sanitizeProjectID(id)
	if id == "" {
		return nil
	}
	dir, err := referencesDir()
	if err != nil {
		return err
	}
	trash, err := trashDir()
	if err != nil {
		return err
	}
	marca := time.Now().Format("20060102-150405")
	for _, ext := range []string{".json", ".jpg"} {
		origen := filepath.Join(dir, id+ext)
		if _, err := os.Stat(origen); err != nil {
			continue
		}
		if err := os.Rename(origen, filepath.Join(trash, id+"-"+marca+ext)); err != nil {
			return err
		}
	}
	return nil
}

// contactsDir devuelve (creándola si hace falta) la carpeta de la agenda.
func contactsDir() (string, error) {
	dir, err := projectsDir()
	if err != nil {
		return "", err
	}
	con := filepath.Join(dir, "Contactos")
	if err := os.MkdirAll(con, 0o755); err != nil {
		return "", err
	}
	return con, nil
}

// ListContacts lee la ficha de todas las personas de la agenda.
func (as *AssetStore) ListContacts() ([]string, error) {
	dir, err := contactsDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".json") {
			continue
		}
		if data, err := os.ReadFile(filepath.Join(dir, e.Name())); err == nil {
			out = append(out, string(data))
		}
	}
	return out, nil
}

// SaveContact guarda (o reemplaza) la ficha de una persona atómicamente.
func (as *AssetStore) SaveContact(id string, meta string) error {
	id = sanitizeProjectID(id)
	if id == "" {
		return nil
	}
	dir, err := contactsDir()
	if err != nil {
		return err
	}
	return writeAtomic(filepath.Join(dir, id+".json"), []byte(meta))
}

// DeleteContact mueve la ficha a la papelera interna con marca de tiempo.
func (as *AssetStore) DeleteContact(id string) error {
	id = sanitizeProjectID(id)
	if id == "" {
		return nil
	}
	dir, err := contactsDir()
	if err != nil {
		return err
	}
	trash, err := trashDir()
	if err != nil {
		return err
	}
	origen := filepath.Join(dir, id+".json")
	if _, err := os.Stat(origen); err != nil {
		return nil
	}
	return os.Rename(origen, filepath.Join(trash, id+"-"+time.Now().Format("20060102-150405")+".json"))
}

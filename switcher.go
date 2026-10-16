package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

// SwitcherStatus es el contrato estable que recibe el frontend y el payload
// del evento Wails ptv:switcher-estado.
type SwitcherStatus struct {
	Kind      string `json:"kind"`
	Estado    string `json:"estado"`
	Conectado bool   `json:"conectado"`
	Programa  string `json:"programa"`
	Preview   string `json:"preview"`
	Error     string `json:"error"`
}

// Switcher abstrae los dos protocolos. Connect debe respetar el contexto; el
// gestor siempre le entrega uno con un máximo de tres segundos.
type Switcher interface {
	Connect(ctx context.Context, host string, port int, password string) error
	Disconnect()
	SetProgram(input string) error
	SetPreview(input string) error
	Status() SwitcherStatus
	ListInputs() ([]string, error)
}

type SwitcherManager struct {
	mu         sync.RWMutex
	current    Switcher
	status     SwitcherStatus
	emit       func(SwitcherStatus)
	generation uint64
}

func NewSwitcherManager() *SwitcherManager {
	return &SwitcherManager{status: SwitcherStatus{Estado: "desconectado"}}
}

func (m *SwitcherManager) SetEmitter(emit func(SwitcherStatus)) {
	m.mu.Lock()
	m.emit = emit
	m.mu.Unlock()
}

func (m *SwitcherManager) publish(status SwitcherStatus) {
	m.mu.Lock()
	m.status = status
	emit := m.emit
	m.mu.Unlock()
	if emit != nil {
		emit(status)
	}
}

func (m *SwitcherManager) Connect(kind, host string, port int, password string) error {
	kind = strings.ToLower(strings.TrimSpace(kind))
	host = strings.TrimSpace(host)
	if kind != "obs" && kind != "atem" {
		return errors.New("elige OBS o ATEM")
	}
	if host == "" {
		return errors.New("escribe la dirección del switcher")
	}
	if port < 1 || port > 65535 {
		return errors.New("el puerto debe estar entre 1 y 65535")
	}

	m.mu.Lock()
	old := m.current
	m.current = nil
	m.generation++
	generation := m.generation
	m.mu.Unlock()
	if old != nil {
		old.Disconnect()
	}

	m.publish(SwitcherStatus{Kind: kind, Estado: "conectando"})
	callback := func(status SwitcherStatus) {
		m.mu.RLock()
		vigente := generation == m.generation
		m.mu.RUnlock()
		if vigente {
			m.publish(status)
		}
	}

	var sw Switcher
	if kind == "obs" {
		sw = newOBSSwitcher(callback)
	} else {
		sw = newATEMSwitcher(callback)
	}
	m.mu.Lock()
	if generation == m.generation {
		m.current = sw
	}
	m.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := sw.Connect(ctx, host, port, password); err != nil {
		sw.Disconnect()
		m.mu.Lock()
		if generation == m.generation {
			m.current = nil
		}
		m.mu.Unlock()
		claro := fmt.Sprintf("no se pudo conectar con %s: %v", strings.ToUpper(kind), err)
		m.publish(SwitcherStatus{Kind: kind, Estado: "error", Error: claro})
		return errors.New(claro)
	}
	return nil
}

func (m *SwitcherManager) Disconnect() {
	m.mu.Lock()
	sw := m.current
	kind := m.status.Kind
	m.current = nil
	m.generation++
	m.mu.Unlock()
	if sw != nil {
		sw.Disconnect()
	}
	m.publish(SwitcherStatus{Kind: kind, Estado: "desconectado"})
}

func (m *SwitcherManager) active() (Switcher, error) {
	m.mu.RLock()
	sw := m.current
	m.mu.RUnlock()
	if sw == nil {
		return nil, errors.New("el switcher no está conectado")
	}
	return sw, nil
}

func (m *SwitcherManager) SetProgram(input string) error {
	sw, err := m.active()
	if err != nil {
		return err
	}
	return sw.SetProgram(input)
}

func (m *SwitcherManager) SetPreview(input string) error {
	sw, err := m.active()
	if err != nil {
		return err
	}
	return sw.SetPreview(input)
}

func (m *SwitcherManager) Status() SwitcherStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *SwitcherManager) ListInputs() ([]string, error) {
	sw, err := m.active()
	if err != nil {
		return nil, err
	}
	return sw.ListInputs()
}

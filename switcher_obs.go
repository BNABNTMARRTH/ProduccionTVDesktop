package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

type obsEnvelope struct {
	Op int             `json:"op"`
	D  json.RawMessage `json:"d"`
}

type obsResponse struct {
	RequestType   string `json:"requestType"`
	RequestID     string `json:"requestId"`
	RequestStatus struct {
		Result  bool   `json:"result"`
		Code    int    `json:"code"`
		Comment string `json:"comment"`
	} `json:"requestStatus"`
	ResponseData json.RawMessage `json:"responseData"`
}

type obsSwitcher struct {
	mu          sync.RWMutex
	writeMu     sync.Mutex
	conn        *websocket.Conn
	status      SwitcherStatus
	inputs      []string
	pending     map[string]chan obsResponse
	nextID      atomic.Uint64
	onStatus    func(SwitcherStatus)
	intentional bool
}

func newOBSSwitcher(onStatus func(SwitcherStatus)) *obsSwitcher {
	return &obsSwitcher{
		status:   SwitcherStatus{Kind: "obs", Estado: "desconectado"},
		pending:  make(map[string]chan obsResponse),
		onStatus: onStatus,
	}
}

func obsAuthentication(password, salt, challenge string) string {
	secretSum := sha256.Sum256([]byte(password + salt))
	secret := base64.StdEncoding.EncodeToString(secretSum[:])
	authSum := sha256.Sum256([]byte(secret + challenge))
	return base64.StdEncoding.EncodeToString(authSum[:])
}

func obsURL(host string, port int) string {
	host = strings.TrimSpace(host)
	if strings.Contains(host, "://") {
		if parsed, err := url.Parse(host); err == nil {
			parsed.Scheme = map[bool]string{true: "wss", false: "ws"}[parsed.Scheme == "https" || parsed.Scheme == "wss"]
			if parsed.Port() == "" {
				parsed.Host = net.JoinHostPort(parsed.Hostname(), fmt.Sprint(port))
			}
			return parsed.String()
		}
	}
	return "ws://" + net.JoinHostPort(host, fmt.Sprint(port))
}

func (o *obsSwitcher) Connect(ctx context.Context, host string, port int, password string) error {
	dialer := websocket.Dialer{HandshakeTimeout: 2500 * time.Millisecond}
	conn, _, err := dialer.DialContext(ctx, obsURL(host, port), nil)
	if err != nil {
		return errors.New("OBS no contestó. Revisa que OBS esté abierto y que en Herramientas → Ajustes del servidor WebSocket esté marcado «Habilitar servidor WebSocket»")
	}
	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(3 * time.Second)
	}
	_ = conn.SetReadDeadline(deadline)

	var hello obsEnvelope
	if err := conn.ReadJSON(&hello); err != nil || hello.Op != 0 {
		_ = conn.Close()
		return errors.New("OBS no envió un saludo válido")
	}
	var helloData struct {
		RPCVersion     int `json:"rpcVersion"`
		Authentication *struct {
			Challenge string `json:"challenge"`
			Salt      string `json:"salt"`
		} `json:"authentication"`
	}
	if err := json.Unmarshal(hello.D, &helloData); err != nil {
		_ = conn.Close()
		return errors.New("no se pudo leer el saludo de OBS")
	}
	identify := map[string]any{"rpcVersion": 1, "eventSubscriptions": 4}
	if helloData.Authentication != nil {
		if password == "" && esHostLocal(host) {
			password = contrasenaOBSLocal()
		}
		if password == "" {
			_ = conn.Close()
			return errors.New("OBS pide contraseña. Cópiala de OBS: Herramientas → Ajustes del servidor WebSocket → Mostrar información de conexión")
		}
		identify["authentication"] = obsAuthentication(password, helloData.Authentication.Salt, helloData.Authentication.Challenge)
	}
	if err := conn.WriteJSON(map[string]any{"op": 1, "d": identify}); err != nil {
		_ = conn.Close()
		return errors.New("no se pudo identificar con OBS")
	}
	var identified obsEnvelope
	if err := conn.ReadJSON(&identified); err != nil || identified.Op != 2 {
		_ = conn.Close()
		return errors.New("la contraseña no coincide con la de OBS. Cópiala otra vez de Herramientas → Ajustes del servidor WebSocket → Mostrar información de conexión")
	}
	_ = conn.SetReadDeadline(time.Time{})

	o.mu.Lock()
	o.conn = conn
	o.intentional = false
	o.pending = make(map[string]chan obsResponse)
	o.mu.Unlock()
	go o.readLoop(conn)

	var scenes struct {
		CurrentProgramSceneName string `json:"currentProgramSceneName"`
		CurrentPreviewSceneName string `json:"currentPreviewSceneName"`
		Scenes                  []struct {
			SceneName string `json:"sceneName"`
		} `json:"scenes"`
	}
	if err := o.requestContext(ctx, "GetSceneList", nil, &scenes); err != nil {
		o.Disconnect()
		return fmt.Errorf("no se pudo pedir la lista de escenas: %w", err)
	}
	// OBS entrega las escenas de abajo hacia arriba; se invierten para que
	// queden en el mismo orden que en su lista (CAM 1 primero).
	inputs := make([]string, 0, len(scenes.Scenes))
	for i := len(scenes.Scenes) - 1; i >= 0; i-- {
		if name := scenes.Scenes[i].SceneName; strings.TrimSpace(name) != "" {
			inputs = append(inputs, name)
		}
	}
	o.mu.Lock()
	o.inputs = inputs
	o.status = SwitcherStatus{Kind: "obs", Estado: "conectado", Conectado: true, Programa: scenes.CurrentProgramSceneName, Preview: scenes.CurrentPreviewSceneName}
	status := o.status
	o.mu.Unlock()
	o.notify(status)
	return nil
}

func (o *obsSwitcher) notify(status SwitcherStatus) {
	if o.onStatus != nil {
		o.onStatus(status)
	}
}

func (o *obsSwitcher) readLoop(conn *websocket.Conn) {
	for {
		var msg obsEnvelope
		if err := conn.ReadJSON(&msg); err != nil {
			o.mu.Lock()
			if o.conn != conn {
				o.mu.Unlock()
				return
			}
			o.conn = nil
			intentional := o.intentional
			status := o.status
			status.Conectado = false
			if intentional {
				status.Estado = "desconectado"
				status.Error = ""
			} else {
				status.Estado = "error"
				status.Error = "se perdió la conexión con OBS"
			}
			o.status = status
			pending := o.pending
			o.pending = make(map[string]chan obsResponse)
			o.mu.Unlock()
			for _, ch := range pending {
				close(ch)
			}
			if !intentional {
				o.notify(status)
			}
			return
		}
		switch msg.Op {
		case 5:
			o.handleEvent(msg.D)
		case 7:
			var response obsResponse
			if json.Unmarshal(msg.D, &response) != nil {
				continue
			}
			o.mu.Lock()
			ch := o.pending[response.RequestID]
			delete(o.pending, response.RequestID)
			o.mu.Unlock()
			if ch != nil {
				ch <- response
				close(ch)
			}
		}
	}
}

func (o *obsSwitcher) handleEvent(raw json.RawMessage) {
	var event struct {
		EventType string `json:"eventType"`
		EventData struct {
			SceneName string `json:"sceneName"`
		} `json:"eventData"`
	}
	if json.Unmarshal(raw, &event) != nil {
		return
	}
	o.mu.Lock()
	changed := false
	switch event.EventType {
	case "CurrentProgramSceneChanged":
		o.status.Programa = event.EventData.SceneName
		changed = true
	case "CurrentPreviewSceneChanged":
		o.status.Preview = event.EventData.SceneName
		changed = true
	}
	status := o.status
	o.mu.Unlock()
	if changed {
		o.notify(status)
	}
}

func (o *obsSwitcher) requestContext(ctx context.Context, requestType string, data any, target any) error {
	o.mu.RLock()
	conn := o.conn
	o.mu.RUnlock()
	if conn == nil {
		return errors.New("OBS no está conectado")
	}
	id := fmt.Sprintf("ptv-%d", o.nextID.Add(1))
	ch := make(chan obsResponse, 1)
	o.mu.Lock()
	o.pending[id] = ch
	o.mu.Unlock()
	payload := map[string]any{"requestType": requestType, "requestId": id}
	if data != nil {
		payload["requestData"] = data
	}
	o.writeMu.Lock()
	err := conn.WriteJSON(map[string]any{"op": 6, "d": payload})
	o.writeMu.Unlock()
	if err != nil {
		o.mu.Lock()
		delete(o.pending, id)
		o.mu.Unlock()
		return errors.New("no se pudo enviar la orden a OBS")
	}
	select {
	case response, ok := <-ch:
		if !ok {
			return errors.New("se perdió la conexión con OBS")
		}
		if !response.RequestStatus.Result {
			comment := strings.TrimSpace(response.RequestStatus.Comment)
			if comment == "" {
				comment = fmt.Sprintf("OBS rechazó la orden (código %d)", response.RequestStatus.Code)
			}
			return errors.New(comment)
		}
		if target != nil && len(response.ResponseData) > 0 {
			return json.Unmarshal(response.ResponseData, target)
		}
		return nil
	case <-ctx.Done():
		o.mu.Lock()
		delete(o.pending, id)
		o.mu.Unlock()
		return errors.New("OBS tardó demasiado en responder")
	}
}

func (o *obsSwitcher) request(requestType string, data any, target any) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return o.requestContext(ctx, requestType, data, target)
}

func (o *obsSwitcher) Disconnect() {
	o.mu.Lock()
	o.intentional = true
	conn := o.conn
	o.conn = nil
	o.status = SwitcherStatus{Kind: "obs", Estado: "desconectado"}
	pending := o.pending
	o.pending = make(map[string]chan obsResponse)
	o.mu.Unlock()
	if conn != nil {
		_ = conn.Close()
	}
	for _, ch := range pending {
		close(ch)
	}
}

func (o *obsSwitcher) SetProgram(input string) error {
	input = strings.TrimSpace(input)
	if input == "" {
		return errors.New("esa cámara no tiene una escena de OBS asignada")
	}
	return o.request("SetCurrentProgramScene", map[string]string{"sceneName": input}, nil)
}

func (o *obsSwitcher) SetPreview(input string) error {
	input = strings.TrimSpace(input)
	if input == "" {
		return errors.New("esa cámara no tiene una escena de OBS asignada")
	}
	return o.request("SetCurrentPreviewScene", map[string]string{"sceneName": input}, nil)
}

func (o *obsSwitcher) Status() SwitcherStatus {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.status
}

func (o *obsSwitcher) ListInputs() ([]string, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()
	if !o.status.Conectado {
		return nil, errors.New("conecta OBS para leer sus escenas")
	}
	return append([]string(nil), o.inputs...), nil
}

// esHostLocal dice si la dirección apunta a esta misma computadora.
func esHostLocal(host string) bool {
	h := strings.ToLower(strings.Trim(strings.TrimSpace(host), "[]"))
	if h == "localhost" {
		return true
	}
	ip := net.ParseIP(h)
	return ip != nil && ip.IsLoopback()
}

// contrasenaOBSLocal lee la contraseña del servidor WebSocket de un OBS
// instalado en esta Mac, para no obligar a copiarla cuando ambos programas
// corren juntos. Si no la encuentra devuelve "" y se pide a mano.
func contrasenaOBSLocal() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	data, err := os.ReadFile(filepath.Join(dir, "obs-studio", "plugin_config", "obs-websocket", "config.json"))
	if err != nil {
		return ""
	}
	var cfg struct {
		Password string `json:"server_password"`
	}
	if json.Unmarshal(data, &cfg) != nil {
		return ""
	}
	return cfg.Password
}

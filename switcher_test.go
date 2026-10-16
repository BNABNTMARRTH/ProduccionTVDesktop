package main

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

type fakeOBS struct {
	t          *testing.T
	password   string
	program    chan string
	identified chan struct{}
	server     *httptest.Server
	mu         sync.Mutex
	conn       *websocket.Conn
}

func newFakeOBS(t *testing.T, password string) *fakeOBS {
	t.Helper()
	f := &fakeOBS{t: t, password: password, program: make(chan string, 1), identified: make(chan struct{})}
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		f.mu.Lock()
		f.conn = conn
		f.mu.Unlock()
		hello := map[string]any{"op": 0, "d": map[string]any{"obsWebSocketVersion": "5.5.0", "rpcVersion": 1}}
		if password != "" {
			hello["d"].(map[string]any)["authentication"] = map[string]string{"challenge": "reto", "salt": "sal"}
		}
		if err := conn.WriteJSON(hello); err != nil {
			return
		}
		var identify struct {
			Op int `json:"op"`
			D  struct {
				Authentication string `json:"authentication"`
			} `json:"d"`
		}
		if err := conn.ReadJSON(&identify); err != nil {
			return
		}
		if identify.Op != 1 {
			t.Errorf("identify op = %d", identify.Op)
		}
		if password != "" {
			expected := obsAuthentication(password, "sal", "reto")
			if identify.D.Authentication != expected {
				t.Errorf("auth = %q, want %q", identify.D.Authentication, expected)
			}
		} else if identify.D.Authentication != "" {
			t.Errorf("unexpected auth without challenge: %q", identify.D.Authentication)
		}
		close(f.identified)
		if err := conn.WriteJSON(map[string]any{"op": 2, "d": map[string]any{"negotiatedRpcVersion": 1}}); err != nil {
			return
		}
		for {
			var request struct {
				Op int `json:"op"`
				D  struct {
					RequestType string `json:"requestType"`
					RequestID   string `json:"requestId"`
					RequestData struct {
						SceneName string `json:"sceneName"`
					} `json:"requestData"`
				} `json:"d"`
			}
			if err := conn.ReadJSON(&request); err != nil {
				return
			}
			responseData := any(map[string]any{})
			if request.D.RequestType == "GetSceneList" {
				responseData = map[string]any{
					"currentProgramSceneName": "CAM 1",
					"currentPreviewSceneName": "CAM 2",
					// Como el OBS real: la lista llega de abajo hacia arriba.
					"scenes": []map[string]any{{"sceneName": "CAM 2"}, {"sceneName": "CAM 1"}},
				}
			}
			if request.D.RequestType == "SetCurrentProgramScene" {
				f.program <- request.D.RequestData.SceneName
			}
			if err := conn.WriteJSON(map[string]any{"op": 7, "d": map[string]any{
				"requestType":   request.D.RequestType,
				"requestId":     request.D.RequestID,
				"requestStatus": map[string]any{"result": true, "code": 100},
				"responseData":  responseData,
			}}); err != nil {
				return
			}
		}
	})
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Skipf("el sandbox no permite abrir el servidor websocket local: %v", err)
	}
	f.server = httptest.NewUnstartedServer(handler)
	f.server.Listener = listener
	f.server.Start()
	t.Cleanup(func() {
		f.mu.Lock()
		if f.conn != nil {
			_ = f.conn.Close()
		}
		f.mu.Unlock()
		f.server.Close()
	})
	return f
}

func (f *fakeOBS) wsURL() string { return "ws" + strings.TrimPrefix(f.server.URL, "http") }

func (f *fakeOBS) emitProgram(scene string) {
	f.t.Helper()
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.conn == nil {
		f.t.Fatal("fake OBS has no client")
	}
	if err := f.conn.WriteJSON(map[string]any{"op": 5, "d": map[string]any{
		"eventType":   "CurrentProgramSceneChanged",
		"eventIntent": 4,
		"eventData":   map[string]string{"sceneName": scene},
	}}); err != nil {
		f.t.Fatalf("emit event: %v", err)
	}
}

func TestOBSHelloWithoutAuthenticationAndProgramEvent(t *testing.T) {
	fake := newFakeOBS(t, "")
	updates := make(chan SwitcherStatus, 8)
	obs := newOBSSwitcher(func(status SwitcherStatus) { updates <- status })
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := obs.Connect(ctx, fake.wsURL(), 4455, ""); err != nil {
		t.Fatal(err)
	}
	defer obs.Disconnect()
	inputs, err := obs.ListInputs()
	if err != nil || len(inputs) != 2 || inputs[0] != "CAM 1" {
		t.Fatalf("inputs = %#v, err %v", inputs, err)
	}
	if err := obs.SetProgram("Escena principal"); err != nil {
		t.Fatal(err)
	}
	select {
	case got := <-fake.program:
		if got != "Escena principal" {
			t.Fatalf("sceneName = %q", got)
		}
	case <-time.After(time.Second):
		t.Fatal("OBS did not receive SetCurrentProgramScene")
	}
	fake.emitProgram("CAM 2")
	deadline := time.After(time.Second)
	for {
		select {
		case status := <-updates:
			if status.Programa == "CAM 2" {
				return
			}
		case <-deadline:
			t.Fatal("program event did not reach switcher state")
		}
	}
}

func TestOBSHelloAuthentication(t *testing.T) {
	fake := newFakeOBS(t, "secreto")
	obs := newOBSSwitcher(nil)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := obs.Connect(ctx, fake.wsURL(), 4455, "secreto"); err != nil {
		t.Fatal(err)
	}
	obs.Disconnect()
	select {
	case <-fake.identified:
	case <-time.After(time.Second):
		t.Fatal("OBS did not receive Identify")
	}
	// El resultado son dos SHA-256 codificados como Base64, nunca la clave.
	if _, err := base64.StdEncoding.DecodeString(obsAuthentication("secreto", "sal", "reto")); err != nil {
		t.Fatalf("authentication is not base64: %v", err)
	}
}

func TestATEMHandshakeAndCommandEncoding(t *testing.T) {
	expectedHello := []byte{0x10, 0x14, 0x53, 0xab, 0, 0, 0, 0, 0, 0x3a, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0}
	if got := atemHelloPacket(); string(got) != string(expectedHello) {
		t.Fatalf("hello = % x, want % x", got, expectedHello)
	}
	program := encodeATEMCommandPacket(0x1234, 7, "CPgI", []byte{0, 0, 0, 3})
	expectedProgram := []byte{
		0x08, 0x18, 0x12, 0x34, 0, 0, 0, 0, 0, 0, 0, 7,
		0, 12, 0, 0, 'C', 'P', 'g', 'I', 0, 0, 0, 3,
	}
	if string(program) != string(expectedProgram) {
		t.Fatalf("CPgI = % x, want % x", program, expectedProgram)
	}
	preview := encodeATEMCommandPacket(0x1234, 8, "CPvI", []byte{0, 0, 0, 8})
	if string(preview[16:20]) != "CPvI" || binary.BigEndian.Uint16(preview[22:24]) != 8 {
		t.Fatalf("bad CPvI packet: % x", preview)
	}
}

func atemStatePacket(session, packetID uint16, commands ...struct {
	name  string
	input uint16
}) []byte {
	length := 12 + len(commands)*12
	p := encodeATEMHeader(atemFlagAckRequest, length, session, 0, 0, packetID)
	offset := 12
	for _, command := range commands {
		binary.BigEndian.PutUint16(p[offset:offset+2], 12)
		copy(p[offset+4:offset+8], command.name)
		binary.BigEndian.PutUint16(p[offset+10:offset+12], command.input)
		offset += 12
	}
	return p
}

func TestATEMParsesProgramAndPreview(t *testing.T) {
	packet := atemStatePacket(0x2222, 9,
		struct {
			name  string
			input uint16
		}{"PrgI", 4},
		struct {
			name  string
			input uint16
		}{"PrvI", 2},
	)
	values := map[string]string{}
	if err := parseATEMCommands(packet, func(name string, payload []byte) {
		values[name] = string(rune(binary.BigEndian.Uint16(payload[2:4]) + '0'))
	}); err != nil {
		t.Fatal(err)
	}
	if values["PrgI"] != "4" || values["PrvI"] != "2" {
		t.Fatalf("parsed values: %#v", values)
	}
	updates := make(chan SwitcherStatus, 4)
	a := newATEMSwitcher(func(status SwitcherStatus) { updates <- status })
	a.status = SwitcherStatus{Kind: "atem", Estado: "conectado", Conectado: true}
	_ = parseATEMCommands(packet, a.applyCommand)
	status := a.Status()
	if status.Programa != "4" || status.Preview != "2" {
		t.Fatalf("status = %#v", status)
	}
}

func TestATEMMinimalUDPServer(t *testing.T) {
	server, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0})
	if err != nil {
		t.Skipf("el sandbox no permite abrir el servidor UDP local: %v", err)
	}
	defer server.Close()
	received := make(chan string, 1)
	go func() {
		buf := make([]byte, 2048)
		n, client, err := server.ReadFromUDP(buf)
		if err != nil || string(buf[:n]) != string(atemHelloPacket()) {
			return
		}
		hello := encodeATEMHeader(atemFlagNewSession, 20, 0x4242, 0, 0, 0)
		hello[12] = 2
		_, _ = server.WriteToUDP(hello, client)
		for {
			n, _, err = server.ReadFromUDP(buf)
			if err != nil {
				return
			}
			if n > 20 && string(buf[16:20]) == "CPgI" {
				received <- string(buf[16:20]) + ":" + string(rune(binary.BigEndian.Uint16(buf[22:24])+'0'))
				return
			}
		}
	}()

	a := newATEMSwitcher(nil)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	addr := server.LocalAddr().(*net.UDPAddr)
	if err := a.Connect(ctx, "127.0.0.1", addr.Port, ""); err != nil {
		t.Fatal(err)
	}
	defer a.Disconnect()
	if err := a.SetProgram("3"); err != nil {
		t.Fatal(err)
	}
	select {
	case got := <-received:
		if got != "CPgI:3" {
			t.Fatalf("got %q", got)
		}
	case <-time.After(time.Second):
		t.Fatal("fake ATEM did not receive CPgI")
	}
}

func TestSwitcherStatusJSONNames(t *testing.T) {
	b, err := json.Marshal(SwitcherStatus{Kind: "obs", Conectado: true, Programa: "A"})
	if err != nil {
		t.Fatal(err)
	}
	text := string(b)
	for _, field := range []string{`"kind"`, `"conectado"`, `"programa"`, `"preview"`, `"error"`} {
		if !strings.Contains(text, field) {
			t.Fatalf("missing %s in %s", field, text)
		}
	}
}

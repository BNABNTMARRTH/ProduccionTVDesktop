package main

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Protocolo ATEM UDP (ingeniería inversa pública):
// - https://atem.julusian.dev/protocol (encabezado de 12 bytes y flags)
// - SKAARHOJ Arduino ATEM.cpp (hello, ACK y disposición de CPgI/CPvI)
// - NRK/Sofie atem-connection (secuencia, ACK y retransmisión).
// Blackmagic no publica este protocolo como API estable; se limita aquí a lo
// necesario para un ATEM Mini Pro: programa, preview y estado de los buses.

const (
	atemFlagAckRequest        = 0x01
	atemFlagNewSession        = 0x02
	atemFlagRetransmit        = 0x04
	atemFlagRetransmitRequest = 0x08
	atemFlagAckReply          = 0x10
)

var atemConnectHello = []byte{
	0x10, 0x14, 0x53, 0xab, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3a, 0x00, 0x00,
	0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
}

type atemPending struct {
	packet  []byte
	sentAt  time.Time
	retries int
}

type atemSwitcher struct {
	mu          sync.RWMutex
	writeMu     sync.Mutex
	conn        *net.UDPConn
	status      SwitcherStatus
	onStatus    func(SwitcherStatus)
	sessionID   uint16
	localSeq    uint16
	lastRemote  uint16
	lastContact time.Time
	lastHello   time.Time
	pending     map[uint16]*atemPending
	stop        chan struct{}
	done        chan struct{}
	connected   chan struct{}
	connectOnce sync.Once
	intentional bool
}

func newATEMSwitcher(onStatus func(SwitcherStatus)) *atemSwitcher {
	return &atemSwitcher{
		status:   SwitcherStatus{Kind: "atem", Estado: "desconectado"},
		onStatus: onStatus,
		pending:  make(map[uint16]*atemPending),
	}
}

func atemHelloPacket() []byte { return append([]byte(nil), atemConnectHello...) }

func encodeATEMHeader(flags byte, length int, session, acked, retransmit, packetID uint16) []byte {
	p := make([]byte, length)
	binary.BigEndian.PutUint16(p[0:2], uint16(length)&0x07ff|uint16(flags)<<11)
	binary.BigEndian.PutUint16(p[2:4], session)
	binary.BigEndian.PutUint16(p[4:6], acked)
	binary.BigEndian.PutUint16(p[6:8], retransmit)
	binary.BigEndian.PutUint16(p[10:12], packetID)
	return p
}

// encodeATEMCommandPacket arma: header UDP (12), longitud/reserva/nombre del
// comando (8) y payload. Los enteros del protocolo viajan big-endian.
func encodeATEMCommandPacket(session, packetID uint16, command string, payload []byte) []byte {
	segmentLength := 8 + len(payload)
	packet := encodeATEMHeader(atemFlagAckRequest, 12+segmentLength, session, 0, 0, packetID)
	binary.BigEndian.PutUint16(packet[12:14], uint16(segmentLength))
	copy(packet[16:20], []byte(command))
	copy(packet[20:], payload)
	return packet
}

func parseATEMCommands(packet []byte, fn func(name string, payload []byte)) error {
	if len(packet) < 12 {
		return errors.New("paquete ATEM demasiado corto")
	}
	declared := int(binary.BigEndian.Uint16(packet[0:2]) & 0x07ff)
	if declared < 12 || declared > len(packet) {
		return errors.New("longitud de paquete ATEM inválida")
	}
	for offset := 12; offset < declared; {
		if offset+8 > declared {
			return errors.New("comando ATEM incompleto")
		}
		length := int(binary.BigEndian.Uint16(packet[offset : offset+2]))
		if length < 8 || offset+length > declared {
			return errors.New("longitud de comando ATEM inválida")
		}
		fn(string(packet[offset+4:offset+8]), packet[offset+8:offset+length])
		offset += length
	}
	return nil
}

func (a *atemSwitcher) Connect(ctx context.Context, host string, port int, _ string) error {
	dialer := net.Dialer{}
	connRaw, err := dialer.DialContext(ctx, "udp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return errors.New("no se pudo abrir la conexión UDP")
	}
	conn, ok := connRaw.(*net.UDPConn)
	if !ok {
		_ = connRaw.Close()
		return errors.New("la conexión UDP no está disponible")
	}
	a.mu.Lock()
	a.conn = conn
	a.sessionID = 0x53ab
	a.localSeq = 0
	a.lastContact = time.Now()
	a.lastHello = time.Now()
	a.pending = make(map[uint16]*atemPending)
	a.stop = make(chan struct{})
	a.done = make(chan struct{})
	a.connected = make(chan struct{})
	a.connectOnce = sync.Once{}
	a.intentional = false
	a.status = SwitcherStatus{Kind: "atem", Estado: "conectando"}
	a.mu.Unlock()
	if _, err := conn.Write(atemHelloPacket()); err != nil {
		_ = conn.Close()
		return errors.New("no se pudo enviar el saludo al ATEM")
	}
	go a.readLoop(conn)
	select {
	case <-a.connected:
		return nil
	case <-ctx.Done():
		a.Disconnect()
		return errors.New("el ATEM no respondió en tres segundos")
	}
}

func (a *atemSwitcher) notify(status SwitcherStatus) {
	if a.onStatus != nil {
		a.onStatus(status)
	}
}

func (a *atemSwitcher) sendRaw(packet []byte) error {
	a.mu.RLock()
	conn := a.conn
	a.mu.RUnlock()
	if conn == nil {
		return errors.New("ATEM no está conectado")
	}
	a.writeMu.Lock()
	_, err := conn.Write(packet)
	a.writeMu.Unlock()
	return err
}

func (a *atemSwitcher) sendAck(packetID uint16) {
	a.mu.RLock()
	session := a.sessionID
	a.mu.RUnlock()
	_ = a.sendRaw(encodeATEMHeader(atemFlagAckReply, 12, session, packetID, 0, 0))
}

func (a *atemSwitcher) handlePacket(packet []byte) {
	if len(packet) < 12 {
		return
	}
	declared := int(binary.BigEndian.Uint16(packet[0:2]) & 0x07ff)
	if declared != len(packet) {
		return
	}
	flags := packet[0] >> 3
	session := binary.BigEndian.Uint16(packet[2:4])
	packetID := binary.BigEndian.Uint16(packet[10:12])

	a.mu.Lock()
	a.lastContact = time.Now()
	if session != 0 {
		a.sessionID = session
	}
	if packetID != 0 {
		a.lastRemote = packetID
	}
	if flags&atemFlagAckReply != 0 {
		delete(a.pending, binary.BigEndian.Uint16(packet[4:6]))
	}
	if flags&atemFlagNewSession != 0 {
		a.status.Estado = "conectado"
		a.status.Conectado = true
		a.status.Error = ""
		status := a.status
		a.mu.Unlock()
		// El byte 9 = 3 es la respuesta inicial observada por SKAARHOJ.
		ack := encodeATEMHeader(atemFlagAckReply, 12, session, 0, 0, 0)
		ack[9] = 0x03
		_ = a.sendRaw(ack)
		a.connectOnce.Do(func() { close(a.connected) })
		a.notify(status)
		return
	}
	a.mu.Unlock()

	if flags&atemFlagAckRequest != 0 {
		a.sendAck(packetID)
	}
	if flags&atemFlagRetransmitRequest != 0 {
		first := binary.BigEndian.Uint16(packet[6:8])
		a.resendFrom(first)
	}
	if len(packet) > 12 {
		_ = parseATEMCommands(packet, a.applyCommand)
	}
}

func (a *atemSwitcher) applyCommand(name string, payload []byte) {
	if len(payload) < 4 || payload[0] != 0 {
		return
	}
	input := strconv.Itoa(int(binary.BigEndian.Uint16(payload[2:4])))
	a.mu.Lock()
	changed := false
	switch name {
	case "PrgI":
		if a.status.Programa != input {
			a.status.Programa = input
			changed = true
		}
	case "PrvI":
		if a.status.Preview != input {
			a.status.Preview = input
			changed = true
		}
	}
	status := a.status
	a.mu.Unlock()
	if changed {
		a.notify(status)
	}
}

func (a *atemSwitcher) resendFrom(first uint16) {
	a.mu.RLock()
	packets := make([][]byte, 0)
	for seq, pending := range a.pending {
		if seq >= first {
			packets = append(packets, append([]byte(nil), pending.packet...))
		}
	}
	a.mu.RUnlock()
	for _, packet := range packets {
		packet[0] |= atemFlagRetransmit << 3
		_ = a.sendRaw(packet)
	}
}

func (a *atemSwitcher) maintenance(now time.Time) {
	a.mu.Lock()
	if a.conn == nil || a.intentional {
		a.mu.Unlock()
		return
	}
	lastContact := a.lastContact
	lastHello := a.lastHello
	lastRemote := a.lastRemote
	session := a.sessionID
	var retryPackets [][]byte
	for seq, pending := range a.pending {
		if now.Sub(pending.sentAt) < 600*time.Millisecond {
			continue
		}
		if pending.retries >= 3 {
			delete(a.pending, seq)
			continue
		}
		pending.retries++
		pending.sentAt = now
		p := append([]byte(nil), pending.packet...)
		p[0] |= atemFlagRetransmit << 3
		retryPackets = append(retryPackets, p)
	}
	var publish *SwitcherStatus
	if now.Sub(lastContact) > 5*time.Second && a.status.Estado != "error" {
		a.status.Conectado = false
		a.status.Estado = "error"
		a.status.Error = "se perdió la conexión con el ATEM; reintentando"
		copy := a.status
		publish = &copy
	}
	sendHello := now.Sub(lastContact) > 5*time.Second && now.Sub(lastHello) > 2*time.Second
	if sendHello {
		a.lastHello = now
	}
	a.mu.Unlock()
	for _, packet := range retryPackets {
		_ = a.sendRaw(packet)
	}
	if publish != nil {
		a.notify(*publish)
	}
	if sendHello {
		_ = a.sendRaw(atemHelloPacket())
	} else if now.Sub(lastContact) > 2*time.Second && lastRemote != 0 {
		// ACK repetido como keepalive: no cambia estado ni dispara una orden.
		_ = a.sendRaw(encodeATEMHeader(atemFlagAckReply, 12, session, lastRemote, 0, 0))
	}
}

func (a *atemSwitcher) readLoop(conn *net.UDPConn) {
	defer close(a.done)
	buffer := make([]byte, 2048)
	for {
		_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		n, err := conn.Read(buffer)
		if err == nil {
			a.handlePacket(append([]byte(nil), buffer[:n]...))
			continue
		}
		select {
		case <-a.stop:
			return
		default:
		}
		if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
			a.maintenance(time.Now())
			continue
		}
		a.mu.Lock()
		if a.conn != conn {
			a.mu.Unlock()
			return
		}
		a.status.Conectado = false
		a.status.Estado = "error"
		a.status.Error = "se cerró la conexión UDP con el ATEM"
		status := a.status
		a.mu.Unlock()
		a.notify(status)
		return
	}
}

func (a *atemSwitcher) sendCommand(command string, input string) error {
	n, err := strconv.Atoi(strings.TrimSpace(input))
	if err != nil || n < 0 || n > 65535 {
		return errors.New("la entrada ATEM debe ser un número válido")
	}
	a.mu.Lock()
	if !a.status.Conectado || a.conn == nil {
		a.mu.Unlock()
		return errors.New("ATEM no está conectado")
	}
	a.localSeq = (a.localSeq + 1) & 0x7fff
	if a.localSeq == 0 {
		a.localSeq = 1
	}
	seq := a.localSeq
	payload := []byte{0, 0, byte(n >> 8), byte(n)} // ME 0, reservado, input uint16 BE.
	packet := encodeATEMCommandPacket(a.sessionID, seq, command, payload)
	a.pending[seq] = &atemPending{packet: append([]byte(nil), packet...), sentAt: time.Now()}
	a.mu.Unlock()
	if err := a.sendRaw(packet); err != nil {
		return fmt.Errorf("no se pudo enviar la orden al ATEM: %w", err)
	}
	return nil
}

func (a *atemSwitcher) Disconnect() {
	a.mu.Lock()
	if a.conn == nil {
		a.mu.Unlock()
		return
	}
	a.intentional = true
	conn := a.conn
	stop := a.stop
	done := a.done
	a.conn = nil
	a.status = SwitcherStatus{Kind: "atem", Estado: "desconectado"}
	a.mu.Unlock()
	select {
	case <-stop:
	default:
		close(stop)
	}
	_ = conn.Close()
	select {
	case <-done:
	case <-time.After(time.Second):
	}
}

func (a *atemSwitcher) SetProgram(input string) error { return a.sendCommand("CPgI", input) }
func (a *atemSwitcher) SetPreview(input string) error { return a.sendCommand("CPvI", input) }

func (a *atemSwitcher) Status() SwitcherStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.status
}

func (a *atemSwitcher) ListInputs() ([]string, error) {
	// El Mini Pro expone cuatro HDMI, pero el protocolo usa identificadores de
	// fuente de 16 bits y el mapeo de la Sala admite 1..8 como bus práctico.
	inputs := make([]string, 8)
	for i := range inputs {
		inputs[i] = strconv.Itoa(i + 1)
	}
	return inputs, nil
}

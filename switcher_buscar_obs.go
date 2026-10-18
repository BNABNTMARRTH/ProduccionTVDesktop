package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// OBSEncontrado es el contrato compartido por Wails, el puente de iOS y el
// frontend. Port se conserva en cada resultado porque la búsqueda puede usar
// un puerto distinto al 4455 predeterminado.
type OBSEncontrado struct {
	Host   string `json:"host"`
	Nombre string `json:"nombre"`
	Port   int    `json:"port"`
}

// hostsSubredIPv4 devuelve sólo hosts utilizables. Una red mayor que /24 se
// acota al /24 que contiene a ip, para que una configuración /16 no dispare un
// barrido enorme. Las redes más pequeñas (/25, /26...) respetan su máscara.
func hostsSubredIPv4(ip net.IP, mask net.IPMask) []string {
	ip4 := ip.To4()
	ones, bits := mask.Size()
	if ip4 == nil || bits != 32 || ones < 0 {
		return nil
	}
	if ones < 24 {
		ones = 24
		mask = net.CIDRMask(ones, 32)
	}
	network := ip4.Mask(mask)
	hosts := 1 << (32 - ones)
	if hosts <= 2 {
		return nil
	}
	base := uint32(network[0])<<24 | uint32(network[1])<<16 | uint32(network[2])<<8 | uint32(network[3])
	result := make([]string, 0, hosts-2)
	for offset := 1; offset < hosts-1; offset++ {
		value := base + uint32(offset)
		result = append(result, net.IPv4(byte(value>>24), byte(value>>16), byte(value>>8), byte(value)).String())
	}
	return result
}

type objetivosBusquedaOBS struct {
	hosts   []string
	propias map[string]bool
}

func objetivosOBSDeInterfaces() (objetivosBusquedaOBS, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return objetivosBusquedaOBS{}, err
	}
	vistos := make(map[string]bool)
	propias := make(map[string]bool)
	var hosts []string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagRunning == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			var mask net.IPMask
			switch value := addr.(type) {
			case *net.IPNet:
				ip, mask = value.IP, value.Mask
			case *net.IPAddr:
				ip = value.IP
			}
			ip4 := ip.To4()
			if ip4 == nil || !ip4.IsPrivate() || len(mask) != net.IPv4len {
				continue
			}
			propias[ip4.String()] = true
			for _, host := range hostsSubredIPv4(ip4, mask) {
				if !vistos[host] {
					vistos[host] = true
					hosts = append(hosts, host)
				}
			}
		}
	}
	return objetivosBusquedaOBS{hosts: hosts, propias: propias}, nil
}

// sondearDireccionOBS hace primero la prueba TCP pedida y después confirma el
// protocolo: un servidor HTTP o un WebSocket cualquiera no cuenta como OBS.
// No se envía Identify; el cierre normal evita dejar una sesión a medias.
func sondearDireccionOBS(ctx context.Context, host string, port int) bool {
	direccion := net.JoinHostPort(host, fmt.Sprint(port))
	dialerTCP := net.Dialer{Timeout: 400 * time.Millisecond}
	tcp, err := dialerTCP.DialContext(ctx, "tcp4", direccion)
	if err != nil {
		return false
	}
	_ = tcp.Close()

	dialerWS := websocket.Dialer{
		HandshakeTimeout: 400 * time.Millisecond,
		NetDialContext: func(dialCtx context.Context, _, _ string) (net.Conn, error) {
			return dialerTCP.DialContext(dialCtx, "tcp4", direccion)
		},
	}
	conn, _, err := dialerWS.DialContext(ctx, "ws://"+direccion, nil)
	if err != nil {
		return false
	}
	defer conn.Close()
	deadline := time.Now().Add(400 * time.Millisecond)
	if limite, ok := ctx.Deadline(); ok && limite.Before(deadline) {
		deadline = limite
	}
	_ = conn.SetReadDeadline(deadline)
	var hello struct {
		Op int `json:"op"`
		D  struct {
			Version string `json:"obsWebSocketVersion"`
		} `json:"d"`
	}
	if err := conn.ReadJSON(&hello); err != nil || hello.Op != 0 || strings.TrimSpace(hello.D.Version) == "" {
		return false
	}
	_ = conn.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(100*time.Millisecond))
	return true
}

func nombreAmableOBS(ctx context.Context, host string) string {
	nombres, err := net.DefaultResolver.LookupAddr(ctx, host)
	if err != nil || len(nombres) == 0 {
		return host
	}
	nombre := strings.TrimSpace(nombres[0])
	nombre = strings.TrimSuffix(nombre, ".")
	nombre = strings.TrimSuffix(nombre, ".local")
	if nombre == "" {
		return host
	}
	return nombre
}

func buscarOBS(port int, escritorio bool) ([]OBSEncontrado, error) {
	if port < 1 || port > 65535 {
		return nil, errors.New("el puerto debe estar entre 1 y 65535")
	}
	inicio := time.Now()
	objetivos, err := objetivosOBSDeInterfaces()
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer las redes activas: %w", err)
	}
	hosts := objetivos.hosts
	if escritorio {
		hosts = append([]string{"127.0.0.1"}, hosts...)
	} else {
		filtrados := hosts[:0]
		for _, host := range hosts {
			if !objetivos.propias[host] {
				filtrados = append(filtrados, host)
			}
		}
		hosts = filtrados
	}

	// Se reserva el último tramo del límite global para los nombres inversos.
	scanCtx, cancelar := context.WithTimeout(context.Background(), 3200*time.Millisecond)
	defer cancelar()
	trabajos := make(chan string)
	encontrados := make(chan string, len(hosts))
	var grupo sync.WaitGroup
	workers := 64
	if len(hosts) < workers {
		workers = len(hosts)
	}
	for i := 0; i < workers; i++ {
		grupo.Add(1)
		go func() {
			defer grupo.Done()
			for host := range trabajos {
				if sondearDireccionOBS(scanCtx, host, port) {
					encontrados <- host
				}
			}
		}()
	}
	go func() {
		defer close(trabajos)
		for _, host := range hosts {
			select {
			case trabajos <- host:
			case <-scanCtx.Done():
				return
			}
		}
	}()
	grupo.Wait()
	close(encontrados)

	vistos := make(map[string]bool)
	var direcciones []string
	localRespondio := false
	for host := range encontrados {
		if host == "127.0.0.1" {
			localRespondio = true
		}
		if !vistos[host] {
			vistos[host] = true
			direcciones = append(direcciones, host)
		}
	}
	if escritorio && localRespondio {
		// Es el mismo OBS accesible por dos rutas. Se conserva la ruta estable que
		// pidió el contrato, no una copia con la IP Wi-Fi cambiante de esta Mac.
		filtradas := direcciones[:0]
		for _, host := range direcciones {
			if !objetivos.propias[host] {
				filtradas = append(filtradas, host)
			}
		}
		direcciones = filtradas
	}
	sort.Slice(direcciones, func(i, j int) bool {
		if direcciones[i] == "127.0.0.1" {
			return true
		}
		if direcciones[j] == "127.0.0.1" {
			return false
		}
		return direcciones[i] < direcciones[j]
	})

	resultados := make([]OBSEncontrado, 0, len(direcciones))
	for _, host := range direcciones {
		nombre := host
		if host == "127.0.0.1" {
			nombre = "Esta Mac"
		} else {
			restante := 3900*time.Millisecond - time.Since(inicio)
			if restante > 0 {
				lookupCtx, detener := context.WithTimeout(context.Background(), min(restante, 350*time.Millisecond))
				nombre = nombreAmableOBS(lookupCtx, host)
				detener()
			}
		}
		resultados = append(resultados, OBSEncontrado{Host: host, Nombre: nombre, Port: port})
	}
	return resultados, nil
}

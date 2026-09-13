//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AppKit
#import <AppKit/AppKit.h>

static bool activatePID(int pid) {
	NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
	if (app == nil || app.terminated) return false;
	// macOS 14 dejó de respetar ignoringOtherApps (la "activación cooperativa":
	// solo la app que está al frente puede ceder el frente a otra, que es
	// justo nuestro caso — el clic viene de la ventana de Inicio). En 14+ se
	// usa el método nuevo y se deja el viejo de respaldo para los Mac anteriores.
	if (@available(macOS 14.0, *)) {
		if ([app activateFromApplication:[NSRunningApplication currentApplication] options:0]) return true;
	}
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
	return [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
#pragma clang diagnostic pop
}

// ¿Ese proceso sigue vivo Y es una ventana NUESTRA? Las dos cosas, no una:
// los números de proceso se reciclan, y una marca vieja cuyo pid ya reusó otra
// app haría creer que el proyecto sigue abierto (y hasta traería al frente una
// app ajena al picarle a la tarjeta).
static bool pidAlive(int pid) {
	NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
	if (app == nil || app.terminated) return false;
	NSRunningApplication *me = [NSRunningApplication currentApplication];
	NSString *suyo = app.bundleIdentifier;
	NSString *mio = me.bundleIdentifier;
	if (suyo != nil && mio != nil) return [suyo isEqualToString:mio];
	// Sin identificador de paquete (compilado suelto, en desarrollo) se
	// compara el ejecutable, que es lo mismo para todas nuestras ventanas.
	NSURL *suyoURL = app.executableURL;
	NSURL *mioURL = me.executableURL;
	return suyoURL != nil && mioURL != nil && [suyoURL isEqual:mioURL];
}
*/
import "C"

// activateProcess trae al frente la app cuyo proceso es pid.
// Devuelve false si el proceso ya no existe o no se pudo activar.
func activateProcess(pid int) bool { return bool(C.activatePID(C.int(pid))) }

// processAlive dice si pid es OTRA VENTANA NUESTRA que sigue corriendo, SIN
// traerla al frente. Es lo que usa el lanzador para marcar en la tarjeta qué
// proyectos ya están abiertos, y lo que decide si hay que abrir una ventana
// nueva o no. Ojo: "vivo" y "se dejó enfocar" son cosas distintas (ver
// focusWindow en app.go).
func processAlive(pid int) bool { return bool(C.pidAlive(C.int(pid))) }

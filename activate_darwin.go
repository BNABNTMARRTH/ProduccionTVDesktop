//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework AppKit
#import <AppKit/AppKit.h>

static bool activatePID(int pid) {
	NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
	if (app == nil || app.terminated) return false;
	return [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
}
*/
import "C"

// activateProcess trae al frente la app cuyo proceso es pid.
// Devuelve false si el proceso ya no existe o no se pudo activar.
func activateProcess(pid int) bool { return bool(C.activatePID(C.int(pid))) }

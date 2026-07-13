//go:build !darwin

package main

// En plataformas sin AppKit no hay activación entre procesos: se responde
// false y FocusLauncher abre un lanzador nuevo.
func activateProcess(pid int) bool { return false }

//go:build !darwin

package main

// En plataformas sin AppKit no hay activación entre procesos: se responde
// false y FocusLauncher abre un lanzador nuevo.
func activateProcess(pid int) bool { return false }

// Sin AppKit tampoco se puede saber si otro proceso sigue vivo: se responde
// false y el lanzador se comporta como antes (abre una ventana nueva).
func processAlive(pid int) bool { return false }

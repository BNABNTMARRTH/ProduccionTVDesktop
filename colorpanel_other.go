//go:build !darwin
// +build !darwin

package main

import "context"

func initColorPanelBackend(ctx context.Context) {}

func openMacColorPanel(windowX, windowY, elemLeft, elemBottom float64, hex string) {}

func closeMacColorPanel() {}

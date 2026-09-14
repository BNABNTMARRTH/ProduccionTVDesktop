//go:build darwin
// +build darwin

package main

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

extern void ptv_on_color_changed(char *hex);

static id s_token = nil;
static BOOL s_isSettingColor = NO;

static inline void ensureColorObserver(void) {
    if (!s_token) {
        NSColorPanel *panel = [NSColorPanel sharedColorPanel];
        s_token = [[NSNotificationCenter defaultCenter] addObserverForName:NSColorPanelColorDidChangeNotification
                                                                    object:panel
                                                                     queue:[NSOperationQueue mainQueue]
                                                                usingBlock:^(NSNotification *note) {
            if (s_isSettingColor) return;
            NSColorPanel *cp = [NSColorPanel sharedColorPanel];
            NSColor *c = [[cp color] colorUsingColorSpace:[NSColorSpace sRGBColorSpace]];
            if (c) {
                int r = (int)round(c.redComponent * 255.0);
                int g = (int)round(c.greenComponent * 255.0);
                int b = (int)round(c.blueComponent * 255.0);
                char hex[10];
                snprintf(hex, sizeof(hex), "#%02X%02X%02X", r, g, b);
                ptv_on_color_changed(hex);
            }
        }];
    }
}

static inline void openNativeColorPanel(double windowX, double windowY, double elemLeft, double elemBottom, const char *hexStr) {
    NSString *initialHex = hexStr ? [NSString stringWithUTF8String:hexStr] : nil;
    dispatch_async(dispatch_get_main_queue(), ^{
        ensureColorObserver();

        // 1. Encontrar la ventana activa de la aplicación (Wails)
        NSWindow *targetWindow = nil;
        for (NSWindow *w in [NSApp windows]) {
            if (w != [NSColorPanel sharedColorPanel] && [w isVisible]) {
                targetWindow = w;
                break;
            }
        }
        if (!targetWindow) {
            targetWindow = [NSApp keyWindow] ?: [NSApp mainWindow];
        }

        // 2. Calcular coordenadas nativas exactas de pantalla
        // Separación limpia de 10 puntos respecto al botón/menú selector
        const CGFloat kGap = 10.0;
        CGFloat cocoaX = 0.0;
        CGFloat cocoaY = 0.0;
        NSScreen *screen = nil;

        if (targetWindow) {
            screen = [targetWindow screen];
            NSView *contentView = [targetWindow contentView];
            NSRect contentScreenRect = [targetWindow convertRectToScreen:[contentView bounds]];
            cocoaX = NSMinX(contentScreenRect) + elemLeft;
            cocoaY = NSMaxY(contentScreenRect) - elemBottom - kGap;
        } else {
            screen = [NSScreen mainScreen] ?: [NSScreen screens].firstObject;
            CGFloat screenH = screen ? screen.frame.size.height : 900.0;
            cocoaX = windowX + elemLeft;
            cocoaY = screenH - (windowY + elemBottom) - kGap;
        }

        if (!screen) {
            screen = [NSScreen mainScreen] ?: [NSScreen screens].firstObject;
        }

        NSColorPanel *panel = [NSColorPanel sharedColorPanel];
        [NSColorPanel setPickerMode:NSColorPanelModeCrayon];
        panel.showsAlpha = NO;

        if (initialHex && [initialHex length] >= 7 && [initialHex hasPrefix:@"#"]) {
            unsigned int hexVal = 0;
            NSScanner *scanner = [NSScanner scannerWithString:[initialHex substringFromIndex:1]];
            if ([scanner scanHexInt:&hexVal]) {
                CGFloat r = ((hexVal >> 16) & 0xFF) / 255.0;
                CGFloat g = ((hexVal >> 8) & 0xFF) / 255.0;
                CGFloat b = (hexVal & 0xFF) / 255.0;
                NSColor *color = [NSColor colorWithSRGBRed:r green:g blue:b alpha:1.0];
                s_isSettingColor = YES;
                [panel setColor:color];
                s_isSettingColor = NO;
            }
        }

        NSRect screenRect = screen ? [screen visibleFrame] : NSMakeRect(0, 0, 1440, 900);
        NSSize panelSize = panel.frame.size;
        if (cocoaX + panelSize.width > NSMaxX(screenRect)) {
            cocoaX = NSMaxX(screenRect) - panelSize.width - 20.0;
        }
        if (cocoaX < NSMinX(screenRect)) {
            cocoaX = NSMinX(screenRect) + 20.0;
        }
        if (cocoaY - panelSize.height < NSMinY(screenRect)) {
            cocoaY = NSMinY(screenRect) + panelSize.height + 20.0;
        }
        if (cocoaY > NSMaxY(screenRect)) {
            cocoaY = NSMaxY(screenRect) - 20.0;
        }

        [panel setFrameTopLeftPoint:NSMakePoint(cocoaX, cocoaY)];
        [panel orderFront:nil];
        [panel setFrameTopLeftPoint:NSMakePoint(cocoaX, cocoaY)];
    });
}

static inline void closeNativeColorPanel(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSColorPanel *panel = [NSColorPanel sharedColorPanel];
        [panel orderOut:nil];
    });
}
*/
import "C"
import (
	"context"
	"unsafe"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var globalAppCtx context.Context

//export ptv_on_color_changed
func ptv_on_color_changed(cHex *C.char) {
	hex := C.GoString(cHex)
	go func(h string) {
		if globalAppCtx != nil {
			runtime.EventsEmit(globalAppCtx, "ptv:color-changed", h)
		}
	}(hex)
}

func initColorPanelBackend(ctx context.Context) {
	globalAppCtx = ctx
}

func openMacColorPanel(windowX, windowY, elemLeft, elemBottom float64, hex string) {
	cHex := C.CString(hex)
	defer C.free(unsafe.Pointer(cHex))
	C.openNativeColorPanel(C.double(windowX), C.double(windowY), C.double(elemLeft), C.double(elemBottom), cHex)
}

func closeMacColorPanel() {
	C.closeNativeColorPanel()
}

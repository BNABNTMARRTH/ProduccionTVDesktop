//go:build darwin
// +build darwin

package main

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

extern void ptv_on_color_changed(char *hex);

static inline void ensureColorObserver(void) {
    static id s_token = nil;
    if (!s_token) {
        s_token = [[NSNotificationCenter defaultCenter] addObserverForName:NSColorPanelColorDidChangeNotification
                                                                    object:nil
                                                                     queue:[NSOperationQueue mainQueue]
                                                                usingBlock:^(NSNotification *note) {
            NSColorPanel *panel = (NSColorPanel *)[note object];
            if (!panel) return;
            NSColor *c = [[panel color] colorUsingColorSpace:[NSColorSpace sRGBColorSpace]];
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

        NSScreen *primary = [NSScreen screens].firstObject;
        CGFloat screenH = primary ? primary.frame.size.height : 900.0;

        CGFloat cocoaX = windowX + elemLeft;
        CGFloat cocoaY = screenH - (windowY + elemBottom) - 6.0;

        [NSColorPanel setPickerMode:NSColorPanelModeCrayon];
        NSColorPanel *panel = [NSColorPanel sharedColorPanel];
        panel.showsAlpha = NO;
        [panel setOpaque:NO];
        panel.alphaValue = 0.90;

        if (initialHex && [initialHex length] >= 7 && [initialHex hasPrefix:@"#"]) {
            unsigned int hexVal = 0;
            NSScanner *scanner = [NSScanner scannerWithString:[initialHex substringFromIndex:1]];
            if ([scanner scanHexInt:&hexVal]) {
                CGFloat r = ((hexVal >> 16) & 0xFF) / 255.0;
                CGFloat g = ((hexVal >> 8) & 0xFF) / 255.0;
                CGFloat b = (hexVal & 0xFF) / 255.0;
                NSColor *color = [NSColor colorWithSRGBRed:r green:g blue:b alpha:1.0];
                [panel setColor:color];
            }
        }

        [panel setFrameTopLeftPoint:NSMakePoint(cocoaX, cocoaY)];
        [panel makeKeyAndOrderFront:nil];
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
	if globalAppCtx != nil {
		runtime.EventsEmit(globalAppCtx, "ptv:color-changed", hex)
	}
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

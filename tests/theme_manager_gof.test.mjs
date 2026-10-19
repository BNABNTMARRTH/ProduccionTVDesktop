import test from "node:test";
import assert from "node:assert/strict";

import {
    ThemeStrategy,
    SystemThemeStrategy,
    LightThemeStrategy,
    DarkThemeStrategy,
    ThemeManager,
    globalThemeManager,
} from "../frontend/src/theme_manager.js";

test("GoF ThemeStrategy: Interfaz base define métodos resolveTheme y getId", () => {
    const base = new ThemeStrategy();
    assert.throws(() => base.resolveTheme(), /debe ser implementado/);
    assert.throws(() => base.getId(), /debe ser implementado/);
});

test("GoF Strategy Pattern: LightThemeStrategy y DarkThemeStrategy resuelven correctamente", () => {
    const light = new LightThemeStrategy();
    assert.equal(light.getId(), "claro");
    assert.equal(light.resolveTheme(), "claro");

    const dark = new DarkThemeStrategy();
    assert.equal(dark.getId(), "oscuro");
    assert.equal(dark.resolveTheme(), "oscuro");
});

test("GoF Strategy Pattern: SystemThemeStrategy resuelve según entorno o fallback", () => {
    const sys = new SystemThemeStrategy();
    assert.equal(sys.getId(), "");
    const theme = sys.resolveTheme();
    assert.ok(theme === "claro" || theme === "oscuro");
});

test("GoF Strategy + Observer: ThemeManager gobierna el cambio de tema y notifica observadores", () => {
    const manager = new ThemeManager();

    const notifications = [];
    const unsubscribe = manager.subscribe((effective, mode) => {
        notifications.push({ effective, mode });
    });

    // Activar modo claro
    const t1 = manager.setThemeMode("claro");
    assert.equal(t1, "claro");
    assert.equal(manager.getMode(), "claro");
    assert.equal(manager.getEffectiveTheme(), "claro");

    // Activar modo oscuro
    const t2 = manager.setThemeMode("oscuro");
    assert.equal(t2, "oscuro");
    assert.equal(manager.getMode(), "oscuro");
    assert.equal(manager.getEffectiveTheme(), "oscuro");

    // Activar sistema (modo '')
    manager.setThemeMode("");
    assert.equal(manager.getMode(), "");

    assert.equal(notifications.length, 3);
    assert.deepEqual(notifications[0], { effective: "claro", mode: "claro" });
    assert.deepEqual(notifications[1], { effective: "oscuro", mode: "oscuro" });

    // Cancelar suscripción
    unsubscribe();
    manager.setThemeMode("claro");
    assert.equal(notifications.length, 3); // No recibe nuevas notificaciones
});

test("GoF ThemeManager: applyToElement sincroniza dataset.tema, .dark y colorScheme", () => {
    const manager = new ThemeManager();
    const fakeElement = {
        dataset: {},
        style: {},
        classList: {
            classes: new Set(),
            toggle(cls, force) {
                if (force) this.classes.add(cls);
                else this.classes.delete(cls);
            },
            contains(cls) {
                return this.classes.has(cls);
            },
        },
    };

    // Modo Claro
    manager.setThemeMode("claro");
    manager.applyToElement(fakeElement);
    assert.equal(fakeElement.dataset.tema, "claro");
    assert.equal(fakeElement.style.colorScheme, "light");
    assert.equal(fakeElement.classList.contains("dark"), false);

    // Modo Oscuro
    manager.setThemeMode("oscuro");
    manager.applyToElement(fakeElement);
    assert.equal(fakeElement.dataset.tema, "oscuro");
    assert.equal(fakeElement.style.colorScheme, "dark");
    assert.equal(fakeElement.classList.contains("dark"), true);

    // Modo Sistema
    manager.setThemeMode("");
    manager.applyToElement(fakeElement);
    assert.equal(fakeElement.dataset.tema, undefined);
});

test("GoF ThemeManager: dispatchToIframe envía postMessage con el tema efectivo", () => {
    const manager = new ThemeManager();
    manager.setThemeMode("claro");

    let sentMessage = null;
    const fakeWindow = {
        postMessage(data, origin) {
            sentMessage = { data, origin };
        },
    };

    manager.dispatchToIframe(fakeWindow);
    assert.deepEqual(sentMessage, {
        data: { type: "producciontv:tema", tema: "claro" },
        origin: "*",
    });
});

test("GoF Singleton: globalThemeManager está disponible para toda la aplicación", () => {
    assert.ok(globalThemeManager instanceof ThemeManager);
});

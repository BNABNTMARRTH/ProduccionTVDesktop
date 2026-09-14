import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ColorPickerBridge,
    ColorPickerImplementor,
    NativeMacColorPickerImplementor,
    WebColorPickerImplementor,
    OpenColorPickerCommand,
} from '../frontend/src/color_picker_bridge.js';

test('GoF Bridge Pattern: ColorPickerBridge desacopla interfaz de implementación', () => {
    let openedWith = null;
    let closed = false;

    class MockImplementor extends ColorPickerImplementor {
        open(cmd) {
            openedWith = cmd;
        }
        close() {
            closed = true;
        }
    }

    const mock = new MockImplementor();
    const bridge = new ColorPickerBridge(mock);

    const cmd = { elemLeft: 120, elemBottom: 350, initialHex: '#FF5500', tag: 'test-color' };
    bridge.open(cmd);
    assert.deepEqual(openedWith, cmd);

    bridge.close();
    assert.equal(closed, true);
});

test('GoF Command Pattern: OpenColorPickerCommand encapsula cálculo geométrico y despacho', () => {
    let dispatchedCommand = null;
    const mockBridge = {
        open: (cmd) => { dispatchedCommand = cmd; },
        close: () => {},
    };

    const mockElement = {
        getBoundingClientRect: () => ({ left: 240, bottom: 480, top: 450, right: 290 }),
    };

    let receivedColor = null;
    const command = new OpenColorPickerCommand({
        triggerEl: mockElement,
        initialHex: '#007AFF',
        tag: 'marca',
        onChange: (color) => { receivedColor = color; },
    });

    command.execute(mockBridge);

    assert.equal(dispatchedCommand.elemLeft, 240);
    assert.equal(dispatchedCommand.elemBottom, 480);
    assert.equal(dispatchedCommand.initialHex, '#007AFF');
    assert.equal(dispatchedCommand.tag, 'marca');

    dispatchedCommand.onChange('#34C759');
    assert.equal(receivedColor, '#34C759');
});

test('GoF Bridge: WebColorPickerImplementor genera input color y despacha cambios', () => {
    let clicked = false;
    let inputValue = '';
    const fakeInput = {
        type: '',
        style: {},
        set value(val) { inputValue = val; },
        get value() { return inputValue; },
        click: () => { clicked = true; },
    };

    const fakeContainer = {
        querySelector: () => fakeInput,
    };

    let updatedColor = null;
    const webImplementor = new WebColorPickerImplementor();
    webImplementor.open({
        triggerEl: fakeContainer,
        initialHex: '#E08A12',
        onChange: (c) => { updatedColor = c; },
    });

    assert.equal(clicked, true);
    assert.equal(inputValue, '#E08A12');

    fakeInput.oninput({ target: { value: '#AF52DE' } });
    assert.equal(updatedColor, '#AF52DE');
});

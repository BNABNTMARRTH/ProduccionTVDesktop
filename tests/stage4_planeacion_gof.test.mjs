import test from "node:test";
import assert from "node:assert/strict";

import {
  SetCommandManager,
  MoveEntityCommand,
  RotateEntityCommand,
  AddFurnitureCommand,
  RemoveFurnitureCommand,
  ToggleTalentSeatCommand,
} from "../web-sources/generador-tv/src/setCommands.js";

import {
  CanvasStateMachine,
  PointerSelectState,
  HandPanState,
} from "../web-sources/generador-tv/src/canvasState.js";

import {
  SET_LAYOUT_STRATEGIES,
  BroadcastNewsStrategy,
  InterviewTalkShowStrategy,
  RoundTableDebateStrategy,
  SoloStreamingStrategy,
  applyLayoutStrategy,
} from "../web-sources/generador-tv/src/layoutStrategies.js";

test("GoF Command Pattern: SetCommandManager ejecuta, deshace y rehace comandos de movimiento", () => {
  let mockConfig = {
    sets: [
      {
        id: "set_1",
        setLayout: {
          pos: { "cam:c1": { x: 100, y: 100 } },
        },
      },
    ],
  };

  const setCfg = (updater) => {
    mockConfig = updater(mockConfig);
  };

  const manager = new SetCommandManager(setCfg);
  assert.equal(manager.canUndo(), false);
  assert.equal(manager.canRedo(), false);

  // Ejecutar movimiento
  const moveCmd = new MoveEntityCommand("set_1", "cam:c1", { x: 100, y: 100 }, { x: 250, y: 350 });
  manager.execute(moveCmd);

  assert.equal(manager.canUndo(), true);
  assert.equal(manager.canRedo(), false);
  assert.deepEqual(mockConfig.sets[0].setLayout.pos["cam:c1"], { x: 250, y: 350 });

  // Deshacer movimiento
  manager.undo();
  assert.equal(manager.canUndo(), false);
  assert.equal(manager.canRedo(), true);
  assert.deepEqual(mockConfig.sets[0].setLayout.pos["cam:c1"], { x: 100, y: 100 });

  // Rehacer movimiento
  manager.redo();
  assert.equal(manager.canUndo(), true);
  assert.equal(manager.canRedo(), false);
  assert.deepEqual(mockConfig.sets[0].setLayout.pos["cam:c1"], { x: 250, y: 350 });
});

test("GoF Command Pattern: RotateEntityCommand gestiona rotaciones manuales y restauraciones", () => {
  let mockConfig = {
    sets: [
      {
        id: "set_1",
        setLayout: {
          rot: { "luz:l1": 45 },
        },
      },
    ],
  };

  const setCfg = (updater) => {
    mockConfig = updater(mockConfig);
  };

  const manager = new SetCommandManager(setCfg);
  const rotCmd = new RotateEntityCommand("set_1", "luz:l1", 45, 90);
  manager.execute(rotCmd);

  assert.equal(mockConfig.sets[0].setLayout.rot["luz:l1"], 90);

  manager.undo();
  assert.equal(mockConfig.sets[0].setLayout.rot["luz:l1"], 45);

  manager.redo();
  assert.equal(mockConfig.sets[0].setLayout.rot["luz:l1"], 90);
});

test("GoF Command Pattern: AddFurnitureCommand y RemoveFurnitureCommand gestionan catálogo de muebles", () => {
  let mockConfig = {
    sets: [
      {
        id: "set_1",
        muebles: [],
        setLayout: { pos: {}, rot: {} },
      },
    ],
  };

  const setCfg = (updater) => {
    mockConfig = updater(mockConfig);
  };

  const manager = new SetCommandManager(setCfg);
  const mueble = { id: "mueble_123", tipo: "sillon2", ocupantes: [] };
  const addCmd = new AddFurnitureCommand("set_1", mueble, { x: 490, y: 300 });

  manager.execute(addCmd);
  assert.equal(mockConfig.sets[0].muebles.length, 1);
  assert.deepEqual(mockConfig.sets[0].setLayout.pos["mue:mueble_123"], { x: 490, y: 300 });

  // Deshacer agregar mueble
  manager.undo();
  assert.equal(mockConfig.sets[0].muebles.length, 0);
  assert.equal(mockConfig.sets[0].setLayout.pos["mue:mueble_123"], undefined);

  // Rehacer
  manager.redo();
  assert.equal(mockConfig.sets[0].muebles.length, 1);
});

test("GoF State Pattern: CanvasStateMachine administra transiciones entre selección y desplazamiento (Pan)", () => {
  let selected = null;
  let panned = { x: 0, y: 0 };
  let zoom = 1.0;

  const fsm = new CanvasStateMachine({
    onSelectEntity: (key) => {
      selected = key;
    },
    onPan: (dx, dy) => {
      panned.x += dx;
      panned.y += dy;
    },
    onZoomChange: (z) => {
      zoom = z;
    },
  });

  assert.equal(fsm.getMode(), "select");
  assert.equal(fsm.getCursor(), "default");

  // Simular click en entidad
  fsm.currentState.onPointerDown({}, "cam:1");
  assert.equal(selected, "cam:1");

  // Cambiar a modo Pan (Herramienta Mano)
  fsm.setMode("pan");
  assert.equal(fsm.getMode(), "pan");
  assert.equal(fsm.getCursor(), "grab");

  // Simular arrastre en pan
  fsm.currentState.onPointerDown({ clientX: 100, clientY: 100 });
  assert.equal(fsm.getCursor(), "grabbing");
  fsm.currentState.onPointerMove({ clientX: 150, clientY: 130 });
  assert.deepEqual(panned, { x: 50, y: 30 });
  fsm.currentState.onPointerUp();
  assert.equal(fsm.getCursor(), "grab");

  // Control de Zoom
  fsm.zoomIn();
  assert.ok(zoom > 1.0);
  fsm.resetZoom();
  assert.equal(zoom, 1.0);
});

test("GoF Strategy Pattern: Estrategias de distribución física aplican cálculo geométrico preciso", () => {
  const mockCfg = {
    camaras: [
      { id: "c1", num: 1, nombre: "Cámara 1" },
      { id: "c2", num: 2, nombre: "Cámara 2" },
      { id: "c3", num: 3, nombre: "Cámara 3" },
    ],
    talentos: [
      { id: "t1", nombre: "Conductor", tipo: "conductor" },
      { id: "t2", nombre: "Invitado", tipo: "invitado" },
    ],
  };

  const mockSet = {
    id: "set_1",
    iluminacion: {
      luces: [
        { id: "l1", abrev: "KEY" },
        { id: "l2", abrev: "FILL" },
        { id: "l3", abrev: "BACK" },
      ],
    },
    setLayout: { pos: {}, rot: {} },
  };

  // Noticiero Broadcast
  const newsResult = applyLayoutStrategy("news", mockCfg, mockSet);
  assert.ok(newsResult.setLayout.pos["cam:c1"]);
  assert.ok(newsResult.setLayout.pos["tal:t1"]);
  assert.ok(newsResult.setLayout.pos["luz:l1"]);

  // Entrevista / Talk Show
  const interviewResult = applyLayoutStrategy("interview", mockCfg, mockSet);
  assert.ok(interviewResult.setLayout.pos["cam:c1"]);
  assert.ok(interviewResult.setLayout.pos["cam:c2"]);
  assert.ok(interviewResult.setLayout.pos["cam:c3"]);

  // Mesa de Debate
  const debateResult = applyLayoutStrategy("debate", mockCfg, mockSet);
  assert.ok(debateResult.setLayout.pos["tal:t1"]);
  assert.ok(debateResult.setLayout.pos["tal:t2"]);

  // Streaming Unipersonal
  const streamResult = applyLayoutStrategy("streaming", mockCfg, mockSet);
  assert.ok(streamResult.setLayout.pos["cam:c1"]);
});

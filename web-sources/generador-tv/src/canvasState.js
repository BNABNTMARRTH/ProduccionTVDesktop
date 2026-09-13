/**
 * GoF Pattern: State Pattern (FSM)
 * Manejo formal de herramientas e interacción con el lienzo del set 2D.
 */

export class CanvasToolState {
  constructor(machine) {
    this.machine = machine;
  }

  getName() {
    return "base";
  }

  getCursor() {
    return "default";
  }

  onPointerDown(event, entityKey) {}
  onPointerMove(event) {}
  onPointerUp(event) {}
}

/**
 * Estado: Herramienta Puntero / Selección (V)
 */
export class PointerSelectState extends CanvasToolState {
  getName() {
    return "select";
  }

  getCursor() {
    return "default";
  }

  onPointerDown(event, entityKey) {
    if (entityKey) {
      this.machine.selectEntity(entityKey);
    } else {
      this.machine.selectEntity(null);
    }
  }
}

/**
 * Estado: Herramienta Mano / Desplazamiento (H)
 */
export class HandPanState extends CanvasToolState {
  constructor(machine) {
    super(machine);
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;
  }

  getName() {
    return "pan";
  }

  getCursor() {
    return this.isPanning ? "grabbing" : "grab";
  }

  onPointerDown(event) {
    this.isPanning = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
  }

  onPointerMove(event) {
    if (!this.isPanning) return;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.machine.panBy(dx, dy);
  }

  onPointerUp() {
    this.isPanning = false;
  }
}

/**
 * Máquina de Estados del Canvas (CanvasStateMachine)
 */
export class CanvasStateMachine {
  constructor({ onSelectEntity, onPan, onZoomChange }) {
    this.onSelectEntity = onSelectEntity;
    this.onPan = onPan;
    this.onZoomChange = onZoomChange;

    this.states = {
      select: new PointerSelectState(this),
      pan: new HandPanState(this),
    };

    this.currentState = this.states.select;
    this.selectedKey = null;
    this.zoomLevel = 1.0;
  }

  setMode(mode) {
    if (this.states[mode]) {
      this.currentState = this.states[mode];
    }
  }

  getMode() {
    return this.currentState.getName();
  }

  getCursor() {
    return this.currentState.getCursor();
  }

  selectEntity(key) {
    this.selectedKey = key;
    if (this.onSelectEntity) this.onSelectEntity(key);
  }

  panBy(dx, dy) {
    if (this.onPan) this.onPan(dx, dy);
  }

  setZoom(zoom) {
    this.zoomLevel = Math.max(0.5, Math.min(2.5, zoom));
    if (this.onZoomChange) this.onZoomChange(this.zoomLevel);
  }

  zoomIn() {
    this.setZoom(this.zoomLevel + 0.15);
  }

  zoomOut() {
    this.setZoom(this.zoomLevel - 0.15);
  }

  resetZoom() {
    this.setZoom(1.0);
  }
}

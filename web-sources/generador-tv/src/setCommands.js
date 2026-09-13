/**
 * GoF Pattern: Command Pattern
 * Encapsulamiento de acciones sobre el set físico con soporte completo para Undo / Redo.
 */

import { upSetPor } from "./sets.js";

/**
 * Interfaz base de Comando
 */
export class SetCommand {
  constructor(setId, description) {
    this.setId = setId;
    this.description = description;
  }

  execute(setCfg) {
    throw new Error("execute() debe ser implementado");
  }

  undo(setCfg) {
    throw new Error("undo() debe ser implementado");
  }
}

/**
 * Comando: Mover entidad en el set
 */
export class MoveEntityCommand extends SetCommand {
  constructor(setId, entityKey, fromPos, toPos) {
    super(setId, `Mover ${entityKey}`);
    this.entityKey = entityKey;
    this.fromPos = { ...fromPos };
    this.toPos = { ...toPos };
  }

  execute(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => ({
        ...s,
        setLayout: {
          ...(s.setLayout || {}),
          pos: { ...(s.setLayout?.pos || {}), [this.entityKey]: this.toPos },
        },
      })),
      { commit: true }
    );
  }

  undo(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => ({
        ...s,
        setLayout: {
          ...(s.setLayout || {}),
          pos: { ...(s.setLayout?.pos || {}), [this.entityKey]: this.fromPos },
        },
      })),
      { commit: true }
    );
  }
}

/**
 * Comando: Rotar entidad en el set
 */
export class RotateEntityCommand extends SetCommand {
  constructor(setId, entityKey, fromRot, toRot) {
    super(setId, `Rotar ${entityKey}`);
    this.entityKey = entityKey;
    this.fromRot = fromRot; // puede ser null/number
    this.toRot = toRot;
  }

  execute(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => {
        const rot = { ...(s.setLayout?.rot || {}) };
        if (typeof this.toRot === "number") {
          rot[this.entityKey] = this.toRot;
        } else {
          delete rot[this.entityKey];
        }
        return {
          ...s,
          setLayout: { ...(s.setLayout || {}), rot },
        };
      }),
      { commit: true }
    );
  }

  undo(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => {
        const rot = { ...(s.setLayout?.rot || {}) };
        if (typeof this.fromRot === "number") {
          rot[this.entityKey] = this.fromRot;
        } else {
          delete rot[this.entityKey];
        }
        return {
          ...s,
          setLayout: { ...(s.setLayout || {}), rot },
        };
      }),
      { commit: true }
    );
  }
}

/**
 * Comando: Agregar Mueble
 */
export class AddFurnitureCommand extends SetCommand {
  constructor(setId, furnitureItem, defaultPos) {
    super(setId, `Agregar mueble ${furnitureItem.tipo}`);
    this.furnitureItem = furnitureItem;
    this.defaultPos = defaultPos;
  }

  execute(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => ({
        ...s,
        muebles: [...(s.muebles || []), this.furnitureItem],
        setLayout: {
          ...(s.setLayout || {}),
          pos: { ...(s.setLayout?.pos || {}), [`mue:${this.furnitureItem.id}`]: this.defaultPos },
        },
      })),
      { commit: true }
    );
  }

  undo(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => {
        const pos = { ...(s.setLayout?.pos || {}) };
        const rot = { ...(s.setLayout?.rot || {}) };
        delete pos[`mue:${this.furnitureItem.id}`];
        delete rot[`mue:${this.furnitureItem.id}`];
        return {
          ...s,
          muebles: (s.muebles || []).filter((m) => m.id !== this.furnitureItem.id),
          setLayout: { ...(s.setLayout || {}), pos, rot },
        };
      }),
      { commit: true }
    );
  }
}

/**
 * Comando: Quitar Mueble
 */
export class RemoveFurnitureCommand extends SetCommand {
  constructor(setId, furnitureItem, currentPos, currentRot) {
    super(setId, `Quitar mueble ${furnitureItem.tipo}`);
    this.furnitureItem = furnitureItem;
    this.savedPos = currentPos;
    this.savedRot = currentRot;
  }

  execute(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => {
        const pos = { ...(s.setLayout?.pos || {}) };
        const rot = { ...(s.setLayout?.rot || {}) };
        delete pos[`mue:${this.furnitureItem.id}`];
        delete rot[`mue:${this.furnitureItem.id}`];
        return {
          ...s,
          muebles: (s.muebles || []).filter((m) => m.id !== this.furnitureItem.id),
          setLayout: { ...(s.setLayout || {}), pos, rot },
        };
      }),
      { commit: true }
    );
  }

  undo(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => {
        const pos = { ...(s.setLayout?.pos || {}) };
        const rot = { ...(s.setLayout?.rot || {}) };
        if (this.savedPos) pos[`mue:${this.furnitureItem.id}`] = this.savedPos;
        if (typeof this.savedRot === "number") rot[`mue:${this.furnitureItem.id}`] = this.savedRot;
        return {
          ...s,
          muebles: [...(s.muebles || []), this.furnitureItem],
          setLayout: { ...(s.setLayout || {}), pos, rot },
        };
      }),
      { commit: true }
    );
  }
}

/**
 * Comando: Asignar o Levantar Asiento de Talento
 */
export class ToggleTalentSeatCommand extends SetCommand {
  constructor(setId, furnitureId, talentId, wasSeated) {
    super(setId, wasSeated ? "Levantar talento" : "Sentar talento");
    this.furnitureId = furnitureId;
    this.talentId = talentId;
    this.wasSeated = wasSeated;
  }

  execute(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => ({
        ...s,
        muebles: (s.muebles || []).map((m) => {
          if (m.id === this.furnitureId) {
            return this.wasSeated
              ? { ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== this.talentId) }
              : { ...m, ocupantes: [...(m.ocupantes || []), this.talentId] };
          }
          return this.wasSeated ? m : { ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== this.talentId) };
        }),
      })),
      { commit: true }
    );
  }

  undo(setCfg) {
    setCfg((c) =>
      upSetPor(c, this.setId, (s) => ({
        ...s,
        muebles: (s.muebles || []).map((m) => {
          if (m.id === this.furnitureId) {
            return this.wasSeated
              ? { ...m, ocupantes: [...(m.ocupantes || []), this.talentId] }
              : { ...m, ocupantes: (m.ocupantes || []).filter((x) => x !== this.talentId) };
          }
          return m;
        }),
      })),
      { commit: true }
    );
  }
}

/**
 * Invocador / Administrador de Comandos del Set (SetCommandManager)
 */
export class SetCommandManager {
  constructor(setCfg) {
    this.setCfg = setCfg;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
  }

  execute(command) {
    command.execute(this.setCfg);
    this.undoStack.push(command);
    this.redoStack = [];
    this._notify();
  }

  undo() {
    if (!this.canUndo()) return;
    const command = this.undoStack.pop();
    command.undo(this.setCfg);
    this.redoStack.push(command);
    this._notify();
  }

  redo() {
    if (!this.canRedo()) return;
    const command = this.redoStack.pop();
    command.execute(this.setCfg);
    this.undoStack.push(command);
    this._notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    this.listeners.forEach((fn) => fn({ canUndo: this.canUndo(), canRedo: this.canRedo() }));
  }
}

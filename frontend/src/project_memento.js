// Memento Pattern (GoF) para la captura y restauración del estado de proyectos.
// Permite guardar snapshots ligeros de la configuración y diagramas para
// implementar Deshacer / Rehacer a nivel proyecto de forma inmutable.

export class ProjectMemento {
    constructor(project) {
        if (!project) throw new Error('[ProjectMemento] Se requiere un proyecto válido');
        this.id = project.id;
        this.name = project.name;
        this.template = project.template;
        this.timestamp = new Date().toISOString();
        // Clonado profundo para garantizar inmutabilidad
        this.cfg = project.cfg ? JSON.parse(JSON.stringify(project.cfg)) : null;
        this.diagram = project.diagram ? JSON.parse(JSON.stringify(project.diagram)) : null;
    }

    restore() {
        return {
            id: this.id,
            name: this.name,
            template: this.template,
            updatedAt: this.timestamp,
            cfg: this.cfg ? JSON.parse(JSON.stringify(this.cfg)) : null,
            diagram: this.diagram ? JSON.parse(JSON.stringify(this.diagram)) : null,
        };
    }
}

export class ProjectHistoryManager {
    constructor({ maxDepth = 25 } = {}) {
        this.maxDepth = maxDepth;
        this.undoStack = [];
        this.redoStack = [];
    }

    saveSnapshot(project) {
        if (!project || !project.id) return null;
        const memento = new ProjectMemento(project);
        
        // Evitar duplicar snapshots si el contenido es idéntico al último
        const ultimo = this.undoStack[this.undoStack.length - 1];
        if (ultimo) {
            const igualCfg = JSON.stringify(ultimo.cfg) === JSON.stringify(memento.cfg);
            const igualDiag = JSON.stringify(ultimo.diagram) === JSON.stringify(memento.diagram);
            const igualNombre = ultimo.name === memento.name;
            if (igualCfg && igualDiag && igualNombre) return ultimo;
        }

        this.undoStack.push(memento);
        if (this.undoStack.length > this.maxDepth) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        return memento;
    }

    canUndo() {
        return this.undoStack.length > 1;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo(currentProject) {
        if (!this.canUndo()) return null;
        const actual = this.undoStack.pop();
        if (currentProject) {
            this.redoStack.push(new ProjectMemento(currentProject));
        } else {
            this.redoStack.push(actual);
        }
        const anterior = this.undoStack[this.undoStack.length - 1];
        return anterior ? anterior.restore() : null;
    }

    redo(currentProject) {
        if (!this.canRedo()) return null;
        const siguiente = this.redoStack.pop();
        if (currentProject) {
            this.undoStack.push(new ProjectMemento(currentProject));
        }
        return siguiente ? siguiente.restore() : null;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

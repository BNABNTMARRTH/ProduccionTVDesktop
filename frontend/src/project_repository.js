// Repository Pattern (GoF) para la persistencia de proyectos
// Abstrae y unifica la caché en localStorage y el almacenamiento real en disco (.ptv) mediante Wails.

import { STORAGE_KEYS } from './constants.js';
import { diagramFromConfig, uid } from './templates.js';

export const bundleDeProyecto = (p) => JSON.stringify({
    project: {
        id: p.id,
        name: p.name,
        template: p.template,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    },
    infographic: p.cfg,
    diagram: p.diagram || null,
}, null, 2);

export function proyectoDesdeBundle(data, { conservarId = true } = {}) {
    let cfg = null;
    let diagram = null;
    let meta = null;
    if (data && data.infographic && Array.isArray(data.infographic.camaras)) {
        cfg = data.infographic;
        diagram = data.diagram || null;
        meta = data.project || null;
    } else if (data && Array.isArray(data.camaras)) {
        cfg = data;
    } else {
        return null;
    }
    // Migración: los proyectos anteriores a los modos se interpretan como
    // "programa en vivo" (el flujo original de circuito cerrado). No destructivo.
    if (cfg && !cfg.modo) cfg.modo = 'live';
    return {
        id: (conservarId && meta?.id) || uid('project'),
        name: String(meta?.name || cfg.titulo || 'Proyecto importado').trim() || 'Proyecto importado',
        template: meta?.template || 'vacio',
        createdAt: meta?.createdAt || new Date().toISOString(),
        updatedAt: meta?.updatedAt || new Date().toISOString(),
        cfg,
        diagram: diagram || diagramFromConfig(cfg),
    };
}

export class ProjectRepository {
    constructor({
        storage = (typeof localStorage !== 'undefined' ? localStorage : null),
        storageKeys = STORAGE_KEYS,
        saveProjectFile = null,
        deleteProjectFile = null,
        loadAllProjects = null,
    } = {}) {
        this.storage = storage;
        this.keys = storageKeys;
        this.saveProjectFile = saveProjectFile;
        this.deleteProjectFile = deleteProjectFile;
        this.loadAllProjects = loadAllProjects;
    }

    _readJSON(key, fallback) {
        if (!this.storage) return fallback;
        try {
            const raw = this.storage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    _writeJSON(key, val) {
        if (!this.storage) return;
        try {
            this.storage.setItem(key, JSON.stringify(val));
        } catch (err) {
            console.error('[ProjectRepository] Error escribiendo caché:', err);
        }
    }

    getAll() {
        return this._readJSON(this.keys.projects, []);
    }

    setAll(projects) {
        this._writeJSON(this.keys.projects, projects);
    }

    getById(id) {
        if (!id) return null;
        return this.getAll().find((p) => p.id === id) || null;
    }

    getActiveId() {
        if (!this.storage) return '';
        try {
            return this.storage.getItem(this.keys.activeProject) || '';
        } catch {
            return '';
        }
    }

    setActiveId(id) {
        if (!this.storage) return;
        try {
            if (id) this.storage.setItem(this.keys.activeProject, id);
            else this.storage.removeItem(this.keys.activeProject);
        } catch { /* noop */ }
    }

    save(project, { persistDisk = true } = {}) {
        if (!project || !project.id) return null;
        const all = this.getAll();
        const idx = all.findIndex((p) => p.id === project.id);
        const actualizado = {
            ...project,
            updatedAt: new Date().toISOString(),
        };

        if (idx >= 0) all[idx] = actualizado;
        else all.unshift(actualizado);

        this.setAll(all);

        if (persistDisk && typeof this.saveProjectFile === 'function') {
            try {
                this.saveProjectFile(actualizado.id, bundleDeProyecto(actualizado)).catch(() => {});
            } catch { /* ignorar fallo en desarrollo */ }
        }
        return actualizado;
    }

    delete(id, { persistDisk = true } = {}) {
        if (!id) return false;
        const all = this.getAll();
        const filtered = all.filter((p) => p.id !== id);
        this.setAll(filtered);

        if (this.getActiveId() === id) {
            this.setActiveId('');
        }

        if (persistDisk && typeof this.deleteProjectFile === 'function') {
            try {
                this.deleteProjectFile(id).catch(() => {});
            } catch { /* noop */ }
        }
        return true;
    }

    async syncFromDisk() {
        if (typeof this.loadAllProjects !== 'function') return this.getAll();
        try {
            const rawFiles = await this.loadAllProjects();
            if (!Array.isArray(rawFiles)) return this.getAll();

            const proyectosEnDisco = rawFiles
                .map((f) => {
                    try {
                        const parsed = typeof f.content === 'string' ? JSON.parse(f.content) : f.content;
                        const p = proyectoDesdeBundle(parsed, { conservarId: true });
                        if (p && f.id) p.id = f.id;
                        return p;
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);

            if (proyectosEnDisco.length > 0) {
                this.setAll(proyectosEnDisco);
                return proyectosEnDisco;
            }
        } catch (err) {
            console.warn('[ProjectRepository] Fallo al sincronizar desde disco:', err);
        }
        return this.getAll();
    }
}

// Flyweight Pattern (GoF) para compartir y cachear representaciones de activos y diagramas.
// Minimiza la huella de memoria RAM y evita recalcular imágenes y planos repetidos.

export class AssetFlyweightCache {
    constructor({ maxEntries = 50 } = {}) {
        this.maxEntries = maxEntries;
        this.cache = new Map();
    }

    get(key) {
        if (!key || !this.cache.has(key)) return null;
        // Estrategia LRU simple: mover al final de la iteración
        const val = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, val);
        return val;
    }

    set(key, asset) {
        if (!key) return null;
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxEntries) {
            // Desalojar el elemento más antiguo (primer elemento del Map)
            const primerKey = this.cache.keys().next().value;
            this.cache.delete(primerKey);
        }
        this.cache.set(key, asset);
        return asset;
    }

    has(key) {
        return this.cache.has(key);
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
}

export const globalAssetCache = new AssetFlyweightCache({ maxEntries: 40 });

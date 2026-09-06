/**
 * AgriQueue Storage Service
 * Robust localStorage abstraction layer for prototype state persistence.
 */

const STORAGE_PREFIX = 'agriqueue_';

class StorageService {
  private memoryStore: Map<string, string> = new Map();

  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const testKey = '__agriqueue_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  public get<T>(key: string, defaultValue?: T): T {
    const fullKey = STORAGE_PREFIX + key;
    try {
      if (this.isLocalStorageAvailable()) {
        const raw = window.localStorage.getItem(fullKey);
        if (raw === null || raw === undefined) return defaultValue as T;
        return JSON.parse(raw) as T;
      } else {
        const raw = this.memoryStore.get(fullKey);
        if (raw === null || raw === undefined) return defaultValue as T;
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.warn(`[StorageService] Error reading key "${key}":`, err);
      return defaultValue as T;
    }
  }

  public set<T>(key: string, value: T): void {
    const fullKey = STORAGE_PREFIX + key;
    try {
      const serialized = JSON.stringify(value);
      if (this.isLocalStorageAvailable()) {
        window.localStorage.setItem(fullKey, serialized);
      } else {
        this.memoryStore.set(fullKey, serialized);
      }
    } catch (err) {
      console.warn(`[StorageService] Error writing key "${key}":`, err);
    }
  }

  public remove(key: string): void {
    const fullKey = STORAGE_PREFIX + key;
    try {
      if (this.isLocalStorageAvailable()) {
        window.localStorage.removeItem(fullKey);
      } else {
        this.memoryStore.delete(fullKey);
      }
    } catch (err) {
      console.warn(`[StorageService] Error removing key "${key}":`, err);
    }
  }

  public clearAll(): void {
    try {
      if (this.isLocalStorageAvailable()) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } else {
        this.memoryStore.clear();
      }
    } catch (err) {
      console.warn('[StorageService] Error clearing keys:', err);
    }
  }

  public has(key: string): boolean {
    const fullKey = STORAGE_PREFIX + key;
    if (this.isLocalStorageAvailable()) {
      return window.localStorage.getItem(fullKey) !== null;
    }
    return this.memoryStore.has(fullKey);
  }
}

export const storageService = new StorageService();

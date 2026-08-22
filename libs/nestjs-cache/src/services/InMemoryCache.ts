import type { ICache } from '../interface/ICache';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Implémentation en mémoire du cache générique.
 *
 * Convient pour une instance unique (développement, petite production).
 * Pour un déploiement multi-instances, utiliser `RedisCache`.
 *
 * @template T Type de la valeur stockée.
 */
export class InMemoryCache<T> implements ICache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  async get(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.evict();
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Supprime les entrées expirées pour éviter les fuites mémoire. */
  private evict(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt <= now) this.store.delete(k);
    }
  }
}

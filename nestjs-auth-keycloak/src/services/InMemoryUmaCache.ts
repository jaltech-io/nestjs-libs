import type { IUmaCache } from '@jaltech/nestjs-auth-core';

/**
 * Cache mémoire par défaut des décisions UMA (Map + TTL, instance unique).
 * Pour un déploiement multi-instances, fournir un store Redis via `umaCacheStore`.
 */
export class InMemoryUmaCache implements IUmaCache {
  private readonly store = new Map<string, { granted: boolean; expiresAt: number }>();

  async get(key: string): Promise<{ granted: boolean; expiresAt: number } | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key: string, value: { granted: boolean; expiresAt: number }): Promise<void> {
    this.store.set(key, value);
    this.evict();
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

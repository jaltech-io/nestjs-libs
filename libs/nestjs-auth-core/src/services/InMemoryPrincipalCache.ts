import type { IPrincipalCache } from '../interface/IPrincipalCache';
import type { AuthPrincipal } from '../types/AuthPrincipal';

interface Entry {
  value: AuthPrincipal;
  expiresAt: number;
}

/**
 * Cache mémoire par défaut des principals résolus (Map + TTL, instance unique).
 *
 * Utilisé automatiquement quand aucun store n'est fourni via `PRINCIPAL_CACHE`.
 * Pour un déploiement multi-instances, brancher un store Redis sous ce token.
 */
export class InMemoryPrincipalCache implements IPrincipalCache {
  private readonly store = new Map<string, Entry>();

  async get(key: string): Promise<AuthPrincipal | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: AuthPrincipal, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.evict();
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }
}

import type { AuthPrincipal } from '../types/AuthPrincipal';

/**
 * Contrat du store de cache des principals résolus.
 *
 * Même mécanisme que `IUmaCache` (mémoire par défaut, Redis-capable via store injecté).
 * Fourni via le token DI `PRINCIPAL_CACHE`.
 */
export interface IPrincipalCache {
  /**
   * Récupère un principal en cache.
   * @param key - Clé `provider:subject`.
   * @returns Le principal, `null` si absent ou expiré.
   */
  get(key: string): Promise<AuthPrincipal | null>;

  /**
   * Stocke un principal résolu.
   * @param ttlMs - Durée de vie en millisecondes.
   */
  set(key: string, value: AuthPrincipal, ttlMs: number): Promise<void>;
}

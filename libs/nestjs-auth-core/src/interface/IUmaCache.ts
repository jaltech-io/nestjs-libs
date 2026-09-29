/**
 * Contrat du store de cache des décisions UMA.
 *
 * Structurellement compatible avec `ICache<{ granted: boolean }>` de
 * `@jaltech/nestjs-cache` : toute implémentation de ce dernier est assignable ici.
 */
export interface IUmaCache {
  /**
   * Récupère une décision UMA depuis le cache.
   * @returns La décision et son expiration, `null` si absente ou expirée.
   */
  get(key: string): Promise<{ granted: boolean; expiresAt: number } | null>;

  /**
   * Stocke une décision UMA.
   * @param ttlMs - Durée de vie en millisecondes.
   */
  set(key: string, value: { granted: boolean; expiresAt: number }, ttlMs: number): Promise<void>;
}

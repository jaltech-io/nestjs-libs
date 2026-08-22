/**
 * Contrat générique d'un store de cache clé/valeur avec TTL.
 *
 * Implémentations fournies par la lib :
 * - `InMemoryCache` — mémoire du process, instance unique.
 * - `RedisCache`    — Redis partagé, multi-instances.
 *
 * @template T Type de la valeur stockée.
 *
 * @example
 * // Implémentation custom (Memcached, DynamoDB…)
 * class MemcachedCache<T> implements ICache<T> {
 *   async get(key: string): Promise<T | null> { ... }
 *   async set(key: string, value: T, ttlMs: number): Promise<void> { ... }
 * }
 */
export interface ICache<T> {
  /**
   * Récupère une valeur depuis le cache.
   *
   * @param key - Clé de cache.
   * @returns La valeur si elle est présente et non expirée, `null` sinon.
   */
  get(key: string): Promise<T | null>;

  /**
   * Stocke une valeur dans le cache avec une durée de vie.
   *
   * @param key   - Clé de cache.
   * @param value - Valeur à stocker.
   * @param ttlMs - Durée de vie en millisecondes.
   */
  set(key: string, value: T, ttlMs: number): Promise<void>;

  /** Supprime une entrée avant son expiration. */
  delete(key: string): Promise<void>;
}

/**
 * Contrat du store de cache des décisions UMA.
 *
 * Sa signature est structurellement identique à `ICache<{ granted: boolean }>`
 * de `nestjs-cache`. Toute implémentation de `ICache<{ granted: boolean }>`
 * est donc directement assignable ici (typage structurel TypeScript).
 *
 * L'application ne manipule jamais ce type directement : elle passe une
 * `CacheStoreConfig` à `KeycloakModule.register()`, et le module crée
 * l'implémentation en interne via `buildCacheStore`.
 *
 * @example
 * // Dans app.module.ts — config descriptive, pas de classes concrètes
 * KeycloakModule.register({
 *   umaCacheStore: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' },
 * })
 */
export interface IUmaCache {
  /**
   * Récupère une décision UMA depuis le cache.
   *
   * @param key - Clé de cache (format `sub:permissions`).
   * @returns La décision avec son horodatage d'expiration, `null` si absente ou expirée.
   */
  get(key: string): Promise<{ granted: boolean; expiresAt: number } | null>;

  /**
   * Stocke une décision UMA dans le cache.
   *
   * @param key   - Clé de cache (format `sub:permissions`).
   * @param value - Décision à stocker (inclut `expiresAt` pour le calcul de TTL restant).
   * @param ttlMs - Durée de vie en millisecondes.
   */
  set(key: string, value: { granted: boolean; expiresAt: number }, ttlMs: number): Promise<void>;
}

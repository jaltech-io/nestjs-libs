/**
 * Configuration du store de cache générique.
 *
 * L'application passe un objet de configuration descriptif —
 * `CacheModule` crée l'implémentation (`InMemoryCache` ou `RedisCache`) en interne.
 * L'app ne connaît jamais les classes concrètes.
 *
 * @example { type: 'memory' }
 * @example { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' }
 */
export type CacheStoreConfig = { type: 'memory' } | { type: 'redis'; url: string; namespace?: string };

/**
 * Configuration du store de session `express-session`.
 *
 * `CacheModule` crée l'implémentation (`MemorySessionStore` ou `RedisSessionStore`) en interne.
 *
 * @example { type: 'memory' }
 * @example { type: 'redis', url: process.env.REDIS_URL }
 */
export type SessionStoreConfig = { type: 'memory' } | { type: 'redis'; url: string };

/**
 * Entrée du tableau `extras` : associe un token DI arbitraire à un store de cache.
 *
 * Permet à l'application (composition root) de brancher un store sous n'importe
 * quel token sans que `nestjs-cache` connaisse ce token.
 *
 * @example
 * import { UMA_CACHE } from 'nestjs-auth';
 * extras: [{ provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } }]
 */
export type CacheExtra = {
  /** Token DI sous lequel le store sera fourni (Symbol, string, classe…). */
  provide: any;
  /** Configuration du store à instancier. */
  config: CacheStoreConfig;
};

/**
 * Configuration statique du `CacheModule`.
 */
export type CacheConfig = {
  /**
   * Store de cache générique. Injecté sous le token `CACHE_STORE`.
   *
   * @example { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' }
   */
  store: CacheStoreConfig;

  /**
   * Store de session `express-session`. Injecté sous le token `SESSION_STORE`.
   * Optionnel — ne fournir que si le BFF httpOnly est activé.
   *
   * @example { type: 'redis', url: process.env.REDIS_URL }
   */
  sessionStore?: SessionStoreConfig;

  /**
   * Stores supplémentaires enregistrés sous des tokens arbitraires.
   *
   * `CacheModule` étant global, ces tokens sont disponibles dans tout le conteneur DI.
   *
   * @example
   * import { UMA_CACHE } from 'nestjs-auth';
   *
   * CacheModule.register({
   *   store:  { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
   *   extras: [{ provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } }],
   * })
   */
  extras?: CacheExtra[];
};

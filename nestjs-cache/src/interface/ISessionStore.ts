/**
 * Contrat d'un store de session compatible `express-session`.
 *
 * Implémentations fournies par la lib :
 * - `RedisSessionStore`  — Redis partagé, multi-instances (production).
 * - `MemorySessionStore` — mémoire du process, instance unique (développement).
 *
 * @example
 * // Brancher Redis
 * const store: ISessionStore = new RedisSessionStore(process.env.REDIS_URL);
 * await store.connect();
 * app.use(session({ store: store.getStore(), ... }));
 *
 * @example
 * // Basculer en mémoire (tests / dev sans Redis)
 * const store: ISessionStore = new MemorySessionStore();
 * await store.connect();
 * app.use(session({ store: store.getStore(), ... }));
 */
export interface ISessionStore {
  /**
   * Établit la connexion au backend du store (ex : Redis).
   * Doit être appelé avant `getStore()`.
   */
  connect(): Promise<void>;

  /**
   * Retourne le store compatible `express-session`.
   * À passer directement à l'option `store` de `express-session`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getStore(): any;
}

import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import type { ISessionStore } from '../interface/ISessionStore';

/**
 * Store de session Redis pour `express-session`.
 *
 * Partage les sessions entre toutes les instances NestJS derrière un load balancer.
 * Utilise `redis` (client officiel) + `connect-redis` comme adaptateur.
 *
 * @example
 * const store = new RedisSessionStore(process.env.REDIS_URL);
 * await store.connect();
 * app.use(session({ store: store.getStore(), secret: '...', ... }));
 */
export class RedisSessionStore implements ISessionStore {
  private client: ReturnType<typeof createClient>;
  private redisStore: RedisStore;

  /**
   * @param url - URL de connexion Redis. Défaut : `redis://localhost:6379`.
   */
  constructor(private readonly url: string = 'redis://localhost:6379') {}

  async connect(): Promise<void> {
    this.client = createClient({ url: this.url });
    this.client.on('error', (err) => console.error('[RedisSessionStore] error', err));
    this.client.on('connect', () => console.log('[RedisSessionStore] connected'));
    await this.client.connect();
    this.redisStore = new RedisStore({ client: this.client });
  }

  getStore(): RedisStore {
    return this.redisStore;
  }
}

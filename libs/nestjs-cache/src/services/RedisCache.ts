import type { Redis } from 'ioredis';
import type { ICache } from '../interface/ICache';

/**
 * Implémentation Redis du cache générique.
 *
 * Partage le cache entre toutes les instances NestJS derrière un load balancer.
 * Les valeurs sont sérialisées en JSON. Les clés sont préfixées par le `namespace`
 * pour éviter les collisions avec d'autres données Redis.
 *
 * @template T Type de la valeur stockée (doit être sérialisable en JSON).
 *
 * @example
 * import { Redis }      from 'ioredis';
 * import { RedisCache } from 'nestjs-cache';
 *
 * const redis = new Redis({ host: process.env.REDIS_HOST, port: +process.env.REDIS_PORT });
 *
 * // Cache de décisions UMA partagé entre instances
 * const umaCache = new RedisCache<{ granted: boolean }>(redis, 'uma');
 */
export class RedisCache<T> implements ICache<T> {
  /**
   * @param redis     - Instance ioredis connectée.
   * @param namespace - Préfixe des clés Redis. Défaut : `'cache'`.
   */
  constructor(
    private readonly redis: Redis,
    private readonly namespace: string = 'cache',
  ) {}

  async get(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.prefixed(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    await this.redis.set(this.prefixed(key), JSON.stringify(value), 'PX', ttlMs);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.prefixed(key));
  }

  private prefixed(key: string): string {
    return `${this.namespace}:${key}`;
  }
}

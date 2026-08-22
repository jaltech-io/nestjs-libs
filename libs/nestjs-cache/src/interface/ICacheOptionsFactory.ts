import type { CacheConfig } from '../types/CacheConfig';

/**
 * Contrat d'une factory de configuration pour `CacheModule.registerAsync()`.
 *
 * Implémenter cette interface dans un service NestJS permet d'injecter
 * des dépendances (ex: `ConfigService`) pour construire la configuration dynamiquement.
 *
 * @example
 * @Injectable()
 * class MyCacheConfig implements ICacheOptionsFactory {
 *   constructor(private readonly config: ConfigService) {}
 *
 *   createCacheOptions(): CacheConfig {
 *     return {
 *       store:        { type: 'redis', url: this.config.get('REDIS_URL'), namespace: 'app' },
 *       sessionStore: { type: 'redis', url: this.config.get('REDIS_URL') },
 *     };
 *   }
 * }
 */
export interface ICacheOptionsFactory {
  createCacheOptions(): Promise<CacheConfig> | CacheConfig;
}

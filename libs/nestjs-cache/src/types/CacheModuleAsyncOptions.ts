import type { Type } from '@nestjs/common';
import type { ICacheOptionsFactory } from '../interface/ICacheOptionsFactory';
import type { CacheConfig, CacheExtra } from './CacheConfig';

/**
 * Options de configuration asynchrone du `CacheModule`.
 * Compatible avec `ConfigModule` de NestJS.
 *
 * @example
 * CacheModule.registerAsync({
 *   imports:    [ConfigModule],
 *   useFactory: (config: ConfigService) => ({
 *     store:        { type: 'redis', url: config.get('REDIS_URL'), namespace: 'app' },
 *     sessionStore: { type: 'redis', url: config.get('REDIS_URL') },
 *   }),
 *   inject: [ConfigService],
 * })
 */
export type CacheModuleAsyncOptions = {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<CacheConfig> | CacheConfig;
  inject?: any[];
  useClass?: Type<ICacheOptionsFactory>;
  useExisting?: Type<ICacheOptionsFactory>;
  /**
   * Stores supplémentaires — déclarés ici (pas dans la factory) car les tokens
   * doivent être connus au moment de la construction du `DynamicModule`.
   */
  extras?: CacheExtra[];
};

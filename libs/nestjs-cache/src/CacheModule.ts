import { type DynamicModule, Inject, Logger, Module, type OnModuleInit, Optional, type Provider } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CACHE_OPTIONS, CACHE_STORE, SESSION_STORE } from './constants';
import type { ICache } from './interface/ICache';
import type { ICacheOptionsFactory } from './interface/ICacheOptionsFactory';
import type { ISessionStore } from './interface/ISessionStore';
import { InMemoryCache } from './services/InMemoryCache';
import { RedisCache } from './services/RedisCache';
import { MemorySessionStore } from './session/MemorySessionStore';
import { RedisSessionStore } from './session/RedisSessionStore';
import type { CacheConfig, CacheStoreConfig, SessionStoreConfig } from './types/CacheConfig';
import type { CacheModuleAsyncOptions } from './types/CacheModuleAsyncOptions';

/**
 * Module NestJS fournissant le cache générique et le store de session.
 *
 * Enregistré comme **global** — importer une seule fois dans `AppModule`.
 * `CACHE_STORE` et `SESSION_STORE` sont ensuite disponibles dans toute l'application.
 *
 * Les implémentations concrètes sont créées **en interne** à partir des configurations
 * descriptives. L'application ne connaît que des interfaces, des tokens et des objets
 * de configuration — jamais de classes concrètes.
 *
 * @example
 * // Configuration statique avec store UMA pour nestjs-auth
 * import { UMA_CACHE } from 'nestjs-auth';
 *
 * CacheModule.register({
 *   store:        { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
 *   sessionStore: { type: 'redis', url: process.env.REDIS_URL },
 *   extras: [
 *     { provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } },
 *   ],
 * })
 *
 * @example
 * // Configuration asynchrone (compatible ConfigService)
 * CacheModule.registerAsync({
 *   imports:    [ConfigModule],
 *   useFactory: (config: ConfigService) => ({
 *     store:        { type: 'redis', url: config.get('REDIS_URL'), namespace: 'app' },
 *     sessionStore: { type: 'redis', url: config.get('REDIS_URL') },
 *   }),
 *   inject: [ConfigService],
 *   extras: [
 *     { provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } },
 *   ],
 * })
 */
@Module({})
export class CacheModule implements OnModuleInit {
  private readonly logger = new Logger(CacheModule.name);

  constructor(
    @Optional()
    @Inject(SESSION_STORE)
    private readonly sessionStore: ISessionStore | null,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.sessionStore) {
      await this.sessionStore.connect();
      this.logger.log('Session store connected.');
    }
  }

  static register(config: CacheConfig): DynamicModule {
    const cacheStore = CacheModule.buildCacheStore(config.store);
    const extraProviders = CacheModule.buildExtras(config.extras);
    const extraTokens = (config.extras ?? []).map((e) => e.provide);

    const providers: Provider[] = [
      { provide: CACHE_OPTIONS, useValue: config },
      { provide: CACHE_STORE, useValue: cacheStore },
      ...extraProviders,
    ];
    const exports: any[] = [CACHE_STORE, ...extraTokens];

    if (config.sessionStore) {
      providers.push({ provide: SESSION_STORE, useValue: CacheModule.buildSessionStore(config.sessionStore) });
      exports.push(SESSION_STORE);
    }

    return { global: true, module: CacheModule, providers, exports };
  }

  static registerAsync(opts: CacheModuleAsyncOptions): DynamicModule {
    const extraProviders = CacheModule.buildExtras(opts.extras);
    const extraTokens = (opts.extras ?? []).map((e) => e.provide);

    const providers: Provider[] = [
      CacheModule.createAsyncOptionProvider(opts),
      {
        provide: CACHE_STORE,
        useFactory: (config: CacheConfig) => CacheModule.buildCacheStore(config.store),
        inject: [CACHE_OPTIONS],
      },
      {
        provide: SESSION_STORE,
        useFactory: (config: CacheConfig) =>
          config.sessionStore ? CacheModule.buildSessionStore(config.sessionStore) : null,
        inject: [CACHE_OPTIONS],
      },
      ...extraProviders,
    ];

    if (opts.useClass) {
      providers.push({ provide: opts.useClass, useClass: opts.useClass });
    }

    return {
      global: true,
      module: CacheModule,
      imports: opts.imports || [],
      providers,
      exports: [CACHE_STORE, SESSION_STORE, ...extraTokens],
    };
  }

  private static buildCacheStore<T>(cfg: CacheStoreConfig): ICache<T> {
    if (cfg.type === 'memory') {
      return new InMemoryCache<T>();
    }
    // ioredis accepte une URL complète (redis://:password@host:port)
    return new RedisCache<T>(new Redis(cfg.url), cfg.namespace ?? 'cache');
  }

  private static buildSessionStore(cfg: SessionStoreConfig): ISessionStore {
    if (cfg.type === 'memory') {
      return new MemorySessionStore();
    }
    return new RedisSessionStore(cfg.url);
  }

  private static buildExtras(extras: CacheConfig['extras']): Provider[] {
    return (extras ?? []).map(({ provide, config }) => ({
      provide,
      useValue: CacheModule.buildCacheStore(config),
    }));
  }

  private static createAsyncOptionProvider(options: CacheModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: CACHE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: CACHE_OPTIONS,
      useFactory: async (factory: ICacheOptionsFactory) => factory.createCacheOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}

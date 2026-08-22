import { type DynamicModule, Logger, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  AUTH_CONNECT_OPTIONS,
  AUTH_GUARD,
  AUTH_INSTANCE,
  RESOURCE_GUARD,
  ROLE_GUARD,
  TokenValidation,
  UMA_CACHE,
} from './constants';
import { AuthGuard } from './guards/AuthGuard';
import { ResourceGuard } from './guards/ResourceGuard';
import { RoleGuard } from './guards/RoleGuard';
import type { IUmaCache } from './interface/IUmaCache';
import type { KeycloakOptionsFactory } from './interface/index';
import { KeycloakInstance } from './services/KeycloakInstance';
import type { KeycloakConfig, KeycloakModuleAsyncOptions } from './types/index';

// ── Cache UMA par défaut ──────────────────────────────────────────────────────
// Implémentation en mémoire, privée à ce module.
// Utilisée automatiquement quand aucun store n'est fourni via le token UMA_CACHE.
// Pour un déploiement multi-instances, enregistrer un store Redis dans CacheModule :
//   CacheModule.register({ extras: [{ provide: UMA_CACHE, config: { type: 'redis', ... } }] })
class InMemoryUmaCache implements IUmaCache {
  // La valeur stockée est directement { granted, expiresAt } — même shape que l'interface.
  private readonly store = new Map<string, { granted: boolean; expiresAt: number }>();

  async get(key: string): Promise<{ granted: boolean; expiresAt: number } | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key: string, value: { granted: boolean; expiresAt: number }, _ttlMs: number): Promise<void> {
    // value.expiresAt est déjà calculé par l'appelant (Date.now() + ttlMs).
    // _ttlMs est conservé pour la compatibilité de l'interface mais inutilisé ici.
    this.store.set(key, value);
    this.evict();
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

/**
 * Module NestJS pour l'authentification Keycloak.
 *
 * Enregistre `AuthGuard`, `RoleGuard` et `ResourceGuard` comme guards globaux via `APP_GUARD`.
 * Les guards sont exposés sous leurs tokens DI (`AUTH_GUARD`, `ROLE_GUARD`, `RESOURCE_GUARD`)
 * pour permettre leur remplacement par injection de dépendances (DIP).
 *
 * @example
 * // Configuration directe
 * KeycloakModule.register({
 *   authServerUrl: 'http://localhost:8080',
 *   realm:         'my-realm',
 *   clientId:      'my-api',
 *   secret:        'my-secret',
 * })
 *
 * @example
 * // Configuration asynchrone (compatible ConfigService)
 * KeycloakModule.registerAsync({
 *   imports:    [ConfigModule],
 *   useFactory: (config: ConfigService) => ({
 *     authServerUrl: config.get('KEYCLOAK_URL'),
 *     realm:         config.get('KEYCLOAK_REALM'),
 *     clientId:      config.get('KEYCLOAK_CLIENT_ID'),
 *     secret:        config.get('KEYCLOAK_SECRET'),
 *   }),
 *   inject: [ConfigService],
 * })
 */
@Module({})
export class KeycloakModule {
  static readonly logger = new Logger(KeycloakModule.name);

  /**
   * Configure le module avec une configuration statique.
   *
   * @param config - Configuration Keycloak complète.
   */
  public static register(config: KeycloakConfig): DynamicModule {
    const coreProviders = [{ provide: AUTH_CONNECT_OPTIONS, useValue: config }, KeycloakModule.keycloakProvider];
    return {
      module: KeycloakModule,
      providers: [...coreProviders, ...guardProviders],
      exports: [...coreProviders, AUTH_GUARD, ROLE_GUARD, RESOURCE_GUARD],
    };
  }

  /**
   * Configure le module de manière asynchrone, avec injection de dépendances.
   * Compatible avec `ConfigModule` de NestJS.
   *
   * @param opts - Options incluant `useFactory`, `useExisting` ou `useClass`.
   */
  public static registerAsync(opts: KeycloakModuleAsyncOptions): DynamicModule {
    const coreProviders = KeycloakModule.createAsyncProviders(opts);
    return {
      module: KeycloakModule,
      imports: opts.imports || [],
      providers: [...coreProviders, ...guardProviders],
      exports: [...coreProviders, AUTH_GUARD, ROLE_GUARD, RESOURCE_GUARD],
    };
  }

  /**
   * Provider instanciant `KeycloakInstance` à partir de la configuration injectée.
   *
   * Le store de cache UMA est injecté via le token `UMA_CACHE` (optionnel).
   * Si absent → `InMemoryUmaCache` (mémoire locale).
   * Si présent → n'importe quelle implémentation de `IUmaCache` fournie par le conteneur DI,
   *              typiquement un store Redis branché via `CacheModule.register({ extras: [...] })`.
   */
  private static readonly keycloakProvider: Provider = {
    provide: AUTH_INSTANCE,
    useFactory: (config: KeycloakConfig, umaCache?: IUmaCache): KeycloakInstance => {
      if (config.tokenValidation === TokenValidation.NONE) {
        KeycloakModule.logger.warn('Token validation is disabled — use only in development.');
      }

      // Fallback mémoire si aucun store Redis n'est branché via UMA_CACHE.
      const cache = umaCache ?? (config.umaCacheTtl !== 0 ? new InMemoryUmaCache() : undefined);

      return new KeycloakInstance(config.authServerUrl, config.realm, config.clientId, config.umaCacheTtl, cache);
    },
    inject: [AUTH_CONNECT_OPTIONS, { token: UMA_CACHE, optional: true }],
  };

  private static createAsyncProviders(options: KeycloakModuleAsyncOptions): Provider[] {
    const base = [KeycloakModule.createAsyncOptionProvider(options), KeycloakModule.keycloakProvider];
    if (options.useExisting || options.useFactory) return base;
    return [...base, { provide: options.useClass, useClass: options.useClass }];
  }

  private static createAsyncOptionProvider(options: KeycloakModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return { provide: AUTH_CONNECT_OPTIONS, useFactory: options.useFactory, inject: options.inject || [] };
    }
    return {
      provide: AUTH_CONNECT_OPTIONS,
      useFactory: async (factory: KeycloakOptionsFactory) => factory.createKeycloakOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}

const guardProviders = [
  { provide: AUTH_GUARD, useClass: AuthGuard },
  { provide: ROLE_GUARD, useClass: RoleGuard },
  { provide: RESOURCE_GUARD, useClass: ResourceGuard },
  { provide: APP_GUARD, useExisting: AUTH_GUARD },
  { provide: APP_GUARD, useExisting: ROLE_GUARD },
  { provide: APP_GUARD, useExisting: RESOURCE_GUARD },
];

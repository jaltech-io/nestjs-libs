import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  AUTH_CONNECT_OPTIONS,
  AUTH_GUARD,
  AUTH_INSTANCE,
  PRINCIPAL_RESOLVER,
  RESOURCE_GUARD,
  ROLE_GUARD,
  TOKEN_SOURCE,
} from '../constants';
import { AuthGuard } from '../guards/AuthGuard';
import { ResourceGuard } from '../guards/ResourceGuard';
import { RoleGuard } from '../guards/RoleGuard';
import type { IAuthInstance } from '../interface/IAuthInstance';
import { defaultTokenSource } from '../token-source/TokenSource';
import type { AuthConfig } from '../types/AuthConfig';
import type {
  AuthAsyncFactoryResult,
  AuthModuleAsyncOptions,
  AuthModuleOptions,
} from '../types/AuthModuleOptions';
import { validateAuthConfig } from './validateAuthConfig';

/** Extrait la partie `AuthConfig` (lue par les guards) des options de module. */
const toAuthConfig = (o: Omit<AuthModuleOptions, 'provider' | 'tokenSource' | 'principalResolver'>): AuthConfig => ({
  cookieKey: o.cookieKey,
  policyEnforcement: o.policyEnforcement,
  tokenValidation: o.tokenValidation,
  roleMerge: o.roleMerge,
  verbScopeDefaults: o.verbScopeDefaults,
  enforcementShadow: o.enforcementShadow,
  principalCacheTtlMs: o.principalCacheTtlMs,
});

const guardBindings: Provider[] = [
  { provide: AUTH_GUARD, useClass: AuthGuard },
  { provide: ROLE_GUARD, useClass: RoleGuard },
  { provide: RESOURCE_GUARD, useClass: ResourceGuard },
];

const globalGuardBindings: Provider[] = [
  { provide: APP_GUARD, useExisting: AUTH_GUARD },
  { provide: APP_GUARD, useExisting: ROLE_GUARD },
  { provide: APP_GUARD, useExisting: RESOURCE_GUARD },
];

/**
 * Module d'authentification/autorisation provider-agnostic.
 *
 * Les guards ne dépendent que des contrats (`IAuthInstance`, `ITokenSource`,
 * `IPrincipalResolver`). Le provider concret est injecté via une fabrique
 * (`KeycloakProvider.create`, `EntraProvider.create`).
 *
 * @example
 * AuthModule.register({
 *   provider: KeycloakProvider.create({ authServerUrl, realm, clientId, secret }),
 *   tokenValidation: TokenValidation.OFFLINE,
 * })
 */
@Module({})
export class AuthModule {
  /** Configure le module avec des options statiques. Valide la config au boot. */
  static register(options: AuthModuleOptions): DynamicModule {
    const instance = options.provider.instance;
    const config = toAuthConfig(options);

    // Validation au boot (fail-fast).
    validateAuthConfig(config, instance);

    const providers: Provider[] = [
      { provide: AUTH_CONNECT_OPTIONS, useValue: config },
      { provide: AUTH_INSTANCE, useValue: instance },
      { provide: TOKEN_SOURCE, useValue: options.tokenSource ?? defaultTokenSource(config.cookieKey) },
      ...(options.principalResolver ? [{ provide: PRINCIPAL_RESOLVER, useValue: options.principalResolver }] : []),
      ...guardBindings,
      ...(options.globalGuards === false ? [] : globalGuardBindings),
    ];

    return {
      module: AuthModule,
      providers,
      exports: [AUTH_CONNECT_OPTIONS, AUTH_INSTANCE, TOKEN_SOURCE, AUTH_GUARD, ROLE_GUARD, RESOURCE_GUARD],
    };
  }

  /** Configure le module de manière asynchrone (injection de dépendances). */
  static registerAsync(options: AuthModuleAsyncOptions): DynamicModule {
    const RESOLVED = Symbol('AUTH_RESOLVED_OPTIONS');

    const resolvedProvider: Provider = {
      provide: RESOLVED,
      useFactory: async (...args: any[]): Promise<AuthAsyncFactoryResult> => {
        const result = await options.useFactory(...args);
        validateAuthConfig(toAuthConfig(result), result.provider.instance);
        return result;
      },
      inject: options.inject ?? [],
    };

    const factoryProviders: Provider[] = [
      resolvedProvider,
      { provide: AUTH_CONNECT_OPTIONS, useFactory: (r: AuthAsyncFactoryResult) => toAuthConfig(r), inject: [RESOLVED] },
      { provide: AUTH_INSTANCE, useFactory: (r: AuthAsyncFactoryResult): IAuthInstance => r.provider.instance, inject: [RESOLVED] },
      {
        provide: TOKEN_SOURCE,
        useFactory: (r: AuthAsyncFactoryResult) => r.tokenSource ?? defaultTokenSource(r.cookieKey),
        inject: [RESOLVED],
      },
      {
        provide: PRINCIPAL_RESOLVER,
        useFactory: (r: AuthAsyncFactoryResult) => r.principalResolver ?? null,
        inject: [RESOLVED],
      },
    ];

    return {
      module: AuthModule,
      imports: options.imports ?? [],
      providers: [
        ...factoryProviders,
        ...guardBindings,
        ...(options.globalGuards === false ? [] : globalGuardBindings),
      ],
      exports: [AUTH_CONNECT_OPTIONS, AUTH_INSTANCE, TOKEN_SOURCE, AUTH_GUARD, ROLE_GUARD, RESOURCE_GUARD],
    };
  }
}

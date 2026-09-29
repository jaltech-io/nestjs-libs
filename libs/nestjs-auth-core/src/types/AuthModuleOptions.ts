import type { ModuleMetadata } from '@nestjs/common';
import type { PolicyEnforcementMode, RoleMerge, TokenValidation } from '../constants';
import type { IPrincipalResolver } from '../interface/IPrincipalResolver';
import type { ITokenSource } from '../interface/ITokenSource';
import type { AuthProvider } from './AuthProvider';

/**
 * Options synchrones de `AuthModule.register()`.
 */
export type AuthModuleOptions = {
  /** Provider fournissant l'`IAuthInstance` (via `KeycloakProvider.create` / `EntraProvider.create`). */
  provider: AuthProvider;
  /** Source du token. Défaut : `TokenSource.chain(TokenSource.header(), TokenSource.cookie('KEYCLOAK_JWT'))`. */
  tokenSource?: ITokenSource;
  /** Résolveur de principal applicatif (optionnel). */
  principalResolver?: IPrincipalResolver;
  /** TTL du cache des principals (ms). Défaut : `60000`. `0` = désactivé. */
  principalCacheTtlMs?: number;
  /** Méthode de validation du JWT. Défaut : `OFFLINE`. `ONLINE` exige un provider compatible (sinon erreur au boot). */
  tokenValidation?: TokenValidation;
  /** Stratégie de fusion des `@Roles()` classe/méthode. Défaut : `OVERRIDE`. */
  roleMerge?: RoleMerge;
  /** Comportement du `ResourceGuard` sans `@Resource`. Défaut : `PERMISSIVE`. */
  policyEnforcement?: PolicyEnforcementMode;
  /** Nom du cookie portant le JWT (source par défaut). Défaut : `KEYCLOAK_JWT`. */
  cookieKey?: string;
  /** Dérive le scope UMA du verbe HTTP quand `@Resource` est présent sans `@Scopes`. Défaut : `false`. */
  verbScopeDefaults?: boolean;
  /** Mode observation UMA (log sans blocage). Défaut : `false`. */
  enforcementShadow?: boolean;
  /**
   * Enregistre les guards comme guards globaux (`APP_GUARD`). Défaut : `true`.
   * `false` : les guards sont fournis sous leurs tokens mais appliqués par le consommateur via `@UseGuards`.
   */
  globalGuards?: boolean;
};

/**
 * Options asynchrones de `AuthModule.registerAsync()`.
 * Le `useFactory` retourne les mêmes options que `register`, moins `globalGuards`
 * (fourni séparément pour rester déterminé au boot).
 */
export type AuthModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  /** Dépendances injectées dans `useFactory`. */
  inject?: any[];
  /** Fabrique retournant les options runtime (provider, tokenSource, résolveur, config). */
  useFactory: (...args: any[]) => Promise<AuthAsyncFactoryResult> | AuthAsyncFactoryResult;
  /** Enregistre les guards globaux. Défaut : `true`. */
  globalGuards?: boolean;
};

/** Résultat de la fabrique asynchrone (options runtime, hors `globalGuards`). */
export type AuthAsyncFactoryResult = Omit<AuthModuleOptions, 'globalGuards'>;

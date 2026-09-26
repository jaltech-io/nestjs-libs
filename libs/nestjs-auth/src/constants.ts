/** Token DI de l'instance du provider d'authentification (ex: `KeycloakInstance`). */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

/**
 * Token DI du store de cache des décisions UMA.
 *
 * `KeycloakModule` l'injecte en `@Optional()` :
 * - Non fourni → `InMemoryUmaCache` (mémoire locale, instance unique).
 * - Fourni     → n'importe quelle implémentation de `IUmaCache`.
 *
 * Cas d'usage multi-instances : brancher un store Redis via `CacheModule.register(extras)`.
 *
 * @example
 * // app.module.ts — aucune classe concrète importée
 * import { UMA_CACHE } from '@jaltech/nestjs-auth';
 *
 * CacheModule.register({
 *   store: { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
 *   extras: [{ provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } }],
 * })
 */
export const UMA_CACHE = Symbol('UMA_CACHE');

/** Token DI de la configuration passée au module (ex: `KeycloakConfig`). */
export const AUTH_CONNECT_OPTIONS = Symbol('AUTH_CONNECT_OPTIONS');

/**
 * Nom du cookie HTTP-only portant le JWT.
 * Valeur par défaut utilisée si `cookieKey` n'est pas renseigné dans la configuration.
 */
export const AUTH_COOKIE_DEFAULT = 'KEYCLOAK_JWT';

/**
 * Token DI du guard d'authentification.
 * Remplacer l'implémentation : `{ provide: AUTH_GUARD, useClass: MonGuard }`.
 */
export const AUTH_GUARD = Symbol('AUTH_GUARD');

/**
 * Token DI du guard de vérification des rôles.
 * Remplacer l'implémentation : `{ provide: ROLE_GUARD, useClass: MonGuard }`.
 */
export const ROLE_GUARD = Symbol('ROLE_GUARD');

/**
 * Token DI du guard de vérification des ressources UMA.
 * Remplacer l'implémentation : `{ provide: RESOURCE_GUARD, useClass: MonGuard }`.
 */
export const RESOURCE_GUARD = Symbol('RESOURCE_GUARD');

/**
 * Détermine si tous les rôles ou au moins un sont requis lors de la vérification via `@Roles()`.
 * @see RoleGuard
 */
export enum RoleMatch {
  /** Tous les rôles déclarés doivent être présents dans le token. */
  ALL = 'all',
  /** Au moins un des rôles déclarés doit être présent dans le token. */
  ANY = 'any',
}

/**
 * Comportement du `ResourceGuard` lorsqu'un contrôleur n'a pas de `@Resource`.
 */
export enum PolicyEnforcementMode {
  /** La requête est refusée si aucun `@Resource` n'est déclaré. */
  ENFORCING = 'enforcing',
  /** La requête est autorisée si aucun `@Resource` n'est déclaré. */
  PERMISSIVE = 'permissive',
}

/**
 * Méthode utilisée par l'`AuthGuard` pour valider le JWT entrant.
 */
export enum TokenValidation {
  /** Appelle `/userinfo` à chaque requête. Détecte une révocation immédiate. */
  ONLINE = 'online',
  /** Vérifie la signature JWT localement via JWKS. Rapide, sans appel réseau. */
  OFFLINE = 'offline',
  /** Désactive toute validation. À n'utiliser qu'en développement local. */
  NONE = 'none',
}

/**
 * Stratégie appliquée quand `@Roles()` est présent à la fois sur la classe et sur la méthode.
 */
export enum RoleMerge {
  /** Les rôles de la méthode remplacent ceux de la classe. */
  OVERRIDE,
  /** Les rôles de la méthode s'ajoutent à ceux de la classe. */
  ALL,
}

// ── nestjs-auth-core — Tokens DI et énumérations ─────────────────────────────
// Contrats de valeurs partagés par les guards, le module et les providers.

/** Token DI de l'instance du provider d'authentification (`IAuthInstance`). */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

/** Token DI de la configuration d'authentification effective (`AuthConfig`). */
export const AUTH_CONNECT_OPTIONS = Symbol('AUTH_CONNECT_OPTIONS');

/** Token DI de la source du token (`ITokenSource`). Toujours fourni (défaut = header + cookie). */
export const TOKEN_SOURCE = Symbol('TOKEN_SOURCE');

/**
 * Token DI du résolveur de principal (`IPrincipalResolver`).
 * Optionnel : fourni uniquement si l'application branche un résolveur.
 */
export const PRINCIPAL_RESOLVER = Symbol('PRINCIPAL_RESOLVER');

/**
 * Token DI du store de cache des principals résolus (`IPrincipalCache`).
 *
 * Injecté en `@Optional()` par l'`AuthGuard` :
 * - Non fourni → cache mémoire local (`InMemoryPrincipalCache`).
 * - Fourni     → n'importe quelle implémentation (ex. store Redis) — même mécanisme que `UMA_CACHE`.
 */
export const PRINCIPAL_CACHE = Symbol('PRINCIPAL_CACHE');

/**
 * Token DI du store de cache des décisions UMA (`IUmaCache`).
 * Conservé pour compatibilité et pour les providers UMA (Keycloak).
 */
export const UMA_CACHE = Symbol('UMA_CACHE');

/**
 * Token DI du store de révocation (`IRevocationStore`).
 *
 * Fourni par `BackChannelLogoutModule` (module global). Injecté en `@Optional()`
 * par l'`AuthGuard` : si absent, aucune vérification de révocation n'est appliquée.
 */
export const REVOCATION_STORE = Symbol('REVOCATION_STORE');

/**
 * Token DI du validateur de Back-Channel Logout (`IBackChannelLogoutValidator`).
 * Fourni par le provider (Keycloak) lorsque la capacité est supportée.
 */
export const BACKCHANNEL_LOGOUT_VALIDATOR = Symbol('BACKCHANNEL_LOGOUT_VALIDATOR');

/** Token DI des options internes du `BackChannelLogoutModule`. */
export const BACKCHANNEL_LOGOUT_OPTIONS = Symbol('BACKCHANNEL_LOGOUT_OPTIONS');

/** Événement OIDC de Back-Channel Logout (valeur du claim `events`). */
export const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

/**
 * Nom du cookie HTTP-only portant le JWT par défaut.
 * Reproduit le comportement historique de `@jaltech/nestjs-auth`.
 */
export const AUTH_COOKIE_DEFAULT = 'KEYCLOAK_JWT';

/** Token DI du guard d'authentification. Remplaçable : `{ provide: AUTH_GUARD, useClass: MonGuard }`. */
export const AUTH_GUARD = Symbol('AUTH_GUARD');

/** Token DI du guard de vérification des rôles. */
export const ROLE_GUARD = Symbol('ROLE_GUARD');

/** Token DI du guard d'autorisation fine (UMA). */
export const RESOURCE_GUARD = Symbol('RESOURCE_GUARD');

/**
 * Détermine si tous les rôles (`ALL`) ou au moins un (`ANY`) sont requis via `@Roles()`.
 */
export enum RoleMatch {
  /** Tous les rôles déclarés doivent être présents. */
  ALL = 'all',
  /** Au moins un des rôles déclarés doit être présent. */
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
  /** Interroge le endpoint `/userinfo` du provider (révocation immédiate, appel réseau). */
  ONLINE = 'online',
  /** Vérifie la signature JWT localement via JWKS (rapide, hors ligne). */
  OFFLINE = 'offline',
  /** Désactive toute validation. À n'utiliser qu'en développement local. */
  NONE = 'none',
}

/**
 * Stratégie appliquée quand `@Roles()` est présent à la fois sur la classe et la méthode.
 */
export enum RoleMerge {
  /** Les rôles de la méthode remplacent ceux de la classe. */
  OVERRIDE = 0,
  /** Les rôles de la méthode s'ajoutent à ceux de la classe. */
  ALL = 1,
}

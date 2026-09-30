import type { PolicyEnforcementMode, RoleMerge, TokenValidation } from '../constants';

/**
 * Configuration d'authentification effective, injectée sous `AUTH_CONNECT_OPTIONS`
 * et lue par les guards. Construite par `AuthModule` à partir des options de `register`.
 */
export type AuthConfig = {
  /** Nom du cookie HTTP-only portant le JWT (source par défaut). Défaut : `KEYCLOAK_JWT`. */
  cookieKey?: string;
  /** Comportement du `ResourceGuard` quand aucun `@Resource` n'est déclaré. Défaut : `PERMISSIVE`. */
  policyEnforcement?: PolicyEnforcementMode;
  /** Méthode de validation du JWT par l'`AuthGuard`. Défaut : `OFFLINE`. */
  tokenValidation?: TokenValidation;
  /** Stratégie de fusion quand `@Roles()` est déclaré sur la classe et la méthode. Défaut : `OVERRIDE`. */
  roleMerge?: RoleMerge;
  /**
   * Dérive le scope UMA du verbe HTTP quand `@Resource` est présent sans `@Scopes` :
   * GET/HEAD → READ, POST → CREATE, PUT/PATCH → UPDATE, DELETE → DELETE. Défaut : `false`.
   */
  verbScopeDefaults?: boolean;
  /**
   * Mode observation du `ResourceGuard` : les refus UMA sont journalisés mais la
   * requête est AUTORISÉE. Défaut : `false` (blocage réel).
   */
  enforcementShadow?: boolean;
  /**
   * Durée de vie du cache des principals résolus (ms). Défaut : `60000`. `0` = cache désactivé.
   */
  principalCacheTtlMs?: number;
};

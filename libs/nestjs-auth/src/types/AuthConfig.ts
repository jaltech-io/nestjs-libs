import type { PolicyEnforcementMode, RoleMerge, TokenValidation } from '../constants';

/**
 * Configuration commune à tous les providers d'authentification.
 *
 * Ce type est étendu par les configurations spécifiques (ex: `KeycloakConfig`).
 * Il est injecté sous le token `AUTH_CONNECT_OPTIONS` et lu par les guards.
 */
export type AuthConfig = {
  /** Nom du cookie HTTP-only portant le JWT. Défaut : `AUTH_COOKIE_DEFAULT` (`'KEYCLOAK_JWT'`). */
  cookieKey?: string;
  /** Comportement du `ResourceGuard` quand aucun `@Resource` n'est déclaré. Défaut : `PERMISSIVE`. */
  policyEnforcement?: PolicyEnforcementMode;
  /** Méthode de validation du JWT par l'`AuthGuard`. Défaut : `ONLINE`. */
  tokenValidation?: TokenValidation;
  /** Stratégie de fusion quand `@Roles()` est déclaré sur la classe et la méthode. Défaut : `OVERRIDE`. */
  roleMerge?: RoleMerge;
};

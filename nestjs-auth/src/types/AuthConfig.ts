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
  /**
   * Quand un `@Resource()` est déclaré mais qu'aucun `@Scopes()` explicite n'existe
   * sur le handler, dérive le scope du verbe HTTP : GET/HEAD → READ, POST → CREATE,
   * PUT/PATCH → UPDATE, DELETE → DELETE. Permet de protéger un contrôleur CQRS
   * entier avec un seul décorateur de classe. Défaut : `false`.
   */
  verbScopeDefaults?: boolean;
  /**
   * Mode observation du `ResourceGuard` : les refus UMA sont journalisés
   * (`AUTHZ-SHADOW denied ...`) mais la requête est AUTORISÉE. Pour valider une
   * matrice de permissions en conditions réelles avant d'activer le blocage.
   * Défaut : `false` (blocage réel).
   */
  enforcementShadow?: boolean;
};

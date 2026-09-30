/**
 * Contrat d'un token JWT décodé.
 *
 * Abstrait la lecture des claims pour permettre un comportement identique
 * quel que soit le provider (Keycloak, Auth0, etc.).
 * Implémentation par défaut : `KeycloakToken`.
 */
export interface IToken {
  /** JWT brut sous forme de chaîne signée. */
  readonly token: string;

  /** Payload JSON décodé du JWT. */
  readonly content: Record<string, any>;

  /**
   * Vérifie si le token possède le rôle donné.
   *
   * Formats acceptés :
   * - `'admin'` — rôle realm
   * - `'realm:admin'` — rôle realm (explicite)
   * - `'my-client:admin'` — rôle d'un client spécifique
   */
  hasRole(role: string): boolean;

  /**
   * Vérifie si le token possède le rôle realm donné.
   * Lit `realm_access.roles` dans le payload.
   */
  hasRealmRole(role: string): boolean;

  /**
   * Vérifie si le token possède le rôle donné pour un client spécifique.
   * Lit `resource_access[appName].roles` dans le payload.
   *
   * @param appName - Identifiant du client (ex: `'my-api'`).
   * @param role    - Nom du rôle à vérifier.
   */
  hasApplicationRole(appName: string, role: string): boolean;

  /** Retourne `true` si le champ `exp` du payload est dépassé. */
  isExpired(): boolean;
}

/**
 * Contrat d'un token JWT décodé, indépendant du provider.
 *
 * Abstrait la lecture des claims pour un comportement identique quel que soit
 * le provider (Keycloak, Entra, etc.).
 */
export interface IToken {
  /** JWT brut signé. Ne jamais journaliser. */
  readonly token: string;

  /** Payload JSON décodé du JWT. */
  readonly content: Record<string, any>;

  /**
   * Vérifie si le token possède le rôle donné.
   *
   * La sémantique des formats (`realm:x`, `client:x`, etc.) est propre au provider.
   */
  hasRole(role: string): boolean;

  /** Vérifie si le token possède le rôle « realm »/tenant donné. */
  hasRealmRole(role: string): boolean;

  /**
   * Vérifie si le token possède le rôle donné pour une application/client donné.
   *
   * @param appName - Identifiant du client/application.
   * @param role    - Nom du rôle.
   */
  hasApplicationRole(appName: string, role: string): boolean;

  /** Retourne `true` si le champ `exp` du payload est dépassé. */
  isExpired(): boolean;
}

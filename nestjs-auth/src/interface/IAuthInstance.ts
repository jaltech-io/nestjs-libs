import type { IToken } from './IToken';

/**
 * Contrat du provider d'authentification.
 *
 * Abstrait toutes les interactions avec le serveur d'identité pour rendre les guards
 * indépendants du provider. Implémenter cette interface suffit pour brancher Auth0,
 * Okta, ou tout autre provider compatible JWT sans modifier les guards ni les décorateurs.
 * Implémentation par défaut : `KeycloakInstance`.
 */
export interface IAuthInstance {
  /**
   * Middleware Express déclenché quand l'accès à une ressource est refusé.
   * Positionne `req.resourceDenied = true` et passe au middleware suivant.
   */
  accessDenied: (req: any, res: any, next: any) => void;

  /**
   * Crée un grant à partir d'un access token brut.
   *
   * @param tokenObj - Objet portant le JWT brut.
   * @returns Un objet `{ access_token }` contenant le token décodé.
   * @throws Si le JWT est malformé ou ne peut pas être parsé.
   */
  createGrant(tokenObj: { access_token: string }): Promise<{ access_token: IToken }>;

  /**
   * Valide le token en ligne en interrogeant le endpoint `/userinfo` du provider.
   * Détecte la révocation immédiate au prix d'un appel réseau par requête.
   *
   * @returns Le token s'il est valide, `false` sinon.
   */
  validateAccessToken(token: IToken): Promise<IToken | false>;

  /**
   * Valide le token hors ligne en vérifiant la signature JWT via JWKS.
   * Rapide, sans appel réseau, mais ne détecte pas une révocation immédiate.
   *
   * @param type - Type de token (ex: `'Bearer'`).
   * @returns Le token s'il est valide, `false` sinon.
   */
  validateToken(token: IToken, type: string): Promise<IToken | false>;

  /**
   * Retourne un middleware Express qui évalue les permissions fines (UMA / scopes).
   * Positionne `req.resourceDenied = true` si les permissions sont refusées.
   *
   * @param permissions - Liste des permissions à évaluer (format `'resource#scope'`).
   * @param options     - Options spécifiques au provider (claims, mode de réponse…).
   */
  enforcer(permissions: string[], options?: Record<string, any>): (req: any, res: any, next: any) => Promise<void>;
}

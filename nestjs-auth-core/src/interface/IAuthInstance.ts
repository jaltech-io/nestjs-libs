import type { AuthIdentity } from '../types/AuthIdentity';
import type { IToken } from './IToken';

/**
 * Capacités déclarées d'un provider d'authentification.
 *
 * Lues au BOOT et par les guards pour appliquer une validation fail-closed :
 * - `online` : le provider supporte la validation `ONLINE` (`/userinfo`).
 * - `uma`    : le provider supporte l'autorisation fine `@Resource`/`@Scopes`.
 */
export type AuthCapabilities = {
  readonly online: boolean;
  readonly uma: boolean;
  /** Le provider supporte le Back-Channel Logout OIDC 1.0. */
  readonly backChannelLogout: boolean;
};

/**
 * Contexte optionnel passé à la validation, permettant aux providers multi-tenants
 * de résoudre la configuration (ex. via l'`iss` non vérifié comme clé d'allowlist,
 * avec accès à la requête pour un résolveur applicatif). Jamais utilisé comme
 * cible réseau directe.
 */
export type AuthValidationContext = {
  /** Requête HTTP courante (pour un résolveur applicatif). */
  request?: any;
};

/**
 * Contrat du provider d'authentification.
 *
 * Abstrait toutes les interactions avec le serveur d'identité pour rendre les
 * guards indépendants du provider. Implémenter cette interface suffit pour
 * brancher n'importe quel provider compatible JWT sans modifier les guards.
 */
export interface IAuthInstance {
  /** Capacités du provider (validation en ligne, UMA). Lues au boot (fail-closed). */
  readonly capabilities: AuthCapabilities;

  /**
   * Middleware Express déclenché quand l'accès à une ressource est refusé.
   * Positionne `req.resourceDenied = true` et passe au middleware suivant.
   */
  accessDenied: (req: any, res: any, next: any) => void;

  /**
   * Crée un grant (token factory) à partir d'un access token brut.
   *
   * @throws Si le JWT est malformé.
   */
  createGrant(tokenObj: { access_token: string }): Promise<{ access_token: IToken }>;

  /**
   * Valide le token en ligne (endpoint `/userinfo`). Détecte la révocation immédiate.
   * @param context - Contexte optionnel (requête) pour la résolution multi-tenant.
   * @returns Le token s'il est valide, `false` sinon.
   */
  validateAccessToken(token: IToken, context?: AuthValidationContext): Promise<IToken | false>;

  /**
   * Valide le token hors ligne (signature JWT via JWKS).
   * @param context - Contexte optionnel (requête) pour la résolution multi-tenant.
   * @returns Le token s'il est valide, `false` sinon.
   */
  validateToken(token: IToken, type: string, context?: AuthValidationContext): Promise<IToken | false>;

  /**
   * Construit l'identité normalisée à partir d'un token validé.
   * Sert d'entrée au `IPrincipalResolver`.
   */
  toIdentity(token: IToken): AuthIdentity;

  /**
   * Retourne un middleware Express évaluant les permissions fines (UMA / scopes).
   * Positionne `req.resourceDenied = true` si les permissions sont refusées.
   *
   * @param permissions - Permissions à évaluer (format `'resource:scope'`).
   * @param options     - Options spécifiques au provider.
   */
  enforcer(permissions: string[], options?: Record<string, any>): (req: any, res: any, next: any) => Promise<void>;
}

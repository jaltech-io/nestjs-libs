/**
 * Résultat de la validation d'un `logout_token` OIDC Back-Channel Logout 1.0.
 * Aucune donnée sensible : uniquement les identifiants nécessaires à la révocation.
 */
export type LogoutEvent = {
  /** Provider émetteur (ex. `'keycloak'`). */
  provider: string;
  /** Émetteur vérifié du logout_token. */
  issuer: string;
  /** Identifiant de session à révoquer, si présent. */
  sid?: string;
  /** Sujet à révoquer, si présent. */
  subject?: string;
  /** Identifiant unique du logout_token (anti-rejeu). */
  jti: string;
};

/**
 * Contrat de validation d'un `logout_token` de Back-Channel Logout OIDC.
 *
 * Implémenté par le provider (signature via son JWKS). L'anti-rejeu (`jti`) et la
 * mise à jour du store de révocation sont gérés par le `BackChannelLogoutService`
 * du core, indépendamment du provider.
 */
export interface IBackChannelLogoutValidator {
  /**
   * Valide un `logout_token` selon OIDC Back-Channel Logout 1.0 :
   * signature JWKS, `iss`/`aud`, `iat`, `jti`, `events` contenant l'événement
   * de logout, `sid` et/ou `sub` présent, absence de `nonce`.
   *
   * @throws Error si le token est invalide (→ 400 côté endpoint).
   */
  validateLogoutToken(logoutToken: string): Promise<LogoutEvent>;
}

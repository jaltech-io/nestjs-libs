/**
 * Configuration de validation d'un realm Keycloak, issue d'une allowlist explicite
 * (mode STATIC) ou d'un résolveur applicatif (mode DYNAMIC).
 *
 * L'`issuer` est la clé d'allowlist : l'`iss` NON vérifié d'un token ne sert qu'à
 * sélectionner l'une de ces configurations pré-enregistrées. Jamais à construire
 * une cible réseau (JWKS) directement.
 */
export type KeycloakRealmConfig = {
  /** Nom du realm. */
  realm: string;
  /** Client ID (audience). */
  clientId: string;
  /** Émetteur attendu (clé d'allowlist), ex. `https://kc.example.com/realms/acme`. */
  issuer: string;
  /** URI JWKS. Défaut : `${issuer}/protocol/openid-connect/certs` (dérivé de l'issuer de confiance). */
  jwksUri?: string;
  /** Vérifie l'audience (`aud`/`azp`). Défaut : hérité des options du provider. */
  verifyTokenAudience?: boolean;
  /** Rejette les tokens sans organisation. Défaut : hérité des options du provider. */
  requireOrganization?: boolean;
};

/**
 * Résolveur applicatif de realm (mode DYNAMIC, passage à l'échelle).
 *
 * Reçoit l'`iss` NON vérifié comme clé de recherche dans l'allowlist applicative
 * (ex. table en base). Retourne la configuration du realm ou `null` (⇒ 401).
 * Ne JAMAIS dériver une cible réseau du token si le résolveur n'a pas retourné de config.
 */
export type KeycloakRealmResolver = (
  issuer: string,
  request?: any,
) => Promise<KeycloakRealmConfig | null> | KeycloakRealmConfig | null;

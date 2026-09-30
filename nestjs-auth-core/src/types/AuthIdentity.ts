/**
 * Identité normalisée extraite d'un token validé, indépendante du provider.
 *
 * Produite par `IAuthInstance.toIdentity(token)`. Sert d'entrée au
 * `IPrincipalResolver` pour charger un principal applicatif.
 */
export type AuthIdentity = {
  /** Identifiant du provider ayant émis le token (ex. `'keycloak'`, `'entra'`). */
  provider: string;
  /** Identifiant stable du sujet (Keycloak: `sub`, Entra: `oid`). */
  subject: string;
  /** Identifiant du tenant/realm si le provider en fournit un (Entra: `tid`). */
  tenantId?: string;
  /** Adresse e-mail normalisée (minuscules) si disponible. */
  email?: string;
  /** Nom d'affichage si disponible. */
  displayName?: string;
  /** Type de compte : membre du tenant ou invité externe. */
  accountType?: 'member' | 'guest';
  /**
   * Organisations/tenants portés par le token (ex. Keycloak Organizations 26+).
   * Normalisé en liste d'identifiants, quelle que soit la forme du claim source
   * (tableau de chaînes ou objet indexé par alias). `undefined` si non applicable.
   */
  organizations?: string[];
  /** Claims bruts du token décodé (jamais un secret : ne pas journaliser). */
  claims: Record<string, unknown>;
};

/**
 * Configuration du provider Microsoft Entra ID (ex-Azure AD), passée à
 * `EntraProvider.create()`. Provider OFFLINE uniquement (validation locale JWKS).
 */
export type EntraConfig = {
  /** Tenant Entra (GUID ou domaine). Requis. */
  tenantId: string;
  /** Client ID (App registration) exposant l'API. Requis. */
  clientId: string;
  /** Audiences acceptées. Défaut : `[clientId, 'api://' + clientId]`. */
  audiences?: string[];
  /**
   * Émetteurs acceptés. Défaut : v2 `https://login.microsoftonline.com/{tenantId}/v2.0`
   * ET v1 `https://sts.windows.net/{tenantId}/`.
   */
  issuers?: string[];
  /** URI JWKS. Défaut : `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`. */
  jwksUri?: string;
  /** Scopes (`scp`) tous requis. Défaut : `[]`. */
  requiredScopes?: string[];
  /** N'accepter que les membres du tenant (`acct === 0`). Défaut : `false`. */
  membersOnly?: boolean;
  /** Accepter les tokens applicatifs (`idtyp === 'app'`). Défaut : `false`. */
  allowAppTokens?: boolean;
  /** Claim portant les rôles applicatifs. Défaut : `'roles'`. */
  roleClaim?: string;
  /** Tolérance d'horloge (secondes) pour `exp`/`nbf`. Défaut : `60`. */
  clockToleranceSec?: number;
  /** Intervalle minimum entre deux requêtes JWKS (secondes). Wire le cooldown JWKS. Défaut : `30`. */
  minTimeBetweenJwksRequests?: number;
};

/** Configuration Entra avec toutes les valeurs par défaut résolues. */
export type ResolvedEntraConfig = {
  tenantId: string;
  clientId: string;
  audiences: string[];
  issuers: string[];
  jwksUri: string;
  requiredScopes: string[];
  membersOnly: boolean;
  allowAppTokens: boolean;
  roleClaim: string;
  clockToleranceSec: number;
  minTimeBetweenJwksRequests?: number;
};

/**
 * Résout la configuration Entra avec les défauts EXACTS de la spécification.
 * @throws Error si `tenantId` ou `clientId` manquent.
 */
export function resolveEntraConfig(config: EntraConfig): ResolvedEntraConfig {
  const missing = (['tenantId', 'clientId'] as const).filter((k) => !config[k]);
  if (missing.length > 0) {
    throw new Error(`EntraProvider.create: missing required option(s): ${missing.join(', ')}`);
  }
  const { tenantId, clientId } = config;
  return {
    tenantId,
    clientId,
    audiences: config.audiences ?? [clientId, `api://${clientId}`],
    issuers: config.issuers ?? [
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
      `https://sts.windows.net/${tenantId}/`,
    ],
    jwksUri: config.jwksUri ?? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    requiredScopes: config.requiredScopes ?? [],
    membersOnly: config.membersOnly ?? false,
    allowAppTokens: config.allowAppTokens ?? false,
    roleClaim: config.roleClaim ?? 'roles',
    clockToleranceSec: config.clockToleranceSec ?? 60,
    minTimeBetweenJwksRequests: config.minTimeBetweenJwksRequests,
  };
}

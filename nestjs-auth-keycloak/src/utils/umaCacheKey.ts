// Format INTERNE des clés du cache des décisions UMA. Ne pas exporter hors du package :
// les applications invalident via `KeycloakInstance.forgetUser` / `forgetResource`.
//
// Clé : `<sub>:<permission>[,<permission>…]`, permissions triées, chacune au format
// `<resource>:<scope>`. Exemple : `5f0c…:invoices:READ` ou `5f0c…:a:READ,b:UPDATE`.

/** Clé de cache d'une décision UMA pour un utilisateur et un ensemble de permissions. */
export function umaCacheKey(sub: string, permissions: string[]): string {
  return `${sub}:${[...permissions].sort().join(',')}`;
}

/** Motifs (glob `*`) couvrant toutes les décisions d'un utilisateur. */
export function umaUserPatterns(sub: string): string[] {
  return [`${sub}:*`];
}

/**
 * Motifs (glob `*`) couvrant toutes les décisions mettant en jeu une ressource :
 * en première position après le `sub`, ou après une virgule dans une clé multi-permissions.
 */
export function umaResourcePatterns(resource: string): string[] {
  return [`*:${resource}:*`, `*,${resource}:*`];
}

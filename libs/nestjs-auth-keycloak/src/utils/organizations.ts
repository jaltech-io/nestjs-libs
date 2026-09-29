/**
 * Normalise le claim `organization` de Keycloak (Organizations 26+) en liste
 * d'identifiants d'organisation, quelle que soit la forme du mapper :
 *
 * - chaîne : `"acme"` → `['acme']`
 * - tableau : `["acme", "globex"]` → `['acme', 'globex']`
 * - objet indexé par alias : `{ acme: { id: ... }, globex: {} }` → `['acme', 'globex']`
 *
 * @returns La liste des organisations, ou `undefined` si le claim est absent/vide.
 */
export function normalizeOrganizations(claim: unknown): string[] | undefined {
  if (claim == null) return undefined;

  if (typeof claim === 'string') {
    return claim.length > 0 ? [claim] : undefined;
  }
  if (Array.isArray(claim)) {
    const list = claim.filter((v): v is string => typeof v === 'string');
    return list.length > 0 ? list : undefined;
  }
  if (typeof claim === 'object') {
    const keys = Object.keys(claim as Record<string, unknown>);
    return keys.length > 0 ? keys : undefined;
  }
  return undefined;
}

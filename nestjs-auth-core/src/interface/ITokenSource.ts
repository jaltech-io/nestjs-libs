/**
 * Contrat d'une source de token : extrait le JWT brut d'une requête entrante.
 *
 * Remplace la mutation historique du header par une lecture directe.
 * Implémentations fournies via les fabriques `TokenSource.*`.
 */
export interface ITokenSource {
  /**
   * Extrait le JWT brut depuis la requête.
   *
   * @param request - Objet requête (Express/Fastify).
   * @returns Le JWT brut, ou `null` si absent pour cette source.
   */
  extract(request: any): string | null;
}

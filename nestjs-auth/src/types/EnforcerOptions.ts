/**
 * Options transmises à l'enforcer UMA lors d'un appel `@Resource` / `@Scopes`.
 * Utilisées par `@UseEnforcerOptions()` et par le `ResourceGuard`.
 */
export type EnforcerOptions = {
  /**
   * Fonction retournant les claims contextuels envoyés à Keycloak avec la requête UMA.
   * Permet d'enrichir la décision d'autorisation avec des données dynamiques (IP, URI, user-agent…).
   *
   * @example
   * claims: (req) => ({ 'http.uri': [req.url], 'user.agent': [req.headers['user-agent']] })
   */
  claims?: (request: any) => Record<string, any>;
  /**
   * Mode de réponse attendu du endpoint UMA Keycloak.
   * - `'decision'` : retourne un booléen `{ result: true | false }`.
   * - `'permissions'` : retourne la liste des permissions accordées.
   * Défaut : `'decision'`.
   */
  response_mode?: 'decision' | 'permissions';
};

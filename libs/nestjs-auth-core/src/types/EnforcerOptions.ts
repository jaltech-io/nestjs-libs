/**
 * Options transmises à l'enforcer UMA lors d'un appel `@Resource` / `@Scopes`.
 */
export type EnforcerOptions = {
  /**
   * Fonction retournant les claims contextuels envoyés au provider avec la requête UMA.
   * @example claims: (req) => ({ 'http.uri': [req.url] })
   */
  claims?: (request: any) => Record<string, any>;
  /**
   * Mode de réponse attendu du endpoint UMA.
   * - `'decision'`    : booléen `{ result }`.
   * - `'permissions'` : liste des permissions accordées.
   * Défaut : `'decision'`.
   */
  response_mode?: 'decision' | 'permissions';
};

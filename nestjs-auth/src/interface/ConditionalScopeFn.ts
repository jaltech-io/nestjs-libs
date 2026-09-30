import type { IToken } from './IToken';

/**
 * Contrat d'une fonction calculant les scopes UMA de manière dynamique.
 *
 * Reçoit la requête courante et le token décodé, retourne la liste des scopes
 * à appliquer. Utilisée avec le décorateur `@ConditionalScopes()`.
 *
 * @example
 * @ConditionalScopes((req, token) => {
 *   if (token.hasRealmRole('admin')) return ['View.All'];
 *   return ['View'];
 * })
 */
export type ConditionalScopeFn = (request: any, token: IToken) => string[];

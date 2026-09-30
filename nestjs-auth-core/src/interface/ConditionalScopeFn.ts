import type { IToken } from './IToken';

/**
 * Fonction calculant dynamiquement les scopes UMA à appliquer.
 * Utilisée avec le décorateur `@ConditionalScopes()`.
 */
export type ConditionalScopeFn = (request: any, token: IToken) => string[];

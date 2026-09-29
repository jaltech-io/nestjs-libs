import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ConditionalScopeFn } from '../interface/ConditionalScopeFn';
import { extractRequest } from '../utils/index';

export const META_SCOPES = 'scopes';
export const META_CONDITIONAL_SCOPES = 'conditional-scopes';

/**
 * Déclare les scopes UMA requis. Évalué par le `ResourceGuard` avec `@Resource()`.
 */
export const Scopes = (...scopes: string[]) => SetMetadata(META_SCOPES, scopes);

/**
 * Déclare une fonction calculant les scopes dynamiquement selon la requête et le token.
 */
export const ConditionalScopes = (fn: ConditionalScopeFn) => SetMetadata(META_CONDITIONAL_SCOPES, fn);

/**
 * Injecte les scopes résolus (statiques + conditionnels) dans un paramètre de méthode.
 */
export const ResolvedScopes = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const [req] = extractRequest(ctx);
  return req?.scopes;
});

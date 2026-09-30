import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ConditionalScopeFn } from '../interface/ConditionalScopeFn';
import { extractRequest } from '../utils/index';

export const META_SCOPES = 'scopes';
export const META_CONDITIONAL_SCOPES = 'conditional-scopes';

/**
 * Déclare les scopes UMA requis pour accéder à une route.
 * Évalué par le `ResourceGuard` en combinaison avec `@Resource()`.
 *
 * Les valeurs doivent correspondre aux scopes configurés dans Keycloak Authorization Services.
 *
 * @example
 * @Get(':id')
 * @Scopes('View')
 * findOne() { ... }
 *
 * @Delete(':id')
 * @Scopes('Delete')
 * remove() { ... }
 */
export const Scopes = (...scopes: string[]) => SetMetadata(META_SCOPES, scopes);

/**
 * Déclare une fonction calculant les scopes dynamiquement selon la requête et le token.
 * Permet d'adapter les permissions selon le rôle ou les attributs de l'utilisateur.
 *
 * @example
 * @ConditionalScopes((req, token) => {
 *   if (token.hasRealmRole('admin')) return ['View.All'];
 *   return ['View'];
 * })
 */
export const ConditionalScopes = (fn: ConditionalScopeFn) => SetMetadata(META_CONDITIONAL_SCOPES, fn);

/**
 * Injecte les scopes résolus dans un paramètre de méthode.
 * Contient la liste finale des scopes après évaluation des `@ConditionalScopes`.
 *
 * @example
 * findAll(@ResolvedScopes() scopes: string[]) { ... }
 */
export const ResolvedScopes = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const [req] = extractRequest(ctx);
  return req.scopes;
});

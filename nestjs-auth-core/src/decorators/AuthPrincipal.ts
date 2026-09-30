import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthPrincipal as AuthPrincipalContract } from '../types/AuthPrincipal';
import { extractRequest } from '../utils/index';

/**
 * Injecte le principal applicatif typé (`AuthPrincipal`) résolu par le
 * `IPrincipalResolver`. `undefined` si aucun résolveur n'est configuré.
 *
 * @example
 * getProfile(@AuthPrincipal() principal: AuthPrincipal) { ... }
 */
export const AuthPrincipal = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const [req] = extractRequest(ctx);
  return req?.authPrincipal;
});

/**
 * Type du principal applicatif — fusionné avec le décorateur `@AuthPrincipal()`
 * (même nom : valeur + type), pour un usage ergonomique côté consommateur.
 */
export type AuthPrincipal = AuthPrincipalContract;

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { extractRequest } from '../utils/index';

/**
 * Injecte le JWT brut de l'utilisateur connecté (`request.accessToken`).
 * Utile pour propager le token vers des services aval.
 */
export const AccessToken = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const [req] = extractRequest(ctx);
  return req?.accessToken;
});

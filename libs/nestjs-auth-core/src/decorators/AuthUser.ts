import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { extractRequest } from '../utils/index';

/**
 * Injecte `request.user` : payload JWT décodé, ou `AuthPrincipal` si un résolveur
 * de principal est configuré. Disponible après l'`AuthGuard`.
 */
export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const [req] = extractRequest(ctx);
  return req?.user;
});

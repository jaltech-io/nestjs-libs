import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { extractRequest } from '../utils/index';

/**
 * Injecte le JWT brut de l'utilisateur connecté dans un paramètre de méthode.
 * Disponible après validation par l'`AuthGuard` (`request.accessToken`).
 *
 * Utile pour propager le token vers des services aval (appels inter-services).
 *
 * @example
 * @Get('data')
 * getData(@AccessToken() token: string) {
 *   return this.downstreamService.call(token);
 * }
 */
export const AccessToken = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const [req] = extractRequest(ctx);
  return req.accessToken;
});

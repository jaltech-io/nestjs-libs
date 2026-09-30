import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { extractRequest } from '../utils/index';

/**
 * Injecte le payload JWT décodé de l'utilisateur connecté dans un paramètre de méthode.
 * Disponible après validation par l'`AuthGuard` (`request.user`).
 *
 * @example
 * @Get('me')
 * getProfile(@AuthUser() user: any) {
 *   return user; // { sub, preferred_username, email, realm_access, ... }
 * }
 */
export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const [req] = extractRequest(ctx);
  return req.user;
});

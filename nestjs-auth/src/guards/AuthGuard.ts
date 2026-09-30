import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_CONNECT_OPTIONS, AUTH_COOKIE_DEFAULT, AUTH_INSTANCE, TokenValidation } from '../constants';
import { META_PUBLIC } from '../decorators/Public';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { IToken } from '../interface/IToken';
import type { AuthConfig } from '../types/AuthConfig';
import { extractRequestAndAttachCookie, parseToken } from '../utils/index';

/**
 * Guard global d'authentification.
 *
 * Valide le JWT présent dans le header `Authorization: Bearer` ou dans le cookie HTTP-only.
 * En cas de succès, positionne `request.user` (payload décodé) et `request.accessToken` (JWT brut).
 *
 * Trois modes de validation configurables via `AuthConfig.tokenValidation` :
 * - `ONLINE`  — interroge `/userinfo` (révocation immédiate, appel réseau par requête).
 * - `OFFLINE` — vérifie la signature JWKS localement (rapide, pas de révocation immédiate).
 * - `NONE`    — désactive la validation (développement uniquement).
 *
 * Routes accessibles sans token : annoter avec `@Public()`.
 * Remplacer l'implémentation : `{ provide: AUTH_GUARD, useClass: MonGuard }`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly reflector = new Reflector();

  constructor(
    @Inject(AUTH_INSTANCE) private authInstance: IAuthInstance,
    @Inject(AUTH_CONNECT_OPTIONS) private authOpts: AuthConfig,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(META_PUBLIC, [context.getClass(), context.getHandler()]);

    const cookieKey = this.authOpts.cookieKey || AUTH_COOKIE_DEFAULT;
    const [request] = extractRequestAndAttachCookie(context, cookieKey);
    if (!request) return true;

    const jwt = this.extractJwt(request.headers);
    const isJwtEmpty = jwt === null || jwt === undefined;

    if (!isPublic && isJwtEmpty) {
      this.logger.verbose('Empty jwt, unauthorized');
      throw new UnauthorizedException();
    }
    if (isPublic && isJwtEmpty) return true;

    this.logger.verbose('Validating jwt');

    const isValidToken = await this.validateToken(jwt);

    if (isValidToken) {
      request.user = parseToken(jwt);
      request.accessToken = jwt;
      this.logger.verbose('User authenticated', { user: request.user });
      return true;
    }

    if (isPublic) {
      this.logger.warn('A jwt token was retrieved but failed validation.');
      return true;
    }

    throw new UnauthorizedException();
  }

  private async validateToken(jwt: string): Promise<boolean> {
    const tokenValidation = this.authOpts.tokenValidation || TokenValidation.ONLINE;
    let grant: { access_token: IToken };

    try {
      grant = await this.authInstance.createGrant({ access_token: jwt });
    } catch (ex) {
      this.logger.warn(`Cannot validate access token: ${ex}`);
      return false;
    }

    const token = grant.access_token;
    this.logger.verbose(`Using token validation method: ${tokenValidation.toUpperCase()}`);

    try {
      switch (tokenValidation) {
        case TokenValidation.ONLINE:
          return (await this.authInstance.validateAccessToken(token)) === token;
        case TokenValidation.OFFLINE:
          return (await this.authInstance.validateToken(token, 'Bearer')) === token;
        case TokenValidation.NONE:
          return true;
        default:
          this.logger.warn(`Unknown validation method: ${tokenValidation}`);
          return false;
      }
    } catch (ex) {
      this.logger.warn(`Cannot validate access token: ${ex}`);
      return false;
    }
  }

  /** Extrait le JWT depuis le header `Authorization: Bearer <token>`. */
  private extractJwt(headers: { [key: string]: string }): string | null {
    if (!headers?.authorization) {
      this.logger.verbose('No authorization header');
      return null;
    }
    const auth = headers.authorization.split(' ');
    if (auth[0].toLowerCase() !== 'bearer') {
      this.logger.verbose('No bearer header');
      return null;
    }
    return auth[1];
  }
}

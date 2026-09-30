import { type CanActivate, type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_CONNECT_OPTIONS, AUTH_COOKIE_DEFAULT, AUTH_INSTANCE, RoleMatch, RoleMerge } from '../constants';
import { META_ROLE_MATCHING_MODE, META_ROLES } from '../decorators/Roles';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { IToken } from '../interface/IToken';
import type { AuthConfig } from '../types/AuthConfig';
import { extractRequestAndAttachCookie } from '../utils/index';

/**
 * Guard de vérification des rôles.
 *
 * Lit les rôles déclarés via `@Roles()` et vérifie leur présence dans le payload JWT.
 * S'exécute après l'`AuthGuard` qui positionne `request.accessToken`.
 *
 * Mode de correspondance configuré via `@RoleMatchingMode()` :
 * - `ANY` (défaut) — au moins un rôle doit être présent.
 * - `ALL`          — tous les rôles doivent être présents.
 *
 * Fusion des rôles classe + méthode configurée via `AuthConfig.roleMerge` :
 * - `OVERRIDE` (défaut) — les rôles de la méthode remplacent ceux de la classe.
 * - `ALL`               — les rôles de la méthode s'ajoutent à ceux de la classe.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);
  private readonly reflector = new Reflector();

  constructor(
    @Inject(AUTH_INSTANCE) private authInstance: IAuthInstance,
    @Inject(AUTH_CONNECT_OPTIONS) private authOpts: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roleMerge = this.authOpts.roleMerge ?? RoleMerge.OVERRIDE;
    const roles: string[] = [];

    const matchingMode = this.reflector.getAllAndOverride<RoleMatch>(META_ROLE_MATCHING_MODE, [
      context.getClass(),
      context.getHandler(),
    ]);

    if (roleMerge === RoleMerge.ALL) {
      const merged = this.reflector.getAllAndMerge<string[]>(META_ROLES, [context.getClass(), context.getHandler()]);
      if (merged) roles.push(...merged);
    } else if (roleMerge === RoleMerge.OVERRIDE) {
      const result = this.reflector.getAllAndOverride<string[]>(META_ROLES, [context.getHandler(), context.getClass()]);
      if (result) roles.push(...result);
    } else {
      throw new Error(`Unknown role merge: ${roleMerge}`);
    }

    if (roles.length === 0) return true;

    const roleMatchingMode = matchingMode ?? RoleMatch.ANY;
    this.logger.verbose(`Using matching mode: ${roleMatchingMode}`, { roles });

    const cookieKey = this.authOpts.cookieKey || AUTH_COOKIE_DEFAULT;
    const [request] = extractRequestAndAttachCookie(context, cookieKey);
    if (!request) return true;

    const { accessToken } = request;
    if (!accessToken) {
      this.logger.warn('No access token found in request, are you sure AuthGuard is first in the chain?');
      return false;
    }

    const grant = await this.authInstance.createGrant({ access_token: accessToken });
    const token: IToken = grant.access_token;

    const granted =
      roleMatchingMode === RoleMatch.ANY ? roles.some((r) => token.hasRole(r)) : roles.every((r) => token.hasRole(r));

    this.logger.verbose(`Resource ${granted ? 'granted' : 'denied'} due to role(s)`);
    return granted;
  }
}

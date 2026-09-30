import { type CanActivate, type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_CONNECT_OPTIONS, AUTH_INSTANCE, RoleMatch, RoleMerge } from '../constants';
import { META_ROLE_MATCHING_MODE, META_ROLES } from '../decorators/Roles';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { IToken } from '../interface/IToken';
import type { AuthConfig } from '../types/AuthConfig';
import type { AuthPrincipal } from '../types/AuthPrincipal';
import { extractRequest } from '../utils/index';

/**
 * Guard de vérification des rôles.
 *
 * Lit les rôles déclarés via `@Roles()` et vérifie leur présence :
 * - Si un principal a été résolu par l'`AuthGuard` (`request.authPrincipal`),
 *   les rôles du principal font autorité (ils remplacent les rôles du token).
 * - Sinon, les rôles du token (`IToken.hasRole`) sont évalués.
 *
 * Ne rappelle JAMAIS le résolveur : lit uniquement l'état déjà positionné.
 * Fail-closed : sans token ni principal alors qu'un rôle est requis → refus.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);
  private readonly reflector = new Reflector();

  constructor(
    @Inject(AUTH_INSTANCE) private readonly authInstance: IAuthInstance,
    @Inject(AUTH_CONNECT_OPTIONS) private readonly authOpts: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roleMerge = this.authOpts.roleMerge ?? RoleMerge.OVERRIDE;

    const matchingMode = this.reflector.getAllAndOverride<RoleMatch>(META_ROLE_MATCHING_MODE, [
      context.getClass(),
      context.getHandler(),
    ]);

    const roles: string[] = [];
    if (roleMerge === RoleMerge.ALL) {
      const merged = this.reflector.getAllAndMerge<string[]>(META_ROLES, [context.getClass(), context.getHandler()]);
      if (merged) roles.push(...merged);
    } else {
      const result = this.reflector.getAllAndOverride<string[]>(META_ROLES, [context.getHandler(), context.getClass()]);
      if (result) roles.push(...result);
    }

    if (roles.length === 0) return true;

    const mode = matchingMode ?? RoleMatch.ANY;
    this.logger.verbose(`Using matching mode: ${mode}`, { roles });

    const [request] = extractRequest(context);
    if (!request) return true;

    const check = await this.buildRoleCheck(request);
    if (!check) {
      this.logger.warn('No token/principal on request — is AuthGuard first in the chain?');
      return false;
    }

    const granted = mode === RoleMatch.ANY ? roles.some(check) : roles.every(check);
    this.logger.verbose(`Resource ${granted ? 'granted' : 'denied'} due to role(s)`);
    return granted;
  }

  /** Construit le prédicat `hasRole` selon la présence d'un principal résolu ou d'un token. */
  private async buildRoleCheck(request: any): Promise<((role: string) => boolean) | null> {
    const principal: AuthPrincipal | undefined = request.authPrincipal;
    if (principal) {
      const principalRoles = Array.isArray(principal.roles) ? principal.roles : [];
      return (role: string) => principalRoles.includes(role);
    }

    let token: IToken | undefined = request.authToken;
    if (!token && request.accessToken) {
      try {
        token = (await this.authInstance.createGrant({ access_token: request.accessToken })).access_token;
      } catch {
        return null;
      }
    }
    if (!token) return null;
    return (role: string) => token!.hasRole(role);
  }
}

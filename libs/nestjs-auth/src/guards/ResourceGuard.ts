import { type CanActivate, type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_CONNECT_OPTIONS, AUTH_COOKIE_DEFAULT, AUTH_INSTANCE, PolicyEnforcementMode } from '../constants';
import { META_PUBLIC } from '../decorators/Public';
import { META_RESOURCE } from '../decorators/Resource';
import { META_CONDITIONAL_SCOPES, META_SCOPES } from '../decorators/Scopes';
import { META_ENFORCER_OPTIONS } from '../decorators/UseEnforcerOptions';
import type { ConditionalScopeFn } from '../interface/ConditionalScopeFn';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { AuthConfig } from '../types/AuthConfig';
import type { EnforcerOptions } from '../types/EnforcerOptions';
import { extractRequestAndAttachCookie } from '../utils/index';

/**
 * Guard d'autorisation fine basé sur les ressources et scopes UMA.
 *
 * Évalue les permissions via le endpoint UMA de Keycloak.
 * Ne s'active que si un `@Resource()` est déclaré sur le contrôleur ou la méthode.
 * S'exécute après l'`AuthGuard` qui positionne `request.accessToken`.
 *
 * Comportement sans `@Resource` défini par `AuthConfig.policyEnforcement` :
 * - `PERMISSIVE` (défaut) — autorise la requête.
 * - `ENFORCING`           — refuse la requête.
 *
 * Les scopes sont combinés depuis `@Scopes()` (statiques) et `@ConditionalScopes()` (dynamiques).
 * Les options de l'enforcer sont surchargées via `@UseEnforcerOptions()`.
 */
@Injectable()
export class ResourceGuard implements CanActivate {
  private readonly logger = new Logger(ResourceGuard.name);
  private readonly reflector = new Reflector();

  constructor(
    @Inject(AUTH_INSTANCE) private authInstance: IAuthInstance,
    @Inject(AUTH_CONNECT_OPTIONS) private authOpts: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const defaultEnforcerOpts: EnforcerOptions = {
      claims: (request: any) => {
        const httpUri = request.url;
        const userAgent = request.headers['user-agent'];
        this.logger.verbose(`Enforcing claims, http.uri: ${httpUri}, user.agent: ${userAgent}`);
        return { 'http.uri': [httpUri], 'user.agent': [userAgent] };
      },
    };

    const resourceHandler = this.reflector.get<string>(META_RESOURCE, context.getHandler());
    const resourceClass = this.reflector.get<string>(META_RESOURCE, context.getClass());
    const resource = resourceHandler ?? resourceClass;

    const explicitScopes = this.reflector.get<string[]>(META_SCOPES, context.getHandler()) ?? [];
    const conditionalScopes = this.reflector.get<ConditionalScopeFn>(META_CONDITIONAL_SCOPES, context.getHandler());
    const isPublic = this.reflector.getAllAndOverride<boolean>(META_PUBLIC, [context.getClass(), context.getHandler()]);
    const enforcerOpts =
      this.reflector.getAllAndOverride<EnforcerOptions>(META_ENFORCER_OPTIONS, [
        context.getClass(),
        context.getHandler(),
      ]) ?? defaultEnforcerOpts;

    const policyEnforcementMode = this.authOpts.policyEnforcement || PolicyEnforcementMode.PERMISSIVE;
    const shouldAllow = policyEnforcementMode === PolicyEnforcementMode.PERMISSIVE;

    const cookieKey = this.authOpts.cookieKey || AUTH_COOKIE_DEFAULT;
    const [request, response] = extractRequestAndAttachCookie(context, cookieKey);
    if (!request) return true;

    if (!request.user && isPublic) {
      this.logger.verbose('Route has no user, and is public, allowed');
      return true;
    }

    const grant = await this.authInstance.createGrant({ access_token: request.accessToken });

    if (!resource) {
      this.logger.verbose(
        `Controller has no @Resource defined, request ${shouldAllow ? 'allowed' : 'denied'} due to policy enforcement`,
      );
      return shouldAllow;
    }

    if (!grant.access_token) {
      this.logger.warn('Access token is undefined');
      return shouldAllow;
    }

    const conditionalScopesResult = conditionalScopes ? conditionalScopes(request, grant.access_token) : [];
    const scopes = [...explicitScopes, ...conditionalScopesResult];
    request.scopes = scopes;

    if (!scopes || scopes.length === 0) {
      this.logger.verbose(
        `Route has no @Scope defined, request ${shouldAllow ? 'allowed' : 'denied'} due to policy enforcement`,
      );
      return shouldAllow;
    }

    this.logger.verbose(`Protecting resource [ ${resource} ] with scopes: [ ${scopes} ]`);

    const user = request.user?.preferred_username ?? 'user';
    const permissions = scopes.map((scope) => `${resource}:${scope}`);
    const isAllowed = await this.enforce(request, response, permissions, enforcerOpts);

    this.logger.verbose(`Resource [ ${resource} ] ${isAllowed ? 'granted' : 'denied'} to [ ${user} ]`);
    return isAllowed;
  }

  /** Enveloppe le middleware enforcer dans une Promise pour l'intégration avec NestJS. */
  private enforce(request: any, response: any, permissions: string[], options?: EnforcerOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) =>
      this.authInstance.enforcer(permissions, options)(request, response, (_: any) => {
        resolve(!request.resourceDenied);
      }),
    );
  }
}

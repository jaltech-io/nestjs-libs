import { type CanActivate, type ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_CONNECT_OPTIONS, AUTH_INSTANCE, PolicyEnforcementMode } from '../constants';
import { META_PUBLIC } from '../decorators/Public';
import { META_RESOURCE } from '../decorators/Resource';
import { META_CONDITIONAL_SCOPES, META_SCOPES } from '../decorators/Scopes';
import { META_ENFORCER_OPTIONS } from '../decorators/UseEnforcerOptions';
import type { ConditionalScopeFn } from '../interface/ConditionalScopeFn';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { IToken } from '../interface/IToken';
import type { AuthConfig } from '../types/AuthConfig';
import type { EnforcerOptions } from '../types/EnforcerOptions';
import { extractRequest } from '../utils/index';

/**
 * Guard d'autorisation fine basé sur les ressources et scopes UMA.
 *
 * Délègue l'évaluation à `IAuthInstance.enforcer()`. Ne s'active que si un
 * `@Resource()` est déclaré.
 *
 * **Fail-closed provider sans UMA :** si un `@Resource()` est présent mais que le
 * provider ne supporte pas l'UMA (`capabilities.uma === false`), la requête est
 * REFUSÉE et une erreur est journalisée — jamais autorisée par défaut.
 *
 * Comportement sans `@Resource` : `PolicyEnforcementMode` (`PERMISSIVE` par défaut).
 */
@Injectable()
export class ResourceGuard implements CanActivate {
  private readonly logger = new Logger(ResourceGuard.name);
  private readonly reflector = new Reflector();

  constructor(
    @Inject(AUTH_INSTANCE) private readonly authInstance: IAuthInstance,
    @Inject(AUTH_CONNECT_OPTIONS) private readonly authOpts: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const defaultEnforcerOpts: EnforcerOptions = {
      claims: (request: any) => ({
        'http.uri': [request.url],
        'user.agent': [request.headers?.['user-agent']],
      }),
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

    const shouldAllow = (this.authOpts.policyEnforcement ?? PolicyEnforcementMode.PERMISSIVE) === PolicyEnforcementMode.PERMISSIVE;

    const [request, response] = extractRequest(context);
    if (!request) return true;

    if (!request.user && isPublic) {
      this.logger.verbose('Route has no user and is public — allowed');
      return true;
    }

    if (!resource) {
      this.logger.verbose(`No @Resource — request ${shouldAllow ? 'allowed' : 'denied'} by policy enforcement`);
      return shouldAllow;
    }

    // Fail-closed : un @Resource sur un provider sans UMA ne doit JAMAIS passer.
    if (!this.authInstance.capabilities.uma) {
      this.logger.error(
        `@Resource("${resource}") requires UMA authorization, but the configured provider does not support it. Denying (fail-closed).`,
      );
      return false;
    }

    const token = await this.resolveToken(request);
    if (!token) {
      this.logger.warn('Access token is undefined');
      return shouldAllow;
    }

    const conditionalScopesResult = conditionalScopes ? conditionalScopes(request, token) : [];
    let scopes = [...explicitScopes, ...conditionalScopesResult];

    if (scopes.length === 0 && this.authOpts.verbScopeDefaults) {
      const verbScope = ResourceGuard.scopeForVerb(request.method);
      if (verbScope) scopes = [verbScope];
    }
    request.scopes = scopes;

    if (scopes.length === 0) {
      this.logger.verbose(`No @Scopes — request ${shouldAllow ? 'allowed' : 'denied'} by policy enforcement`);
      return shouldAllow;
    }

    this.logger.verbose(`Protecting resource [ ${resource} ] with scopes: [ ${scopes} ]`);

    const permissions = scopes.map((scope) => `${resource}:${scope}`);
    const isAllowed = await this.enforce(request, response, permissions, enforcerOpts);

    if (!isAllowed && this.authOpts.enforcementShadow) {
      this.logger.warn(`AUTHZ-SHADOW denied — resource [ ${resource} ] scopes [ ${scopes} ]`);
      return true;
    }

    return isAllowed;
  }

  /** Récupère l'`IToken` déjà validé par l'`AuthGuard`, ou le reconstruit si nécessaire. */
  private async resolveToken(request: any): Promise<IToken | null> {
    if (request.authToken) return request.authToken as IToken;
    if (!request.accessToken) return null;
    try {
      return (await this.authInstance.createGrant({ access_token: request.accessToken })).access_token;
    } catch {
      return null;
    }
  }

  /** Mapping verbe HTTP → scope d'autorisation (CQRS). */
  private static scopeForVerb(method: string | undefined): string | null {
    switch ((method ?? '').toUpperCase()) {
      case 'GET':
      case 'HEAD':
        return 'READ';
      case 'POST':
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return null;
    }
  }

  /** Enveloppe le middleware enforcer dans une Promise. */
  private enforce(request: any, response: any, permissions: string[], options?: EnforcerOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) =>
      this.authInstance.enforcer(permissions, options)(request, response, () => {
        resolve(!request.resourceDenied);
      }),
    );
  }
}

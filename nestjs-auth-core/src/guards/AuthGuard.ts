import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTH_CONNECT_OPTIONS,
  AUTH_INSTANCE,
  PRINCIPAL_CACHE,
  PRINCIPAL_RESOLVER,
  REVOCATION_STORE,
  TOKEN_SOURCE,
  TokenValidation,
} from '../constants';
import { META_PUBLIC } from '../decorators/Public';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { IPrincipalCache } from '../interface/IPrincipalCache';
import type { IPrincipalResolver } from '../interface/IPrincipalResolver';
import type { IRevocationStore } from '../interface/IRevocationStore';
import type { IToken } from '../interface/IToken';
import type { ITokenSource } from '../interface/ITokenSource';
import { InMemoryPrincipalCache } from '../services/InMemoryPrincipalCache';
import type { AuthConfig } from '../types/AuthConfig';
import type { AuthIdentity } from '../types/AuthIdentity';
import { extractRequest } from '../utils/index';

/** TTL par défaut du cache des principals résolus : 1 minute. */
const DEFAULT_PRINCIPAL_CACHE_TTL = 60_000;

/**
 * Guard global d'authentification, indépendant du provider.
 *
 * 1. Extrait le JWT via `ITokenSource` (header/cookie/session/chaîne).
 * 2. Valide via `IAuthInstance` selon `tokenValidation` (`ONLINE`/`OFFLINE`/`NONE`).
 * 3. Positionne `request.accessToken` (JWT brut) et `request.authToken` (`IToken`).
 * 4. Si un `IPrincipalResolver` est fourni : construit l'identité, résout le
 *    principal (avec cache `provider:subject`), le positionne sur `request.user`
 *    et `request.authPrincipal`. `ForbiddenException` → 403.
 * 5. Sinon : `request.user` = payload décodé du token.
 *
 * Fail-closed : token manquant/invalide → 401 ; erreur inattendue du résolveur → 401.
 * Routes sans token : annoter `@Public()`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly reflector = new Reflector();
  private readonly principalCache: IPrincipalCache;

  constructor(
    @Inject(AUTH_INSTANCE) private readonly authInstance: IAuthInstance,
    @Inject(AUTH_CONNECT_OPTIONS) private readonly authOpts: AuthConfig,
    @Inject(TOKEN_SOURCE) private readonly tokenSource: ITokenSource,
    @Optional() @Inject(PRINCIPAL_RESOLVER) private readonly resolver?: IPrincipalResolver,
    @Optional() @Inject(PRINCIPAL_CACHE) principalCache?: IPrincipalCache,
    @Optional() @Inject(REVOCATION_STORE) private readonly revocationStore?: IRevocationStore,
  ) {
    this.principalCache = principalCache ?? new InMemoryPrincipalCache();
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(META_PUBLIC, [context.getClass(), context.getHandler()]);

    const [request] = extractRequest(context);
    if (!request) return true;

    const jwt = this.tokenSource.extract(request);
    const isJwtEmpty = jwt === null || jwt === undefined || jwt === '';

    if (isJwtEmpty) {
      if (isPublic) return true;
      this.logger.verbose('Empty jwt, unauthorized');
      throw new UnauthorizedException();
    }

    const token = await this.validate(jwt as string, request);

    if (!token) {
      if (isPublic) {
        this.logger.warn('A jwt token was retrieved but failed validation.');
        return true;
      }
      throw new UnauthorizedException();
    }

    // Révocation (Back-Channel Logout) : session/sujet révoqué ou iat < notBefore → 401.
    if (this.revocationStore && (await this.isRevoked(token))) {
      if (isPublic) return true;
      throw new UnauthorizedException();
    }

    request.accessToken = jwt;
    request.authToken = token;

    if (this.resolver) {
      await this.resolvePrincipal(request, token);
    } else {
      request.user = token.content;
    }

    return true;
  }

  /** Vérifie l'état de révocation d'un token validé (fail-closed en cas de doute). */
  private async isRevoked(token: IToken): Promise<boolean> {
    const store = this.revocationStore!;
    const c = token.content;
    try {
      if (typeof c.sid === 'string' && (await store.isSidRevoked(c.sid))) return true;

      const provider = this.authInstance.toIdentity(token).provider;
      if (typeof c.sub === 'string' && (await store.isSubjectRevoked(provider, c.sub))) return true;

      if (typeof c.iss === 'string' && typeof c.iat === 'number') {
        const notBefore = await store.getNotBefore(c.iss);
        if (notBefore !== null && c.iat < notBefore) return true;
      }
      return false;
    } catch (ex) {
      this.logger.warn(`Revocation check failed, denying (fail-closed): ${(ex as Error).message}`);
      return true;
    }
  }

  /** Valide le JWT selon la méthode configurée. Retourne l'`IToken` validé ou `false`. */
  private async validate(jwt: string, request: any): Promise<IToken | false> {
    let token: IToken;
    try {
      const grant = await this.authInstance.createGrant({ access_token: jwt });
      token = grant.access_token;
    } catch (ex) {
      this.logger.warn(`Cannot parse access token: ${(ex as Error).message}`);
      return false;
    }

    const mode = this.authOpts.tokenValidation ?? TokenValidation.OFFLINE;
    const context = { request };
    try {
      switch (mode) {
        case TokenValidation.ONLINE:
          return (await this.authInstance.validateAccessToken(token, context)) ? token : false;
        case TokenValidation.OFFLINE:
          return (await this.authInstance.validateToken(token, 'Bearer', context)) ? token : false;
        case TokenValidation.NONE:
          return token;
        default:
          this.logger.warn(`Unknown validation method: ${mode}`);
          return false;
      }
    } catch (ex) {
      this.logger.warn(`Cannot validate access token: ${(ex as Error).message}`);
      return false;
    }
  }

  /** Résout le principal (avec cache) et le positionne sur la requête. Fail-closed. */
  private async resolvePrincipal(request: any, token: IToken): Promise<void> {
    const identity = this.authInstance.toIdentity(token);
    // Sans sujet stable, la clé de cache confondrait plusieurs identités : refus (fail-closed).
    if (typeof identity.subject !== 'string' || identity.subject.length === 0) {
      this.logger.warn('Token has no subject; cannot resolve a principal (fail-closed).');
      throw new UnauthorizedException();
    }
    const ttl = this.authOpts.principalCacheTtlMs ?? DEFAULT_PRINCIPAL_CACHE_TTL;
    const cacheKey = this.principalCacheKey(identity);

    let principal = ttl > 0 ? await this.principalCache.get(cacheKey) : null;

    if (!principal) {
      try {
        principal = await this.resolver!.resolve(identity);
      } catch (ex) {
        if (ex instanceof ForbiddenException) throw ex;
        this.logger.warn(`Principal resolution failed: ${(ex as Error).message}`);
        throw new UnauthorizedException();
      }
      if (ttl > 0) await this.principalCache.set(cacheKey, principal, ttl);
    }

    request.user = principal;
    request.authPrincipal = principal;
    request.authIdentity = identity;
  }

  /** Clé de cache du principal, cloisonnée par provider et tenant pour éviter les collisions. */
  private principalCacheKey(identity: AuthIdentity): string {
    return `${identity.provider}:${identity.tenantId ?? ''}:${identity.subject}`;
  }
}

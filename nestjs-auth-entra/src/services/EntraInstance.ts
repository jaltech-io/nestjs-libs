import { Logger } from '@nestjs/common';
import type {
  AuthCapabilities,
  AuthIdentity,
  AuthValidationContext,
  IAuthInstance,
  IToken,
} from '@jaltech/nestjs-auth-core';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { EntraToken } from './EntraToken';
import type { ResolvedEntraConfig } from '../types/EntraConfig';

/** Cooldown JWKS par défaut : 30 secondes. */
const DEFAULT_JWKS_COOLDOWN_MS = 30 * 1000;

/**
 * Implémentation Microsoft Entra ID de `IAuthInstance` — OFFLINE uniquement.
 *
 * Valide localement la signature RS256 via JWKS (`jose` + `createRemoteJWKSet`),
 * puis applique les contrôles Entra : `iss`, `aud`, `tid`, `exp`/`nbf`, `idtyp`,
 * `scp`, `acct` (`membersOnly`). Fail-closed sur toute anomalie.
 *
 * Ne supporte NI la validation ONLINE, NI l'UMA, NI le back-channel logout OIDC.
 * Ne valide JAMAIS un token Microsoft Graph (rejeté par le contrôle d'audience).
 */
export class EntraInstance implements IAuthInstance {
  readonly capabilities: AuthCapabilities = { online: false, uma: false, backChannelLogout: false };

  private readonly JWKS: JWTVerifyGetKey;
  private readonly logger = new Logger(EntraInstance.name);

  accessDenied: (req: any, res: any, next: any) => void;

  constructor(private readonly config: ResolvedEntraConfig) {
    const cooldown =
      config.minTimeBetweenJwksRequests != null
        ? config.minTimeBetweenJwksRequests * 1000
        : DEFAULT_JWKS_COOLDOWN_MS;
    this.JWKS = createRemoteJWKSet(new URL(config.jwksUri), {
      cacheMaxAge: 15 * 60 * 1000,
      cooldownDuration: cooldown,
    });

    this.accessDenied = (req: any, _res: any, next: any) => {
      req.resourceDenied = true;
      next();
    };
  }

  async createGrant(tokenObj: { access_token: string }): Promise<{ access_token: IToken }> {
    return { access_token: new EntraToken(tokenObj.access_token, this.config) };
  }

  /** Entra ne supporte pas la validation en ligne. */
  async validateAccessToken(_token: IToken, _context?: AuthValidationContext): Promise<IToken | false> {
    throw new Error('EntraInstance does not support ONLINE validation (no /userinfo). Use TokenValidation.OFFLINE.');
  }

  /**
   * Validation OFFLINE complète.
   * @returns Le token si tous les contrôles passent, `false` sinon (fail-closed).
   */
  async validateToken(token: IToken, _type: string, _context?: AuthValidationContext): Promise<IToken | false> {
    try {
      const { payload } = await jwtVerify(token.token, this.JWKS, {
        algorithms: ['RS256'],
        clockTolerance: this.config.clockToleranceSec,
      });

      // iss ∈ issuers
      if (typeof payload.iss !== 'string' || !this.config.issuers.includes(payload.iss)) {
        return this.reject('issuer mismatch');
      }
      // aud ∈ audiences
      const aud = payload.aud;
      const audiences = Array.isArray(aud) ? aud : aud != null ? [aud] : [];
      if (!audiences.some((a) => this.config.audiences.includes(a as string))) {
        return this.reject('audience mismatch');
      }
      // tid === tenantId
      if (payload.tid !== this.config.tenantId) {
        return this.reject('tenant mismatch');
      }
      // oid = identité stable (subject). Absent ⇒ rejet : sinon plusieurs identités
      // partageraient la même clé de cache de principal (fail-closed).
      if (typeof payload.oid !== 'string' || payload.oid.length === 0) {
        return this.reject('missing oid');
      }
      // idtyp === 'app' rejeté sauf allowAppTokens
      if (payload.idtyp === 'app' && !this.config.allowAppTokens) {
        return this.reject('application token rejected (idtyp=app)');
      }
      // Tous les requiredScopes présents dans scp (séparé par espaces)
      if (this.config.requiredScopes.length > 0) {
        const scp = typeof payload.scp === 'string' ? payload.scp.split(' ') : Array.isArray(payload.scp) ? payload.scp : [];
        if (!this.config.requiredScopes.every((s) => scp.includes(s))) {
          return this.reject('missing required scope');
        }
      }
      // membersOnly ⇒ acct === 0 ; acct absent ⇒ rejet (fail-closed)
      if (this.config.membersOnly) {
        const acct = payload.acct;
        if (acct === undefined || acct === null) return this.reject('membersOnly: acct claim absent');
        if (!(acct === 0 || acct === '0')) return this.reject('membersOnly: guest account rejected');
      }

      return token;
    } catch (err) {
      this.logger.debug(`Offline validation failed: ${(err as Error).message}`);
      return false;
    }
  }

  private reject(reason: string): false {
    this.logger.debug(`Entra token rejected: ${reason}`);
    return false;
  }

  toIdentity(token: IToken): AuthIdentity {
    const c = token.content;
    const acct = c.acct;
    const accountType = acct === 0 || acct === '0' ? 'member' : acct === 1 || acct === '1' ? 'guest' : undefined;
    const rawEmail = c.email ?? c.preferred_username;
    return {
      provider: 'entra',
      subject: c.oid,
      tenantId: c.tid,
      email: typeof rawEmail === 'string' ? rawEmail.toLowerCase() : undefined,
      displayName: c.name ?? c.preferred_username,
      accountType,
      claims: c,
    };
  }

  /** Entra n'a pas d'UMA : refuse toute demande d'autorisation fine (fail-closed). */
  enforcer(): (req: any, res: any, next: any) => Promise<void> {
    return async (req: any, _res: any, next: any) => {
      this.logger.error('Entra provider does not support UMA authorization (@Resource). Denying (fail-closed).');
      req.resourceDenied = true;
      next();
    };
  }
}

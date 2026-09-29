import { Logger } from '@nestjs/common';
import type {
  AuthCapabilities,
  AuthIdentity,
  AuthValidationContext,
  IAuthInstance,
  IToken,
} from '@jaltech/nestjs-auth-core';
import { jwtVerify } from 'jose';
import { parseToken } from '../utils/parseToken';
import { normalizeOrganizations } from '../utils/organizations';
import { KeycloakToken } from './KeycloakToken';
import type { RealmRegistry } from './RealmRegistry';

/** Options par défaut appliquées à chaque realm résolu. */
export type MultiRealmDefaults = {
  verifyTokenAudience?: boolean;
  requireOrganization?: boolean;
};

/**
 * Implémentation Keycloak multi-realm de `IAuthInstance` — OFFLINE uniquement.
 *
 * Sélectionne la configuration de realm via l'`iss` NON vérifié (allowlist STATIC
 * ou résolveur DYNAMIC, cf. `RealmRegistry`), puis vérifie la signature avec le
 * JWKS de CE realm. Un token de realm A ne peut donc pas passer pour le realm B :
 * l'`iss` sélectionne la config A, et la signature est vérifiée contre le JWKS A.
 *
 * L'UMA et la validation ONLINE ne sont pas supportées en mode multi-realm.
 */
export class KeycloakMultiRealmInstance implements IAuthInstance {
  readonly capabilities: AuthCapabilities = { online: false, uma: false, backChannelLogout: true };

  private readonly logger = new Logger(KeycloakMultiRealmInstance.name);

  accessDenied: (req: any, res: any, next: any) => void;

  constructor(
    private readonly registry: RealmRegistry,
    private readonly defaults: MultiRealmDefaults = {},
  ) {
    this.accessDenied = (req: any, _res: any, next: any) => {
      req.resourceDenied = true;
      next();
    };
  }

  async createGrant(tokenObj: { access_token: string }): Promise<{ access_token: IToken }> {
    parseToken(tokenObj.access_token);
    return { access_token: new KeycloakToken(tokenObj.access_token) };
  }

  /** Non supporté en multi-realm. */
  async validateAccessToken(): Promise<IToken | false> {
    throw new Error('KeycloakMultiRealmInstance does not support ONLINE validation. Use TokenValidation.OFFLINE.');
  }

  async validateToken(token: IToken, _type: string, context?: AuthValidationContext): Promise<IToken | false> {
    // 1. Lecture de l'iss NON vérifié — uniquement pour sélectionner une config d'allowlist.
    const iss = token.content?.iss;
    if (typeof iss !== 'string') return false;

    // 2. Résolution allowlist (STATIC/DYNAMIC) — inconnu ⇒ 401.
    const realm = await this.registry.resolve(iss, context?.request);
    if (!realm) {
      this.logger.debug(`Unknown issuer rejected: ${iss}`);
      return false;
    }

    // 3. Vérification de signature avec le JWKS de CE realm + issuer attendu.
    try {
      const { payload } = await jwtVerify(token.token, realm.jwks, {
        algorithms: ['RS256'],
        issuer: realm.issuer,
      });

      const verifyAud = realm.verifyTokenAudience ?? this.defaults.verifyTokenAudience ?? false;
      if (verifyAud && !this.audienceMatches(payload, realm.clientId)) {
        this.logger.debug('Multi-realm validation failed: audience mismatch');
        return false;
      }

      const requireOrg = realm.requireOrganization ?? this.defaults.requireOrganization ?? false;
      if (requireOrg && !normalizeOrganizations((payload as Record<string, unknown>).organization)) {
        this.logger.debug('Multi-realm validation failed: no organization on token');
        return false;
      }
      return token;
    } catch (err) {
      this.logger.debug(`Multi-realm validation failed: ${(err as Error).message}`);
      return false;
    }
  }

  private audienceMatches(payload: Record<string, unknown>, clientId: string): boolean {
    const aud = payload.aud;
    const audiences = Array.isArray(aud) ? aud : aud != null ? [aud] : [];
    if (audiences.includes(clientId)) return true;
    return payload.azp === clientId;
  }

  toIdentity(token: IToken): AuthIdentity {
    const c = token.content;
    return {
      provider: 'keycloak',
      subject: c.sub,
      // tenantId = issuer : cloisonne le cache des principals entre realms.
      tenantId: typeof c.iss === 'string' ? c.iss : undefined,
      email: typeof c.email === 'string' ? c.email.toLowerCase() : undefined,
      displayName: c.name ?? c.preferred_username,
      organizations: normalizeOrganizations(c.organization),
      claims: c,
    };
  }

  /** UMA non supportée en multi-realm : refuse (fail-closed). */
  enforcer(): (req: any, res: any, next: any) => Promise<void> {
    return async (req: any, _res: any, next: any) => {
      this.logger.error('Multi-realm Keycloak does not support UMA (@Resource). Denying (fail-closed).');
      req.resourceDenied = true;
      next();
    };
  }
}

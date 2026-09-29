import { Logger } from '@nestjs/common';
import type {
  AuthCapabilities,
  AuthIdentity,
  AuthValidationContext,
  EnforcerOptions,
  IAuthInstance,
  IToken,
  IUmaCache,
} from '@jaltech/nestjs-auth-core';
import { createRemoteJWKSet, importSPKI, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { parseToken } from '../utils/parseToken';
import { normalizeOrganizations } from '../utils/organizations';
import { KeycloakToken } from './KeycloakToken';

/** Type de la clé retournée par `importSPKI` (jose v6 : plus de `KeyLike`). */
type ImportedKey = Awaited<ReturnType<typeof importSPKI>>;

/** TTL par défaut du cache des décisions UMA : 1 minute. */
const DEFAULT_UMA_CACHE_TTL = 60 * 1000;
/** Cooldown JWKS par défaut : 30 secondes. */
const DEFAULT_JWKS_COOLDOWN_MS = 30 * 1000;

/** Options internes de `KeycloakInstance`, dérivées de `KeycloakConfig`. */
export type KeycloakInstanceOptions = {
  verifyTokenAudience?: boolean;
  umaCacheTtl?: number;
  umaCacheStore?: IUmaCache;
  realmPublicKey?: string;
  minTimeBetweenJwksRequests?: number;
  /** Rejette les tokens sans aucune organisation (Keycloak Organizations). */
  requireOrganization?: boolean;
};

const NO_OP_CACHE: IUmaCache = { get: async () => null, set: async () => {} };

/**
 * Implémentation Keycloak de `IAuthInstance` (OIDC standard : discovery JWKS + UMA).
 *
 * - Validation OFFLINE : signature JWT via JWKS (`jose`) ou clé publique locale (`realmPublicKey`).
 * - Validation ONLINE : endpoint `/userinfo`.
 * - Autorisation fine : endpoint UMA (`enforcer`) avec cache pluggable.
 * - `toIdentity` : identité normalisée (`subject = sub`).
 *
 * Aucun adaptateur `keycloak-connect` déprécié, aucun Passport.
 */
export class KeycloakInstance implements IAuthInstance {
  readonly capabilities: AuthCapabilities = { online: true, uma: true, backChannelLogout: true };

  /** Exposé pour construire le validateur de Back-Channel Logout partagé (même JWKS). */
  readonly issuer: string;
  readonly jwks: JWTVerifyGetKey;

  private readonly JWKS: JWTVerifyGetKey;
  private readonly logger = new Logger(KeycloakInstance.name);
  private readonly cache: IUmaCache;
  private readonly umaCacheTtl: number;
  private readonly verifyTokenAudience: boolean;
  private readonly requireOrganization: boolean;
  private readonly realmPublicKeyPem?: string;
  private localKeyPromise?: Promise<ImportedKey>;

  accessDenied: (req: any, res: any, next: any) => void;

  constructor(
    private readonly authServerUrl: string,
    private readonly realm: string,
    private readonly clientId: string,
    options: KeycloakInstanceOptions = {},
  ) {
    this.issuer = `${authServerUrl}/realms/${realm}`;
    this.umaCacheTtl = options.umaCacheTtl ?? DEFAULT_UMA_CACHE_TTL;
    this.verifyTokenAudience = options.verifyTokenAudience ?? false;
    this.requireOrganization = options.requireOrganization ?? false;
    // Le store par défaut (mémoire) est fourni par `KeycloakProvider.create`.
    this.cache = options.umaCacheStore ?? NO_OP_CACHE;

    const cooldown =
      options.minTimeBetweenJwksRequests != null
        ? options.minTimeBetweenJwksRequests * 1000
        : DEFAULT_JWKS_COOLDOWN_MS;

    const jwksUri = new URL(`${authServerUrl}/realms/${realm}/protocol/openid-connect/certs`);
    this.JWKS = createRemoteJWKSet(jwksUri, { cacheMaxAge: 15 * 60 * 1000, cooldownDuration: cooldown });
    this.jwks = this.JWKS;

    if (options.realmPublicKey) {
      // Corps base64 SPKI → PEM importable par jose.
      const body = options.realmPublicKey.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
      this.realmPublicKeyPem = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
      this.logger.log('Using local realmPublicKey for offline validation (JWKS bypassed).');
    }

    this.accessDenied = (req: any, _res: any, next: any) => {
      req.resourceDenied = true;
      next();
    };
  }

  async createGrant(tokenObj: { access_token: string }): Promise<{ access_token: IToken }> {
    parseToken(tokenObj.access_token);
    return { access_token: new KeycloakToken(tokenObj.access_token) };
  }

  async validateAccessToken(token: IToken, _context?: AuthValidationContext): Promise<IToken | false> {
    try {
      const res = await fetch(`${this.authServerUrl}/realms/${this.realm}/protocol/openid-connect/userinfo`, {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      if (res.ok) return token;
      this.logger.warn(`Online validation failed — status ${res.status}`);
      return false;
    } catch (err) {
      this.logger.warn(`Online validation error: ${(err as Error).message}`);
      return false;
    }
  }

  async validateToken(token: IToken, _type: string, _context?: AuthValidationContext): Promise<IToken | false> {
    try {
      const { payload } = this.realmPublicKeyPem
        ? await jwtVerify(token.token, await this.localKey(), { issuer: this.issuer })
        : await jwtVerify(token.token, this.JWKS, { issuer: this.issuer });

      if (this.verifyTokenAudience && !this.audienceMatches(payload)) {
        this.logger.debug('Offline validation failed: audience mismatch');
        return false;
      }
      if (this.requireOrganization && !normalizeOrganizations((payload as Record<string, unknown>).organization)) {
        this.logger.debug('Offline validation failed: no organization on token');
        return false;
      }
      return token;
    } catch (err) {
      this.logger.debug(`Offline validation failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Vérifie que le token est destiné à ce client :
   * `aud` contient `clientId`, OU `azp === clientId`.
   */
  private audienceMatches(payload: Record<string, unknown>): boolean {
    const aud = payload.aud;
    const audiences = Array.isArray(aud) ? aud : aud != null ? [aud] : [];
    if (audiences.includes(this.clientId)) return true;
    return payload.azp === this.clientId;
  }

  private localKey(): Promise<ImportedKey> {
    this.localKeyPromise ??= importSPKI(this.realmPublicKeyPem as string, 'RS256');
    return this.localKeyPromise;
  }

  toIdentity(token: IToken): AuthIdentity {
    const c = token.content;
    return {
      provider: 'keycloak',
      subject: c.sub,
      email: typeof c.email === 'string' ? c.email.toLowerCase() : undefined,
      displayName: c.name ?? c.preferred_username,
      organizations: normalizeOrganizations(c.organization),
      claims: c,
    };
  }

  enforcer(permissions: string[], options?: EnforcerOptions): (req: any, res: any, next: any) => Promise<void> {
    return async (req: any, _res: any, next: any) => {
      const accessToken: string = req.accessToken ?? req.headers?.authorization?.split(' ')[1];

      if (!accessToken) {
        req.resourceDenied = true;
        return next();
      }

      const cacheKey = this.buildCacheKey(accessToken, permissions);

      if (this.umaCacheTtl > 0 && cacheKey) {
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) {
          if (!cached.granted) req.resourceDenied = true;
          req.umaBenchmark = { hit: true, ttlRemainingMs: Math.max(0, cached.expiresAt - Date.now()), keycloakMs: null };
          return next();
        }
      }

      const t0 = Date.now();
      try {
        const body = new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
          audience: this.clientId,
          response_mode: options?.response_mode ?? 'decision',
        });
        for (const permission of permissions) body.append('permission', permission.replace(':', '#'));
        if (options?.claims) {
          const claims = options.claims(req);
          body.append('claim_token', Buffer.from(JSON.stringify(claims)).toString('base64'));
          body.append('claim_token_format', 'urn:ietf:params:oauth:token-type:jwt');
        }

        const umaRes = await fetch(`${this.authServerUrl}/realms/${this.realm}/protocol/openid-connect/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${accessToken}` },
          body: body.toString(),
        });

        const keycloakMs = Date.now() - t0;
        let granted: boolean;
        if (!umaRes.ok) {
          const errorBody = await umaRes.text();
          this.logger.verbose(`UMA denied — HTTP ${umaRes.status} — ${errorBody}`);
          granted = false;
        } else {
          const json = await umaRes.json();
          granted = json.result !== false;
        }

        if (!granted) req.resourceDenied = true;
        if (this.umaCacheTtl > 0 && cacheKey) {
          await this.cache.set(cacheKey, { granted, expiresAt: Date.now() + this.umaCacheTtl }, this.umaCacheTtl);
        }
        req.umaBenchmark = { hit: false, ttlRemainingMs: this.umaCacheTtl > 0 ? this.umaCacheTtl : null, keycloakMs };
        next();
      } catch (err) {
        this.logger.warn(`UMA enforcer error: ${(err as Error).message}`);
        req.resourceDenied = true;
        req.umaBenchmark = { hit: false, ttlRemainingMs: null, keycloakMs: Date.now() - t0 };
        next();
      }
    };
  }

  private buildCacheKey(accessToken: string, permissions: string[]): string | null {
    try {
      const payload = parseToken(accessToken);
      const sub = payload.sub ?? accessToken.slice(-16);
      return `${sub}:${[...permissions].sort().join(',')}`;
    } catch {
      return null;
    }
  }
}

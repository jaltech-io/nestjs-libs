import { Logger } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { IToken } from '../interface/IToken';
import type { IUmaCache } from '../interface/IUmaCache';
import type { EnforcerOptions } from '../types/EnforcerOptions';
import { parseToken } from '../utils/ParseTokenUtil';
import { KeycloakToken } from './KeycloakToken';

/** Durée de vie par défaut du cache des décisions UMA : 1 minute. */
const DEFAULT_UMA_CACHE_TTL = 60 * 1000;

/**
 * Implémentation Keycloak de `IAuthInstance`.
 *
 * Gère trois responsabilités :
 * - Validation JWT offline via JWKS (`jose`).
 * - Validation JWT online via le endpoint `/userinfo`.
 * - Évaluation des permissions fines via le endpoint UMA, avec cache pluggable.
 *
 * Instanciée automatiquement par `KeycloakModule` et injectée sous `AUTH_INSTANCE`.
 *
 * **Cache des décisions UMA :**
 * Le store de cache est injecté via le token `UMA_CACHE` (`IUmaCache`).
 * Par défaut : `InMemoryUmaCache` interne à `KeycloakModule` (Map + TTL, mémoire locale).
 * Pour un déploiement multi-instances : fournir un store Redis via
 * `CacheModule.register({ extras: [{ provide: UMA_CACHE, config: { type: 'redis', … } }] })`.
 *
 * **Benchmark UMA :**
 * `enforcer()` positionne `req.umaBenchmark` sur chaque requête UMA évaluée :
 * `{ hit, ttlRemainingMs, keycloakMs }`. Le controller peut l'exposer dans la réponse.
 */
export class KeycloakInstance implements IAuthInstance {
  private readonly JWKS: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly logger = new Logger(KeycloakInstance.name);
  private readonly cache: IUmaCache;

  /** Middleware Express positionné en cas de refus de ressource UMA. */
  accessDenied: (req: any, res: any, next: any) => void;

  /**
   * @param authServerUrl  - URL de base du serveur Keycloak (ex: `http://localhost:8080`).
   * @param realm          - Nom du realm Keycloak.
   * @param clientId       - Client ID de l'application (audience UMA).
   * @param umaCacheTtl    - Durée de vie des décisions UMA en cache (ms). Défaut : 60 s.
   *                         Mettre à `0` pour désactiver le cache.
   * @param umaCacheStore  - Implémentation `IUmaCache` injectée par `KeycloakModule` via le token `UMA_CACHE`.
   *                         Défaut : no-op (toutes les décisions sont un MISS — Keycloak appelé à chaque fois).
   */
  constructor(
    private readonly authServerUrl: string,
    private readonly realm: string,
    private readonly clientId: string,
    private readonly umaCacheTtl: number = DEFAULT_UMA_CACHE_TTL,
    umaCacheStore: IUmaCache = { get: async () => null, set: async () => {} },
  ) {
    this.issuer = `${authServerUrl}/realms/${realm}`;
    this.cache = umaCacheStore;

    const jwksUri = new URL(`${authServerUrl}/realms/${realm}/protocol/openid-connect/certs`);
    this.JWKS = createRemoteJWKSet(jwksUri, {
      cacheMaxAge: 15 * 60 * 1000,
      cooldownDuration: 30 * 1000,
    });

    if (umaCacheTtl > 0) {
      const store = umaCacheStore?.constructor?.name ?? 'InMemoryCache';
      this.logger.log(`UMA decision cache enabled (TTL ${umaCacheTtl / 1000} s, store: ${store}).`);
    } else {
      this.logger.log('UMA decision cache disabled — Keycloak called on every request.');
    }

    this.accessDenied = (req: any, _res: any, next: any) => {
      req.resourceDenied = true;
      next();
    };
  }

  /**
   * Crée un grant à partir d'un JWT brut.
   * Décode le payload sans vérifier la signature (la validation est faite séparément).
   *
   * @throws Si le JWT est malformé (moins de 3 segments).
   */
  async createGrant(tokenObj: { access_token: string }): Promise<{ access_token: IToken }> {
    parseToken(tokenObj.access_token);
    return { access_token: new KeycloakToken(tokenObj.access_token) };
  }

  /**
   * Valide le token en interrogeant `/userinfo`.
   * Détecte une révocation immédiate au prix d'un appel réseau par requête.
   *
   * @returns Le token si Keycloak répond `200 OK`, `false` sinon.
   */
  async validateAccessToken(token: IToken): Promise<IToken | false> {
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

  /**
   * Valide le token localement en vérifiant la signature via JWKS.
   * Rapide, sans appel réseau, mais ne détecte pas une révocation immédiate.
   *
   * @returns Le token si la signature est valide, `false` sinon.
   */
  async validateToken(token: IToken, _type: string): Promise<IToken | false> {
    try {
      await jwtVerify(token.token, this.JWKS, { issuer: this.issuer });
      return token;
    } catch (err) {
      this.logger.debug(`Offline validation failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Retourne un middleware Express évaluant les permissions UMA.
   *
   * **Priorité 1 — Cache UMA :** si une décision pour cet utilisateur et ces permissions
   * est en cache et non expirée, elle est retournée sans appel réseau.
   * Permet de survivre aux coupures courtes de Keycloak (`umaCacheTtl`).
   *
   * **Priorité 2 — Appel UMA Keycloak :** si aucune entrée en cache,
   * une requête `uma-ticket` est envoyée à Keycloak et la décision est mise en cache.
   *
   * @param permissions - Permissions à évaluer, format `'resource:scope'`.
   * @param options     - Claims contextuels et mode de réponse.
   */
  enforcer(permissions: string[], options?: EnforcerOptions): (req: any, res: any, next: any) => Promise<void> {
    return async (req: any, _res: any, next: any) => {
      const accessToken: string = req.accessToken ?? req.headers?.authorization?.split(' ')[1];

      if (!accessToken) {
        req.resourceDenied = true;
        return next();
      }

      // ── Priorité 1 : cache UMA ───────────────────────────────────────────────
      const cacheKey = this.buildCacheKey(accessToken, permissions);

      if (this.umaCacheTtl > 0 && cacheKey) {
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) {
          if (!cached.granted) req.resourceDenied = true;
          req.umaBenchmark = {
            hit: true,
            ttlRemainingMs: Math.max(0, cached.expiresAt - Date.now()),
            keycloakMs: null,
          };
          this.logger.verbose(`UMA cache hit: ${cached.granted ? 'granted' : 'denied'}`);
          return next();
        }
      }

      // ── Priorité 2 : appel UMA Keycloak ─────────────────────────────────────
      const t0 = Date.now();

      try {
        const body = new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
          audience: this.clientId,
          response_mode: options?.response_mode ?? 'decision',
        });

        for (const permission of permissions) {
          body.append('permission', permission.replace(':', '#'));
        }

        if (options?.claims) {
          const claims = options.claims(req);
          body.append('claim_token', Buffer.from(JSON.stringify(claims)).toString('base64'));
          body.append('claim_token_format', 'urn:ietf:params:oauth:token-type:jwt');
        }

        const umaRes = await fetch(`${this.authServerUrl}/realms/${this.realm}/protocol/openid-connect/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`,
          },
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

        // Mise en cache de la décision (accordée ou refusée)
        if (this.umaCacheTtl > 0 && cacheKey) {
          await this.cache.set(cacheKey, { granted, expiresAt: Date.now() + this.umaCacheTtl }, this.umaCacheTtl);
        }

        req.umaBenchmark = {
          hit: false,
          ttlRemainingMs: this.umaCacheTtl > 0 ? this.umaCacheTtl : null,
          keycloakMs,
        };

        next();
      } catch (err) {
        this.logger.warn(`UMA enforcer error: ${(err as Error).message}`);
        req.resourceDenied = true;
        req.umaBenchmark = { hit: false, ttlRemainingMs: null, keycloakMs: Date.now() - t0 };
        next();
      }
    };
  }

  /**
   * Construit la clé de cache UMA à partir du `sub` du token et des permissions demandées.
   * Retourne `null` si le token ne peut pas être parsé.
   */
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

import { Logger } from '@nestjs/common';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import type { KeycloakRealmConfig, KeycloakRealmResolver } from '../types/RealmConfig';

/** Realm résolu, prêt pour la validation (config + JWKS bornée). */
export type ResolvedRealm = KeycloakRealmConfig & { jwks: JWTVerifyGetKey };

/** Options du registre de realms multi-tenant. */
export type RealmRegistryOptions = {
  /** Allowlist statique (mode STATIC). */
  realms?: KeycloakRealmConfig[];
  /** Résolveur applicatif (mode DYNAMIC). */
  resolveRealm?: KeycloakRealmResolver;
  /** TTL du cache positif du résolveur (ms). Défaut : 300000. */
  resolverCacheTtlMs?: number;
  /** TTL du cache négatif du résolveur (ms) — évite le matraquage sur issuers inconnus. Défaut : 30000. */
  resolverNegativeCacheTtlMs?: number;
  /** Nombre max de JWKS sets en cache LRU (borne mémoire). Défaut : 100. */
  jwksCacheMax?: number;
  /** Cooldown JWKS (ms). Défaut : 30000. */
  jwksCooldownMs?: number;
  /** Nombre max d'appels résolveur pour issuers inconnus par fenêtre. Défaut : 100. */
  maxUnknownResolvesPerWindow?: number;
  /** Fenêtre du limiteur d'issuers inconnus (ms). Défaut : 60000. */
  unknownWindowMs?: number;
};

const DEFAULTS = {
  resolverCacheTtlMs: 300_000,
  resolverNegativeCacheTtlMs: 30_000,
  jwksCacheMax: 100,
  jwksCooldownMs: 30_000,
  maxUnknownResolvesPerWindow: 100,
  unknownWindowMs: 60_000,
};

/**
 * Registre de realms multi-tenant, fail-closed et borné en mémoire.
 *
 * Résout un `issuer` (allowlist STATIC ou résolveur DYNAMIC) vers une configuration
 * de realm, avec :
 * - cache résolveur positif ET négatif (TTL courts pour les négatifs) ;
 * - limiteur de débit sur les issuers inconnus ;
 * - cache LRU BORNÉ des JWKS sets (la mémoire ne croît pas avec le nombre de realms).
 *
 * Un `issuer` absent de l'allowlist / non résolu ⇒ `null` (le caller renvoie 401).
 */
export class RealmRegistry {
  private readonly logger = new Logger(RealmRegistry.name);
  private readonly staticMap = new Map<string, KeycloakRealmConfig>();
  private readonly resolverCache = new Map<string, { config: KeycloakRealmConfig | null; expiresAt: number }>();
  private readonly jwksLru = new Map<string, JWTVerifyGetKey>();
  private readonly opts: Required<Omit<RealmRegistryOptions, 'realms' | 'resolveRealm'>> &
    Pick<RealmRegistryOptions, 'resolveRealm'>;

  private unknownWindowStart = Date.now();
  private unknownCount = 0;

  constructor(options: RealmRegistryOptions) {
    for (const realm of options.realms ?? []) this.staticMap.set(realm.issuer, realm);
    this.opts = {
      resolverCacheTtlMs: options.resolverCacheTtlMs ?? DEFAULTS.resolverCacheTtlMs,
      resolverNegativeCacheTtlMs: options.resolverNegativeCacheTtlMs ?? DEFAULTS.resolverNegativeCacheTtlMs,
      jwksCacheMax: options.jwksCacheMax ?? DEFAULTS.jwksCacheMax,
      jwksCooldownMs: options.jwksCooldownMs ?? DEFAULTS.jwksCooldownMs,
      maxUnknownResolvesPerWindow: options.maxUnknownResolvesPerWindow ?? DEFAULTS.maxUnknownResolvesPerWindow,
      unknownWindowMs: options.unknownWindowMs ?? DEFAULTS.unknownWindowMs,
      resolveRealm: options.resolveRealm,
    };
  }

  /**
   * Résout un `issuer` (non vérifié) vers un realm, ou `null` si inconnu (fail-closed).
   * @param request - Contexte optionnel transmis au résolveur applicatif.
   */
  async resolve(issuer: string, request?: any): Promise<ResolvedRealm | null> {
    const config = await this.resolveConfig(issuer, request);
    if (!config) return null;
    return { ...config, jwks: this.jwksFor(config) };
  }

  private async resolveConfig(issuer: string, request?: any): Promise<KeycloakRealmConfig | null> {
    // 1. Allowlist statique.
    const staticHit = this.staticMap.get(issuer);
    if (staticHit) return staticHit;

    if (!this.opts.resolveRealm) return null;

    // 2. Cache résolveur (positif + négatif).
    const cached = this.resolverCache.get(issuer);
    if (cached && cached.expiresAt > Date.now()) return cached.config;

    // 3. Limiteur d'issuers inconnus (protège la base/le résolveur).
    if (!this.allowUnknownResolve()) {
      this.logger.warn('Unknown-issuer resolver rate limit reached — denying (fail-closed).');
      return null;
    }

    // 4. Appel du résolveur applicatif.
    let config: KeycloakRealmConfig | null = null;
    try {
      config = (await this.opts.resolveRealm(issuer, request)) ?? null;
    } catch (err) {
      this.logger.warn(`Realm resolver error, denying (fail-closed): ${(err as Error).message}`);
      config = null;
    }

    const ttl = config ? this.opts.resolverCacheTtlMs : this.opts.resolverNegativeCacheTtlMs;
    this.resolverCache.set(issuer, { config, expiresAt: Date.now() + ttl });
    return config;
  }

  private allowUnknownResolve(): boolean {
    const now = Date.now();
    if (now - this.unknownWindowStart > this.opts.unknownWindowMs) {
      this.unknownWindowStart = now;
      this.unknownCount = 0;
    }
    if (this.unknownCount >= this.opts.maxUnknownResolvesPerWindow) return false;
    this.unknownCount += 1;
    return true;
  }

  /** JWKS set du realm depuis un LRU borné (clé = issuer de confiance). */
  private jwksFor(config: KeycloakRealmConfig): JWTVerifyGetKey {
    const existing = this.jwksLru.get(config.issuer);
    if (existing) {
      // Marque comme récemment utilisé (MRU).
      this.jwksLru.delete(config.issuer);
      this.jwksLru.set(config.issuer, existing);
      return existing;
    }

    const uri = config.jwksUri ?? `${config.issuer}/protocol/openid-connect/certs`;
    const jwks = createRemoteJWKSet(new URL(uri), {
      cacheMaxAge: 15 * 60 * 1000,
      cooldownDuration: this.opts.jwksCooldownMs,
    });
    this.jwksLru.set(config.issuer, jwks);

    // Éviction LRU : supprime l'entrée la plus anciennement utilisée.
    if (this.jwksLru.size > this.opts.jwksCacheMax) {
      const oldest = this.jwksLru.keys().next().value as string | undefined;
      if (oldest !== undefined) this.jwksLru.delete(oldest);
    }
    return jwks;
  }

  /** Taille courante du cache JWKS (diagnostic/tests). */
  get jwksCacheSize(): number {
    return this.jwksLru.size;
  }
}

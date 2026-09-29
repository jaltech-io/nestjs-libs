import { Logger } from '@nestjs/common';
import type { AuthProvider } from '@jaltech/nestjs-auth-core';
import { InMemoryUmaCache } from './services/InMemoryUmaCache';
import { KeycloakBackChannelLogout, type LogoutRealm } from './services/KeycloakBackChannelLogout';
import { KeycloakInstance } from './services/KeycloakInstance';
import { KeycloakMultiRealmInstance } from './services/KeycloakMultiRealmInstance';
import { RealmRegistry } from './services/RealmRegistry';
import type { KeycloakConfig } from './types/KeycloakConfig';
import type { KeycloakMultiRealmOptions } from './types/MultiRealmConfig';

const logger = new Logger('KeycloakProvider');

/** Options dépréciées sans effet sur la validation bearer/UMA. */
const DEPRECATED_NOOP_OPTIONS: (keyof KeycloakConfig)[] = [
  'bearerOnly',
  'publicClient',
  'confidentialPort',
  'sslRequired',
];

/**
 * Fabrique du provider Keycloak (OIDC discovery + JWKS + UMA + Back-Channel Logout).
 *
 * @example
 * // Realm unique
 * AuthModule.register({
 *   provider: KeycloakProvider.create({ authServerUrl, realm, clientId, verifyTokenAudience: true }),
 *   tokenValidation: TokenValidation.OFFLINE,
 * })
 *
 * @example
 * // Multi-tenant (allowlist statique)
 * AuthModule.register({
 *   provider: KeycloakProvider.createMultiRealm({
 *     realms: [{ realm: 'acme', clientId: 'api', issuer: 'https://kc/realms/acme' }],
 *   }),
 * })
 */
export const KeycloakProvider = {
  /**
   * Provider Keycloak à realm unique. Valide les options requises AU BOOT.
   * @throws Error si `authServerUrl`, `realm` ou `clientId` manquent.
   */
  create(config: KeycloakConfig): AuthProvider {
    const missing = (['authServerUrl', 'realm', 'clientId'] as const).filter((k) => !config[k]);
    if (missing.length > 0) {
      throw new Error(`KeycloakProvider.create: missing required option(s): ${missing.join(', ')}`);
    }

    for (const opt of DEPRECATED_NOOP_OPTIONS) {
      if (config[opt] !== undefined) {
        logger.warn(`[deprecated] KeycloakConfig.${opt} has no effect on bearer/UMA validation and is ignored.`);
      }
    }

    const umaCacheTtl = config.umaCacheTtl ?? 60_000;
    const umaCacheStore = config.umaCacheStore ?? (umaCacheTtl > 0 ? new InMemoryUmaCache() : undefined);

    const instance = new KeycloakInstance(config.authServerUrl, config.realm, config.clientId, {
      backchannelUrl: config.backchannelUrl,
      verifyTokenAudience: config.verifyTokenAudience,
      umaCacheTtl,
      umaCacheStore,
      realmPublicKey: config.realmPublicKey,
      minTimeBetweenJwksRequests: config.minTimeBetweenJwksRequests,
      requireOrganization: config.requireOrganization,
    });

    // Validateur de Back-Channel Logout partageant le JWKS de l'instance.
    const resolveRealm = (iss: string): LogoutRealm | null =>
      iss === instance.issuer ? { issuer: instance.issuer, clientId: config.clientId, jwks: instance.jwks } : null;
    const backChannelLogout = new KeycloakBackChannelLogout(resolveRealm);

    return { name: 'keycloak', instance, backChannelLogout };
  },

  /**
   * Provider Keycloak multi-realm (multi-tenant). Fail-closed : issuer inconnu ⇒ 401.
   * @throws Error si ni `realms` ni `resolveRealm` ne sont fournis.
   */
  createMultiRealm(options: KeycloakMultiRealmOptions): AuthProvider {
    if ((!options.realms || options.realms.length === 0) && !options.resolveRealm) {
      throw new Error('KeycloakProvider.createMultiRealm: provide at least one static realm or a resolveRealm function.');
    }

    const registry = new RealmRegistry({
      realms: options.realms,
      resolveRealm: options.resolveRealm,
      resolverCacheTtlMs: options.resolverCacheTtlMs,
      resolverNegativeCacheTtlMs: options.resolverNegativeCacheTtlMs,
      jwksCacheMax: options.jwksCacheMax,
      jwksCooldownMs: options.minTimeBetweenJwksRequests != null ? options.minTimeBetweenJwksRequests * 1000 : undefined,
      maxUnknownResolvesPerWindow: options.maxUnknownResolvesPerWindow,
      unknownWindowMs: options.unknownWindowMs,
    });

    const instance = new KeycloakMultiRealmInstance(registry, {
      verifyTokenAudience: options.verifyTokenAudience,
      requireOrganization: options.requireOrganization,
    });

    const resolveLogoutRealm = async (iss: string): Promise<LogoutRealm | null> => {
      const realm = await registry.resolve(iss);
      return realm ? { issuer: realm.issuer, clientId: realm.clientId, jwks: realm.jwks } : null;
    };
    const backChannelLogout = new KeycloakBackChannelLogout(resolveLogoutRealm);

    return { name: 'keycloak', instance, backChannelLogout };
  },
} as const;

// ── @jaltech/nestjs-auth-keycloak — API publique ─────────────────────────────
// Provider Keycloak (OIDC discovery + JWKS + UMA + Back-Channel Logout) pour
// @jaltech/nestjs-auth-core.
//
// API principale :
//   AuthModule.register({ provider: KeycloakProvider.create({ ... }) })
//   AuthModule.register({ provider: KeycloakProvider.createMultiRealm({ ... }) })

export { KeycloakProvider } from './KeycloakProvider';
export { KeycloakInstance } from './services/KeycloakInstance';
export type { KeycloakInstanceOptions } from './services/KeycloakInstance';
export { KeycloakMultiRealmInstance } from './services/KeycloakMultiRealmInstance';
export type { MultiRealmDefaults } from './services/KeycloakMultiRealmInstance';
export { KeycloakToken } from './services/KeycloakToken';
export { InMemoryUmaCache } from './services/InMemoryUmaCache';
export { KeycloakBackChannelLogout } from './services/KeycloakBackChannelLogout';
export type { LogoutRealm, LogoutRealmResolver } from './services/KeycloakBackChannelLogout';
export { RealmRegistry } from './services/RealmRegistry';
export type { RealmRegistryOptions, ResolvedRealm } from './services/RealmRegistry';
export { normalizeOrganizations } from './utils/organizations';
export type { KeycloakConfig } from './types/KeycloakConfig';
export type { KeycloakMultiRealmOptions } from './types/MultiRealmConfig';
export type { KeycloakRealmConfig, KeycloakRealmResolver } from './types/RealmConfig';

// ── types/ — DTOs et types de données purs ────────────────────────────────────
// Règle : objets de configuration, unions discriminantes, DTOs — pas de méthodes.

// Config générique (provider-agnostic)
export { AuthConfig } from './AuthConfig';
export { EnforcerOptions } from './EnforcerOptions';
export { GqlContextType } from './GqlContextType';
// Config Keycloak-spécifique
export { KeycloakConfig, KeycloakCredentials } from './KeycloakConfig';
// Options du module asynchrone (plain config object)
export { KeycloakModuleAsyncOptions } from './KeycloakModuleAsyncOptions';

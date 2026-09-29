// ── @jaltech/nestjs-auth-entra — API publique ────────────────────────────────
// Provider Microsoft Entra ID (OFFLINE) pour @jaltech/nestjs-auth-core.
//
// API principale :
//   AuthModule.register({ provider: EntraProvider.create({ tenantId, clientId }) })

export { EntraProvider } from './EntraProvider';
export { EntraInstance } from './services/EntraInstance';
export { EntraToken } from './services/EntraToken';
export type { EntraConfig, ResolvedEntraConfig } from './types/EntraConfig';
export { resolveEntraConfig } from './types/EntraConfig';

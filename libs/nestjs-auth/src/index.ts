// ── nestjs-auth — API publique ───────────────────────────────────────────────
// Règle : l'app consommatrice ne dépend QUE de ce fichier.

// ── Tokens DI ─────────────────────────────────────────────────────────────────
// Tokens des guards (override via DIP)
// Token du store de cache UMA — à fournir via CacheModule.register({ extras: [...] })
// Enums
export {
  AUTH_CONNECT_OPTIONS,
  AUTH_COOKIE_DEFAULT,
  AUTH_GUARD,
  AUTH_INSTANCE,
  PolicyEnforcementMode,
  RESOURCE_GUARD,
  ROLE_GUARD,
  RoleMatch,
  RoleMerge,
  TokenValidation,
  UMA_CACHE,
} from './constants';
export { AccessToken } from './decorators/AccessToken';
export { AuthUser } from './decorators/AuthUser';
// ── Décorateurs ───────────────────────────────────────────────────────────────
export { Public } from './decorators/Public';
export { Resource } from './decorators/Resource';
export { RoleMatchingMode, Roles } from './decorators/Roles';
export { ConditionalScopes, ResolvedScopes, Scopes } from './decorators/Scopes';
export { UseEnforcerOptions } from './decorators/UseEnforcerOptions';
// ── Guards (exportés pour permettre la réutilisation par d'autres providers) ──
export { AuthGuard } from './guards/AuthGuard';
export { ResourceGuard } from './guards/ResourceGuard';
export { RoleGuard } from './guards/RoleGuard';
// ── interface/ — Contrats (méthodes uniquement) ───────────────────────────────
export { ConditionalScopeFn, IAuthInstance, IToken, IUmaCache, KeycloakOptionsFactory } from './interface/index';
// Module
export { KeycloakModule } from './KeycloakModule';
export type { EnforcerOptions } from './types/index';
// ── types/ — Objets de configuration (pas de méthodes) ───────────────────────
export { AuthConfig, KeycloakConfig, KeycloakCredentials, KeycloakModuleAsyncOptions } from './types/index';

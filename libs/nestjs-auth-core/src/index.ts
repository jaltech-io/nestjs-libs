// ── @jaltech/nestjs-auth-core — API publique ─────────────────────────────────
// Contrats + guards + décorateurs + module, indépendants du provider.
// Un provider concret est branché via une fabrique (KeycloakProvider / EntraProvider).

// ── Tokens DI + énumérations ──────────────────────────────────────────────────
export {
  AUTH_COOKIE_DEFAULT,
  AUTH_CONNECT_OPTIONS,
  AUTH_GUARD,
  AUTH_INSTANCE,
  BACKCHANNEL_LOGOUT_EVENT,
  BACKCHANNEL_LOGOUT_OPTIONS,
  BACKCHANNEL_LOGOUT_VALIDATOR,
  PolicyEnforcementMode,
  PRINCIPAL_CACHE,
  PRINCIPAL_RESOLVER,
  RESOURCE_GUARD,
  REVOCATION_STORE,
  ROLE_GUARD,
  RoleMatch,
  RoleMerge,
  TOKEN_SOURCE,
  TokenValidation,
  UMA_CACHE,
} from './constants';

// ── Contrats (interface/) ─────────────────────────────────────────────────────
export type {
  AuthCapabilities,
  AuthValidationContext,
  ConditionalScopeFn,
  IAuthInstance,
  IBackChannelLogoutValidator,
  IPrincipalCache,
  IPrincipalResolver,
  IRevocationStore,
  IToken,
  ITokenSource,
  IUmaCache,
  LogoutEvent,
} from './interface/index';

// ── Types de données (types/) ─────────────────────────────────────────────────
// `AuthPrincipal` (type + décorateur) est exporté depuis decorators/AuthPrincipal
// (fusion valeur + type, même nom) plus bas.
export type {
  AuthAsyncFactoryResult,
  AuthConfig,
  AuthIdentity,
  AuthModuleAsyncOptions,
  AuthModuleOptions,
  AuthProvider,
  EnforcerOptions,
  GqlContextType,
} from './types/index';

// ── Décorateurs ───────────────────────────────────────────────────────────────
export { AccessToken } from './decorators/AccessToken';
export { AuthPrincipal } from './decorators/AuthPrincipal';
export { AuthUser } from './decorators/AuthUser';
export { Public } from './decorators/Public';
export { Resource } from './decorators/Resource';
export { RoleMatchingMode, Roles } from './decorators/Roles';
export { ConditionalScopes, ResolvedScopes, Scopes } from './decorators/Scopes';
export { UseEnforcerOptions } from './decorators/UseEnforcerOptions';

// ── Guards (exportés pour réutilisation/override par DIP) ─────────────────────
export { AuthGuard } from './guards/AuthGuard';
export { ResourceGuard } from './guards/ResourceGuard';
export { RoleGuard } from './guards/RoleGuard';

// ── Sources de token ──────────────────────────────────────────────────────────
export { defaultTokenSource, TokenSource } from './token-source/TokenSource';

// ── Stores par défaut + services (réutilisables par les providers) ────────────
export { InMemoryPrincipalCache, InMemoryRevocationStore, BackChannelLogoutService } from './services/index';
export type { BackChannelLogoutOptions } from './services/index';

// ── Modules ───────────────────────────────────────────────────────────────────
export { AuthModule } from './module/AuthModule';
export { BackChannelLogoutModule } from './module/BackChannelLogoutModule';
export type { BackChannelLogoutModuleOptions } from './module/BackChannelLogoutModule';
export { validateAuthConfig } from './module/validateAuthConfig';

// ── Utilitaires bas niveau (partagés avec les packages provider) ──────────────
export { extractRequest, parseToken } from './utils/index';

## 0.1.1 (2026-10-03)

### 🩹 Fixes

- Back-Channel Logout: a `logout_token` carrying a `sid` now revokes that session only (OIDC Back-Channel Logout 1.0, § 2.6). Revoking the subject as well blocked every new sign-in of the user for the whole retention period. The subject is revoked only when the token has no `sid`.

## 0.1.0 (2026-09-29)

### 🚀 Features

- First release. Provider-agnostic core extracted from `@jaltech/nestjs-auth` 0.3.x: contracts (`IAuthInstance`, `IToken`), guards (`AuthGuard`, `RoleGuard`, `ResourceGuard`), decorators and DI tokens.
- `AuthModule.register` / `registerAsync` with a pluggable `provider` (Keycloak, Entra ID) and a `globalGuards` switch.
- `ITokenSource` with `TokenSource.header()`, `.cookie()`, `.session()` and `.chain()`; the default reproduces the previous header + cookie behavior without mutating the request.
- `IPrincipalResolver`: application-managed users and roles, cached per `provider + subject`, `ForbiddenException` → 403, and the new `@AuthPrincipal()` decorator.
- OIDC Back-Channel Logout: `BackChannelLogoutModule`, replay protection and a revocation store checked by `AuthGuard`.
- `verbScopeDefaults` and `enforcementShadow` carried over unchanged from 0.3.x.
- Configuration validated at boot (e.g. ONLINE validation with a provider that does not support it).

### 🔒 Security

- Fail-closed everywhere: `@Resource` with a provider without UMA is denied, unknown capabilities are refused, and a token without a subject never reaches the principal resolver (401) so distinct users can never share a principal cache entry.
- Tokens, cookies and full claims are never logged.

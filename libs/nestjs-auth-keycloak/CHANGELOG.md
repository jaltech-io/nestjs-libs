## 0.1.0 (2026-09-29)

### 🚀 Features

- First release. Keycloak provider for `@jaltech/nestjs-auth-core`, ported from `@jaltech/nestjs-auth` 0.3.x (standard OIDC + JWKS, no `keycloak-connect`).
- `KeycloakProvider.create()`: OFFLINE/ONLINE validation, realm and client roles, UMA with decision cache (same key format as 0.3.x).
- `KeycloakProvider.createMultiRealm()`: static realm allowlist or dynamic resolver, positive/negative resolver cache, rate-limited unknown issuers, bounded LRU of JWKS sets.
- Keycloak Organizations: `organization` claim normalized (string, array or object) and exposed on the identity; `requireOrganization` option.
- OIDC Back-Channel Logout validator.

### 🔒 Security

- Audience verification: `verifyTokenAudience` now actually checks `aud` (or `azp === clientId`). It was declared but ignored in 0.3.x. Default stays `false`; enabling it is recommended.
- `realmPublicKey` and `minTimeBetweenJwksRequests` are now honored; `bearerOnly`, `publicClient`, `confidentialPort`, `sslRequired` are deprecated and warn at boot.

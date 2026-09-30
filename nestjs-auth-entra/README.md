# @jaltech/nestjs-auth-entra

[![npm version](https://img.shields.io/npm/v/@jaltech/nestjs-auth-entra)](https://www.npmjs.com/package/@jaltech/nestjs-auth-entra)
[![license](https://img.shields.io/npm/l/@jaltech/nestjs-auth-entra)](./LICENSE)
[![types](https://img.shields.io/npm/types/@jaltech/nestjs-auth-entra)](https://www.npmjs.com/package/@jaltech/nestjs-auth-entra)

> [!WARNING]
> **Pre-release — not production-ready.** This package is under active development (pre-`1.0.0`) and has **not yet been through a human stabilization and review pass**. Its API may change at any time, without a deprecation cycle. This notice will be removed at the `1.0.0` release.

Microsoft Entra ID (formerly Azure AD) provider for [`@jaltech/nestjs-auth-core`](https://www.npmjs.com/package/@jaltech/nestjs-auth-core). It validates **access tokens issued for your API** locally (JWKS signature with [`jose`](https://github.com/panva/jose)), with every Entra-specific check done fail-closed.

Microsoft's `passport-azure-ad` is deprecated and there is no official replacement for validating Entra access tokens in a Node.js API; this package fills that gap.

## Features

- OFFLINE validation against the tenant's JWKS (cached, with cooldown).
- Accepts both **v2** (`login.microsoftonline.com/{tenant}/v2.0`) and **v1** (`sts.windows.net/{tenant}/`) access tokens.
- Checks `iss`, `aud`, `tid`, `exp`/`nbf` (with clock tolerance), app-only tokens (`idtyp`), required delegated scopes (`scp`) and, optionally, **members only** (`acct`).
- App roles from the `roles` claim, or roles from your database through a `principalResolver`.
- Normalized identity: `subject = oid`, `tenantId = tid`, lower-cased email.

## Requirements

- Node.js >= 20, ESM, NestJS 11
- `@jaltech/nestjs-auth-core` (peer dependency)
- A single-tenant Entra app registration that **exposes an API** (see the checklist below)

## Installation

```bash
pnpm add @jaltech/nestjs-auth-core @jaltech/nestjs-auth-entra
```

## Quick start

```typescript
import { AuthModule, TokenSource, TokenValidation } from '@jaltech/nestjs-auth-core';
import { EntraProvider } from '@jaltech/nestjs-auth-entra';

AuthModule.registerAsync({
  imports: [UsersModule],          // provides and exports DbPrincipalResolver
  inject: [DbPrincipalResolver],
  useFactory: (principalResolver: DbPrincipalResolver) => ({
    provider: EntraProvider.create({
      tenantId: process.env.ENTRA_TENANT_ID!,
      clientId: process.env.ENTRA_CLIENT_ID!,
      requiredScopes: ['access_as_user'],
      membersOnly: true,
    }),
    tokenValidation: TokenValidation.OFFLINE,
    // Tokens kept in a server session (BFF) instead of the Authorization header:
    tokenSource: TokenSource.session('tokens.accessToken'),
    principalResolver, // roles managed in your database
  }),
});
```

## Configuration — `EntraProvider.create(config)`

| Option | Default | Description |
|---|---|---|
| `tenantId` | — (required) | Tenant (GUID or domain). Single-tenant only. |
| `clientId` | — (required) | Client ID of the app registration that exposes the API. |
| `audiences` | `[clientId, 'api://' + clientId]` | Accepted `aud` values (v2 uses the client ID, v1 uses `api://…`). |
| `issuers` | v2 and v1 issuers of the tenant | Accepted `iss` values. |
| `jwksUri` | `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys` | Signing keys. |
| `requiredScopes` | `[]` | Delegated scopes that must **all** be present in `scp`, e.g. `['access_as_user']`. |
| `membersOnly` | `false` | Accept only tenant members: `acct` must be `0`. A missing `acct` claim is **rejected**. |
| `allowAppTokens` | `false` | Accept application tokens (`idtyp: 'app'`, client credentials). |
| `roleClaim` | `'roles'` | Claim holding app roles when no `principalResolver` provides them. |
| `clockToleranceSec` | `60` | Tolerance on `exp` / `nbf`. |
| `minTimeBetweenJwksRequests` | `30` | Minimum delay between JWKS fetches (seconds). |

Not supported (fail-closed): `ONLINE` validation (boot error), `@Resource` / UMA (requests denied), OIDC back-channel logout (boot error).

## App registration checklist

1. **Single-tenant** application in the Entra admin center.
2. **Expose an API**: set the Application ID URI (`api://<client-id>`) and add a delegated scope, e.g. `access_as_user`.
3. In the **manifest**, set `accessTokenAcceptedVersion` to `2` (v2 tokens; v1 tokens are still accepted if you keep the default issuers).
4. **Redirect URIs** (Web) for every environment, and the front-channel logout URL.
5. **Token configuration → optional claims**: `email` (ID token) and `acct` (ID and access tokens) — `acct` is required for `membersOnly`.
6. **App roles** if roles come from the token; otherwise use a `principalResolver`.
7. **Client secret** (or certificate) stored outside the repository (vault), with a rotation plan.

## Pitfalls handled by design

- **Never validate a Microsoft Graph token.** A login with only `openid profile email` returns an access token for Graph, which third parties cannot verify. Your login must request your API scope (`api://<client-id>/access_as_user`) to get a token meant for the API.
- **v1 vs v2**: v1 tokens use `https://sts.windows.net/{tenant}/` and `aud = api://<client-id>`; v2 tokens use `…/v2.0` and `aud = <client-id>`. Both are accepted by default.
- **Stable identity**: `oid` + `tid`. `sub` is pairwise per application and the email/UPN is never used as an identity key.
- **Guests**: with `membersOnly`, guests (`acct = 1`) and tokens without `acct` are rejected.
- **App-only tokens** (`idtyp = 'app'`, no `scp`) are rejected unless `allowAppTokens`.
- **Group overage**: when a user belongs to too many groups, Entra replaces `groups` with `_claim_names` / `_claim_sources` (a Graph call would be needed). This package **never grants a role** in that case; resolving overage through Graph is out of scope.

## Contributing

See the [repository README](../../README.md), [CONTRIBUTING.md](../../CONTRIBUTING.md) and [SECURITY.md](../../SECURITY.md).

## License

MIT © 2026 Jaltech — see [LICENSE](./LICENSE).

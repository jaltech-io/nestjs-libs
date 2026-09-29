# @jaltech/nestjs-auth-keycloak

[![npm version](https://img.shields.io/npm/v/@jaltech/nestjs-auth-keycloak)](https://www.npmjs.com/package/@jaltech/nestjs-auth-keycloak)
[![license](https://img.shields.io/npm/l/@jaltech/nestjs-auth-keycloak)](./LICENSE)
[![types](https://img.shields.io/npm/types/@jaltech/nestjs-auth-keycloak)](https://www.npmjs.com/package/@jaltech/nestjs-auth-keycloak)

> [!WARNING]
> **Pre-release — not production-ready.** This package is under active development (pre-`1.0.0`) and has **not yet been through a human stabilization and review pass**. Its API may change at any time, without a deprecation cycle. This notice will be removed at the `1.0.0` release.

Keycloak provider for [`@jaltech/nestjs-auth-core`](https://www.npmjs.com/package/@jaltech/nestjs-auth-core). It relies on **standard OpenID Connect** (JWKS signature validation with [`jose`](https://github.com/panva/jose)) and does **not** use the deprecated `keycloak-connect` adapter.

## Features

- **OFFLINE** validation (JWKS, cached with cooldown) or **ONLINE** validation (`/userinfo`).
- Realm roles (`realm_access`) and client roles (`resource_access[client]`).
- **Audience verification** (`aud` contains the client, or `azp` equals it).
- **UMA 2.0** fine-grained authorization for `@Resource` / `@Scopes`, with a decision cache (in-memory or Redis).
- **Multi-tenancy**: static realm allowlist, dynamic resolver backed by your database, or **Keycloak Organizations** (single realm).
- **OIDC Back-Channel Logout** support.

## Requirements

- Node.js >= 20, ESM, NestJS 11
- `@jaltech/nestjs-auth-core` (peer dependency)
- Keycloak 26+ for the Organizations claim; any recent Keycloak otherwise

## Installation

```bash
pnpm add @jaltech/nestjs-auth-core @jaltech/nestjs-auth-keycloak
```

## Quick start (single realm)

```typescript
import { AuthModule, TokenValidation } from '@jaltech/nestjs-auth-core';
import { KeycloakProvider } from '@jaltech/nestjs-auth-keycloak';

AuthModule.register({
  provider: KeycloakProvider.create({
    authServerUrl: 'https://auth.example.com', // without /auth since Keycloak 17
    realm: 'my-realm',
    clientId: 'my-api',
    verifyTokenAudience: true,
  }),
  tokenValidation: TokenValidation.OFFLINE,
});
```

## Configuration — `KeycloakProvider.create(config)`

| Option | Default | Description |
|---|---|---|
| `authServerUrl` | — (required) | Keycloak base URL. |
| `realm` | — (required) | Realm name. |
| `clientId` | — (required) | Client of this API. |
| `secret` | — | Client secret (confidential clients). |
| `verifyTokenAudience` | `false` | **Recommended: `true`.** Rejects tokens issued for another client of the same realm. Accepts `aud` containing the client, or `azp === clientId` (Keycloak often puts `account` in `aud` and the client in `azp`). |
| `requireOrganization` | `false` | Reject tokens without a Keycloak Organizations claim. |
| `umaCacheTtl` | `60000` | UMA decision cache TTL (ms). `0` disables the cache. |
| `umaCacheStore` | in-memory | Store for UMA decisions (see below). |
| `realmPublicKey` | — | Verify with a local public key instead of fetching the JWKS. |
| `minTimeBetweenJwksRequests` | — | Minimum delay between JWKS fetches (seconds). |
| `bearerOnly`, `publicClient`, `confidentialPort`, `sslRequired` | — | **Deprecated**, no effect; a warning is logged at boot. |

> **Security note.** `verifyTokenAudience` defaults to `false` for backward compatibility. Leaving it off means a token issued in the same realm for **another** application is accepted. Turn it on.

## UMA decision cache shared across instances (Redis)

UMA decisions are cached per `sub` and requested permissions. Behind a load balancer, share the cache so every instance sees the same decisions and an invalidation takes effect everywhere. The provider is built before dependency injection, so pass the store through `registerAsync`:

```typescript
import { AuthModule, PolicyEnforcementMode, TokenValidation, UMA_CACHE, type IUmaCache } from '@jaltech/nestjs-auth-core';
import { KeycloakProvider } from '@jaltech/nestjs-auth-keycloak';
import { CacheModule } from '@jaltech/nestjs-cache';

@Module({
  imports: [
    CacheModule.register({
      store: { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
      extras: [{ provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } }],
    }),
    AuthModule.registerAsync({
      inject: [UMA_CACHE],
      useFactory: (umaCache: IUmaCache) => ({
        provider: KeycloakProvider.create({
          authServerUrl: process.env.KEYCLOAK_URL!,
          realm: process.env.KEYCLOAK_REALM!,
          clientId: process.env.KEYCLOAK_CLIENT_ID!,
          umaCacheTtl: 15 * 60 * 1000,
          umaCacheStore: umaCache,
        }),
        tokenValidation: TokenValidation.OFFLINE,
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
        verbScopeDefaults: true,
        enforcementShadow: process.env.AUTHZ_ENFORCE !== 'enforce',
      }),
    }),
  ],
})
export class AppModule {}
```

Cache keys have the form `<sub>:<resource>:<SCOPE>[,…]` (permissions sorted), so all decisions for a resource can be dropped with the pattern `*:<resource>:*` after a permission change.

## Multi-tenancy

Three modes, all **fail-closed** (an unknown issuer is rejected with 401). The token's unverified `iss` is only ever used as a **lookup key into your allowlist**; no URL is ever derived from the token.

### 1. Static realms (a few tenants)

```typescript
KeycloakProvider.createMultiRealm({
  realms: [
    { realm: 'acme', clientId: 'api', issuer: 'https://auth.example.com/realms/acme' },
    { realm: 'globex', clientId: 'api', issuer: 'https://auth.example.com/realms/globex' },
  ],
  verifyTokenAudience: true,
});
```

### 2. Dynamic resolver (many realms)

```typescript
KeycloakProvider.createMultiRealm({
  resolveRealm: async (issuer) => tenantsRepository.findRealmByIssuer(issuer), // null ⇒ 401
  resolverCacheTtlMs: 5 * 60 * 1000,
  resolverNegativeCacheTtlMs: 30 * 1000, // protects your database from garbage issuers
  jwksCacheMax: 100,                     // bounded LRU of JWKS sets
});
```

Resolver results are cached (positive and negative), unknown-issuer lookups are rate-limited, and JWKS sets live in a bounded LRU cache so memory does not grow with the number of realms. A token from realm A can never pass as realm B: the issuer selects the realm configuration, and the signature is verified against **that** realm's keys.

UMA and ONLINE validation are not available in multi-realm mode.

### 3. Keycloak Organizations (recommended at scale)

Beyond a few dozen tenants, prefer **one realm with [Keycloak Organizations](https://www.keycloak.org/docs/latest/server_admin/#_managing_organizations)** (Keycloak 26+) over one realm per tenant. Each realm carries its own configuration, keys and caches: realm-per-tenant increases Keycloak's startup time, memory and administration effort, and every configuration change has to be repeated per realm. With Organizations, each customer is an organization inside a single realm, with its own members, email domains and federated identity providers.

The `organization` claim is normalized whatever the mapper shape (string, array, or object keyed by alias) and exposed as `AuthIdentity.organizations`, so your `principalResolver` can bind the user to its tenant. Use `requireOrganization: true` to reject tokens without an organization.

## Back-channel logout

`KeycloakProvider.create()` and `createMultiRealm()` both expose a back-channel logout validator. Mount it with `BackChannelLogoutModule` from the core package and set the client's *Backchannel logout URL* in Keycloak to `https://<api>/auth/backchannel-logout`.

## Migrating from `@jaltech/nestjs-auth`

| Before | After |
|---|---|
| `import { Resource, Scopes, Public, UMA_CACHE, TokenValidation, PolicyEnforcementMode } from '@jaltech/nestjs-auth'` | same names from `@jaltech/nestjs-auth-core` |
| `KeycloakModule.register({ authServerUrl, realm, clientId, secret, umaCacheTtl, … })` | `AuthModule.register({ provider: KeycloakProvider.create({ authServerUrl, realm, clientId, secret, umaCacheTtl }), … })` |
| `policyEnforcement`, `tokenValidation`, `cookieKey`, `verbScopeDefaults`, `enforcementShadow` on `KeycloakModule` | same options on `AuthModule` |
| UMA cache injected automatically from `UMA_CACHE` | pass it explicitly with `registerAsync` (see above) |

Behavior is otherwise unchanged. Turning on `verifyTokenAudience` is recommended.

## Contributing

See the [repository README](../../README.md), [CONTRIBUTING.md](../../CONTRIBUTING.md) and [SECURITY.md](../../SECURITY.md).

## License

MIT © 2026 Jaltech — see [LICENSE](./LICENSE).

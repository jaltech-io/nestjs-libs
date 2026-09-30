# @jaltech/nestjs-auth-core

[![npm version](https://img.shields.io/npm/v/@jaltech/nestjs-auth-core)](https://www.npmjs.com/package/@jaltech/nestjs-auth-core)
[![license](https://img.shields.io/npm/l/@jaltech/nestjs-auth-core)](./LICENSE)
[![types](https://img.shields.io/npm/types/@jaltech/nestjs-auth-core)](https://www.npmjs.com/package/@jaltech/nestjs-auth-core)

> [!WARNING]
> **Pre-release — not production-ready.** This package is under active development (pre-`1.0.0`) and has **not yet been through a human stabilization and review pass**. Its API may change at any time, without a deprecation cycle. This notice will be removed at the `1.0.0` release.

Provider-agnostic authentication and authorization for NestJS. The core ships the **contracts, guards, decorators and module**; an identity provider is plugged in through a small provider package:

| Provider package | Identity provider |
|---|---|
| [`@jaltech/nestjs-auth-keycloak`](https://www.npmjs.com/package/@jaltech/nestjs-auth-keycloak) | Keycloak (single realm, multi-realm, Organizations, UMA, back-channel logout) |
| [`@jaltech/nestjs-auth-entra`](https://www.npmjs.com/package/@jaltech/nestjs-auth-entra) | Microsoft Entra ID (ex-Azure AD) |

Controllers, guards and decorators never depend on the provider: switching provider only changes the module registration.

## Features

- **Pluggable providers** — guards depend only on the `IAuthInstance` / `IToken` contracts.
- **Configurable token source** — `Authorization` header, HTTP-only cookie (BFF), server session (`express-session`), or a chain of them.
- **Application-managed roles** — an optional `IPrincipalResolver` loads the user and its roles from your database; its roles replace the token's roles. Results are cached per `provider + subject`.
- **Role-based access** — `@Roles()` with `ANY` / `ALL` matching and class/method merge strategies.
- **Fine-grained authorization** — `@Resource()` + `@Scopes()` delegated to the provider (Keycloak UMA). Optional scope derivation from the HTTP verb and a **shadow mode** that logs denials without blocking.
- **OIDC Back-Channel Logout** — a mountable endpoint plus a revocation store checked by `AuthGuard` (when the provider supports it).
- **Fail-closed by design** — missing claim, unknown issuer, unsupported capability or incomplete configuration always deny. Invalid configurations fail **at boot**, not at the first request.
- **No secrets in logs** — tokens, cookies and full claims are never logged.

## Requirements

- Node.js >= 20, ESM
- NestJS 11 (`@nestjs/common`, `@nestjs/core` `^11.0.0`), `reflect-metadata` `^0.2.0`, `rxjs` `^7.8.0`
- `@nestjs/graphql` `^13.0.0` — **optional**, only for GraphQL execution contexts

## Installation

```bash
pnpm add @jaltech/nestjs-auth-core @jaltech/nestjs-auth-keycloak
# or
pnpm add @jaltech/nestjs-auth-core @jaltech/nestjs-auth-entra
```

## Quick start

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, TokenValidation } from '@jaltech/nestjs-auth-core';
import { KeycloakProvider } from '@jaltech/nestjs-auth-keycloak';

@Module({
  imports: [
    AuthModule.register({
      provider: KeycloakProvider.create({
        authServerUrl: process.env.KEYCLOAK_URL!,
        realm: process.env.KEYCLOAK_REALM!,
        clientId: process.env.KEYCLOAK_CLIENT_ID!,
        verifyTokenAudience: true,
      }),
      tokenValidation: TokenValidation.OFFLINE,
    }),
  ],
})
export class AppModule {}
```

```typescript
import { Controller, Get } from '@nestjs/common';
import { AuthUser, Public, Resource, Roles, Scopes } from '@jaltech/nestjs-auth-core';

@Controller('orders')
@Resource('orders')
export class OrdersController {
  @Get('health') @Public() health() { return 'ok'; }

  @Get() @Scopes('READ') list(@AuthUser() user: { sub: string }) { /* … */ }

  @Get('admin') @Roles('admin') admin() { /* … */ }
}
```

## Module options

`AuthModule.register(options)` / `AuthModule.registerAsync({ imports, inject, useFactory })`:

| Option | Default | Description |
|---|---|---|
| `provider` | — (required) | Provider from `KeycloakProvider.create()` / `EntraProvider.create()`. |
| `tokenSource` | `chain(header(), cookie(cookieKey))` | Where the access token is read. |
| `cookieKey` | `'KEYCLOAK_JWT'` | Cookie used by the default token source. |
| `principalResolver` | — | Application resolver (see below). |
| `principalCacheTtlMs` | `60000` | Principal cache TTL. `0` disables it. |
| `tokenValidation` | `OFFLINE` | `OFFLINE` (JWKS signature), `ONLINE` (provider round-trip, if supported), `NONE`. |
| `roleMerge` | `OVERRIDE` | How class- and method-level `@Roles()` combine (`OVERRIDE` / `ALL`). |
| `policyEnforcement` | `PERMISSIVE` | `ResourceGuard` behavior on routes without `@Resource`. |
| `verbScopeDefaults` | `false` | With `@Resource` and no `@Scopes`, derive the scope from the HTTP verb: `GET/HEAD→READ`, `POST→CREATE`, `PUT/PATCH→UPDATE`, `DELETE→DELETE`. |
| `enforcementShadow` | `false` | Log UMA denials (`AUTHZ-SHADOW denied — …`) but let the request through. Useful to observe a permission matrix before enforcing it. |
| `globalGuards` | `true` | Register `AuthGuard`, `RoleGuard` and `ResourceGuard` as `APP_GUARD`. `false`: apply them yourself with `@UseGuards(AUTH_GUARD, ROLE_GUARD)`. |

Guard order is always **authentication → roles → resources**.

## Token source

```typescript
import { TokenSource } from '@jaltech/nestjs-auth-core';

TokenSource.header();                      // Authorization: Bearer …
TokenSource.cookie('APP_JWT');             // HTTP-only cookie (BFF)
TokenSource.session('tokens.accessToken'); // express-session, dotted path
TokenSource.chain(TokenSource.header(), TokenSource.session('tokens.accessToken')); // first match wins
```

## Application-managed roles (`principalResolver`)

When roles live in your database rather than in the token, provide a resolver. After validation, `AuthGuard` calls it with a normalized `AuthIdentity`, stores the returned `AuthPrincipal` on `request.user`, and `RoleGuard` uses **the principal's roles instead of the token's**. Throw `ForbiddenException` to deny access (HTTP **403**, not 401).

```typescript
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthIdentity, AuthPrincipal, IPrincipalResolver } from '@jaltech/nestjs-auth-core';

@Injectable()
export class DbPrincipalResolver implements IPrincipalResolver {
  constructor(private readonly users: UsersRepository) {}

  async resolve(identity: AuthIdentity): Promise<AuthPrincipal> {
    const user = await this.users.findBySubjectOrEmail(identity.subject, identity.email);
    if (!user?.active) throw new ForbiddenException('Access not granted');
    return { subject: identity.subject, email: identity.email, roles: user.roles, userId: user.id };
  }
}
```

`principalResolver` takes an **instance**. When it depends on injected services (repositories…), register the module asynchronously:

```typescript
AuthModule.registerAsync({
  imports: [UsersModule],        // provides and exports DbPrincipalResolver
  inject: [DbPrincipalResolver],
  useFactory: (principalResolver: DbPrincipalResolver) => ({
    provider: KeycloakProvider.create({ /* … */ }),
    principalResolver,
  }),
});
```

`AuthIdentity` is normalized by the provider: `provider`, `subject` (Keycloak `sub`, Entra `oid`), `tenantId`, `email` (lower-cased), `displayName`, `accountType` (Entra `member`/`guest`), `organizations` (Keycloak Organizations), and the raw `claims`.

The principal is cached per `provider + subject` (`principalCacheTtlMs`); `RoleGuard` never calls the resolver again. Read it in controllers with `@AuthPrincipal()`.

Without a resolver, `request.user` is the decoded token payload and roles come from the token.

## Fine-grained authorization

`@Resource(name)` (class or method) + `@Scopes(...)` delegate the decision to the provider (Keycloak UMA 2.0). A provider without UMA **denies** any route carrying `@Resource` and logs an explicit error — it is never silently allowed. See the Keycloak package for the UMA decision cache.

## OIDC Back-Channel Logout

For providers that support it (Keycloak), mount the endpoint and share the revocation store with `AuthGuard`:

```typescript
import { AuthModule, BackChannelLogoutModule } from '@jaltech/nestjs-auth-core';

const provider = KeycloakProvider.create({ /* … */ });

@Module({
  imports: [
    AuthModule.register({ provider }),
    BackChannelLogoutModule.register({ provider, path: 'auth/backchannel-logout' }),
  ],
})
export class AppModule {}
```

The endpoint validates the `logout_token` (signature, `iss`, `aud`, `iat`, `jti`, the back-channel logout event, `sid`/`sub`, no `nonce`), rejects replays, and revokes the session/subject. `AuthGuard` then answers 401 for any token whose `sid`/`sub` is revoked. Pass a shared `revocationStore` (e.g. Redis) when running several instances. Registering it with a provider that does not support back-channel logout fails at boot.

## Feature matrix

| Feature | Keycloak | Keycloak multi-realm | Entra ID |
|---|---|---|---|
| OFFLINE validation (JWKS) | ✅ | ✅ | ✅ |
| ONLINE validation | ✅ | ❌ (boot error) | ❌ (boot error) |
| Realm/client roles from token | ✅ | ✅ | App roles (`roles` claim) |
| `@Resource` / `@Scopes` (UMA) | ✅ | ❌ (denied) | ❌ (denied) |
| Back-channel logout | ✅ | ✅ | ❌ (boot error) |
| Organizations claim | ✅ | ✅ | — |
| Principal resolver / token source | ✅ | ✅ | ✅ |

## Contributing

```bash
git clone https://github.com/jaltech-io/nestjs-libs.git
cd nestjs-libs
pnpm install
pnpm check   # typecheck + build + package verification + tests with coverage
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and [SECURITY.md](../../SECURITY.md).

## License

MIT © 2026 Jaltech — see [LICENSE](./LICENSE).

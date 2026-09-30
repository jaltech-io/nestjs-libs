# @jaltech/nestjs-auth

[![npm version](https://img.shields.io/npm/v/@jaltech/nestjs-auth)](https://www.npmjs.com/package/@jaltech/nestjs-auth)
[![license](https://img.shields.io/npm/l/@jaltech/nestjs-auth)](./LICENSE)
[![types](https://img.shields.io/npm/types/@jaltech/nestjs-auth)](https://www.npmjs.com/package/@jaltech/nestjs-auth)

> [!WARNING]
> **Pre-release — not production-ready.** This package is under active development (pre-`1.0.0`) and has **not yet been through a human stabilization and review pass**. Its API may change at any time, without a deprecation cycle. It is published for early experimentation and feedback only — **do not use it in production**. This notice will be removed at the `1.0.0` release.

Provider-agnostic authentication and authorization for NestJS. It ships with a Keycloak implementation out of the box — including JWT validation, role-based access, and UMA 2.0 fine-grained authorization — but the guards and decorators depend only on small interfaces, so you can swap Keycloak for Auth0, Okta, or any other JWT provider without touching your application code.

## Features

- **Provider-agnostic core** — guards depend only on the `IAuthInstance` and `IToken` contracts; changing provider means providing new implementations, nothing else.
- **Keycloak implementation included** — offline (JWKS) or online (`/userinfo`) JWT validation.
- **Role-based access** — `@Roles()` with realm and client roles, `ANY`/`ALL` matching.
- **Fine-grained authorization** — `@Resource()` + `@Scopes()` backed by Keycloak UMA 2.0 Authorization Services.
- **UMA decision cache** — per-user, per-permission caching that keeps already-granted decisions available during a Keycloak outage; in-memory by default, or shared via Redis.
- **BFF-friendly** — reads the JWT from an HTTP-only cookie in addition to the `Authorization` header.
- **Dependency-inversion friendly** — every guard is exposed under a DI token and can be replaced without forking the library.

## Requirements

- Node.js >= 20
- NestJS 11 (`@nestjs/common` and `@nestjs/core` `^11.0.0`)
- Peer dependencies:
  - `@nestjs/common` `^11.0.0`
  - `@nestjs/core` `^11.0.0`
  - `reflect-metadata` `^0.2.0`
  - `rxjs` `^7.8.0`
  - `@nestjs/graphql` `^13.0.0` — **optional**, only required if you resolve tokens from a GraphQL execution context

This package is distributed as native ESM (`"type": "module"`).

## Installation

```bash
# pnpm
pnpm add @jaltech/nestjs-auth @nestjs/common @nestjs/core reflect-metadata rxjs

# npm
npm install @jaltech/nestjs-auth @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Quick start

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { KeycloakModule, TokenValidation, PolicyEnforcementMode } from '@jaltech/nestjs-auth';

@Module({
  imports: [
    KeycloakModule.register({
      authServerUrl: process.env.KEYCLOAK_URL!,
      realm: process.env.KEYCLOAK_REALM!,
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      secret: process.env.KEYCLOAK_CLIENT_SECRET!,
      tokenValidation: TokenValidation.OFFLINE,
      policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
      cookieKey: 'KEYCLOAK_JWT', // read the JWT from an HTTP-only cookie (BFF)
    }),
  ],
})
export class AppModule {}
```

`KeycloakModule` registers `AuthGuard`, `RoleGuard`, and `ResourceGuard` as global guards (`APP_GUARD`). From there, controllers are annotated with plain decorators — and stay identical regardless of the provider:

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public, Roles, AuthUser } from '@jaltech/nestjs-auth';

@Controller('users')
@Roles('admin')
export class UserController {
  @Get()
  @Public()
  findAll() { /* ... */ }

  @Get('me')
  @Roles('user')
  getMe(@AuthUser() user: any) { /* ... */ }
}
```

## Internal architecture

```
constants ← types/ (DTOs) ← interface/ (contracts) ← decorators ← services (implementations) ← guards
```

```
interface/   ← method contracts (IAuthInstance, IToken, IUmaCache, KeycloakOptionsFactory…)
types/       ← configuration objects (KeycloakConfig, KeycloakModuleAsyncOptions…)
services/    ← implementations (KeycloakInstance, KeycloakToken)
guards/      ← AuthGuard, RoleGuard, ResourceGuard
decorators/  ← @Public, @Roles, @Resource, @Scopes, @AuthUser, @AccessToken…
```

The guards depend only on the `IAuthInstance` and `IToken` interfaces. Changing provider means providing new implementations of those two interfaces — the guards, decorators, and the rest of the application are untouched.

## Exported DI tokens

| Token | Role |
|---|---|
| `AUTH_GUARD` | Authentication guard (replaceable through DIP) |
| `ROLE_GUARD` | Role-checking guard |
| `RESOURCE_GUARD` | UMA Authorization Services guard |
| `AUTH_INSTANCE` | The `IAuthInstance` implementation (Keycloak, Auth0…) |
| `AUTH_CONNECT_OPTIONS` | The configuration object passed to the module |
| `UMA_CACHE` | UMA decision cache store — optionally provided via `CacheModule.register({ extras })` |

`AUTH_COOKIE_DEFAULT` (`'KEYCLOAK_JWT'`) is also exported as the default cookie name used when `cookieKey` is not set.

## Fine-grained authorization — `@Resource` + `@Scopes`

Per-resource, per-action access control using Keycloak Authorization Services (UMA 2.0).

### Recommended model — four global scopes

| Scope | Usage |
|---|---|
| `READ` | Read, list |
| `CREATE` | Create |
| `UPDATE` | Update |
| `DELETE` | Delete |

Each business entity becomes a Keycloak **Resource**:

```
Device   → READ, CREATE, UPDATE, DELETE
Product  → READ, CREATE, UPDATE, DELETE
Order    → READ, CREATE, UPDATE, DELETE
```

### In controllers

```typescript
@Controller('devices')
@Resource('Device')
export class DeviceController {
  @Get()    @Scopes('READ')   findAll()                          { /* ... */ }
  @Post()   @Scopes('CREATE') create(@Body() dto)                { /* ... */ }
  @Patch()  @Scopes('UPDATE') update(@Param('id') id, @Body() dto) { /* ... */ }
  @Delete() @Scopes('DELETE') remove(@Param('id') id)            { /* ... */ }
}
```

> Tip: enable `verbScopeDefaults: true` in the module config to derive the scope from the HTTP verb (GET/HEAD → READ, POST → CREATE, PUT/PATCH → UPDATE, DELETE → DELETE). A single class-level `@Resource()` then protects an entire CRUD controller without per-handler `@Scopes()`.

### Required Keycloak configuration

**1. Enable Authorization Services**
```
Admin Console → Clients → <clientId> → Settings → Authorization: ON
```

**2. Create the Scopes (once)**
```
Clients → <clientId> → Authorization → Scopes → create: READ, CREATE, UPDATE, DELETE
```

**3. Create the Resources**
```
Authorization → Resources → Device  (4 scopes)
                          → Product (4 scopes)
                          → Order   (4 scopes)
```

**4. Create the Policies**
```
Authorization → Policies → Role Policy
  → "Admin Policy"     : role admin
  → "Viewer Policy"    : role viewer
  → "Moderator Policy" : role moderator
```

**5. Create the Permissions (scope-based)**
```
Device READ   → Admin Policy + Viewer Policy + Moderator Policy
Device CREATE → Admin Policy
Device UPDATE → Admin Policy + Moderator Policy
Device DELETE → Admin Policy
(repeat for each Resource)
```

## UMA decision cache

### The problem without a cache

Every `@Resource @Scopes` request triggers a network call to Keycloak. If Keycloak is temporarily unavailable, **all routes protected by `@Scopes` are denied** — even for perfectly authenticated users.

`@Roles` routes are not affected: they read the JWT claims directly, with no network call.

### The solution — decision caching

`KeycloakInstance` caches UMA decisions per `(user, permissions)`. The key is `sub:permissions`, so Alice's decisions never affect Bob's.

```
Request 1  → Keycloak UP   → UMA call → granted → cached (TTL)
Request 2  → Keycloak DOWN → cache hit → granted, served offline ✓
TTL expired → Keycloak DOWN → cache miss → call fails → denied (fail-closed)
```

```
alice-uuid : Device#READ   → granted, expires in 15 min
alice-uuid : Device#CREATE → denied,  expires in 15 min
bob-uuid   : Device#READ   → granted, expires in 15 min
```

### TTL configuration

```typescript
KeycloakModule.register({
  // ...
  umaCacheTtl: 15 * 60 * 1000, // 15 minutes
})
```

| `umaCacheTtl` value | Behavior |
|---|---|
| `0` | Cache disabled — Keycloak is called on every request |
| `60000` _(default)_ | 1 minute |
| `900000` | 15 minutes — recommended in production |

### Default store — local memory

Without extra configuration, `KeycloakModule` uses an internal `InMemoryUmaCache` (a `Map` with TTL). This is fine for a single-instance deployment.

### Multi-instance deployment — shared Redis cache

Behind a load balancer, each instance has its own independent in-memory cache. To share decisions across instances, back the `UMA_CACHE` token with a Redis store from `@jaltech/nestjs-cache`.

`nestjs-auth` and `nestjs-cache` are **completely independent** — the application wires them together:

```typescript
// app.module.ts — composition root
import { UMA_CACHE, KeycloakModule } from '@jaltech/nestjs-auth';
import { CacheModule } from '@jaltech/nestjs-cache';

@Module({
  imports: [
    CacheModule.register({
      store: { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
      sessionStore: { type: 'redis', url: process.env.REDIS_URL },
      extras: [
        // UMA_CACHE backed by Redis — KeycloakModule injects it automatically
        { provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } },
      ],
    }),
    KeycloakModule.register({
      // ...
      umaCacheTtl: 15 * 60 * 1000,
      // no umaCacheStore here — KeycloakModule injects UMA_CACHE via @Optional()
    }),
  ],
})
export class AppModule {}
```

`KeycloakModule` injects `UMA_CACHE` optionally:

- Token provided (via `extras`) → Redis store, decisions shared across instances.
- Token absent → falls back to `InMemoryUmaCache`, decisions local to the process.

No additional Keycloak configuration is needed — the cache lives entirely on the NestJS side.

## Overriding guards (DIP)

Replace any guard without touching the library:

```typescript
// In development — bypass auth
import { AUTH_GUARD } from '@jaltech/nestjs-auth';
import { DevAuthGuard } from './guards/dev-auth.guard';

@Module({
  providers: [{ provide: AUTH_GUARD, useClass: DevAuthGuard }],
})
export class AppModule {}
```

## Decorators

| Decorator | Description |
|---|---|
| `@Public()` | Bypasses all guards on the route |
| `@Roles(...roles)` | Required roles (realm or client) |
| `@RoleMatchingMode(mode)` | `RoleMatch.ANY` (default) or `RoleMatch.ALL` |
| `@Resource(name)` | Declares the UMA resource (controller or method) |
| `@Scopes(...scopes)` | Required UMA scopes |
| `@ConditionalScopes(fn)` | Scopes computed dynamically from the token |
| `@UseEnforcerOptions(opts)` | Contextual claims for the UMA endpoint |
| `@AuthUser()` | Injects the decoded JWT payload |
| `@AccessToken()` | Injects the raw JWT (for inter-service propagation) |
| `@ResolvedScopes()` | Injects the scopes resolved after evaluation |

```typescript
// @Roles formats
@Roles('admin')              // realm role
@Roles('realm:admin')        // realm role (explicit)
@Roles('my-api:admin')       // client role
@Roles('admin', 'moderator') // several roles (ANY by default)

// Dynamic scopes
@ConditionalScopes((req, token) => {
  if (token.hasRealmRole('admin')) return ['View.All'];
  return ['View'];
})
```

## Backend-for-Frontend (BFF) cookie transport

For a BFF architecture, the browser never handles the JWT directly. Your BFF stores the access token in an HTTP-only cookie, and `AuthGuard` reads the JWT from that cookie (in addition to the `Authorization` header). Set the cookie name with `cookieKey`:

```typescript
KeycloakModule.register({
  // ...
  cookieKey: 'KEYCLOAK_JWT', // defaults to AUTH_COOKIE_DEFAULT ('KEYCLOAK_JWT')
})
```

> This package validates and authorizes requests; it does **not** ship the OIDC login/callback/logout endpoints or a token-refresh interceptor. Those belong to your application (the composition root), which owns the OIDC flow, sets the cookie, and — for server-side sessions — can back its `express-session` store with `@jaltech/nestjs-cache`.

## Internal services

### `KeycloakInstance` — implements `IAuthInstance`

| Method | Description |
|---|---|
| `validateToken()` | OFFLINE validation via jose JWKS — no network call |
| `validateAccessToken()` | ONLINE validation via `/userinfo` — detects immediate revocation |
| `enforcer()` | UMA evaluation — Keycloak call plus decision caching |
| `createGrant()` | Builds a decoded grant from a raw access token |

### `KeycloakToken` — implements `IToken`

```typescript
token.hasRole('admin');                     // realm_access.roles
token.hasRole('my-api:admin');              // resource_access['my-api'].roles
token.hasRealmRole('admin');                // realm_access.roles
token.hasApplicationRole('my-api', 'admin'); // resource_access['my-api'].roles
token.isExpired();                          // checks exp vs Date.now()
```

## `KeycloakConfig` — reference

```typescript
KeycloakModule.register({
  // ── Required ────────────────────────────────────────────────────────────
  authServerUrl: 'http://localhost:8080', // Keycloak base URL (no /auth since KC 17+)
  realm: 'my-realm',
  clientId: 'my-api',
  secret: 'my-secret',

  // ── JWT validation ──────────────────────────────────────────────────────
  tokenValidation: TokenValidation.OFFLINE, // OFFLINE | ONLINE | NONE (default: ONLINE)
  cookieKey: 'KEYCLOAK_JWT',                 // HTTP-only cookie carrying the JWT

  // ── Authorization ───────────────────────────────────────────────────────
  policyEnforcement: PolicyEnforcementMode.PERMISSIVE, // PERMISSIVE | ENFORCING
  verbScopeDefaults: false,                            // derive scope from HTTP verb
  enforcementShadow: false,                            // log-only mode (deny is logged, request allowed)

  // ── UMA decision cache ──────────────────────────────────────────────────
  umaCacheTtl: 15 * 60 * 1000, // TTL in ms (0 = disabled, default: 60000)
  // Store via DI: provide UMA_CACHE in CacheModule.register({ extras: [...] })
})
```

## Switching provider — an Auth0 walkthrough

> The application does not change. Only the infrastructure module is replaced.

### Step 1 — `Auth0Token implements IToken`

```typescript
export class Auth0Token implements IToken {
  constructor(readonly token: string) {
    const [, payload] = token.split('.');
    this.content = JSON.parse(Buffer.from(payload, 'base64url').toString());
  }

  hasRole(role: string): boolean {
    const roles: string[] = this.content['https://myapp.com/roles'] ?? [];
    return roles.includes(role);
  }
  hasRealmRole(role: string) { return this.hasRole(role); }
  hasApplicationRole(app: string, role: string) { return this.hasRole(`${app}:${role}`); }
  isExpired(): boolean { return this.content.exp < Math.floor(Date.now() / 1000); }
}
```

### Step 2 — `Auth0Instance implements IAuthInstance`

```typescript
export class Auth0Instance implements IAuthInstance {
  private readonly JWKS = createRemoteJWKSet(
    new URL(`https://${domain}/.well-known/jwks.json`),
  );

  async validateToken(token: IToken): Promise<IToken | false> {
    try {
      await jwtVerify(token.token, this.JWKS, { issuer: `https://${domain}/`, audience });
      return token;
    } catch { return false; }
  }

  enforcer() { return async (_req, _res, next) => next(); } // wire Auth0 FGA if needed
}
```

### Step 3 — `Auth0Module` wires under the generic DI tokens

```typescript
@Module({})
export class Auth0Module {
  static register(config: Auth0Config): DynamicModule {
    return {
      module: Auth0Module,
      providers: [
        { provide: AUTH_INSTANCE, useValue: new Auth0Instance(config.domain, config.audience) },
        { provide: AUTH_GUARD, useClass: AuthGuard },
        { provide: ROLE_GUARD, useClass: RoleGuard },
        { provide: RESOURCE_GUARD, useClass: ResourceGuard },
        { provide: APP_GUARD, useExisting: AUTH_GUARD },
        { provide: APP_GUARD, useExisting: ROLE_GUARD },
        { provide: APP_GUARD, useExisting: RESOURCE_GUARD },
      ],
    };
  }
}
```

### Step 4 — `app.module.ts` — one line changes

```typescript
// BEFORE
KeycloakModule.register({ authServerUrl, realm, clientId, secret });

// AFTER
Auth0Module.register({ domain: process.env.AUTH0_DOMAIN, audience: process.env.AUTH0_AUDIENCE });
```

**No controller, service, or decorator changes.**

## What never changes when switching provider

| Element | Reason |
|---|---|
| `@Roles`, `@Public`, `@Resource`, `@Scopes`, `@AuthUser` | Pure decorators, provider-agnostic |
| `AuthGuard`, `RoleGuard`, `ResourceGuard` | Depend only on `IAuthInstance` / `IToken` |
| The DIP pattern (`AUTH_GUARD`, `ROLE_GUARD`, `RESOURCE_GUARD`) | Overrides are unchanged |
| All business controllers and services | Zero dependency on the provider |

## Environment variables

The library reads its configuration from the object you pass to `KeycloakModule.register()`. A typical application maps environment variables onto it:

```dotenv
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=my-api
KEYCLOAK_CLIENT_SECRET=your-secret
REDIS_URL=redis://:changeme@localhost:6379
```

## Contributing

This package lives in the [`nestjs-libs`](https://github.com/jaltech-io/nestjs-libs) monorepo.

```bash
git clone https://github.com/jaltech-io/nestjs-libs.git
cd nestjs-libs
pnpm install
pnpm check   # typecheck + build + verify
```

Contributions are welcome — please open an issue to discuss substantial changes first.

## License

[MIT](./LICENSE) © 2026 Jaltech

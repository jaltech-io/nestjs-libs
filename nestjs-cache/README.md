# @jaltech/nestjs-cache

[![npm version](https://img.shields.io/npm/v/@jaltech/nestjs-cache)](https://www.npmjs.com/package/@jaltech/nestjs-cache)
[![license](https://img.shields.io/npm/l/@jaltech/nestjs-cache)](./LICENSE)
[![types](https://img.shields.io/npm/types/@jaltech/nestjs-cache)](https://www.npmjs.com/package/@jaltech/nestjs-cache)

> [!WARNING]
> **Pre-release — not production-ready.** This package is under active development (pre-`1.0.0`) and has **not yet been through a human stabilization and review pass**. Its API may change at any time, without a deprecation cycle. It is published for early experimentation and feedback only — **do not use it in production**. This notice will be removed at the `1.0.0` release.

A cache and session-store abstraction for NestJS. It provides a generic cache (`ICache<T>`) and an `express-session` store (`ISessionStore`), with Redis and in-memory backends created **internally** by `CacheModule`. Your application never sees the concrete classes: it passes **configuration objects**, and the module instantiates the right implementation. This follows the Dependency Inversion Principle (DIP), so backends can be swapped through configuration alone.

## Features

- **Generic cache** — `ICache<T>` with `get` / `set(key, value, ttlMs)`, backed by Redis or in-memory.
- **Session store** — `ISessionStore` for `express-session`, backed by Redis or in-memory.
- **Configuration-driven** — pick a backend with a discriminated union (`{ type: 'redis' | 'memory' }`); no concrete class imports.
- **Sync and async registration** — `register()` and `registerAsync()` (compatible with `ConfigService`).
- **Composition-root friendly** — the `extras` array lets you bind a store under **any** DI token, including tokens defined in other libraries, with zero coupling.
- **Automatic lifecycle** — the session store connects during `onModuleInit`, before the server starts listening.

## Requirements

- Node.js >= 20
- NestJS 11 (`@nestjs/common` `^11.0.0`)
- Peer dependencies:
  - `@nestjs/common` `^11.0.0`
  - `express-session` `^1.18.0`
  - `reflect-metadata` `^0.2.2`
  - `rxjs` `^7.8.0`
- Bundled dependencies (installed automatically): `connect-redis` `^9.0.0`, `ioredis` `^5.10.1`, `redis` `^5.12.1`

## Installation

```bash
# pnpm
pnpm add @jaltech/nestjs-cache @nestjs/common express-session reflect-metadata rxjs

# npm
npm install @jaltech/nestjs-cache @nestjs/common express-session reflect-metadata rxjs
```

## Quick start

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@jaltech/nestjs-cache';

@Module({
  imports: [
    CacheModule.register({
      store: { type: 'redis', url: process.env.REDIS_URL!, namespace: 'app' },
      sessionStore: { type: 'redis', url: process.env.REDIS_URL! },
    }),
  ],
})
export class AppModule {}
```

```typescript
// any.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_STORE, type ICache } from '@jaltech/nestjs-cache';

@Injectable()
export class MyService {
  constructor(@Inject(CACHE_STORE) private readonly cache: ICache<MyData>) {}

  async getData(key: string): Promise<MyData | null> {
    return this.cache.get(key);
  }

  async setData(key: string, value: MyData): Promise<void> {
    await this.cache.set(key, value, 60_000); // TTL 60 s
  }
}
```

## Design principle — DIP

```
app.module.ts          → CacheModule.register({ store: { type: 'redis', url: '...' } })
                                  ↓
CacheModule            → creates RedisCache / InMemoryCache internally
                                  ↓
CACHE_STORE (DI token) → injected throughout the application
```

The application imports only:

- `CacheModule` — the NestJS module
- `CACHE_STORE`, `SESSION_STORE` — the DI tokens
- `ICache`, `ISessionStore` — the interfaces (contracts)
- The configuration types (`CacheConfig`, `CacheStoreConfig`, `SessionStoreConfig`)

It **never** imports `RedisCache`, `InMemoryCache`, `RedisSessionStore`, or `MemorySessionStore`.

### Interface / types separation

```
interface/   ← method contracts       (ICache, ISessionStore, ICacheOptionsFactory)
types/       ← configuration objects  (CacheConfig, CacheStoreConfig, SessionStoreConfig, CacheExtra)
services/    ← internal implementations (RedisCache, InMemoryCache) — never re-exported
session/     ← internal implementations (RedisSessionStore, MemorySessionStore) — never re-exported
```

## Public API

```typescript
import {
  // Module
  CacheModule,

  // DI tokens
  CACHE_STORE,
  SESSION_STORE,

  // Interfaces (contracts)
  ICache,
  ISessionStore,
  ICacheOptionsFactory,

  // Configuration types
  CacheConfig,
  CacheStoreConfig,
  SessionStoreConfig,
  CacheExtra,
  CacheModuleAsyncOptions,
} from '@jaltech/nestjs-cache';
```

## Configuration

### `CacheStoreConfig` — discriminated union

```typescript
type CacheStoreConfig =
  | { type: 'memory' }
  | { type: 'redis'; url: string; namespace?: string };
```

- `type: 'memory'` → `InMemoryCache` (`Map` + TTL, local to the process)
- `type: 'redis'` → `RedisCache` via ioredis — `url` supports a password (`redis://:pwd@host:port`)
- `namespace` → prefix for Redis keys (avoids collisions between stores on the same Redis instance)

### `SessionStoreConfig` — discriminated union

```typescript
type SessionStoreConfig =
  | { type: 'memory' }
  | { type: 'redis'; url: string };
```

- `type: 'memory'` → `MemorySessionStore` (dev/test only — data lost on restart)
- `type: 'redis'` → `RedisSessionStore` via `redis` + `connect-redis`

## Registering the module

### Static registration

```typescript
import { CacheModule } from '@jaltech/nestjs-cache';

CacheModule.register({
  store: { type: 'redis', url: process.env.REDIS_URL!, namespace: 'app' },
  sessionStore: { type: 'redis', url: process.env.REDIS_URL! },
});
```

### Async registration (compatible with `ConfigService`)

```typescript
CacheModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    store: { type: 'redis', url: config.get('REDIS_URL'), namespace: 'app' },
    sessionStore: { type: 'redis', url: config.get('REDIS_URL') },
  }),
  inject: [ConfigService],
});
```

### In-memory (dev / test)

```typescript
CacheModule.register({
  store: { type: 'memory' },
  sessionStore: { type: 'memory' },
});
```

## DI tokens

### `CACHE_STORE`

Injects the configured `ICache<T>` implementation (see the quick-start example above).

### `SESSION_STORE`

Retrieved in `main.ts` for `express-session`. The store is connected automatically by `CacheModule.onModuleInit()`.

```typescript
// main.ts
import { ISessionStore, SESSION_STORE } from '@jaltech/nestjs-cache';
import session from 'express-session';

const sessionStore = app.get<ISessionStore>(SESSION_STORE);

app.use(session({
  store: sessionStore.getStore(),
  secret: process.env.SESSION_SECRET ?? 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax', maxAge: 300_000 },
}));
```

## Extras — composition root

The `extras` array binds a store under **any** DI token — including tokens defined in other libraries — without `nestjs-cache` knowing anything about those tokens. Because `CacheModule` is global, the extra tokens are available throughout the DI container.

```typescript
// app.module.ts — example with the UMA_CACHE token from @jaltech/nestjs-auth
import { UMA_CACHE } from '@jaltech/nestjs-auth';

CacheModule.register({
  store: { type: 'redis', url: process.env.REDIS_URL!, namespace: 'app' },
  sessionStore: { type: 'redis', url: process.env.REDIS_URL! },
  extras: [
    { provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL!, namespace: 'uma' } },
  ],
});
```

`nestjs-auth` and `nestjs-cache` are unaware of each other. The application (`app.module.ts`) is the only place that knows both — this is the **composition root**.

```
nestjs-auth   ──────────────────────────┐
                                         ▼
                                  app.module.ts  ← composition root
                                         ▲
nestjs-cache  ──────────────────────────┘
```

## Interfaces

### `ICache<T>`

```typescript
interface ICache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlMs: number): Promise<void>;
}
```

Any custom implementation (Memcached, DynamoDB, Valkey…) can implement this contract and be provided through DI without touching the application.

### `ISessionStore`

```typescript
interface ISessionStore {
  connect(): Promise<void>;
  getStore(): any; // express-session compatible Store
}
```

`connect()` is called automatically by `CacheModule.onModuleInit()`.

## Session store lifecycle

`CacheModule` implements `OnModuleInit`. NestJS calls it before `app.listen()`.

```
NestFactory.create(AppModule)
    → CacheModule.onModuleInit()
        → sessionStore.connect()   ← Redis session connected
    → app.listen()
        → main.ts reads SESSION_STORE from DI
        → app.use(session({ store: sessionStore.getStore() }))
```

The injection is optional: if no `sessionStore` is configured, `onModuleInit` does nothing.

## Internal implementations (not exported)

| Class | Description | Recommended use |
|---|---|---|
| `InMemoryCache<T>` | `Map` + TTL + auto eviction | Dev, test, single-instance deployment |
| `RedisCache<T>` | ioredis + JSON + namespace | Production, multi-instance |
| `MemorySessionStore` | `express-session` MemoryStore | Dev only |
| `RedisSessionStore` | `redis` + `connect-redis` | Production BFF |

These classes are **not** part of the public API. If you need a custom implementation, implement `ICache<T>` or `ISessionStore` and provide it directly under the matching token.

## Full example — `app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@jaltech/nestjs-cache';
import { UMA_CACHE, KeycloakModule, TokenValidation, PolicyEnforcementMode } from '@jaltech/nestjs-auth';

@Module({
  imports: [
    CacheModule.register({
      // General application store
      store: { type: 'redis', url: process.env.REDIS_URL!, namespace: 'app' },

      // BFF session store (HTTP-only cookie)
      sessionStore: { type: 'redis', url: process.env.REDIS_URL! },

      // UMA store for nestjs-auth — dedicated namespace, zero coupling between the libraries
      extras: [
        { provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL!, namespace: 'uma' } },
      ],
    }),

    KeycloakModule.register({
      authServerUrl: process.env.KEYCLOAK_URL!,
      realm: process.env.KEYCLOAK_REALM!,
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      secret: process.env.KEYCLOAK_CLIENT_SECRET!,
      policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
      tokenValidation: TokenValidation.OFFLINE,
      cookieKey: 'KEYCLOAK_JWT',
      umaCacheTtl: 15 * 60 * 1000,
      // no umaCacheStore here — KeycloakModule injects UMA_CACHE automatically
    }),
  ],
})
export class AppModule {}
```

## Environment variables

```dotenv
REDIS_URL=redis://:changeme@localhost:6379
```

The `redis://:password@host:port` syntax is supported natively by ioredis and by the official `redis` client.

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

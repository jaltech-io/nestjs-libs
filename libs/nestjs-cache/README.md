# @jaltech/nestjs-cache

<!-- test: retest deploy:nestjs-cache after friendly no-tag error message fix -->

Librairie NestJS d'abstraction du cache et des sessions.  
Fournit un cache générique (`ICache<T>`) et un store de session `express-session` (`ISessionStore`) — implémentations Redis ou mémoire créées **en interne** par `CacheModule`.

L'application ne connaît jamais les classes concrètes. Elle passe des **objets de configuration** ; le module instancie.

---

## Principe de conception

### Règle fondamentale — DIP (Dependency Inversion Principle)

```
app.module.ts          → CacheModule.register({ store: { type: 'redis', url: '...' } })
                                  ↓
CacheModule            → crée RedisCache / InMemoryCache en interne
                                  ↓
CACHE_STORE (token DI) → injecté partout dans l'application
```

L'application importe uniquement :
- `CacheModule` — le module NestJS
- `CACHE_STORE`, `SESSION_STORE` — les tokens DI
- `ICache`, `ISessionStore` — les interfaces (contrats)
- Les types de configuration (`CacheStoreConfig`, `SessionStoreConfig`, `CacheConfig`)

Elle n'importe **jamais** `RedisCache`, `InMemoryCache`, `RedisSessionStore`, `MemorySessionStore`.

### Séparation interface / types

```
interface/   ← contrats avec méthodes  (ICache, ISessionStore, ICacheOptionsFactory)
types/       ← objets de configuration (CacheConfig, CacheStoreConfig, SessionStoreConfig, CacheExtra)
services/    ← implémentations internes (RedisCache, InMemoryCache) — jamais exportées dans l'app
session/     ← implémentations internes (RedisSessionStore, MemorySessionStore) — jamais exportées
```

---

## Structure de la lib

```
libs/nestjs-cache/src/
├── CacheModule.ts            Module NestJS (register / registerAsync / onModuleInit)
├── constants.ts              Tokens DI : CACHE_STORE, SESSION_STORE, CACHE_OPTIONS
├── index.ts                  API publique
│
├── interface/
│   ├── ICache.ts             Contrat du cache générique
│   ├── ISessionStore.ts      Contrat du store de session
│   └── ICacheOptionsFactory.ts  Contrat factory async
│
├── types/
│   ├── CacheConfig.ts        CacheStoreConfig, SessionStoreConfig, CacheExtra, CacheConfig
│   └── CacheModuleAsyncOptions.ts
│
├── services/
│   ├── InMemoryCache.ts      Cache en mémoire avec TTL (Map + eviction)
│   └── RedisCache.ts         Cache Redis via ioredis (JSON + PX)
│
└── session/
    ├── MemorySessionStore.ts  Session en mémoire (dev/test uniquement)
    └── RedisSessionStore.ts   Session Redis via redis + connect-redis
```

---

## Installation

```bash
pnpm add @jaltech/nestjs-cache @nestjs/common express-session reflect-metadata rxjs
```

Dans ce monorepo, le code source reste résolu par l'alias de chemin historique défini dans `tsconfig.base.json` :

```json
"paths": {
  "nestjs-cache": ["libs/nestjs-cache/src/index.ts"]
}
```

---

## API publique

```typescript
import {
    // Module
    CacheModule,

    // Tokens DI
    CACHE_STORE,
    SESSION_STORE,

    // Interfaces (contrats)
    ICache,
    ISessionStore,
    ICacheOptionsFactory,

    // Types de configuration
    CacheConfig,
    CacheStoreConfig,
    SessionStoreConfig,
    CacheExtra,
    CacheModuleAsyncOptions,
} from '@jaltech/nestjs-cache';
```

---

## Configuration

### `CacheStoreConfig` — union discriminante

```typescript
type CacheStoreConfig =
    | { type: 'memory' }
    | { type: 'redis'; url: string; namespace?: string };
```

- `type: 'memory'` → `InMemoryCache` (Map + TTL, locale au process)
- `type: 'redis'` → `RedisCache` via ioredis — `url` supporte le mot de passe (`redis://:pwd@host:port`)
- `namespace` → préfixe des clés Redis (évite les collisions entre stores sur la même instance Redis)

### `SessionStoreConfig` — union discriminante

```typescript
type SessionStoreConfig =
    | { type: 'memory' }
    | { type: 'redis'; url: string };
```

- `type: 'memory'` → `MemorySessionStore` (dev/test uniquement — données perdues au redémarrage)
- `type: 'redis'` → `RedisSessionStore` via `redis` + `connect-redis`

---

## CacheModule

### Enregistrement statique

```typescript
// app.module.ts
import { CacheModule } from '@jaltech/nestjs-cache';

@Module({
    imports: [
        CacheModule.register({
            store:        { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
            sessionStore: { type: 'redis', url: process.env.REDIS_URL },
        }),
    ],
})
export class AppModule {}
```

### Enregistrement asynchrone (compatible `ConfigService`)

```typescript
CacheModule.registerAsync({
    imports:    [ConfigModule],
    useFactory: (config: ConfigService) => ({
        store:        { type: 'redis', url: config.get('REDIS_URL'), namespace: 'app' },
        sessionStore: { type: 'redis', url: config.get('REDIS_URL') },
    }),
    inject: [ConfigService],
})
```

### Mémoire (dev / test)

```typescript
CacheModule.register({
    store:        { type: 'memory' },
    sessionStore: { type: 'memory' },
})
```

---

## Tokens DI

### `CACHE_STORE`

Injecte l'implémentation de `ICache<T>` configurée.

```typescript
import { CACHE_STORE, ICache } from '@jaltech/nestjs-cache';
import { Inject }              from '@nestjs/common';

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

### `SESSION_STORE`

Récupéré dans `main.ts` pour `express-session`. Connecté automatiquement par `CacheModule.onModuleInit()`.

```typescript
// main.ts
import { ISessionStore, SESSION_STORE } from '@jaltech/nestjs-cache';
import session from 'express-session';

const sessionStore = app.get<ISessionStore>(SESSION_STORE);

app.use(session({
    store:             sessionStore.getStore(),
    secret:            process.env.SESSION_SECRET ?? 'dev-secret',
    resave:            false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax', maxAge: 300_000 },
}));
```

---

## Extras — composition root

Le tableau `extras` permet de brancher un store sous **n'importe quel token DI** — y compris des tokens définis dans d'autres libs — sans que `nestjs-cache` connaisse ces tokens.

`CacheModule` étant global, les tokens extras sont disponibles dans tout le conteneur DI.

```typescript
// app.module.ts — exemple avec le token UMA_CACHE de nestjs-auth
import { UMA_CACHE } from '@jaltech/nestjs-auth';

CacheModule.register({
    store:        { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
    sessionStore: { type: 'redis', url: process.env.REDIS_URL },
    extras: [
        {
            provide: UMA_CACHE,
            config:  { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' },
        },
    ],
})
```

`nestjs-auth` et `nestjs-cache` s'ignorent mutuellement. L'app (`app.module.ts`) est le seul endroit qui connaît les deux — c'est le **Composition Root**.

```
nestjs-auth   ──────────────────────────┐
                                         ▼
                                  app.module.ts  ← composition root
                                         ▲
nestjs-cache  ──────────────────────────┘
```

---

## Interfaces

### `ICache<T>`

```typescript
interface ICache<T> {
    get(key: string): Promise<T | null>;
    set(key: string, value: T, ttlMs: number): Promise<void>;
}
```

Toute implémentation custom (Memcached, DynamoDB, Valkey…) implémente ce contrat et peut être fournie via la DI sans toucher à l'application.

### `ISessionStore`

```typescript
interface ISessionStore {
    connect(): Promise<void>;
    getStore(): any; // compatible express-session Store
}
```

`connect()` est appelé automatiquement par `CacheModule.onModuleInit()`.

---

## Connexion du session store — cycle de vie

`CacheModule` implémente `OnModuleInit`. NestJS l'appelle avant `app.listen()`.

```
NestFactory.create(AppModule)
    → CacheModule.onModuleInit()
        → sessionStore.connect()   ← Redis session connecté
    → app.listen()
        → main.ts récupère SESSION_STORE depuis le DI
        → app.use(session({ store: sessionStore.getStore() }))
```

L'injection est `@Optional()` : si aucun `sessionStore` n'est configuré, `onModuleInit` ne fait rien.

---

## Variables d'environnement

```dotenv
REDIS_URL=redis://:changeme@localhost:6379
```

La syntaxe `redis://:password@host:port` est supportée nativement par ioredis et par le client `redis` officiel.

---

## Implémentations internes (non exportées)

| Classe | Description | Usage recommandé |
|---|---|---|
| `InMemoryCache<T>` | `Map` + TTL + eviction auto | Dev, test, déploiement mono-instance |
| `RedisCache<T>` | ioredis + JSON + namespace | Production, multi-instances |
| `MemorySessionStore` | `express-session` MemoryStore | Dev uniquement |
| `RedisSessionStore` | `redis` + `connect-redis` | Production BFF |

Ces classes ne sont **pas** dans l'API publique (`index.ts`). Si tu as besoin d'une implémentation custom, implémente `ICache<T>` ou `ISessionStore` et fournis-la directement sous le token correspondant.

---

## Exemple complet — app.module.ts

```typescript
import { Module }    from '@nestjs/common';
import { CacheModule } from '@jaltech/nestjs-cache';
import { UMA_CACHE, KeycloakModule, TokenValidation, PolicyEnforcementMode } from '@jaltech/nestjs-auth';

@Module({
    imports: [
        CacheModule.register({
            // Store général de l'app
            store: { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },

            // Store de session BFF (HTTP-only cookie)
            sessionStore: { type: 'redis', url: process.env.REDIS_URL },

            // Store UMA pour nestjs-auth — namespace dédié, zéro couplage entre les libs
            extras: [
                { provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } },
            ],
        }),

        KeycloakModule.register({
            authServerUrl:     process.env.KEYCLOAK_URL,
            realm:             process.env.KEYCLOAK_REALM,
            clientId:          process.env.KEYCLOAK_CLIENT_ID,
            secret:            process.env.KEYCLOAK_CLIENT_SECRET,
            policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
            tokenValidation:   TokenValidation.OFFLINE,
            cookieKey:         'KEYCLOAK_JWT',
            umaCacheTtl:       15 * 60 * 1000,
            // ← pas de umaCacheStore ici — KeycloakModule injecte UMA_CACHE automatiquement
        }),
    ],
})
export class AppModule {}
```

# @jaltech/nestjs-auth

Librairie NestJS d'authentification, conçue pour être **provider-agnostic**.  
Fonctionne avec Keycloak par défaut — remplaçable par Auth0, Okta, ou tout autre provider JWT sans toucher à l'application.

---

## Installation

```bash
pnpm add @jaltech/nestjs-auth @nestjs/common @nestjs/core reflect-metadata rxjs
```

Node.js 20 ou supérieur est requis. Le paquet est distribué en ESM natif.

---

## Architecture interne

```
constants ← types/ (DTOs) ← interface/ (contrats) ← decorators ← services (implémentations) ← guards
```

```
interface/   ← contrats avec méthodes (IAuthInstance, IToken, IUmaCache, KeycloakOptionsFactory…)
types/       ← objets de configuration (KeycloakConfig, KeycloakModuleAsyncOptions…)
services/    ← implémentations (KeycloakInstance, KeycloakToken)
guards/      ← AuthGuard, RoleGuard, ResourceGuard
decorators/  ← @Public, @Roles, @Resource, @Scopes, @AuthUser, @AccessToken…
```

Les guards ne dépendent que des interfaces `IAuthInstance` et `IToken`.  
Changer de provider = fournir de nouvelles implémentations de ces interfaces.  
Les guards, décorateurs, et toute l'application restent inchangés.

---

## Tokens DI exportés

| Token | Rôle |
|---|---|
| `AUTH_GUARD` | Guard d'authentification (remplaçable via DIP) |
| `ROLE_GUARD` | Guard de vérification des rôles |
| `RESOURCE_GUARD` | Guard UMA Authorization Services |
| `AUTH_INSTANCE` | Instance `IAuthInstance` (Keycloak, Auth0…) |
| `AUTH_CONNECT_OPTIONS` | Configuration passée au module |
| `UMA_CACHE` | Store de cache des décisions UMA — fourni par `CacheModule.register({ extras })` |

---

## Utilisation avec Keycloak

```typescript
// app.module.ts
import { KeycloakModule, TokenValidation, PolicyEnforcementMode } from '@jaltech/nestjs-auth';

@Module({
    imports: [
        KeycloakModule.register({
            authServerUrl:     process.env.KEYCLOAK_URL,
            realm:             process.env.KEYCLOAK_REALM,
            clientId:          process.env.KEYCLOAK_CLIENT_ID,
            secret:            process.env.KEYCLOAK_CLIENT_SECRET,
            policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
            tokenValidation:   TokenValidation.OFFLINE,
            cookieKey:         'KEYCLOAK_JWT',  // BFF HTTP-only cookie
        }),
    ],
})
export class AppModule {}
```

```typescript
// N'importe quel controller — inchangé quel que soit le provider
@Controller('users')
@Roles('admin')
export class UserController {
    @Get()
    @Public()
    findAll() { ... }

    @Get('me')
    @Roles('user')
    getMe(@AuthUser() user: any) { ... }
}
```

---

## Autorisations fines — `@Resource` + `@Scopes`

Contrôle d'accès **par ressource et par action** via le protocole UMA 2.0 de Keycloak Authorization Services.

### Modèle recommandé — 4 scopes globaux

| Scope | Usage |
|---|---|
| `READ` | Lecture, liste |
| `CREATE` | Création |
| `UPDATE` | Modification |
| `DELETE` | Suppression |

Chaque entité métier devient une **Resource** Keycloak :

```
Device   → READ, CREATE, UPDATE, DELETE
Product  → READ, CREATE, UPDATE, DELETE
Order    → READ, CREATE, UPDATE, DELETE
```

### Dans les controllers

```typescript
@Controller('devices')
@Resource('Device')
export class DeviceController {
    @Get()    @Scopes('READ')   findAll()                      { ... }
    @Post()   @Scopes('CREATE') create(@Body() dto)            { ... }
    @Patch()  @Scopes('UPDATE') update(@Param('id') id, @Body() dto) { ... }
    @Delete() @Scopes('DELETE') remove(@Param('id') id)        { ... }
}
```

### Configuration Keycloak requise

**1. Activer Authorization Services**
```
Admin Console → Clients → <clientId> → Settings → Authorization: ON
```

**2. Créer les Scopes (une seule fois)**
```
Clients → <clientId> → Authorization → Scopes → Créer : READ, CREATE, UPDATE, DELETE
```

**3. Créer les Resources**
```
Authorization → Resources → Device  (4 scopes)
                          → Product (4 scopes)
                          → Order   (4 scopes)
```

**4. Créer les Policies**
```
Authorization → Policies → Role Policy
  → "Admin Policy"     : rôle admin
  → "Viewer Policy"    : rôle viewer
  → "Moderator Policy" : rôle moderator
```

**5. Créer les Permissions (Scope-based)**
```
Device READ   → Admin Policy + Viewer Policy + Moderator Policy
Device CREATE → Admin Policy
Device UPDATE → Admin Policy + Moderator Policy
Device DELETE → Admin Policy
(répéter pour chaque Resource)
```

---

## Cache des décisions UMA

### Le problème sans cache

Chaque requête `@Resource @Scopes` déclenche un appel réseau vers Keycloak.  
Si Keycloak est temporairement indisponible, **toutes les routes protégées par `@Scopes` sont refusées**, même pour des utilisateurs parfaitement authentifiés.

Les routes `@Roles` ne sont pas affectées — elles lisent directement les claims JWT, sans appel réseau.

### La solution — cache des décisions

`KeycloakInstance` met en cache les décisions UMA par `(utilisateur, permissions)`.  
La clé est `sub:permissions` — les décisions de Alice n'affectent jamais celles de Bob.

```
Requête 1  → Keycloak UP   → appel UMA → accordé → cache (TTL)
Requête 2  → Keycloak DOWN → cache hit → accordé servi offline ✓
TTL expiré → Keycloak DOWN → cache miss → appel échoue → refusé (fail-closed)
```

```
alice-uuid : Device#READ   → granted, expire dans 15 min
alice-uuid : Device#CREATE → denied,  expire dans 15 min
bob-uuid   : Device#READ   → granted, expire dans 15 min
```

### Configuration du TTL

```typescript
KeycloakModule.register({
    ...
    umaCacheTtl: 15 * 60 * 1000,  // 15 minutes
})
```

| Valeur `umaCacheTtl` | Comportement |
|---|---|
| `0` | Cache désactivé — Keycloak appelé à chaque requête |
| `60_000` _(défaut)_ | 1 minute |
| `900_000` | 15 minutes — recommandé en production |

### Store par défaut — mémoire locale

Sans configuration supplémentaire, `KeycloakModule` utilise un `InMemoryUmaCache` interne (Map + TTL).  
Convient pour un déploiement mono-instance.

### Déploiement multi-instances — cache Redis partagé

Derrière un load balancer, chaque instance a son propre cache mémoire indépendant.  
Pour partager les décisions : brancher un store Redis via le token `UMA_CACHE` et `CacheModule`.

`nestjs-auth` et `nestjs-cache` sont **complètement indépendants** — l'app fait le lien :

```typescript
// app.module.ts — composition root
import { UMA_CACHE, KeycloakModule }  from '@jaltech/nestjs-auth';
import { CacheModule }               from '@jaltech/nestjs-cache';

@Module({
    imports: [
        CacheModule.register({
            store:        { type: 'redis', url: process.env.REDIS_URL, namespace: 'app' },
            sessionStore: { type: 'redis', url: process.env.REDIS_URL },
            extras: [
                // UMA_CACHE branché sur Redis — KeycloakModule l'injecte automatiquement
                { provide: UMA_CACHE, config: { type: 'redis', url: process.env.REDIS_URL, namespace: 'uma' } },
            ],
        }),
        KeycloakModule.register({
            ...
            umaCacheTtl: 15 * 60 * 1000,
            // ← pas de umaCacheStore — KeycloakModule injecte UMA_CACHE via @Optional()
        }),
    ],
})
export class AppModule {}
```

`KeycloakModule` injecte `UMA_CACHE` via `@Optional()` :
- Token fourni (via `extras`) → store Redis, décisions partagées entre instances
- Token absent → fallback `InMemoryUmaCache`, décisions locales au process

Aucune configuration Keycloak supplémentaire n'est nécessaire — le cache est 100% côté NestJS.

---

## Pattern DIP — override des guards

Remplacer n'importe quel guard sans toucher à la lib :

```typescript
// En développement — bypass auth
import { AUTH_GUARD } from '@jaltech/nestjs-auth';
import { DevAuthGuard } from './guards/dev-auth.guard';

@Module({
    providers: [
        { provide: AUTH_GUARD, useClass: DevAuthGuard }
    ],
})
export class AppModule {}
```

---

## Décorateurs

| Décorateur | Description |
|---|---|
| `@Public()` | Bypass tous les guards sur la route |
| `@Roles(...roles)` | Rôles requis (realm ou client) |
| `@RoleMatchingMode(mode)` | `RoleMatch.ANY` (défaut) ou `RoleMatch.ALL` |
| `@Resource(name)` | Déclare la resource UMA (contrôleur ou méthode) |
| `@Scopes(...scopes)` | Scopes UMA requis |
| `@ConditionalScopes(fn)` | Scopes calculés dynamiquement selon le token |
| `@UseEnforcerOptions(opts)` | Claims contextuels pour l'endpoint UMA |
| `@AuthUser()` | Injecte le payload JWT décodé |
| `@AccessToken()` | Injecte le JWT brut (propagation inter-services) |
| `@ResolvedScopes()` | Injecte les scopes résolus après évaluation |

```typescript
// Exemples de formats @Roles
@Roles('admin')                    // rôle realm
@Roles('realm:admin')              // rôle realm (explicite)
@Roles('hz-api:horizon_admin')     // rôle client
@Roles('admin', 'moderator')       // plusieurs rôles

// Scopes dynamiques
@ConditionalScopes((req, token) => {
    if (token.hasRealmRole('admin')) return ['View.All'];
    return ['View'];
})
```

---

## Module BFF (Back For Front)

`AuthModule` expose automatiquement les routes OIDC :

| Route | Description |
|---|---|
| `GET /auth/login` | Génère le state PKCE, redirige vers Keycloak |
| `GET /auth/callback` | Échange le code PKCE contre les tokens, pose le cookie |
| `GET /auth/refresh` | Rafraîchit l'access token via le refresh token |
| `GET /auth/logout` | Supprime les cookies, redirige vers Keycloak logout |
| `GET /auth/me` | Retourne les infos de l'utilisateur connecté |

`TokenRefreshInterceptor` — Rafraîchit automatiquement l'access token s'il expire dans moins de 60 secondes.

```typescript
// app.module.ts — activer le BFF
import { AuthModule } from './auth/auth.module';  // module local qui wrape AuthModule de nestjs-auth

imports: [
    KeycloakModule.register({ cookieKey: 'KEYCLOAK_JWT', ... }),
    AuthModule,
]
```

Requiert `nestjs-cache` avec `sessionStore` configuré (Redis en production, Memory en dev).

---

## Services internes

### `KeycloakInstance` — implémente `IAuthInstance`

| Méthode | Description |
|---|---|
| `validateToken()` | Validation OFFLINE via jose JWKS — pas d'appel réseau |
| `validateAccessToken()` | Validation ONLINE via `/userinfo` — révocation immédiate |
| `enforcer()` | Évaluation UMA — appel Keycloak + cache des décisions |

### `KeycloakToken` — implémente `IToken`

```typescript
token.hasRole('admin')                      // realm_access.roles
token.hasRole('hz-api:admin')               // resource_access.hz-api.roles
token.hasRealmRole('admin')                 // realm_access.roles
token.hasApplicationRole('hz-api', 'admin') // resource_access.hz-api.roles
token.isExpired()                           // vérifie exp vs Date.now()
```

---

## `KeycloakConfig` — référence complète

```typescript
KeycloakModule.register({
    // ── Requis ──────────────────────────────────────────────────────────────
    authServerUrl:     'http://localhost:8080',  // URL Keycloak (sans /auth depuis KC17+)
    realm:             'my-realm',
    clientId:          'my-api',
    secret:            'my-secret',

    // ── Validation JWT ───────────────────────────────────────────────────────
    tokenValidation:   TokenValidation.OFFLINE,  // OFFLINE | ONLINE | NONE
    cookieKey:         'KEYCLOAK_JWT',           // BFF uniquement

    // ── Authorization ────────────────────────────────────────────────────────
    policyEnforcement: PolicyEnforcementMode.PERMISSIVE, // PERMISSIVE | ENFORCING

    // ── Cache UMA ────────────────────────────────────────────────────────────
    umaCacheTtl:       15 * 60 * 1000,  // TTL en ms (0 = désactivé, défaut: 60 000)
    // Store via DI : fournir UMA_CACHE dans CacheModule.register({ extras: [...] })
})
```

---

## Changer de provider — scénario Auth0

> L'application ne change pas. Seul le module d'infrastructure est remplacé.

### Étape 1 — `Auth0Token implements IToken`

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

### Étape 2 — `Auth0Instance implements IAuthInstance`

```typescript
export class Auth0Instance implements IAuthInstance {
    private readonly JWKS = createRemoteJWKSet(
        new URL(`https://${domain}/.well-known/jwks.json`)
    );

    async validateToken(token: IToken): Promise<IToken | false> {
        try {
            await jwtVerify(token.token, this.JWKS, { issuer: `https://${domain}/`, audience });
            return token;
        } catch { return false; }
    }

    enforcer() { return async (_req, _res, next) => next(); } // Auth0 FGA si nécessaire
}
```

### Étape 3 — `Auth0Module` câble sous les tokens DI génériques

```typescript
@Module({})
export class Auth0Module {
    static register(config: Auth0Config): DynamicModule {
        return {
            module: Auth0Module,
            providers: [
                { provide: AUTH_INSTANCE, useValue: new Auth0Instance(config.domain, config.audience) },
                { provide: AUTH_GUARD,     useClass: AuthGuard },
                { provide: ROLE_GUARD,     useClass: RoleGuard },
                { provide: RESOURCE_GUARD, useClass: ResourceGuard },
                { provide: APP_GUARD, useExisting: AUTH_GUARD },
                { provide: APP_GUARD, useExisting: ROLE_GUARD },
                { provide: APP_GUARD, useExisting: RESOURCE_GUARD },
            ],
        };
    }
}
```

### Étape 4 — `app.module.ts` — 1 ligne change

```typescript
// AVANT
KeycloakModule.register({ authServerUrl, realm, clientId, secret })

// APRÈS
Auth0Module.register({ domain: process.env.AUTH0_DOMAIN, audience: process.env.AUTH0_AUDIENCE })
```

**Aucun controller, service, ou décorateur ne change.**

| Étape | Effort estimé |
|---|---|
| `Auth0Token` | ~30 min |
| `Auth0Instance` | ~1h30 |
| `Auth0Module` | ~30 min |
| `app.module.ts` | ~2 min |
| **Total** | **~2h30** |

---

## Variables d'environnement

```dotenv
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=my-api
KEYCLOAK_CLIENT_SECRET=your-secret
REDIS_URL=redis://:changeme@localhost:6379
SESSION_SECRET=change-me-in-production
FRONTEND_URL=http://localhost:4200
PORT=3000
NODE_ENV=development
```

---

## Ce qui ne change jamais lors d'un changement de provider

| Élément | Raison |
|---|---|
| `@Roles`, `@Public`, `@Resource`, `@Scopes`, `@AuthUser` | Décorateurs purs, provider-agnostic |
| `AuthGuard`, `RoleGuard`, `ResourceGuard` | Ne dépendent que de `IAuthInstance` / `IToken` |
| Pattern DIP (`AUTH_GUARD`, `ROLE_GUARD`, `RESOURCE_GUARD`) | Override inchangé |
| Tous les controllers et services métier | Zéro dépendance au provider |

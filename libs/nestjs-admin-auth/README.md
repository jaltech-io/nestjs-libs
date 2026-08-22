# @profeskills/nestjs-admin-auth

Module NestJS pour administrer les utilisateurs, groupes, sessions et rôles client d'un realm Keycloak via son Admin REST API.

Le paquet expose des contrats et des tokens d'injection afin que l'application ne dépende pas directement de l'implémentation Keycloak.

## Prérequis

- Node.js 20 ou supérieur
- NestJS 11
- Un client Keycloak confidentiel avec les rôles de service account nécessaires à l'administration du realm

## Installation

Installez le paquet public depuis npm avec ses peer dependencies :

```bash
npm install @profeskills/nestjs-admin-auth \
  @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Configuration

```typescript
import { Module } from '@nestjs/common';
import { AdminAuthModule } from '@profeskills/nestjs-admin-auth';

@Module({
  imports: [
    AdminAuthModule.register({
      authServerUrl: process.env.KEYCLOAK_URL!,
      realm: process.env.KEYCLOAK_REALM!,
      clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET!,
      sendEmails: process.env.KEYCLOAK_SEND_EMAILS === 'true',
    }),
  ],
})
export class AppModule {}
```

## Injection des services

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_GROUPS,
  ADMIN_USERS,
  type IAdminGroups,
  type IAdminUsers,
  type KcSession,
} from '@profeskills/nestjs-admin-auth';

@Injectable()
export class IdentityAdministrationService {
  constructor(
    @Inject(ADMIN_USERS) private readonly users: IAdminUsers,
    @Inject(ADMIN_GROUPS) private readonly groups: IAdminGroups,
  ) {}

  listSessions(userId: string): Promise<KcSession[]> {
    return this.users.listSessions(userId);
  }
}
```

### API publique

- `AdminAuthModule`
- `ADMIN_USERS` et `IAdminUsers`
- `ADMIN_GROUPS` et `IAdminGroups`
- `AdminAuthConfig`
- `CreateUserInput`, `KcSession`, `GroupInfo` et `GroupMember`

Les classes Keycloak concrètes restent internes au paquet.

## Développement

Depuis la racine du monorepo :

```bash
nx typecheck nestjs-admin-auth
nx build nestjs-admin-auth
npm pack ./dist/libs/nestjs-admin-auth --dry-run
```

Le build CommonJS et ses déclarations TypeScript sont générés dans `dist/libs/nestjs-admin-auth`.

## Licence

[MIT](./LICENSE) © 2026 ProfesSkills

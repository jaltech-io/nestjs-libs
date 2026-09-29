# @jaltech/nestjs-admin-auth

[![npm version](https://img.shields.io/npm/v/@jaltech/nestjs-admin-auth)](https://www.npmjs.com/package/@jaltech/nestjs-admin-auth)
[![license](https://img.shields.io/npm/l/@jaltech/nestjs-admin-auth)](./LICENSE)
[![types](https://img.shields.io/npm/types/@jaltech/nestjs-admin-auth)](https://www.npmjs.com/package/@jaltech/nestjs-admin-auth)

> [!WARNING]
> **Pre-release — not production-ready.** This package is under active development (pre-`1.0.0`) and has **not yet been through a human stabilization and review pass**. Its API may change at any time, without a deprecation cycle. It is published for early experimentation and feedback only — **do not use it in production**. This notice will be removed at the `1.0.0` release.

A NestJS module for administering a Keycloak realm through its Admin REST API: users, groups, sessions, client roles, and Authorization Services. The package exposes contracts and DI tokens so your application depends on interfaces rather than on the concrete Keycloak implementation.

## Features

- **Users** — create, list, update profile, set password, send invitation email, add/remove group membership, delete.
- **Sessions** — list a user's active sessions and revoke them individually.
- **Groups** — create root and nested groups, find-or-create by name, list members, assign/remove client roles, delete.
- **Client roles** — create roles and compose them (`ensureCompositeRole`).
- **Authorization Services** — idempotent management of scopes, resources, role policies, and scope-based permissions (via the `ADMIN_AUTHZ` token).
- **Interface-first** — the concrete Keycloak classes stay internal; you inject `IAdminUsers`, `IAdminGroups`, and `IAdminAuthz`.

## Requirements

- Node.js >= 20
- NestJS 11 (`@nestjs/common` and `@nestjs/core` `^11.0.0`)
- Peer dependencies:
  - `@nestjs/common` `^11.0.0`
  - `@nestjs/core` `^11.0.0`
  - `reflect-metadata` `^0.2.0`
  - `rxjs` `^7.8.0`
- A confidential Keycloak client whose service account holds the realm-management roles required for the operations you use.

## Installation

```bash
# pnpm
pnpm add @jaltech/nestjs-admin-auth @nestjs/common @nestjs/core reflect-metadata rxjs

# npm
npm install @jaltech/nestjs-admin-auth @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Quick start

Register the module with your Keycloak admin client credentials:

```typescript
import { Module } from '@nestjs/common';
import { AdminAuthModule } from '@jaltech/nestjs-admin-auth';

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

Then inject the services by their DI tokens:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_GROUPS,
  ADMIN_USERS,
  type IAdminGroups,
  type IAdminUsers,
  type KcSession,
} from '@jaltech/nestjs-admin-auth';

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

## API

The public API is limited to contracts and tokens — the concrete Keycloak classes remain internal to the package.

| Export | Kind | Purpose |
|---|---|---|
| `AdminAuthModule` | Module | Registers the admin services |
| `ADMIN_USERS` / `IAdminUsers` | Token / interface | User and session administration |
| `ADMIN_GROUPS` / `IAdminGroups` | Token / interface | Group and client-role administration |
| `ADMIN_AUTHZ` / `IAdminAuthz` | Token / interface | Authorization Services administration (idempotent) |
| `AdminAuthConfig` | Type | Module configuration |
| `CreateUserInput`, `KcSession` | Types | User inputs and session shape |
| `GroupInfo`, `GroupMember` | Types | Group listing shapes |
| `AuthzScope`, `AuthzResource`, `AuthzPolicy`, `AuthzPermission`, `EnsureResourceInput` | Types | Authorization Services shapes |

### `IAdminUsers`

`createUser`, `listUsers`, `setPassword`, `sendInvitationEmail`, `addToGroup`, `removeFromGroup`, `updateProfile`, `deleteUser`, `listSessions`, `revokeSession`, `createRole`, `ensureCompositeRole`.

### `IAdminGroups`

`createGroup` (root or nested via `parentId`), `findGroupByName`, `assignRole`, `removeRole`, `deleteGroup`, `listGroups`, `listMembers`.

### `IAdminAuthz`

Idempotent management of the client's Authorization Services: `ensureAuthorizationEnabled`, `ensureDecisionStrategy`, `ensureScope`, `ensureResource`, `ensureRolePolicy`, `setResourcePermissions` (a scope × policies matrix, denying by default when no policy is set), plus the matching `list*`/`find*`/`delete*` operations. The `ensure*` methods are safe to run repeatedly, which makes them suitable for seeding.

## Contributing

This package lives in the [`nestjs-libs`](https://github.com/jaltech-io/nestjs-libs) monorepo.

```bash
git clone https://github.com/jaltech-io/nestjs-libs.git
cd nestjs-libs
pnpm install
pnpm check   # typecheck + build + verify
```

The package builds to CommonJS with TypeScript declarations. Contributions are welcome — please open an issue to discuss substantial changes first.

## License

[MIT](./LICENSE) © 2026 Jaltech

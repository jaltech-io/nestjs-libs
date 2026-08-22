import { type DynamicModule, Module } from '@nestjs/common';
import { ADMIN_AUTH_OPTIONS, ADMIN_GROUPS, ADMIN_USERS } from './constants';
import { KcAdminClient } from './services/KcAdminClient';
import { KcAdminGroups } from './services/KcAdminGroups';
import { KcAdminUsers } from './services/KcAdminUsers';
import type { AdminAuthConfig } from './types/AdminAuthConfig';

/**
 * Module NestJS pour l'administration des utilisateurs et groupes Keycloak.
 *
 * Fournit deux tokens DI consommables par l'application :
 *   - `ADMIN_USERS`  → `IAdminUsers`  (CRUD users + gestion groupes côté user)
 *   - `ADMIN_GROUPS` → `IAdminGroups` (CRUD groupes + assignation de rôles realm)
 *
 * L'app dépend uniquement des tokens et interfaces (jamais de KcAdminUsers/KcAdminGroups).
 * Pour swapper l'implémentation (ex: Auth0), fournir une autre classe derrière les tokens.
 *
 * @example
 * AdminAuthModule.register({
 *   authServerUrl: process.env.KEYCLOAK_URL,
 *   realm:         process.env.KEYCLOAK_REALM,
 *   clientId:      process.env.KEYCLOAK_CLIENT_ID,      // admin-api
 *   clientSecret:  process.env.KEYCLOAK_CLIENT_SECRET,
 *   sendEmails:    process.env.KEYCLOAK_SEND_EMAILS === 'true',
 * })
 */
@Module({})
export class AdminAuthModule {
  static register(config: AdminAuthConfig): DynamicModule {
    return {
      module: AdminAuthModule,
      global: true, // un seul import suffit (AppModule) — partout sans ré-import
      providers: [
        { provide: ADMIN_AUTH_OPTIONS, useValue: config },
        KcAdminClient,
        { provide: ADMIN_USERS, useClass: KcAdminUsers },
        { provide: ADMIN_GROUPS, useClass: KcAdminGroups },
      ],
      exports: [ADMIN_USERS, ADMIN_GROUPS],
    };
  }
}

// ── nestjs-admin-auth — API publique ─────────────────────────────────────────
// L'app consommatrice ne dépend QUE de ce fichier.
// Les implémentations concrètes (KcAdminUsers, KcAdminGroups, KcAdminClient)
// ne sont jamais exposées — seules les interfaces et les tokens le sont.

// Module
export { AdminAuthModule } from './AdminAuthModule';

// Tokens DI (à utiliser avec @Inject(...) dans les services de l'app)
export { ADMIN_GROUPS, ADMIN_USERS } from './constants';
export type { GroupInfo, GroupMember, IAdminGroups } from './interface/IAdminGroups';
// Interfaces (typer les injections dans l'app)
export type { CreateUserInput, IAdminUsers, KcSession } from './interface/IAdminUsers';

// Types de configuration
export type { AdminAuthConfig } from './types/AdminAuthConfig';

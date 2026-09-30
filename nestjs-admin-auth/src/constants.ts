/** Token DI : configuration injectée dans le module */
export const ADMIN_AUTH_OPTIONS = 'ADMIN_AUTH_OPTIONS';

/** Token DI : implémentation IAdminUsers (Keycloak par défaut, swappable) */
export const ADMIN_USERS = 'ADMIN_USERS';

/** Token DI : implémentation IAdminGroups (Keycloak par défaut, swappable) */
export const ADMIN_GROUPS = 'ADMIN_GROUPS';

/** Token DI : implémentation IAdminAuthz (Authorization Services, swappable) */
export const ADMIN_AUTHZ = 'ADMIN_AUTHZ';

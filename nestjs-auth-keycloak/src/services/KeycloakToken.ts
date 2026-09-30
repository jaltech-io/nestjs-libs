import type { IToken } from '@jaltech/nestjs-auth-core';
import { parseToken } from '../utils/parseToken';

/**
 * Implémentation Keycloak de `IToken`.
 *
 * Lit les rôles depuis `realm_access` (rôles realm) et `resource_access[client]`
 * (rôles client).
 */
export class KeycloakToken implements IToken {
  readonly content: Record<string, any>;

  constructor(readonly token: string) {
    this.content = parseToken(token);
  }

  /**
   * Vérifie la présence d'un rôle.
   * - `'admin'` ou `'realm:admin'` → `realm_access.roles`
   * - `'my-api:admin'` → `resource_access['my-api'].roles`
   */
  hasRole(role: string): boolean {
    if (role.indexOf(':') >= 0) {
      const [resource, roleName] = role.split(':');
      if (resource === 'realm') {
        return (this.content.realm_access?.roles ?? []).includes(roleName);
      }
      return (this.content.resource_access?.[resource]?.roles ?? []).includes(roleName);
    }
    return (this.content.realm_access?.roles ?? []).includes(role);
  }

  /** Vérifie un rôle realm dans `realm_access.roles`. */
  hasRealmRole(role: string): boolean {
    return (this.content.realm_access?.roles ?? []).includes(role);
  }

  /** Vérifie un rôle dans `resource_access[appName].roles`. */
  hasApplicationRole(appName: string, role: string): boolean {
    return (this.content.resource_access?.[appName]?.roles ?? []).includes(role);
  }

  /** Retourne `true` si `exp` est dépassé. */
  isExpired(): boolean {
    return this.content.exp < Math.floor(Date.now() / 1000);
  }
}

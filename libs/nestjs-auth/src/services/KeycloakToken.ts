import type { IToken } from '../interface/IToken';
import { parseToken } from '../utils/ParseTokenUtil';

/**
 * Implémentation Keycloak de `IToken`.
 *
 * Décode le payload JWT Keycloak et expose les méthodes de vérification des rôles
 * en lisant les claims `realm_access` et `resource_access`.
 */
export class KeycloakToken implements IToken {
  readonly content: Record<string, any>;

  /**
   * @param token - JWT brut signé par Keycloak.
   */
  constructor(readonly token: string) {
    this.content = parseToken(token);
  }

  /**
   * Vérifie la présence d'un rôle dans le token.
   *
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

  /** Vérifie la présence d'un rôle realm dans `realm_access.roles`. */
  hasRealmRole(role: string): boolean {
    return (this.content.realm_access?.roles ?? []).includes(role);
  }

  /**
   * Vérifie la présence d'un rôle dans `resource_access[appName].roles`.
   *
   * @param appName - Client ID Keycloak (ex: `'my-api'`).
   * @param role    - Nom du rôle à vérifier.
   */
  hasApplicationRole(appName: string, role: string): boolean {
    return (this.content.resource_access?.[appName]?.roles ?? []).includes(role);
  }

  /** Retourne `true` si le champ `exp` du payload est dépassé. */
  isExpired(): boolean {
    return this.content.exp < Math.floor(Date.now() / 1000);
  }
}

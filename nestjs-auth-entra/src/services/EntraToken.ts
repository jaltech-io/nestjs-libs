import type { IToken } from '@jaltech/nestjs-auth-core';
import { parseToken } from '../utils/parseToken';
import type { ResolvedEntraConfig } from '../types/EntraConfig';

/**
 * Implémentation Entra ID de `IToken`.
 *
 * Les rôles proviennent du claim `roleClaim` (défaut `roles`) — des App Roles Entra.
 * Entra ne modélise pas les rôles realm/client comme Keycloak :
 * `hasRealmRole` est un alias de `hasRole` ; `hasApplicationRole(app, role)` ne
 * répond `true` que si `app === clientId`.
 */
export class EntraToken implements IToken {
  readonly content: Record<string, any>;

  /**
   * @param token         - JWT brut Entra.
   * @param config        - Configuration Entra résolue.
   * @param resolvedRoles - Rôles déjà résolus (prioritaires sur le claim), optionnel.
   */
  constructor(
    readonly token: string,
    private readonly config: ResolvedEntraConfig,
    private readonly resolvedRoles?: string[],
  ) {
    this.content = parseToken(token);
  }

  /** Rôles effectifs : rôles résolus s'ils existent, sinon le claim configuré. */
  private roles(): string[] {
    if (this.resolvedRoles) return this.resolvedRoles;
    const claim = this.content[this.config.roleClaim];
    return Array.isArray(claim) ? claim : [];
  }

  /** Vérifie la présence d'un rôle applicatif. */
  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  /** Alias de `hasRole` (Entra n'a pas de notion de rôle « realm »). */
  hasRealmRole(role: string): boolean {
    return this.hasRole(role);
  }

  /** `true` uniquement si `appName === clientId` et que le rôle est présent. */
  hasApplicationRole(appName: string, role: string): boolean {
    return appName === this.config.clientId ? this.hasRole(role) : false;
  }

  /** `true` si `exp` est dépassé. */
  isExpired(): boolean {
    return this.content.exp < Math.floor(Date.now() / 1000);
  }
}

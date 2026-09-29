import type { AuthIdentity } from '../types/AuthIdentity';
import type { AuthPrincipal } from '../types/AuthPrincipal';

/**
 * Contrat de résolution d'un principal applicatif à partir d'une identité.
 *
 * Appelé par l'`AuthGuard` après validation du token. Le principal retourné est
 * positionné sur `request.user` ; ses `roles` remplacent les rôles du token.
 *
 * Lever `ForbiddenException` pour refuser l'accès (→ 403). Toute autre exception
 * est traitée comme un refus fail-closed (→ 401).
 */
export interface IPrincipalResolver {
  /**
   * Résout le principal applicatif.
   *
   * @param identity - Identité normalisée issue de `IAuthInstance.toIdentity`.
   * @returns Le principal applicatif (rôles inclus).
   * @throws ForbiddenException pour refuser explicitement (403).
   */
  resolve(identity: AuthIdentity): Promise<AuthPrincipal> | AuthPrincipal;
}

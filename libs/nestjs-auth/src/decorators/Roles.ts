import { SetMetadata } from '@nestjs/common';
import type { RoleMatch } from '../constants';

export const META_ROLES = 'roles';
export const META_ROLE_MATCHING_MODE = 'role-matching-mode';

/**
 * Déclare les rôles requis pour accéder à une route ou un contrôleur.
 * Évalué par le `RoleGuard`.
 *
 * Formats acceptés :
 * - `'admin'`          — rôle realm
 * - `'realm:admin'`    — rôle realm (explicite)
 * - `'my-api:admin'`   — rôle d'un client spécifique
 *
 * @example
 * @Roles('admin', 'moderator')
 * @RoleMatchingMode(RoleMatch.ANY)
 * findAll() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(META_ROLES, roles);

/**
 * Définit si tous les rôles (`ALL`) ou au moins un (`ANY`) doit être présent.
 * Défaut : `ANY`.
 *
 * @example
 * @Roles('admin', 'moderator')
 * @RoleMatchingMode(RoleMatch.ALL)  // admin ET moderator requis
 * sensitiveAction() { ... }
 */
export const RoleMatchingMode = (mode: RoleMatch) => SetMetadata(META_ROLE_MATCHING_MODE, mode);

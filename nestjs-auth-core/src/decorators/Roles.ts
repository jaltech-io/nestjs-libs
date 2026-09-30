import { SetMetadata } from '@nestjs/common';
import type { RoleMatch } from '../constants';

export const META_ROLES = 'roles';
export const META_ROLE_MATCHING_MODE = 'role-matching-mode';

/**
 * Déclare les rôles requis pour accéder à une route ou un contrôleur.
 * Évalué par le `RoleGuard` sur les rôles du token (ou du principal résolu).
 */
export const Roles = (...roles: string[]) => SetMetadata(META_ROLES, roles);

/**
 * Définit si tous les rôles (`ALL`) ou au moins un (`ANY`) doivent être présents.
 * Défaut : `ANY`.
 */
export const RoleMatchingMode = (mode: RoleMatch) => SetMetadata(META_ROLE_MATCHING_MODE, mode);

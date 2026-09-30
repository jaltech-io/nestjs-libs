import { SetMetadata } from '@nestjs/common';

export const META_PUBLIC = 'public';

/**
 * Marque une route ou un contrôleur comme public.
 *
 * Les guards `AuthGuard`, `RoleGuard` et `ResourceGuard` autorisent la requête
 * même en l'absence de token valide.
 *
 * @example
 * @Get('health')
 * @Public()
 * healthCheck() { ... }
 */
export const Public = () => SetMetadata(META_PUBLIC, true);

import { SetMetadata } from '@nestjs/common';

export const META_PUBLIC = 'public';

/**
 * Marque une route ou un contrôleur comme public : les guards autorisent la
 * requête même sans token valide.
 */
export const Public = () => SetMetadata(META_PUBLIC, true);

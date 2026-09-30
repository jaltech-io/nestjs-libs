import { SetMetadata } from '@nestjs/common';

export const META_RESOURCE = 'resource';

/**
 * Déclare la ressource UMA protégée par le `ResourceGuard`.
 * S'utilise au niveau du contrôleur ou de la méthode, combiné avec `@Scopes()`.
 *
 * La valeur doit correspondre exactement au nom de la ressource configurée
 * dans Keycloak Authorization Services.
 *
 * @example
 * @Controller('products')
 * @Resource('Product')
 * export class ProductController {
 *   @Get()
 *   @Scopes('View')
 *   findAll() { ... }
 * }
 */
export const Resource = (resource: string) => SetMetadata(META_RESOURCE, resource);

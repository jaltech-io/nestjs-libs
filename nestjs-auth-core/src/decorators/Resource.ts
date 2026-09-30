import { SetMetadata } from '@nestjs/common';

export const META_RESOURCE = 'resource';

/**
 * Déclare la ressource UMA protégée par le `ResourceGuard`, au niveau contrôleur
 * ou méthode, combiné avec `@Scopes()`.
 *
 * Un provider sans capacité UMA fait échouer la requête (fail-closed) + log d'erreur.
 */
export const Resource = (resource: string) => SetMetadata(META_RESOURCE, resource);

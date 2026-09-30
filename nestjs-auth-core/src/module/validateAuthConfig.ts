import { TokenValidation } from '../constants';
import type { IAuthInstance } from '../interface/IAuthInstance';
import type { AuthConfig } from '../types/AuthConfig';

/**
 * Valide la cohérence configuration ⇄ capacités du provider AU BOOT (fail-fast).
 *
 * Lève une erreur explicite plutôt que d'échouer silencieusement à la première requête :
 * - `ONLINE` demandé alors que le provider ne le supporte pas.
 *
 * (Le cas `@Resource` sur un provider sans UMA est appliqué en fail-closed par le
 * `ResourceGuard` à l'exécution, car il dépend des métadonnées de chaque route.)
 *
 * @throws Error si la configuration est incohérente.
 */
export function validateAuthConfig(config: AuthConfig, instance: IAuthInstance): void {
  if (config.tokenValidation === TokenValidation.ONLINE && !instance.capabilities.online) {
    throw new Error(
      'AuthModule: tokenValidation=ONLINE requires a provider that supports online validation (/userinfo). ' +
        'The configured provider does not. Use TokenValidation.OFFLINE instead.',
    );
  }
}

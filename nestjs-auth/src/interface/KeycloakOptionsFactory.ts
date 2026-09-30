import type { KeycloakConfig } from '../types/index';

/**
 * Contrat d'une factory de configuration Keycloak pour `KeycloakModule.registerAsync()`.
 *
 * Implémenter cette interface dans un service NestJS permet d'injecter
 * des dépendances (ex: `ConfigService`) pour construire la configuration dynamiquement.
 *
 * @example
 * @Injectable()
 * class KeycloakConfigService implements KeycloakOptionsFactory {
 *   constructor(private config: ConfigService) {}
 *
 *   createKeycloakOptions(): KeycloakConfig {
 *     return {
 *       authServerUrl: this.config.get('KEYCLOAK_URL'),
 *       realm:         this.config.get('KEYCLOAK_REALM'),
 *       clientId:      this.config.get('KEYCLOAK_CLIENT_ID'),
 *       secret:        this.config.get('KEYCLOAK_SECRET'),
 *     };
 *   }
 * }
 */
export interface KeycloakOptionsFactory {
  createKeycloakOptions(): Promise<KeycloakConfig> | KeycloakConfig;
}

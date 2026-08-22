import type { ModuleMetadata, Type } from '@nestjs/common';
import type { KeycloakOptionsFactory } from '../interface/KeycloakOptionsFactory';
import type { KeycloakConfig } from './KeycloakConfig';

/**
 * Options pour `KeycloakModule.registerAsync()`.
 *
 * Trois stratégies disponibles :
 * - `useFactory`  — fonction inline avec injection de dépendances.
 * - `useExisting` — réutilise un service déjà fourni dans le module parent.
 * - `useClass`    — instancie un service implémentant `KeycloakOptionsFactory`.
 *
 * @example
 * KeycloakModule.registerAsync({
 *   imports:    [ConfigModule],
 *   useFactory: (config: ConfigService) => ({ authServerUrl: config.get('KC_URL'), ... }),
 *   inject:     [ConfigService],
 * })
 */
export type KeycloakModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  /** Dépendances injectées dans `useFactory`. */
  inject?: any[];
  /** Service existant dans le module parent implémentant `KeycloakOptionsFactory`. */
  useExisting?: Type<KeycloakOptionsFactory>;
  /** Classe instanciée par NestJS et implémentant `KeycloakOptionsFactory`. */
  useClass?: Type<KeycloakOptionsFactory>;
  /** Fonction retournant la configuration, avec injection de dépendances. */
  useFactory?: (...args: any[]) => Promise<KeycloakConfig> | KeycloakConfig;
};

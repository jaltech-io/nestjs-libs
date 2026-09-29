import type { IAuthInstance } from '../interface/IAuthInstance';
import type { IBackChannelLogoutValidator } from '../interface/IBackChannelLogout';

/**
 * Descripteur d'un provider d'authentification, produit par une fabrique de provider
 * (ex. `KeycloakProvider.create(config)`, `EntraProvider.create(config)`).
 *
 * Passé à `AuthModule.register({ provider })`. Le module lie `instance` sous le
 * token `AUTH_INSTANCE` et lit `instance.capabilities` pour la validation au boot.
 */
export type AuthProvider = {
  /** Identifiant du provider (ex. `'keycloak'`, `'entra'`). */
  readonly name: string;
  /** Instance implémentant le contrat `IAuthInstance`. */
  readonly instance: IAuthInstance;
  /**
   * Validateur de Back-Channel Logout, présent uniquement si le provider supporte
   * la capacité (`instance.capabilities.backChannelLogout === true`).
   */
  readonly backChannelLogout?: IBackChannelLogoutValidator;
};

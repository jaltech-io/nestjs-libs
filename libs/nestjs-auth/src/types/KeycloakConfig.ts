import type { AuthConfig } from './AuthConfig';

/**
 * Identifiants d'un client Keycloak confidentiel.
 * Utilisés pour les scénarios nécessitant uniquement le secret (ex: introspection).
 */
export type KeycloakCredentials = {
  /** Secret du client Keycloak (confidentiel). */
  secret: string;
};

/**
 * Configuration complète pour le provider Keycloak.
 * Étend `AuthConfig` avec les paramètres spécifiques au realm et au client.
 *
 * @example
 * KeycloakModule.register({
 *   authServerUrl: 'http://localhost:8080',
 *   realm:         'my-realm',
 *   clientId:      'my-api',
 *   secret:        'my-secret',
 *   tokenValidation: TokenValidation.OFFLINE,
 * })
 */
export type KeycloakConfig = AuthConfig & {
  /** URL de base du serveur Keycloak. Ex : `http://localhost:8080`. */
  authServerUrl: string;
  /** Nom du realm Keycloak. Ex : `my-realm`. */
  realm: string;
  /** Client ID de l'application enregistrée dans Keycloak. */
  clientId: string;
  /** Secret du client (clients confidentiels uniquement). */
  secret: string;
  /** Client public — ne possède pas de secret. Défaut : `false`. */
  publicClient?: boolean;
  /** Mode bearer-only — valide les tokens sans gérer le flux de connexion. Défaut : `false`. */
  bearerOnly?: boolean;
  /** Clé publique du realm pour la validation JWT offline sans requête JWKS. */
  realmPublicKey?: string;
  /**
   * Durée de vie du cache des décisions UMA en millisecondes. Défaut : `60000` (1 min).
   *
   * Chaque décision Keycloak (`@Resource @Scopes`) est mise en cache par utilisateur
   * et par permission. Pendant une coupure de Keycloak, les décisions déjà connues
   * continuent d'être servies jusqu'à expiration du cache.
   *
   * Mettre à `0` pour désactiver le cache (toujours interroger Keycloak).
   *
   * Le store est fourni via le token DI `UMA_CACHE` (voir `CacheModule.register({ extras })`).
   * Par défaut : `InMemoryUmaCache` (mémoire locale, non partagée entre instances).
   */
  umaCacheTtl?: number;
  /** Vérifie que l'audience du token correspond au `clientId`. Défaut : `false`. */
  verifyTokenAudience?: boolean;
  /** Intervalle minimum entre deux requêtes JWKS (secondes). Défaut : `10`. */
  minTimeBetweenJwksRequests?: number;
  /** Port confidentiel Keycloak. */
  confidentialPort?: string | number;
  /** SSL requis. Valeurs possibles : `'external'`, `'all'`, `'none'`. */
  sslRequired?: string;
};

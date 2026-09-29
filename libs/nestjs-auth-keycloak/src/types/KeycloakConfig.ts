import type { IUmaCache } from '@jaltech/nestjs-auth-core';

/**
 * Configuration du provider Keycloak, passée à `KeycloakProvider.create()`.
 *
 * Ne contient QUE les options propres à Keycloak. Les options d'authentification
 * transverses (`tokenValidation`, `roleMerge`, `policyEnforcement`, `cookieKey`,
 * `principalCacheTtlMs`…) sont fournies à `AuthModule.register()`.
 */
export type KeycloakConfig = {
  /** URL de base du serveur Keycloak. Ex. `http://localhost:8080`. */
  authServerUrl: string;
  /** Nom du realm Keycloak. */
  realm: string;
  /** Client ID de l'application (audience UMA). */
  clientId: string;
  /** Secret du client confidentiel (optionnel ; non requis pour la validation bearer/UMA). */
  secret?: string;

  /**
   * Vérifie que l'audience du token correspond au `clientId`. Défaut : `false`.
   *
   * Quand activé : accepte le token si `aud` contient `clientId` OU si `azp === clientId`
   * (Keycloak place souvent le client dans `azp` et `account` dans `aud`).
   *
   * @recommended Passer à `true` en production (voir la note de migration du README).
   */
  verifyTokenAudience?: boolean;

  /**
   * Rejette les tokens sans aucune organisation (Keycloak Organizations 26+, claim
   * `organization`). Recommandé pour le multi-tenant à grande échelle. Défaut : `false`.
   */
  requireOrganization?: boolean;

  /** TTL du cache des décisions UMA (ms). Défaut : `60000`. `0` = cache désactivé. */
  umaCacheTtl?: number;
  /** Store de cache UMA (Redis-capable). Défaut : cache mémoire local. */
  umaCacheStore?: IUmaCache;

  /**
   * Clé publique du realm (corps base64 SPKI/X.509) pour valider les JWT en local
   * sans requête JWKS. Wire une clé locale à la place du JWKS distant.
   */
  realmPublicKey?: string;
  /** Intervalle minimum entre deux requêtes JWKS (secondes). Wire le cooldown JWKS. Défaut : `30`. */
  minTimeBetweenJwksRequests?: number;

  /** @deprecated Sans effet sur la validation bearer/UMA — émet un avertissement au boot. */
  bearerOnly?: boolean;
  /** @deprecated Sans effet — émet un avertissement au boot. */
  publicClient?: boolean;
  /** @deprecated Sans effet — émet un avertissement au boot. */
  confidentialPort?: string | number;
  /** @deprecated Sans effet — émet un avertissement au boot. */
  sslRequired?: string;
};

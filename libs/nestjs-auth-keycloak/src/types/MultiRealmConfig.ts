import type { KeycloakRealmConfig, KeycloakRealmResolver } from './RealmConfig';

/**
 * Options de `KeycloakProvider.createMultiRealm()` — multi-tenant par realm.
 *
 * Deux modes de résolution, tous deux fail-closed (issuer inconnu ⇒ 401) :
 * - STATIC : `realms` (allowlist explicite, petit nombre de realms).
 * - DYNAMIC : `resolveRealm` (résolveur applicatif, ex. base de données) — passe à l'échelle.
 *
 * Pour des centaines de tenants, préférer un seul realm + Keycloak Organizations
 * (`requireOrganization`) plutôt que multiplier les realms.
 */
export type KeycloakMultiRealmOptions = {
  /** Allowlist statique de realms (mode STATIC). */
  realms?: KeycloakRealmConfig[];
  /** Résolveur applicatif de realm (mode DYNAMIC). */
  resolveRealm?: KeycloakRealmResolver;

  /** TTL du cache positif du résolveur (ms). Défaut : `300000`. */
  resolverCacheTtlMs?: number;
  /** TTL du cache négatif du résolveur (ms). Défaut : `30000`. */
  resolverNegativeCacheTtlMs?: number;
  /** Taille max du cache LRU des JWKS sets (borne mémoire). Défaut : `100`. */
  jwksCacheMax?: number;
  /** Nombre max d'appels résolveur pour issuers inconnus par fenêtre. Défaut : `100`. */
  maxUnknownResolvesPerWindow?: number;
  /** Fenêtre du limiteur d'issuers inconnus (ms). Défaut : `60000`. */
  unknownWindowMs?: number;
  /** Intervalle minimum entre requêtes JWKS (secondes) → cooldown JWKS. Défaut : `30`. */
  minTimeBetweenJwksRequests?: number;

  /** Défaut de vérification d'audience appliqué aux realms qui ne le précisent pas. Défaut : `false`. */
  verifyTokenAudience?: boolean;
  /** Défaut d'exigence d'organisation appliqué aux realms qui ne le précisent pas. Défaut : `false`. */
  requireOrganization?: boolean;
};

/** Ré-export pratique. */
export type { KeycloakRealmConfig, KeycloakRealmResolver };

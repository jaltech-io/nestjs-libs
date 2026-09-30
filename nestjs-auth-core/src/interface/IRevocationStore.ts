/**
 * Contrat du store de révocation de sessions/sujets et des instants `notBefore`.
 *
 * Alimenté par le Back-Channel Logout ; consulté par l'`AuthGuard` pour rejeter
 * (401) un token dont la session (`sid`) ou le sujet (`sub`) a été révoqué, ou
 * dont l'`iat` précède le `notBefore` du realm.
 *
 * Même mécanisme de store que les autres caches : mémoire par défaut, Redis-capable.
 * Les TTL doivent couvrir la durée de vie maximale d'un token.
 */
export interface IRevocationStore {
  /** Révoque une session par `sid` jusqu'à `expiresAt` (epoch ms). */
  revokeSid(sid: string, expiresAt: number): Promise<void>;
  /** Révoque tous les tokens d'un sujet (`provider:sub`) jusqu'à `expiresAt` (epoch ms). */
  revokeSubject(provider: string, subject: string, expiresAt: number): Promise<void>;
  /** `true` si la session `sid` est révoquée et non expirée. */
  isSidRevoked(sid: string): Promise<boolean>;
  /** `true` si le sujet `provider:sub` est révoqué et non expiré. */
  isSubjectRevoked(provider: string, subject: string): Promise<boolean>;

  /** Positionne l'instant `notBefore` (epoch s) d'un realm/issuer. */
  setNotBefore(realmKey: string, epochSeconds: number): Promise<void>;
  /** Retourne l'instant `notBefore` (epoch s) d'un realm/issuer, `null` si aucun. */
  getNotBefore(realmKey: string): Promise<number | null>;

  /**
   * Enregistre un `jti` de logout_token pour la protection anti-rejeu.
   * @returns `true` si nouveau (accepté), `false` si déjà vu (rejeu).
   */
  registerJti(jti: string, expiresAt: number): Promise<boolean>;
}

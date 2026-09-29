import type { IRevocationStore } from '../interface/IRevocationStore';

/**
 * Store de révocation en mémoire (Map + TTL, instance unique).
 *
 * Par défaut du `BackChannelLogoutModule`. Pour un déploiement multi-instances,
 * fournir une implémentation Redis partagée (les révocations doivent être vues
 * par toutes les instances).
 */
export class InMemoryRevocationStore implements IRevocationStore {
  private readonly sids = new Map<string, number>();
  private readonly subjects = new Map<string, number>();
  private readonly jtis = new Map<string, number>();
  private readonly notBefore = new Map<string, number>();

  async revokeSid(sid: string, expiresAt: number): Promise<void> {
    this.sids.set(sid, expiresAt);
    this.evict();
  }

  async revokeSubject(provider: string, subject: string, expiresAt: number): Promise<void> {
    this.subjects.set(`${provider}:${subject}`, expiresAt);
    this.evict();
  }

  async isSidRevoked(sid: string): Promise<boolean> {
    return this.isLive(this.sids, sid);
  }

  async isSubjectRevoked(provider: string, subject: string): Promise<boolean> {
    return this.isLive(this.subjects, `${provider}:${subject}`);
  }

  async setNotBefore(realmKey: string, epochSeconds: number): Promise<void> {
    const current = this.notBefore.get(realmKey);
    if (current === undefined || epochSeconds > current) this.notBefore.set(realmKey, epochSeconds);
  }

  async getNotBefore(realmKey: string): Promise<number | null> {
    return this.notBefore.get(realmKey) ?? null;
  }

  async registerJti(jti: string, expiresAt: number): Promise<boolean> {
    if (this.isLive(this.jtis, jti)) return false;
    this.jtis.set(jti, expiresAt);
    this.evict();
    return true;
  }

  private isLive(map: Map<string, number>, key: string): boolean {
    const expiresAt = map.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      map.delete(key);
      return false;
    }
    return true;
  }

  private evict(): void {
    const now = Date.now();
    for (const map of [this.sids, this.subjects, this.jtis]) {
      for (const [key, expiresAt] of map) {
        if (expiresAt <= now) map.delete(key);
      }
    }
  }
}

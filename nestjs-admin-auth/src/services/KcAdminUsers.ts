import { Injectable, Logger } from '@nestjs/common';
import type { CreateUserInput, IAdminUsers, KcSession } from '../interface/IAdminUsers';
import { KcAdminClient } from './KcAdminClient';

@Injectable()
export class KcAdminUsers implements IAdminUsers {
  private readonly logger = new Logger(KcAdminUsers.name);

  constructor(private readonly client: KcAdminClient) {}

  async createUser(input: CreateUserInput): Promise<{ sub: string }> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        username: input.username ?? input.email,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
      }),
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] createUser: ${res.status} ${await res.text()}`);

    const location = res.headers.get('Location') ?? '';
    const sub = location.split('/').pop();
    if (!sub) throw new Error('[KcAdminUsers] Keycloak ne retourne pas de sub dans Location');

    this.logger.log(`User créé dans Keycloak — sub: ${sub}, email: ${input.email}`);
    return { sub };
  }

  async listUsers(max = 1000): Promise<{ id: string; username: string }[]> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users?max=${max}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] listUsers: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async setPassword(sub: string, password: string, temporary: boolean): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: 'password', value: password, temporary }),
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] setPassword: ${res.status} ${await res.text()}`);
  }

  async sendInvitationEmail(sub: string): Promise<void> {
    if (!this.client.emailsEnabled) {
      this.logger.warn(
        `[sendEmails=false] Email d'invitation non envoyé pour sub=${sub}. ` +
          `Définir le mot de passe manuellement dans la console Keycloak. ` +
          `Activer via AdminAuthModule.register({ sendEmails: true }) quand le SMTP est prêt.`,
      );
      return;
    }

    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}/execute-actions-email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(['UPDATE_PASSWORD']),
    });

    if (!res.ok) this.logger.warn(`Email invitation non envoyé (${sub}): ${res.status}`);
    else this.logger.log(`Email invitation envoyé → sub: ${sub}`);
  }

  /**
   * Idempotent. Keycloak (`PUT /users/{id}/groups/{groupId}`) répond 204 que l'utilisateur
   * soit déjà membre ou non : il ne rejoint le groupe que s'il n'en est pas déjà membre.
   * Un 409 (non émis par Keycloak aujourd'hui) est toléré par prudence comme « déjà membre ».
   * Un 404 (compte ou groupe introuvable) reste une erreur : l'ajout n'a pas eu lieu.
   */
  async addToGroup(sub: string, groupId: string): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}/groups/${groupId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 409) {
      throw new Error(`[KcAdminUsers] addToGroup: ${res.status} ${await res.text()}`);
    }
    this.logger.log(`User ${sub} ajouté au groupe ${groupId}`);
  }

  /**
   * Idempotent. Keycloak (`DELETE /users/{id}/groups/{groupId}`) répond 204 pour un non-membre
   * (il ne quitte le groupe que s'il en est membre) et 404 seulement si le compte ou le groupe
   * n'existe pas : ce 404 est toléré, l'état visé (« pas membre ») étant atteint.
   */
  async removeFromGroup(sub: string, groupId: string): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}/groups/${groupId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`[KcAdminUsers] removeFromGroup: ${res.status} ${await res.text()}`);
    }
  }

  async deleteUser(sub: string): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`[KcAdminUsers] deleteUser: ${res.status} ${await res.text()}`);
    }
    this.logger.log(`User supprimé de Keycloak — sub: ${sub}`);
  }

  /**
   * `PUT /users/{id}` avec la seule propriété `enabled` : Keycloak applique une mise à jour
   * partielle (les champs absents de la représentation sont conservés, comme pour updateProfile).
   */
  async setEnabled(sub: string, enabled: boolean): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled }),
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] setEnabled: ${res.status} ${await res.text()}`);
    this.logger.log(`User ${sub} ${enabled ? 'activé' : 'désactivé'}`);
  }

  /**
   * `GET /users?email=…&exact=true`. Keycloak stocke les e-mails en minuscules ; la
   * correspondance est revérifiée côté client sans tenir compte de la casse, par sûreté.
   */
  async findUserByEmail(email: string): Promise<{ id: string; email: string; enabled: boolean } | null> {
    const wanted = email.trim().toLowerCase();
    if (!wanted) return null;

    const token = await this.client.getToken();
    const query = new URLSearchParams({ email: wanted, exact: 'true' });

    const res = await fetch(`${this.client.adminUrl}/users?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] findUserByEmail: ${res.status} ${await res.text()}`);

    const users: { id: string; email?: string; enabled?: boolean }[] = await res.json();
    const found = users.find((user) => user.email?.toLowerCase() === wanted);
    if (!found?.email) return null;
    return { id: found.id, email: found.email, enabled: found.enabled === true };
  }

  async updateProfile(sub: string, data: { firstName?: string; lastName?: string }): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] updateProfile: ${res.status} ${await res.text()}`);
  }

  async listSessions(sub: string): Promise<KcSession[]> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] listSessions: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async revokeSession(sessionId: string): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`[KcAdminUsers] revokeSession: ${res.status} ${await res.text()}`);
    }
  }
}

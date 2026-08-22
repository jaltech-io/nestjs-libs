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

  async addToGroup(sub: string, groupId: string): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/users/${sub}/groups/${groupId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`[KcAdminUsers] addToGroup: ${res.status} ${await res.text()}`);
    this.logger.log(`User ${sub} ajouté au groupe ${groupId}`);
  }

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

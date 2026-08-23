import { Injectable, Logger } from '@nestjs/common';
import type { GroupInfo, GroupMember, IAdminGroups } from '../interface/IAdminGroups';
import { KcAdminClient } from './KcAdminClient';

/**
 * Implémentation Keycloak de IAdminGroups.
 *
 * Les rôles sont des CLIENT roles sous le client configuré (ex: admin-api).
 * Keycloak reste agnostique du domaine métier — aucun realm role n'est créé.
 *
 * Les noms de groupes sont génériques (ex: global-admins, tenant-admins) —
 * jamais couplés aux données métier (tenant name, org name, etc.).
 */
@Injectable()
export class KcAdminGroups implements IAdminGroups {
  private readonly logger = new Logger(KcAdminGroups.name);
  private _clientUuid: string | null = null;

  constructor(private readonly client: KcAdminClient) {}

  // ── Résolution du clientUuid (lazy, mis en cache) ────────────────────────

  private async getClientUuid(token: string): Promise<string> {
    if (this._clientUuid) return this._clientUuid;

    const res = await fetch(`${this.client.adminUrl}/clients?clientId=${encodeURIComponent(this.client.clientId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] getClientUuid: ${res.status} ${await res.text()}`);

    const clients: { id: string }[] = await res.json();
    if (!clients.length) throw new Error(`[KcAdminGroups] Client "${this.client.clientId}" introuvable dans le realm`);

    this._clientUuid = clients[0].id;
    return this._clientUuid;
  }

  // ── Rôles client ─────────────────────────────────────────────────────────

  async createRole(roleName: string, description = ''): Promise<void> {
    const token = await this.client.getToken();
    const clientUuid = await this.getClientUuid(token);

    const check = await fetch(`${this.client.adminUrl}/clients/${clientUuid}/roles/${encodeURIComponent(roleName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (check.ok) {
      this.logger.log(`Client role "${roleName}" existe déjà — skip.`);
      return;
    }

    const res = await fetch(`${this.client.adminUrl}/clients/${clientUuid}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: roleName, description }),
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] createRole "${roleName}": ${res.status} ${await res.text()}`);
    this.logger.log(`Client role "${roleName}" créé sous ${this.client.clientId}.`);
  }

  async ensureCompositeRole(parentRoleName: string, childRoleName: string): Promise<void> {
    const token = await this.client.getToken();
    const clientUuid = await this.getClientUuid(token);
    const roleUrl = (name: string) => `${this.client.adminUrl}/clients/${clientUuid}/roles/${encodeURIComponent(name)}`;

    const childRes = await fetch(roleUrl(childRoleName), { headers: { Authorization: `Bearer ${token}` } });
    if (!childRes.ok)
      throw new Error(`[KcAdminGroups] ensureCompositeRole: rôle enfant "${childRoleName}" introuvable (${childRes.status})`);
    const child: { id: string; name: string } = await childRes.json();

    const compositesRes = await fetch(`${roleUrl(parentRoleName)}/composites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!compositesRes.ok)
      throw new Error(`[KcAdminGroups] ensureCompositeRole: rôle parent "${parentRoleName}" introuvable (${compositesRes.status})`);
    const composites: { name: string }[] = await compositesRes.json();
    if (composites.some((c) => c.name === childRoleName)) return;

    const add = await fetch(`${roleUrl(parentRoleName)}/composites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify([{ id: child.id, name: child.name }]),
    });
    if (!add.ok)
      throw new Error(`[KcAdminGroups] ensureCompositeRole ${parentRoleName} ⊃ ${childRoleName}: ${add.status} ${await add.text()}`);
    this.logger.log(`Rôle composite : ${parentRoleName} inclut désormais ${childRoleName}.`);
  }

  async assignRole(groupId: string, roleName: string): Promise<void> {
    const token = await this.client.getToken();
    const clientUuid = await this.getClientUuid(token);
    const roleData = await this.getClientRole(token, clientUuid, roleName);

    const res = await fetch(`${this.client.adminUrl}/groups/${groupId}/role-mappings/clients/${clientUuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify([roleData]),
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] assignRole: ${res.status} ${await res.text()}`);
    this.logger.log(`Role "${roleName}" assigné au groupe ${groupId}`);
  }

  async removeRole(groupId: string, roleName: string): Promise<void> {
    const token = await this.client.getToken();
    const clientUuid = await this.getClientUuid(token);
    const roleData = await this.getClientRole(token, clientUuid, roleName);

    const res = await fetch(`${this.client.adminUrl}/groups/${groupId}/role-mappings/clients/${clientUuid}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify([roleData]),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`[KcAdminGroups] removeRole: ${res.status} ${await res.text()}`);
    }
  }

  // ── Groupes ───────────────────────────────────────────────────────────────

  async createGroup(name: string, parentId?: string): Promise<{ groupId: string }> {
    const token = await this.client.getToken();

    const url = parentId ? `${this.client.adminUrl}/groups/${parentId}/children` : `${this.client.adminUrl}/groups`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] createGroup: ${res.status} ${await res.text()}`);

    const location = res.headers.get('Location') ?? '';
    const groupId = location.split('/').pop();
    if (!groupId) throw new Error('[KcAdminGroups] Keycloak ne retourne pas de groupId dans Location');

    this.logger.log(`Groupe créé — groupId: ${groupId}, name: ${name}${parentId ? `, parent: ${parentId}` : ''}`);
    return { groupId };
  }

  async findGroupByName(name: string): Promise<{ groupId: string } | null> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/groups?search=${encodeURIComponent(name)}&exact=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] findGroupByName: ${res.status} ${await res.text()}`);

    const data: { id: string; name: string }[] = await res.json();
    const match = data.find((g) => g.name === name);
    return match ? { groupId: match.id } : null;
  }

  async deleteGroup(groupId: string): Promise<void> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/groups/${groupId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`[KcAdminGroups] deleteGroup: ${res.status} ${await res.text()}`);
    }
    this.logger.log(`Groupe supprimé — groupId: ${groupId}`);
  }

  async listGroups(): Promise<GroupInfo[]> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/groups?max=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] listGroups: ${res.status}`);

    const data: { id: string; name: string }[] = await res.json();
    return data.map((g) => ({ groupId: g.id, name: g.name }));
  }

  async listMembers(groupId: string): Promise<GroupMember[]> {
    const token = await this.client.getToken();

    const res = await fetch(`${this.client.adminUrl}/groups/${groupId}/members?max=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] listMembers: ${res.status}`);

    const data: { id: string; email: string }[] = await res.json();
    return data.map((u) => ({ sub: u.id, email: u.email }));
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async getClientRole(
    token: string,
    clientUuid: string,
    roleName: string,
  ): Promise<{ id: string; name: string }> {
    const res = await fetch(`${this.client.adminUrl}/clients/${clientUuid}/roles/${encodeURIComponent(roleName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`[KcAdminGroups] getClientRole "${roleName}": ${res.status} ${await res.text()}`);
    return res.json();
  }
}

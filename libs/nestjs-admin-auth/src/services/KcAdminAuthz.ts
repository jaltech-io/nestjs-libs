import { Injectable, Logger } from '@nestjs/common';
import type {
  AuthzPermission,
  AuthzPolicy,
  AuthzResource,
  AuthzScope,
  EnsureResourceInput,
  IAdminAuthz,
} from '../interface/IAdminAuthz';
import { KcAdminClient } from './KcAdminClient';

/**
 * Implémentation Keycloak de IAdminAuthz — pilote les Authorization Services
 * (resource-server) du client configuré via l'Admin REST API.
 *
 * Endpoints : /admin/realms/{realm}/clients/{uuid}/authz/resource-server/...
 * Une permission Keycloak est une policy de type "scope" sous le capot — la
 * suppression passe donc par /policy/{id}.
 */
@Injectable()
export class KcAdminAuthz implements IAdminAuthz {
  private readonly logger = new Logger(KcAdminAuthz.name);
  private _clientUuid: string | null = null;

  constructor(private readonly client: KcAdminClient) {}

  // ── Plomberie ─────────────────────────────────────────────────────────────

  private async getClientUuid(token: string): Promise<string> {
    if (this._clientUuid) return this._clientUuid;

    const res = await fetch(`${this.client.adminUrl}/clients?clientId=${encodeURIComponent(this.client.clientId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`[KcAdminAuthz] getClientUuid: ${res.status} ${await res.text()}`);

    const clients: { id: string }[] = await res.json();
    if (!clients.length) throw new Error(`[KcAdminAuthz] Client "${this.client.clientId}" introuvable dans le realm`);

    this._clientUuid = clients[0].id;
    return this._clientUuid;
  }

  /** Base URL du resource-server du client (les Authorization Services). */
  private async authzUrl(token: string): Promise<string> {
    const clientUuid = await this.getClientUuid(token);
    return `${this.client.adminUrl}/clients/${clientUuid}/authz/resource-server`;
  }

  private async kcGet<T>(token: string, path: string): Promise<T> {
    const base = await this.authzUrl(token);
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`[KcAdminAuthz] GET ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  private async kcSend(token: string, method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<Response> {
    const base = await this.authzUrl(token);
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`[KcAdminAuthz] ${method} ${path}: ${res.status} ${await res.text()}`);
    return res;
  }

  // ── Activation ────────────────────────────────────────────────────────────

  async ensureAuthorizationEnabled(): Promise<void> {
    const token = await this.client.getToken();
    const clientUuid = await this.getClientUuid(token);

    const res = await fetch(`${this.client.adminUrl}/clients/${clientUuid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`[KcAdminAuthz] ensureAuthorizationEnabled: ${res.status} ${await res.text()}`);
    const rep: { authorizationServicesEnabled?: boolean; serviceAccountsEnabled?: boolean } = await res.json();

    if (rep.authorizationServicesEnabled && rep.serviceAccountsEnabled) {
      this.logger.log('Authorization Services déjà activés — skip.');
      return;
    }

    const put = await fetch(`${this.client.adminUrl}/clients/${clientUuid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...rep, serviceAccountsEnabled: true, authorizationServicesEnabled: true }),
    });
    if (!put.ok) throw new Error(`[KcAdminAuthz] activation: ${put.status} ${await put.text()}`);
    this.logger.log(`Authorization Services activés sur le client ${this.client.clientId}.`);
  }

  async ensureDecisionStrategy(strategy: 'AFFIRMATIVE' | 'UNANIMOUS' | 'CONSENSUS'): Promise<void> {
    const token = await this.client.getToken();
    const settings = await this.kcGet<{ id: string; decisionStrategy?: string; allowRemoteResourceManagement?: boolean; policyEnforcementMode?: string }>(
      token,
      '',
    );
    if (settings.decisionStrategy === strategy) return;

    await this.kcSend(token, 'PUT', '', { ...settings, decisionStrategy: strategy });
    this.logger.log(`Stratégie de décision du resource-server: ${settings.decisionStrategy ?? '?'} → ${strategy}.`);
  }

  // ── Scopes ────────────────────────────────────────────────────────────────

  async listScopes(): Promise<AuthzScope[]> {
    const token = await this.client.getToken();
    const scopes = await this.kcGet<{ id: string; name: string }[]>(token, '/scope?max=200');
    return scopes.map((s) => ({ id: s.id, name: s.name }));
  }

  async ensureScope(name: string): Promise<AuthzScope> {
    const token = await this.client.getToken();
    const existing = (await this.listScopes()).find((s) => s.name === name);
    if (existing) return existing;

    const res = await this.kcSend(token, 'POST', '/scope', { name });
    const created: { id: string; name: string } = await res.json();
    this.logger.log(`Scope "${name}" créé.`);
    return { id: created.id, name: created.name };
  }

  // ── Ressources ────────────────────────────────────────────────────────────

  async listResources(): Promise<AuthzResource[]> {
    const token = await this.client.getToken();
    const raw = await this.kcGet<
      { _id: string; name: string; displayName?: string; type?: string; scopes?: { id: string; name: string }[] }[]
    >(token, '/resource?deep=true&max=500');
    return raw.map((r) => ({
      id: r._id,
      name: r.name,
      displayName: r.displayName,
      type: r.type,
      scopes: (r.scopes ?? []).map((s) => ({ id: s.id, name: s.name })),
    }));
  }

  async findResourceByName(name: string): Promise<AuthzResource | null> {
    const token = await this.client.getToken();
    const raw = await this.kcGet<
      { _id: string; name: string; displayName?: string; type?: string; scopes?: { id: string; name: string }[] }[]
    >(token, `/resource?name=${encodeURIComponent(name)}&exactName=true&deep=true`);
    const r = raw.find((x) => x.name === name);
    if (!r) return null;
    return {
      id: r._id,
      name: r.name,
      displayName: r.displayName,
      type: r.type,
      scopes: (r.scopes ?? []).map((s) => ({ id: s.id, name: s.name })),
    };
  }

  async ensureResource(input: EnsureResourceInput): Promise<AuthzResource> {
    const token = await this.client.getToken();
    const scopes = await Promise.all(input.scopeNames.map((n) => this.ensureScope(n)));

    const existing = await this.findResourceByName(input.name);
    if (existing) {
      const missing = scopes.filter((s) => !existing.scopes.some((es) => es.name === s.name));
      if (missing.length === 0) return existing;

      // Complète les scopes manquants sans toucher au reste de la ressource.
      const merged = [...existing.scopes, ...missing];
      await this.kcSend(token, 'PUT', `/resource/${existing.id}`, {
        _id: existing.id,
        name: existing.name,
        displayName: existing.displayName,
        type: existing.type,
        scopes: merged.map((s) => ({ id: s.id, name: s.name })),
      });
      this.logger.log(`Ressource "${input.name}" : scopes complétés (${missing.map((s) => s.name).join(', ')}).`);
      return { ...existing, scopes: merged };
    }

    const res = await this.kcSend(token, 'POST', '/resource', {
      name: input.name,
      displayName: input.displayName,
      type: input.type,
      scopes: scopes.map((s) => ({ id: s.id, name: s.name })),
      ownerManagedAccess: false,
    });
    const created: { _id: string } = await res.json();
    this.logger.log(`Ressource "${input.name}" créée (${input.scopeNames.join(', ')}).`);
    return { id: created._id, name: input.name, displayName: input.displayName, type: input.type, scopes };
  }

  async deleteResource(resourceId: string): Promise<void> {
    const token = await this.client.getToken();
    await this.kcSend(token, 'DELETE', `/resource/${resourceId}`);
    this.logger.log(`Ressource ${resourceId} supprimée.`);
  }

  // ── Policies (role-based) ─────────────────────────────────────────────────

  async listRolePolicies(): Promise<AuthzPolicy[]> {
    const token = await this.client.getToken();
    const raw = await this.kcGet<{ id: string; name: string; type: string }[]>(token, '/policy/role?max=200');
    return raw.map((p) => ({ id: p.id, name: p.name, type: p.type }));
  }

  async ensureRolePolicy(policyName: string, clientRoleName: string): Promise<AuthzPolicy> {
    const token = await this.client.getToken();
    const existing = (await this.listRolePolicies()).find((p) => p.name === policyName);
    if (existing) return existing;

    const clientUuid = await this.getClientUuid(token);
    const roleRes = await fetch(
      `${this.client.adminUrl}/clients/${clientUuid}/roles/${encodeURIComponent(clientRoleName)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!roleRes.ok)
      throw new Error(`[KcAdminAuthz] Rôle client "${clientRoleName}" introuvable: ${roleRes.status} ${await roleRes.text()}`);
    const role: { id: string } = await roleRes.json();

    const res = await this.kcSend(token, 'POST', '/policy/role', {
      name: policyName,
      logic: 'POSITIVE',
      roles: [{ id: role.id, required: false }],
    });
    const created: { id: string; name: string; type: string } = await res.json();
    this.logger.log(`Policy "${policyName}" créée (rôle client ${clientRoleName}).`);
    return { id: created.id, name: created.name, type: created.type };
  }

  // ── Permissions (scope-based) ─────────────────────────────────────────────

  private async permissionDetail(token: string, p: { id: string; name: string }): Promise<AuthzPermission> {
    const [resources, scopes, policies] = await Promise.all([
      this.kcGet<{ name: string }[]>(token, `/policy/${p.id}/resources`),
      this.kcGet<{ name: string }[]>(token, `/policy/${p.id}/scopes`),
      this.kcGet<{ name: string }[]>(token, `/policy/${p.id}/associatedPolicies`),
    ]);
    return {
      id: p.id,
      name: p.name,
      resourceNames: resources.map((r) => r.name),
      scopeNames: scopes.map((s) => s.name),
      policyNames: policies.map((x) => x.name),
    };
  }

  async listPermissions(): Promise<AuthzPermission[]> {
    const token = await this.client.getToken();
    const raw = await this.kcGet<{ id: string; name: string }[]>(token, '/permission/scope?max=2000');
    return Promise.all(raw.map((p) => this.permissionDetail(token, p)));
  }

  async listPermissionNames(): Promise<Array<{ id: string; name: string }>> {
    const token = await this.client.getToken();
    const raw = await this.kcGet<{ id: string; name: string }[]>(token, '/permission/scope?max=2000');
    return raw.map((p) => ({ id: p.id, name: p.name }));
  }

  async getPermission(permissionId: string): Promise<AuthzPermission | null> {
    const token = await this.client.getToken();
    try {
      const p = await this.kcGet<{ id: string; name: string }>(token, `/policy/${permissionId}`);
      return await this.permissionDetail(token, p);
    } catch {
      return null;
    }
  }

  async ensureTypePermission(input: {
    name: string;
    resourceType: string;
    scopeName: string;
    policyNames: string[];
  }): Promise<void> {
    const token = await this.client.getToken();
    const existing = await this.kcGet<{ id: string; name: string }[]>(token, '/permission/scope?max=2000');
    if (existing.some((p) => p.name === input.name)) return;

    const scope = (await this.listScopes()).find((s) => s.name === input.scopeName);
    if (!scope) throw new Error(`[KcAdminAuthz] Scope "${input.scopeName}" introuvable`);

    const allPolicies = await this.listRolePolicies();
    const policyIds = input.policyNames.map((n) => {
      const p = allPolicies.find((x) => x.name === n);
      if (!p) throw new Error(`[KcAdminAuthz] Policy "${n}" introuvable`);
      return p.id;
    });

    await this.kcSend(token, 'POST', '/permission/scope', {
      name: input.name,
      decisionStrategy: 'AFFIRMATIVE',
      resourceType: input.resourceType,
      scopes: [scope.id],
      policies: policyIds,
    });
    this.logger.log(
      `Permission de type "${input.name}" créée (${input.resourceType} × ${input.scopeName} → ${input.policyNames.join(', ')}).`,
    );
  }

  async setResourcePermissions(
    resourceName: string,
    matrix: Array<{ scopeName: string; policyNames: string[] }>,
  ): Promise<void> {
    const token = await this.client.getToken();
    const resource = await this.findResourceByName(resourceName);
    if (!resource) throw new Error(`[KcAdminAuthz] Ressource "${resourceName}" introuvable`);

    const allPolicies = await this.listRolePolicies();
    const existingPerms = await this.kcGet<{ id: string; name: string }[]>(
      token,
      `/permission/scope?max=2000`,
    );

    for (const entry of matrix) {
      const permName = `perm:${resourceName}:${entry.scopeName}`;
      const existing = existingPerms.find((p) => p.name === permName);
      const scope = resource.scopes.find((s) => s.name === entry.scopeName);
      if (!scope) throw new Error(`[KcAdminAuthz] Scope "${entry.scopeName}" absent de la ressource "${resourceName}"`);

      // Aucune policy -> pas de permission -> refus par défaut.
      if (entry.policyNames.length === 0) {
        if (existing) {
          await this.kcSend(token, 'DELETE', `/policy/${existing.id}`);
          this.logger.log(`Permission "${permName}" supprimée (retour au refus par défaut).`);
        }
        continue;
      }

      const policyIds = entry.policyNames.map((n) => {
        const p = allPolicies.find((x) => x.name === n);
        if (!p) throw new Error(`[KcAdminAuthz] Policy "${n}" introuvable`);
        return p.id;
      });

      const body = {
        name: permName,
        decisionStrategy: 'AFFIRMATIVE',
        resources: [resource.id],
        scopes: [scope.id],
        policies: policyIds,
      };

      if (existing) {
        await this.kcSend(token, 'PUT', `/permission/scope/${existing.id}`, { id: existing.id, ...body });
        this.logger.log(`Permission "${permName}" mise à jour (${entry.policyNames.join(', ')}).`);
      } else {
        await this.kcSend(token, 'POST', '/permission/scope', body);
        this.logger.log(`Permission "${permName}" créée (${entry.policyNames.join(', ')}).`);
      }
    }
  }

  async deletePermission(permissionId: string): Promise<void> {
    const token = await this.client.getToken();
    await this.kcSend(token, 'DELETE', `/policy/${permissionId}`);
    this.logger.log(`Permission ${permissionId} supprimée.`);
  }
}

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ADMIN_AUTH_OPTIONS } from '../constants';
import type { AdminAuthConfig } from '../types/AdminAuthConfig';

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * Client interne — obtient et renouvelle le token service account de admin-api.
 * Injecté dans KcAdminUsers et KcAdminGroups uniquement. Non exporté.
 */
@Injectable()
export class KcAdminClient implements OnModuleInit {
  private readonly logger = new Logger(KcAdminClient.name);
  private token: string | null = null;
  private expiresAt: number = 0;

  constructor(@Inject(ADMIN_AUTH_OPTIONS) private readonly cfg: AdminAuthConfig) {}

  onModuleInit() {
    if (!this.cfg.clientSecret) {
      throw new Error(
        `[nestjs-admin-auth] clientSecret est requis. ` + `Vérifier KEYCLOAK_ADMIN_CLIENT_SECRET dans .env.`,
      );
    }
    this.logger.log(
      `AdminAuth prêt — realm: ${this.cfg.realm}, client: ${this.cfg.clientId}, ` +
        `emails: ${this.cfg.sendEmails ? 'activés' : 'désactivés (SMTP non configuré)'}`,
    );
  }

  /** Retourne un token valide (depuis le cache ou Keycloak). */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt - 10_000) return this.token;

    const res = await fetch(`${this.cfg.authServerUrl}/realms/${this.cfg.realm}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
      }).toString(),
    });

    if (!res.ok) throw new Error(`[KcAdminClient] Token: ${res.status} ${await res.text()}`);

    const data: TokenResponse = await res.json();
    this.token = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
    return this.token;
  }

  /** URL de base de l'Admin REST API pour le realm configuré. */
  get adminUrl(): string {
    return `${this.cfg.authServerUrl}/admin/realms/${this.cfg.realm}`;
  }

  get emailsEnabled(): boolean {
    return this.cfg.sendEmails === true;
  }

  get clientId(): string {
    return this.cfg.clientId;
  }
}

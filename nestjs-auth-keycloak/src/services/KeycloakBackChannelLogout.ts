import { Logger } from '@nestjs/common';
import type { IBackChannelLogoutValidator, LogoutEvent } from '@jaltech/nestjs-auth-core';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { parseToken } from '../utils/parseToken';

/** URI de l'événement OIDC Back-Channel Logout (dupliqué pour éviter un import runtime du core). */
const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

/** Realm résolu pour la validation d'un logout_token. */
export type LogoutRealm = { issuer: string; clientId: string; jwks: JWTVerifyGetKey };

/** Résout un `issuer` (allowlist) vers le realm de validation, ou `null` si inconnu. */
export type LogoutRealmResolver = (issuer: string) => Promise<LogoutRealm | null> | LogoutRealm | null;

/**
 * Validateur Keycloak de Back-Channel Logout OIDC 1.0.
 *
 * Vérifie la signature du `logout_token` via le JWKS du realm (résolu par allowlist),
 * puis applique tous les contrôles OIDC. L'anti-rejeu (`jti`) et la révocation sont
 * gérés par le `BackChannelLogoutService` du core.
 */
export class KeycloakBackChannelLogout implements IBackChannelLogoutValidator {
  private readonly logger = new Logger(KeycloakBackChannelLogout.name);

  constructor(private readonly resolveRealm: LogoutRealmResolver) {}

  async validateLogoutToken(logoutToken: string): Promise<LogoutEvent> {
    // iss NON vérifié → sélection d'un realm d'allowlist uniquement.
    const unsafe = parseToken(logoutToken);
    const iss = unsafe?.iss;
    if (typeof iss !== 'string') throw new Error('logout_token: missing iss');

    const realm = await this.resolveRealm(iss);
    if (!realm) throw new Error(`logout_token: unknown issuer ${iss}`);

    const { payload } = await jwtVerify(logoutToken, realm.jwks, {
      algorithms: ['RS256'],
      issuer: realm.issuer,
    });

    // aud contient le clientId.
    const aud = payload.aud;
    const audiences = Array.isArray(aud) ? aud : aud != null ? [aud] : [];
    if (!audiences.includes(realm.clientId)) throw new Error('logout_token: audience mismatch');

    // iat présent.
    if (typeof payload.iat !== 'number') throw new Error('logout_token: missing iat');

    // jti présent (anti-rejeu).
    const jti = payload.jti;
    if (typeof jti !== 'string' || jti.length === 0) throw new Error('logout_token: missing jti');

    // events contient l'événement de back-channel logout.
    const events = payload.events as Record<string, unknown> | undefined;
    if (!events || typeof events !== 'object' || !(BACKCHANNEL_LOGOUT_EVENT in events)) {
      throw new Error('logout_token: missing backchannel-logout event');
    }

    // sid et/ou sub présent.
    const sid = typeof payload.sid === 'string' ? payload.sid : undefined;
    const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
    if (!sid && !sub) throw new Error('logout_token: neither sid nor sub present');

    // nonce INTERDIT dans un logout_token.
    if ('nonce' in payload) throw new Error('logout_token: nonce is prohibited');

    return { provider: 'keycloak', issuer: realm.issuer, sid, subject: sub, jti };
  }
}

import { describe, expect, it } from 'vitest';
import { KeycloakToken } from '../src/services/KeycloakToken';

/** Encode un payload en JWT non signé (suffisant pour tester la lecture des claims). */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

describe('KeycloakToken', () => {
  const token = new KeycloakToken(
    fakeJwt({
      exp: Math.floor(Date.now() / 1000) + 1000,
      realm_access: { roles: ['admin', 'user'] },
      resource_access: { 'my-api': { roles: ['reader'] } },
    }),
  );

  it('reads realm roles', () => {
    expect(token.hasRealmRole('admin')).toBe(true);
    expect(token.hasRealmRole('missing')).toBe(false);
    expect(token.hasRole('admin')).toBe(true);
    expect(token.hasRole('realm:user')).toBe(true);
  });

  it('reads client (application) roles', () => {
    expect(token.hasApplicationRole('my-api', 'reader')).toBe(true);
    expect(token.hasApplicationRole('my-api', 'writer')).toBe(false);
    expect(token.hasRole('my-api:reader')).toBe(true);
    expect(token.hasRole('other:reader')).toBe(false);
  });

  it('detects expiry', () => {
    const expired = new KeycloakToken(fakeJwt({ exp: Math.floor(Date.now() / 1000) - 10 }));
    expect(expired.isExpired()).toBe(true);
    expect(token.isExpired()).toBe(false);
  });
});

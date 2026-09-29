import { describe, expect, it } from 'vitest';
import { EntraToken } from '../src/services/EntraToken';
import { resolveEntraConfig } from '../src/types/EntraConfig';

const cfg = resolveEntraConfig({ tenantId: 't', clientId: 'client-abc' });

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

describe('EntraToken', () => {
  it('reads roles from the roles claim', () => {
    const token = new EntraToken(fakeJwt({ roles: ['Admin', 'Reader'], exp: 9999999999 }), cfg);
    expect(token.hasRole('Admin')).toBe(true);
    expect(token.hasRole('Missing')).toBe(false);
    expect(token.hasRealmRole('Reader')).toBe(true);
  });

  it('hasApplicationRole matches only for the configured clientId', () => {
    const token = new EntraToken(fakeJwt({ roles: ['Admin'], exp: 9999999999 }), cfg);
    expect(token.hasApplicationRole('client-abc', 'Admin')).toBe(true);
    expect(token.hasApplicationRole('other', 'Admin')).toBe(false);
  });

  it('prefers resolved roles over the claim when provided', () => {
    const token = new EntraToken(fakeJwt({ roles: ['claim-role'], exp: 9999999999 }), cfg, ['resolved-role']);
    expect(token.hasRole('resolved-role')).toBe(true);
    expect(token.hasRole('claim-role')).toBe(false);
  });

  it('detects expiry', () => {
    expect(new EntraToken(fakeJwt({ exp: 1 }), cfg).isExpired()).toBe(true);
  });
});

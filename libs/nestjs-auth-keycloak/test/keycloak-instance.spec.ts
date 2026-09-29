import { exportSPKI } from 'jose';
import { type Keypair, makeKeypair, signJwt, stubFetch } from '@test/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeycloakInstance } from '../src/services/KeycloakInstance';

const AUTH_URL = 'https://kc.test';
const REALM = 'acme';
const CLIENT = 'api';
const ISSUER = `${AUTH_URL}/realms/${REALM}`;
const CERTS = `${AUTH_URL}/realms/${REALM}/protocol/openid-connect/certs`;

let kp: Keypair;

beforeEach(async () => {
  kp = await makeKeypair('kc-1');
});
afterEach(() => vi.unstubAllGlobals());

const validate = (instance: KeycloakInstance, jwt: string) =>
  instance.createGrant({ access_token: jwt }).then((g) => instance.validateToken(g.access_token, 'Bearer'));

describe('KeycloakInstance — offline validation', () => {
  it('accepts a well-signed token from the configured realm', async () => {
    stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const jwt = await signJwt(kp, { iss: ISSUER, sub: 'u1', azp: CLIENT });
    expect(await validate(instance, jwt)).toBeTruthy();
  });

  it('rejects a token signed by a different key (bad signature)', async () => {
    const other = await makeKeypair('kc-1'); // same kid, different key
    stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const jwt = await signJwt(other, { iss: ISSUER, sub: 'u1' });
    expect(await validate(instance, jwt)).toBe(false);
  });

  it('rejects a token with a wrong issuer', async () => {
    stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const jwt = await signJwt(kp, { iss: 'https://evil/realms/x', sub: 'u1' });
    expect(await validate(instance, jwt)).toBe(false);
  });

  describe('verifyTokenAudience', () => {
    it("rejects another client's token", async () => {
      stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
      const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { verifyTokenAudience: true });
      const jwt = await signJwt(kp, { iss: ISSUER, sub: 'u1', aud: ['other-client'], azp: 'other-client' });
      expect(await validate(instance, jwt)).toBe(false);
    });

    it('accepts when azp === clientId (aud=account)', async () => {
      stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
      const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { verifyTokenAudience: true });
      const jwt = await signJwt(kp, { iss: ISSUER, sub: 'u1', aud: 'account', azp: CLIENT });
      expect(await validate(instance, jwt)).toBeTruthy();
    });

    it('accepts when aud contains the clientId', async () => {
      stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
      const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { verifyTokenAudience: true });
      const jwt = await signJwt(kp, { iss: ISSUER, sub: 'u1', aud: [CLIENT, 'account'] });
      expect(await validate(instance, jwt)).toBeTruthy();
    });
  });

  describe('requireOrganization', () => {
    it('rejects a token without organization', async () => {
      stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
      const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { requireOrganization: true });
      const jwt = await signJwt(kp, { iss: ISSUER, sub: 'u1' });
      expect(await validate(instance, jwt)).toBe(false);
    });

    it('accepts a token carrying an organization', async () => {
      stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
      const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { requireOrganization: true });
      const jwt = await signJwt(kp, { iss: ISSUER, sub: 'u1', organization: { acme: {} } });
      expect(await validate(instance, jwt)).toBeTruthy();
    });
  });

  it('validates offline with a local realmPublicKey (no network)', async () => {
    const spki = await exportSPKI(kp.publicKey);
    const body = spki.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
    // Fetch stubbed to fail: proves the local key path performs no JWKS request.
    stubFetch({ status: [{ urlIncludes: CERTS, status: 500 }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { realmPublicKey: body });
    const jwt = await signJwt(kp, { iss: ISSUER, sub: 'u1' });
    expect(await validate(instance, jwt)).toBeTruthy();
  });
});

describe('KeycloakInstance — toIdentity', () => {
  it('maps subject=sub, lowercases email, normalizes organizations (object shape)', () => {
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const content = { sub: 'abc', email: 'USER@Example.COM', name: 'Jane', organization: { acme: {}, globex: {} } };
    const identity = instance.toIdentity({ token: 't', content } as any);
    expect(identity).toMatchObject({ provider: 'keycloak', subject: 'abc', email: 'user@example.com', displayName: 'Jane' });
    expect(identity.organizations).toEqual(['acme', 'globex']);
  });

  it('normalizes organizations from an array shape', () => {
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const identity = instance.toIdentity({ token: 't', content: { sub: 'x', organization: ['acme'] } } as any);
    expect(identity.organizations).toEqual(['acme']);
  });
});

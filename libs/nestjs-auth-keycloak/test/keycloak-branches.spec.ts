import { type Keypair, makeKeypair, signJwt, stubFetch } from '@test/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeycloakProvider } from '../src/KeycloakProvider';
import { KeycloakMultiRealmInstance } from '../src/services/KeycloakMultiRealmInstance';
import { KeycloakToken } from '../src/services/KeycloakToken';
import { RealmRegistry } from '../src/services/RealmRegistry';
import type { KeycloakRealmConfig } from '../src/types/RealmConfig';
import { normalizeOrganizations } from '../src/utils/organizations';
import { parseToken } from '../src/utils/parseToken';

/** JWT non signé (payload lisible) pour tester les lectures de claims. */
const unsigned = (payload: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

describe('normalizeOrganizations', () => {
  it.each([
    [undefined, undefined],
    [null, undefined],
    ['', undefined],
    ['acme', ['acme']],
    [['acme', 'globex'], ['acme', 'globex']],
    [['acme', 42, null], ['acme']],
    [[], undefined],
    [[1, 2], undefined],
    [{ acme: { id: '1' }, globex: {} }, ['acme', 'globex']],
    [{}, undefined],
    [42, undefined],
    [true, undefined],
  ])('normalizes %j to %j', (claim, expected) => {
    expect(normalizeOrganizations(claim)).toEqual(expected);
  });
});

describe('parseToken', () => {
  it('rejects a token that does not have three segments', () => {
    expect(() => parseToken('only.two')).toThrow('Malformed JWT');
  });

  it('decodes the payload of a well-formed token', () => {
    expect(parseToken(unsigned({ sub: 'u1' }))).toEqual({ sub: 'u1' });
  });
});

describe('KeycloakToken', () => {
  const token = new KeycloakToken(
    unsigned({
      realm_access: { roles: ['admin'] },
      resource_access: { 'my-api': { roles: ['editor'] } },
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  );
  const bare = new KeycloakToken(unsigned({ exp: Math.floor(Date.now() / 1000) - 60 }));

  it('reads plain and "realm:" prefixed realm roles', () => {
    expect(token.hasRole('admin')).toBe(true);
    expect(token.hasRole('realm:admin')).toBe(true);
    expect(token.hasRole('realm:editor')).toBe(false);
  });

  it('reads client roles with the "client:role" syntax', () => {
    expect(token.hasRole('my-api:editor')).toBe(true);
    expect(token.hasRole('other-api:editor')).toBe(false);
  });

  it('never grants a role when access claims are missing (fail-closed)', () => {
    expect(bare.hasRole('admin')).toBe(false);
    expect(bare.hasRole('realm:admin')).toBe(false);
    expect(bare.hasRole('my-api:editor')).toBe(false);
    expect(bare.hasRealmRole('admin')).toBe(false);
    expect(bare.hasApplicationRole('my-api', 'editor')).toBe(false);
  });

  it('exposes realm and application roles through dedicated helpers', () => {
    expect(token.hasRealmRole('admin')).toBe(true);
    expect(token.hasApplicationRole('my-api', 'editor')).toBe(true);
  });

  it('reports expiry from the exp claim', () => {
    expect(token.isExpired()).toBe(false);
    expect(bare.isExpired()).toBe(true);
  });
});

const ISS = 'https://kc.test/realms/acme';
const CERTS = `${ISS}/protocol/openid-connect/certs`;

describe('KeycloakMultiRealmInstance — validation branches', () => {
  let kp: Keypair;
  beforeEach(async () => {
    kp = await makeKeypair('acme-1');
    stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
  });
  afterEach(() => vi.unstubAllGlobals());

  const realm = (extra: Partial<KeycloakRealmConfig> = {}): KeycloakRealmConfig => ({
    realm: 'acme',
    clientId: 'api',
    issuer: ISS,
    ...extra,
  });
  const make = (r: KeycloakRealmConfig, defaults = {}) =>
    new KeycloakMultiRealmInstance(new RealmRegistry({ realms: [r] }), defaults);
  const validate = async (instance: KeycloakMultiRealmInstance, payload: Record<string, unknown>) => {
    const jwt = await signJwt(kp, { iss: ISS, sub: 'u', ...payload });
    const { access_token } = await instance.createGrant({ access_token: jwt });
    return instance.validateToken(access_token, 'Bearer');
  };

  it('rejects a token without a string issuer', async () => {
    const instance = make(realm());
    const result = await instance.validateToken(
      { token: 'x', content: { iss: 42 } } as any,
      'Bearer',
    );
    expect(result).toBe(false);
  });

  it('with audience verification: accepts aud (string or array) or azp, rejects others', async () => {
    const instance = make(realm({ verifyTokenAudience: true }));
    expect(await validate(instance, { aud: 'api' })).toBeTruthy();
    expect(await validate(instance, { aud: ['account', 'api'] })).toBeTruthy();
    expect(await validate(instance, { aud: 'account', azp: 'api' })).toBeTruthy();
    expect(await validate(instance, { aud: 'other', azp: 'other' })).toBe(false);
    expect(await validate(instance, {})).toBe(false);
  });

  it('applies instance-level defaults when the realm does not override them', async () => {
    const instance = make(realm(), { verifyTokenAudience: true, requireOrganization: true });
    expect(await validate(instance, { aud: 'other' })).toBe(false);
    expect(await validate(instance, { aud: 'api' })).toBe(false); // no organization
    expect(await validate(instance, { aud: 'api', organization: ['acme'] })).toBeTruthy();
  });

  it('requireOrganization rejects tokens without an organization claim (fail-closed)', async () => {
    const instance = make(realm({ requireOrganization: true }));
    expect(await validate(instance, {})).toBe(false);
    expect(await validate(instance, { organization: { acme: {} } })).toBeTruthy();
  });

  it('does not support ONLINE validation', async () => {
    await expect(make(realm()).validateAccessToken()).rejects.toThrow('does not support ONLINE');
  });

  it('refuses UMA (@Resource) — fail-closed', async () => {
    const req: any = {};
    const next = vi.fn();
    await make(realm()).enforcer()(req, {}, next);
    expect(req.resourceDenied).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('accessDenied marks the request as denied and continues', () => {
    const req: any = {};
    const next = vi.fn();
    make(realm()).accessDenied(req, {}, next);
    expect(req.resourceDenied).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('builds a normalized identity (lowercased email, display name fallback, organizations)', () => {
    const identity = make(realm()).toIdentity({
      token: 't',
      content: { sub: 's', iss: ISS, email: 'Jean@ACME.com', preferred_username: 'jean', organization: 'acme' },
    } as any);
    expect(identity).toMatchObject({
      provider: 'keycloak',
      subject: 's',
      tenantId: ISS,
      email: 'jean@acme.com',
      displayName: 'jean',
      organizations: ['acme'],
    });
    const noIss = make(realm()).toIdentity({ token: 't', content: { sub: 's', email: 42 } } as any);
    expect(noIss.tenantId).toBeUndefined();
    expect(noIss.email).toBeUndefined();
  });
});

describe('KeycloakProvider — boot-time validation', () => {
  it('create() rejects missing required options', () => {
    expect(() => KeycloakProvider.create({ authServerUrl: '', realm: 'r', clientId: 'c' } as any)).toThrow(
      'missing required option(s): authServerUrl',
    );
  });

  it('create() tolerates deprecated no-op options and disables the UMA cache when TTL is 0', () => {
    const provider = KeycloakProvider.create({
      authServerUrl: 'https://kc.test',
      realm: 'acme',
      clientId: 'api',
      umaCacheTtl: 0,
      bearerOnly: true,
      publicClient: false,
      confidentialPort: 0,
      sslRequired: 'external',
    });
    expect(provider.name).toBe('keycloak');
    expect(provider.instance.capabilities.uma).toBe(true);
  });

  it('createMultiRealm() requires static realms or a resolver', () => {
    expect(() => KeycloakProvider.createMultiRealm({})).toThrow('provide at least one static realm');
    expect(() => KeycloakProvider.createMultiRealm({ realms: [] })).toThrow('provide at least one static realm');
  });

  it('createMultiRealm() wires a back-channel logout resolver bound to the realm registry', async () => {
    const provider = KeycloakProvider.createMultiRealm({
      realms: [{ realm: 'acme', clientId: 'api', issuer: ISS }],
      minTimeBetweenJwksRequests: 5,
    });
    expect(provider.instance.capabilities).toMatchObject({ online: false, uma: false, backChannelLogout: true });
    expect(provider.backChannelLogout).toBeDefined();
  });
});

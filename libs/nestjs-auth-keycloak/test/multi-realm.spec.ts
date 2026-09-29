import { type Keypair, makeKeypair, signJwt, stubFetch } from '@test/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeycloakMultiRealmInstance } from '../src/services/KeycloakMultiRealmInstance';
import { RealmRegistry } from '../src/services/RealmRegistry';
import type { KeycloakRealmConfig } from '../src/types/RealmConfig';

const BASE = 'https://kc.test/realms';
const issA = `${BASE}/a`;
const issB = `${BASE}/b`;
const certsA = `${issA}/protocol/openid-connect/certs`;
const certsB = `${issB}/protocol/openid-connect/certs`;

const realmA: KeycloakRealmConfig = { realm: 'a', clientId: 'api-a', issuer: issA };
const realmB: KeycloakRealmConfig = { realm: 'b', clientId: 'api-b', issuer: issB };

let kpA: Keypair;
let kpB: Keypair;

beforeEach(async () => {
  kpA = await makeKeypair('a-1');
  kpB = await makeKeypair('b-1');
});
afterEach(() => vi.unstubAllGlobals());

function multiRealm(realms: KeycloakRealmConfig[], extra: Partial<RealmRegistry> = {}) {
  const registry = new RealmRegistry({ realms, ...(extra as any) });
  return new KeycloakMultiRealmInstance(registry);
}

const validate = (instance: KeycloakMultiRealmInstance, jwt: string) =>
  instance.createGrant({ access_token: jwt }).then((g) => instance.validateToken(g.access_token, 'Bearer'));

describe('KeycloakMultiRealmInstance — STATIC allowlist', () => {
  it('accepts tokens from two configured realms', async () => {
    stubFetch({ jwks: [{ urlIncludes: certsA, keys: [kpA.jwk] }, { urlIncludes: certsB, keys: [kpB.jwk] }] });
    const instance = multiRealm([realmA, realmB]);
    expect(await validate(instance, await signJwt(kpA, { iss: issA, sub: 'ua' }))).toBeTruthy();
    expect(await validate(instance, await signJwt(kpB, { iss: issB, sub: 'ub' }))).toBeTruthy();
  });

  it('rejects an unknown issuer (fail-closed)', async () => {
    stubFetch({ jwks: [{ urlIncludes: certsA, keys: [kpA.jwk] }] });
    const instance = multiRealm([realmA]);
    const jwt = await signJwt(kpA, { iss: `${BASE}/ghost`, sub: 'u' });
    expect(await validate(instance, jwt)).toBe(false);
  });

  it('a realm A token cannot pass as realm B', async () => {
    stubFetch({ jwks: [{ urlIncludes: certsA, keys: [kpA.jwk] }, { urlIncludes: certsB, keys: [kpB.jwk] }] });
    const instance = multiRealm([realmA, realmB]);
    // Token signed by A's key but claiming issuer B → resolves realm B → verified with B's JWKS → fails.
    const spoof = await signJwt(kpA, { iss: issB, sub: 'attacker' });
    expect(await validate(instance, spoof)).toBe(false);
  });

  it('sets tenantId=issuer on the identity (partitions the principal cache)', () => {
    const instance = multiRealm([realmA]);
    const identity = instance.toIdentity({ token: 't', content: { sub: 'x', iss: issA } } as any);
    expect(identity.tenantId).toBe(issA);
  });
});

describe('RealmRegistry — DYNAMIC resolver', () => {
  it('resolves via the app resolver and positively caches (single call)', async () => {
    const resolveRealm = vi.fn(async (iss: string) => (iss === issA ? realmA : null));
    const registry = new RealmRegistry({ resolveRealm });
    expect(await registry.resolve(issA)).toMatchObject({ realm: 'a' });
    expect(await registry.resolve(issA)).toMatchObject({ realm: 'a' });
    expect(resolveRealm).toHaveBeenCalledOnce();
  });

  it('negatively caches unknown issuers (resolver called once within TTL)', async () => {
    const resolveRealm = vi.fn(async () => null);
    const registry = new RealmRegistry({ resolveRealm, resolverNegativeCacheTtlMs: 60_000 });
    expect(await registry.resolve('https://kc.test/realms/unknown')).toBeNull();
    expect(await registry.resolve('https://kc.test/realms/unknown')).toBeNull();
    expect(resolveRealm).toHaveBeenCalledOnce();
  });

  it('rate-limits resolver calls for distinct unknown issuers', async () => {
    const resolveRealm = vi.fn(async () => null);
    const registry = new RealmRegistry({ resolveRealm, maxUnknownResolvesPerWindow: 2 });
    await registry.resolve('https://kc.test/realms/x1');
    await registry.resolve('https://kc.test/realms/x2');
    await registry.resolve('https://kc.test/realms/x3'); // blocked by the limiter
    expect(resolveRealm).toHaveBeenCalledTimes(2);
  });

  it('bounds the JWKS cache with an LRU (eviction)', async () => {
    const registry = new RealmRegistry({ realms: [realmA, realmB], jwksCacheMax: 1 });
    await registry.resolve(issA);
    await registry.resolve(issB);
    expect(registry.jwksCacheSize).toBe(1);
  });

  it('reuses a cached JWKS set on repeated resolves (MRU)', async () => {
    const registry = new RealmRegistry({ realms: [realmA] });
    await registry.resolve(issA);
    await registry.resolve(issA);
    expect(registry.jwksCacheSize).toBe(1);
  });

  it('denies when the resolver throws (fail-closed)', async () => {
    const registry = new RealmRegistry({
      resolveRealm: () => {
        throw new Error('db error');
      },
    });
    expect(await registry.resolve(issA)).toBeNull();
  });
});

describe('KeycloakMultiRealmInstance — unsupported operations', () => {
  it('rejects a token without a string iss', async () => {
    const instance = multiRealm([realmA]);
    const g = await instance.createGrant({ access_token: fakeUnsigned({ sub: 'x' }) });
    expect(await instance.validateToken(g.access_token, 'Bearer')).toBe(false);
  });

  it('throws for ONLINE validation and refuses UMA (fail-closed)', async () => {
    const instance = multiRealm([realmA]);
    await expect(instance.validateAccessToken()).rejects.toThrow(/ONLINE/);
    const req: any = {};
    await new Promise<void>((resolve) => instance.enforcer()(req, {}, () => resolve()));
    expect(req.resourceDenied).toBe(true);
  });
});

/** JWT non signé pour tester les branches de rejet précoce (pas de vérif de signature). */
function fakeUnsigned(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

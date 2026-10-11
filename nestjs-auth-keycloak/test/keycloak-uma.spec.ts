import { stubFetch } from '@test/jwt';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeycloakInstance } from '../src/services/KeycloakInstance';
import { InMemoryUmaCache } from '../src/services/InMemoryUmaCache';

const AUTH_URL = 'https://kc.test';
const REALM = 'acme';
const CLIENT = 'api';
const TOKEN_EP = '/protocol/openid-connect/token';
const USERINFO = '/protocol/openid-connect/userinfo';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

afterEach(() => vi.unstubAllGlobals());

function runEnforcer(instance: KeycloakInstance, permissions: string[], req: any, options?: any): Promise<void> {
  return new Promise((resolve) => instance.enforcer(permissions, options)(req, {}, () => resolve()));
}

describe('KeycloakInstance — UMA enforcer', () => {
  it('grants when Keycloak returns result:true, then serves from cache', async () => {
    stubFetch({ json: [{ urlIncludes: TOKEN_EP, body: { result: true } }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, {
      umaCacheTtl: 60_000,
      umaCacheStore: new InMemoryUmaCache(),
    });
    const req: any = { accessToken: fakeJwt({ sub: 'u1' }), headers: {} };

    await runEnforcer(instance, ['Product:View'], req, { claims: () => ({ 'http.uri': ['/x'] }) });
    expect(req.resourceDenied).toBeUndefined();
    expect(req.umaBenchmark.hit).toBe(false);

    const req2: any = { accessToken: fakeJwt({ sub: 'u1' }), headers: {} };
    await runEnforcer(instance, ['Product:View'], req2);
    expect(req2.umaBenchmark.hit).toBe(true);
  });

  it('denies when Keycloak returns HTTP 403', async () => {
    stubFetch({ status: [{ urlIncludes: TOKEN_EP, status: 403, body: 'denied' }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { umaCacheTtl: 0 });
    const req: any = { accessToken: fakeJwt({ sub: 'u2' }), headers: {} };
    await runEnforcer(instance, ['Product:Delete'], req);
    expect(req.resourceDenied).toBe(true);
  });

  it('caches a 403 policy denial', async () => {
    stubFetch({ status: [{ urlIncludes: TOKEN_EP, status: 403, body: 'denied' }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, {
      umaCacheTtl: 60_000,
      umaCacheStore: new InMemoryUmaCache(),
    });
    await runEnforcer(instance, ['Product:Delete'], { accessToken: fakeJwt({ sub: 'u4' }), headers: {} });
    const req2: any = { accessToken: fakeJwt({ sub: 'u4' }), headers: {} };
    await runEnforcer(instance, ['Product:Delete'], req2);
    expect(req2.resourceDenied).toBe(true);
    expect(req2.umaBenchmark.hit).toBe(true);
  });

  it.each([429, 500, 503])('denies on HTTP %i without caching it (transient error)', async (status) => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return calls === 1
        ? new Response('slow down', { status })
        : new Response(JSON.stringify({ result: true }), { status: 200 });
    });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, {
      umaCacheTtl: 60_000,
      umaCacheStore: new InMemoryUmaCache(),
    });
    const req1: any = { accessToken: fakeJwt({ sub: 'u5' }), headers: {} };
    await runEnforcer(instance, ['Product:View'], req1);
    expect(req1.resourceDenied).toBe(true);

    const req2: any = { accessToken: fakeJwt({ sub: 'u5' }), headers: {} };
    await runEnforcer(instance, ['Product:View'], req2);
    expect(req2.umaBenchmark.hit).toBe(false);
    expect(req2.resourceDenied).toBeUndefined();
    expect(calls).toBe(2);
  });

  it('calls the backchannel URL for UMA while keeping the public issuer', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string | URL) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { backchannelUrl: 'http://keycloak:8080' });
    await runEnforcer(instance, ['Product:View'], { accessToken: fakeJwt({ sub: 'u6' }), headers: {} });
    expect(urls).toEqual([`http://keycloak:8080/realms/${REALM}${TOKEN_EP}`]);
    expect(instance.issuer).toBe(`${AUTH_URL}/realms/${REALM}`);
  });

  it('denies when no access token is present', async () => {
    stubFetch({});
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const req: any = { headers: {} };
    await runEnforcer(instance, ['Product:View'], req);
    expect(req.resourceDenied).toBe(true);
  });

  it('denies (fail-closed) on a network error', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network down');
    });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { umaCacheTtl: 0 });
    const req: any = { accessToken: fakeJwt({ sub: 'u3' }), headers: {} };
    await runEnforcer(instance, ['Product:View'], req);
    expect(req.resourceDenied).toBe(true);
  });
});

describe('KeycloakInstance — online validation', () => {
  it('accepts when /userinfo returns 200', async () => {
    stubFetch({ status: [{ urlIncludes: USERINFO, status: 200 }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const token = { token: fakeJwt({ sub: 'u1' }), content: {} } as any;
    expect(await instance.validateAccessToken(token)).toBeTruthy();
  });

  it('calls /userinfo on the backchannel URL when configured', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string | URL) => {
      urls.push(String(url));
      return new Response('{}', { status: 200 });
    });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { backchannelUrl: 'http://keycloak:8080' });
    await instance.validateAccessToken({ token: fakeJwt({ sub: 'u1' }), content: {} } as any);
    expect(urls).toEqual([`http://keycloak:8080/realms/${REALM}${USERINFO}`]);
  });

  it('rejects when /userinfo returns 401', async () => {
    stubFetch({ status: [{ urlIncludes: USERINFO, status: 401 }] });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const token = { token: fakeJwt({ sub: 'u1' }), content: {} } as any;
    expect(await instance.validateAccessToken(token)).toBe(false);
  });

  it('rejects on network error', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('down');
    });
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT);
    const token = { token: fakeJwt({ sub: 'u1' }), content: {} } as any;
    expect(await instance.validateAccessToken(token)).toBe(false);
  });
});

describe('KeycloakInstance — UMA cache invalidation', () => {
  /** Instance avec cache mémoire, peuplé par de vraies décisions (même format de clé que l'enforcer). */
  async function populatedInstance(): Promise<{ instance: KeycloakInstance }> {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ result: true }), { status: 200 }));
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, {
      umaCacheTtl: 60_000,
      umaCacheStore: new InMemoryUmaCache(),
    });
    for (const [sub, permissions] of [
      ['alice', ['invoices:READ']],
      ['alice', ['orders:READ']],
      ['bob', ['invoices:UPDATE']],
      ['bob', ['orders:READ', 'invoices:READ']],
      ['carol', ['global-invoices:READ']],
    ] as const) {
      await runEnforcer(instance, [...permissions], { accessToken: fakeJwt({ sub }), headers: {} });
    }
    return { instance };
  }

  async function isCached(instance: KeycloakInstance, sub: string, permissions: string[]): Promise<boolean> {
    const req: any = { accessToken: fakeJwt({ sub }), headers: {} };
    await runEnforcer(instance, permissions, req);
    return req.umaBenchmark.hit;
  }

  it('forgetUser drops every decision of that user only', async () => {
    const { instance } = await populatedInstance();
    expect(await instance.forgetUser('alice')).toBe(2);
    expect(await isCached(instance, 'alice', ['invoices:READ'])).toBe(false);
    expect(await isCached(instance, 'bob', ['invoices:UPDATE'])).toBe(true);
    expect(await instance.forgetUser('nobody')).toBe(0);
  });

  it('forgetResource drops every decision involving the resource, multi-permission keys included', async () => {
    const { instance } = await populatedInstance();
    expect(await instance.forgetResource('invoices')).toBe(3);
    expect(await isCached(instance, 'alice', ['invoices:READ'])).toBe(false);
    expect(await isCached(instance, 'bob', ['invoices:READ', 'orders:READ'])).toBe(false);
    expect(await isCached(instance, 'alice', ['orders:READ'])).toBe(true);
    expect(await isCached(instance, 'carol', ['global-invoices:READ'])).toBe(true);
  });

  it('forgetResource also matches a resource listed after another one', async () => {
    const { instance } = await populatedInstance();
    expect(await instance.forgetResource('orders')).toBe(2);
    expect(await isCached(instance, 'bob', ['invoices:READ', 'orders:READ'])).toBe(false);
  });

  it.each(['', '*', 'a?b', 'a[0]', 'a\\b'])('rejects the identifier %j', async (value) => {
    const { instance } = await populatedInstance();
    await expect(instance.forgetUser(value)).rejects.toThrow(/invalid sub/);
    await expect(instance.forgetResource(value)).rejects.toThrow(/invalid resource/);
  });

  it('returns 0 when the cache is disabled', async () => {
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { umaCacheTtl: 0 });
    expect(await instance.forgetUser('alice')).toBe(0);
    expect(await instance.forgetResource('invoices')).toBe(0);
    expect(await new KeycloakInstance(AUTH_URL, REALM, CLIENT).forgetUser('alice')).toBe(0);
  });

  it('throws when the store cannot delete by pattern', async () => {
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, {
      umaCacheTtl: 60_000,
      umaCacheStore: { get: async () => null, set: async () => {} },
    });
    await expect(instance.forgetUser('alice')).rejects.toThrow(/deleteByPattern/);
    await expect(instance.forgetResource('invoices')).rejects.toThrow(/deleteByPattern/);
  });

  it('delegates to the store deleteByPattern (e.g. a Redis store)', async () => {
    const patterns: string[] = [];
    const store = {
      get: async () => null,
      set: async () => {},
      deleteByPattern: async (pattern: string) => {
        patterns.push(pattern);
        return 1;
      },
    };
    const instance = new KeycloakInstance(AUTH_URL, REALM, CLIENT, { umaCacheTtl: 60_000, umaCacheStore: store });
    expect(await instance.forgetUser('alice')).toBe(1);
    expect(await instance.forgetResource('invoices')).toBe(2);
    expect(patterns).toHaveLength(3);
  });
});

describe('InMemoryUmaCache', () => {
  it('stores, expires and evicts entries', async () => {
    vi.useFakeTimers();
    const cache = new InMemoryUmaCache();
    await cache.set('k', { granted: true, expiresAt: Date.now() + 1000 });
    expect(await cache.get('k')).toMatchObject({ granted: true });
    vi.advanceTimersByTime(2000);
    expect(await cache.get('k')).toBeNull();
    expect(await cache.get('unknown')).toBeNull();
    vi.useRealTimers();
  });
});

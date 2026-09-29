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

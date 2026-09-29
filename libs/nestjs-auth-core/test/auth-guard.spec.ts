import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { makeExecutionContext } from '@test/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/guards/AuthGuard';
import { META_PUBLIC } from '../src/decorators/Public';
import { TokenSource } from '../src/token-source/TokenSource';
import { TokenValidation } from '../src/constants';
import { InMemoryRevocationStore } from '../src/services/InMemoryRevocationStore';
import type { AuthConfig } from '../src/types/AuthConfig';
import { FakeInstance } from './fakes';

const header = (jwt: string) => ({ headers: { authorization: `Bearer ${jwt}` } });
const source = TokenSource.chain(TokenSource.header(), TokenSource.cookie('KEYCLOAK_JWT'));

function guard(instance: FakeInstance, config: AuthConfig = {}, resolver?: any, cache?: any, revocation?: any) {
  return new AuthGuard(instance as any, config, source, resolver, cache, revocation);
}

describe('AuthGuard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('rejects a missing token with 401', async () => {
    const g = guard(new FakeInstance());
    const ctx = makeExecutionContext({ request: { headers: {} } });
    await expect(g.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows a public route with no token', async () => {
    const g = guard(new FakeInstance());
    const ctx = makeExecutionContext({ request: { headers: {} }, handlerMeta: { [META_PUBLIC]: true } });
    await expect(g.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects an invalid token with 401', async () => {
    const g = guard(new FakeInstance({ valid: false }), { tokenValidation: TokenValidation.OFFLINE });
    const ctx = makeExecutionContext({ request: header('bad') });
    await expect(g.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows a public route even when the token fails validation', async () => {
    const g = guard(new FakeInstance({ valid: false }));
    const ctx = makeExecutionContext({ request: header('bad'), handlerMeta: { [META_PUBLIC]: true } });
    await expect(g.canActivate(ctx)).resolves.toBe(true);
  });

  it('sets user + authToken on success (no resolver)', async () => {
    const g = guard(new FakeInstance({ content: { sub: 's1', preferred_username: 'u' } }));
    const req: any = header('good');
    await g.canActivate(makeExecutionContext({ request: req }));
    expect(req.accessToken).toBe('good');
    expect(req.authToken).toBeDefined();
    expect(req.user.sub).toBe('s1');
    expect(req.authPrincipal).toBeUndefined();
  });

  it('NONE validation accepts without calling the provider validators', async () => {
    const instance = new FakeInstance({ valid: false });
    const g = guard(instance, { tokenValidation: TokenValidation.NONE });
    await expect(g.canActivate(makeExecutionContext({ request: header('x') }))).resolves.toBe(true);
    expect(instance.validateCalls).toBe(0);
  });

  it('ONLINE validation uses validateAccessToken', async () => {
    const instance = new FakeInstance();
    const spy = vi.spyOn(instance, 'validateAccessToken');
    const g = guard(instance, { tokenValidation: TokenValidation.ONLINE });
    await g.canActivate(makeExecutionContext({ request: header('x') }));
    expect(spy).toHaveBeenCalled();
  });

  describe('principal resolver', () => {
    it('resolves the principal and places it on request.user', async () => {
      const resolver = { resolve: vi.fn().mockResolvedValue({ subject: 's1', roles: ['app-admin'] }) };
      const g = guard(new FakeInstance({ content: { sub: 's1' } }), {}, resolver);
      const req: any = header('good');
      await g.canActivate(makeExecutionContext({ request: req }));
      expect(req.authPrincipal.roles).toEqual(['app-admin']);
      expect(req.user.roles).toEqual(['app-admin']);
      expect(resolver.resolve).toHaveBeenCalledOnce();
    });

    it('refuses with 401 and never calls the resolver when the token has no subject', async () => {
      const resolver = { resolve: vi.fn() };
      const g = guard(new FakeInstance({ identity: { subject: '' } }), {}, resolver);
      const ctx = makeExecutionContext({ request: header('ok') });
      await expect(g.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('maps ForbiddenException from resolve to 403', async () => {
      const resolver = { resolve: vi.fn().mockRejectedValue(new ForbiddenException()) };
      const g = guard(new FakeInstance(), {}, resolver);
      await expect(g.canActivate(makeExecutionContext({ request: header('good') }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('maps unexpected resolver errors to 401 (fail-closed)', async () => {
      const resolver = { resolve: vi.fn().mockRejectedValue(new Error('db down')) };
      const g = guard(new FakeInstance(), {}, resolver);
      await expect(g.canActivate(makeExecutionContext({ request: header('good') }))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('caches the principal — single resolve across two requests within TTL', async () => {
      const resolver = { resolve: vi.fn().mockResolvedValue({ subject: 's1', roles: [] }) };
      const g = guard(new FakeInstance({ content: { sub: 's1' } }), { principalCacheTtlMs: 60_000 }, resolver);
      await g.canActivate(makeExecutionContext({ request: header('a') }));
      await g.canActivate(makeExecutionContext({ request: header('b') }));
      expect(resolver.resolve).toHaveBeenCalledOnce();
    });

    it('does not cache when TTL is 0', async () => {
      const resolver = { resolve: vi.fn().mockResolvedValue({ subject: 's1', roles: [] }) };
      const g = guard(new FakeInstance({ content: { sub: 's1' } }), { principalCacheTtlMs: 0 }, resolver);
      await g.canActivate(makeExecutionContext({ request: header('a') }));
      await g.canActivate(makeExecutionContext({ request: header('b') }));
      expect(resolver.resolve).toHaveBeenCalledTimes(2);
    });
  });

  describe('revocation (back-channel logout)', () => {
    it('rejects a token whose sid is revoked', async () => {
      const store = new InMemoryRevocationStore();
      await store.revokeSid('sess-1', Date.now() + 60_000);
      const g = guard(new FakeInstance({ content: { sub: 's1', sid: 'sess-1' } }), {}, undefined, undefined, store);
      await expect(g.canActivate(makeExecutionContext({ request: header('good') }))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token whose subject is revoked', async () => {
      const store = new InMemoryRevocationStore();
      await store.revokeSubject('fake', 's1', Date.now() + 60_000);
      const g = guard(new FakeInstance({ content: { sub: 's1' } }), {}, undefined, undefined, store);
      await expect(g.canActivate(makeExecutionContext({ request: header('good') }))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token whose iat precedes the realm notBefore', async () => {
      const store = new InMemoryRevocationStore();
      const iss = 'https://kc/realms/acme';
      await store.setNotBefore(iss, 2000);
      const g = guard(
        new FakeInstance({ content: { sub: 's1', iss, iat: 1000 } }),
        {},
        undefined,
        undefined,
        store,
      );
      await expect(g.canActivate(makeExecutionContext({ request: header('good') }))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('allows a non-revoked token', async () => {
      const store = new InMemoryRevocationStore();
      const g = guard(new FakeInstance({ content: { sub: 's1', sid: 'sess-9' } }), {}, undefined, undefined, store);
      await expect(g.canActivate(makeExecutionContext({ request: header('good') }))).resolves.toBe(true);
    });
  });
});

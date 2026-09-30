import { APP_GUARD } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AuthModule } from '../src/module/AuthModule';
import {
  AUTH_CONNECT_OPTIONS,
  AUTH_GUARD,
  AUTH_INSTANCE,
  RESOURCE_GUARD,
  ROLE_GUARD,
  TOKEN_SOURCE,
  TokenValidation,
} from '../src/constants';
import type { AuthProvider } from '../src/types/AuthProvider';
import { FakeInstance } from './fakes';

const provider = (instance = new FakeInstance()): AuthProvider => ({ name: 'fake', instance });

const provideTokens = (mod: { providers?: any[] }) =>
  (mod.providers ?? []).map((p) => (typeof p === 'object' && 'provide' in p ? p.provide : p));

describe('AuthModule', () => {
  it('exposes the expected DI tokens and exports the guards', () => {
    const mod = AuthModule.register({ provider: provider() });
    const tokens = provideTokens(mod);
    expect(tokens).toEqual(
      expect.arrayContaining([AUTH_CONNECT_OPTIONS, AUTH_INSTANCE, TOKEN_SOURCE, AUTH_GUARD, ROLE_GUARD, RESOURCE_GUARD]),
    );
    expect(mod.exports).toEqual(
      expect.arrayContaining([AUTH_GUARD, ROLE_GUARD, RESOURCE_GUARD, AUTH_INSTANCE, TOKEN_SOURCE]),
    );
  });

  it('registers the guards as APP_GUARD by default', () => {
    const mod = AuthModule.register({ provider: provider() });
    const appGuards = (mod.providers ?? []).filter((p: any) => p?.provide === APP_GUARD);
    expect(appGuards).toHaveLength(3);
  });

  it('globalGuards:false registers no APP_GUARD', () => {
    const mod = AuthModule.register({ provider: provider(), globalGuards: false });
    const appGuards = (mod.providers ?? []).filter((p: any) => p?.provide === APP_GUARD);
    expect(appGuards).toHaveLength(0);
  });

  it('binds a principal resolver only when provided', () => {
    const withoutResolver = provideTokens(AuthModule.register({ provider: provider() }));
    const withResolver = provideTokens(
      AuthModule.register({ provider: provider(), principalResolver: { resolve: () => ({ subject: 's', roles: [] }) } }),
    );
    const has = (list: any[]) => list.some((t) => String(t).includes('PRINCIPAL_RESOLVER'));
    expect(has(withoutResolver)).toBe(false);
    expect(has(withResolver)).toBe(true);
  });

  it('throws at boot when ONLINE is requested with a provider that does not support it', () => {
    const offlineOnly = provider(new FakeInstance({ capabilities: { online: false } }));
    expect(() => AuthModule.register({ provider: offlineOnly, tokenValidation: TokenValidation.ONLINE })).toThrow(
      /ONLINE/,
    );
  });

  it('registerAsync wires the factory providers', () => {
    const mod = AuthModule.registerAsync({
      useFactory: () => ({ provider: provider() }),
    });
    const tokens = provideTokens(mod);
    expect(tokens).toEqual(expect.arrayContaining([AUTH_CONNECT_OPTIONS, AUTH_INSTANCE, TOKEN_SOURCE]));
    const appGuards = (mod.providers ?? []).filter((p: any) => p?.provide === APP_GUARD);
    expect(appGuards).toHaveLength(3);
  });

  it('registerAsync factories resolve the instance, config, source and resolver', async () => {
    const resolver = { resolve: () => ({ subject: 's', roles: [] }) };
    const mod = AuthModule.registerAsync({
      useFactory: () => ({ provider: provider(), principalResolver: resolver, cookieKey: 'C' }),
      globalGuards: false,
    });
    const byToken = (t: any) => (mod.providers ?? []).find((p: any) => p?.provide === t) as any;

    // Le provider "RESOLVED" est le premier ; on le résout puis on alimente les autres.
    const resolved = await (mod.providers ?? [])[0].useFactory();
    expect(byToken(AUTH_INSTANCE).useFactory(resolved)).toBeDefined();
    expect(byToken(AUTH_CONNECT_OPTIONS).useFactory(resolved).cookieKey).toBe('C');
    expect(byToken(TOKEN_SOURCE).useFactory(resolved)).toBeDefined();

    const appGuards = (mod.providers ?? []).filter((p: any) => p?.provide === APP_GUARD);
    expect(appGuards).toHaveLength(0);
  });

  it('registerAsync validates ONLINE support at resolve time', async () => {
    const offlineOnly = provider(new FakeInstance({ capabilities: { online: false } }));
    const mod = AuthModule.registerAsync({
      useFactory: () => ({ provider: offlineOnly, tokenValidation: TokenValidation.ONLINE }),
    });
    await expect((mod.providers ?? [])[0].useFactory()).rejects.toThrow(/ONLINE/);
  });
});

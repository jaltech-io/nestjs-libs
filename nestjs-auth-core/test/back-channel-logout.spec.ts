import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BackChannelLogoutService } from '../src/services/BackChannelLogoutService';
import { BackChannelLogoutModule } from '../src/module/BackChannelLogoutModule';
import { InMemoryRevocationStore } from '../src/services/InMemoryRevocationStore';
import { REVOCATION_STORE, BACKCHANNEL_LOGOUT_VALIDATOR } from '../src/constants';
import type { AuthProvider } from '../src/types/AuthProvider';
import { FakeInstance } from './fakes';

const event = { provider: 'keycloak', issuer: 'https://kc/realms/acme', sid: 'sess-1', subject: 'sub-1', jti: 'jti-1' };

describe('BackChannelLogoutService', () => {
  it('validates, revokes sid and subject', async () => {
    const store = new InMemoryRevocationStore();
    const validator = { validateLogoutToken: vi.fn().mockResolvedValue(event) };
    const service = new BackChannelLogoutService(validator as any, store, { revocationTtlMs: 60_000 });

    await service.handle('logout.jwt');
    expect(await store.isSidRevoked('sess-1')).toBe(true);
    expect(await store.isSubjectRevoked('keycloak', 'sub-1')).toBe(true);
  });

  it('rejects a replayed logout_token (same jti)', async () => {
    const store = new InMemoryRevocationStore();
    const validator = { validateLogoutToken: vi.fn().mockResolvedValue(event) };
    const service = new BackChannelLogoutService(validator as any, store, {});
    await service.handle('logout.jwt');
    await expect(service.handle('logout.jwt')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing logout_token', async () => {
    const service = new BackChannelLogoutService(
      { validateLogoutToken: vi.fn() } as any,
      new InMemoryRevocationStore(),
      {},
    );
    await expect(service.handle(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps an invalid logout_token to 400', async () => {
    const validator = { validateLogoutToken: vi.fn().mockRejectedValue(new Error('bad signature')) };
    const service = new BackChannelLogoutService(validator as any, new InMemoryRevocationStore(), {});
    await expect(service.handle('bad')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('BackChannelLogoutModule', () => {
  const supported: AuthProvider = {
    name: 'keycloak',
    instance: new FakeInstance({ capabilities: { backChannelLogout: true } }),
    backChannelLogout: { validateLogoutToken: async () => event },
  };

  it('registers the revocation store, validator and controller', () => {
    const mod = BackChannelLogoutModule.register({ provider: supported });
    const tokens = (mod.providers ?? []).map((p: any) => (p?.provide ? p.provide : p));
    expect(tokens).toEqual(expect.arrayContaining([REVOCATION_STORE, BACKCHANNEL_LOGOUT_VALIDATOR]));
    expect(mod.controllers).toHaveLength(1);
    expect(mod.exports).toEqual(expect.arrayContaining([REVOCATION_STORE]));
  });

  it('throws at boot when the provider does not support back-channel logout', () => {
    const unsupported: AuthProvider = { name: 'entra', instance: new FakeInstance({ capabilities: { backChannelLogout: false } }) };
    expect(() => BackChannelLogoutModule.register({ provider: unsupported })).toThrow(/does not support/);
  });
});

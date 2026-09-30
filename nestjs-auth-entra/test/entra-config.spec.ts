import { AuthModule, ResourceGuard, TokenValidation } from '@jaltech/nestjs-auth-core';
import { makeExecutionContext } from '@test/context';
import { describe, expect, it } from 'vitest';
import { EntraProvider } from '../src/EntraProvider';

const provider = () => EntraProvider.create({ tenantId: 't', clientId: 'c' });

describe('Entra + AuthModule config validation', () => {
  it('throws at boot when ONLINE validation is requested with Entra', () => {
    expect(() => AuthModule.register({ provider: provider(), tokenValidation: TokenValidation.ONLINE })).toThrow(
      /ONLINE/,
    );
  });

  it('registers fine with OFFLINE validation', () => {
    expect(() => AuthModule.register({ provider: provider(), tokenValidation: TokenValidation.OFFLINE })).not.toThrow();
  });

  it('@Resource with Entra makes the ResourceGuard refuse (fail-closed)', async () => {
    const guard = new ResourceGuard(provider().instance as any, {});
    const ctx = makeExecutionContext({
      request: { url: '/x', method: 'GET', headers: {}, user: { sub: 's' }, authToken: { content: {} } },
      handlerMeta: { resource: 'Product', scopes: ['View'] },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });
});

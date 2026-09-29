import { makeExecutionContext } from '@test/context';
import { describe, expect, it } from 'vitest';
import { ResourceGuard } from '../src/guards/ResourceGuard';
import { META_RESOURCE } from '../src/decorators/Resource';
import { META_SCOPES } from '../src/decorators/Scopes';
import { PolicyEnforcementMode } from '../src/constants';
import type { AuthConfig } from '../src/types/AuthConfig';
import { FakeInstance, FakeToken } from './fakes';

function guard(instance: FakeInstance, config: AuthConfig = {}) {
  return new ResourceGuard(instance as any, config);
}

const req = () => ({ url: '/x', method: 'GET', headers: {}, authToken: new FakeToken('t'), user: { sub: 's' } });

describe('ResourceGuard', () => {
  it('allows when no @Resource and policy is PERMISSIVE', async () => {
    const ctx = makeExecutionContext({ request: req() });
    await expect(guard(new FakeInstance()).canActivate(ctx)).resolves.toBe(true);
  });

  it('denies when no @Resource and policy is ENFORCING', async () => {
    const ctx = makeExecutionContext({ request: req() });
    await expect(
      guard(new FakeInstance(), { policyEnforcement: PolicyEnforcementMode.ENFORCING }).canActivate(ctx),
    ).resolves.toBe(false);
  });

  it('refuses (fail-closed) when @Resource is used with a provider lacking UMA', async () => {
    const instance = new FakeInstance({ capabilities: { uma: false } });
    const ctx = makeExecutionContext({
      request: req(),
      handlerMeta: { [META_RESOURCE]: 'Product', [META_SCOPES]: ['View'] },
    });
    await expect(guard(instance).canActivate(ctx)).resolves.toBe(false);
  });

  it('grants when the UMA enforcer allows', async () => {
    const instance = new FakeInstance({ enforce: true });
    const ctx = makeExecutionContext({
      request: req(),
      handlerMeta: { [META_RESOURCE]: 'Product', [META_SCOPES]: ['View'] },
    });
    await expect(guard(instance).canActivate(ctx)).resolves.toBe(true);
  });

  it('denies when the UMA enforcer refuses', async () => {
    const instance = new FakeInstance({ enforce: false });
    const ctx = makeExecutionContext({
      request: req(),
      handlerMeta: { [META_RESOURCE]: 'Product', [META_SCOPES]: ['View'] },
    });
    await expect(guard(instance).canActivate(ctx)).resolves.toBe(false);
  });

  it('shadow mode allows despite an enforcer refusal', async () => {
    const instance = new FakeInstance({ enforce: false });
    const ctx = makeExecutionContext({
      request: req(),
      handlerMeta: { [META_RESOURCE]: 'Product', [META_SCOPES]: ['View'] },
    });
    await expect(guard(instance, { enforcementShadow: true }).canActivate(ctx)).resolves.toBe(true);
  });

  it('derives the scope from the HTTP verb when verbScopeDefaults is on', async () => {
    const instance = new FakeInstance({ enforce: true });
    const request = { ...req(), method: 'DELETE' };
    const ctx = makeExecutionContext({ request, handlerMeta: { [META_RESOURCE]: 'Product' } });
    await guard(instance, { verbScopeDefaults: true }).canActivate(ctx);
    expect(request.scopes).toEqual(['DELETE']);
  });
});

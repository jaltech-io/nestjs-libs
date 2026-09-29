import { makeExecutionContext } from '@test/context';
import { describe, expect, it } from 'vitest';
import { PolicyEnforcementMode } from '../src/constants';
import { META_PUBLIC } from '../src/decorators/Public';
import { META_RESOURCE } from '../src/decorators/Resource';
import { META_CONDITIONAL_SCOPES, META_SCOPES } from '../src/decorators/Scopes';
import { META_ENFORCER_OPTIONS } from '../src/decorators/UseEnforcerOptions';
import { ResourceGuard } from '../src/guards/ResourceGuard';
import type { AuthConfig } from '../src/types/AuthConfig';
import { extractRequest } from '../src/utils/ExtractRequestUtil';
import { FakeInstance, FakeToken } from './fakes';

const guard = (instance: FakeInstance, config: AuthConfig = {}) => new ResourceGuard(instance as any, config);
const withResource = { [META_RESOURCE]: 'Product' };

describe('ResourceGuard — edge branches', () => {
  it('allows when the execution context carries no request (non-http transport)', async () => {
    const ctx = makeExecutionContext({ type: 'rpc', handlerMeta: withResource });
    await expect(guard(new FakeInstance()).canActivate(ctx)).resolves.toBe(true);
  });

  it('allows a public route that has no authenticated user', async () => {
    const ctx = makeExecutionContext({
      request: { url: '/p', method: 'GET', headers: {} },
      classMeta: { [META_PUBLIC]: true },
      handlerMeta: withResource,
    });
    await expect(guard(new FakeInstance({ enforce: false })).canActivate(ctx)).resolves.toBe(true);
  });

  it('reads @Resource from the controller class when the handler has none', async () => {
    const request: any = { url: '/x', method: 'GET', headers: {}, authToken: new FakeToken('t'), user: {} };
    const ctx = makeExecutionContext({ request, classMeta: withResource, handlerMeta: { [META_SCOPES]: ['READ'] } });
    await expect(guard(new FakeInstance({ enforce: false })).canActivate(ctx)).resolves.toBe(false);
  });

  it('rebuilds the token from request.accessToken when AuthGuard did not attach one', async () => {
    const request: any = { url: '/x', method: 'GET', headers: {}, accessToken: 'raw.jwt.token', user: {} };
    const ctx = makeExecutionContext({ request, handlerMeta: { ...withResource, [META_SCOPES]: ['READ'] } });
    await expect(guard(new FakeInstance({ enforce: true })).canActivate(ctx)).resolves.toBe(true);
  });

  it('falls back to the enforcement policy when rebuilding the token fails', async () => {
    const instance = new FakeInstance();
    instance.createGrant = async () => {
      throw new Error('bad token');
    };
    const request: any = { url: '/x', method: 'GET', headers: {}, accessToken: 'garbage', user: {} };
    const ctx = makeExecutionContext({ request, handlerMeta: { ...withResource, [META_SCOPES]: ['READ'] } });
    await expect(guard(instance).canActivate(ctx)).resolves.toBe(true);
    await expect(
      guard(instance, { policyEnforcement: PolicyEnforcementMode.ENFORCING }).canActivate(
        makeExecutionContext({ request, handlerMeta: { ...withResource, [META_SCOPES]: ['READ'] } }),
      ),
    ).resolves.toBe(false);
  });

  it('falls back to the enforcement policy when there is no token at all', async () => {
    const request: any = { url: '/x', method: 'GET', headers: {}, user: {} };
    const ctx = makeExecutionContext({ request, handlerMeta: { ...withResource, [META_SCOPES]: ['READ'] } });
    await expect(
      guard(new FakeInstance(), { policyEnforcement: PolicyEnforcementMode.ENFORCING }).canActivate(ctx),
    ).resolves.toBe(false);
  });

  it.each([
    ['GET', 'READ'],
    ['HEAD', 'READ'],
    ['POST', 'CREATE'],
    ['PUT', 'UPDATE'],
    ['PATCH', 'UPDATE'],
    ['DELETE', 'DELETE'],
  ])('maps %s to the %s scope when verbScopeDefaults is on', async (method, scope) => {
    const request: any = { url: '/x', method, headers: {}, authToken: new FakeToken('t'), user: {} };
    const ctx = makeExecutionContext({ request, handlerMeta: withResource });
    await guard(new FakeInstance({ enforce: true }), { verbScopeDefaults: true }).canActivate(ctx);
    expect(request.scopes).toEqual([scope]);
  });

  it('derives no scope for an unknown verb and applies the enforcement policy', async () => {
    const request: any = { url: '/x', method: 'OPTIONS', headers: {}, authToken: new FakeToken('t'), user: {} };
    const ctx = makeExecutionContext({ request, handlerMeta: withResource });
    await expect(
      guard(new FakeInstance(), { verbScopeDefaults: true, policyEnforcement: PolicyEnforcementMode.ENFORCING }).canActivate(ctx),
    ).resolves.toBe(false);
    expect(request.scopes).toEqual([]);
  });

  it('applies the enforcement policy when a resource has no scope and verb defaults are off', async () => {
    const request: any = { url: '/x', method: 'GET', headers: {}, authToken: new FakeToken('t'), user: {} };
    const ctx = makeExecutionContext({ request, handlerMeta: withResource });
    await expect(guard(new FakeInstance()).canActivate(ctx)).resolves.toBe(true);
  });

  it('merges conditional scopes with explicit ones and prefers explicit scopes over verb defaults', async () => {
    const request: any = { url: '/x', method: 'DELETE', headers: {}, authToken: new FakeToken('t'), user: {} };
    const conditional = () => ['EXTRA'];
    const ctx = makeExecutionContext({
      request,
      handlerMeta: { ...withResource, [META_SCOPES]: ['READ'], [META_CONDITIONAL_SCOPES]: conditional },
    });
    await guard(new FakeInstance({ enforce: true }), { verbScopeDefaults: true }).canActivate(ctx);
    expect(request.scopes).toEqual(['READ', 'EXTRA']);
  });

  it('passes custom enforcer options declared with @UseEnforcerOptions', async () => {
    const seen: any[] = [];
    const instance = new FakeInstance({ enforce: true });
    instance.enforcer = ((_perms: string[], options?: any) => {
      seen.push(options);
      return async (_req: any, _res: any, next: any) => next();
    }) as any;
    const custom = { response_mode: 'decision' };
    const request: any = { url: '/x', method: 'GET', headers: {}, authToken: new FakeToken('t'), user: {} };
    const ctx = makeExecutionContext({
      request,
      handlerMeta: { ...withResource, [META_SCOPES]: ['READ'], [META_ENFORCER_OPTIONS]: custom },
    });
    await guard(instance).canActivate(ctx);
    expect(seen[0]).toBe(custom);
  });

  it('builds default enforcer claims from the request uri and user agent', async () => {
    const seen: any[] = [];
    const instance = new FakeInstance({ enforce: true });
    instance.enforcer = ((_perms: string[], options?: any) => {
      seen.push(options);
      return async (_req: any, _res: any, next: any) => next();
    }) as any;
    const request: any = {
      url: '/orders',
      method: 'GET',
      headers: { 'user-agent': 'vitest' },
      authToken: new FakeToken('t'),
      user: {},
    };
    const ctx = makeExecutionContext({ request, handlerMeta: { ...withResource, [META_SCOPES]: ['READ'] } });
    await guard(instance).canActivate(ctx);
    expect(seen[0].claims(request)).toEqual({ 'http.uri': ['/orders'], 'user.agent': ['vitest'] });
  });
});

describe('extractRequest', () => {
  it('returns [undefined, undefined] for unsupported transports', () => {
    expect(extractRequest(makeExecutionContext({ type: 'rpc' }))).toEqual([undefined, undefined]);
  });
});

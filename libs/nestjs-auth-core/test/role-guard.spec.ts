import { makeExecutionContext } from '@test/context';
import { describe, expect, it } from 'vitest';
import { RoleGuard } from '../src/guards/RoleGuard';
import { META_ROLES, META_ROLE_MATCHING_MODE } from '../src/decorators/Roles';
import { RoleMatch, RoleMerge } from '../src/constants';
import type { AuthConfig } from '../src/types/AuthConfig';
import { FakeInstance, FakeToken } from './fakes';

function guard(config: AuthConfig = {}) {
  return new RoleGuard(new FakeInstance() as any, config);
}

/** Requête portant un token déjà validé (authToken) avec les rôles donnés. */
const reqWithRoles = (roles: string[]) => ({ authToken: new FakeToken('t', {}, roles) });

describe('RoleGuard', () => {
  it('allows when no @Roles is declared', async () => {
    const ctx = makeExecutionContext({ request: reqWithRoles([]) });
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
  });

  it('ANY: grants if at least one role matches', async () => {
    const ctx = makeExecutionContext({
      request: reqWithRoles(['moderator']),
      handlerMeta: { [META_ROLES]: ['admin', 'moderator'], [META_ROLE_MATCHING_MODE]: RoleMatch.ANY },
    });
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
  });

  it('ALL: denies if one role is missing', async () => {
    const ctx = makeExecutionContext({
      request: reqWithRoles(['admin']),
      handlerMeta: { [META_ROLES]: ['admin', 'moderator'], [META_ROLE_MATCHING_MODE]: RoleMatch.ALL },
    });
    await expect(guard().canActivate(ctx)).resolves.toBe(false);
  });

  it('ALL: grants when every role is present', async () => {
    const ctx = makeExecutionContext({
      request: reqWithRoles(['admin', 'moderator']),
      handlerMeta: { [META_ROLES]: ['admin', 'moderator'], [META_ROLE_MATCHING_MODE]: RoleMatch.ALL },
    });
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
  });

  it('roleMerge OVERRIDE: handler roles replace class roles', async () => {
    const ctx = makeExecutionContext({
      request: reqWithRoles(['editor']),
      handlerMeta: { [META_ROLES]: ['editor'] },
      classMeta: { [META_ROLES]: ['admin'] },
    });
    await expect(guard({ roleMerge: RoleMerge.OVERRIDE }).canActivate(ctx)).resolves.toBe(true);
  });

  it('roleMerge ALL: handler roles add to class roles', async () => {
    const ctx = makeExecutionContext({
      request: reqWithRoles(['admin']),
      handlerMeta: { [META_ROLES]: ['editor'], [META_ROLE_MATCHING_MODE]: RoleMatch.ANY },
      classMeta: { [META_ROLES]: ['admin'] },
    });
    await expect(guard({ roleMerge: RoleMerge.ALL }).canActivate(ctx)).resolves.toBe(true);
  });

  it('uses resolved principal roles instead of token roles', async () => {
    const req: any = {
      authToken: new FakeToken('t', {}, ['token-role']),
      authPrincipal: { subject: 's', roles: ['principal-role'] },
    };
    const ctx = makeExecutionContext({ request: req, handlerMeta: { [META_ROLES]: ['principal-role'] } });
    await expect(guard().canActivate(ctx)).resolves.toBe(true);

    const ctx2 = makeExecutionContext({ request: req, handlerMeta: { [META_ROLES]: ['token-role'] } });
    await expect(guard().canActivate(ctx2)).resolves.toBe(false);
  });

  it('denies (fail-closed) when no token/principal is present but a role is required', async () => {
    const ctx = makeExecutionContext({ request: {}, handlerMeta: { [META_ROLES]: ['admin'] } });
    await expect(guard().canActivate(ctx)).resolves.toBe(false);
  });
});

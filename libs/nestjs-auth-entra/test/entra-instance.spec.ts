import { type Keypair, makeKeypair, signJwt, stubFetch } from '@test/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntraProvider } from '../src/EntraProvider';
import { EntraInstance } from '../src/services/EntraInstance';
import { resolveEntraConfig } from '../src/types/EntraConfig';

const TENANT = 'tid-123';
const CLIENT = 'client-abc';
const V2_ISS = `https://login.microsoftonline.com/${TENANT}/v2.0`;
const V1_ISS = `https://sts.windows.net/${TENANT}/`;
const KEYS = `https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`;

let kp: Keypair;

beforeEach(async () => {
  kp = await makeKeypair('entra-1');
  stubFetch({ jwks: [{ urlIncludes: '/discovery/v2.0/keys', keys: [kp.jwk] }] });
});
afterEach(() => vi.unstubAllGlobals());

function instance(overrides = {}) {
  return new EntraInstance(resolveEntraConfig({ tenantId: TENANT, clientId: CLIENT, ...overrides }));
}

const base = () => ({ iss: V2_ISS, aud: CLIENT, tid: TENANT, oid: 'oid-1', sub: 'sub-1' });

const validate = (inst: EntraInstance, jwt: string) =>
  inst.createGrant({ access_token: jwt }).then((g) => inst.validateToken(g.access_token, 'Bearer'));

describe('EntraInstance — offline validation', () => {
  it('accepts a valid v2 token', async () => {
    expect(await validate(instance(), await signJwt(kp, base()))).toBeTruthy();
  });

  it('accepts a v1 token (both issuers configured by default)', async () => {
    expect(await validate(instance(), await signJwt(kp, { ...base(), iss: V1_ISS }))).toBeTruthy();
  });

  it('rejects a wrong issuer', async () => {
    expect(await validate(instance(), await signJwt(kp, { ...base(), iss: 'https://evil/v2.0' }))).toBe(false);
  });

  it('rejects a wrong audience', async () => {
    expect(await validate(instance(), await signJwt(kp, { ...base(), aud: 'other-api' }))).toBe(false);
  });

  it('accepts the api://<clientId> audience', async () => {
    expect(await validate(instance(), await signJwt(kp, { ...base(), aud: `api://${CLIENT}` }))).toBeTruthy();
  });

  it('rejects a wrong tenant', async () => {
    expect(await validate(instance(), await signJwt(kp, { ...base(), tid: 'other-tenant' }))).toBe(false);
  });

  it('rejects a token without an oid (no stable identity)', async () => {
    const { oid: _oid, ...withoutOid } = base();
    expect(await validate(instance(), await signJwt(kp, withoutOid))).toBe(false);
    expect(await validate(instance(), await signJwt(kp, { ...base(), oid: '' }))).toBe(false);
  });

  it('rejects a bad signature', async () => {
    const other = await makeKeypair('entra-1');
    expect(await validate(instance(), await signJwt(other, base()))).toBe(false);
  });

  it('rejects an expired token', async () => {
    expect(await validate(instance(), await signJwt(kp, base(), { expiresInSec: -3600 }))).toBe(false);
  });

  it('rejects a token with a future nbf', async () => {
    expect(await validate(instance(), await signJwt(kp, base(), { notBeforeSec: 3600 }))).toBe(false);
  });

  it('rejects an app token unless allowAppTokens', async () => {
    expect(await validate(instance(), await signJwt(kp, { ...base(), idtyp: 'app' }))).toBe(false);
    expect(await validate(instance({ allowAppTokens: true }), await signJwt(kp, { ...base(), idtyp: 'app' }))).toBeTruthy();
  });

  it('rejects when a required scope is missing, accepts when present', async () => {
    const inst = instance({ requiredScopes: ['access_as_user'] });
    expect(await validate(inst, await signJwt(kp, { ...base(), scp: 'openid profile' }))).toBe(false);
    expect(await validate(inst, await signJwt(kp, { ...base(), scp: 'openid access_as_user' }))).toBeTruthy();
  });

  describe('membersOnly', () => {
    it('accepts acct=0 (member)', async () => {
      expect(await validate(instance({ membersOnly: true }), await signJwt(kp, { ...base(), acct: 0 }))).toBeTruthy();
    });
    it('rejects acct=1 (guest)', async () => {
      expect(await validate(instance({ membersOnly: true }), await signJwt(kp, { ...base(), acct: 1 }))).toBe(false);
    });
    it('rejects when acct is absent (fail-closed)', async () => {
      expect(await validate(instance({ membersOnly: true }), await signJwt(kp, base()))).toBe(false);
    });
  });
});

describe('EntraInstance — toIdentity & capabilities', () => {
  it('maps oid→subject, tid→tenantId, lowercases email, derives accountType', () => {
    const inst = instance();
    const identity = inst.toIdentity({
      token: 't',
      content: { oid: 'o1', tid: TENANT, email: 'USER@X.COM', name: 'Jane', acct: 0 },
    } as any);
    expect(identity).toMatchObject({
      provider: 'entra',
      subject: 'o1',
      tenantId: TENANT,
      email: 'user@x.com',
      displayName: 'Jane',
      accountType: 'member',
    });
  });

  it('falls back to preferred_username for email/displayName, marks guests', () => {
    const identity = instance().toIdentity({
      token: 't',
      content: { oid: 'o2', tid: TENANT, preferred_username: 'Guest@Ext.com', acct: 1 },
    } as any);
    expect(identity.email).toBe('guest@ext.com');
    expect(identity.displayName).toBe('Guest@Ext.com');
    expect(identity.accountType).toBe('guest');
  });

  it('declares no online, no uma, no back-channel logout', () => {
    expect(instance().capabilities).toEqual({ online: false, uma: false, backChannelLogout: false });
  });

  it('online validation and UMA enforcement fail closed', async () => {
    const inst = instance();
    await expect(inst.validateAccessToken({ token: 't', content: {} } as any)).rejects.toThrow(/ONLINE/);
    const req: any = {};
    await inst.enforcer()(req, {}, () => {});
    expect(req.resourceDenied).toBe(true);
  });
});

describe('EntraProvider', () => {
  it('throws when tenantId or clientId is missing', () => {
    expect(() => EntraProvider.create({ tenantId: '', clientId: CLIENT } as any)).toThrow(/missing/);
    expect(() => EntraProvider.create({ tenantId: TENANT, clientId: '' } as any)).toThrow(/missing/);
  });

  it('applies the documented defaults', () => {
    const cfg = resolveEntraConfig({ tenantId: TENANT, clientId: CLIENT });
    expect(cfg.audiences).toEqual([CLIENT, `api://${CLIENT}`]);
    expect(cfg.issuers).toEqual([V2_ISS, V1_ISS]);
    expect(cfg.jwksUri).toBe(KEYS);
    expect(cfg.roleClaim).toBe('roles');
    expect(cfg.clockToleranceSec).toBe(60);
  });
});

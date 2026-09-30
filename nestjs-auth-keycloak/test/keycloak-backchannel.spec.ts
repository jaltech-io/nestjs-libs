import { type Keypair, makeKeypair, signJwt, stubFetch } from '@test/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeycloakProvider } from '../src/KeycloakProvider';

const AUTH_URL = 'https://kc.test';
const REALM = 'acme';
const CLIENT = 'api';
const ISSUER = `${AUTH_URL}/realms/${REALM}`;
const CERTS = `${ISSUER}/protocol/openid-connect/certs`;
const EVENT = 'http://schemas.openid.net/event/backchannel-logout';

let kp: Keypair;

beforeEach(async () => {
  kp = await makeKeypair('kc-1');
  stubFetch({ jwks: [{ urlIncludes: CERTS, keys: [kp.jwk] }] });
});
afterEach(() => vi.unstubAllGlobals());

function validator() {
  return KeycloakProvider.create({ authServerUrl: AUTH_URL, realm: REALM, clientId: CLIENT }).backChannelLogout!;
}

const logoutToken = (extra: Record<string, unknown>) =>
  signJwt(kp, { iss: ISSUER, aud: CLIENT, jti: 'jti-1', events: { [EVENT]: {} }, sid: 'sess-1', sub: 'u1', ...extra });

describe('KeycloakBackChannelLogout', () => {
  it('validates a well-formed logout_token', async () => {
    const event = await validator().validateLogoutToken(await logoutToken({}));
    expect(event).toMatchObject({ provider: 'keycloak', issuer: ISSUER, sid: 'sess-1', subject: 'u1', jti: 'jti-1' });
  });

  it('rejects a token missing the backchannel-logout event', async () => {
    const jwt = await signJwt(kp, { iss: ISSUER, aud: CLIENT, jti: 'j', sid: 's' });
    await expect(validator().validateLogoutToken(jwt)).rejects.toThrow(/event/);
  });

  it('rejects a token carrying a nonce (prohibited)', async () => {
    await expect(validator().validateLogoutToken(await logoutToken({ nonce: 'x' }))).rejects.toThrow(/nonce/);
  });

  it('rejects a token with neither sid nor sub', async () => {
    const jwt = await signJwt(kp, { iss: ISSUER, aud: CLIENT, jti: 'j', events: { [EVENT]: {} } });
    await expect(validator().validateLogoutToken(jwt)).rejects.toThrow(/sid nor sub/);
  });

  it('rejects a wrong audience', async () => {
    await expect(validator().validateLogoutToken(await logoutToken({ aud: 'other' }))).rejects.toThrow(/audience/);
  });

  it('rejects an unknown issuer', async () => {
    const jwt = await signJwt(kp, { iss: 'https://evil/realms/x', aud: CLIENT, jti: 'j', events: { [EVENT]: {} }, sid: 's' });
    await expect(validator().validateLogoutToken(jwt)).rejects.toThrow(/unknown issuer/);
  });

  it('rejects a bad signature', async () => {
    const other = await makeKeypair('kc-1');
    const jwt = await signJwt(other, { iss: ISSUER, aud: CLIENT, jti: 'j', events: { [EVENT]: {} }, sid: 's' });
    await expect(validator().validateLogoutToken(jwt)).rejects.toBeInstanceOf(Error);
  });
});

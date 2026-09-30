import { describe, expect, it } from 'vitest';
import { TokenSource, defaultTokenSource } from '../src/token-source/TokenSource';

describe('TokenSource', () => {
  it('header() reads Authorization: Bearer', () => {
    const src = TokenSource.header();
    expect(src.extract({ headers: { authorization: 'Bearer abc' } })).toBe('abc');
    expect(src.extract({ headers: { authorization: 'bearer xyz' } })).toBe('xyz');
    expect(src.extract({ headers: {} })).toBeNull();
    expect(src.extract({ headers: { authorization: 'Basic zzz' } })).toBeNull();
  });

  it('cookie() reads the named cookie', () => {
    const src = TokenSource.cookie('KEYCLOAK_JWT');
    expect(src.extract({ cookies: { KEYCLOAK_JWT: 'tok' } })).toBe('tok');
    expect(src.extract({ cookies: {} })).toBeNull();
    expect(src.extract({})).toBeNull();
  });

  it('session() reads a dotted path', () => {
    const src = TokenSource.session('tokens.accessToken');
    expect(src.extract({ session: { tokens: { accessToken: 'sess' } } })).toBe('sess');
    expect(src.extract({ session: { tokens: {} } })).toBeNull();
    expect(src.extract({ session: {} })).toBeNull();
    expect(src.extract({})).toBeNull();
  });

  it('chain() returns the first non-null source, in order', () => {
    const src = TokenSource.chain(TokenSource.header(), TokenSource.cookie('KEYCLOAK_JWT'));
    // header wins when both present
    expect(src.extract({ headers: { authorization: 'Bearer H' }, cookies: { KEYCLOAK_JWT: 'C' } })).toBe('H');
    // cookie used when header absent
    expect(src.extract({ headers: {}, cookies: { KEYCLOAK_JWT: 'C' } })).toBe('C');
    expect(src.extract({ headers: {}, cookies: {} })).toBeNull();
  });

  it('defaultTokenSource matches the historical header+cookie behavior', () => {
    const src = defaultTokenSource();
    expect(src.extract({ headers: { authorization: 'Bearer H' } })).toBe('H');
    expect(src.extract({ cookies: { KEYCLOAK_JWT: 'C' } })).toBe('C');
    const custom = defaultTokenSource('MY_COOKIE');
    expect(custom.extract({ cookies: { MY_COOKIE: 'C2' } })).toBe('C2');
  });
});

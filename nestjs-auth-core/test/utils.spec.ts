import { makeExecutionContext } from '@test/context';
import { describe, expect, it } from 'vitest';
import { extractRequest } from '../src/utils/ExtractRequestUtil';
import { parseToken } from '../src/utils/ParseTokenUtil';

describe('parseToken', () => {
  it('decodes a JWT payload', () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const jwt = `${b64({ alg: 'RS256' })}.${b64({ sub: 'u1', roles: ['a'] })}.sig`;
    expect(parseToken(jwt)).toMatchObject({ sub: 'u1', roles: ['a'] });
  });

  it('throws on a malformed token', () => {
    expect(() => parseToken('not-a-jwt')).toThrow(/Malformed/);
  });
});

describe('extractRequest', () => {
  it('returns [request, response] for an http context', () => {
    const ctx = makeExecutionContext({ request: { id: 1 }, response: { id: 2 }, type: 'http' });
    const [req, res] = extractRequest(ctx);
    expect(req).toEqual({ id: 1 });
    expect(res).toEqual({ id: 2 });
  });

  it('returns [undefined, undefined] for an unsupported context type', () => {
    const ctx = makeExecutionContext({ type: 'ws' });
    expect(extractRequest(ctx)).toEqual([undefined, undefined]);
  });
});

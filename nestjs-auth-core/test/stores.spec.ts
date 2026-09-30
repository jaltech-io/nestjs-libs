import { describe, expect, it, vi } from 'vitest';
import { InMemoryRevocationStore } from '../src/services/InMemoryRevocationStore';
import { InMemoryPrincipalCache } from '../src/services/InMemoryPrincipalCache';

describe('InMemoryRevocationStore', () => {
  it('expires revocations by TTL', async () => {
    vi.useFakeTimers();
    const store = new InMemoryRevocationStore();
    await store.revokeSid('s', Date.now() + 1000);
    expect(await store.isSidRevoked('s')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(await store.isSidRevoked('s')).toBe(false);
    vi.useRealTimers();
  });

  it('registerJti returns false on replay', async () => {
    const store = new InMemoryRevocationStore();
    expect(await store.registerJti('j', Date.now() + 1000)).toBe(true);
    expect(await store.registerJti('j', Date.now() + 1000)).toBe(false);
  });

  it('keeps the most recent notBefore', async () => {
    const store = new InMemoryRevocationStore();
    await store.setNotBefore('r', 1000);
    await store.setNotBefore('r', 500); // ignored (older)
    expect(await store.getNotBefore('r')).toBe(1000);
    await store.setNotBefore('r', 2000);
    expect(await store.getNotBefore('r')).toBe(2000);
    expect(await store.getNotBefore('unknown')).toBeNull();
  });

  it('tracks subject revocation independently', async () => {
    const store = new InMemoryRevocationStore();
    await store.revokeSubject('keycloak', 'u1', Date.now() + 1000);
    expect(await store.isSubjectRevoked('keycloak', 'u1')).toBe(true);
    expect(await store.isSubjectRevoked('keycloak', 'u2')).toBe(false);
  });
});

describe('InMemoryPrincipalCache', () => {
  it('stores and expires principals', async () => {
    vi.useFakeTimers();
    const cache = new InMemoryPrincipalCache();
    await cache.set('k', { subject: 's', roles: [] }, 1000);
    expect(await cache.get('k')).toEqual({ subject: 's', roles: [] });
    vi.advanceTimersByTime(1500);
    expect(await cache.get('k')).toBeNull();
    vi.useRealTimers();
  });

  it('returns null for an unknown key', async () => {
    const cache = new InMemoryPrincipalCache();
    expect(await cache.get('nope')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { KeycloakProvider } from '../src/KeycloakProvider';

describe('KeycloakProvider.create', () => {
  it('builds a provider with UMA + back-channel logout capabilities', () => {
    const provider = KeycloakProvider.create({ authServerUrl: 'https://kc', realm: 'r', clientId: 'c' });
    expect(provider.name).toBe('keycloak');
    expect(provider.instance.capabilities).toMatchObject({ online: true, uma: true, backChannelLogout: true });
    expect(provider.backChannelLogout).toBeDefined();
  });

  it('throws when required options are missing', () => {
    expect(() => KeycloakProvider.create({ authServerUrl: '', realm: 'r', clientId: 'c' } as any)).toThrow(/missing/);
    expect(() => KeycloakProvider.create({ authServerUrl: 'u', realm: '', clientId: 'c' } as any)).toThrow(/missing/);
    expect(() => KeycloakProvider.create({ authServerUrl: 'u', realm: 'r', clientId: '' } as any)).toThrow(/missing/);
  });
});

describe('KeycloakProvider.createMultiRealm', () => {
  it('builds an offline multi-realm provider (no UMA, no online)', () => {
    const provider = KeycloakProvider.createMultiRealm({
      realms: [{ realm: 'a', clientId: 'api', issuer: 'https://kc/realms/a' }],
    });
    expect(provider.instance.capabilities).toMatchObject({ online: false, uma: false, backChannelLogout: true });
    expect(provider.backChannelLogout).toBeDefined();
  });

  it('throws when neither realms nor a resolver is provided', () => {
    expect(() => KeycloakProvider.createMultiRealm({})).toThrow(/at least one/);
  });
});

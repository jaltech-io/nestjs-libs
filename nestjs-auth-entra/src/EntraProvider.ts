import type { AuthProvider } from '@jaltech/nestjs-auth-core';
import { EntraInstance } from './services/EntraInstance';
import { type EntraConfig, resolveEntraConfig } from './types/EntraConfig';

/**
 * Fabrique du provider Microsoft Entra ID (OFFLINE uniquement).
 *
 * @example
 * AuthModule.register({
 *   provider: EntraProvider.create({ tenantId: '<guid>', clientId: '<guid>' }),
 *   tokenValidation: TokenValidation.OFFLINE,
 * })
 */
export const EntraProvider = {
  /**
   * Construit un `AuthProvider` Entra. Valide les options requises AU BOOT.
   * @throws Error si `tenantId` ou `clientId` manquent.
   */
  create(config: EntraConfig): AuthProvider {
    const resolved = resolveEntraConfig(config);
    return { name: 'entra', instance: new EntraInstance(resolved) };
  },
} as const;

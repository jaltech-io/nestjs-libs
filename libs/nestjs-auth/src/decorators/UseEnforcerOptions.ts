import { SetMetadata } from '@nestjs/common';
import type { EnforcerOptions } from '../types/EnforcerOptions';

export const META_ENFORCER_OPTIONS = 'enforcer-options';

/**
 * Surcharge les options de l'enforcer UMA pour une route ou un contrôleur.
 * Évalué par le `ResourceGuard` à la place des options par défaut.
 *
 * Permet notamment de personnaliser les claims contextuels envoyés à Keycloak.
 *
 * @example
 * @UseEnforcerOptions({
 *   claims: (req) => ({ 'client.ip': [req.ip] }),
 *   response_mode: 'permissions',
 * })
 * @Get('sensitive')
 * sensitiveAction() { ... }
 */
export const UseEnforcerOptions = (opts: EnforcerOptions) => SetMetadata(META_ENFORCER_OPTIONS, opts);

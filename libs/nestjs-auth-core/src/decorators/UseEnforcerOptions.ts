import { SetMetadata } from '@nestjs/common';
import type { EnforcerOptions } from '../types/EnforcerOptions';

export const META_ENFORCER_OPTIONS = 'enforcer-options';

/**
 * Surcharge les options de l'enforcer UMA pour une route ou un contrôleur.
 */
export const UseEnforcerOptions = (opts: EnforcerOptions) => SetMetadata(META_ENFORCER_OPTIONS, opts);

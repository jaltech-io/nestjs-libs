// ── interface/ — Contrats (interfaces comportementales) ───────────────────────
// Règle : méthodes avec signatures uniquement, pas de propriétés de configuration.

export { ConditionalScopeFn } from './ConditionalScopeFn';
// Contrats génériques (provider-agnostic)
export { IAuthInstance } from './IAuthInstance';

// Contrats token
export { IToken } from './IToken';
export { IUmaCache } from './IUmaCache';

// Contrat de la factory de configuration (a une méthode → interface)
export { KeycloakOptionsFactory } from './KeycloakOptionsFactory';

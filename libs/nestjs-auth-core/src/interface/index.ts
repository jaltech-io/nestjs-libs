// ── interface/ — Contrats comportementaux (méthodes uniquement) ──────────────

export { AuthCapabilities, AuthValidationContext, IAuthInstance } from './IAuthInstance';
export { IToken } from './IToken';
export { ITokenSource } from './ITokenSource';
export { IPrincipalResolver } from './IPrincipalResolver';
export { IPrincipalCache } from './IPrincipalCache';
export { IUmaCache } from './IUmaCache';
export { IRevocationStore } from './IRevocationStore';
export { IBackChannelLogoutValidator, LogoutEvent } from './IBackChannelLogout';
export { ConditionalScopeFn } from './ConditionalScopeFn';

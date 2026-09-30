/**
 * Token DI du store de cache générique (`ICache<T>`).
 * Injecté automatiquement dans les services via `@Inject(CACHE_STORE)`.
 */
export const CACHE_STORE = Symbol('CACHE_STORE');

/**
 * Token DI du store de session `express-session` (`ISessionStore`).
 * Injecté dans `main.ts` via `app.get(SESSION_STORE)` pour configurer
 * le middleware de session.
 */
export const SESSION_STORE = Symbol('SESSION_STORE');

/**
 * Token DI interne des options du module.
 * Non exposé dans l'API publique.
 */
export const CACHE_OPTIONS = Symbol('CACHE_OPTIONS');

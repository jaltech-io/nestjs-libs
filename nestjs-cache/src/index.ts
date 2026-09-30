// ── nestjs-cache — API publique ───────────────────────────────────────────────

// Module NestJS
export { CacheModule } from './CacheModule';

// Tokens DI
export { CACHE_STORE, SESSION_STORE } from './constants';

// ── interface/ — Contrats (méthodes uniquement) ───────────────────────────────
export { ICache } from './interface/ICache';
export { ICacheOptionsFactory } from './interface/ICacheOptionsFactory';
export { ISessionStore } from './interface/ISessionStore';

// ── types/ — Objets de configuration ─────────────────────────────────────────
export { CacheConfig, CacheExtra, CacheStoreConfig, SessionStoreConfig } from './types/CacheConfig';
export { CacheModuleAsyncOptions } from './types/CacheModuleAsyncOptions';

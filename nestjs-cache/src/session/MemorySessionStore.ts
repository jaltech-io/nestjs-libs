import session from 'express-session';
import type { ISessionStore } from '../interface/ISessionStore';

/**
 * Store de session en mémoire pour `express-session`.
 *
 * Convient pour le développement et les tests.
 * Ne pas utiliser en production : les sessions sont perdues au redémarrage
 * et non partagées entre instances.
 *
 * @example
 * const store = new MemorySessionStore();
 * await store.connect();
 * app.use(session({ store: store.getStore(), secret: '...', ... }));
 */
export class MemorySessionStore implements ISessionStore {
  private memStore: session.MemoryStore;

  async connect(): Promise<void> {
    this.memStore = new session.MemoryStore();
  }

  getStore(): session.MemoryStore {
    return this.memStore;
  }
}

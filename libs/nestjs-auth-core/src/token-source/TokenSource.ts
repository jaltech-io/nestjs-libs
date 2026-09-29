import { AUTH_COOKIE_DEFAULT } from '../constants';
import type { ITokenSource } from '../interface/ITokenSource';

/** Lit un chemin pointé (`a.b.c`) dans un objet, `undefined` si un maillon manque. */
const readPath = (root: any, path: string): unknown => {
  if (!root) return undefined;
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), root);
};

/** Extrait le JWT du header `Authorization: Bearer <token>`. */
class HeaderTokenSource implements ITokenSource {
  extract(request: any): string | null {
    const header: string | undefined = request?.headers?.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (!value || scheme.toLowerCase() !== 'bearer') return null;
    return value;
  }
}

/** Extrait le JWT d'un cookie HTTP-only. */
class CookieTokenSource implements ITokenSource {
  constructor(private readonly name: string) {}
  extract(request: any): string | null {
    const value = request?.cookies?.[this.name];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}

/** Extrait le JWT depuis `request.session`, via un chemin pointé (ex. `tokens.accessToken`). */
class SessionTokenSource implements ITokenSource {
  constructor(private readonly path: string) {}
  extract(request: any): string | null {
    const value = readPath(request?.session, this.path);
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}

/** Combine plusieurs sources : retourne le premier JWT non nul dans l'ordre. */
class ChainTokenSource implements ITokenSource {
  private readonly sources: ITokenSource[];
  constructor(sources: ITokenSource[]) {
    this.sources = sources;
  }
  extract(request: any): string | null {
    for (const source of this.sources) {
      const token = source.extract(request);
      if (token) return token;
    }
    return null;
  }
}

/**
 * Fabriques de sources de token.
 *
 * @example
 * TokenSource.chain(TokenSource.header(), TokenSource.cookie('KEYCLOAK_JWT'))
 */
export const TokenSource = {
  /** Header `Authorization: Bearer`. */
  header(): ITokenSource {
    return new HeaderTokenSource();
  },
  /** Cookie HTTP-only nommé. */
  cookie(name: string): ITokenSource {
    return new CookieTokenSource(name);
  },
  /** Champ de session via chemin pointé (ex. `tokens.accessToken`). */
  session(path: string): ITokenSource {
    return new SessionTokenSource(path);
  },
  /** Premier JWT non nul parmi les sources fournies, dans l'ordre. */
  chain(...sources: ITokenSource[]): ITokenSource {
    return new ChainTokenSource(sources);
  },
} as const;

/**
 * Source par défaut : header puis cookie `KEYCLOAK_JWT`.
 * Reproduit le comportement de `@jaltech/nestjs-auth` (header/bearer ou cookie).
 */
export const defaultTokenSource = (cookieKey: string = AUTH_COOKIE_DEFAULT): ITokenSource =>
  TokenSource.chain(TokenSource.header(), TokenSource.cookie(cookieKey));

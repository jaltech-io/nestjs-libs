// Utilitaires de test : génération de clés RSA et de JWT en mémoire (aucun réseau).
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { vi } from 'vitest';

export type Keypair = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  jwk: JWK;
  kid: string;
};

/** Génère une paire de clés RSA RS256 avec un `kid`, et le JWK public prêt pour un JWKS. */
export async function makeKeypair(kid = 'test-key'): Promise<Keypair> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  return { publicKey, privateKey, jwk, kid };
}

export type SignOptions = {
  expiresInSec?: number; // relatif à maintenant ; défaut +3600
  notBeforeSec?: number; // relatif à maintenant ; défaut non défini
  issuedAtSec?: number; // epoch absolu ; défaut maintenant
  noIat?: boolean;
};

const now = () => Math.floor(Date.now() / 1000);

/** Signe un JWT RS256 avec la clé donnée. */
export async function signJwt(
  kp: Keypair,
  payload: Record<string, unknown>,
  options: SignOptions = {},
): Promise<string> {
  let builder = new SignJWT(payload as any).setProtectedHeader({ alg: 'RS256', kid: kp.kid });

  if (!options.noIat) builder = builder.setIssuedAt(options.issuedAtSec ?? now());
  const exp = now() + (options.expiresInSec ?? 3600);
  builder = builder.setExpirationTime(exp);
  if (options.notBeforeSec !== undefined) builder = builder.setNotBefore(now() + options.notBeforeSec);

  return builder.sign(kp.privateKey);
}

/**
 * Stub de `fetch` routant par URL. Chaque entrée mappe une sous-chaîne d'URL vers
 * une réponse (JSON par défaut, ou un statut). Les JWKS sont fournis via `jwksByUrl`.
 */
export function stubFetch(routes: {
  jwks?: { urlIncludes: string; keys: JWK[] }[];
  json?: { urlIncludes: string; body: unknown; status?: number }[];
  status?: { urlIncludes: string; status: number; body?: string }[];
}): void {
  vi.stubGlobal('fetch', async (input: any) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);

    for (const j of routes.jwks ?? []) {
      if (url.includes(j.urlIncludes)) {
        return new Response(JSON.stringify({ keys: j.keys }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    for (const r of routes.json ?? []) {
      if (url.includes(r.urlIncludes)) {
        return new Response(JSON.stringify(r.body), {
          status: r.status ?? 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    for (const s of routes.status ?? []) {
      if (url.includes(s.urlIncludes)) {
        return new Response(s.body ?? '', { status: s.status });
      }
    }
    return new Response('not found', { status: 404 });
  });
}

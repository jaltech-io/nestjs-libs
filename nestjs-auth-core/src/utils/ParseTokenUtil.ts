/**
 * Décode le payload d'un JWT sans vérifier sa signature.
 *
 * @param token - JWT brut (`header.payload.signature`).
 * @returns Le payload JSON décodé.
 * @throws Si le token ne contient pas trois segments.
 */
export const parseToken = (token: string): any => {
  const parts = token.split('.');
  if (parts.length < 3) throw new Error('Malformed JWT: expected 3 segments');
  return JSON.parse(Buffer.from(parts[1], 'base64').toString());
};

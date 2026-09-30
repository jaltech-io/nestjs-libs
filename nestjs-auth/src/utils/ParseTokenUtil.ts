/**
 * Décode le payload d'un JWT sans vérifier sa signature.
 *
 * @param token - JWT brut sous forme de chaîne (`header.payload.signature`).
 * @returns Le payload JSON décodé.
 * @throws Si le token ne contient pas trois segments séparés par un point.
 */
export const parseToken = (token: string): any => {
  const parts = token.split('.');
  return JSON.parse(Buffer.from(parts[1], 'base64').toString());
};

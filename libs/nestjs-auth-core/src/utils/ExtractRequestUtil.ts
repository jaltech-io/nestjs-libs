import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { ExecutionContext } from '@nestjs/common';
import type { GqlContextType } from '../types/GqlContextType';

const requireOptionalPeer = createRequire(resolve(process.cwd(), 'package.json'));

/**
 * Extrait la paire `[request, response]` depuis un contexte d'exécution NestJS.
 * Compatible HTTP et GraphQL. Retourne `[undefined, undefined]` pour les autres contextes.
 *
 * Aucune mutation de la requête (contrairement à l'historique `attachCookieToHeader`) :
 * la lecture du token est déléguée à `ITokenSource`.
 */
export const extractRequest = (context: ExecutionContext): [any, any] => {
  if (context.getType() === 'http') {
    const http = context.switchToHttp();
    return [http.getRequest(), http.getResponse()];
  }

  if (context.getType<GqlContextType>() === 'graphql') {
    let gql: any;
    try {
      gql = requireOptionalPeer('@nestjs/graphql');
    } catch {
      throw new Error('@nestjs/graphql is not installed');
    }
    const ctx = gql.GqlExecutionContext.create(context).getContext();
    return [ctx.req, ctx.res];
  }

  return [undefined, undefined];
};

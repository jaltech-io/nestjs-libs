import type { ContextType } from '@nestjs/common';

/** Type de contexte d'exécution étendu pour inclure GraphQL en plus des contextes NestJS natifs. */
export type GqlContextType = 'graphql' | ContextType;

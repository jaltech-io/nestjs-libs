import type { ContextType } from '@nestjs/common';

/** Type de contexte d'exécution étendu pour inclure GraphQL. */
export type GqlContextType = 'graphql' | ContextType;

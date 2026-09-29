import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      // Les packages provider importent le core par son nom : on l'alias vers la source.
      '@jaltech/nestjs-auth-core': resolve(root, 'libs/nestjs-auth-core/src/index.ts'),
      '@test/jwt': resolve(root, 'test-utils/jwt.ts'),
      '@test/context': resolve(root, 'test-utils/context.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/nestjs-auth-*/test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'libs/nestjs-auth-core/src/**',
        'libs/nestjs-auth-keycloak/src/**',
        'libs/nestjs-auth-entra/src/**',
      ],
      // Fichiers sans logique exécutable : manifeste `type`, barrels de ré-export,
      // décorateurs de paramètre (simples lecteurs de champ de requête, plomberie NestJS).
      exclude: [
        '**/index.ts',
        '**/*.d.ts',
        '**/package.json',
        'libs/nestjs-auth-core/src/decorators/AccessToken.ts',
        'libs/nestjs-auth-core/src/decorators/AuthUser.ts',
        'libs/nestjs-auth-core/src/decorators/AuthPrincipal.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 85,
        statements: 90,
      },
    },
  },
});

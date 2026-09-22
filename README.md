# nestjs-libs — packages npm `@profeskills/*`

Bibliothèques NestJS génériques de la plateforme (repo standalone, anciennement `platform-apps/libs/nestjs-*`). Publiées sur [npmjs.org](https://www.npmjs.com/org/profeskills), consommées comme n'importe quelle dépendance npm par les projets (projectflow et autres).

| Package | Contenu |
|---|---|
| [`@profeskills/nestjs-auth`](libs/nestjs-auth) | Authentification Keycloak : `KeycloakModule`, guards (`AuthGuard`, `RoleGuard`, `ResourceGuard`), décorateurs (`@Public()`, `@Roles()`, `@AuthUser()`…) |
| [`@profeskills/nestjs-admin-auth`](libs/nestjs-admin-auth) | Opérations admin Keycloak : `AdminAuthModule`, tokens DI `ADMIN_USERS`/`ADMIN_GROUPS`, interfaces `IAdminUsers`/`IAdminGroups` |
| [`@profeskills/nestjs-cache`](libs/nestjs-cache) | Cache Redis + session store : `CacheModule`, tokens `CACHE_STORE`/`SESSION_STORE`, interfaces `ICache`/`ISessionStore` |

**Règle inter-modules** : les libs sont isolées entre elles — aucun import croisé.

## Développement

```bash
pnpm install
pnpm check        # typecheck + build + verify (le gate complet)
```

- `pnpm typecheck` — tsc --noEmit sur les 3 libs
- `pnpm build` — compile chaque lib dans `dist/libs/<lib>` (package npm prêt à publier)
- `pnpm verify` — `tools/verify-library-packages.mjs` : vérifie que chaque package est autonome, packable, sans fuite de chemins internes

## Publier une version

1. Bump `version` dans `libs/<lib>/package.json` + entrée `CHANGELOG.md`, merger sur `main`
2. Tagger : `git tag nestjs-auth@0.3.0 && git push origin nestjs-auth@0.3.0`
3. Le job `deploy:nestjs-auth` du pipeline du tag valide (typecheck/build/verify, version = tag, commit ∈ main) puis publie sur npm

Une version contenant un `-` (ex `0.3.0-beta.1`) part sous le dist-tag `next`, sinon `latest`.

## Variables CI/CD requises (Forgejo > Settings > Actions > Secrets)

| Variable | Rôle |
|---|---|
| `NPM_TOKEN` | Token npm "Automation" (masqué, à scoper aux tags protégés) — publication |

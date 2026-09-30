# nestjs-libs

> [!WARNING]
> **Pre-release — not production-ready.** These packages are under active development (pre-`1.0.0`) and have **not yet been through a human stabilization and review pass**. Their APIs may change at any time, without a deprecation cycle. They are published for early experimentation and feedback only — **do not use them in production**. This notice will be removed at the `1.0.0` release.

Generic, provider-agnostic NestJS building blocks published to npm under the [`@jaltech`](https://www.npmjs.com/org/jaltech) scope. Each package is independent and can be installed on its own.

| Package | npm | Description | README |
|---|---|---|---|
| `@jaltech/nestjs-auth-core` | [![npm](https://img.shields.io/npm/v/@jaltech/nestjs-auth-core)](https://www.npmjs.com/package/@jaltech/nestjs-auth-core) | Provider-agnostic authentication & authorization: contracts, guards, decorators, token sources, application-managed principals, back-channel logout. | [Read](nestjs-auth-core/README.md) |
| `@jaltech/nestjs-auth-keycloak` | [![npm](https://img.shields.io/npm/v/@jaltech/nestjs-auth-keycloak)](https://www.npmjs.com/package/@jaltech/nestjs-auth-keycloak) | Keycloak provider: OIDC/JWKS validation, UMA with decision cache, multi-realm, Keycloak Organizations. | [Read](nestjs-auth-keycloak/README.md) |
| `@jaltech/nestjs-auth-entra` | [![npm](https://img.shields.io/npm/v/@jaltech/nestjs-auth-entra)](https://www.npmjs.com/package/@jaltech/nestjs-auth-entra) | Microsoft Entra ID provider: v1/v2 access tokens, tenant, audience, scopes, members-only checks. | [Read](nestjs-auth-entra/README.md) |
| `@jaltech/nestjs-auth` | [![npm](https://img.shields.io/npm/v/@jaltech/nestjs-auth)](https://www.npmjs.com/package/@jaltech/nestjs-auth) | **Superseded** by `nestjs-auth-core` + a provider package (see the [Keycloak migration guide](nestjs-auth-keycloak/README.md#migrating-from-jaltechnestjs-auth)). Kept for existing consumers. | [Read](nestjs-auth/README.md) |
| `@jaltech/nestjs-admin-auth` | [![npm](https://img.shields.io/npm/v/@jaltech/nestjs-admin-auth)](https://www.npmjs.com/package/@jaltech/nestjs-admin-auth) | Keycloak Admin REST operations (users, groups, sessions, client roles, authorization services) behind DI tokens. | [Read](nestjs-admin-auth/README.md) |
| `@jaltech/nestjs-cache` | [![npm](https://img.shields.io/npm/v/@jaltech/nestjs-cache)](https://www.npmjs.com/package/@jaltech/nestjs-cache) | Cache and `express-session` store abstraction (Redis / in-memory) behind DI tokens, following the Dependency Inversion Principle. | [Read](nestjs-cache/README.md) |

## Package isolation

The packages are intentionally isolated from one another — there are **no cross-imports** between them, with one exception: the auth provider packages (`nestjs-auth-keycloak`, `nestjs-auth-entra`) depend on `nestjs-auth-core` as a peer dependency. When two packages need to cooperate (for example, backing the `nestjs-auth` UMA decision cache with the Redis store from `nestjs-cache`), the **consuming application is the composition root**: it is the only place that imports both and wires them together through dependency injection.

## Development

This repository is a [pnpm](https://pnpm.io) workspace monorepo.

```bash
pnpm install
pnpm check        # typecheck + build + verify + tests with coverage (the full quality gate)
```

Individual steps:

- `pnpm typecheck` — `tsc --noEmit` across all packages
- `pnpm build` — compiles each package into `dist/<package>` (a publish-ready npm package)
- `pnpm verify` — checks that each built package is self-contained, packable, and free of internal path leaks
- `pnpm test` / `pnpm test:coverage` — Vitest suites (no network), coverage thresholds enforced

See also [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Releasing

Releases are published to npm by GitHub Actions (`.github/workflows/release.yml`), triggered by pushing a git tag of the form `<package>@<version>` (e.g. `nestjs-auth@0.3.2`):

1. Bump `version` in `<package>/package.json` and add a `CHANGELOG.md` entry, then merge to `main`.
2. Tag the release commit and push the tag:
   ```bash
   git tag nestjs-auth@0.3.2
   git push origin nestjs-auth@0.3.2
   ```
3. The workflow validates the package (name, version matching the tag, MIT license, `publishConfig.access: public`, and that the tagged commit is on `main`), runs `pnpm check`, performs an `npm pack --dry-run`, and publishes.

A version containing a hyphen (e.g. `0.3.0-beta.1`) is published under the `next` dist-tag; otherwise it is published under `latest`. Publishing requires an `NPM_TOKEN` secret configured in the GitHub repository's Actions secrets.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Please open an issue to discuss substantial changes first, then submit a pull request. Before opening a PR, make sure `pnpm check` passes locally. Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Jaltech

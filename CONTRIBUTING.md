# Contributing

Thanks for your interest in improving these packages.

## Setup

```bash
git clone https://github.com/jaltech-io/nestjs-libs.git
cd nestjs-libs
pnpm install
```

## Checks

Every change must keep the full check green:

```bash
pnpm check   # typecheck + build + package verification + tests with coverage
```

- `pnpm test` runs the Vitest suites; `pnpm test:coverage` enforces the coverage thresholds (90 % lines, branches and statements).
- Tests must not make network calls: generate keys and JWKS in memory (see `test-utils/jwt.ts`).

## Guidelines

- **Fail closed.** When a claim is missing, a capability is unsupported or the configuration is incomplete, deny access.
- **Never log secrets.** No tokens, cookies, client secrets or full claim sets in logs.
- **Guards depend on contracts only** (`IAuthInstance`, `IToken`, …), never on a concrete provider.
- Keep the public API small: export factories, contracts, decorators and modules from each package's `index.ts`.
- Packages do not import each other, except provider packages depending on `@jaltech/nestjs-auth-core`.

## Pull requests

- One topic per pull request, with tests for the behavior you change.
- Add an entry to the package's `CHANGELOG.md`.
- Commit messages follow Conventional Commits (`feat(nestjs-auth-core): …`, `fix(nestjs-auth-entra): …`).

## Releases

Maintainers publish a package by pushing a tag `<package>@<version>` (e.g. `nestjs-auth-core@0.1.0`) whose version matches the package's `package.json`; GitHub Actions validates, builds and publishes it to npm.

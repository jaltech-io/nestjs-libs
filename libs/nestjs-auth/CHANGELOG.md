## 0.3.3 (2026-09-29)

### 📝 Documentation

- Rewrote the README as standalone, English, OSS-standard documentation (badges, features, requirements, quick start, usage, contributing, license); removed all origin-project references.
- Added a pre-release "not production-ready" notice (to be removed at 1.0.0).
- Cleaned package metadata (`author`); added a repository-root MIT LICENSE.

## 0.3.0 (2026-08-22)

### 🚀 Features

- **ResourceGuard:** `verbScopeDefaults` — sans `@Scopes()` explicite, le scope est dérivé du verbe HTTP (GET→READ, POST→CREATE, PUT/PATCH→UPDATE, DELETE→DELETE) : un seul `@Resource()` de classe protège un contrôleur CQRS entier
- **ResourceGuard:** `enforcementShadow` — mode observation : les refus UMA sont journalisés (`AUTHZ-SHADOW denied`) mais autorisés, pour valider une matrice de permissions avant d'activer le blocage

## 0.2.1 (2026-07-19)

### 🩹 Fixes

- **libs:** disable npm provenance, requires a public source repo
- **ci:** provide Sigstore OIDC token for npm provenance publishing

### ❤️ Thank You

- Your Name

## 0.2.0 (2026-07-19)

### 🚀 Features

- **admin:** integre NX monorepo — nestjs-demo-api + vuejs-demo-front

### ❤️ Thank You

- Your Name
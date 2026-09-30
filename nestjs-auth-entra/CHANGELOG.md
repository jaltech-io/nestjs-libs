## 0.1.0 (2026-09-29)

### 🚀 Features

- First release. Microsoft Entra ID provider for `@jaltech/nestjs-auth-core` (OFFLINE validation with `jose`).
- v1 and v2 access tokens; checks `iss`, `aud`, `tid`, `exp`/`nbf`, `idtyp`, required `scp` and optional members-only (`acct`).
- App roles from the `roles` claim or from an application `principalResolver`; identity normalized on `oid` / `tid`.

### 🔒 Security

- Fail-closed: token without `oid` (no stable identity), missing `acct` with `membersOnly`, app-only tokens, missing scopes, group overage (never grants a role), UMA and back-channel logout requested on Entra.

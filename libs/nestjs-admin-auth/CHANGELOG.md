## 0.2.2 (2026-08-22)

### 🚀 Features

- **groups:** `IAdminGroups.createGroup(name, parentId?)` — crée un sous-groupe Keycloak quand `parentId` est fourni (`POST /groups/{parentId}/children`), un groupe racine sinon
- **groups:** `IAdminGroups.findGroupByName(name)` — recherche un groupe racine par nom exact (find-or-create idempotent des groupes parents)

### 🩹 Fixes

- parité Horizon des rôles/groupes Keycloak, renommage platform_admin

## 0.2.1 (2026-07-19)

### 🩹 Fixes

- **libs:** disable npm provenance, requires a public source repo
- **ci:** provide Sigstore OIDC token for npm provenance publishing

### ❤️ Thank You

- Your Name

## 0.2.0 (2026-07-19)

This was a version bump only for nestjs-admin-auth to align it with other projects, there were no code changes.
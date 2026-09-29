# Security policy

## Supported versions

These packages are pre-`1.0.0`. Only the latest published version of each package receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting on this repository (**Security → Report a vulnerability**). Include the affected package and version, a description of the issue, and steps or a minimal example to reproduce it.

You will receive an acknowledgement within a few working days. Once a fix is released, the advisory is published with credit to the reporter unless you prefer to stay anonymous.

## Scope

The authentication packages (`@jaltech/nestjs-auth-core`, `@jaltech/nestjs-auth-keycloak`, `@jaltech/nestjs-auth-entra`, `@jaltech/nestjs-admin-auth`) are security-sensitive. Reports about token validation, authorization bypasses, fail-open behavior or secrets leaking into logs are especially welcome.

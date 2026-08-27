---
name: postgres-persistence
description: Change PostgreSQL persistence, including generated migrations, Kysely database types, repository adapters, Unit of Work wiring, and database integration tests.
---

# PostgreSQL persistence

Keep the domain port, in-memory behavior, PostgreSQL adapter, schema model, and database migration aligned.

Before editing TypeScript, read [the repository TypeScript style](../../references/typescript-code-style.md). Read [architecture](references/architecture.md) for every persistence change. Read [testing](references/testing.md) when repository behavior or the database schema changes.

Inspect the closest repository for the same kind of aggregate or query before choosing mappings and transaction behavior. Do not leak Kysely or PostgreSQL types into domain ports.

When the persisted shape changes a DTO, Zod schema, route, or error in `shared/`, also follow the `shared-contracts` skill.

Run the relevant integration test while iterating. Run `pnpm fullcheck` after a significant change.

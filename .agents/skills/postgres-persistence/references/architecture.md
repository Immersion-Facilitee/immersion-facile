# PostgreSQL persistence architecture

Domain persistence is defined by a port under the relevant `back/src/domains/<domain>/ports/` directory. Production adapters use Kysely and normally live in that domain's `adapters/` directory; repositories are the normal exception to the functions-over-classes preference.

For a schema change:

1. Create the migration with `pnpm back db:create <name>` so its timestamp and structure are generated correctly. Do not hand-create a migration filename.
2. Implement both forward and rollback behavior when the migration supports it.
3. Update `back/src/config/pg/kysely/model/database.ts` to match the resulting schema.
4. Update the PostgreSQL adapter and its domain port when behavior changes.
5. Keep the in-memory adapter and Unit of Work types and construction aligned with the port.

Use Kysely's typed query builder and explicit mapping at the adapter boundary. Preserve domain types outside the adapter and handle database nullability, timestamps, and JSON shapes deliberately.

Apply local migrations with `pnpm back db:up` only when the task requires exercising the changed database.

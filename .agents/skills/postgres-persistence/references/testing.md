# PostgreSQL persistence testing

Changes to PostgreSQL repositories or queries require `*.integration.test.ts` coverage against the real test database.

- Create the pool with `makeTestPgPool()` and the database client with `makeKyselyDb(pool)`.
- Close the pool in `afterAll`.
- Isolate tests by deleting affected rows in dependency-safe order before each test.
- Exercise the public repository or query port rather than duplicating its SQL in assertions.
- Cover meaningful mapping and persistence behavior, including nullable values, dates, JSON, updates, missing rows, and constraints when relevant.
- Keep domain behavior exhaustive in use case unit tests; integration tests prove persistence and mapping.
- Test query rules (filters, search, sorting, counts, pagination, deduplication) here and only here: the in-memory adapter stubs them, so this test is their only coverage. Cover each search branch, ordering ties, and the total count with and without filters.

Run integration tests with the database resources available. `pnpm back test:integration` runs the backend integration suite and requires Docker and the test database.

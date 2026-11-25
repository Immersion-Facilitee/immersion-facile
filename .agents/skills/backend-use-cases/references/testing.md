# Backend use case testing

Every use case must have exhaustive unit tests covering the rules the use case decides itself: successful behavior, business branches, authorization when applicable, validation boundaries, missing entities, conflicts, and emitted events.

- Name files `*.unit.test.ts` beside the use case.
- Build the test Unit of Work with `createInMemoryUow()` and `InMemoryUowPerformer`.
- Use real in-memory repositories and gateways instead of framework mocks.
- Use shared DTO builders and test gateway implementations when available.
- Arrange repository state directly and assert on the in-memory state after execution.
- Use `expectPromiseToFailWithError` for expected domain errors.
- Assert saved outbox events for mutations, including their topic and meaningful payload.

## Read use cases backed by a query

When filtering, search, sorting, counting, or pagination is performed by a query port implemented in SQL, those rules belong to the query, not to the use case. Do not reimplement them in the in-memory adapter to unit-test them: such tests only exercise code written for the test.

- Unit-test what the use case decides: authorization, input validation, parameter defaults, caps and normalization, and returning the query result.
- Assert on the parameters the query received and return preset data from the in-memory stub, as in `back/src/domains/establishment/use-cases/GetEstablishmentsForAdmin.unit.test.ts`.
- Test the query rules in the PostgreSQL integration test, following the `postgres-persistence` skill.

Inspect a recent unit test in the same domain rather than copying a generic fixture. Run a targeted `bun test <file>` command while iterating; `pnpm back test` runs the backend non-integration suite.

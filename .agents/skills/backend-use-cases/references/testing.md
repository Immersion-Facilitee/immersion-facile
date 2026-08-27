# Backend use case testing

Every use case must have exhaustive unit tests covering successful behavior, business branches, authorization when applicable, validation boundaries, missing entities, conflicts, and emitted events.

- Name files `*.unit.test.ts` beside the use case.
- Build the test Unit of Work with `createInMemoryUow()` and `InMemoryUowPerformer`.
- Use real in-memory repositories and gateways instead of framework mocks.
- Use shared DTO builders and test gateway implementations when available.
- Arrange repository state directly and assert on the in-memory state after execution.
- Use `expectPromiseToFailWithError` for expected domain errors.
- Assert saved outbox events for mutations, including their topic and meaningful payload.

Inspect a recent unit test in the same domain rather than copying a generic fixture. Run a targeted non-watch Jest command while iterating; `pnpm back test` runs the backend non-integration suite.

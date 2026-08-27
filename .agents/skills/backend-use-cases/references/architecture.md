# Backend use case architecture

Use cases live under the relevant `back/src/domains/<domain>/use-cases/` directory and are built with `back/src/domains/core/useCaseBuilder.ts`.

- Export factories as `make<UseCaseName>`.
- Add `.withInput(schema)` when the use case accepts input and reuse a Zod schema from the appropriate domain or `shared/` contract.
- Declare external dependencies explicitly with `.withDeps<T>()`.
- Use repositories through the `UnitOfWork` received by the builder callback.
- Keep the default transactional behavior. Use `.notTransactional()` only when the operation must not run in a Unit of Work transaction.
- Add repositories needed by the transaction to `back/src/domains/core/unit-of-work/ports/UnitOfWork.ts` and its adapters.
- Instantiate every application use case in `back/src/config/bootstrap/createUseCases.ts`.

Mutations produce a domain event through the injected `CreateNewEvent` dependency and save it through `uow.outboxRepository` in the same transaction. Event definitions and subscriptions live in `back/src/domains/core/events/`.

Use centralized errors from `shared/src/errors/errors.ts`; add a missing error through the `shared-contracts` workflow rather than creating a local error family.

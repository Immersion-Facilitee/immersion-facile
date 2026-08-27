# Backend use case architecture

Use cases live under the relevant `back/src/domains/<domain>/use-cases/` directory and are built with `back/src/domains/core/useCaseBuilder.ts`.

Name new directories in kebab-case and follow the established domain structure.

- Export factories as `make<UseCaseName>`.
- Add `.withInput(schema)` when the use case accepts input and reuse a Zod schema from the appropriate domain or `shared/` contract.
- Declare external dependencies explicitly with `.withDeps<T>()`.
- Use repositories through the `UnitOfWork` received by the builder callback.
- Keep the default transactional behavior. Use `.notTransactional()` only when the operation must not run in a Unit of Work transaction.
- Add repositories needed by the transaction to `back/src/domains/core/unit-of-work/ports/UnitOfWork.ts` and its adapters.
- Instantiate every application use case in `back/src/config/bootstrap/createUseCases.ts`.

Mutations produce a domain event through the injected `CreateNewEvent` dependency and save it through `uow.outboxRepository` in the same transaction. Keep the complete affected entity in the event payload for auditability. Event definitions and subscriptions live in `back/src/domains/core/events/`.

Keep business mutations and notifications in separate use cases. A notification use case is triggered by the business event, fetches the current data from repositories rather than building the notification from the event payload, saves the notification, emits `NotificationAdded`, and lets the notification provider handle delivery. Apply this convention to new work and migrate legacy code only when the current change provides a concrete benefit.

A use case may consume repositories from another domain. Cross-domain read models and aggregation required by an API or frontend belong in the backend; choose the owning domain case by case instead of moving the aggregation to the client.

Use centralized errors from `shared/src/errors/errors.ts`; add a missing error through the `shared-contracts` workflow rather than creating a local error family.

Sources: [file organization](../../../../doc/adr/file-organisation.md), [notification responsibility split](../../../../doc/adr/back/usecase-responsability-split.md), [cross-domain use case coupling](../../../../doc/adr/back/cross-domain-coupling-usecase-repo.md), and [cross-domain query models](../../../../doc/adr/back/cross-domain-query-model.md).

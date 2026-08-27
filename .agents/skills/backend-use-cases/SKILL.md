---
name: backend-use-cases
description: Implement or test backend business use cases under back/src/domains, including Unit of Work transactions, injected dependencies, outbox events, bootstrap wiring, and in-memory unit tests.
---

# Backend use cases

Implement the business behavior as a use case consistent with its domain and transaction boundary.

Before editing TypeScript, read [the repository TypeScript style](../../references/typescript-code-style.md). Read [architecture](references/architecture.md) before changing a use case or its wiring. Read [testing](references/testing.md) before adding or modifying its tests.

Inspect the closest use case in the same domain before choosing schemas, dependencies, repositories, events, or test setup. Keep HTTP and persistence details outside the use case.

When the work changes a contract in `shared/` or PostgreSQL persistence, also follow the matching repository skill.

Run the narrow relevant tests while iterating. Run `pnpm fullcheck` after a significant change.

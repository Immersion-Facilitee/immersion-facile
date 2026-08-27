---
name: shared-contracts
description: Change contracts in shared, including DTOs, Zod schemas, builders, shared routes, centralized errors, DOM IDs, and barrel exports.
---

# Shared contracts

Keep the contract consumable directly by both frontend and backend without introducing runtime or architectural coupling.

Before editing TypeScript, read [the repository TypeScript style](../../references/typescript-code-style.md). Read [architecture](references/architecture.md) before changing a shared contract. Read [testing](references/testing.md) when behavior, parsing, validation, or a builder changes.

Inspect the closest domain in `shared/src/` before naming or organizing new files. Update all affected frontend and backend consumers together when a contract changes.

Use the `frontend-ui`, `backend-use-cases`, or `postgres-persistence` skill as well when the task crosses those boundaries.

Run focused shared tests and type checking while iterating. Run `pnpm fullcheck` after a significant cross-package change.

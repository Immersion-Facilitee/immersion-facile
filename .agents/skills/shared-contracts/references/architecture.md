# Shared contract architecture

The `shared` workspace has no build step and is imported as `shared` by frontend and backend code. It must not depend on either application.

Organize domain contracts in `shared/src/<domain>/` using the established roles:

- `*.dto.ts` for transport and shared data types;
- `*.schema.ts` for Zod parsing and validation;
- `<Domain>DtoBuilder.ts` or the existing domain naming for test builders;
- `*.routes.ts` for shared route definitions.

Export public contracts through `shared/src/index.ts`. Prefer existing primitives, branded types, Zod utilities, and route builders over parallel definitions.

All application error families belong in `shared/src/errors/errors.ts` and use the existing HTTP error types. Add the smallest domain-specific factory needed by callers.

All stable HTML identifiers belong in `shared/src/domElementIds.ts` so analytics and E2E tests use the same values as the frontend.

Treat contract changes as cross-package changes: find consumers before editing, preserve compatibility when possible, and update frontend, backend, and test builders together when compatibility must change.

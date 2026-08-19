## Key Commands

```bash
pnpm install              # install all workspace deps
pnpm dev                  # start front + back in dev mode
pnpm check:fix            # biome formatter/linter with fixes
pnpm fullcheck            # full validation (includecheck, check, typecheck, test)
pnpm typecheck            # turbo-orchestrated TypeScript checking
pnpm test                 # jest tests across workspaces
pnpm test:unit            # unit tests only
pnpm test:integration     # integration tests (needs Docker + DB)
pnpm back db:up           # run database migrations
pnpm back db:create NAME  # create new migration
```

Run `pnpm fullcheck` after significant changes before handing off.

## Code Style

**Functional programming preferred:**
- Prefer functions over classes (exception: repositories use classes)
- Use arrow functions
- Avoid `let`, prefer `const`
- Avoid `any` type and casting to `any`
- Avoid using `as`
- Do not add comments

Prefer implicit returns:
```typescript
const f = () => "whatever";        // DO
const f = () => { return "x"; };   // AVOID
```

Prefer `if` without brackets:
```typescript
if (something)                     // DO
  throw new Error("msg");

if (something) {                   // AVOID
  throw new Error("msg");
}
```

## Architecture

**pnpm monorepo** (French government project - beta.gouv.fr) for professional internship placements.

```
back/                 # Node.js/Express backend (TypeScript)
front/                # React frontend (TypeScript, Vite, DSFR design system)
shared/               # Shared types, schemas, utilities (no build step)
libs/
  react-design-system/   # Custom React components (non-DSFR)
  html-templates/        # HTML email templating
  scss-mapper/           # SCSS to TypeScript generator
playwright-e2e/           # E2E tests
```

### Shared Package

Types, schemas, DTOs, and utilities shared between front and back. Imported as `"shared"`.

```
shared/src/
├── convention/          # Convention DTOs, schemas, builders
├── agency/              # Agency DTOs, schemas, builders
├── errors/errors.ts     # ALL error types (centralized)
├── domElementIds.ts     # ALL HTML element IDs (for analytics + tests)
├── routes/              # API route definitions (shared-routes)
├── zodUtils.ts          # Zod utilities + French localization
└── index.ts             # Central barrel export
```

**Pattern per domain:**
- `{domain}.dto.ts` - Data Transfer Objects
- `{domain}.schema.ts` - Zod validation schemas
- `{Domain}DtoBuilder.ts` - Test builders

### Backend Structure (Clean Architecture)

```
back/src/
├── adapters/primary/              # HTTP routes (Express)
├── config/
│   ├── bootstrap/                 # Dependency injection setup
│   │   ├── createUseCases.ts      # All use cases instantiation
│   │   └── createGateways.ts
│   └── pg/migrations/
├── domains/
│   ├── core/
│   │   ├── useCaseBuilder.ts      # Use case builder utility
│   │   ├── unit-of-work/          # UoW pattern
│   │   └── events/                # Event bus
│   ├── convention/                # Main business domain
│   │   ├── ports/                 # Repository interfaces
│   │   ├── adapters/              # InMemory + Pg implementations
│   │   └── use-cases/
│   └── ...
└── utils/
```

Tech: Express, PostgreSQL, Redis, Kysely (type-safe SQL), Zod, ts-pattern, Ramda, Pino

### Frontend Structure

```
front/src/
├── app/
│   ├── contents/              # i18n/static text (*.content.ts)
│   ├── components/
│   ├── pages/
│   └── hooks/
├── config/
└── core-logic/                # Redux slices, epics, selectors
```

Tech: React 18, Vite, Redux Toolkit + Redux-Observable (RxJS), DSFR (@codegouvfr/react-dsfr)

## Error Handling

**All errors must be defined in `shared/src/errors/errors.ts`**:

```typescript
import { errors } from "shared";

// Throwing errors in use cases
throw errors.convention.notFound({ conventionId });
throw errors.agency.notFound({ agencyId });
throw errors.user.forbidden({ userId });

// Error types: BadRequestError, NotFoundError, ForbiddenError, ConflictError, etc.
```

When adding new error cases, add them to the centralized `errors` object.

## Frontend Patterns

### DOM Element IDs

**All HTML element IDs must be defined in `shared/src/domElementIds.ts`** for analytics tracking and E2E tests:

```typescript
import { domElementIds } from "shared";

// In React components
<Button id={domElementIds.conventionImmersion.submitFormButton}>
  Submit
</Button>

// In Playwright tests
await page.click(`#${domElementIds.conventionImmersion.submitFormButton}`);
```

Every button, link, and interactive element needs an ID for analytics.

### Styling

- SCSS + BEM naming: `.im-{component}__element--modifier`
- Run `pnpm make-styles` to generate TypeScript from SCSS

## Clean Architecture Patterns

**These are the patterns we use. Follow them when adding new code.**

### Use Case Builder

Use cases built with `useCaseBuilder` from `back/src/domains/core/useCaseBuilder.ts`:

```typescript
// back/src/domains/agency/use-cases/AddAgency.ts
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { createAgencySchema } from "../entities/Agency.schema";

export const makeAddAgency = useCaseBuilder("AddAgency")
  .withInput(createAgencySchema)
  .withDeps<{
    createNewEvent: CreateNewEvent;
    uuidGenerator: UuidGenerator;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ uow, deps, inputParams }) => {
    const agency = {
      id: deps.uuidGenerator.new(),
      ...inputParams,
      createdAt: deps.timeGateway.now(),
    };
    await uow.agencyRepository.insert(agency);

    const event = deps.createNewEvent({
      topic: "AgencyAdded",
      payload: { agency },
    });
    await uow.outboxRepository.save(event);
  });
```

**Key points:**
- Name follows `make<UseCaseName>` pattern
- `.withInput(zodSchema)` for input validation
- `.withDeps<T>()` for explicit dependency injection
- `uow` (Unit of Work) provides access to all repositories
- Transactional by default (use `.notTransactional()` if needed)

### Use Cases Index

All use cases instantiated in `back/src/config/bootstrap/createUseCases.ts`.

### Repository Pattern

**Port (Interface)** - `back/src/domains/convention/ports/ConventionRepository.ts`:

```typescript
import type { ConventionDto, ConventionId, DateString } from "shared";

export interface ConventionRepository {
  save: (conventionDto: ConventionDto, now?: DateString) => Promise<void>;
  getById: (id: ConventionId) => Promise<ConventionDto | undefined>;
  update: (conventionDto: ConventionDto, now?: DateString) => Promise<ConventionId | undefined>;
}
```

**InMemory Adapter** - for tests, with direct state access.

**PostgreSQL Adapter** - for production, uses Kysely.

### Unit of Work Pattern

All repositories accessed through UoW - `back/src/domains/core/unit-of-work/ports/UnitOfWork.ts`.

### Event-Driven Architecture

**Mutations should always save an event** via the outbox pattern:

```typescript
const event = deps.createNewEvent({
  topic: "ConventionSubmittedByBeneficiary",
  payload: { convention, triggeredBy },
});
await uow.outboxRepository.save(event);
```

**Events defined in:** `back/src/domains/core/events/events.ts`

**Event subscriptions in:** `back/src/domains/core/events/subscribeToEvents.ts`

## Testing

Jest 29, patterns: `*.unit.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts`

**Testing requirements:**
- **Use cases must have unit tests** - test all business cases with InMemory adapters (exhaustive)
- **Pg repository changes require integration tests** - test against real database
- **Backend E2E tests** - verify HTTP endpoints work (plumbing only, not exhaustive)

### Unit Test Pattern (Use Cases)

Use builders for test data and InMemory adapters:

```typescript
// back/src/domains/convention/use-cases/SomeUseCase.unit.test.ts
import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  expectToEqual,
} from "shared";
import { createInMemoryUow } from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";

describe("SomeUseCase", () => {
  let uow: InMemoryUnitOfWork;
  let someUseCase: ReturnType<typeof makeSomeUseCase>;

  const agency = new AgencyDtoBuilder()
    .withId("agency-id")
    .withKind("france-travail")
    .build();

  const convention = new ConventionDtoBuilder()
    .withId("convention-id")
    .withAgencyId(agency.id)
    .withStatus("READY_TO_SIGN")
    .build();

  beforeEach(() => {
    uow = createInMemoryUow();
    const uowPerformer = new InMemoryUowPerformer(uow);
    someUseCase = makeSomeUseCase({ uowPerformer, deps: { ... } });
  });

  it("does something with valid convention", async () => {
    uow.conventionRepository.setConventions([convention]);
    uow.agencyRepository.setAgencies([agency]);

    await someUseCase.execute({ conventionId: convention.id });

    expectToEqual(uow.conventionRepository.conventions[0].status, "IN_REVIEW");
  });

  it("throws when convention not found", async () => {
    await expectPromiseToFailWithError(
      someUseCase.execute({ conventionId: "unknown-id" }),
      errors.convention.notFound({ conventionId: "unknown-id" })
    );
  });
});
```

**Key points:**
- Use builders: `new ConventionDtoBuilder().withStatus("DRAFT").build()`
- Use `createInMemoryUow()` for test setup
- Access repository state directly for assertions
- Use `expectPromiseToFailWithError` for error cases
- No framework mocks - use real InMemory implementations

### Integration Test Pattern (Pg Repositories)

```typescript
import type { Pool } from "pg";
import { expectToEqual } from "shared";
import { makeKyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";

describe("PgSomeRepository", () => {
  let pool: Pool;
  let db: KyselyDb;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.deleteFrom("some_table").execute();
  });
});
```

Playwright for E2E in `playwright-e2e/` workspace.

## Database

- PostgreSQL with Kysely query builder
- **Schema types:** `back/src/config/pg/kysely/model/database.ts` - all table definitions
- Migrations in `back/src/config/pg/migrations/` (TypeScript `.ts` files)
- **Always use `pnpm back db:create NAME`** to create migrations (correct timestamp)
- `pnpm back db:up` / `pnpm back db:down` to apply/rollback
- Local dev: `docker-compose -f docker-compose.resources.yml up --build` (Postgres:5432, Adminer:8080)

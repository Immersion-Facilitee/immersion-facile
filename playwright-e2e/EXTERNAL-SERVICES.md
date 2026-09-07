# External service coverage

The normal E2E suite uses deterministic SIRET responses. Agency SIRETs are
separate from the establishments created/deleted by the other workflows.
ProConnect remains real: admin login runs alongside the two sequential IC
login entry points (establishment and agency).

The `External SIRET E2E` workflow runs daily and can be dispatched manually.
It uses a fresh local backend and browser, the real Annuaire gateway (including
its configured INSEE fallback), and verifies that entering a public SIRET fills
the convention form. It does not submit a convention or mutate the external
service. It is deliberately outside the PR checks, has no retries and reports
failures normally; the team should investigate a red scheduled run.

Run locally with credentials from `back/.env`:

```sh
pnpm test:e2e --config playwright.external.config.ts
```

The schedule becomes active after merge to the default branch. This smoke test
covers the nominal lookup, not a guaranteed exercise of the INSEE fallback.
Neither external availability nor every possible SIRET response is covered by
the deterministic suite. The adapter tests remain responsible for response and
fallback cases.

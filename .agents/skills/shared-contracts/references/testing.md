# Shared contract testing

Test shared behavior at its contract boundary.

- Cover accepted values and each meaningful rejected boundary for Zod schemas.
- Verify transformations, defaults, refinements, and localized validation behavior when present.
- Keep DTO builders valid by default and make overrides explicit for the scenario under test.
- Add regression coverage for utility behavior rather than asserting TypeScript-only structure at runtime.
- Use existing shared test helpers and nearby domain tests instead of framework mocks.

Run the focused Jest test while iterating. `pnpm shared test` runs the shared test suite; use `pnpm shared typecheck` for contract-level type checking.

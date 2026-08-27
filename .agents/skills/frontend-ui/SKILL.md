---
name: frontend-ui
description: Change React UI in front or libs/react-design-system, including DSFR components, centralized DOM IDs, SCSS/BEM styling, and generated style typings.
---

# Frontend UI

Build the requested interface within the existing React, DSFR, state-management, content, and styling conventions.

Before editing TypeScript, read [the repository TypeScript style](../../references/typescript-code-style.md). Read [architecture](references/architecture.md) before changing a page, component, form, content module, or frontend state. Read [styling](references/styling.md) only when adding or modifying styles.

Inspect nearby components serving the same journey before introducing a new abstraction. Prefer existing [React-DSFR](https://github.com/codegouvfr/react-dsfr) or `react-design-system` components and keep user-facing text with the relevant content modules.

When adding or changing a shared DOM ID, DTO, schema, or route, also follow the `shared-contracts` skill.

Run the narrow relevant frontend checks while iterating. Regenerate style typings after SCSS changes and run `pnpm fullcheck` after a significant change.

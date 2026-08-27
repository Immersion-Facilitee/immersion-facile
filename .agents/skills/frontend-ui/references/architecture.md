# Frontend architecture

The React application lives in `front/src/`:

- `app/pages/` contains route-level pages;
- `app/components/` contains reusable application components;
- `app/contents/` contains user-facing and form content;
- `app/hooks/` contains React hooks;
- `core-logic/` contains Redux Toolkit slices, selectors, and Redux-Observable epics;
- `config/` contains frontend wiring.

Use DSFR through `@codegouvfr/react-dsfr` and reuse components from `libs/react-design-system/` when the project already provides the needed behavior.

Every button, link, form control, tab, modal action, and other interactive element needs a stable analytics and E2E identifier. Define IDs centrally in `shared/src/domElementIds.ts` and consume them through the `shared` package; do not hard-code local IDs.

Keep data fetching and state transitions in the existing core-logic patterns instead of embedding application workflows in presentation components. Keep static French wording in the relevant `*.content.ts` module when that journey already separates content from rendering.

# Frontend architecture

The React application lives in `front/src/`:

- `app/pages/` contains route-level pages named `*Page`; keep their sections in `app/components/`;
- `app/components/` contains application components that may depend on application state or other frontend logic;
- `app/contents/` contains user-facing and form content;
- `app/hooks/` contains React hooks reused by several components; keep a single-use hook with its component;
- `core-logic/` contains Redux Toolkit slices, selectors, and Redux-Observable epics;
- `config/` contains frontend wiring.

Use [React-DSFR](https://github.com/codegouvfr/react-dsfr) through `@codegouvfr/react-dsfr`. Put reusable headless or presentational components in `libs/react-design-system/`; keep components coupled to application state or workflows in `front/`.

Pages own route parameters, query strings, and other routing data and pass them to child components as props. Keep reusable components independent of routing. For legacy cases or to avoid prop drilling through more than three component levels, use `useTypedRoute` when direct route access is necessary; do not cast route data with `as`.

Every button, link, form control, tab, modal action, and other interactive element needs a stable analytics and E2E identifier. Define IDs centrally in `shared/src/domElementIds.ts` and consume them through the `shared` package; do not hard-code local IDs.

Keep data fetching and state transitions in the existing core-logic patterns instead of embedding application workflows in presentation components. Organize new slices by business domain; split a large domain into sub-slices with `combineReducers`, and use `extraReducers` when one slice must react to another slice's action. Follow the existing `Requested`, `Succeeded`, and `Failed` action naming where it fits the operation.

The backend owns cross-domain aggregation and exposes view models suited to frontend needs. Do not make the frontend assemble a missing cross-domain API model from several requests. Keep static French wording in the relevant `*.content.ts` module when that journey already separates content from rendering.

Sources: [front code organization](../../../../doc/adr/front/front-code-organisation.md), [slice organization](../../../../doc/adr/front/slice-organization.md), [route use in components](../../../../doc/adr/front/use-route-in-components.md), and [cross-domain query models](../../../../doc/adr/back/cross-domain-query-model.md).

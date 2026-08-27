# Frontend styling

Use SCSS and the existing BEM convention with the `im-` prefix:

```text
.im-<component>__<element>--<modifier>
```

Keep styles near the component or page following the surrounding structure. Reuse DSFR variables, utilities, spacing, and responsive behavior before adding custom rules.

After changing SCSS in `front/`, run `pnpm front make-styles`. For `libs/react-design-system/`, run `pnpm react-design-system make-styles`. Include the generated TypeScript changes when the generator updates them.

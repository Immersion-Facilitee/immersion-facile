# Email components

Components live in `libs/html-templates/src/email/components/`: `blocks/` for what a template can place in `blocks`, `layout/` for the fixed parts around them. `renderEmail.ts` assembles the layout and spaces rows with `marginBottom`.

## Block component

Each block file exports an `Email<Kind>Props` type and a `render<Kind>(props)` function taking that type, then is re-exported from `components/index.ts`. Adding a block kind touches, together:

- the block file in `blocks/`;
- `components/index.ts`;
- the `EmailBlock` union in `emailBlock.ts`, as `({ kind: "<kind>" } & Email<Kind>Props)`;
- the `renderEmailBlock` match in `emailBlock.ts`, which stays `.exhaustive()`;
- `DEMO_EMAIL_COMPONENTS`, showing the new kind and each of its variants.

A component is done when every kind and variant appears in the demo email and renders in the admin email preview.

## Email HTML

Email clients ignore most CSS, so components produce table-based HTML:

- Lay out with `<table>`, `<tr>` and `<td>`; use `width` and `align` attributes for sizing and alignment.
- Style with inline `style` attributes only, using DSFR hex colours already present in sibling components.
- Space elements with `padding` on `<td>`, reserving `margin: 0` for text elements.
- Pass text content through `ignoreTabs` and turn `\n` into `<br/>`, as `paragraph.ts` does.
- Name numeric constants with their unit (`calloutPaddingInPx`) and keep variant styles in a `Record` keyed by the variant type.

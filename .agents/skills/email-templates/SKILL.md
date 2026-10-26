---
name: email-templates
description: Create or change a transactional email template, its blocks, or the email components in libs/html-templates, including template tags, admin email preview values, and the demo email.
---

# Email templates

Describe transactional emails as blocks placed inside the fixed layout owned by `libs/html-templates`.

Before editing TypeScript, read [the repository TypeScript style](../../references/typescript-code-style.md). Read [architecture](references/architecture.md) before adding or changing a template. Read [components](references/components.md) only when adding or changing a block or layout component.

Inspect the closest template of the same theme and recipient before writing a new one, and use `DEMO_EMAIL_COMPONENTS` as the catalogue of available blocks and options.

When the email is sent from a new or changed use case, also follow the `backend-use-cases` skill.

Check the rendering in the admin email preview while iterating. Run `pnpm fullcheck` after a significant change.

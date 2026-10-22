---
name: email-templates
description: Create or change a transactional email template, its blocks, or the email components in libs/html-templates.
---

# Email templates

An email is a list of **blocks** placed inside a fixed layout. A template only describes its subject, texts and blocks; `libs/html-templates` owns all the HTML.

Before editing TypeScript, read [the repository TypeScript style](../../references/typescript-code-style.md). Read [email components](references/email-components.md) only when adding or changing a block or layout component.

## Adding an email

1. Declare the template params in `EmailParamsByEmailType` (`shared/src/email/EmailParamsByEmailType.ts`).
2. Add the template to `shared/src/email/emailTemplatesByName.ts`. Start from `DEMO_EMAIL_COMPONENTS`, which uses every block and option.
3. Add realistic preview values to `defaultEmailValueByEmailKind` in `front/src/app/pages/admin/EmailPreviewTab.tsx`.
4. Send it from the backend as a notification whose `templatedContent.kind` is the template name, following the `backend-use-cases` skill.

The step is done when `shared` and `front` typecheck and the email renders in the admin email preview (`templateName` query param of the `adminEmailPreview` route).

## Email anatomy

`createEmailVariables` returns `EmailVariables` (`libs/html-templates/src/email/emailVariables.ts`). The layout order is fixed:

1. header, chosen by the generator configuration (default or CCI), showing `agencyLogoUrl` when provided;
2. `greetings`, required;
3. `blocks`, in array order;
4. `signature`, required, usually `defaultSignature(internshipKind)`;
5. `legals`, optional, always preceded by a divider;
6. footer, chosen by the generator configuration.

`subject` and `attachmentUrls` complete the variables; reuse `emailAttachements` from `shared/src/email/email.content.ts` for attachments.

An email relayed between discussion participants returns `RawEmailVariables` (`subject` and `rawContent`) instead: it is sent without layout, under the reply separator header.

## Blocks

The `EmailBlock` union in `libs/html-templates/src/email/emailBlock.ts` is the source of truth for the available kinds and their props. Write blocks as object literals with `kind` first: TypeScript then narrows completion to that kind's props.

- Text props are HTML strings: use `<strong>`, `<em>` and `<a href>` inline. Indentation tabs are stripped, so indented template literals are safe. Line breaks become `<br/>` in `greetings`, `signature`, `legals`, `paragraph`, `highlight` and `list` items.
- Every block accepts `marginBottom` (`sm` 8px, `md` 16px or `lg` 32px), defaulting to `md`. Override it only to group related blocks: `sm` between a title paragraph and its content, `lg` before the next section.
- A `callout` holds `paragraph`, `list` and `buttonsGroup` blocks, rendered in array order.
- Express emphasis through the existing blocks (`highlight`, `callout`, button priorities) and keep inline `style` attributes out of templates.

Run `pnpm fullcheck` before handing off.

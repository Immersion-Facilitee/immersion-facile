# Email template architecture

An email is a list of **blocks** placed inside a fixed layout. A template only describes its subject, texts and blocks; `libs/html-templates` owns all the HTML.

## Adding an email

1. Declare the template params in `EmailParamsByEmailType` (`shared/src/email/EmailParamsByEmailType.ts`).
2. Add the template to `shared/src/email/emailTemplatesByName.ts`, with a `niceName` and `tags` following the neighbouring templates.
3. Add realistic preview values to `defaultEmailValueByEmailKind` in `front/src/app/pages/admin/EmailPreviewTab.tsx`.
4. Send it from the backend as a notification whose `templatedContent.kind` is the template name.

The email is done when `shared`, `front` and `back` typecheck and it renders in the admin email preview (`templateName` query param of the `adminEmailPreview` route).

## Template metadata

- `niceName` follows the `<Area> - <Theme or recipient> - <Purpose>` shape of the neighbouring templates and is shown in the admin preview selector.
- `tags` feed the email provider statistics. Use the typed `NormalizedEmailTag` values from `libs/html-templates/src/createTemplatesByName.ts`: one `template:<name>`, one `theme:<theme>` and one `role:<role>` per recipient role.

## Email anatomy

`createEmailVariables` returns `EmailVariables` (`libs/html-templates/src/email/emailVariables.ts`). The layout order is fixed:

1. header, chosen by the generator configuration (default or CCI), showing `agencyLogoUrl` when provided;
2. `greetings`, required;
3. `blocks`, in array order;
4. `signature`, required, usually `defaultSignature(internshipKind)` from `emailTemplatesByName.ts`;
5. `legals`, optional, always preceded by a divider;
6. footer, chosen by the generator configuration.

`subject` and `attachmentUrls` complete the variables; reuse `emailAttachements` from `shared/src/email/email.content.ts` for attachments.

`RawEmailVariables` (`subject` and `rawContent`) are reserved for `DISCUSSION_EXCHANGE` and `WARN_DISCUSSION_DELIVERY_FAILED`: they are sent without layout, under the reply separator header. Do not use them for a new email.

## Blocks

The `EmailBlock` union in `libs/html-templates/src/email/emailBlock.ts` is the source of truth for the available kinds and their props. Write blocks as object literals with `kind` first: TypeScript then narrows completion to that kind's props.

- Text props are HTML strings: use `<strong>`, `<em>` and `<a href>` inline. Leading indentation is stripped, so indented template literals are safe. Line breaks become `<br/>` in `greetings`, `signature`, `legals`, `paragraph`, `highlight` and `list` items.
- Top-level blocks accept `marginBottom` (`sm` 8px, `md` 16px or `lg` 32px), defaulting to `md`. Override it only to group related blocks: `sm` between a title paragraph and its content, `lg` before the next section.
- A `callout` holds `paragraph`, `list` and `buttonsGroup` blocks, rendered in array order with a fixed gap; they do not accept `marginBottom`.
- Express emphasis through the existing blocks (`highlight`, `callout`, button priorities) and keep inline `style` attributes out of templates.

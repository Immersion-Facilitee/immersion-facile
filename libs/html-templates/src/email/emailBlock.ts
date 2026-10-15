import { match } from "ts-pattern";
import {
  type EmailButtonProps,
  type EmailButtonsGroupProps,
  type EmailCalloutProps,
  renderButton,
  renderButtonsGroup,
  renderCallout,
  renderDivider,
  renderHighlight,
  renderList,
  renderParagraph,
} from "./components";

export type EmailMargin = "sm" | "md" | "lg";

export const emailMarginInPx: Record<EmailMargin, number> = {
  sm: 8,
  md: 16,
  lg: 32,
};

type CommonEmailBlockProps = {
  marginBottom?: EmailMargin;
};

export type EmailBlock = (
  | { kind: "paragraph"; content: string }
  | { kind: "list"; numbered?: boolean; items: string[] }
  | ({ kind: "button" } & EmailButtonProps)
  | ({ kind: "buttonsGroup" } & EmailButtonsGroupProps)
  | { kind: "highlight"; content: string }
  | ({ kind: "callout" } & EmailCalloutProps)
  | { kind: "divider" }
) &
  CommonEmailBlockProps;

export const renderEmailBlock = (block: EmailBlock): string | undefined =>
  match(block)
    .with({ kind: "paragraph" }, ({ content }) => renderParagraph(content))
    .with({ kind: "list" }, ({ items, numbered }) =>
      renderList({ items, numbered }),
    )
    .with({ kind: "button" }, ({ url, label, priority }) =>
      renderButton({ url, label, priority }),
    )
    .with({ kind: "buttonsGroup" }, ({ buttons, layout }) =>
      renderButtonsGroup({ buttons, layout }),
    )
    .with({ kind: "highlight" }, ({ content }) => renderHighlight(content))
    .with({ kind: "callout" }, ({ blocks, buttonsGroup, variant }) =>
      renderCallout({ blocks, buttonsGroup, variant }),
    )
    .with({ kind: "divider" }, () => renderDivider())
    .exhaustive();

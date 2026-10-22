import { match } from "ts-pattern";
import {
  type EmailButtonProps,
  type EmailButtonsGroupProps,
  type EmailCalloutProps,
  type EmailHighlightProps,
  type EmailListProps,
  type EmailParagraphProps,
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
  | ({ kind: "paragraph" } & EmailParagraphProps)
  | ({ kind: "list" } & EmailListProps)
  | ({ kind: "button" } & EmailButtonProps)
  | ({ kind: "buttonsGroup" } & EmailButtonsGroupProps)
  | ({ kind: "highlight" } & EmailHighlightProps)
  | ({ kind: "callout" } & EmailCalloutProps)
  | { kind: "divider" }
) &
  CommonEmailBlockProps;

export const renderEmailBlock = (block: EmailBlock): string =>
  match(block)
    .with({ kind: "paragraph" }, renderParagraph)
    .with({ kind: "list" }, renderList)
    .with({ kind: "button" }, renderButton)
    .with({ kind: "buttonsGroup" }, renderButtonsGroup)
    .with({ kind: "highlight" }, renderHighlight)
    .with({ kind: "callout" }, renderCallout)
    .with({ kind: "divider" }, renderDivider)
    .exhaustive();

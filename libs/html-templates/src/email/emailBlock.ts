import { match } from "ts-pattern";
import {
  type EmailButtonProps,
  type HighlightKind,
  renderButton,
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
  | { kind: "buttons"; buttons: EmailButtonProps[] }
  | { kind: "highlight"; variant?: HighlightKind; content: string }
) &
  CommonEmailBlockProps;

export const renderEmailBlock = (block: EmailBlock): string | undefined =>
  match(block)
    .with({ kind: "paragraph" }, ({ content }) => renderParagraph(content))
    .with({ kind: "list" }, ({ items, numbered }) =>
      renderList({ items, numbered }),
    )
    .with({ kind: "buttons" }, ({ buttons }) => renderButton(buttons))
    .with({ kind: "highlight" }, ({ variant, content }) =>
      renderHighlight({ kind: variant, content }),
    )
    .exhaustive();

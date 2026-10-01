import { match } from "ts-pattern";
import {
  type EmailButtonProps,
  type HighlightKind,
  renderButton,
  renderContent,
  renderHighlight,
  renderHighlightContentWithCTA,
} from "./components";

export type EmailBlock =
  | { kind: "content"; content: string }
  | { kind: "buttons"; buttons: EmailButtonProps[] }
  | { kind: "highlight"; variant?: HighlightKind; content: string }
  | {
      kind: "highlightContentWithCTA";
      content?: string;
      button?: EmailButtonProps;
    };

export const renderEmailBlock = (block: EmailBlock): string | undefined =>
  match(block)
    .with({ kind: "content" }, ({ content }) => renderContent(content))
    .with({ kind: "buttons" }, ({ buttons }) => renderButton(buttons))
    .with({ kind: "highlight" }, ({ variant, content }) =>
      renderHighlight({ kind: variant, content }),
    )
    .with({ kind: "highlightContentWithCTA" }, (highlightContentWithCTA) =>
      renderHighlightContentWithCTA(highlightContentWithCTA),
    )
    .exhaustive();

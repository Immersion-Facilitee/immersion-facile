import { match } from "ts-pattern";
import {
  type EmailButtonsGroupProps,
  renderButtonsGroup,
} from "./buttonsGroup";
import { type EmailListProps, renderList } from "./list";
import { type EmailParagraphProps, renderParagraph } from "./paragraph";

export type EmailCalloutContentBlock =
  | ({ kind: "paragraph" } & EmailParagraphProps)
  | ({ kind: "list" } & EmailListProps)
  | ({ kind: "buttonsGroup" } & EmailButtonsGroupProps);

export type EmailCalloutVariant = "primary" | "secondary";

export type EmailCalloutProps = {
  blocks: [EmailCalloutContentBlock, ...EmailCalloutContentBlock[]];
  variant?: EmailCalloutVariant;
};

const calloutPaddingInPx = 20;
const calloutRowsGapInPx = 8;

const calloutStyleByVariant: Record<EmailCalloutVariant, string> = {
  primary: "background-color: #f5f5fe;",
  secondary: "border: 1px solid #dddddd;",
};

const renderCalloutContentBlock = (block: EmailCalloutContentBlock): string =>
  match(block)
    .with({ kind: "paragraph" }, ({ content }) => renderParagraph({ content }))
    .with({ kind: "list" }, ({ items, numbered }) =>
      renderList({ items, numbered }),
    )
    .with({ kind: "buttonsGroup" }, ({ buttons, layout }) =>
      renderButtonsGroup({ buttons, layout }),
    )
    .exhaustive();

export const renderCallout = ({
  blocks,
  variant = "primary",
}: EmailCalloutProps): string => {
  const rows = blocks.map(renderCalloutContentBlock);
  return `<table width="100%" style="${calloutStyleByVariant[variant]}">
    <tr>
      <td style="padding: ${calloutPaddingInPx}px;">
        <table width="100%">
          ${rows
            .map(
              (row, index) =>
                `<tr>
                  <td style="padding-bottom: ${index === rows.length - 1 ? 0 : calloutRowsGapInPx}px;">
                    ${row}
                  </td>
                </tr>`,
            )
            .join("")}
        </table>
      </td>
    </tr>
  </table>`;
};

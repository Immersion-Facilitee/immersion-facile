import { ignoreTabs } from "../../../helpers/formatters";

export type HighlightVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "error";

const highlightColorsByVariant: Record<
  HighlightVariant,
  { barColor: string; textColor: string }
> = {
  default: { barColor: "#6a6af4", textColor: "#000091" },
  info: { barColor: "#0063cb", textColor: "#0063cb" },
  success: { barColor: "#18753c", textColor: "#18753c" },
  warning: { barColor: "#b34000", textColor: "#b34000" },
  error: { barColor: "#ce0500", textColor: "#ce0500" },
};

export const renderHighlight = ({
  content,
  variant = "default",
}: {
  content: string;
  variant?: HighlightVariant;
}): string => {
  const { barColor, textColor } = highlightColorsByVariant[variant];
  return `<table>
    <tr>
      <td width="4" style="width: 4px; background-color: ${barColor};"></td>
      <td style="padding-left: 20px;">
        <p style="margin: 0; font-size: 16px; line-height: 24px; color: ${textColor};">
          ${ignoreTabs(content).split("\n").join("<br/>")}
        </p>
      </td>
    </tr>
  </table>`;
};

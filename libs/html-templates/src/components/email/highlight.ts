import { ignoreTabs } from "../../helpers/formatters";

export type HighlightKind = "success" | "error" | "warning" | "info";

export const renderHighlight = (
  props:
    | {
        kind?: HighlightKind;
        content?: string;
      }
    | undefined,
): string | undefined => {
  const kind = props?.kind ?? "info";
  return (
    props?.content &&
    `<table style="margin-top: 5px; margin-bottom: 25px;">
    <tr>
      <td align="center" width="4" style="background-color: ${getHighlightColor(
        kind,
      )};">
      </td>
      <td width="25">
      </td>
      <td>
       <p style="color: #000093; font-weight: bold; margin-top: 1rem;">
       ${ignoreTabs(props.content).split("\n").join("<br/>")}
       </p>
      </td>
    </tr>
  </table>`
  );
};

const getHighlightColor = (kind: HighlightKind) => {
  const colors = {
    success: "#00B500",
    error: "#FF0000",
    warning: "#FFA500",
    info: "#6A6AF4",
  };
  return colors[kind];
};

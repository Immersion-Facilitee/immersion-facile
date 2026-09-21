import { ignoreTabs } from "../../helpers/formatters";
import { type EmailButtonProps, getButtonStyle } from "./button";

export const renderHighlightContentWithCTA = (
  props:
    | {
        content?: string;
        button?: EmailButtonProps;
      }
    | undefined,
): string | undefined =>
  props
    ? `<table style="margin-top: 5px; margin-bottom: 25px; border-collapse: collapse; border-spacing: 0;">
    ${
      props.content
        ? `<tr>
      <td style="background-color: #F5F5FE; padding: 20px; padding-top: 10px; padding-bottom:10px;">
        <p style="margin-bottom:0">${ignoreTabs(props.content).split("\n").join("<br/>")}</p>
      </td>
    </tr>`
        : ""
    }
    ${
      props.button
        ? `<tr>
      <td align="center" width="600" style="background-color: #F5F5FE; padding: 20px; padding-top: 10px; padding-bottom:10px;" >
        <a
          style="${getButtonStyle(0)}"
          href="${props.button.url}"
          ${props.button.target ? `target="${props.button.target}"` : ""}
        >${props.button.label}</a>
      </td>
    </tr>`
        : ""
    }
  </table>`
    : "";

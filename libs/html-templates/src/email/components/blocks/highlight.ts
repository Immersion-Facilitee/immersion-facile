import { convertLineBreaksToHtml } from "../../../helpers/formatters";
import { emailBodyTextStyle } from "../typography";

export type EmailHighlightProps = {
  content: string;
};

export const renderHighlight = ({ content }: EmailHighlightProps): string =>
  `<table>
    <tr>
      <td width="4" style="width: 4px; background-color: #6a6af4;"></td>
      <td style="padding-left: 20px;">
        <p style="margin: 0; ${emailBodyTextStyle} color: #000091;">
          ${convertLineBreaksToHtml(content)}
        </p>
      </td>
    </tr>
  </table>`;

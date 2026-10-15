import { ignoreTabs } from "../../../helpers/formatters";

export const renderHighlight = (content: string): string =>
  `<table>
    <tr>
      <td width="4" style="width: 4px; background-color: #6a6af4;"></td>
      <td style="padding-left: 20px;">
        <p style="margin: 0; font-size: 16px; line-height: 24px; color: #000091;">
          ${ignoreTabs(content).split("\n").join("<br/>")}
        </p>
      </td>
    </tr>
  </table>`;

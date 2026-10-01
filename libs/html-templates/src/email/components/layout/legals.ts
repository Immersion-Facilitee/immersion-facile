import { ignoreTabs } from "../../../helpers/formatters";

export const renderLegals = (content: string | undefined): string | undefined =>
  content &&
  `<table width="600">
    <tr>
      <td height="20">
      </td>
    </tr>
    <tr>
      <td align="center" height="8" style="background-color: #F5F5FE;">
      </td>
    </tr>
    <tr>
      <td height="10">
      </td>
    </tr>
    <tr>
      <td>
       <p style="color: #666; font-size: 10px; line-height: 1.6;">
        ${ignoreTabs(content).split("\n").join("<br/>")}
       </p>
      </td>
    </tr>
  </table>`;

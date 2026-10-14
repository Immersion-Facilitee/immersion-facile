import { ignoreTabs } from "../../../helpers/formatters";
import { renderDivider } from "../blocks/divider";

export const renderLegals = (content: string | undefined): string | undefined =>
  content &&
  `<table width="600">
    <tr>
      <td height="20">
      </td>
    </tr>
    <tr>
      <td>
        ${renderDivider()}
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

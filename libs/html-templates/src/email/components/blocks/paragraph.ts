import { ignoreTabs } from "../../../helpers/formatters";

export const renderParagraph = (content: string): string =>
  `<p style="margin: 0;">${ignoreTabs(content).split("\n").join("<br/>")}</p>`;

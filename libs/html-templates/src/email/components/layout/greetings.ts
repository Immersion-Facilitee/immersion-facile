import { ignoreTabs } from "../../../helpers/formatters";

export const renderGreetings = (content: string | undefined) =>
  content &&
  `<p style="margin: 0;">${ignoreTabs(content).split("\n").join("<br/>")}</p>`;

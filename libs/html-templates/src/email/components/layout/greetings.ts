import { ignoreTabs } from "../../../helpers/formatters";

export const renderGreetings = (content: string | undefined) =>
  content && `<p>${ignoreTabs(content).split("\n").join("<br/>")}</p>`;

import { ignoreTabs, wrapElements } from "../../../helpers/formatters";

export const renderSignature = (content: string): string =>
  wrapElements(`<p>${ignoreTabs(content).split("\n").join("<br/>")}</p>`);

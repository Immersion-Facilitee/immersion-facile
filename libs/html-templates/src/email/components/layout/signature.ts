import { ignoreTabs, wrapElements } from "../../../helpers/formatters";

export const renderSignature = (content: string): string =>
  wrapElements(
    `<p style="margin: 0;">${ignoreTabs(content).split("\n").join("<br/>")}</p>`,
  );

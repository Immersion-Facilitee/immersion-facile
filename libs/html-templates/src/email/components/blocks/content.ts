import { ignoreTabs, wrapElements } from "../../../helpers/formatters";

export const renderContent = (
  content: string | undefined,
  options: { wrapInTable: boolean; replaceNewLines: boolean } = {
    wrapInTable: true,
    replaceNewLines: true,
  },
): string | undefined => {
  if (!content) return;
  const formattedContent = options.replaceNewLines
    ? `<p>${ignoreTabs(content).split("\n").join("<br/>")}</p>`
    : `<p>${ignoreTabs(content)}</p>`;

  return options.wrapInTable
    ? wrapElements(formattedContent)
    : formattedContent;
};

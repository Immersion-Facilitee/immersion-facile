import { ignoreTabs } from "../../../helpers/formatters";

export const renderList = ({
  items,
  numbered,
}: {
  items: string[];
  numbered?: boolean;
}): string => {
  const tag = numbered ? "ol" : "ul";
  const marginLeft = numbered ? "32px" : "24px";
  return `<${tag} style="margin: 0 0 0 ${marginLeft}; padding: 0;">${items
    .map(
      (item, index) =>
        `<li style="margin: 0 0 ${index === items.length - 1 ? 0 : 4}px 0;">${ignoreTabs(item)}</li>`,
    )
    .join("")}</${tag}>`;
};

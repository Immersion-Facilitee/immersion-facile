import { ignoreTabs } from "../../../helpers/formatters";

export type EmailParagraphProps = {
  content: string;
};

export const renderParagraph = ({ content }: EmailParagraphProps): string =>
  `<p style="margin: 0;">${ignoreTabs(content).split("\n").join("<br/>")}</p>`;

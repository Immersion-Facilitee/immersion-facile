import { convertLineBreaksToHtml } from "../../../helpers/formatters";

export type EmailParagraphProps = {
  content: string;
};

export const renderParagraph = ({ content }: EmailParagraphProps): string =>
  `<p style="margin: 0;">${convertLineBreaksToHtml(content)}</p>`;

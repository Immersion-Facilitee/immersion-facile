import { convertLineBreaksToHtml } from "../../../helpers/formatters";
import { emailBodyTextStyle } from "../typography";

export type EmailParagraphProps = {
  content: string;
};

export const renderParagraph = ({ content }: EmailParagraphProps): string =>
  `<p style="margin: 0; ${emailBodyTextStyle}">${convertLineBreaksToHtml(content)}</p>`;

import { configureGenerateHtmlFromTemplate } from "./configureGenerateHtmlFromTemplate";
import { createTemplatesByName } from "./createTemplatesByName";
import { convertTextToHtml, ignoreTabs } from "./helpers/formatters";

export type { GenerateHtmlOptions } from "./configureGenerateHtmlFromTemplate";
export { defaultEmailFooter } from "./email/components/layout/footer";
export { cciCustomHtmlHeader } from "./email/components/layout/header";
export type { EmailBlock } from "./email/emailBlock";
export {
  configureGenerateHtmlFromTemplate,
  convertTextToHtml,
  createTemplatesByName,
  ignoreTabs,
};

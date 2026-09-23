import { configureGenerateHtmlFromTemplate } from "./configureGenerateHtmlFromTemplate";
import { createEmailTemplate } from "./createEmailTemplate";
import { createTemplatesByName } from "./createTemplatesByName";
import { ignoreTabs } from "./helpers/formatters";

export type { EmailBlock } from "./components/email/block";
export type { EmailButtonProps } from "./components/email/button";
export { defaultEmailFooter } from "./components/email/footer";
export { cciCustomHtmlHeader } from "./components/email/header";
export type { HighlightKind } from "./components/email/highlight";
export type { GenerateHtmlOptions } from "./configureGenerateHtmlFromTemplate";
export {
  configureGenerateHtmlFromTemplate,
  createEmailTemplate,
  createTemplatesByName,
  ignoreTabs,
};

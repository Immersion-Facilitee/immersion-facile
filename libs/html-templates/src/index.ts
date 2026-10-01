import { configureGenerateHtmlFromTemplate } from "./configureGenerateHtmlFromTemplate";
import { createTemplatesByName } from "./createTemplatesByName";
import { ignoreTabs } from "./helpers/formatters";

export type { EmailButtonProps } from "./components/email/button";
export { defaultEmailFooter } from "./components/email/footer";
export { cciCustomHtmlHeader } from "./components/email/header";
export type { GenerateHtmlOptions } from "./configureGenerateHtmlFromTemplate";
export { createEmailTemplate } from "./email/createEmailTemplate";
export type { EmailBlock } from "./email/emailBlock";
export { configureGenerateHtmlFromTemplate, createTemplatesByName, ignoreTabs };

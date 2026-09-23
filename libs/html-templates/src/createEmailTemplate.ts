import type {
  HtmlTemplateEmailData,
  OrderedEmailTemplateData,
} from "./createTemplatesByName";

export const createEmailTemplate = <Params>(
  template: OrderedEmailTemplateData<Params>,
): HtmlTemplateEmailData<Params> => template;

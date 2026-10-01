import type { HtmlTemplateEmailData } from "../createTemplatesByName";
import type { EmailBlock } from "./emailBlock";

export type EmailVariables = {
  subject: string;
  agencyLogoUrl?: string;
  greetings: string;
  blocks: EmailBlock[];
  signature: string;
  legals?: string;
  attachmentUrls?: string[];
};

export const isEmailVariables = (
  variables: object,
): variables is EmailVariables => "blocks" in variables;

type EmailTemplateData<Params> = Omit<
  HtmlTemplateEmailData<Params>,
  "createEmailVariables"
> & {
  createEmailVariables: (params: Params) => EmailVariables;
};

export const createEmailTemplate = <Params>(
  template: EmailTemplateData<Params>,
): HtmlTemplateEmailData<Params> => template;

import type { HtmlTemplateEmailData } from "./createTemplatesByName";
import { isRawEmailVariables } from "./email/emailVariables";
import {
  type RenderedEmail,
  renderEmail,
  renderRawEmail,
} from "./email/renderEmail";

export type GenerateHtmlOptions = {
  skipHead?: boolean;
  showContentParts?: boolean;
};

export const configureGenerateHtmlFromTemplate =
  <TemplateByName extends Record<string, HtmlTemplateEmailData<any>>>(
    templateByName: TemplateByName,
    customParts: {
      header: ((agencyLogoUrl?: string) => string) | undefined;
      footer: (() => string) | undefined;
    },
  ) =>
  <N extends keyof TemplateByName>(
    templateName: N,
    params: Parameters<TemplateByName[N]["createEmailVariables"]>[0],
    options: GenerateHtmlOptions = {},
  ): RenderedEmail => {
    const { createEmailVariables, tags } = templateByName[templateName];
    const emailVariables = createEmailVariables(params);
    return isRawEmailVariables(emailVariables)
      ? renderRawEmail({ emailVariables, tags })
      : renderEmail({ emailVariables, tags, customParts, options });
  };
